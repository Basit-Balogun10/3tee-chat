"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import {
    generateText,
    streamText,
    generateObject,
    streamObject,
    createUIMessageStream,
    createUIMessageStreamResponse,
} from "ai";
import { z } from "zod";

import {
    getProviderFromModel,
    PROVIDER_CONFIGS,
    providerManager,
} from "./ai/providers";
import {
    getUserApiKeys,
    processAttachmentForAISDK,
    processLibraryItemForAISDK,
    buildModelMessages,
    attachmentObjectsToCanonicalParts,
} from "./ai/helpers";
import {
    imageGenerationManager,
    videoGenerationManager,
} from "./ai/generation";

// AI response generation with Vercel AI SDK - Updated for HTTP endpoints
export const generateStreamingResponse = internalAction({
    args: {
        chatId: v.id("chats"),
        retryMessageId: v.optional(
            v.id("messages") // Optional messageId for existing messages
        ),
        model: v.string(),
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
        commands: v.optional(v.array(v.string())),
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
    returns: v.any(),
    handler: async (ctx, args): Promise<Response> => {
        const startTime = Date.now();

        try {
            console.log("🚀 STARTING AI SDK STREAMING GENERATION:", {
                chatId: args.chatId,
                model: args.model,
                provider: getProviderFromModel(args.model),
                timestamp: new Date().toISOString(),
            });

            // Get chat and create assistant message
            const chat: any = await ctx.runQuery(
                internal.chats.getChatInternal,
                {
                    chatId: args.chatId,
                }
            );
            if (!chat) throw new Error("Chat not found");

            // Create assistant message for streaming
            const messageId: any =
                args.retryMessageId ||
                (await ctx.runMutation(internal.messages.addMessageInternal, {
                    chatId: args.chatId,
                    role: "assistant",
                    content: "",
                    isStreaming: true,
                }));

            // Get combined AI settings (per-chat + global preferences)
            const aiSettings: any = await ctx.runQuery(
                internal.aiHelpers.getCombinedAISettings,
                {
                    chatId: args.chatId,
                    userId: chat.userId,
                }
            );

            // Get user API keys and chat history
            const userApiKeys = await getUserApiKeys(ctx);
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                {
                    chatId: args.chatId,
                    excludeMessageId: messageId,
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

            // Process attachments and library items
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
                            messageId: messageId,
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

                    const imageResponseTime = Date.now() - startTime;

                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: messageId,
                            content: response,
                            metadata,
                            isStreaming: false,
                            responseMetadata: {
                                responseTime: imageResponseTime,
                                model: args.model,
                                provider,
                                finishReason: "image_generated",
                            },
                        }
                    );

                    // Return streaming response for HTTP endpoint
                    return new Response(response, {
                        status: 200,
                        headers: {
                            "Content-Type": "text/plain",
                            "Access-Control-Allow-Origin": "*",
                        },
                    });
                } catch (error) {
                    console.error("Image generation error:", error);
                    response =
                        "Sorry, I couldn't generate the image. Please try again.";
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: messageId,
                            content: response,
                            isStreaming: false,
                        }
                    );
                    return new Response(response, {
                        status: 500,
                        headers: { "Content-Type": "text/plain" },
                    });
                }
            }

            // Handle video generation (can be combined with search)
            if (isVideoGeneration) {
                try {
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: messageId,
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

                    const videoResponseTime = Date.now() - startTime;

                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: messageId,
                            content: response,
                            metadata,
                            isStreaming: false,
                            responseMetadata: {
                                responseTime: videoResponseTime,
                                model: args.model,
                                provider,
                                finishReason: "video_generated",
                            },
                        }
                    );

                    return new Response(response, {
                        status: 200,
                        headers: {
                            "Content-Type": "text/plain",
                            "Access-Control-Allow-Origin": "*",
                        },
                    });
                } catch (error) {
                    console.error("Video generation error:", error);
                    response =
                        "Sorry, I couldn't generate the video. Please try again.";
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: messageId,
                            content: response,
                            isStreaming: false,
                        }
                    );
                    return new Response(response, {
                        status: 500,
                        headers: { "Content-Type": "text/plain" },
                    });
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
                        messageId: messageId,
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

                    // Get the updated message content
                    const updatedMessage: any = await ctx.runQuery(
                        internal.messages.getMessageInternal,
                        {
                            messageId: messageId,
                        }
                    );

                    return new Response(
                        updatedMessage?.content || "Canvas generated",
                        {
                            status: 200,
                            headers: {
                                "Content-Type": "text/plain",
                                "Access-Control-Allow-Origin": "*",
                            },
                        }
                    );
                } catch (error) {
                    console.error("Canvas generation error:", error);
                    response =
                        "Sorry, I couldn't generate the canvas artifacts. Please try again.";
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: messageId,
                            content: response,
                            isStreaming: false,
                        }
                    );
                    return new Response(response, {
                        status: 500,
                        headers: { "Content-Type": "text/plain" },
                    });
                }
            }

            // Normal AI response using AI SDK streaming with custom settings
            const modelInstance = providerManager.getModel(
                provider,
                args.model,
                userKey
            );

            // Convert messages to AI SDK format (structured pipeline)
            const systemPromptMsg =
                aiSettings.systemPrompt && aiSettings.systemPrompt.trim()
                    ? [
                          {
                              _id: "system-prompt",
                              role: "system" as const,
                              content: aiSettings.systemPrompt,
                          },
                      ]
                    : [];
            const attachmentParts = attachmentObjectsToCanonicalParts(
                allProcessedAttachments
            );
            const convertedMessages = buildModelMessages(
                [...systemPromptMsg, ...messages],
                {
                    userAttachmentParts: attachmentParts,
                }
            );

            console.log("🔄 Starting AI SDK streaming with custom settings:", {
                temperature: aiSettings.temperature,
                maxTokens: aiSettings.maxTokens,
                topP: aiSettings.topP,
                frequencyPenalty: aiSettings.frequencyPenalty,
                presencePenalty: aiSettings.presencePenalty,
                hasSystemPrompt: !!aiSettings.systemPrompt,
            });

            // Use AI SDK's streamText for streaming response with custom settings
            const result: any = streamText({
                model: modelInstance,
                messages: convertedMessages,
                temperature: aiSettings.temperature,
                // use maxOutputTokens per AI SDK v5
                maxOutputTokens: aiSettings.maxTokens,
                topP: aiSettings.topP,
                frequencyPenalty: aiSettings.frequencyPenalty,
                presencePenalty: aiSettings.presencePenalty,
                onFinish: async (result) => {
                    // Finalize the response with metadata tracking
                    const responseTime = Date.now() - startTime;
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: messageId,
                            content: result.text,
                            metadata,
                            isStreaming: false,
                            responseMetadata: {
                                usage: result.usage, // store raw usage
                                finishReason: result.finishReason,
                                responseTime,
                                model: args.model,
                                provider,
                                requestId: crypto.randomUUID(),
                            },
                        }
                    );

                    console.log("✅ AI SDK STREAMING COMPLETE:", {
                        chatId: args.chatId,
                        messageId: messageId,
                        responseLength: result.text.length,
                        responseTime,
                        usage: result.usage,
                        finishReason: result.finishReason,
                        customSettings: {
                            temperature: aiSettings.temperature,
                            maxTokens: aiSettings.maxTokens,
                        },
                        timestamp: new Date().toISOString(),
                    });
                },
            });

            // Return UI message stream response for HTTP endpoint (AI SDK v5)
            return result.toUIMessageStreamResponse({
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers":
                        "Content-Type, Authorization",
                },
                sendReasoning: true,
            });
        } catch (error) {
            console.error("❌ AI SDK STREAMING ERROR:", error);

            const errorMessage = `Error generating response: ${
                error instanceof Error ? error.message : String(error)
            }`;

            return new Response(errorMessage, {
                status: 500,
                headers: {
                    "Content-Type": "text/plain",
                    "Access-Control-Allow-Origin": "*",
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
    returns: v.null(),
    handler: async (ctx, args) => {
        const startTime = Date.now();

        try {
            console.log(
                "🎯 GENERATING STRUCTURED OUTPUT WITH AI SDK STREAMING:",
                {
                    model: args.model,
                    chatId: args.chatId,
                    messageId: args.messageId,
                    hasSchema: !!args.schema,
                    hasAISettings: !!args.aiSettings,
                    timestamp: new Date().toISOString(),
                }
            );

            // Initial streaming indicator
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: "🎨 Generating canvas artifacts...",
                isStreaming: true,
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

            // Use AI SDK's streamObject for streaming structured output
            const result = streamObject({
                model: modelInstance,
                messages: convertedMessages,
                schema: args.schema,
                temperature: settings.temperature || 0.7,
                maxOutputTokens: settings.maxTokens,
                topP: settings.topP || 0.9,
                frequencyPenalty: settings.frequencyPenalty || 0,
                presencePenalty: settings.presencePenalty || 0,
            });

            let partialObject: any = {};
            let isProcessing = false;

            // Stream partial updates
            for await (const partialResult of result.partialObjectStream) {
                partialObject = partialResult;

                // Update with streaming status
                if (!isProcessing && partialObject.intro) {
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: `${partialObject.intro}\n\n⚡ Creating artifacts...`,
                            isStreaming: true,
                        }
                    );
                    isProcessing = true;
                }
            }

            // Get final result - await the completion of streamObject
            const finalResult = await result;
            const { object, usage } = finalResult;
            const responseTime = Date.now() - startTime;

            console.log("📦 STRUCTURED OUTPUT STREAMING COMPLETE:", {
                objectType: typeof object,
                usage,
                responseTime,
                timestamp: new Date().toISOString(),
            });

            // Process canvas artifacts if applicable
            if (object && typeof object === "object" && "artifacts" in object) {
                const canvasResult = object as any;
                const intro = canvasResult.intro || "";
                const summary = canvasResult.summary || "";
                const artifacts = Array.isArray(canvasResult.artifacts)
                    ? canvasResult.artifacts
                    : [];

                console.log(
                    `🛠️ Creating ${artifacts.length} artifacts in database...`
                );

                // Create artifacts in the database
                const createdArtifactIds = [];
                for (const artifact of artifacts) {
                    // Get chat to access userId
                    const chat = await ctx.runQuery(
                        internal.chats.getChatInternal,
                        {
                            chatId: args.chatId,
                        }
                    );

                    const artifactId = await ctx.runMutation(
                        internal.artifacts.createArtifactInternal,
                        {
                            chatId: args.chatId,
                            messageId: args.messageId,
                            userId: chat.userId,
                            artifactId: artifact.id, // Use the AI-generated ID
                            content: artifact.content,
                            filename: artifact.filename,
                            language: artifact.language,
                            description: artifact.description,
                        }
                    );
                    createdArtifactIds.push(artifactId);
                }

                // Format response content
                const response = `${intro}\n\n${artifacts
                    .map(
                        (a: any, i: number) =>
                            `**Artifact ${i + 1}: ${a.filename}**\n${a.description}`
                    )
                    .join("\n\n")}\n\n${summary}`;

                // Update with final content and proper metadata
                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata: {
                        ...args.metadata,
                        artifactCount: artifacts.length,
                        structuredOutput: true,
                        canvasIntro: intro,
                        canvasSummary: summary,
                        artifacts: createdArtifactIds, // Store artifact IDs
                    },
                    isStreaming: false,
                    responseMetadata: {
                        usage,
                        finishReason: "structured_output_complete",
                        responseTime,
                        model: args.model,
                        provider,
                        requestId: crypto.randomUUID(),
                    },
                });

                console.log(
                    "✅ Canvas artifacts created and metadata stored:",
                    {
                        artifactCount: artifacts.length,
                        createdArtifactIds,
                        responseTime,
                    }
                );
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
                        usage,
                        finishReason: "structured_output_complete",
                        responseTime,
                        model: args.model,
                        provider,
                        requestId: crypto.randomUUID(),
                    },
                });
            }
        } catch (error) {
            console.error("❌ STRUCTURED OUTPUT STREAMING ERROR:", error);
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
        return null;
    },
});

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
    returns: v.any(),
    handler: async (ctx, args): Promise<Response> => {
        const startTime = Date.now();

        try {
            console.log("🧠 STARTING MULTI-AI GENERATION WITH AI SDK:", {
                chatId: args.chatId,
                messageId: args.messageId,
                models: args.models,
                commands: args.commands,
                responseIds: args.responseIds,
                timestamp: new Date().toISOString(),
            });

            const chat: any = await ctx.runQuery(
                internal.chats.getChatInternal,
                {
                    chatId: args.chatId,
                }
            );

            if (!chat) {
                throw new Error("Chat not found");
            }

            const aiSettings: any = await ctx.runQuery(
                internal.aiHelpers.getCombinedAISettings,
                {
                    chatId: args.chatId,
                    userId: chat.userId,
                }
            );

            const userApiKeys = await getUserApiKeys(ctx);
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                {
                    chatId: args.chatId,
                    excludeMessageId: args.messageId,
                }
            );

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

            const hasCanvas = args.commands?.includes("canvas");
            const hasImageGen = args.commands?.includes("image");
            const hasVideoGen = args.commands?.includes("video");
            const hasSearch = args.commands?.includes("search");

            const lastUserMessage = messages
                .filter((m: any) => m.role === "user")
                .pop();
            const lastUserContent = lastUserMessage?.content || "";

            const responseState = args.models.map((model, index) => ({
                responseId: args.responseIds[index],
                model,
                content: "",
                isPrimary: index === 0,
                isDeleted: false,
                metadata: {} as any,
                timestamp: Date.now(),
            }));

            await ctx.runMutation(api.messages.initializeMultiAIMessage, {
                messageId: args.messageId,
                selectedModels: args.models,
                responseIds: args.responseIds,
            });

            const buildMetadataPayload = () => ({
                multiAIResponses: {
                    selectedModels: args.models,
                    responses: responseState.map((response) => ({
                        responseId: response.responseId,
                        model: response.model,
                        content: response.content,
                        timestamp: response.timestamp,
                        isPrimary: response.isPrimary,
                        isDeleted: response.isDeleted,
                        metadata: response.metadata,
                    })),
                    primaryResponseId: responseState.find((r) => r.isPrimary)
                        ?.responseId,
                },
            });

            const attachmentParts = attachmentObjectsToCanonicalParts(
                allProcessedAttachments
            );
            const systemPromptMsg =
                aiSettings.systemPrompt && aiSettings.systemPrompt.trim()
                    ? [
                          {
                              _id: "system-prompt",
                              role: "system" as const,
                              content: aiSettings.systemPrompt,
                          },
                      ]
                    : [];
            const convertedMessages = buildModelMessages(
                [...systemPromptMsg, ...messages],
                {
                    userAttachmentParts: attachmentParts,
                }
            );

            const stream = createUIMessageStream({
                generateId: () => args.messageId,
                execute: async ({ writer }) => {
                    const sendMetadata = () => {
                        writer.write({
                            type: "message-metadata",
                            messageMetadata: buildMetadataPayload(),
                        });
                    };

                    writer.write({
                        type: "start",
                        messageMetadata: buildMetadataPayload(),
                    });

                    const primaryResponse = responseState[0];
                    writer.write({
                        type: "text-start",
                        id: primaryResponse.responseId,
                    });

                    const processModel = async (
                        model: string,
                        index: number
                    ) => {
                        const responseId = responseState[index].responseId;
                        const provider = getProviderFromModel(model);
                        const config = PROVIDER_CONFIGS[provider];
                        const userKey =
                            userApiKeys[
                                config.userKeyField as keyof typeof userApiKeys
                            ];

                        const updateStateAndPersist = async (
                            content: string,
                            metadata: any
                        ) => {
                            responseState[index].content = content;
                            responseState[index].metadata = metadata;
                            responseState[index].timestamp = Date.now();

                            await ctx.runMutation(
                                api.messages.updateMultiAIResponse,
                                {
                                    messageId: args.messageId,
                                    responseId,
                                    content,
                                    isComplete: true,
                                    metadata,
                                }
                            );

                            sendMetadata();

                            if (index === 0) {
                                writer.write({
                                    type: "text-delta",
                                    id: responseId,
                                    delta: content,
                                });
                            }
                        };

                        const handleCommandError = async (error: unknown) => {
                            const errorMessage =
                                error instanceof Error
                                    ? error.message
                                    : String(error);

                            await updateStateAndPersist(
                                `Error generating response: ${errorMessage}`,
                                { provider, model, error: true }
                            );
                        };

                        try {
                            if (
                                hasImageGen &&
                                (provider === "openai" || provider === "google")
                            ) {
                                const imageUrl =
                                    await imageGenerationManager.generateImage(
                                        provider,
                                        lastUserContent,
                                        { size: "1024x1024" },
                                        ctx
                                    );

                                const responseText = `Here's your generated image:\n\n![Generated Image](${imageUrl})`;

                                await updateStateAndPersist(responseText, {
                                    provider,
                                    model,
                                    command: "image",
                                    imagePrompt: lastUserContent,
                                    generatedImageUrl: imageUrl,
                                });
                                return;
                            }

                            if (
                                hasVideoGen &&
                                (provider === "google" || provider === "openai")
                            ) {
                                const videoData =
                                    await videoGenerationManager.generateVideo(
                                        provider === "google"
                                            ? provider
                                            : "google",
                                        lastUserContent,
                                        { duration: 5, aspectRatio: "16:9" },
                                        ctx
                                    );

                                const responseText = videoData.videoUrl
                                    ? `Here's your generated video:\n\n[Generated Video](${videoData.videoUrl})`
                                    : videoData.error ||
                                      "Video generation failed";

                                await updateStateAndPersist(responseText, {
                                    provider,
                                    model,
                                    command: "video",
                                    videoPrompt: lastUserContent,
                                    generatedVideoUrl: videoData.videoUrl,
                                    videoThumbnailUrl: videoData.thumbnailUrl,
                                });
                                return;
                            }

                            if (hasCanvas) {
                                const canvasSchema = z.object({
                                    intro: z
                                        .string()
                                        .describe(
                                            "Brief introduction to the created content"
                                        ),
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
                                        .describe(
                                            "Summary of the created artifacts"
                                        ),
                                });

                                let enhancedPrompt = lastUserContent;
                                if (hasSearch) {
                                    enhancedPrompt = `${lastUserContent}\n\nNote: Use web search to find current information if needed for creating accurate and up-to-date artifacts.`;
                                }

                                const convertedCanvasMessages = [
                                    ...messages.slice(0, -1).map((m: any) => ({
                                        role: m.role,
                                        content: m.content,
                                    })),
                                    {
                                        role: "user" as const,
                                        content: enhancedPrompt,
                                    },
                                ];

                                const modelInstance = providerManager.getModel(
                                    provider,
                                    model,
                                    userKey
                                );

                                const result = await generateObject({
                                    model: modelInstance,
                                    messages: convertedCanvasMessages,
                                    schema: canvasSchema,
                                    temperature: 0.7,
                                });

                                const parsedOutput = result.object;

                                if (!parsedOutput || !parsedOutput.artifacts) {
                                    throw new Error("No artifacts generated");
                                }

                                const artifacts = parsedOutput.artifacts;
                                const createdArtifactIds: string[] = [];

                                for (const artifact of artifacts) {
                                    const artifactId = await ctx.runMutation(
                                        internal.artifacts
                                            .createArtifactInternal,
                                        {
                                            messageId: args.messageId,
                                            chatId: args.chatId,
                                            userId: chat.userId,
                                            artifactId: artifact.id,
                                            filename: artifact.filename,
                                            language: artifact.language,
                                            content: artifact.content,
                                            description: artifact.description,
                                        }
                                    );
                                    createdArtifactIds.push(artifactId);
                                }

                                const intro = parsedOutput.intro || "";
                                const summary = parsedOutput.summary || "";

                                const responseText = `${intro}\n\n${artifacts
                                    .map(
                                        (a: any, i: number) =>
                                            `**Artifact ${i + 1}: ${a.filename}**\n${a.description}`
                                    )
                                    .join("\n\n")}\n\n${summary}`;

                                await updateStateAndPersist(responseText, {
                                    provider,
                                    model,
                                    command: "canvas",
                                    structuredOutput: true,
                                    canvasIntro: intro,
                                    canvasSummary: summary,
                                    artifacts: createdArtifactIds,
                                });
                                return;
                            }

                            const modelInstance = providerManager.getModel(
                                provider,
                                model,
                                userKey
                            );

                            const textResult = await generateText({
                                model: modelInstance,
                                messages: convertedMessages,
                                temperature: aiSettings.temperature,
                                maxOutputTokens: aiSettings.maxTokens,
                                topP: aiSettings.topP,
                                frequencyPenalty: aiSettings.frequencyPenalty,
                                presencePenalty: aiSettings.presencePenalty,
                            });

                            await updateStateAndPersist(textResult.text, {
                                provider,
                                model,
                                finishReason: textResult.finishReason,
                                usage: textResult.usage,
                                commands: args.commands,
                            });
                        } catch (error) {
                            console.error(
                                `❌ FAILED AI SDK RESPONSE FOR ${model}:`,
                                {
                                    responseId,
                                    error:
                                        error instanceof Error
                                            ? error.message
                                            : String(error),
                                    timestamp: new Date().toISOString(),
                                }
                            );
                            await handleCommandError(error);
                        }
                    };

                    const tasks = args.models.map((model, index) =>
                        processModel(model, index)
                    );

                    await Promise.all(tasks);

                    writer.write({
                        type: "text-end",
                        id: primaryResponse.responseId,
                    });

                    sendMetadata();

                    writer.write({
                        type: "finish",
                        messageMetadata: buildMetadataPayload(),
                    });

                    console.log(
                        "🎉 MULTI-AI GENERATION COMPLETE WITH AI SDK:",
                        {
                            chatId: args.chatId,
                            messageId: args.messageId,
                            completedModels: args.models.length,
                            commands: args.commands,
                            responseTime: Date.now() - startTime,
                            timestamp: new Date().toISOString(),
                        }
                    );
                },
            });

            return createUIMessageStreamResponse({
                stream,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers":
                        "Content-Type, Authorization",
                },
            });
        } catch (error) {
            console.error("❌ MULTI-AI STREAMING ERROR:", error);

            const errorMessage = `Error generating multi-model responses: ${
                error instanceof Error ? error.message : String(error)
            }`;

            return new Response(errorMessage, {
                status: 500,
                headers: {
                    "Content-Type": "text/plain",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }
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
