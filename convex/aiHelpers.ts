import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Define types for AI settings
interface AISettings {
    temperature: number;
    maxTokens?: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    systemPrompt: string;
    responseMode: string;
    promptEnhancement: boolean;
}

// Get combined AI settings (per-chat + global preferences)
export const getCombinedAISettings = internalQuery({
    args: {
        chatId: v.id("chats"),
        userId: v.id("users"),
    },
    returns: v.object({
        temperature: v.number(),
        maxTokens: v.optional(v.number()),
        topP: v.number(),
        frequencyPenalty: v.number(),
        presencePenalty: v.number(),
        systemPrompt: v.string(),
        responseMode: v.string(),
        promptEnhancement: v.boolean(),
    }),
    handler: async (ctx, args): Promise<AISettings> => {
        const chat = await ctx.db.get(args.chatId);
        const preferences: any = await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal,
            {
                userId: args.userId,
            }
        );

        // Default AI settings
        const defaultSettings: AISettings = {
            temperature: 0.7,
            maxTokens: undefined,
            topP: 0.9,
            frequencyPenalty: 0,
            presencePenalty: 0,
            systemPrompt: "",
            responseMode: "balanced" as const,
            promptEnhancement: false,
        };

        // Merge global preferences with defaults
        const globalSettings: AISettings = {
            ...defaultSettings,
            ...(preferences?.aiSettings || {}),
        };

        // Per-chat settings override global settings
        const finalSettings: AISettings = {
            ...globalSettings,
            ...(chat?.aiSettings || {}),
        };

        console.log("🎯 COMBINED AI SETTINGS:", {
            chatId: args.chatId,
            userId: args.userId,
            hasPerChatSettings: !!chat?.aiSettings,
            hasGlobalSettings: !!preferences?.aiSettings,
            finalSettings: {
                temperature: finalSettings.temperature,
                maxTokens: finalSettings.maxTokens,
                topP: finalSettings.topP,
                systemPrompt: finalSettings.systemPrompt ? "SET" : "NONE",
            },
            timestamp: new Date().toISOString(),
        });

        return finalSettings;
    },
});

export const getChatHistory = internalQuery({
    args: {
        chatId: v.id("chats"),
        excludeMessageId: v.optional(v.id("messages")), // Add this parameter
    },
    handler: async (ctx, args) => {
        // FIX: Remove old index usage - get messages through branches now
        // Since messages belong to branches now, we need to get them through the chat's active branch
        const chat = await ctx.db.get(args.chatId);
        if (!chat || !chat.activeBranchId) return [];

        const activeBranch = await ctx.db.get(chat.activeBranchId);
        if (!activeBranch) return [];

        // Get messages from baseMessages + activeBranch.messages
        const baseMessageIds = chat.baseMessages || [];
        const branchMessageIds = activeBranch.messages || [];
        const allMessageIds = [...baseMessageIds, ...branchMessageIds];

        // Get all messages
        const messages = await Promise.all(
            allMessageIds.map((messageId) => ctx.db.get(messageId))
        );

        const validMessages = messages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        // If excludeMessageId is provided, slice the array to exclude that message and everything after
        let filteredMessages = validMessages;
        if (args.excludeMessageId) {
            const excludeIndex = validMessages.findIndex(
                (m) => m._id === args.excludeMessageId
            );
            if (excludeIndex !== -1) {
                filteredMessages = validMessages.slice(0, excludeIndex);
            }
        } else {
            // Original logic: Filter out streaming messages and empty content
            filteredMessages = validMessages.filter(
                (msg) => !msg.isStreaming && msg.content.trim() !== ""
            );
        }

        console.log("📝 CHAT HISTORY RETURNED:", {
            chatId: args.chatId,
            excludeMessageId: args.excludeMessageId,
            totalMessages: validMessages.length,
            filteredCount: filteredMessages.length,
            lastMessage: filteredMessages[filteredMessages.length - 1]
                ? {
                      role: filteredMessages[filteredMessages.length - 1].role,
                      content:
                          filteredMessages[
                              filteredMessages.length - 1
                          ].content.substring(0, 50) + "...",
                  }
                : null,
            timestamp: new Date().toISOString(),
        });

        return filteredMessages;
    },
});

