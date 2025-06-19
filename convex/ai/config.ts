// Simple provider configurations mirrored from modelConfig.ts (without UI fields)
type ProviderConfig = {
    userKeyField: string;
    baseURL?: string;
};

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    google: {
        userKeyField: "gemini",
    },
    openai: {
        userKeyField: "openai",
    },
    anthropic: {
        userKeyField: "anthropic",
    },
    deepseek: {
        userKeyField: "deepseek",
        baseURL: "https://api.deepseek.com/v1",
    },
    openrouter: {
        userKeyField: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
    },
};

// Simple function to extract provider from model ID
export function getProviderFromModel(model: string): string {
    // Check for OpenRouter models first (with provider prefix)
    const openrouterPrefixes = [
        "openai/",
        "google/",
        "anthropic/",
        "x-ai/",
        "qwen/",
        "deepseek/",
        "mistralai/",
        "meta-llama/",
        "microsoft/",
        "perplexity/",
        "cohere/",
    ];
    if (openrouterPrefixes.some((prefix) => model.startsWith(prefix))) {
        return "openrouter";
    }

    // Then check for direct provider models
    if (
        model.includes("gemini") ||
        model.includes("imagen") ||
        model.includes("veo")
    ) {
        return "google";
    }
    if (
        model.includes("gpt") ||
        model.includes("dall-e") ||
        model.includes("sora") ||
        model.includes("o1") ||
        model.includes("o3") ||
        model.includes("o4")
    ) {
        return "openai";
    }
    if (model.includes("claude")) {
        return "anthropic";
    }
    if (model.includes("deepseek")) {
        return "deepseek";
    }

    throw new Error(`Unable to determine provider for model: ${model}`);
}
