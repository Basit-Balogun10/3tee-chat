import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

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
            const excludeIndex = validMessages.findIndex(m => m._id === args.excludeMessageId);
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
            lastMessage: filteredMessages[filteredMessages.length - 1] ? {
                role: filteredMessages[filteredMessages.length - 1].role,
                content: filteredMessages[filteredMessages.length - 1].content.substring(0, 50) + "...",
            } : null,
            timestamp: new Date().toISOString()
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
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const updates: any = {};

        if (args.content !== undefined) updates.content = args.content;
        if (args.metadata !== undefined) updates.metadata = args.metadata;
        if (args.isStreaming !== undefined)
            updates.isStreaming = args.isStreaming;

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
                timestamp: new Date().toISOString(),
            });

            const updatedVersions = message.messageVersions.map((v) => {
                if (v.isActive) {
                    return {
                        ...v,
                        content: args.content, // Update the active version's content
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
