import { v } from "convex/values";
import { mutation, action, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

export const addMessage = mutation({
    args: {
        chatId: v.id("chats"),
        role: v.union(
            v.literal("user"),
            v.literal("assistant"),
            v.literal("system")
        ),
        content: v.string(),
        model: v.optional(v.string()),
        isStreaming: v.optional(v.boolean()),
        parentMessageId: v.optional(v.id("messages")),
        branchId: v.optional(v.string()),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        commands: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        const messageId = await ctx.db.insert("messages", {
            chatId: args.chatId,
            role: args.role,
            content: args.content,
            timestamp: Date.now(),
            model: args.model,
            isStreaming: args.isStreaming,
            parentMessageId: args.parentMessageId,
            branchId: args.branchId || crypto.randomUUID(),
            attachments: args.attachments,
        });

        // Update chat's updatedAt timestamp and auto-generate title if needed
        const updates: any = { updatedAt: Date.now() };

        if (
            chat.title === "New Chat" &&
            args.role === "user" &&
            args.content.trim()
        ) {
            const title = args.content.slice(0, 50).trim();
            updates.title =
                title.length < args.content.length ? title + "..." : title;
        }

        await ctx.db.patch(args.chatId, updates);

        return messageId;
    },
});

export const updateMessage = mutation({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
        isStreaming: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const chat = await ctx.db.get(message.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Unauthorized");
        }

        // Save edit history
        const editHistory = message.editHistory || [];
        editHistory.push({
            content: message.content,
            timestamp: Date.now(),
        });

        await ctx.db.patch(args.messageId, {
            content: args.content,
            isStreaming: args.isStreaming,
            editHistory,
        });
    },
});

export const branchFromMessage = mutation({
    args: {
        messageId: v.id("messages"),
        newContent: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const originalMessage = await ctx.db.get(args.messageId);
        if (!originalMessage) throw new Error("Message not found");

        const chat = await ctx.db.get(originalMessage.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Unauthorized");
        }

        // Create new branch ID
        const branchId = crypto.randomUUID();

        // Create new user message with edited content
        const newMessageId = await ctx.db.insert("messages", {
            chatId: originalMessage.chatId,
            role: "user",
            content: args.newContent,
            timestamp: Date.now(),
            parentMessageId: originalMessage.parentMessageId,
            branchId,
        });

        // Update chat's branch point
        await ctx.db.patch(originalMessage.chatId, {
            branchPoint: args.messageId,
            updatedAt: Date.now(),
        });

        return { messageId: newMessageId, branchId };
    },
});

export const retryMessage = action({
    args: {
        messageId: v.id("messages"),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
            messageId: args.messageId,
        });

        if (!message || message.role !== "assistant") {
            throw new Error("Invalid message for retry");
        }

        // Update message to streaming state
        await ctx.runMutation(api.messages.updateMessage, {
            messageId: args.messageId,
            content: "",
            isStreaming: true,
        });

        // Create new streaming session for retry
        await ctx.runMutation(api.streaming.createStreamingSession, {
            messageId: args.messageId,
        });

        // FIXED: Use streaming response and pass empty commands array for retry
        await ctx.runAction(internal.ai.generateStreamingResponse, {
            chatId: message.chatId,
            messageId: args.messageId,
            model: args.model || message.model || "gpt-4o-mini",
            commands: [], // Empty commands for retry
        });
    },
});

export const sendMessage = action({
    args: {
        chatId: v.id("chats"),
        content: v.string(),
        model: v.string(),
        commands: v.optional(v.array(v.string())),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        referencedArtifacts: v.optional(v.array(v.string())),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ userMessageId: any; assistantMessageId: any }> => {
        const userMessageId: any = await ctx.runMutation(
            api.messages.addMessage,
            {
                chatId: args.chatId,
                role: "user",
                content: args.content,
                attachments: args.attachments,
                commands: args.commands,
            }
        );

        // Create assistant message placeholder
        const assistantMessageId: any = await ctx.runMutation(
            api.messages.addMessage,
            {
                chatId: args.chatId,
                role: "assistant",
                content: "",
                model: args.model,
                isStreaming: true,
            }
        );

        // Create streaming session
        await ctx.runMutation(api.streaming.createStreamingSession, {
            messageId: assistantMessageId,
        });

        // Pass referencedArtifacts to the AI generation
        await ctx.runAction(internal.ai.generateStreamingResponse, {
            chatId: args.chatId,
            messageId: assistantMessageId,
            model: args.model,
            commands: args.commands,
            attachments: args.attachments,
            referencedArtifacts: args.referencedArtifacts,
        });

        return { userMessageId, assistantMessageId };
    },
});

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        return await ctx.storage.generateUploadUrl();
    },
});

