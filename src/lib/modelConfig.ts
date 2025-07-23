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
    capabilities?: ModelCapabilities; // Only for providers like OpenRouter where all models have same capabilities
    models: ModelInfo[];
};

export type ModelInfo = {
    id: string;
    name: string; // Human-readable name (separate from API ID)
    description: string;
    capabilities: ModelCapabilities; // Now required, not optional overrides
    contextLength?: number;
    pricing?: {
        input?: number;
        output?: number;
    };
    isNew?: boolean;
    isRecommended?: boolean;
    isCommented?: boolean; // For models we want to show but disable
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
        models: [
            {
                id: "gemini-2.0-flash",
                name: "Gemini 2.0 Flash",
                description:
                    "A faster, more efficient model for high-frequency tasks and general conversation.",
                isRecommended: true,
                contextLength: 1000000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
                description:
                    "The newest flash model from the next-gen Gemini 2.5 family with improved performance.",
                isNew: true,
                contextLength: 1000000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                description:
                    "The most capable Gemini model with a massive 2M token context window for complex tasks.",
                isNew: true,
                contextLength: 2000000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "gemini-2.0-flash-live-001",
                name: "Gemini 2.0 Flash Live",
                description:
                    "Specialized for real-time, low-latency conversational and voice applications.",
                contextLength: 1000000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "veo-3.0-generate-preview",
                name: "Veo 2.0",
                description:
                    "State-of-the-art model from Google for generating high-definition, cinematic video clips.",
                capabilities: {
                    textGeneration: false,
                    imageGeneration: false,
                    videoGeneration: true,
                    vision: false,
                    files: false,
                    webSearch: false,
                    liveChat: false,
                    structuredOutput: false,
                },
            },
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
        models: [
            {
                id: "gpt-4.1",
                name: "GPT-4.1",
                description:
                    "The next generation of GPT-4 with enhanced performance, speed, and efficiency.",
                isNew: true,
                isRecommended: true,
                contextLength: 128000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "gpt-4.1-nano",
                name: "GPT-4.1 Nano",
                description:
                    "A highly efficient, small-scale version of GPT-4.1 for on-device and edge tasks.",
                isNew: true,
                contextLength: 128000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "gpt-4.1-mini",
                name: "GPT-4.1 Mini",
                description:
                    "A compact and fast model from the new GPT-4.1 family, perfect for quick tasks.",
                isNew: true,
                contextLength: 128000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "o3",
                name: "o3",
                description:
                    "OpenAI's next frontier model, rumored to be highly capable and intelligent.",
                isNew: true,
                contextLength: 200000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "o3-mini",
                name: "o3 Mini",
                description:
                    "A smaller, faster, and more affordable version of the cutting-edge o3 model.",
                isNew: true,
                contextLength: 128000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "o4-mini",
                name: "o4 Mini",
                description:
                    "A hypothetical future mini model from OpenAI's next major series.",
                isNew: true,
                contextLength: 128000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "gpt-4o",
                name: "GPT-4o",
                description:
                    "The flagship multimodal model, expertly balancing speed, cost, and intelligence.",
                contextLength: 128000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            {
                id: "gpt-4o-mini",
                name: "GPT-4o Mini",
                description:
                    "A fast, affordable, and highly capable small model with advanced multimodal skills.",
                contextLength: 128000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: true,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: true,
                    structuredOutput: true,
                },
            },
            // Commented out - realtime models for live chat only
            // {
            //     id: "gpt-4o-mini-realtime-preview",
            //     name: "GPT-4o Mini Realtime",
            //     description: "Optimized for instant, low-latency voice conversations and real-time interaction.",
            //     contextLength: 128000,
            //     capabilities: { textGeneration: true, imageGeneration: false, videoGeneration: false, vision: false, files: false, webSearch: false, liveChat: true, structuredOutput: false }
            // },
            // {
            //     id: "gpt-4o-realtime-preview",
            //     name: "GPT-4o Realtime",
            //     description: "The most powerful OpenAI model for truly real-time, human-like voice conversations.",
            //     contextLength: 128000,
            //     capabilities: { textGeneration: true, imageGeneration: false, videoGeneration: false, vision: false, files: false, webSearch: false, liveChat: true, structuredOutput: false }
            // },
            {
                id: "sora",
                name: "Sora",
                description:
                    "OpenAI's groundbreaking text-to-video generation model for creating realistic scenes.",
                capabilities: {
                    textGeneration: false,
                    imageGeneration: false,
                    videoGeneration: true,
                    vision: false,
                    files: false,
                    webSearch: false,
                    liveChat: false,
                    structuredOutput: false,
                },
            },
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
        models: [
            {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                description:
                    "The latest generation Sonnet model, balancing industry-leading speed and intelligence.",
                isNew: true,
                isRecommended: true,
                contextLength: 200000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: false,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: false,
                    structuredOutput: true,
                },
            },
            {
                id: "claude-3-7-sonnet-20250219",
                name: "Claude 3.7 Sonnet",
                description:
                    "A hypothetical future model from the Claude 3 family with enhanced features.",
                isNew: true,
                contextLength: 200000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: false,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: false,
                    structuredOutput: true,
                },
            },
            {
                id: "claude-3-5-sonnet-20241022",
                name: "Claude 3.5 Sonnet",
                description:
                    "Top-tier intelligence with advanced reasoning, coding, and vision capabilities.",
                contextLength: 200000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: false,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: true,
                    liveChat: false,
                    structuredOutput: true,
                },
            },
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
        models: [
            {
                id: "deepseek-chat",
                name: "DeepSeek Chat",
                description:
                    "Highly capable model for general conversation and multilingual tasks.",
                isRecommended: true,
                contextLength: 64000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: false,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: false,
                    liveChat: false,
                    structuredOutput: true,
                },
            },
            {
                id: "deepseek-coder",
                name: "DeepSeek Coder",
                description:
                    "A specialized model with excellent performance on programming and code-related tasks.",
                contextLength: 64000,
                capabilities: {
                    textGeneration: true,
                    imageGeneration: false,
                    videoGeneration: false,
                    vision: true,
                    files: true,
                    webSearch: false,
                    liveChat: false,
                    structuredOutput: true,
                },
            },
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
        // Provider-level capabilities for OpenRouter - all models are text-only
        capabilities: {
            textGeneration: true,
            imageGeneration: false,
            videoGeneration: false,
            vision: false,
            files: false,
            webSearch: false,
            liveChat: false,
            structuredOutput: false,
        },
        models: [
            {
                id: "google/gemini-2.5-pro-preview",
                name: "Gemini 2.5 Pro Preview",
                description:
                    "Access Google's most advanced model via OpenRouter's unified API.",
                isNew: true,
                contextLength: 2000000,
            },
            {
                id: "google/gemini-2.0-flash-001",
                name: "Gemini 2.0 Flash",
                description:
                    "A fast and efficient multimodal model from Google, available on OpenRouter.",
                contextLength: 1000000,
            },
            {
                id: "google/gemini-exp-1206",
                name: "Gemini Experimental 1206",
                description:
                    "An experimental, unannounced version of Gemini for early testing.",
                isNew: true,
                contextLength: 2000000,
            },
            {
                id: "google/gemini-2.0-flash-thinking-exp",
                name: "Gemini 2.0 Flash Thinking",
                description:
                    "Experimental model with enhanced 'thinking' capabilities for reasoning.",
                isNew: true,
                contextLength: 32000,
            },
            {
                id: "google/gemini-flash-1.5-8b",
                name: "Gemini Flash 1.5 8B",
                description:
                    "A lightweight and fast version of Gemini 1.5, balanced for performance.",
                contextLength: 1000000,
            },
            {
                id: "google/gemini-pro-1.5",
                name: "Gemini Pro 1.5",
                description:
                    "The standard, highly capable Gemini 1.5 model with a large context window.",
                contextLength: 2000000,
            },
            {
                id: "openai/gpt-4.1",
                name: "GPT-4.1",
                description:
                    "The next-gen GPT-4, available through the OpenRouter gateway.",
                isNew: true,
                contextLength: 128000,
            },
            {
                id: "openai/o1",
                name: "o1",
                description:
                    "OpenAI's next frontier model with powerful reasoning, via OpenRouter.",
                contextLength: 200000,
            },
            {
                id: "openai/o1-mini",
                name: "o1 Mini",
                description:
                    "The smaller, faster version of the cutting-edge o1 model on OpenRouter.",
                contextLength: 128000,
            },
            {
                id: "openai/gpt-4o",
                name: "GPT-4o",
                description:
                    "The flagship multimodal model from OpenAI, accessible via OpenRouter.",
                contextLength: 128000,
            },
            {
                id: "openai/gpt-4o-mini",
                name: "GPT-4o Mini",
                description:
                    "A fast, affordable, and highly capable small model via OpenRouter.",
                contextLength: 128000,
            },
            {
                id: "openai/gpt-4-turbo",
                name: "GPT-4 Turbo",
                description:
                    "The previous generation flagship turbo model from OpenAI.",
                contextLength: 128000,
            },
            {
                id: "anthropic/claude-opus-4",
                name: "Claude Opus 4",
                description:
                    "The most powerful Claude 4 model, accessible via OpenRouter.",
                isNew: true,
                contextLength: 200000,
            },
            {
                id: "anthropic/claude-sonnet-4",
                name: "Claude Sonnet 4",
                description:
                    "The balanced Sonnet 4 model from Anthropic, via OpenRouter.",
                isNew: true,
                contextLength: 200000,
            },
            {
                id: "anthropic/claude-3.5-sonnet",
                name: "Claude 3.5 Sonnet",
                description:
                    "Top-tier intelligence with advanced reasoning from Anthropic, on OpenRouter.",
                contextLength: 200000,
            },
            {
                id: "anthropic/claude-3.5-haiku",
                name: "Claude 3.5 Haiku",
                description:
                    "The fastest model in the Claude 3.5 family, perfect for quick tasks.",
                contextLength: 200000,
            },
            {
                id: "x-ai/grok-3-beta",
                name: "Grok 3 Beta",
                description:
                    "The latest beta model from xAI with unique personality and real-time info.",
                isNew: true,
                contextLength: 128000,
            },
            {
                id: "x-ai/grok-2-1212",
                name: "Grok 2.1212",
                description: "A new experimental release of the Grok 2 model.",
                isNew: true,
                contextLength: 128000,
            },
            {
                id: "x-ai/grok-2-vision-1212",
                name: "Grok 2 Vision 1212",
                description:
                    "The vision-capable version of Grok 2 for multimodal tasks.",
                isNew: true,
                contextLength: 32000,
            },
            {
                id: "x-ai/grok-beta",
                name: "Grok Beta",
                description:
                    "The previous generation beta model from xAI, known for its unfiltered responses.",
                contextLength: 128000,
            },
            {
                id: "qwen/qwen3-32b",
                name: "Qwen3 32B",
                description:
                    "A powerful 32-billion parameter model from Alibaba's Qwen family.",
                isNew: true,
                contextLength: 32000,
            },
            {
                id: "qwen/qwen-2.5-coder-32b-instruct",
                name: "Qwen 2.5 Coder 32B",
                description:
                    "A specialized coding model from the Qwen 2.5 series.",
                contextLength: 128000,
            },
            {
                id: "qwen/qwen-2.5-72b-instruct",
                name: "Qwen 2.5 72B",
                description:
                    "A large, highly capable instruction-tuned model from Alibaba.",
                contextLength: 128000,
            },
            {
                id: "deepseek/deepseek-r1",
                name: "DeepSeek R1",
                description:
                    "A new research model from DeepSeek with advanced capabilities.",
                isNew: true,
                contextLength: 64000,
            },
            {
                id: "deepseek/deepseek-chat",
                name: "DeepSeek Chat",
                description:
                    "Highly capable model for general conversation, via OpenRouter.",
                contextLength: 64000,
            },
            {
                id: "deepseek/deepseek-coder",
                name: "DeepSeek Coder",
                description:
                    "A specialized coding model, accessible through OpenRouter.",
                contextLength: 64000,
            },
            {
                id: "mistralai/mistral-large",
                name: "Mistral Large",
                description:
                    "Mistral's flagship model, offering top-tier reasoning performance.",
                contextLength: 128000,
            },
            {
                id: "mistralai/codestral",
                name: "Codestral",
                description:
                    "A fast and efficient coding-specific model from Mistral.",
                contextLength: 32000,
            },
            {
                id: "mistralai/pixtral-12b",
                name: "Pixtral 12B",
                description:
                    "A new vision-language model from Mistral for image-related tasks.",
                contextLength: 128000,
            },
            {
                id: "meta-llama/llama-3.3-70b-instruct",
                name: "Llama 3.3 70B",
                description:
                    "The latest 70B parameter instruction-tuned model from Meta.",
                contextLength: 128000,
            },
            {
                id: "meta-llama/llama-3.2-90b-vision-instruct",
                name: "Llama 3.2 90B Vision",
                description:
                    "A massive vision model from Meta for complex multimodal understanding.",
                contextLength: 128000,
            },
            {
                id: "meta-llama/llama-3.2-11b-vision-instruct",
                name: "Llama 3.2 11B Vision",
                description:
                    "An efficient and fast vision model from the Llama 3.2 family.",
                contextLength: 128000,
            },
            {
                id: "meta-llama/llama-3.2-3b-instruct",
                name: "Llama 3.2 3B",
                description:
                    "A lightweight and very fast instruction model for simple tasks.",
                contextLength: 128000,
            },
            {
                id: "microsoft/wizardlm-2-8x22b",
                name: "WizardLM 2 8x22B",
                description:
                    "A powerful mixture-of-experts model from Microsoft, fine-tuned for complex instructions.",
                contextLength: 64000,
            },
            {
                id: "cohere/command-r-plus",
                name: "Command R+",
                description:
                    "Cohere's most advanced model, optimized for enterprise-grade RAG and tool use.",
                contextLength: 128000,
            },
            {
                id: "perplexity/llama-3.1-sonar-large-128k-online",
                name: "Llama 3.1 Sonar Large Online",
                description:
                    "A Llama-based model from Perplexity with built-in, real-time web search capabilities.",
                contextLength: 128000,
            },
        ],
    },
};
// Enhanced model capabilities detection - now uses per-model capabilities
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

    // For providers like OpenRouter that have provider-level capabilities, use those
    if (providerConfig.capabilities) {
        return providerConfig.capabilities;
    }

    // Find model-specific config and return its capabilities directly
    const modelInfo = providerConfig.models.find((m) => m.id === model);

    if (modelInfo?.capabilities) {
        return modelInfo.capabilities;
    }

    // Fallback to no capabilities if model not found
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
        capabilities: ModelCapabilities;
    }
> {
    const models: Array<
        ModelInfo & {
            provider: string;
            providerName: string;
            hasUserKey: boolean;
            userKeyEnabled: boolean;
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

        // Always include all providers - let backend handle availability
        for (const model of config.models) {
            const capabilities = getModelCapabilities(model.id, providerKey);

            models.push({
                ...model,
                provider: providerKey,
                providerName: config.displayName,
                hasUserKey,
                userKeyEnabled,
                capabilities,
            });
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
        isAvailable: boolean;
        modelCount: number;
    }
> {
    return Object.values(PROVIDER_CONFIGS).map((config) => {
        const hasUserKey = !!userApiKeys[config.userKeyField]?.trim();
        const userKeyEnabled = isUserKeyEnabled(
            config.id,
            userApiKeys,
            userApiKeyPreferences
        );
        // Always consider all providers available - let backend handle unavailable ones
        const isAvailable = true;

        return {
            ...config,
            hasUserKey,
            userKeyEnabled,
            isAvailable,
            modelCount: config.models.length,
        };
    });
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
