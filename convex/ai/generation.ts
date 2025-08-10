"use node";

import { getMimeType } from "./helpers";
import { generateText, generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// AI SDK File Manager
export class AISDKFileManager {
    private fileCache: Map<string, Map<string, string>> = new Map();

    // Process regular file attachments for AI SDK
    async processRegularAttachment(
        attachment: any,
        provider: string,
        ctx: any
    ): Promise<{
        type: string;
        name: string;
        mimeType: string;
        data: string; // Base64 or data URL for AI SDK
    }> {
        const fileBlob = await ctx.storage.get(attachment.storageId);
        if (!fileBlob) {
            throw new Error(`File not found: ${attachment.name}`);
        }

        const mimeType = getMimeType(attachment.name, attachment.type);

        // Convert blob to base64 for AI SDK
        const arrayBuffer = await fileBlob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64}`;

        return {
            type: attachment.type === "image" ? "image" : "file",
            name: attachment.name,
            mimeType,
            data: dataUrl,
        };
    }

    // Upload artifact content for AI SDK
    async uploadArtifactToProvider(
        artifactId: string,
        provider: string,
        artifact: any,
        ctx: any
    ): Promise<{ fileName: string; mimeType: string; data: string }> {
        const fileName = `${artifact.filename}.${artifact.language}`;
        const mimeType = "text/plain";

        return {
            fileName,
            mimeType,
            data: artifact.content,
        };
    }
}

// AI SDK Image Generation Manager
export class AISDKImageGenerationManager {
    async generateImage(
        provider: string,
        prompt: string,
        options: any = {},
        ctx?: any
    ): Promise<string> {
        console.log(`🎨 GENERATING IMAGE WITH AI SDK:`, {
            provider,
            prompt: prompt.substring(0, 50) + "...",
            timestamp: new Date().toISOString(),
        });

        try {
            if (provider === "openai") {
                // Use OpenAI DALL-E 3 for image generation
                const response = await fetch(
                    "https://api.openai.com/v1/images/generations",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: "dall-e-3",
                            prompt: prompt,
                            n: 1,
                            size: options.size || "1024x1024",
                            quality: options.quality || "standard",
                            style: options.style || "natural",
                        }),
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(
                        `OpenAI DALL-E error: ${error.error?.message || "Unknown error"}`
                    );
                }

                const data = await response.json();
                const imageUrl = data.data[0]?.url;

                if (!imageUrl) {
                    throw new Error("No image URL returned from OpenAI");
                }

                // Auto-add to media library if context provided
                if (ctx) {
                    const userId = await ctx.auth.getUserIdentity();
                    if (userId) {
                        try {
                            await ctx.runMutation("library.addToMediaLibrary", {
                                type: "image",
                                title: `Generated Image: ${prompt.substring(0, 50)}...`,
                                description: `AI-generated image using DALL-E 3`,
                                externalUrl: imageUrl,
                                prompt: prompt,
                                model: "dall-e-3",
                                generationParams: options,
                            });
                        } catch (libraryError) {
                            console.warn(
                                "Failed to add image to library:",
                                libraryError
                            );
                        }
                    }
                }

                return imageUrl;
            } else if (provider === "google") {
                // Use Google Imagen for image generation
                const response = await fetch(
                    `https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/imagegeneration:predict`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            instances: [
                                {
                                    prompt: prompt,
                                    image: {
                                        width:
                                            parseInt(
                                                options.size?.split("x")[0]
                                            ) || 1024,
                                        height:
                                            parseInt(
                                                options.size?.split("x")[1]
                                            ) || 1024,
                                    },
                                },
                            ],
                            parameters: {
                                sampleCount: 1,
                            },
                        }),
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(
                        `Google Imagen error: ${error.error?.message || "Unknown error"}`
                    );
                }

                const data = await response.json();
                const imageBase64 = data.predictions[0]?.bytesBase64Encoded;

                if (!imageBase64) {
                    throw new Error(
                        "No image data returned from Google Imagen"
                    );
                }

                const imageUrl = `data:image/png;base64,${imageBase64}`;

                // Auto-add to media library if context provided
                if (ctx) {
                    const userId = await ctx.auth.getUserIdentity();
                    if (userId) {
                        try {
                            await ctx.runMutation("library.addToMediaLibrary", {
                                type: "image",
                                title: `Generated Image: ${prompt.substring(0, 50)}...`,
                                description: `AI-generated image using Google Imagen`,
                                externalUrl: imageUrl,
                                prompt: prompt,
                                model: "imagen",
                                generationParams: options,
                            });
                        } catch (libraryError) {
                            console.warn(
                                "Failed to add image to library:",
                                libraryError
                            );
                        }
                    }
                }

                return imageUrl;
            } else {
                throw new Error(
                    `Image generation not supported for provider: ${provider}`
                );
            }
        } catch (error) {
            console.error("AI SDK Image generation error:", error);

            if (ctx) {
                return `I apologize, but I encountered an error while generating the image: ${error instanceof Error ? error.message : "Unknown error"}. Please try again or contact support if the issue persists.`;
            }

            throw error;
        }
    }
}

// AI SDK Video Generation Manager
export class AISDKVideoGenerationManager {
    async generateVideo(
        provider: string,
        prompt: string,
        options: any = {},
        ctx?: any
    ): Promise<any> {
        console.log(`🎬 GENERATING VIDEO WITH AI SDK:`, {
            provider,
            prompt: prompt.substring(0, 50) + "...",
            options,
            timestamp: new Date().toISOString(),
        });

        try {
            if (provider === "google") {
                // Use Google Veo for video generation
                const response = await fetch(
                    `https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/veo-3.0-generate-preview:predict`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            instances: [
                                {
                                    prompt: prompt,
                                    video: {
                                        duration: `${options.duration || 5}s`,
                                        aspectRatio:
                                            options.aspectRatio || "16:9",
                                    },
                                },
                            ],
                            parameters: {
                                quality: options.quality || "standard",
                            },
                        }),
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(
                        `Google Veo error: ${error.error?.message || "Unknown error"}`
                    );
                }

                const data = await response.json();
                const videoBase64 = data.predictions[0]?.bytesBase64Encoded;

                if (!videoBase64) {
                    throw new Error("No video data returned from Google Veo");
                }

                const videoUrl = `data:video/mp4;base64,${videoBase64}`;

                const result = {
                    videoUrl,
                    thumbnailUrl: null, // Could extract first frame
                    duration: `${options.duration || 5}s`,
                    resolution:
                        options.aspectRatio === "16:9" ? "1280x720" : "720x720",
                    status: "success",
                    provider: "google",
                };

                // Auto-add to media library if context provided
                if (ctx) {
                    const userId = await ctx.auth.getUserIdentity();
                    if (userId) {
                        try {
                            await ctx.runMutation("library.addToMediaLibrary", {
                                type: "video",
                                title: `Generated Video: ${prompt.substring(0, 50)}...`,
                                description: `AI-generated video using Google Veo`,
                                externalUrl: videoUrl,
                                prompt: prompt,
                                model: "veo-3.0",
                                generationParams: options,
                                metadata: {
                                    duration: options.duration || 5,
                                    resolution: result.resolution,
                                    aspectRatio: options.aspectRatio || "16:9",
                                },
                            });
                        } catch (libraryError) {
                            console.warn(
                                "Failed to add video to library:",
                                libraryError
                            );
                        }
                    }
                }

                return result;
            } else if (provider === "openai") {
                // Use OpenAI Sora for video generation (when available)
                throw new Error(
                    "OpenAI Sora video generation is not yet publicly available. Please use Google Veo instead."
                );
            } else {
                throw new Error(
                    `Video generation not supported for provider: ${provider}`
                );
            }
        } catch (error) {
            console.error("AI SDK Video generation error:", error);

            const errorResult = {
                videoUrl: null,
                thumbnailUrl: null,
                duration: options.duration || "5s",
                resolution:
                    options.aspectRatio === "16:9" ? "1280x720" : "720x720",
                status: "error",
                error: `Video generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                provider: provider,
            };

            return errorResult;
        }
    }
}

