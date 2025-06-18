// Model configuration mirrored from backend with frontend-specific enhancements
export type ModelCapabilities = {
    textGeneration: boolean;
    imageGeneration: boolean;
    videoGeneration: boolean;
    vision: boolean;
    files: boolean;
    webSearch: boolean;
    liveChat: boolean;
    structuredOutput: boolean;
};

export type ProviderConfig = {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
    userKeyField: string;
    description: string;
    baseURL?: string;
    capabilities: ModelCapabilities;
    models: ModelInfo[];
};

export type ModelInfo = {
    id: string;
    name: string; // Human-readable name (separate from API ID)
    description: string;
    capabilities?: Partial<ModelCapabilities>; // Model-specific overrides
    contextLength?: number;
    pricing?: {
        input?: number;
        output?: number;
    };
    isNew?: boolean;
    isRecommended?: boolean;
};

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    google: {
        id: "google",
        name: "Google",
        displayName: "Google",
        icon: "🟦",
        color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        userKeyField: "gemini",
        description: "Latest Gemini models with advanced reasoning",
        capabilities: { textGeneration: true, imageGeneration: true, videoGeneration: true, vision: true, files: true, webSearch: true, liveChat: true, structuredOutput: true },
        models: [
            { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "A faster, more efficient model for high-frequency tasks and general conversation.", isRecommended: true, contextLength: 1000000 },
            { id: "gemini-2.5-flash-05-20", name: "Gemini 2.5 Flash", description: "The newest flash model from the next-gen Gemini 2.5 family with improved performance.", isNew: true, contextLength: 1000000 },
            { id: "gemini-2.5-pro-06-05", name: "Gemini 2.5 Pro", description: "The most capable Gemini model with a massive 2M token context window for complex tasks.", isNew: true, contextLength: 2000000 },
            { id: "gemini-2.0-flash-live-001", name: "Gemini 2.0 Flash Live", description: "Specialized for real-time, low-latency conversational and voice applications.", capabilities: { liveChat: true }, contextLength: 1000000 },
            { id: "imagen-3.0-generate-002", name: "Imagen 3.0", description: "Google's flagship model for generating high-quality, photorealistic images from text.", capabilities: { textGeneration: false, imageGeneration: true, vision: false, files: false, webSearch: false, liveChat: false, structuredOutput: false, videoGeneration: false }},
            { id: "veo-2.0-generate-001", name: "Veo 2.0", description: "State-of-the-art model from Google for generating high-definition, cinematic video clips.", capabilities: { textGeneration: false, videoGeneration: true, vision: false, files: false, webSearch: false, liveChat: false, structuredOutput: false, imageGeneration: false }},
        ],
    },
    openai: {
        id: "openai",
        name: "OpenAI",
        displayName: "OpenAI",
        icon: "⚫",
        color: "bg-gray-500/20 text-gray-300 border-gray-500/30",
        userKeyField: "openai",
        description: "GPT-4 and newest models including o3",
        capabilities: { textGeneration: true, imageGeneration: true, videoGeneration: true, vision: true, files: true, webSearch: true, liveChat: true, structuredOutput: true },
        models: [
            { id: "gpt-4.1", name: "GPT-4.1", description: "The next generation of GPT-4 with enhanced performance, speed, and efficiency.", isNew: true, isRecommended: true, contextLength: 128000 },
            { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "A highly efficient, small-scale version of GPT-4.1 for on-device and edge tasks.", isNew: true, contextLength: 128000 },
            { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "A compact and fast model from the new GPT-4.1 family, perfect for quick tasks.", isNew: true, contextLength: 128000 },
            { id: "o3", name: "o3", description: "OpenAI's next frontier model, rumored to be highly capable and intelligent.", isNew: true, contextLength: 200000 },
            { id: "o3-mini", name: "o3 Mini", description: "A smaller, faster, and more affordable version of the cutting-edge o3 model.", isNew: true, contextLength: 128000 },
            { id: "o4-mini", name: "o4 Mini", description: "A hypothetical future mini model from OpenAI's next major series.", isNew: true, contextLength: 128000 },
            { id: "gpt-4o", name: "GPT-4o", description: "The flagship multimodal model, expertly balancing speed, cost, and intelligence.", contextLength: 128000 },
            { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "A fast, affordable, and highly capable small model with advanced multimodal skills.", contextLength: 128000 },
            { id: "gpt-image-1", name: "GPT Image 1", description: "A specialized model for creating high-quality, creative images from text prompts.", capabilities: { textGeneration: false, imageGeneration: true, vision: false, files: false, webSearch: false, liveChat: false, structuredOutput: false, videoGeneration: false }},
            { id: "sora", name: "Sora", description: "OpenAI's groundbreaking text-to-video generation model for creating realistic scenes.", capabilities: { textGeneration: false, videoGeneration: true, vision: false, files: false, webSearch: false, liveChat: false, structuredOutput: false, imageGeneration: false }},
            { id: "gpt-4o-mini-realtime-preview", name: "GPT-4o Mini Realtime", description: "Optimized for instant, low-latency voice conversations and real-time interaction.", capabilities: { liveChat: true }, contextLength: 128000 },
            { id: "gpt-4o-realtime-preview", name: "GPT-4o Realtime", description: "The most powerful OpenAI model for truly real-time, human-like voice conversations.", capabilities: { liveChat: true }, contextLength: 128000 },
        ],
    },
    anthropic: {
        id: "anthropic",
        name: "Anthropic",
        displayName: "Anthropic",
        icon: "🟠",
        color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        userKeyField: "anthropic",
        description: "Claude models with superior reasoning",
        capabilities: { textGeneration: true, imageGeneration: false, videoGeneration: false, vision: true, files: true, webSearch: true, liveChat: false, structuredOutput: true },
        models: [
            { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "The latest generation Sonnet model, balancing industry-leading speed and intelligence.", isNew: true, isRecommended: true, contextLength: 200000 },
            { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "A hypothetical future model from the Claude 3 family with enhanced features.", isNew: true, contextLength: 200000 },
            { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Top-tier intelligence with advanced reasoning, coding, and vision capabilities.", contextLength: 200000 },
        ],
    },
    deepseek: {
        id: "deepseek",
        name: "DeepSeek",
        displayName: "DeepSeek",
        icon: "🔵",
        color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        userKeyField: "deepseek",
        description: "Powerful reasoning and coding models",
        baseURL: "https://api.deepseek.com/v1",
        capabilities: { textGeneration: true, imageGeneration: false, videoGeneration: false, vision: true, files: true, webSearch: false, liveChat: false, structuredOutput: true },
        models: [
            { id: "deepseek-chat", name: "DeepSeek Chat", description: "Highly capable model for general conversation and multilingual tasks.", isRecommended: true, contextLength: 64000 },
            { id: "deepseek-coder", name: "DeepSeek Coder", description: "A specialized model with excellent performance on programming and code-related tasks.", contextLength: 64000 },
        ],
    },
    openrouter: {
        id: "openrouter",
        name: "OpenRouter",
        displayName: "OpenRouter",
        icon: "🌐",
        color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        userKeyField: "openrouter",
        description: "Access to 200+ AI models",
        baseURL: "https://openrouter.ai/api/v1",
        capabilities: { textGeneration: true, imageGeneration: false, videoGeneration: false, vision: false, files: false, webSearch: false, liveChat: false, structuredOutput: false },
        models: [
            { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro Preview", description: "Access Google's most advanced model via OpenRouter's unified API.", isNew: true, contextLength: 2000000 },
            { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "A fast and efficient multimodal model from Google, available on OpenRouter.", contextLength: 1000000 },
            { id: "google/gemini-exp-1206", name: "Gemini Experimental 1206", description: "An experimental, unannounced version of Gemini for early testing.", isNew: true, contextLength: 2000000 },
            { id: "google/gemini-2.0-flash-thinking-exp", name: "Gemini 2.0 Flash Thinking", description: "Experimental model with enhanced 'thinking' capabilities for reasoning.", isNew: true, contextLength: 32000 },
            { id: "google/gemini-flash-1.5-8b", name: "Gemini Flash 1.5 8B", description: "A lightweight and fast version of Gemini 1.5, balanced for performance.", contextLength: 1000000 },
            { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", description: "The standard, highly capable Gemini 1.5 model with a large context window.", contextLength: 2000000 },
            { id: "openai/gpt-4.1", name: "GPT-4.1", description: "The next-gen GPT-4, available through the OpenRouter gateway.", isNew: true, contextLength: 128000 },
            { id: "openai/o1", name: "o1", description: "OpenAI's next frontier model with powerful reasoning, via OpenRouter.", contextLength: 200000 },
            { id: "openai/o1-mini", name: "o1 Mini", description: "The smaller, faster version of the cutting-edge o1 model on OpenRouter.", contextLength: 128000 },
            { id: "openai/gpt-4o", name: "GPT-4o", description: "The flagship multimodal model from OpenAI, accessible via OpenRouter.", contextLength: 128000 },
            { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", description: "A fast, affordable, and highly capable small model via OpenRouter.", contextLength: 128000 },
            { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", description: "The previous generation flagship turbo model from OpenAI.", contextLength: 128000 },
            { id: "anthropic/claude-opus-4", name: "Claude Opus 4", description: "The most powerful Claude 4 model, accessible via OpenRouter.", isNew: true, contextLength: 200000 },
            { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", description: "The balanced Sonnet 4 model from Anthropic, via OpenRouter.", isNew: true, contextLength: 200000 },
            { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Top-tier intelligence with advanced reasoning from Anthropic, on OpenRouter.", contextLength: 200000 },
            { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", description: "The fastest model in the Claude 3.5 family, perfect for quick tasks.", contextLength: 200000 },
            { id: "x-ai/grok-3-beta", name: "Grok 3 Beta", description: "The latest beta model from xAI with unique personality and real-time info.", isNew: true, contextLength: 128000 },
            { id: "x-ai/grok-2-1212", name: "Grok 2.1212", description: "A new experimental release of the Grok 2 model.", isNew: true, contextLength: 128000 },
            { id: "x-ai/grok-2-vision-1212", name: "Grok 2 Vision 1212", description: "The vision-capable version of Grok 2 for multimodal tasks.", isNew: true, contextLength: 32000 },
            { id: "x-ai/grok-beta", name: "Grok Beta", description: "The previous generation beta model from xAI, known for its unfiltered responses.", contextLength: 128000 },
            { id: "qwen/qwen3-32b", name: "Qwen3 32B", description: "A powerful 32-billion parameter model from Alibaba's Qwen family.", isNew: true, contextLength: 32000 },
            { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", description: "A specialized coding model from the Qwen 2.5 series.", contextLength: 128000 },
            { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", description: "A large, highly capable instruction-tuned model from Alibaba.", contextLength: 128000 },
            { id: "deepseek/deepseek-r1", name: "DeepSeek R1", description: "A new research model from DeepSeek with advanced capabilities.", isNew: true, contextLength: 64000 },
            { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", description: "Highly capable model for general conversation, via OpenRouter.", contextLength: 64000 },
            { id: "deepseek/deepseek-coder", name: "DeepSeek Coder", description: "A specialized coding model, accessible through OpenRouter.", contextLength: 64000 },
            { id: "mistralai/mistral-large", name: "Mistral Large", description: "Mistral's flagship model, offering top-tier reasoning performance.", contextLength: 128000 },
            { id: "mistralai/codestral", name: "Codestral", description: "A fast and efficient coding-specific model from Mistral.", contextLength: 32000 },
            { id: "mistralai/pixtral-12b", name: "Pixtral 12B", description: "A new vision-language model from Mistral for image-related tasks.", contextLength: 128000 },
            { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", description: "The latest 70B parameter instruction-tuned model from Meta.", contextLength: 128000 },
            { id: "meta-llama/llama-3.2-90b-vision-instruct", name: "Llama 3.2 90B Vision", description: "A massive vision model from Meta for complex multimodal understanding.", contextLength: 128000 },
            { id: "meta-llama/llama-3.2-11b-vision-instruct", name: "Llama 3.2 11B Vision", description: "An efficient and fast vision model from the Llama 3.2 family.", contextLength: 128000 },
            { id: "meta-llama/llama-3.2-3b-instruct", name: "Llama 3.2 3B", description: "A lightweight and very fast instruction model for simple tasks.", contextLength: 128000 },
            { id: "microsoft/wizardlm-2-8x22b", name: "WizardLM 2 8x22B", description: "A powerful mixture-of-experts model from Microsoft, fine-tuned for complex instructions.", contextLength: 64000 },
            { id: "cohere/command-r-plus", name: "Command R+", description: "Cohere's most advanced model, optimized for enterprise-grade RAG and tool use.", contextLength: 128000 },
            { id: "perplexity/llama-3.1-sonar-large-128k-online", name: "Llama 3.1 Sonar Large Online", description: "A Llama-based model from Perplexity with built-in, real-time web search capabilities.", contextLength: 128000 },
        ],
    },
};
// Enhanced model capabilities detection with version checks
export function getModelCapabilities(
    model: string,
    provider: string
): ModelCapabilities {
    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) {
        return {
            textGeneration: false,
            imageGeneration: false,
            videoGeneration: false,
            vision: false,
            files: false,
            webSearch: false,
            liveChat: false,
            structuredOutput: false,
        };
    }

    // Find model-specific config
    const modelInfo = providerConfig.models.find((m) => m.id === model);

    // Start with provider-level capabilities as baseline
    const capabilities = { ...providerConfig.capabilities };

    // Apply model-specific overrides if they exist
    if (modelInfo?.capabilities) {
        Object.assign(capabilities, modelInfo.capabilities);
    }

    // Model-specific overrides for OpenRouter (since it varies by model)
    if (provider === "openrouter") {
        // Claude series (3.x version check)
        if (model.includes("claude")) {
            const versionMatch = model.match(/claude-(\d+)/);
            const majorVersion = versionMatch ? parseInt(versionMatch[1]) : 0;

            if (majorVersion >= 3) {
                capabilities.vision = true;
                capabilities.files = true;
                capabilities.structuredOutput = true;
            }
        }

        // Gemini series (2.x version check)
        else if (model.includes("gemini")) {
            const versionMatch = model.match(/gemini-(\d+)/);
            const majorVersion = versionMatch ? parseInt(versionMatch[1]) : 0;

            if (majorVersion >= 2) {
                capabilities.vision = true;
                capabilities.files = true;
                capabilities.structuredOutput = true;
            }
        }

        // GPT-4 series (excluding 3.5)
        else if (model.includes("gpt-4") && !model.includes("3.5")) {
            capabilities.vision = true;
            capabilities.files = true;
            capabilities.structuredOutput = true;
        }

        // O-series models
        else if (model.includes("/o1") || model.includes("/o3")) {
            capabilities.vision = false; // O-series don't support vision
            capabilities.files = true;
            capabilities.structuredOutput = true;
        }
    }

    return capabilities;
}

// Helper function to check if user API key is both available and enabled
export function isUserKeyEnabled(
    provider: string,
    userApiKeys: Record<string, string> = {},
    userApiKeyPreferences: Record<string, boolean> = {}
): boolean {
    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) return false;

    const keyField = providerConfig.userKeyField;
    const hasKey = !!userApiKeys[keyField]?.trim();
    const isEnabled = userApiKeyPreferences[keyField] !== false; // Default to true if not set

    return hasKey && isEnabled;
}

// Helper function to check if provider has fallback (our default key)
export function hasProviderFallback(provider: string): boolean {
    // In a real implementation, this would check if we have default keys configured
    // For now, assume all providers have fallback except user-only providers
    return provider !== "user-only-provider"; // Placeholder logic
}

// Get all available models with their metadata
export function getAvailableModels(
    userApiKeys: Record<string, string> = {},
    userApiKeyPreferences: Record<string, boolean> = {}
): Array<
    ModelInfo & {
        provider: string;
        providerName: string;
        hasUserKey: boolean;
        userKeyEnabled: boolean;
        hasDefaultKey: boolean;
        capabilities: ModelCapabilities;
    }
> {
    const models: Array<
        ModelInfo & {
            provider: string;
            providerName: string;
            hasUserKey: boolean;
            userKeyEnabled: boolean;
            hasDefaultKey: boolean;
            capabilities: ModelCapabilities;
        }
    > = [];

    for (const [providerKey, config] of Object.entries(PROVIDER_CONFIGS)) {
        const hasUserKey = !!userApiKeys[config.userKeyField]?.trim();
        const userKeyEnabled = isUserKeyEnabled(
            providerKey,
            userApiKeys,
            userApiKeyPreferences
        );
        const hasDefaultKey = hasProviderFallback(providerKey);

        // Only include provider if it has user key or fallback
        if (hasUserKey || hasDefaultKey) {
            for (const model of config.models) {
                const capabilities = getModelCapabilities(
                    model.id,
                    providerKey
                );

                models.push({
                    ...model,
                    provider: providerKey,
                    providerName: config.displayName,
                    hasUserKey,
                    userKeyEnabled,
                    hasDefaultKey,
                    capabilities,
                });
            }
        }
    }

    // Sort by priority (user keys first) then by name
    return models.sort((a, b) => {
        const aPriority = a.userKeyEnabled ? 1 : 2;
        const bPriority = b.userKeyEnabled ? 1 : 2;

        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.name.localeCompare(b.name);
    });
}

// Get provider information
export function getProviderInfo(
    userApiKeys: Record<string, string> = {},
    userApiKeyPreferences: Record<string, boolean> = {}
): Array<
    ProviderConfig & {
        hasUserKey: boolean;
        userKeyEnabled: boolean;
        hasDefaultKey: boolean;
        isAvailable: boolean;
        modelCount: number;
    }
> {
    return Object.values(PROVIDER_CONFIGS)
        .map((config) => {
            const hasUserKey = !!userApiKeys[config.userKeyField]?.trim();
            const userKeyEnabled = isUserKeyEnabled(
                config.id,
                userApiKeys,
                userApiKeyPreferences
            );
            const hasDefaultKey = hasProviderFallback(config.id);
            const isAvailable = hasUserKey || hasDefaultKey;

            return {
                ...config,
                hasUserKey,
                userKeyEnabled,
                hasDefaultKey,
                isAvailable,
                modelCount: config.models.length,
            };
        })
        .filter((provider) => provider.isAvailable);
}

// Get model display name (human-readable)
export function getModelDisplayName(modelId: string): string {
    for (const config of Object.values(PROVIDER_CONFIGS)) {
        const model = config.models.find((m) => m.id === modelId);
        if (model) {
            return model.name;
        }
    }
    return modelId; // Fallback to ID if not found
}

// Get provider for a model
export function getProviderForModel(modelId: string): string | null {
    for (const [providerKey, config] of Object.entries(PROVIDER_CONFIGS)) {
        if (config.models.some((m) => m.id === modelId)) {
            return providerKey;
        }
    }
    return null;
}
