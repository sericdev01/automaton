import { ChatMessage, InferenceResponse, TokenUsage, InferenceClient, InferenceOptions } from "../types.js";

/**
 * Native Google Gemini Client Factory
 * Bypasses the OpenAI compatibility layer which is proving unreliable.
 * Now includes TOOL SUPPORT.
 */
export function createGeminiClient(
    apiKey: string,
    defaultModel: string,
    maxTokens: number
): InferenceClient {
    let currentModel = defaultModel;

    const chat = async (
        messages: ChatMessage[],
        opts?: InferenceOptions
    ): Promise<InferenceResponse> => {
        const model = opts?.model || currentModel;
        const tokenLimit = opts?.maxTokens || maxTokens;
        return chatWithGemini(apiKey, model, messages, tokenLimit, opts?.tools);
    };

    const setLowComputeMode = (enabled: boolean): void => {
        if (enabled) {
            currentModel = "gemini-1.5-flash";
        } else {
            currentModel = defaultModel;
        }
    };

    const getDefaultModel = (): string => currentModel;

    return {
        chat,
        setLowComputeMode,
        getDefaultModel
    };
}

/**
 * Internal function to perform the actual native API call
 */
async function chatWithGemini(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    maxTokens: number,
    tools?: any[]
): Promise<InferenceResponse> {
    // Strip "models/" prefix if present
    const cleanModel = model.replace(/^models\//, "");

    // Construct URL for native GenerateContent API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

    // 1. Map Tools (OpenAI -> Gemini)
    let geminiTools: any = undefined;
    if (tools && tools.length > 0) {
        const functionDeclarations = tools.map((t: any) => {
            // OpenAI: { type: 'function', function: { name, description, parameters } }
            // Gemini: { name, description, parameters }
            return {
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            };
        });
        geminiTools = [{ functionDeclarations }];
    }

    // 2. Map Messages (OpenAI -> Gemini)
    // We map ALL messages to contents. System -> User.
    // Tool results -> User text (Simplification to avoid complex funtionResponse mapping)
    const contents = messages.map(msg => {
        let role = "user";
        let text = msg.content || "";

        if (msg.role === "assistant") {
            role = "model";
            // If assistant message has NO content but HAS tool_calls, we must provide some text or native functionCall
            // For simplicity in this direction (history), we can just say "Calling tool..."
            if (!text && msg.tool_calls) {
                text = `[Calling tools: ${msg.tool_calls.map((tc: any) => tc.function.name).join(", ")}]`;
            }
        } else if (msg.role === "tool") {
            role = "user";
            // Prefix to make it clear it's a tool output
            text = `[Tool Output]: ${text}`;
        } else if (msg.role === "system") {
            role = "user"; // Map system to user
        }

        // Ensure we never send empty text parts (Gemini 400 error)
        if (!text || text.trim() === "") {
            text = "...";
        }

        return {
            role,
            parts: [{ text: text + (role === "user" && msg === messages[messages.length - 1] ? "\n\n[SYSTEM: If you need to perform an action, use the available tools. Do not just describe the action.]" : "") }]
        };
    });

    // Safety check: contents must not be empty
    if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const body: any = {
        contents,
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7
        }
    };

    if (geminiTools) {
        body.tools = geminiTools;
    }

    // console.log(`[GEMINI NATIVE] POST ${url.split("?")[0]} (Tools: ${tools ? tools.length : 0})`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Gemini Native Error ${resp.status}: ${text}`);
        }

        const data = await resp.json() as any;

        // ... rest of processing ...
        return processGeminiResponse(data, cleanModel);

    } catch (err: any) {
        throw new Error(`Gemini Request Failed: ${err.message}`);
    }
}

// Helper to process response (extracted to avoid massive indentation)
function processGeminiResponse(data: any, cleanModel: string): InferenceResponse {
    // Parse response
    const candidate = data.candidates?.[0];
    if (!candidate) {
        throw new Error("No candidates returned from Gemini");
    }

    const contentParts = candidate.content?.parts || [];

    // Extract Text AND Function Calls
    let textContent = "";
    const toolCalls: any[] = [];

    for (const part of contentParts) {
        if (part.text) {
            textContent += part.text;
        }
        if (part.functionCall) {
            // Map Gemini functionCall -> OpenAI tool_call
            toolCalls.push({
                id: "call_" + Math.random().toString(36).substring(2, 9), // Gemini doesn't give IDs, generate one
                type: "function",
                function: {
                    name: part.functionCall.name,
                    arguments: JSON.stringify(part.functionCall.args || {}) // Gemini gives object -> stringify for OpenAI Compat
                }
            });
        }
    }

    const usage: TokenUsage = {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
    };

    return {
        id: "gemini-native-" + Date.now(),
        model: cleanModel,
        message: {
            role: "assistant",
            content: textContent,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        },
        toolCalls: toolCalls,
        usage,
        finishReason: candidate.finishReason === "STOP" ? "stop" : "length"
    };
}