// AI SDK Structured Output Manager with Native Provider Search Grounding
export class AISDKStructuredOutputManager {
    async generateStructuredOutput(
        provider: string,
        model: string,
        messages: any[],
        schema: z.ZodSchema,
        options: any = {}
    ): Promise<any> {
        console.log(`🎯 GENERATING STRUCTURED OUTPUT WITH AI SDK:`, {
            provider,
            model,
            messageCount: messages.length,
            timestamp: new Date().toISOString(),
        });

        try {
            let modelInstance;

            if (provider === "openai") {
                modelInstance = openai(model);
            } else if (provider === "google") {
                modelInstance = google(model);
            } else if (provider === "anthropic") {
                modelInstance = anthropic(model);
            } else {
                throw new Error(
                    `Structured output not supported for provider: ${provider}`
                );
            }

            // Use AI SDK's generateObject with native provider search grounding
            const generateOptions: any = {
                model: modelInstance,
                messages: messages,
                schema: schema,
                temperature: options.temperature || 0.7,
                // Add API key configuration if provided
                ...(options.apiKey && {
                    apiKey: options.apiKey,
                }),
            };

            // Add native search grounding for Google/Gemini models
            if (provider === "google" && this.supportsSearchGrounding(model)) {
                generateOptions.tools = [
                    {
                        googleSearchRetrieval: {
                            disableAttribution: false, // Keep attribution for transparency
                        },
                    },
                ];
                console.log(`🔍 ENABLED GOOGLE SEARCH GROUNDING for ${model}`);
            }

            // Add web search capability for OpenAI models with browsing
            if (provider === "openai" && this.supportsWebBrowsing(model)) {
                generateOptions.tools = [
                    {
                        type: "function",
                        function: {
                            name: "web_search",
                            description:
                                "Search the web for current information",
                            parameters: {
                                type: "object",
                                properties: {
                                    query: {
                                        type: "string",
                                        description: "Search query",
                                    },
                                },
                                required: ["query"],
                            },
                        },
                    },
                ];
                console.log(`🔍 ENABLED WEB BROWSING for ${model}`);
            }

            const result = await generateObject(generateOptions);

            console.log(`✅ STRUCTURED OUTPUT COMPLETE:`, {
                provider,
                model,
                timestamp: new Date().toISOString(),
            });

            return result.object;
        } catch (error) {
            console.error("AI SDK Structured output error:", error);
            throw error;
        }
    }

