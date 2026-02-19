/**
 * Conway Inference Client
 *
 * Wraps Conway's /v1/chat/completions endpoint (OpenAI-compatible).
 * The automaton pays for its own thinking through Conway credits.
 */

import type {
  InferenceClient,
  ChatMessage,
  InferenceOptions,
  InferenceResponse,
  InferenceToolCall,
  TokenUsage,
  InferenceToolDefinition,
} from "../types.js";
import { type PrivateKeyAccount } from "viem";
import { x402Fetch } from "./x402.js";

interface InferenceClientOptions {
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  maxTokens: number;
  lowComputeModel?: string;
  account?: PrivateKeyAccount;
}

export function createInferenceClient(
  options: InferenceClientOptions,
): InferenceClient {
  const { apiUrl, apiKey } = options;
  let currentModel = options.defaultModel;
  let maxTokens = options.maxTokens;

  const chat = async (
    messages: ChatMessage[],
    opts?: InferenceOptions,
  ): Promise<InferenceResponse> => {
    const model = opts?.model || currentModel;
    const tools = opts?.tools;

    // Newer models (o-series, gpt-5.x, gpt-4.1) require max_completion_tokens
    const usesCompletionTokens = /^(o[1-9]|gpt-5|gpt-4\.1)/.test(model);
    const tokenLimit = opts?.maxTokens || maxTokens;

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(formatMessage),
      stream: false,
    };

    if (usesCompletionTokens) {
      body.max_completion_tokens = tokenLimit;
    } else {
      body.max_tokens = tokenLimit;
    }

    if (opts?.temperature !== undefined) {
      body.temperature = opts.temperature;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    let result: any;
    let url = `${apiUrl}/v1/chat/completions`;

    // AUTOMATON FIX: Google's OpenAI compatibility endpoint doesn't use /v1/ after /openai/
    if (apiUrl.includes("googleapis.com")) {
      url = `${apiUrl}/chat/completions`;
    }

    const headers = { Authorization: apiKey };

    if (options.account) {
      // Use x402Fetch for auto-payment reflex
      const res = await x402Fetch(
        url,
        options.account,
        "POST",
        JSON.stringify(body),
        headers
      );

      if (!res.success) {
        throw new Error(
          `Inference error (x402): ${res.status} ${res.error}`
        );
      }
      result = res.response;

    } else {
      // Standard fetch fallback
      console.log(`[INFERENCE] POST ${url} (model: ${model})`);
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `Inference error: ${resp.status}: ${text}`,
        );
      }
      result = await resp.json() as any;
    }

    const choice = result.choices?.[0];

    if (!choice) {
      throw new Error("No completion choice returned from inference");
    }

    const message = choice.message;
    const usage: TokenUsage = {
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
      totalTokens: result.usage?.total_tokens || 0,
    };

    const toolCalls: InferenceToolCall[] | undefined =
      message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

    return {
      id: result.id || "",
      model: result.model || model,
      message: {
        role: message.role,
        content: message.content || "",
        tool_calls: toolCalls,
      },
      toolCalls,
      usage,
      finishReason: choice.finish_reason || "stop",
    };
  };

  const setLowComputeMode = (enabled: boolean): void => {
    if (enabled) {
      currentModel = options.lowComputeModel || "gpt-4.1";
      maxTokens = 4096;
    } else {
      currentModel = options.defaultModel;
      maxTokens = options.maxTokens;
    }
  };

  const getDefaultModel = (): string => {
    return currentModel;
  };

  return {
    chat,
    setLowComputeMode,
    getDefaultModel,
  };
}

function formatMessage(
  msg: ChatMessage,
): Record<string, unknown> {
  const formatted: Record<string, unknown> = {
    role: msg.role,
    content: msg.content,
  };

  if (msg.name) formatted.name = msg.name;
  if (msg.tool_calls) formatted.tool_calls = msg.tool_calls;
  if (msg.tool_call_id) formatted.tool_call_id = msg.tool_call_id;

  return formatted;
}
