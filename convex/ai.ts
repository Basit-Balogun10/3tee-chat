"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

import { getProviderFromModel, PROVIDER_CONFIGS } from "./ai/config";
import { getUserApiKeys, getMimeType } from "./ai/helpers";
import { providerManager } from "./ai/providers";
import {
    fileManager,
    structuredOutputManager,
    imageGenerationManager,
    videoGenerationManager
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
            // Initialize message as streaming with position 0
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: "",
                isStreaming: true,
                streamPosition: 0,
            });

            // Get user API keys and chat history
            const userApiKeys = await getUserApiKeys(ctx);
            const messages = await ctx.runQuery(internal.aiHelpers.getChatHistory, { chatId: args.chatId });
            const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
            const content = lastUserMessage?.content || "";
            let response = "";
            const metadata: any = {};

            // Process referenced artifacts by uploading them to provider-specific file APIs
            let artifactAttachments: any[] = [];
            if (args.referencedArtifacts && args.referencedArtifacts.length > 0) {
                const provider = getProviderFromModel(args.model);
                const config = PROVIDER_CONFIGS[provider];
                const userKey = userApiKeys[config.userKeyField];
                const client = providerManager.getClient(provider, userKey);

                console.log(`🔗 Processing ${args.referencedArtifacts.length} referenced artifacts for ${provider}...`);

                for (const artifactId of args.referencedArtifacts) {
                    try {
                        // Get artifact from database
                        const artifact = await ctx.runQuery(internal.artifacts.getArtifactInternal, { 
                            artifactId 
                        });
                        
                        if (artifact) {
                            console.log(`📋 Processing artifact: ${artifact.filename} (${artifact.language})`);
                            
                            // Upload artifact to provider's file API with caching
                            const uploadResult = await fileManager.uploadArtifactToProvider(
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
                            
                            console.log(`✅ Artifact ${artifact.filename} uploaded to ${provider} as ${uploadResult.fileId}`);
                        } else {
                            console.warn(`⚠️ Referenced artifact not found: ${artifactId}`);
                        }
                    } catch (error) {
                        console.error(`Failed to upload artifact ${artifactId} to ${provider}:`, error);
                        // Continue with other artifacts even if one fails
                    }
                }
                
                console.log(`📎 Successfully processed ${artifactAttachments.length}/${args.referencedArtifacts.length} artifacts`);
            }

            // Combine regular attachments with artifact attachments
            let allAttachments = [...(args.attachments || [])];
            if (artifactAttachments.length > 0) {
                // Process regular attachments for provider
                const provider = getProviderFromModel(args.model);
                const config = PROVIDER_CONFIGS[provider];
                const userKey = userApiKeys[config.userKeyField];
                const client = providerManager.getClient(provider, userKey);
                
                const processedAttachments = await processAttachmentsForProvider(
                    allAttachments,
                    provider,
                    client,
                    ctx
                );
                
                // Combine processed regular attachments with artifact attachments
                allAttachments = [...processedAttachments, ...artifactAttachments];
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
                        streamPosition: response.length,
                    });
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
                    const client = providerManager.getClient(imageProvider, userKey);
                    
                    const imageUrl = await imageGenerationManager.generateImage(
                        imageProvider,
                        client,
                        imagePrompt,
                        { model: args.model }
                    );
                    
                    // NO PREFILLED TEXT - just metadata
                    metadata.imagePrompt = imagePrompt;
                    metadata.generatedImageUrl = imageUrl;
                    metadata.imageGenerationProvider = imageProvider;
                    
                } catch (error) {
                    console.error("Image generation error:", error);
                    response = `Sorry, I couldn't generate that image: ${error instanceof Error ? error.message : String(error)}. Please try again later.`;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata,
                    isStreaming: false,
                    streamPosition: response.length,
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
                        streamPosition: response.length,
                    });
                    return;
                }

                try {
                    // Note: Video generation can take 2-5 minutes, so we inform the user
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: "🎬 Starting video generation... This may take a few minutes.",
                        isStreaming: true,
                        streamPosition: 0,
                    });

                    // For video generation, use current model (sora or veo-2)
                    const provider = getProviderFromModel(args.model);
                    let videoProvider = provider;
                    
                    // Force to valid video generation providers only
                    if (provider !== "google" && provider !== "openai") {
                        videoProvider = "google"; // Default to google for video gen
                    }
                    
                    const config = PROVIDER_CONFIGS[videoProvider];
                    const userKey = userApiKeys[config.userKeyField];
                    const client = providerManager.getClient(videoProvider, userKey);
                    
                    const videoData = await videoGenerationManager.generateVideo(
                        videoProvider,
                        client,
                        videoPrompt,
                        { duration: 5, aspectRatio: "16:9" }
                    );
                    
                    // NO PREFILLED TEXT - just metadata and loading completion
                    response = ""; // Empty response text
                    metadata.videoPrompt = videoPrompt;
                    metadata.generatedVideoUrl = videoData.videoUrl;
                    metadata.videoThumbnailUrl = videoData.thumbnailUrl;
                    metadata.videoDuration = videoData.duration;
                    metadata.videoResolution = videoData.resolution;
                    metadata.videoGenerationProvider = videoProvider;
                    
                } catch (error) {
                    console.error("Video generation error:", error);
                    response = `Sorry, I couldn't generate that video: ${error instanceof Error ? error.message : String(error)}. Video generation requires significant processing time and may not always succeed.`;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata,
                    isStreaming: false,
                    streamPosition: response.length,
                });
                return;
            }

            // Handle /search and /canvas commands (can be combined)
            if (args.commands?.includes("/search")) {
                const searchQuery = content.replace("/search", "").replace("/canvas", "").trim();
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

                    // Populate real citations from provider responses
                    metadata.citations = searchData.citations;

                    // If also canvas command, we'll handle structured output
                    if (args.commands?.includes("/canvas")) {
                        // Canvas with search - create structured output with search context
                        const canvasSchema = {
                            type: "object",
                            properties: {
                                intro: {
                                    type: "string",
                                    description: "Brief introduction to the artifacts based on search results",
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
                                        required: ["id", "filename", "language", "content"],
                                    },
                                },
                                summary: {
                                    type: "string",
                                    description: "Summary of the created artifacts",
                                },
                            },
                            required: ["artifacts"],
                        };

                        const enhancedPrompt = `User request: "${searchQuery}"

Search results context:
${searchData.citations.map((citation: any) => 
    `[${citation.number}] ${citation.title}\n${citation.citedText}\nSource: ${citation.url}`
).join("\n\n")}

Based on these search results, create artifacts (code files, documentation, etc.) that address the user's request. Include proper citations in your artifacts.`;

                        // Generate structured output (NON-STREAMING for canvas)
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
                        // Search only - stream the response
                        const enhancedPrompt = `User question: "${searchQuery}"

Here are relevant search results to help answer the question:
${searchData.citations.map((citation: any) => 
    `[${citation.number}] ${citation.title}\n${citation.citedText}\nSource: ${citation.url}`
).join("\n\n")}

Please provide a comprehensive answer using these search results. When referencing information from specific sources, cite them using the format [1], [2], etc. Only cite sources you actually use in your response.`;

                        const openaiMessages = [
                            ...messages.slice(0, -1),
                            { role: "user", content: enhancedPrompt },
                        ];

                        // Stream search response
                        const stream = await providerManager.callProvider(
                            provider,
                            args.model,
                            openaiMessages,
                            { apiKey: userKey, stream: true }
                        );

                        let accumulatedResponse = "";
                        for await (const chunk of stream) {
                            const contentChunk = chunk.choices[0]?.delta?.content || "";
                            if (contentChunk) {
                                accumulatedResponse += contentChunk;
                                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                                    messageId: args.messageId,
                                    content: accumulatedResponse,
                                    metadata,
                                    isStreaming: true,
                                    streamPosition: accumulatedResponse.length,
                                });
                            }
                        }

                        await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                            messageId: args.messageId,
                            content: accumulatedResponse,
                            metadata,
                            isStreaming: false,
                            streamPosition: accumulatedResponse.length,
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
                        streamPosition: response.length,
                    });
                    return;
                }
            }

            if (args.commands?.includes("/canvas") && !args.commands?.includes("/search")) {
                // Canvas without search
                const canvasContent = content.replace("/canvas", "").trim();
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
                                required: ["id", "filename", "language", "content"],
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
                    response = "Sorry, I couldn't generate the canvas artifacts. Please try again.";
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: response,
                        isStreaming: false,
                        streamPosition: response.length,
                    });
                    return;
                }
            }

            // Normal AI response - stream and accumulate complete response
            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey = userApiKeys[config.userKeyField];

            console.log(`Using provider: ${provider} for model: ${args.model}`);

            // Process ALL attachments (regular + artifacts) for the selected provider using Files API
            let allProcessedAttachments = [...artifactAttachments]; // Start with artifact attachments
            
            if (args.attachments && args.attachments.length > 0) {
                const client = providerManager.getClient(provider, userKey);
                const regularAttachments = await processAttachmentsForProvider(
                    args.attachments,
                    provider,
                    client,
                    ctx
                );
                allProcessedAttachments = [...allProcessedAttachments, ...regularAttachments];
            }

            console.log(`📎 Total attachments for AI: ${allProcessedAttachments.length} (${artifactAttachments.length} artifacts + ${args.attachments?.length || 0} regular)`);

            const openaiMessages = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            // Stream and accumulate complete response regardless of frontend
            const stream = await providerManager.callProvider(
                provider,
                args.model,
                openaiMessages,
                {
                    apiKey: userKey,
                    stream: true,
                    attachments: allProcessedAttachments, // Use combined attachments
                }
            );

            let accumulatedResponse = "";
            
            for await (const chunk of stream) {
                const contentChunk = chunk.choices[0]?.delta?.content || "";
                if (contentChunk) {
                    accumulatedResponse += contentChunk;
                    
                    // Always update the complete response and stream position
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: accumulatedResponse,
                        isStreaming: true,
                        streamPosition: accumulatedResponse.length,
                    });
                }
                
                if (chunk.choices[0]?.finish_reason) {
                    break;
                }
            }

            // Mark streaming as complete (backend done, but frontend controls isStreaming)
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: accumulatedResponse,
                metadata,
                isStreaming: true, // Keep true until frontend confirms completion
                streamPosition: accumulatedResponse.length,
            });
            
        } catch (error) {
            console.error("Streaming error:", error);
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: `Sorry, I encountered an error while generating a response: ${error instanceof Error ? error.message : String(error)}. Please try again.`,
                isStreaming: false,
                streamPosition: 0,
            });
        }
    },
});