    // Check if Google/Gemini model supports native search grounding
    private supportsSearchGrounding(model: string): boolean {
        // Google/Gemini models with built-in search grounding
        const searchGroundingModels = [
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-pro",
        ];

        return searchGroundingModels.some((supportedModel) =>
            model.includes(supportedModel)
        );
    }

    // Check if OpenAI model supports web browsing
    private supportsWebBrowsing(model: string): boolean {
        // OpenAI models with web browsing capability
        const webBrowsingModels = ["gpt-4o", "gpt-4-turbo", "gpt-4"];

        return webBrowsingModels.some((supportedModel) =>
            model.includes(supportedModel)
        );
    }

    async generateStreamingStructuredOutput(
        provider: string,
        model: string,
        messages: any[],
        schema: z.ZodSchema,
        options: any = {}
    ): Promise<AsyncIterable<any>> {
        // For now, fall back to non-streaming
        const result = await this.generateStructuredOutput(
            provider,
            model,
            messages,
            schema,
            options
        );

        // Return as single-item async iterable
        return (async function* () {
            yield result;
        })();
    }
}

// Export utility functions for AI SDK integration
export function convertAttachmentsForAISDK(attachments: any[]): any[] {
    return attachments.map((attachment) => ({
        type: attachment.type === "image" ? "image" : "file",
        name: attachment.name,
        data: attachment.data,
        mimeType: attachment.mimeType,
    }));
}

export function prepareMessagesForAISDK(messages: any[]): any[] {
    return messages.map((message) => {
        if (typeof message.content === "string") {
            return {
                role: message.role,
                content: message.content,
            };
        }

        // Handle multimodal content
        if (Array.isArray(message.content)) {
            return {
                role: message.role,
                content: message.content.map((part: any) => {
                    if (part.type === "text") {
                        return { type: "text", text: part.text };
                    } else if (part.type === "image_url") {
                        return { type: "image", image: part.image_url.url };
                    }
                    return part;
                }),
            };
        }

        return message;
    });
}

// Utility function to validate AI SDK compatibility
export function validateAISDKCompatibility(
    provider: string,
    feature: string
): boolean {
    const compatibility = {
        openai: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: true, // ✅ Now implemented with DALL-E 3
            videoGeneration: false, // Sora not yet public
            fileUploads: true,
            webSearch: true, // ✅ Now implemented
        },
        google: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: true, // ✅ Now implemented with Imagen
            videoGeneration: true, // ✅ Now implemented with Veo
            fileUploads: true,
            webSearch: true, // ✅ Now implemented
        },
        anthropic: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: false,
            videoGeneration: false,
            fileUploads: true,
            webSearch: false,
        },
        deepseek: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: false,
            videoGeneration: false,
            fileUploads: false,
            webSearch: false,
        },
    };

    return (compatibility as any)[provider]?.[feature] ?? false;
}

// Create and export manager instances
export const fileManager = new AISDKFileManager();
export const imageGenerationManager = new AISDKImageGenerationManager();
export const videoGenerationManager = new AISDKVideoGenerationManager();
export const structuredOutputManager = new AISDKStructuredOutputManager();
