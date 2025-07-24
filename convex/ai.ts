"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import {
    generateText,
    streamText,
    generateObject,
} from "ai";
import { z } from "zod";

import { getProviderFromModel, PROVIDER_CONFIGS, providerManager, type ProviderName } from "./ai/providers";
import { getUserApiKeys, processAttachmentForAISDK, formatMessagesForAISDK } from "./ai/helpers";
import {
    fileManager,
    imageGenerationManager,
    videoGenerationManager,
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
        referencedArtifacts: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        try {
            // Initialize message as streaming with empty content
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: "",
                isStreaming: true,
            });

            console.log("🎯 STARTING AI SDK GENERATION:", {
                messageId: args.messageId,
                model: args.model,
                provider: getProviderFromModel(args.model),
                timestamp: new Date().toISOString(),
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
            const userKey = userApiKeys[config.userKeyField as keyof typeof userApiKeys];

            console.log(`🚀 Using AI SDK with provider: ${provider} for model: ${args.model}`);

            // Process referenced artifacts for provider-specific file APIs
            const artifactAttachments: any[] = [];
            if (args.referencedArtifacts && args.referencedArtifacts.length > 0) {
                console.log(`🔗 Processing ${args.referencedArtifacts.length} referenced artifacts...`);

                for (const artifactId of args.referencedArtifacts) {
                    try {
                        const artifact = await ctx.runQuery(
                            internal.artifacts.getArtifactInternal,
                            { artifactId }
                        );

                        if (artifact) {
                            const uploadResult = await fileManager.uploadArtifactToProvider(
                                artifactId,
                                provider,
                                artifact,
                                null, // Will be handled by AI SDK provider
                                ctx
                            );

                            artifactAttachments.push({
                                type: "file",
                                name: uploadResult.fileName,
                                data: artifact.content,
                                mimeType: uploadResult.mimeType,
                            });
                        }
                    } catch (error) {
                        console.error(`Failed to process artifact ${artifactId}:`, error);
                    }
                }
            }

            // Handle special commands first
            if (args.commands?.includes("/image")) {
                const imagePrompt = content.replace("/image", "").trim();
                if (!imagePrompt) {
                    response = "Please provide a description for the image you'd like me to generate.";
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: response,
                        isStreaming: false,
                    });
                    return;
                }

                try {
                    // Use existing image generation system
                    const imageUrl = await imageGenerationManager.generateImage(
                        provider === "google" || provider === "openai" ? provider : "google",
                        null, // AI SDK will handle the client
                        imagePrompt,
                        { model: args.model },
                        ctx
                    );

                    metadata.imagePrompt = imagePrompt;
                    metadata.generatedImageUrl = imageUrl;
                } catch (error) {
                    console.error("Image generation error:", error);
                    response = `Sorry, I couldn't generate that image: ${error instanceof Error ? error.message : String(error)}`;
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
                    response = "Please provide a description for the video you'd like me to generate.";
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: response,
                        isStreaming: false,
                    });
                    return;
                }

                try {
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: "🎬 Starting video generation... This may take a few minutes.",
                        isStreaming: true,
                    });

                    const videoData = await videoGenerationManager.generateVideo(
                        provider === "google" || provider === "openai" ? provider : "google",
                        null,
                        videoPrompt,
                        { duration: 5, aspectRatio: "16:9" },
                        ctx
                    );

                    response = "";
                    metadata.videoPrompt = videoPrompt;
                    metadata.generatedVideoUrl = videoData.videoUrl;
                    metadata.videoThumbnailUrl = videoData.thumbnailUrl;
                    metadata.videoDuration = videoData.duration;
                    metadata.videoResolution = videoData.resolution;
                } catch (error) {
                    console.error("Video generation error:", error);
                    response = `Sorry, I couldn't generate that video: ${error instanceof Error ? error.message : String(error)}`;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata,
                    isStreaming: false,
                });
                return;
            }

            // Handle /search and /canvas commands
            if (args.commands?.includes("/search")) {
                const searchQuery = content.replace("/search", "").replace("/canvas", "").trim();
                
                try {
                    // Use native AI SDK grounding with Google Gemini
                    const modelInstance = providerManager.getModel("google", "gemini-2.0-flash-exp", userApiKeys.googleApiKey);

                    const searchResult = await generateText({
                        model: modelInstance,
                        messages: [
                            {
                                role: "user",
                                content: `Search the web and provide a comprehensive response to: ${searchQuery}

Please include relevant citations and sources in your response. Use your grounding capabilities to access current information.`
                            }
                        ],
                        temperature: 0.3,
                    });

                    // Extract basic citations from response (simplified)
                    const citations = extractCitationsFromResponse(searchResult.text);
                    metadata.citations = citations;

                    if (args.commands?.includes("/canvas")) {
                        // Canvas with search - create structured output
                        const canvasSchema = z.object({
                            intro: z.string().describe("Brief introduction to the artifacts based on search results"),
                            artifacts: z.array(z.object({
                                id: z.string(),
                                filename: z.string(),
                                language: z.string(),
                                content: z.string(),
                                description: z.string(),
                            })),
                            summary: z.string().describe("Summary of the created artifacts"),
                        });

                        const enhancedPrompt = `User request: "${searchQuery}"

AI Response from search:
${searchResult.text}

Search results context:
${citations.map((citation: any) => 
    `[${citation.number}] ${citation.title}\n${citation.citedText}\nSource: ${citation.url}`
).join("\n\n")}

Based on the AI response and these search results, create artifacts (code files, documentation, etc.) that address the user's request. Include proper citations in your artifacts.`;

                        await ctx.runAction(internal.ai.generateStructuredOutput, {
                            chatId: args.chatId,
                            messageId: args.messageId,
                            model: args.model,
                            schema: canvasSchema,
                            userApiKey: userKey,
                            enhancedPrompt,
                            metadata: metadata,
                        });
                        return;
                    } else {
                        // Search only - use the AI response directly
                        await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                            messageId: args.messageId,
                            content: searchResult.text,
                            metadata,
                            isStreaming: false,
                        });
                        return;
                    }
                } catch (error) {
                    console.error("Web search error:", error);
                    response = "Sorry, I couldn't perform the web search at the moment. Please try again later.";
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: response,
                        isStreaming: false,
                    });
                    return;
                }
            }

            if (args.commands?.includes("/canvas") && !args.commands?.includes("/search")) {
                // Canvas without search
                const canvasSchema = z.object({
                    intro: z.string().describe("Brief introduction to the artifact"),
                    artifacts: z.array(z.object({
                        id: z.string(),
                        filename: z.string(),
                        language: z.string(),
                        content: z.string(),
                        description: z.string(),
                    })),
                    summary: z.string().describe("Summary of the created artifacts"),
                });

                try {
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
                    response = "Sorry, I couldn't generate the canvas artifacts. Please try again.";
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: response,
                        isStreaming: false,
                    });
                    return;
                }
            }

            // Normal AI response using Vercel AI SDK streaming
            const modelInstance = providerManager.getModel(provider, args.model, userKey);

            // Process regular attachments using our new AI SDK helpers
            const allProcessedAttachments = [...artifactAttachments];
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

            // Convert messages to AI SDK format with attachments
            const convertedMessages = formatMessagesForAISDK(
                messages.map((m: any) => ({
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : m.content
                })),
                allProcessedAttachments
            );

            console.log("🎭 STREAMING WITH AI SDK:", {
                provider,
                model: args.model,
                messageCount: convertedMessages.length,
                attachmentCount: allProcessedAttachments.length
            });

            // Stream response using AI SDK
            const result = await streamText({
                model: modelInstance,
                messages: convertedMessages,
                temperature: 0.7,
                // Remove maxTokens for now to fix TypeScript errors
                // Different providers may have different token limit handling
            });

            let accumulatedResponse = "";

            // Process the stream
            for await (const chunk of result.textStream) {
                if (chunk) {
                    accumulatedResponse += chunk;
                    
                    // Update message with accumulated content
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: accumulatedResponse,
                        isStreaming: true,
                    });
                }
            }

            // Mark streaming as complete
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: accumulatedResponse,
                metadata,
                isStreaming: false,
            });

            console.log("✅ AI SDK GENERATION COMPLETE:", {
                messageId: args.messageId,
                provider,
                contentLength: accumulatedResponse.length,
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            console.error("AI SDK streaming error:", error);
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: `Sorry, I encountered an error while generating a response: ${error instanceof Error ? error.message : String(error)}. Please try again.`,
                isStreaming: false,
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
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        try {
            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey = args.userApiKey || (await getUserApiKeys(ctx))[config.userKeyField];

            console.log("🎯 GENERATING STRUCTURED OUTPUT WITH AI SDK:", {
                provider,
                model: args.model,
                messageId: args.messageId
            });

            // Get messages for context
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                {
                    chatId: args.chatId,
                    excludeMessageId: args.messageId,
                }
            );

            const promptToUse = args.enhancedPrompt || 
                messages.filter((m: any) => m.role === "user").pop()?.content || "";

            // Convert messages to simple format for AI SDK
            const convertedMessages = [
                ...messages.slice(0, -1).map((m: any) => ({
                    role: m.role,
                    content: m.content
                })),
                { role: "user" as const, content: promptToUse },
            ];

            // Get model instance
            const modelInstance = providerManager.getModel(provider, args.model, userKey);

            // Generate structured output using AI SDK
            const result = await generateObject({
                model: modelInstance,
                messages: convertedMessages,
                schema: args.schema,
                temperature: 0.7,
            });

            const parsedOutput = result.object;

            if (!parsedOutput || !parsedOutput.artifacts) {
                throw new Error("No artifacts generated");
            }

            // Build response with artifacts
            let responseText = parsedOutput.intro || "";
            
            if (parsedOutput.artifacts && parsedOutput.artifacts.length > 0) {
                // Save artifacts to database
                const artifactMetadata = [];
                for (const artifact of parsedOutput.artifacts) {
                    await ctx.runMutation(
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

                const finalMetadata = {
                    ...(args.metadata || {}),
                    structuredOutput: true,
                    canvasIntro: parsedOutput.intro,
                    canvasSummary: parsedOutput.summary,
                    artifacts: artifactMetadata.map((artifact: any) => artifact._id),
                };

                if (parsedOutput.summary) {
                    responseText += (responseText ? "\n\n" : "") + parsedOutput.summary;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: responseText,
                    metadata: finalMetadata,
                    isStreaming: false,
                });
            }

            console.log("✅ STRUCTURED OUTPUT COMPLETE:", {
                messageId: args.messageId,
                artifactCount: parsedOutput.artifacts?.length || 0
            });

        } catch (error) {
            console.error("AI SDK structured output error:", error);
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: "Sorry, I couldn't generate the structured response. Please try again.",
                isStreaming: false,
            });
        }
    },
});

