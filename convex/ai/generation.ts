"use node";

import { getMimeType } from "./helpers";
import { internal } from "../_generated/api";
import { generateText, generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Enhanced file manager with AI SDK integration
class AISDKFileManager {
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
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        return {
            type: attachment.type === 'image' ? 'image' : 'file',
            name: attachment.name,
            mimeType,
            data: dataUrl,
        };
    }

    // Upload artifact content for AI SDK (simplified)
    async uploadArtifactToProvider(
        artifactId: string,
        provider: string,
        artifact: any,
        client: any, // Not used with AI SDK
        ctx: any
    ): Promise<{ fileName: string; mimeType: string; data: string }> {
        const fileName = `${artifact.filename}.${artifact.language}`;
        const mimeType = "text/plain";

        // For AI SDK, we just return the content as text data
        return {
            fileName,
            mimeType,
            data: artifact.content,
        };
    }
}

// AI SDK Image Generation Manager
class AISDKImageGenerationManager {
    // Generate image using AI SDK providers
    async generateImage(
        provider: string,
        client: any, // Not used with AI SDK
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
            let imageResult;

            if (provider === "openai") {
                // Use OpenAI DALL-E via AI SDK
                const openaiProvider = openai({
                    apiKey: process.env.OPENAI_API_KEY,
                });

                // Note: Image generation with AI SDK might need different approach
                // This is a placeholder for future AI SDK image generation support
                throw new Error("Image generation via AI SDK not yet implemented for OpenAI");

            } else if (provider === "google") {
                // Use Google Imagen via AI SDK
                const googleProvider = google({
                    apiKey: process.env.GOOGLE_AI_API_KEY,
                });

                // Note: Image generation with AI SDK might need different approach
                // This is a placeholder for future AI SDK image generation support
                throw new Error("Image generation via AI SDK not yet implemented for Google");

            } else {
                throw new Error(`Image generation not supported for provider: ${provider}`);
            }

        } catch (error) {
            console.error("AI SDK Image generation error:", error);
            
            // Return a placeholder response
            const placeholderResponse = `I apologize, but I'm unable to generate images at the moment using the ${provider} provider. Image generation via AI SDK is still being implemented. Please try again later.`;
            
            if (ctx) {
                // Return text response instead of image for now
                return placeholderResponse;
            }
            
            throw error;
        }
    }
}

// AI SDK Video Generation Manager
class AISDKVideoGenerationManager {
    // Generate video using AI SDK providers
    async generateVideo(
        provider: string,
        client: any, // Not used with AI SDK
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
                // Use Google Veo via AI SDK
                const googleProvider = google({
                    apiKey: process.env.GOOGLE_AI_API_KEY,
                });

                // Note: Video generation with AI SDK might need different approach
                // This is a placeholder for future AI SDK video generation support
                throw new Error("Video generation via AI SDK not yet implemented for Google");

            } else if (provider === "openai") {
                // Use OpenAI Sora via AI SDK
                const openaiProvider = openai({
                    apiKey: process.env.OPENAI_API_KEY,
                });

                // Note: Video generation with AI SDK might need different approach
                // This is a placeholder for future AI SDK video generation support
                throw new Error("Video generation via AI SDK not yet implemented for OpenAI");

            } else {
                throw new Error(`Video generation not supported for provider: ${provider}`);
            }

        } catch (error) {
            console.error("AI SDK Video generation error:", error);
            
            // Return a placeholder response
            const placeholderResponse = {
                videoUrl: null,
                thumbnailUrl: null,
                duration: options.duration || "5s",
                resolution: options.aspectRatio === "16:9" ? "1280x720" : "720x720",
                status: "error",
                error: `Video generation via AI SDK is still being implemented for ${provider}. Please try again later.`,
                provider: provider,
            };
            
            return placeholderResponse;
        }
    }
}

