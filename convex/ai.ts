"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { generateText, streamText, generateObject } from "ai";
import { z } from "zod";

import {
    getProviderFromModel,
    PROVIDER_CONFIGS,
    providerManager,
    type ProviderName,
} from "./ai/providers";
import {
    getUserApiKeys,
    processAttachmentForAISDK,
    formatMessagesForAISDK,
    processLibraryItemForAISDK,
} from "./ai/helpers";
import {
    fileManager,
    imageGenerationManager,
    videoGenerationManager,
    structuredOutputManager,
} from "./ai/generation";

// AI response generation with Vercel AI SDK
export const generateStreamingResponse = internalAction({
    args: {
        chatId: v.id("chats"),
        messageId: v.id("messages"),
        model: v.string(),
        userApiKey: v.optional(v.string()),
        commands: v.optional(v.array(v.string())),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio"),
                        v.literal("video")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        referencedLibraryItems: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("attachment"),
                        v.literal("artifact"),
                        v.literal("media")
                    ),
                    id: v.string(),
                    name: v.string(),
                    size: v.optional(v.number()),
                    mimeType: v.optional(v.string()),
                })
            )
        ),
    },
    handler: async (ctx, args) => {
        const startTime = Date.now();
        
        try {
            console.log("🚀 STARTING AI SDK STREAMING GENERATION:", {
                chatId: args.chatId,
                messageId: args.messageId,
                model: args.model,
                provider: getProviderFromModel(args.model),
                timestamp: new Date().toISOString(),
            });

            // Get user ID from message to load AI settings
            const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
                messageId: args.messageId,
            });
            if (!message) throw new Error("Message not found");

            const chat = await ctx.runQuery(internal.aiHelpers.getChat, {
                chatId: args.chatId,
            });
            if (!chat) throw new Error("Chat not found");

            // Get combined AI settings (per-chat + global preferences)
            const aiSettings = await ctx.runQuery(internal.aiHelpers.getCombinedAISettings, {
                chatId: args.chatId,
                userId: chat.userId,
            });

            // Get user API keys and chat history
            const userApiKeys = await getUserApiKeys(ctx);
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                {
                    chatId: args.chatId,
                    excludeMessageId: args.messageId,
                }
            );

            const lastUserMessage = messages
                .filter((m: any) => m.role === "user")
                .pop();
            const content = lastUserMessage?.content || "";
            let response = "";
            const metadata: any = {};

            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey =
                userApiKeys[config.userKeyField as keyof typeof userApiKeys];

            console.log(
                `🚀 Using AI SDK with provider: ${provider} for model: ${args.model}`
            );

            // Process library items using the helper function
            const allProcessedAttachments: any[] = [];

            if (args.attachments && args.attachments.length > 0) {
                for (const attachment of args.attachments) {
                    try {
                        const processedAttachment =
                            await processAttachmentForAISDK(attachment, ctx);
                        allProcessedAttachments.push(processedAttachment);
                    } catch (error) {
                        console.error(
                            `Failed to process attachment ${attachment.name}:`,
                            error
                        );
                    }
                }
            }

            if (
                args.referencedLibraryItems &&
                args.referencedLibraryItems.length > 0
            ) {
                console.log(
                    `🔗 Processing ${args.referencedLibraryItems.length} referenced library items...`
                );

                for (const item of args.referencedLibraryItems) {
                    try {
                        const processedItem = await processLibraryItemForAISDK(
                            item,
                            ctx
                        );
                        allProcessedAttachments.push(processedItem);
                    } catch (error) {
                        console.error(
                            `Failed to process library item ${item.id}:`,
                            error
                        );
                    }
                }
            }

            console.log(
                `📎 Total processed attachments: ${allProcessedAttachments.length}`
            );

            // Check for special commands
            const hasCanvas = args.commands?.includes("canvas");
            const hasImageGen = args.commands?.includes("image");
            const hasVideoGen = args.commands?.includes("video");
            const hasSearch = args.commands?.includes("search");

            // Handle command combinations and priorities
            const isMediaGeneration = hasImageGen;
            const isVideoGeneration = hasVideoGen;
            const isCanvasGeneration = hasCanvas;

            // Priority: Media generation > Canvas > Normal chat
            // Search can be combined with any of these

            // Handle image generation (can be combined with search)
            if (isMediaGeneration) {
                try {
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: "🎨 Generating image...",
                            isStreaming: true,
                        }
                    );

                    // Use the actual user message content as the image prompt
                    const imagePrompt = content;

                    const imageUrl = await imageGenerationManager.generateImage(
                        provider === "google" || provider === "openai"
                            ? provider
                            : "openai",
                        imagePrompt,
                        { size: "1024x1024" },
                        ctx
                    );

                    response = `Here's your generated image:\n\n![Generated Image](${imageUrl})`;
                    metadata.imagePrompt = imagePrompt;
                    metadata.generatedImageUrl = imageUrl;

                    const responseTime = Date.now() - startTime;
                    
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: response,
                            metadata,
                            isStreaming: false,
                            responseMetadata: {
                                responseTime,
                                model: args.model,
                                provider,
                                finishReason: "image_generated",
                            },
                        }
                    );
                    return;
                } catch (error) {
                    console.error("Image generation error:", error);
                    response =
                        "Sorry, I couldn't generate the image. Please try again.";
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: response,
                            isStreaming: false,
                        }
                    );
                    return;
                }
            }

            // Handle video generation (can be combined with search)
            if (isVideoGeneration) {
                try {
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content:
                                "🎬 Starting video generation... This may take a few minutes.",
                            isStreaming: true,
                        }
                    );

                    // Use the actual user message content as the video prompt
                    const videoPrompt = content;

                    const videoData =
                        await videoGenerationManager.generateVideo(
                            provider === "google" || provider === "openai"
                                ? provider
                                : "google",
                            videoPrompt,
                            { duration: 5, aspectRatio: "16:9" },
                            ctx
                        );

                    if (videoData.videoUrl) {
                        response = `Here's your generated video:\n\n[Generated Video](${videoData.videoUrl})`;
                        metadata.videoPrompt = videoPrompt;
                        metadata.generatedVideoUrl = videoData.videoUrl;
                        metadata.videoThumbnailUrl = videoData.thumbnailUrl;
                    } else {
                        response = videoData.error || "Video generation failed";
                    }

                    const responseTime = Date.now() - startTime;

                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: response,
                            metadata,
                            isStreaming: false,
                            responseMetadata: {
                                responseTime,
                                model: args.model,
                                provider,
                                finishReason: "video_generated",
                            },
                        }
                    );
                    return;
                } catch (error) {
                    console.error("Video generation error:", error);
                    response =
                        "Sorry, I couldn't generate the video. Please try again.";
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: response,
                            isStreaming: false,
                        }
                    );
                    return;
                }
            }

            // Handle canvas/structured output (can be combined with search)
            if (isCanvasGeneration) {
                const canvasSchema = z.object({
                    intro: z
                        .string()
                        .describe("Brief introduction to the created content"),
                    artifacts: z.array(
                        z.object({
                            id: z.string(),
                            filename: z.string(),
                            language: z.string(),
                            content: z.string(),
                            description: z.string(),
                        })
                    ),
                    summary: z
                        .string()
                        .describe("Summary of the created artifacts"),
                });

                try {
                    // Enhanced prompt for canvas with optional search
                    let enhancedPrompt = content;
                    if (hasSearch) {
                        enhancedPrompt = `${content}\n\nNote: Use web search to find current information if needed for creating accurate and up-to-date artifacts.`;
                    }

                    await ctx.runAction(internal.ai.generateStructuredOutput, {
                        chatId: args.chatId,
                        messageId: args.messageId,
                        model: args.model,
                        schema: canvasSchema,
                        userApiKey: userKey,
                        enhancedPrompt,
                        metadata: {
                            hasSearch,
                            commands: args.commands,
                        },
                        // Pass AI settings to structured output generation
                        aiSettings,
                    });
                    return;
                } catch (error) {
                    console.error("Canvas generation error:", error);
                    response =
                        "Sorry, I couldn't generate the canvas artifacts. Please try again.";
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: response,
                            isStreaming: false,
                        }
                    );
                    return;
                }
            }

            // Normal AI response using AI SDK streaming with custom settings
            const modelInstance = providerManager.getModel(
                provider,
                args.model,
                userKey
            );

            // Convert messages to AI SDK format
            const convertedMessages = formatMessagesForAISDK(
                messages,
                allProcessedAttachments
            );

            // Add system prompt if configured
            if (aiSettings.systemPrompt && aiSettings.systemPrompt.trim()) {
                convertedMessages.unshift({
                    role: "system",
                    content: aiSettings.systemPrompt,
                });
            }

            console.log("🔄 Starting AI SDK streaming with custom settings:", {
                temperature: aiSettings.temperature,
                maxTokens: aiSettings.maxTokens,
                topP: aiSettings.topP,
                frequencyPenalty: aiSettings.frequencyPenalty,
                presencePenalty: aiSettings.presencePenalty,
                hasSystemPrompt: !!aiSettings.systemPrompt,
            });

            // Use AI SDK's streamText for streaming response with custom settings
            const result = streamText({
                model: modelInstance,
                messages: convertedMessages,
                temperature: aiSettings.temperature,
                maxTokens: aiSettings.maxTokens,
                topP: aiSettings.topP,
                frequencyPenalty: aiSettings.frequencyPenalty,
                presencePenalty: aiSettings.presencePenalty,
            });

            let fullResponse = "";

            // Stream the response
            for await (const delta of result.textStream) {
                fullResponse += delta;

                // Update message content with partial response
                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: fullResponse,
                    isStreaming: true,
                });
            }

            // Get final response metadata
            const usage = await result.usage;
            const finishReason = await result.finishReason;
            const responseTime = Date.now() - startTime;

            // Finalize the response with metadata tracking
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: fullResponse,
                metadata,
                isStreaming: false,
                responseMetadata: {
                    usage: usage ? {
                        promptTokens: usage.promptTokens,
                        completionTokens: usage.completionTokens,
                        totalTokens: usage.totalTokens,
                    } : undefined,
                    finishReason,
                    responseTime,
                    model: args.model,
                    provider,
                    requestId: crypto.randomUUID(),
                },
            });

            console.log("✅ AI SDK STREAMING COMPLETE:", {
                chatId: args.chatId,
                messageId: args.messageId,
                responseLength: fullResponse.length,
                responseTime,
                usage,
                finishReason,
                customSettings: {
                    temperature: aiSettings.temperature,
                    maxTokens: aiSettings.maxTokens,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error("❌ AI SDK STREAMING ERROR:", error);

            const errorMessage = `Error generating response: ${
                error instanceof Error ? error.message : String(error)
            }`;

            const responseTime = Date.now() - startTime;

            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: errorMessage,
                isStreaming: false,
                responseMetadata: {
                    responseTime,
                    model: args.model,
                    provider: getProviderFromModel(args.model),
                    finishReason: "error",
                },
            });
        }
    },
});