// Multi-AI Response Generation using AI SDK
export const generateMultiAIResponses = internalAction({
    args: {
        chatId: v.id("chats"),
        messageId: v.id("messages"),
        models: v.array(v.string()),
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
        referencedArtifacts: v.optional(v.array(v.string())),
        responseIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        console.log("🧠 STARTING MULTI-AI GENERATION WITH AI SDK:", {
            chatId: args.chatId,
            messageId: args.messageId,
            models: args.models,
            responseIds: args.responseIds,
            timestamp: new Date().toISOString(),
        });

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

                const convertedMessages = messages.map((m: any) => ({
                    role: m.role,
                    content: m.content
                }));
                const modelInstance = providerManager.getModel(provider, model, userKey);

                // Generate text using AI SDK - remove maxTokens parameter to fix TypeScript error
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
                    },
                });

                console.log(`✅ COMPLETED AI SDK RESPONSE FOR ${model}:`, {
                    responseId,
                    contentLength: result.text.length,
                    provider,
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
            timestamp: new Date().toISOString(),
        });
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

            const contentFromPosition = message.content.slice(args.fromPosition);

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
            throw new Error("Failed to mark streaming complete");
        }
    },
});

// Helper function to extract citations from AI response (simplified)
function extractCitationsFromResponse(response: string): any[] {
    const citations: any[] = [];
    
    // Look for common citation patterns in AI responses
    const citationPatterns = [
        /\[(\d+)\]\s*([^[\n]+)/g, // [1] Title or description
        /Source:\s*([^\n]+)/gi,   // Source: URL or title
        /https?:\/\/[^\s\n]+/g,   // Direct URLs
    ];

    let citationNumber = 1;

    citationPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(response)) !== null) {
            if (pattern.source.includes('http')) {
                // Direct URL
                citations.push({
                    number: citationNumber++,
                    url: match[0],
                    title: match[0].replace(/https?:\/\//, ''),
                    citedText: `Information from ${match[0]}`,
                });
            } else if (pattern.source.includes('Source')) {
                // Source pattern
                citations.push({
                    number: citationNumber++,
                    url: match[1],
                    title: match[1],
                    citedText: `Source: ${match[1]}`,
                });
            } else {
                // Numbered citation
                citations.push({
                    number: parseInt(match[1]) || citationNumber++,
                    title: match[2]?.trim() || 'Web Source',
                    citedText: match[2]?.trim() || '',
                    url: '#',
                });
            }
        }
    });

    // Remove duplicates and limit to 10 citations
    const uniqueCitations = citations.filter((citation, index, self) => 
        index === self.findIndex(c => c.url === citation.url || c.title === citation.title)
    );

    return uniqueCitations.slice(0, 10);
}