// Simple resume streaming action
export const resumeStreaming = action({
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
            const contentFromPosition = message.content.slice(args.fromPosition);
            
            return {
                content: contentFromPosition,
                totalLength: message.content.length,
                streamPosition: message.streamPosition || message.content.length,
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
        try {
            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey = args.userApiKey || (await getUserApiKeys(ctx))[config.userKeyField];
            const client = providerManager.getClient(provider, userKey);

            // Get messages for context
            const messages = await ctx.runQuery(internal.aiHelpers.getChatHistory, { chatId: args.chatId });
            
            // Use enhanced prompt if provided, otherwise use the last user message
            const promptToUse = args.enhancedPrompt || messages.filter((m: any) => m.role === "user").pop()?.content || "";
            
            const structuredMessages = [
                ...messages.slice(0, -1),
                { role: "user", content: promptToUse }
            ];

            // Generate structured output (NON-STREAMING for canvas)
            let result;
            switch (provider) {
                case "openai":
                case "openrouter":
                case "deepseek":
                    result = await structuredOutputManager.generateOpenAIStructuredOutput(
                        client,
                        args.model,
                        structuredMessages,
                        args.schema,
                        { stream: false, attachments: args.attachments }
                    );
                    break;
                case "google":
                    result = await structuredOutputManager.generateGoogleStructuredOutput(
                        client,
                        args.model,
                        structuredMessages,
                        args.schema,
                        { stream: false, attachments: args.attachments }
                    );
                    break;
                case "anthropic":
                    result = await structuredOutputManager.generateAnthropicStructuredOutput(
                        client,
                        args.model,
                        structuredMessages,
                        args.schema,
                        { stream: false, attachments: args.attachments }
                    );
                    break;
                default:
                    throw new Error(`Structured output not supported for provider: ${provider}`);
            }

            // Parse the structured output and create artifacts
            let parsedOutput;
            try {
                if (provider === "anthropic") {
                    // For Anthropic, the structured output is in tool use
                    const toolUses = result.content?.filter((c: any) => c.type === "tool_use") || [];
                    if (toolUses.length > 0) {
                        parsedOutput = toolUses[0].input;
                    }
                } else if (provider === "google") {
                    // For Google, parse the text response as JSON
                    parsedOutput = JSON.parse(result.text || "{}");
                } else {
                    // For OpenAI Responses API, get from structured output
                    const textOutputs = result.output?.filter((o: any) => o.type === "message") || [];
                    if (textOutputs.length > 0) {
                        parsedOutput = JSON.parse(textOutputs[0].content || "{}");
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
                    const artifactId = await ctx.runMutation(internal.artifacts.createArtifact, {
                        messageId: args.messageId,
                        chatId: args.chatId,
                        artifactId: artifact.id,
                        filename: artifact.filename,
                        language: artifact.language,
                        content: artifact.content,
                        description: artifact.description,
                    });

                    artifactMetadata.push({
                        id: artifact.id,
                        filename: artifact.filename,
                        language: artifact.language,
                        description: artifact.description,
                    });
                }

                // Update metadata with artifacts - NO "I've created..." text
                const finalMetadata = {
                    ...(args.metadata || {}),
                    structuredOutput: true,
                    canvasIntro: parsedOutput.intro,
                    canvasSummary: parsedOutput.summary,
                    artifacts: artifactMetadata,
                };

                if (parsedOutput.summary) {
                    responseText += (responseText ? "\n\n" : "") + parsedOutput.summary;
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: responseText,
                    metadata: finalMetadata,
                    isStreaming: false,
                    streamPosition: responseText.length,
                });
            }

        } catch (error) {
            console.error("Structured output generation error:", error);
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: "Sorry, I couldn't generate the structured response. Please try again.",
                isStreaming: false,
                streamPosition: 0,
            });
        }
    },
});

export const retryMessage = action({
    args: {
        messageId: v.id("messages"),
        model: v.string(),
        userApiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const message = await ctx.runQuery(internal.aiHelpers.getMessage, { messageId: args.messageId });
        if (!message) throw new Error("Message not found");

        await ctx.runMutation(internal.aiHelpers.sendMessage, {
            chatId: message.chatId,
            content: message.content,
            model: args.model,
            userApiKey: args.userApiKey,
            isStreaming: true,
            parentMessageId: args.messageId,
        });
    },
});

// Helper function for processing attachments for provider
async function processAttachmentsForProvider(attachments: any[], provider: string, client: any, ctx: any): Promise<any[]> {
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
            console.error(`Failed to process attachment ${attachment.name} for provider ${provider}:`, error);
        }
    }
    return processedAttachments;
}