// Enhanced structured output generation using AI SDK
export const generateStructuredOutput = internalAction({
    args: {
        chatId: v.id("chats"),
        messageId: v.id("messages"),
        model: v.string(),
        schema: v.any(),
        userApiKey: v.optional(v.string()),
        attachments: v.optional(v.array(v.any())),
        enhancedPrompt: v.optional(v.string()),
        metadata: v.optional(v.any()),
        // Add AI settings parameter
        aiSettings: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const startTime = Date.now();
        
        try {
            console.log("🎯 GENERATING STRUCTURED OUTPUT WITH AI SDK:", {
                model: args.model,
                chatId: args.chatId,
                messageId: args.messageId,
                hasSchema: !!args.schema,
                hasAISettings: !!args.aiSettings,
                timestamp: new Date().toISOString(),
            });

            // Get user API keys
            const userApiKeys = await getUserApiKeys(ctx);
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                {
                    chatId: args.chatId,
                    excludeMessageId: args.messageId,
                }
            );

            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey =
                args.userApiKey ||
                userApiKeys[config.userKeyField as keyof typeof userApiKeys];

            const promptToUse =
                args.enhancedPrompt ||
                messages.filter((m: any) => m.role === "user").pop()?.content ||
                "";

            // Convert messages to simple format for AI SDK
            const convertedMessages = [
                ...messages.slice(0, -1).map((m: any) => ({
                    role: m.role,
                    content: m.content,
                })),
                { role: "user" as const, content: promptToUse },
            ];

            // Get model instance
            const modelInstance = providerManager.getModel(
                provider,
                args.model,
                userKey
            );

            // Use custom AI settings if provided
            const settings = args.aiSettings || {};

            // Use AI SDK's generateObject
            const result = generateObject({
                model: modelInstance,
                messages: convertedMessages,
                schema: args.schema,
                temperature: settings.temperature || 0.7,
                maxTokens: settings.maxTokens,
                topP: settings.topP || 0.9,
                frequencyPenalty: settings.frequencyPenalty || 0,
                presencePenalty: settings.presencePenalty || 0,
            });

            const { object, usage, finishReason } = await result;
            const responseTime = Date.now() - startTime;

            console.log("📦 STRUCTURED OUTPUT GENERATION COMPLETE:", {
                objectType: typeof object,
                usage,
                finishReason,
                responseTime,
                timestamp: new Date().toISOString(),
            });

            // Process canvas artifacts if applicable
            if (object && typeof object === "object" && "artifacts" in object) {
                const canvasResult = object as any;
                let intro = canvasResult.intro || "";
                let summary = canvasResult.summary || "";
                let artifacts = canvasResult.artifacts || [];

                // Create artifacts in the database
                for (const artifact of artifacts) {
                    await ctx.runMutation(internal.artifacts.createArtifact, {
                        chatId: args.chatId,
                        messageId: args.messageId,
                        content: artifact.content,
                        filename: artifact.filename,
                        language: artifact.language,
                        description: artifact.description,
                    });
                }

                // Format response content
                const response = `${intro}\n\n${artifacts
                    .map(
                        (a: any, i: number) =>
                            `**Artifact ${i + 1}: ${a.filename}**\n${a.description}`
                    )
                    .join("\n\n")}\n\n${summary}`;

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata: {
                        ...args.metadata,
                        artifactCount: artifacts.length,
                        structuredOutput: true,
                    },
                    isStreaming: false,
                    responseMetadata: {
                        usage: usage ? {
                            promptTokens: usage.promptTokens,
                            completionTokens: usage.completionTokens,
                            totalTokens: usage.totalTokens,
                        } : undefined,
                        finishReason,
                        responseTime,
                        model: args.model,
                        provider,
                        requestId: crypto.randomUUID(),
                    },
                });
            } else {
                // Handle non-canvas structured output
                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: JSON.stringify(object, null, 2),
                    metadata: {
                        ...args.metadata,
                        structuredOutput: true,
                    },
                    isStreaming: false,
                    responseMetadata: {
                        usage: usage ? {
                            promptTokens: usage.promptTokens,
                            completionTokens: usage.completionTokens,
                            totalTokens: usage.totalTokens,
                        } : undefined,
                        finishReason,
                        responseTime,
                        model: args.model,
                        provider,
                        requestId: crypto.randomUUID(),
                    },
                });
            }
        } catch (error) {
            console.error("❌ STRUCTURED OUTPUT ERROR:", error);
            const responseTime = Date.now() - startTime;
            
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: `Error generating structured output: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                isStreaming: false,
                responseMetadata: {
                    responseTime,
                    model: args.model,
                    provider: getProviderFromModel(args.model),
                    finishReason: "error",
                },
            });
        }
    },
});

// Multi-AI Response Generation using AI SDK
// Multi-AI Response Generation using AI SDK
export const generateMultiAIResponses = internalAction({
    args: {
        chatId: v.id("chats"),
        messageId: v.id("messages"),
        models: v.array(v.string()),
        commands: v.optional(v.array(v.string())),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio"),
                        v.literal("video")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        referencedLibraryItems: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("attachment"),
                        v.literal("artifact"),
                        v.literal("media")
                    ),
                    id: v.string(),
                    name: v.string(),
                    size: v.optional(v.number()),
                    mimeType: v.optional(v.string()),
                })
            )
        ),
        responseIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        console.log("🧠 STARTING MULTI-AI GENERATION WITH AI SDK:", {
            chatId: args.chatId,
            messageId: args.messageId,
            models: args.models,
            commands: args.commands,
            responseIds: args.responseIds,
            timestamp: new Date().toISOString(),
        });

        // Process attachments and library items (similar to generateStreamingResponse)
        const allProcessedAttachments: any[] = [];

        if (args.attachments && args.attachments.length > 0) {
            for (const attachment of args.attachments) {
                try {
                    const processedAttachment = await processAttachmentForAISDK(attachment, ctx);
                    allProcessedAttachments.push(processedAttachment);
                } catch (error) {
                    console.error(`Failed to process attachment ${attachment.name}:`, error);
                }
            }
        }

        if (args.referencedLibraryItems && args.referencedLibraryItems.length > 0) {
            console.log(`🔗 Processing ${args.referencedLibraryItems.length} referenced library items...`);

            for (const item of args.referencedLibraryItems) {
                try {
                    const processedItem = await processLibraryItemForAISDK(item, ctx);
                    allProcessedAttachments.push(processedItem);
                } catch (error) {
                    console.error(`Failed to process library item ${item.id}:`, error);
                }
            }
        }

        // Check for special commands
        const hasCanvas = args.commands?.includes("canvas");
        const hasImageGen = args.commands?.includes("image");
        const hasVideoGen = args.commands?.includes("video");
        const hasSearch = args.commands?.includes("search");

        // Generate responses from all models in parallel using AI SDK
        const responsePromises = args.models.map(async (model, index) => {
            const responseId = args.responseIds[index];
            const provider = getProviderFromModel(model);

            try {
                console.log(`🚀 GENERATING AI SDK RESPONSE FOR ${model}:`, {
                    responseId,
                    provider,
                    chatId: args.chatId,
                    messageId: args.messageId,
                    commands: args.commands,
                });

                const userApiKeys = await getUserApiKeys(ctx);
                const config = PROVIDER_CONFIGS[provider];
                const userKey = userApiKeys[config.userKeyField];

                // Get chat history
                const messages = await ctx.runQuery(
                    internal.aiHelpers.getChatHistory,
                    {
                        chatId: args.chatId,
                        excludeMessageId: args.messageId,
                    }
                );

                const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
                const content = lastUserMessage?.content || "";

                // Handle special commands for each model
                if (hasImageGen && (provider === "openai" || provider === "google")) {
                    try {
                        const imageUrl = await imageGenerationManager.generateImage(
                            provider,
                            content,
                            { size: "1024x1024" },
                            ctx
                        );

                        const response = `Here's your generated image:\n\n![Generated Image](${imageUrl})`;
                        
                        await ctx.runMutation(api.messages.updateMultiAIResponse, {
                            messageId: args.messageId,
                            responseId,
                            content: response,
                            isComplete: true,
                            metadata: {
                                provider,
                                model,
                                command: "image",
                                imagePrompt: content,
                                generatedImageUrl: imageUrl,
                            },
                        });
                        return;
                    } catch (error) {
                        console.error(`Image generation failed for ${model}:`, error);
                        await ctx.runMutation(api.messages.updateMultiAIResponse, {
                            messageId: args.messageId,
                            responseId,
                            content: "Sorry, I couldn't generate the image. Please try again.",
                            isComplete: true,
                            metadata: { error: true, command: "image" },
                        });
                        return;
                    }
                }

                if (hasVideoGen && (provider === "google" || provider === "openai")) {
                    try {
                        const videoData = await videoGenerationManager.generateVideo(
                            provider === "google" ? provider : "google", // Prefer Google for video
                            content,
                            { duration: 5, aspectRatio: "16:9" },
                            ctx
                        );

                        const response = videoData.videoUrl 
                            ? `Here's your generated video:\n\n[Generated Video](${videoData.videoUrl})`
                            : videoData.error || "Video generation failed";

                        await ctx.runMutation(api.messages.updateMultiAIResponse, {
                            messageId: args.messageId,
                            responseId,
                            content: response,
                            isComplete: true,
                            metadata: {
                                provider,
                                model,
                                command: "video",
                                videoPrompt: content,
                                generatedVideoUrl: videoData.videoUrl,
                                videoThumbnailUrl: videoData.thumbnailUrl,
                            },
                        });
                        return;
                    } catch (error) {
                        console.error(`Video generation failed for ${model}:`, error);
                        await ctx.runMutation(api.messages.updateMultiAIResponse, {
                            messageId: args.messageId,
                            responseId,
                            content: "Sorry, I couldn't generate the video. Please try again.",
                            isComplete: true,
                            metadata: { error: true, command: "video" },
                        });
                        return;
                    }
                }

                if (hasCanvas) {
                    try {
                        const canvasSchema = z.object({
                            intro: z.string().describe("Brief introduction to the created content"),
                            artifacts: z.array(
                                z.object({
                                    id: z.string(),
                                    filename: z.string(),
                                    language: z.string(),
                                    content: z.string(),
                                    description: z.string(),
                                })
                            ),
                            summary: z.string().describe("Summary of the created artifacts"),
                        });

                        let enhancedPrompt = content;
                        if (hasSearch) {
                            enhancedPrompt = `${content}\n\nNote: Use web search to find current information if needed for creating accurate and up-to-date artifacts.`;
                        }

                        const convertedMessages = [
                            ...messages.slice(0, -1).map((m: any) => ({
                                role: m.role,
                                content: m.content,
                            })),
                            { role: "user" as const, content: enhancedPrompt },
                        ];

                        const modelInstance = providerManager.getModel(provider, model, userKey);

                        // Generate structured output using AI SDK
                        const result = await generateObject({
                            model: modelInstance,
                            messages: convertedMessages,
                            schema: canvasSchema,
                            temperature: 0.7,
                        });

                        const parsedOutput = result.object;

                        if (!parsedOutput || !parsedOutput.artifacts) {
                            throw new Error("No artifacts generated");
                        }

                        // Build response with artifacts
                        let responseText = parsedOutput.intro || "";
                        const createdArtifacts = [];

                        for (const artifact of parsedOutput.artifacts) {
                            const artifactId = await ctx.runMutation(api.artifacts.createArtifact, {
                                messageId: args.messageId,
                                chatId: args.chatId,
                                artifactId: artifact.id,
                                filename: artifact.filename,
                                language: artifact.language,
                                content: artifact.content,
                                description: artifact.description,
                            });

                            createdArtifacts.push(artifactId);
                        }

                        responseText += `\n\n${parsedOutput.summary || ""}`;

                        await ctx.runMutation(api.messages.updateMultiAIResponse, {
                            messageId: args.messageId,
                            responseId,
                            content: responseText,
                            isComplete: true,
                            metadata: {
                                provider,
                                model,
                                command: "canvas",
                                structuredOutput: true,
                                canvasIntro: parsedOutput.intro,
                                canvasSummary: parsedOutput.summary,
                                artifacts: createdArtifacts,
                            },
                        });
                        return;
                    } catch (error) {
                        console.error(`Canvas generation failed for ${model}:`, error);
                        await ctx.runMutation(api.messages.updateMultiAIResponse, {
                            messageId: args.messageId,
                            responseId,
                            content: "Sorry, I couldn't generate the canvas artifacts. Please try again.",
                            isComplete: true,
                            metadata: { error: true, command: "canvas" },
                        });
                        return;
                    }
                }

                // Regular text generation (default case)
                const convertedMessages = formatMessagesForAISDK(messages, allProcessedAttachments);
                const modelInstance = providerManager.getModel(provider, model, userKey);

                // Generate text using AI SDK
                const result = await generateText({
                    model: modelInstance,
                    messages: convertedMessages,
                    temperature: 0.7,
                });

                // Update the multi-AI response with the generated content
                await ctx.runMutation(api.messages.updateMultiAIResponse, {
                    messageId: args.messageId,
                    responseId,
                    content: result.text,
                    isComplete: true,
                    metadata: {
                        provider,
                        model,
                        finishReason: result.finishReason,
                        usage: result.usage,
                        commands: args.commands,
                    },
                });

                console.log(`✅ COMPLETED AI SDK RESPONSE FOR ${model}:`, {
                    responseId,
                    contentLength: result.text.length,
                    provider,
                    commands: args.commands,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`❌ FAILED AI SDK RESPONSE FOR ${model}:`, {
                    responseId,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                });

                await ctx.runMutation(api.messages.updateMultiAIResponse, {
                    messageId: args.messageId,
                    responseId,
                    content: `Error generating response: ${error instanceof Error ? error.message : String(error)}`,
                    isComplete: true,
                    metadata: { error: true },
                });
            }
        });

        // Wait for all responses to complete
        await Promise.all(responsePromises);

        console.log("🎉 MULTI-AI GENERATION COMPLETE WITH AI SDK:", {
            chatId: args.chatId,
            messageId: args.messageId,
            completedModels: args.models.length,
            commands: args.commands,
            timestamp: new Date().toISOString(),
        });
    },
});