export const updateMessageContent = internalMutation({
    args: {
        messageId: v.id("messages"),
        content: v.optional(v.string()),
        metadata: v.optional(v.any()),
        isStreaming: v.optional(v.boolean()),
        // Add response metadata tracking
        responseMetadata: v.optional(
            v.object({
                usage: v.optional(v.any()), // Allow any usage object format
                finishReason: v.optional(v.string()),
                responseTime: v.optional(v.number()), // in milliseconds
                model: v.optional(v.string()),
                provider: v.optional(v.string()),
                requestId: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const updates: any = {};

        if (args.content !== undefined) updates.content = args.content;
        if (args.isStreaming !== undefined)
            updates.isStreaming = args.isStreaming;

        // Enhanced metadata handling with response tracking and canvas artifacts
        if (
            args.metadata !== undefined ||
            args.responseMetadata !== undefined
        ) {
            const existingMetadata = message.metadata || {};
            const newMetadata = {
                ...existingMetadata,
                ...(args.metadata || {}),
            };

            // Add response metadata if provided
            if (args.responseMetadata) {
                newMetadata.responseMetadata = args.responseMetadata;

                console.log("📊 RESPONSE METADATA TRACKED:", {
                    messageId: args.messageId,
                    usage: args.responseMetadata.usage,
                    responseTime: args.responseMetadata.responseTime,
                    model: args.responseMetadata.model,
                    provider: args.responseMetadata.provider,
                    finishReason: args.responseMetadata.finishReason,
                    timestamp: new Date().toISOString(),
                });
            }

            // Special handling for canvas artifacts
            if (newMetadata.structuredOutput && newMetadata.artifacts) {
                console.log("🎨 CANVAS ARTIFACTS METADATA UPDATED:", {
                    messageId: args.messageId,
                    artifactCount: newMetadata.artifactCount || 0,
                    artifactIds: newMetadata.artifacts,
                    hasIntro: !!newMetadata.canvasIntro,
                    hasSummary: !!newMetadata.canvasSummary,
                    timestamp: new Date().toISOString(),
                });
            }

            updates.metadata = newMetadata;
        }

        // ENHANCED FIX: Always update the active version's content when content is updated
        if (
            args.content !== undefined &&
            message.messageVersions &&
            message.messageVersions.length > 0
        ) {
            console.log("📝 UPDATING VERSION CONTENT:", {
                messageId: args.messageId,
                newContent: args.content.substring(0, 30) + "...",
                versionsCount: message.messageVersions.length,
                activeVersionId: message.messageVersions.find((v) => v.isActive)
                    ?.versionId,
                isCanvasArtifact: !!(
                    args.metadata?.structuredOutput && args.metadata?.artifacts
                ),
                timestamp: new Date().toISOString(),
            });

            const updatedVersions = message.messageVersions.map((v) => {
                if (v.isActive) {
                    return {
                        ...v,
                        content: args.content, // Update the active version's content
                        // Update metadata if provided
                        ...(args.responseMetadata && {
                            metadata: {
                                ...v.metadata,
                                responseMetadata: args.responseMetadata,
                            },
                        }),
                        // Add canvas-specific metadata to version
                        ...(args.metadata?.structuredOutput && {
                            metadata: {
                                ...v.metadata,
                                structuredOutput:
                                    args.metadata.structuredOutput,
                                artifactCount: args.metadata.artifactCount,
                                canvasIntro: args.metadata.canvasIntro,
                                canvasSummary: args.metadata.canvasSummary,
                                artifacts: args.metadata.artifacts,
                            },
                        }),
                    };
                }
                return v;
            });
            updates.messageVersions = updatedVersions;
        }

        return await ctx.db.patch(args.messageId, updates);
    },
});

export const getMessage = internalQuery({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.messageId);
    },
});

export const getChat = internalQuery({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.chatId);
    },
});