// Message branching and edit history management
export const createMessageBranch = mutation({
    args: {
        originalMessageId: v.id("messages"),
        newContent: v.string(),
    },
    returns: v.object({
        newMessageId: v.id("messages"),
        branchId: v.string(),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const originalMessage = await ctx.db.get(args.originalMessageId);
        if (!originalMessage) throw new Error("Message not found");

        // Generate new branch ID
        const branchId = `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create edit history entry for original message
        const currentEditHistory = originalMessage.editHistory || [];
        const newEditHistory = [
            ...currentEditHistory,
            {
                content: originalMessage.content,
                timestamp: originalMessage.timestamp,
            },
        ];

        // Update original message with new content and edit history
        await ctx.db.patch(args.originalMessageId, {
            content: args.newContent,
            timestamp: Date.now(),
            editHistory: newEditHistory,
            branchId: branchId,
        });

        // Remove all messages after this point in the conversation
        const laterMessages = await ctx.db
            .query("messages")
            .withIndex("by_chat_and_timestamp", (q) =>
                q
                    .eq("chatId", originalMessage.chatId)
                    .gt("timestamp", originalMessage.timestamp)
            )
            .collect();

        for (const message of laterMessages) {
            await ctx.db.delete(message._id);
        }

        return {
            newMessageId: args.originalMessageId,
            branchId: branchId,
        };
    },
});

export const getMessageBranches = query({
    args: {
        messageId: v.id("messages"),
    },
    returns: v.object({
        branches: v.array(
            v.object({
                content: v.string(),
                timestamp: v.number(),
                isActive: v.boolean(),
            })
        ),
        currentBranchIndex: v.number(),
    }),
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const branches = [
            // Current active content
            {
                content: message.content,
                timestamp: message.timestamp,
                isActive: true,
            },
            // Historical branches from edit history
            ...(message.editHistory || []).map((edit) => ({
                content: edit.content,
                timestamp: edit.timestamp,
                isActive: false,
            })),
        ];

        // Sort by timestamp (newest first)
        branches.sort((a, b) => b.timestamp - a.timestamp);

        const currentBranchIndex = branches.findIndex(
            (branch) => branch.isActive
        );

        return {
            branches,
            currentBranchIndex,
        };
    },
});

export const switchMessageBranch = mutation({
    args: {
        messageId: v.id("messages"),
        branchIndex: v.number(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const branches = [
            {
                content: message.content,
                timestamp: message.timestamp,
            },
            ...(message.editHistory || []),
        ];

        branches.sort((a, b) => b.timestamp - a.timestamp);

        if (args.branchIndex < 0 || args.branchIndex >= branches.length) {
            throw new Error("Invalid branch index");
        }

        const selectedBranch = branches[args.branchIndex];
        const currentBranch = {
            content: message.content,
            timestamp: message.timestamp,
        };

        // Update edit history - move current content to history, bring selected to front
        const newEditHistory = branches
            .filter((_, index) => index !== args.branchIndex)
            .filter(
                (branch) =>
                    !(
                        branch.content === currentBranch.content &&
                        branch.timestamp === currentBranch.timestamp
                    )
            );

        await ctx.db.patch(args.messageId, {
            content: selectedBranch.content,
            timestamp: selectedBranch.timestamp,
            editHistory: newEditHistory,
        });

        return null;
    },
});

export const deleteMessage = mutation({
    args: {
        messageId: v.id("messages"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        // If this is a user message, also delete the subsequent AI response
        if (message.role === "user") {
            const nextMessage = await ctx.db
                .query("messages")
                .withIndex("by_chat_and_timestamp", (q) =>
                    q
                        .eq("chatId", message.chatId)
                        .gt("timestamp", message.timestamp)
                )
                .order("asc")
                .first();

            if (nextMessage && nextMessage.role === "assistant") {
                await ctx.db.delete(nextMessage._id);
            }
        }

        await ctx.db.delete(args.messageId);
        return null;
    },
});
