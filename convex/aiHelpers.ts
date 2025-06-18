import { v } from "convex/values";
import {
    internalQuery,
    internalMutation,
} from "./_generated/server";

export const getChatHistory = internalQuery({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat_and_timestamp", (q) =>
                q.eq("chatId", args.chatId)
            )
            .order("asc")
            .collect();

        // Filter out streaming messages and empty content
        return messages.filter(
            (msg) => !msg.isStreaming && msg.content.trim() !== ""
        );
    },
});

export const updateMessageContent = internalMutation({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
        metadata: v.optional(v.any()),
        isStreaming: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const updates: any = { content: args.content };

        if (args.metadata !== undefined) {
            updates.metadata = args.metadata;
        }

        if (args.isStreaming !== undefined) {
            updates.isStreaming = args.isStreaming;
        }

        await ctx.db.patch(args.messageId, updates);
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
