import { ChatMessage, InferenceResponse, InferenceClient, InferenceOptions } from "../types.js";

const PRIMARY_RETRY_INTERVAL_MS = 60 * 60 * 1000; // 1 Hour

/**
 * Hybrid Inference Client
 * 
 * Manages a Primary (Conway/OpenAI) and Fallback (Gemini) client.
 * Automatically switches to fallback on failure and retries primary periodically.
 */
export function createHybridClient(
    primary: InferenceClient,
    fallback: InferenceClient,
    primaryName = "Conway/OpenAI",
    fallbackName = "Gemini"
): InferenceClient {

    let useFallback = false;
    let lastPrimaryFailure = 0;

    const chat = async (
        messages: ChatMessage[],
        opts?: InferenceOptions
    ): Promise<InferenceResponse> => {

        // 1. Check if we should retry primary
        if (useFallback) {
            const now = Date.now();
            if (now - lastPrimaryFailure > PRIMARY_RETRY_INTERVAL_MS) {
                // console.log(`[HYBRID] Retry interval passed. Attempting to restore ${primaryName}...`);
                useFallback = false;
            }
        }

        // 2. Try Primary (if not in fallback mode)
        if (!useFallback) {
            try {
                // console.log(`[HYBRID] Attempting ${primaryName}...`);
                const result = await primary.chat(messages, opts);
                return result;
            } catch (err: any) {
                console.warn(`[HYBRID] ${primaryName} Failed: ${err.message}`);
                console.warn(`[HYBRID] Switching to ${fallbackName} (Fallback Mode)`);
                useFallback = true;
                lastPrimaryFailure = Date.now();
                // Fall through to fallback
            }
        } else {
            // console.log(`[HYBRID] Using ${fallbackName} (Fallback Mode Active)`);
        }

        // 3. Try Fallback
        try {
            return await fallback.chat(messages, opts);
        } catch (err: any) {
            throw new Error(`[HYBRID] FATAL: Both Primary (${primaryName}) and Fallback (${fallbackName}) failed. Last error: ${err.message}`);
        }
    };

    const setLowComputeMode = (enabled: boolean): void => {
        primary.setLowComputeMode(enabled);
        fallback.setLowComputeMode(enabled);
    };

    const getDefaultModel = (): string => {
        if (useFallback) {
            return fallback.getDefaultModel() + " (Fallback)";
        }
        return primary.getDefaultModel();
    };

    return {
        chat,
        setLowComputeMode,
        getDefaultModel
    };
}
