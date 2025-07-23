"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

import { getProviderFromModel, PROVIDER_CONFIGS } from "./ai/config";
import { getUserApiKeys } from "./ai/helpers";
import { providerManager } from "./ai/providers";
import {
    fileManager,
    structuredOutputManager,
    imageGenerationManager,
    videoGenerationManager,
} from "./ai/generation";
import { performProviderWebSearch } from "./ai/websearch";

// AI response generation with simple resumable streaming
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
        referencedArtifacts: v.optional(v.array(v.string())), // Add this parameter
    },
    handler: async (ctx, args) => {
        try {
            // Initialize message as streaming with empty content
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: "", // Start with empty string to prevent duplication
                isStreaming: true,
            });

            // ENHANCED LOGGING: Log the message we're about to stream to
            const messageToStream = await ctx.runQuery(
                internal.aiHelpers.getMessage,
                {
                    messageId: args.messageId,
                }
            );
            console.log("🎯 STARTING STREAM FOR MESSAGE:", {
                messageId: args.messageId,
                hasVersions: !!messageToStream?.messageVersions?.length,
                activeVersionId: messageToStream?.messageVersions?.find(
                    (v: { isActive: boolean; versionId: string }) => v.isActive
                )?.versionId,
                timestamp: new Date().toISOString(),
            });

            // Get user API keys and chat history
            const userApiKeys = await getUserApiKeys(ctx);
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                {
                    chatId: args.chatId,
                    excludeMessageId: args.messageId, // CRITICAL FIX: Pass the AI message ID to exclude it and get proper history
                }
            );
            const lastUserMessage = messages
                .filter((m: any) => m.role === "user")
                .pop();
            const content = lastUserMessage?.content || "";
            let response = "";
            const metadata: any = {};

            // Process referenced artifacts by uploading them to provider-specific file APIs
            const artifactAttachments: any[] = [];
            if (
                args.referencedArtifacts &&
                args.referencedArtifacts.length > 0
            ) {
                const provider = getProviderFromModel(args.model);
                const config = PROVIDER_CONFIGS[provider];
                const userKey = userApiKeys[config.userKeyField];
                const client = providerManager.getClient(provider, userKey);

                console.log(
                    `🔗 Processing ${args.referencedArtifacts.length} referenced artifacts for ${provider}...`
                );

                for (const artifactId of args.referencedArtifacts) {
                    try {
                        // Get artifact from database
                        const artifact = await ctx.runQuery(
                            internal.artifacts.getArtifactInternal,
                            {
                                artifactId,
                            }
                        );

                        if (artifact) {
                            console.log(
                                `📋 Processing artifact: ${artifact.filename} (${artifact.language})`
                            );

                            // Upload artifact to provider's file API with caching
                            const uploadResult =
                                await fileManager.uploadArtifactToProvider(
                                    artifactId,
                                    provider,
                                    artifact,
                                    client,
                                    ctx
                                );

                            artifactAttachments.push({
                                type: "file",
                                fileId: uploadResult.fileId,
                                name: uploadResult.fileName,
                                mimeType: uploadResult.mimeType,
                                description: artifact.description,
                                artifactId: artifactId,
                                language: artifact.language,
                            });

                            console.log(
                                `✅ Artifact ${artifact.filename} uploaded to ${provider} as ${uploadResult.fileId}`
                            );
                        } else {
                            console.warn(
                                `⚠️ Referenced artifact not found: ${artifactId}`
                            );
                        }
                    } catch (error) {
                        console.error(
                            `Failed to upload artifact ${artifactId} to ${provider}:`,
                            error
                        );
                        // Continue with other artifacts even if one fails
                    }
                }

                console.log(
                    `📎 Successfully processed ${artifactAttachments.length}/${args.referencedArtifacts.length} artifacts`
                );
            }

            // Handle special commands (image, video, search, canvas) without streaming
            if (args.commands?.includes("/image")) {
                const imagePrompt = content.replace("/image", "").trim();
                if (!imagePrompt) {
                    response =
                        "Please provide a description for the image you'd like me to generate.";
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

                try {
                    // For image generation, use google or openai providers only
                    const provider = getProviderFromModel(args.model);
                    let imageProvider = provider;

                    // Force to valid image generation providers
                    if (provider !== "google" && provider !== "openai") {
                        imageProvider = "google"; // Default to google for image gen
                    }

                    const config = PROVIDER_CONFIGS[imageProvider];
                    const userKey = userApiKeys[config.userKeyField];
                    const client = providerManager.getClient(
                        imageProvider,
                        userKey
                    );

                    const imageUrl = await imageGenerationManager.generateImage(
                        imageProvider,
                        client,
                        imagePrompt,
                        { model: args.model },
                        ctx // Pass Convex context for file upload
                    );

                    // NO PREFILLED TEXT - just metadata
                    metadata.imagePrompt = imagePrompt;
                    metadata.generatedImageUrl = imageUrl;
                } catch (error) {
                    console.error("Image generation error:", error);
                    response = `Sorry, I couldn't generate that image: ${error instanceof Error ? error.message : String(error)}. Please try again later.`;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata,
                    isStreaming: false,
                });
                return;
            }

            if (args.commands?.includes("/video")) {
                const videoPrompt = content.replace("/video", "").trim();
                if (!videoPrompt) {
                    response =
                        "Please provide a description for the video you'd like me to generate.";
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

                try {
                    // Note: Video generation can take 2-5 minutes, so we inform the user
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content:
                                "🎬 Starting video generation... This may take a few minutes.",
                            isStreaming: true,
                        }
                    );

                    // For video generation, use current model (sora or veo-2)
                    const provider = getProviderFromModel(args.model);
                    let videoProvider = provider;

                    // Force to valid video generation providers only
                    if (provider !== "google" && provider !== "openai") {
                        videoProvider = "google"; // Default to google for video gen
                    }

                    const config = PROVIDER_CONFIGS[videoProvider];
                    const userKey = userApiKeys[config.userKeyField];
                    const client = providerManager.getClient(
                        videoProvider,
                        userKey
                    );

                    const videoData =
                        await videoGenerationManager.generateVideo(
                            videoProvider,
                            client,
                            videoPrompt,
                            { duration: 5, aspectRatio: "16:9" },
                            ctx // Pass Convex context for file upload
                        );

                    // NO PREFILLED TEXT - just metadata and loading completion
                    response = ""; // Empty response text
                    metadata.videoPrompt = videoPrompt;
                    metadata.generatedVideoUrl = videoData.videoUrl;
                    metadata.videoThumbnailUrl = videoData.thumbnailUrl;
                    metadata.videoDuration = videoData.duration;
                    metadata.videoResolution = videoData.resolution;
                } catch (error) {
                    console.error("Video generation error:", error);
                    response = `Sorry, I couldn't generate that video: ${error instanceof Error ? error.message : String(error)}. Video generation requires significant processing time and may not always succeed.`;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata,
                    isStreaming: false,
                });
                return;
            }

            // Handle /search and /canvas commands (can be combined)
            if (args.commands?.includes("/search")) {
                const searchQuery = content
                    .replace("/search", "")
                    .replace("/canvas", "")
                    .trim();
                try {
                    const provider = getProviderFromModel(args.model);
                    const config = PROVIDER_CONFIGS[provider];
                    const userKey = userApiKeys[config.userKeyField];
                    const client = providerManager.getClient(provider, userKey);

                    const searchData = await performProviderWebSearch(
                        searchQuery,
                        provider,
                        client,
                        userApiKeys
                    );

                    // searchData should contain { response: string, citations: array }
                    metadata.citations = searchData.citations;

                    // If also canvas command, we'll handle structured output
                    if (args.commands?.includes("/canvas")) {
                        // Canvas with search - create structured output with search context
                        const canvasSchema = {
                            type: "object",
                            properties: {
                                intro: {
                                    type: "string",
                                    description:
                                        "Brief introduction to the artifacts based on search results",
                                },
                                artifacts: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            filename: { type: "string" },
                                            language: { type: "string" },
                                            content: { type: "string" }, // ADDED CONTENT FIELD
                                            description: { type: "string" },
                                        },
                                        required: [
                                            "id",
                                            "filename",
                                            "language",
                                            "content",
                                        ], // ADDED CONTENT TO REQUIRED
                                    },
                                },
                                summary: {
                                    type: "string",
                                    description:
                                        "Summary of the created artifacts",
                                },
                            },
                            required: ["artifacts"],
                        };

                        // Enhanced prompt for canvas with search - include BOTH response AND citations
                        const enhancedPrompt = `User request: "${searchQuery}"

AI Response from search:
${searchData.response}

Search results context:
${searchData.citations
    .map(
        (citation: any) =>
            `[${citation.number}] ${citation.title}\n${citation.citedText}\nSource: ${citation.url}`
    )
    .join("\n\n")}

Based on the AI response and these search results, create artifacts (code files, documentation, etc.) that address the user's request. Include proper citations in your artifacts.`;

                        // Generate structured output (NON-STREAMING for canvas)
                        await ctx.runAction(
                            internal.ai.generateStructuredOutput,
                            {
                                chatId: args.chatId,
                                messageId: args.messageId,
                                model: args.model,
                                schema: canvasSchema,
                                userApiKey: userKey,
                                enhancedPrompt,
                                metadata: metadata,
                            }
                        );
                        return;
                    } else {
                        // Search only - use the AI response from performProviderWebSearch directly (NO STREAMING, NO RE-CALLING AI)
                        await ctx.runMutation(
                            internal.aiHelpers.updateMessageContent,
                            {
                                messageId: args.messageId,
                                content: searchData.response, // Use the AI response directly
                                metadata,
                                isStreaming: false,
                            }
                        );
                        return;
                    }
                } catch (error) {
                    console.error("Web search error:", error);
                    response =
                        "Sorry, I couldn't perform the web search at the moment. Please try again later.";
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

            if (
                args.commands?.includes("/canvas") &&
                !args.commands?.includes("/search")
            ) {
                // Canvas without search
                const _canvasContent = content.replace("/canvas", "").trim();
                const canvasSchema = {
                    type: "object",
                    properties: {
                        intro: {
                            type: "string",
                            description: "Brief introduction to the artifact",
                        },
                        artifacts: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    filename: { type: "string" },
                                    language: { type: "string" },
                                    content: { type: "string" },
                                    description: { type: "string" },
                                },
                                required: [
                                    "id",
                                    "filename",
                                    "language",
                                    "content",
                                ],
                            },
                        },
                        summary: {
                            type: "string",
                            description: "Summary of the created artifacts",
                        },
                    },
                    required: ["artifacts"],
                };

                try {
                    const provider = getProviderFromModel(args.model);
                    const config = PROVIDER_CONFIGS[provider];
                    const userKey = userApiKeys[config.userKeyField];

                    // Generate structured output (NON-STREAMING for canvas)
                    await ctx.runAction(internal.ai.generateStructuredOutput, {
                        chatId: args.chatId,
                        messageId: args.messageId,
                        model: args.model,
                        schema: canvasSchema,
                        userApiKey: userKey,
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

            // Normal AI response - FIXED streaming logic
            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey = userApiKeys[config.userKeyField];

            console.log(`Using provider: ${provider} for model: ${args.model}`);

            // Process ALL attachments (regular + artifacts) for the selected provider
            let allProcessedAttachments = [...(artifactAttachments || [])];

            if (args.attachments && args.attachments.length > 0) {
                const client = providerManager.getClient(provider, userKey);
                const regularAttachments = await processAttachmentsForProvider(
                    args.attachments,
                    provider,
                    client,
                    ctx
                );
                allProcessedAttachments = [
                    ...allProcessedAttachments,
                    ...regularAttachments,
                ];
            }

            const openaiMessages = messages.map((m: any) => ({
                role: m.role,
                content: m.content,
            }));

            console.log("ALL MESSAGES:", openaiMessages);

            // Stream response and accumulate content properly - CRITICAL FIX
            const stream = await providerManager.callProvider(
                provider,
                args.model,
                openaiMessages,
                {
                    apiKey: userKey,
                    stream: true,
                    attachments: allProcessedAttachments,
                }
            );

            let accumulatedResponse = ""; // Start with empty string - CRITICAL FIX

            for await (const chunk of stream) {
                const contentChunk = chunk.choices[0]?.delta?.content || "";
                console.log("content chunk: ", contentChunk);
                if (contentChunk) {
                    accumulatedResponse += contentChunk; // Only add new chunk content

                    // Update message with full accumulated content (no duplication)
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: accumulatedResponse, // Send complete accumulated content
                            isStreaming: true,
                        }
                    );
                }

                if (chunk.choices[0]?.finish_reason) {
                    break;
                }
            }

            // Mark streaming as complete - CRITICAL FIX for stop button
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: accumulatedResponse,
                metadata,
                isStreaming: false, // CRITICAL: Set to false when streaming is done
            });
        } catch (error) {
            console.error("Streaming error:", error);
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: `Sorry, I encountered an error while generating a response: ${error instanceof Error ? error.message : String(error)}. Please try again.`,
                isStreaming: false,
            });
        }
    },
});

