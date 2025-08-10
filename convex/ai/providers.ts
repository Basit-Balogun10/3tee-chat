"use node";

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Provider configuration with proper typing
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
        defaultModels: [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
        ] as const,
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
        defaultModels: [
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ] as const,
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

// Modern AI SDK Provider Manager
export class ProviderManager {
    private clients: Map<string, any> = new Map();

    getProvider(provider: ProviderName, apiKey?: string): any {
        const key = `${provider}-${apiKey || "default"}`;

        if (this.clients.has(key)) {
            return this.clients.get(key);
        }

        let client;

        switch (provider) {
            case "openai":
                // Create OpenAI provider instance
                client = openai;
                break;

            case "anthropic":
                // Create Anthropic provider instance
                client = anthropic;
                break;

            case "google":
                // Create Google provider instance
                client = google;
                break;

            case "deepseek":
                // For now, use OpenAI-compatible endpoint for DeepSeek
                client = openai;
                break;

            case "openrouter":
                // Create OpenRouter provider instance
                client = createOpenRouter({
                    apiKey: apiKey || process.env.OPENROUTER_API_KEY || "",
                });
                break;

            case "together":
                // For now, use OpenAI-compatible endpoint for Together
                client = openai;
                break;

            default: {
                // This will never be reached due to TypeScript exhaustive checking
                const exhaustiveCheck: never = provider;
                throw new Error(
                    `Unsupported provider: ${String(exhaustiveCheck)}`
                );
            }
        }

        this.clients.set(key, client);
        return client;
    }

    // Get model instance for use with AI SDK functions
    getModel(provider: ProviderName, model: string, apiKey?: string): any {
        try {
            // Get the provider instance first
            const providerInstance = this.getProvider(provider, apiKey);

            // Return the model from the provider instance
            if (provider === "openai") {
                return providerInstance(model, {
                    apiKey: apiKey || process.env.OPENAI_API_KEY,
                    ...(model.includes("o1")
                        ? {
                              baseURL: "https://api.openai.com/v1",
                          }
                        : {}),
                    // Support for Azure OpenAI if no user key provided
                    ...(!apiKey && process.env.AZURE_OPENAI_ENDPOINT
                        ? {
                              baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${model}`,
                              defaultQuery: {
                                  "api-version":
                                      process.env.OPENAI_API_VERSION ||
                                      "2024-07-01-preview",
                              },
                              defaultHeaders: {
                                  "api-key": process.env.AZURE_OPENAI_API_KEY,
                              },
                          }
                        : {}),
                });
            } else if (provider === "anthropic") {
                return providerInstance(model, {
                    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
                });
            } else if (provider === "google") {
                return providerInstance(model, {
                    apiKey: apiKey || process.env.GOOGLE_AI_API_KEY,
                    // Support for Vertex AI if no user key provided
                    ...(!apiKey && process.env.GOOGLE_CLOUD_PROJECT
                        ? {
                              project: process.env.GOOGLE_CLOUD_PROJECT,
                              location:
                                  process.env.GOOGLE_CLOUD_LOCATION ||
                                  "us-east1",
                          }
                        : {}),
                });
            } else if (provider === "deepseek") {
                return providerInstance(model, {
                    apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
                    baseURL: "https://api.deepseek.com/v1",
                });
            } else if (provider === "openrouter") {
                // OpenRouter uses the provider instance directly with model
                return providerInstance(model);
            } else if (provider === "together") {
                return providerInstance(model, {
                    apiKey: apiKey || process.env.TOGETHER_API_KEY,
                    baseURL: "https://api.together.xyz/v1",
                });
            } else {
                throw new Error(`Unsupported provider: ${provider}`);
            }
        } catch (error) {
            console.error(`Failed to initialize ${provider} client:`, error);
            throw new Error(
                `Failed to initialize ${provider} client: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
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
    if (
        model.startsWith("gpt-") ||
        model.startsWith("o1") ||
        model.includes("gpt")
    ) {
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
    if (
        model.includes("llama") ||
        model.includes("mixtral") ||
        model.includes("together")
    ) {
        return "together";
    }

    // OpenRouter models (with provider prefix)
    if (model.includes("/")) {
        return "openrouter";
    }

    // Default to OpenAI for unknown models
    return "openai";
}

// Helper function to get user API keys
export async function getUserApiKeys(
    ctx: any
): Promise<Record<string, string | undefined>> {
    try {
        const userId = await ctx.auth.getUserIdentity();
        if (!userId) return {};

        const preferences = await ctx.runQuery(
            "preferences.getUserPreferences",
            {
                userId: userId.subject,
            }
        );

        return preferences?.apiKeys || {};
    } catch (error) {
        console.error("Error getting user API keys:", error);
        return {};
    }
}

export const providerManager = new ProviderManager();
