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
    // We map ALL messages to contents. System -> User.
    // This ensures contents is never empty and avoids 400 errors.
    const contents = messages.map(msg => {
        let role = "user";
        if (msg.role === "assistant") role = "model";
        // Map system to user to ensure we have content and avoid 'systemInstruction' complexity
        // which can be strict about order or existence.
        return {
            role,
            parts: [{ text: msg.content }]
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

    console.log(`[GEMINI NATIVE] POST ${url.split("?")[0]}...`); // Log URL without key

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