// Simple resume streaming action
export const resumeStreaming: any = action({
    args: {
        messageId: v.id("messages"),
        fromPosition: v.number(),
    },
    handler: async (ctx, args) => {
        try {
            // Get the message
            const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
                messageId: args.messageId,
            });

            if (!message) {
                throw new Error("Message not found");
            }

            // Return the content from the specified position
            const contentFromPosition = message.content.slice(
                args.fromPosition
            );

            return {
                content: contentFromPosition,
                totalLength: message.content.length,
                isComplete: !message.isStreaming,
            };
        } catch (error) {
            console.error("Resume streaming error:", error);
            throw new Error("Failed to resume streaming");
        }
    },
});

// Action for frontend to mark streaming as complete
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
            throw new Error("Failed to mark streaming complete");
        }
    },
});

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
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        try {
            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey =
                args.userApiKey ||
                (await getUserApiKeys(ctx))[config.userKeyField];
            const client = providerManager.getClient(provider, userKey);

            // Get messages for context
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                {
                    chatId: args.chatId,
                    excludeMessageId: args.messageId, // CRITICAL FIX: Pass the AI message ID to exclude it and get proper history
                }
            );

            // Use enhanced prompt if provided, otherwise use the last user message
            const promptToUse =
                args.enhancedPrompt ||
                messages.filter((m: any) => m.role === "user").pop()?.content ||
                "";

            const structuredMessages = [
                ...messages.slice(0, -1),
                { role: "user", content: promptToUse },
            ];

            // Generate structured output (NON-STREAMING for canvas)
            let result;
            switch (provider) {
                case "openai":
                case "openrouter":
                case "deepseek":
                    result =
                        await structuredOutputManager.generateOpenAIStructuredOutput(
                            client,
                            args.model,
                            structuredMessages,
                            args.schema,
                            { stream: false, attachments: args.attachments }
                        );
                    break;
                case "google":
                    result =
                        await structuredOutputManager.generateGoogleStructuredOutput(
                            client,
                            args.model,
                            structuredMessages,
                            args.schema,
                            { stream: false, attachments: args.attachments }
                        );
                    break;
                case "anthropic":
                    result =
                        await structuredOutputManager.generateAnthropicStructuredOutput(
                            client,
                            args.model,
                            structuredMessages,
                            args.schema,
                            { stream: false, attachments: args.attachments }
                        );
                    break;
                default:
                    throw new Error(
                        `Structured output not supported for provider: ${provider}`
                    );
            }

            // Parse the structured output and create artifacts
            let parsedOutput;
            try {
                if (provider === "anthropic") {
                    // For Anthropic, the structured output is in tool use
                    const toolUses =
                        result.content?.filter(
                            (c: any) => c.type === "tool_use"
                        ) || [];
                    if (toolUses.length > 0) {
                        parsedOutput = toolUses[0].input;
                    }
                } else if (provider === "google") {
                    // For Google, parse the text response as JSON
                    parsedOutput = JSON.parse(result.text || "{}");
                } else {
                    // For OpenAI Responses API, get from structured output
                    const textOutputs =
                        result.output?.filter(
                            (o: any) => o.type === "message"
                        ) || [];
                    if (textOutputs.length > 0) {
                        parsedOutput = JSON.parse(
                            textOutputs[0].content || "{}"
                        );
                    }
                }
            } catch (error) {
                console.error("Failed to parse structured output:", error);
                throw new Error("Failed to parse structured response");
            }

            if (!parsedOutput || !parsedOutput.artifacts) {
                throw new Error("No artifacts generated");
            }

            // Build response with artifacts - NO PREFILLED TEXT
            let responseText = parsedOutput.intro || "";
            if (parsedOutput.artifacts && parsedOutput.artifacts.length > 0) {
                // Save artifacts to database
                const artifactMetadata = [];
                for (const artifact of parsedOutput.artifacts) {
                    const artifactId = await ctx.runMutation(
                        internal.artifacts.createArtifactInternal,
                        {
                            messageId: args.messageId,
                            chatId: args.chatId,
                            userId,
                            artifactId: artifact.id,
                            filename: artifact.filename,
                            language: artifact.language,
                            content: artifact.content,
                            description: artifact.description,
                        }
                    );

                    artifactMetadata.push({
                        id: artifact.id,
                        filename: artifact.filename,
                        language: artifact.language,
                        description: artifact.description,
                    });
                }

                // Update metadata with artifacts - store just artifact IDs like sharedChats pattern
                const finalMetadata = {
                    ...(args.metadata || {}),
                    structuredOutput: true,
                    canvasIntro: parsedOutput.intro,
                    canvasSummary: parsedOutput.summary,
                    artifacts: artifactMetadata.map(
                        (artifact: any) => artifact._id
                    ), // Store artifact _ids
                };

                if (parsedOutput.summary) {
                    responseText +=
                        (responseText ? "\n\n" : "") + parsedOutput.summary;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: responseText,
                    metadata: finalMetadata,
                    isStreaming: false,
                });
            }
        } catch (error) {
            console.error(
                "Structured output generation error:",
                (error as any).message || error
            );
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content:
                    "Sorry, I couldn't generate the structured response. Please try again.",
                isStreaming: false,
            });
        }
    },
});

