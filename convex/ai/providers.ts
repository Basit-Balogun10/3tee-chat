"use node";

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { deepseek } from "@ai-sdk/deepseek";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { togetherai } from "@ai-sdk/togetherai";

// Provider configuration - same as before but with proper typing
export const PROVIDER_CONFIGS = {
    openai: {
        displayName: "OpenAI",
        userKeyField: "openaiApiKey" as const,
        defaultModels: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini"] as const,
        supportedFeatures: {
            streaming: true,
            toolCalling: true,
            structuredOutput: true,
            imageGeneration: true,
            vision: true,
            fileUploads: true,
        },
    },
    anthropic: {
        displayName: "Anthropic",
        userKeyField: "anthropicApiKey" as const,
        defaultModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"] as const,
        supportedFeatures: {
            streaming: true,
            toolCalling: true,
            structuredOutput: true,
            vision: true,
            fileUploads: true,
        },
    },
    google: {
        displayName: "Google",
        userKeyField: "googleApiKey" as const,
        defaultModels: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"] as const,
        supportedFeatures: {
            streaming: true,
            toolCalling: true,
            structuredOutput: true,
            imageGeneration: true,
            vision: true,
            fileUploads: true,
            webSearch: true,
        },
    },
    deepseek: {
        displayName: "DeepSeek",
        userKeyField: "deepseekApiKey" as const,
        defaultModels: ["deepseek-chat", "deepseek-reasoner"] as const,
        supportedFeatures: {
            streaming: true,
            toolCalling: true,
            structuredOutput: true,
            reasoning: true,
        },
    },
    openrouter: {
        displayName: "OpenRouter",
        userKeyField: "openrouterApiKey" as const,
        defaultModels: [
            "anthropic/claude-3.5-sonnet",
            "openai/gpt-4o",
            "google/gemini-2.0-flash-exp",
            "deepseek/deepseek-chat",
        ] as const,
        supportedFeatures: {
            streaming: true,
            toolCalling: true,
            structuredOutput: true,
            vision: true,
        },
    },
    together: {
        displayName: "Together AI",
        userKeyField: "togetherApiKey" as const,
        defaultModels: [
            "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
            "mistralai/Mixtral-8x7B-Instruct-v0.1",
        ] as const,
        supportedFeatures: {
            streaming: true,
            toolCalling: true,
            structuredOutput: true,
        },
    },
} as const;

// Type for provider names
export type ProviderName = keyof typeof PROVIDER_CONFIGS;

// Provider client factory using AI SDK
class ProviderManager {
    private clients: Map<string, any> = new Map();

    getProvider(provider: ProviderName, apiKey?: string): any {
        const key = `${provider}-${apiKey || "default"}`;

        if (this.clients.has(key)) {
            return this.clients.get(key);
        }

        let client;

        switch (provider) {
            case "openai":
                client = openai({
                    apiKey: apiKey || process.env.OPENAI_API_KEY,
                    // Support for Azure OpenAI if no user key provided
                    ...((!apiKey && process.env.AZURE_OPENAI_ENDPOINT)
                        ? {
                              baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
                              apiVersion:
                                  process.env.OPENAI_API_VERSION ||
                                  "2024-07-01-preview",
                          }
                        : {}),
                });
                break;

            case "anthropic":
                client = anthropic({
                    apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "",
                });
                break;

            case "google":
                client = google({
                    apiKey: apiKey || process.env.GOOGLE_AI_API_KEY || "",
                    // Support for Vertex AI if no user key provided
                    ...((!apiKey && process.env.GOOGLE_CLOUD_PROJECT) ? {
                        project: process.env.GOOGLE_CLOUD_PROJECT,
                        location: process.env.GOOGLE_CLOUD_LOCATION || "us-east1",
                    } : {})
                });
                break;

            case "deepseek":
                client = deepseek({
                    apiKey: apiKey || process.env.DEEPSEEK_API_KEY || "",
                });
                break;

            case "openrouter":
                client = createOpenRouter({
                    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
                });
                break;

            case "together":
                client = togetherai({
                    apiKey: apiKey || process.env.TOGETHER_API_KEY || "",
                });
                break;

            default: {
                // This should never happen due to TypeScript typing
                const exhaustiveCheck: never = provider;
                throw new Error(`Unsupported provider: ${exhaustiveCheck}`);
            }
        }

        this.clients.set(key, client);
        return client;
    }