// AI SDK Structured Output Manager
class AISDKStructuredOutputManager {
    // Generate structured output using AI SDK
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
                const openaiProvider = openai({
                    apiKey: options.apiKey || process.env.OPENAI_API_KEY,
                });
                modelInstance = openaiProvider(model);
            } else if (provider === "google") {
                const googleProvider = google({
                    apiKey: options.apiKey || process.env.GOOGLE_AI_API_KEY,
                });
                modelInstance = googleProvider(model);
            } else {
                throw new Error(`Structured output not supported for provider: ${provider}`);
            }

            // Use AI SDK's generateObject for structured output
            const result = await generateObject({
                model: modelInstance,
                messages: messages,
                schema: schema,
                temperature: options.temperature || 0.7,
                maxTokens: options.maxTokens || 4000,
            });

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

    // Generate streaming structured output (if supported)
    async generateStreamingStructuredOutput(
        provider: string,
        model: string,
        messages: any[],
        schema: z.ZodSchema,
        options: any = {}
    ): Promise<AsyncIterable<any>> {
        // Note: Streaming structured output might need different implementation
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

// Legacy compatibility wrapper for existing generation system
class LegacyCompatibilityWrapper {
    private aiSDKFileManager = new AISDKFileManager();
    private aiSDKImageManager = new AISDKImageGenerationManager();
    private aiSDKVideoManager = new AISDKVideoGenerationManager();
    private aiSDKStructuredManager = new AISDKStructuredOutputManager();

    // Wrap AI SDK file manager for legacy compatibility
    get fileManager() {
        return {
            processRegularAttachment: this.aiSDKFileManager.processRegularAttachment.bind(this.aiSDKFileManager),
            uploadArtifactToProvider: this.aiSDKFileManager.uploadArtifactToProvider.bind(this.aiSDKFileManager),
            // Add other methods as needed for compatibility
        };
    }

    // Wrap AI SDK image manager for legacy compatibility
    get imageGenerationManager() {
        return {
            generateImage: this.aiSDKImageManager.generateImage.bind(this.aiSDKImageManager),
            // Add other methods as needed
        };
    }

    // Wrap AI SDK video manager for legacy compatibility
    get videoGenerationManager() {
        return {
            generateVideo: this.aiSDKVideoManager.generateVideo.bind(this.aiSDKVideoManager),
            // Add other methods as needed
        };
    }

    // Wrap AI SDK structured output manager for legacy compatibility
    get structuredOutputManager() {
        return {
            generateStructuredOutput: this.aiSDKStructuredManager.generateStructuredOutput.bind(this.aiSDKStructuredManager),
            generateStreamingStructuredOutput: this.aiSDKStructuredManager.generateStreamingStructuredOutput.bind(this.aiSDKStructuredManager),
            // Add other methods as needed
        };
    }
}

// Create and export the compatibility wrapper
const compatibilityWrapper = new LegacyCompatibilityWrapper();

// Export individual managers for direct use
export const fileManager = compatibilityWrapper.fileManager;
export const imageGenerationManager = compatibilityWrapper.imageGenerationManager;  
export const videoGenerationManager = compatibilityWrapper.videoGenerationManager;
export const structuredOutputManager = compatibilityWrapper.structuredOutputManager;

// Export the new AI SDK managers for direct use
export const aiSDKFileManager = new AISDKFileManager();
export const aiSDKImageGenerationManager = new AISDKImageGenerationManager();
export const aiSDKVideoGenerationManager = new AISDKVideoGenerationManager();
export const aiSDKStructuredOutputManager = new AISDKStructuredOutputManager();

// Export utility functions for AI SDK integration
export function convertAttachmentsForAISDK(attachments: any[]): any[] {
    return attachments.map(attachment => ({
        type: attachment.type === 'image' ? 'image' : 'file',
        name: attachment.name,
        data: attachment.data, // Should be base64 or data URL
        mimeType: attachment.mimeType,
    }));
}

export function prepareMessagesForAISDK(messages: any[]): any[] {
    return messages.map(message => {
        if (typeof message.content === 'string') {
            return {
                role: message.role,
                content: message.content
            };
        }
        
        // Handle multimodal content
        if (Array.isArray(message.content)) {
            return {
                role: message.role,
                content: message.content.map((part: any) => {
                    if (part.type === 'text') {
                        return { type: 'text', text: part.text };
                    } else if (part.type === 'image_url') {
                        return { type: 'image', image: part.image_url.url };
                    }
                    return part;
                })
            };
        }
        
        return message;
    });
}

// Utility function to validate AI SDK compatibility
export function validateAISDKCompatibility(provider: string, feature: string): boolean {
    const compatibility = {
        openai: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: false, // Not yet implemented
            videoGeneration: false, // Not yet implemented
            fileUploads: true,
        },
        google: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: false, // Not yet implemented
            videoGeneration: false, // Not yet implemented
            fileUploads: true,
            webSearch: true,
        },
        anthropic: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: false,
            videoGeneration: false,
            fileUploads: true,
        },
        deepseek: {
            streaming: true,
            structuredOutput: true,
            imageGeneration: false,
            videoGeneration: false,
            fileUploads: false,
        },
    };

    return compatibility[provider]?.[feature] ?? false;
}