// Enhanced AI generation with user preferences and response modes
export const generateResponse = action({
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
        systemPrompt: v.optional(v.string()),
        responseMode: v.optional(v.string()),
        topP: v.optional(v.number()),
        frequencyPenalty: v.optional(v.number()),
        presencePenalty: v.optional(v.number()),
        userId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        // Get user preferences if userId is provided
        let userPreferences = null;
        if (args.userId) {
            userPreferences = await ctx.runQuery(internal.preferences.getUserPreferencesInternal, {
                userId: args.userId
            });
        }

        // Apply response mode modifications to system prompt
        let systemPrompt = args.systemPrompt || userPreferences?.aiSettings?.systemPrompt || "";
        const responseMode = args.responseMode || userPreferences?.aiSettings?.responseMode || "balanced";

        // Response mode prompts
        const responseModeInstructions = {
            balanced: "Provide well-balanced responses that are informative yet accessible.",
            concise: "Keep your responses brief and to the point. Focus on the essential information.",
            detailed: "Provide comprehensive, thorough responses with detailed explanations and examples.",
            creative: "Be creative and imaginative in your responses. Think outside the box and offer unique perspectives.",
            analytical: "Focus on data-driven, logical analysis. Provide evidence-based responses with clear reasoning.",
            friendly: "Use a warm, conversational tone. Be approachable and personable in your responses.",
            professional: "Maintain a formal, business-appropriate tone. Be precise and professional."
        };

        if (responseMode !== "balanced") {
            const modeInstruction = responseModeInstructions[responseMode as keyof typeof responseModeInstructions];
            if (modeInstruction) {
                systemPrompt = systemPrompt 
                    ? `${systemPrompt}\n\nResponse Style: ${modeInstruction}`
                    : `Response Style: ${modeInstruction}`;
            }
        }

        // Build enhanced messages array with system prompt
        const enhancedMessages = systemPrompt 
            ? [{ role: "system" as const, content: systemPrompt }, ...args.messages]
            : args.messages;

        // Apply AI settings with user preferences as defaults
        const temperature = args.temperature ?? userPreferences?.aiSettings?.temperature ?? 0.7;
        const maxTokens = args.maxTokens ?? userPreferences?.aiSettings?.maxTokens;
        const topP = args.topP ?? userPreferences?.aiSettings?.topP ?? 0.9;
        const frequencyPenalty = args.frequencyPenalty ?? userPreferences?.aiSettings?.frequencyPenalty ?? 0;
        const presencePenalty = args.presencePenalty ?? userPreferences?.aiSettings?.presencePenalty ?? 0;

        // Call the original AI generation with enhanced parameters
        const result = await ctx.runAction(internal.ai.generation.generateAIResponse, {
            messages: enhancedMessages,
            model: args.model,
            temperature,
            maxTokens,
            topP,
            frequencyPenalty,
            presencePenalty,
        });

        return result;
    },
});

// Helper function for processing attachments for provider
async function processAttachmentsForProvider(
    attachments: any[],
    provider: string,
    client: any,
    ctx: any
): Promise<any[]> {
    if (!attachments || attachments.length === 0) return [];

    const processedAttachments = [];
    for (const attachment of attachments) {
        try {
            const processed = await fileManager.processRegularAttachment(
                attachment,
                provider,
                client,
                ctx
            );
            processedAttachments.push(processed);
        } catch (error) {
            console.error(
                `Failed to process attachment ${attachment.name} for provider ${provider}:`,
                error
            );
        }
    }
    return processedAttachments;
}