    // Get model instance for use with AI SDK functions
    getModel(provider: ProviderName, model: string, apiKey?: string): any {
        const providerInstance = this.getProvider(provider, apiKey);
        return providerInstance(model);
    }

    // Legacy compatibility method that mimics the old callProvider interface
    async callProvider(
        provider: ProviderName,
        model: string,
        messages: any[],
        options: {
            apiKey?: string;
            stream?: boolean;
            temperature?: number;
            maxTokens?: number;
            attachments?: any[];
            tools?: any;
            toolChoice?: any;
            stop?: string[];
            topP?: number;
            frequencyPenalty?: number;
            presencePenalty?: number;
        } = {}
    ): Promise<any> {
        const modelInstance = this.getModel(provider, model, options.apiKey);

        // Convert old message format to simple format for AI SDK
        const convertedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Use AI SDK's generateText or streamText based on options
        if (options.stream) {
            const { streamText } = await import('ai');
            return streamText({
                model: modelInstance,
                messages: convertedMessages,
                temperature: options.temperature,
                // Use maxTokens instead of maxTokens for AI SDK v5
                ...(options.maxTokens && { maxTokens: options.maxTokens }),
                tools: options.tools,
                toolChoice: options.toolChoice,
                stop: options.stop,
                topP: options.topP,
                frequencyPenalty: options.frequencyPenalty,
                presencePenalty: options.presencePenalty,
            });
        } else {
            const { generateText } = await import('ai');
            return generateText({
                model: modelInstance,
                messages: convertedMessages,
                temperature: options.temperature,
                // Use maxTokens instead of maxTokens for AI SDK v5
                ...(options.maxTokens && { maxTokens: options.maxTokens }),
                tools: options.tools,
                toolChoice: options.toolChoice,
                stop: options.stop,
                topP: options.topP,
                frequencyPenalty: options.frequencyPenalty,
                presencePenalty: options.presencePenalty,
            });
        }
    }

    // Helper to determine if a provider supports a feature
    supportsFeature(provider: ProviderName, feature: string): boolean {
        const config = PROVIDER_CONFIGS[provider];
        return (config.supportedFeatures as any)[feature] ?? false;
    }

    // Get all available models for a provider
    getAvailableModels(provider: ProviderName): readonly string[] {
        return PROVIDER_CONFIGS[provider]?.defaultModels ?? [];
    }

    // Helper to get provider display name
    getProviderDisplayName(provider: ProviderName): string {
        return PROVIDER_CONFIGS[provider]?.displayName ?? provider;
    }
}

// Helper function to determine provider from model name
export function getProviderFromModel(model: string): ProviderName {
    // OpenAI models
    if (model.startsWith("gpt-") || model.startsWith("o1") || model.includes("gpt")) {
        return "openai";
    }
    
    // Anthropic models
    if (model.startsWith("claude-")) {
        return "anthropic";
    }
    
    // Google models
    if (model.startsWith("gemini-") || model.includes("gemini")) {
        return "google";
    }
    
    // DeepSeek models
    if (model.startsWith("deepseek-") || model.includes("deepseek")) {
        return "deepseek";
    }
    
    // Together AI models
    if (model.includes("llama") || model.includes("mixtral") || model.includes("together")) {
        return "together";
    }
    
    // Default to OpenRouter for unknown models (backwards compatibility)
    return "openrouter";
}

// Helper function to get user API keys (same as before)
export async function getUserApiKeys(ctx: any): Promise<Record<string, string | undefined>> {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return {};

    try {
        const userPreferences = await ctx.runQuery(
            "preferences.getUserPreferences" as any
        );
        
        return {
            openaiApiKey: userPreferences?.apiKeys?.openaiApiKey,
            anthropicApiKey: userPreferences?.apiKeys?.anthropicApiKey,
            googleApiKey: userPreferences?.apiKeys?.googleApiKey,
            deepseekApiKey: userPreferences?.apiKeys?.deepseekApiKey,
            openrouterApiKey: userPreferences?.apiKeys?.openrouterApiKey,
            togetherApiKey: userPreferences?.apiKeys?.togetherApiKey, // Add Together.ai support
        };
    } catch (error) {
        console.error("Failed to get user API keys:", error);
        return {};
    }
}

export const providerManager = new ProviderManager();
