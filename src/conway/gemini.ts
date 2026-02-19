import { ChatMessage, InferenceResponse, TokenUsage, InferenceClient, InferenceOptions } from "../types.js";

/**
 * Native Google Gemini Client Factory
 * Bypasses the OpenAI compatibility layer which is proving unreliable.
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
        return chatWithGemini(apiKey, model, messages, tokenLimit);
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
    maxTokens: number
): Promise<InferenceResponse> {
    // Strip "models/" prefix if present
    const cleanModel = model.replace(/^models\//, "");

    // Construct URL for native GenerateContent API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

    // Convert OpenAI messages to Gemini Content format
    const contents = messages.map(msg => {
        let role = "user";
        if (msg.role === "assistant") role = "model";
        if (msg.role === "system") {
            // Map system to user logic is handled below via separating systemInstruction
            role = "user";
        }
        return {
            role,
            parts: [{ text: msg.content }]
        };
    });

    // Handle System Prompt separation if possible. 
    // v1beta supports systemInstruction field.
    let systemInstruction: any = undefined;
    if (messages.length > 0 && messages[0].role === "system") {
        // Treat first message as system instruction if role is system
        // We must ensure it is NOT included in the contents array.

        // Create the system instruction object
        systemInstruction = {
            parts: [{ text: messages[0].content }]
        };

        // Remove the first element (the system prompt) from the contents array
        contents.shift();
    }

    const body: any = {
        contents,
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7
        }
    };

    if (systemInstruction) {
        body.systemInstruction = systemInstruction;
    }

    console.log(`[GEMINI NATIVE] POST ${url}`);

    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Gemini Native Error ${resp.status}: ${text}`);
    }

    const data = await resp.json() as any;

    // Parse response
    const candidate = data.candidates?.[0];
    if (!candidate) {
        throw new Error("No candidates returned from Gemini");
    }

    const contentParts = candidate.content?.parts || [];
    const text = contentParts.map((p: any) => p.text).join("");

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
            content: text,
            tool_calls: [] // Native tool calling support omitted for simplicity unless needed
        },
        toolCalls: [],
        usage,
        finishReason: candidate.finishReason === "STOP" ? "stop" : "length"
    };
}