// Simple non-streaming AI response generation using AI SDK
export const generateResponse = internalAction({
    args: {
        messages: v.array(
            v.object({
                role: v.union(
                    v.literal("user"),
                    v.literal("assistant"),
                    v.literal("system")
                ),
                content: v.string(),
            })
        ),
        model: v.string(),
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        userApiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        try {
            const userApiKeys = await getUserApiKeys(ctx);
            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey =
                args.userApiKey ||
                userApiKeys[config.userKeyField as keyof typeof userApiKeys];

            const modelInstance = providerManager.getModel(
                provider,
                args.model,
                userKey
            );

            const result = await generateText({
                model: modelInstance,
                messages: args.messages,
                temperature: args.temperature || 0.7,
                maxOutputTokens: args.maxTokens || 500,
            });

            return {
                content: result.text,
                finishReason: result.finishReason,
                usage: result.usage,
            };
        } catch (error) {
            throw new Error(
                `AI response generation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    },
});

// Simple resume streaming action (backwards compatibility)
export const resumeStreaming: any = action({
    args: {
        messageId: v.id("messages"),
        fromPosition: v.number(),
    },
    handler: async (ctx, args) => {
        try {
            const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
                messageId: args.messageId,
            });

            if (!message) {
                throw new Error("Message not found");
            }

            const contentFromPosition = message.content.slice(
                args.fromPosition
            );

            return {
                success: true,
                content: contentFromPosition,
                isComplete: !message.isStreaming,
                totalLength: message.content.length,
            };
        } catch (error) {
            console.error("Resume streaming error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    },
});

// Mark streaming as complete (backwards compatibility)
export const markStreamingComplete = action({
    args: {
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        try {
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                isStreaming: false,
            });

            return { success: true };
        } catch (error) {
            console.error("Mark streaming complete error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    },
});

// Helper function to extract citations from AI response (simplified)
function extractCitationsFromResponse(response: string): any[] {
    const citations: any[] = [];
    const citationRegex = /\[(\d+)\]\s*(.+?)(?=\[\d+\]|$)/g;
    let match;
    let citationNumber = 1;

    while ((match = citationRegex.exec(response)) !== null) {
        citations.push({
            number: citationNumber++,
            title: match[2].trim(),
            url: "",
            source: "AI Generated",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            citedText: match[0],
        });
    }

    return citations;
}
