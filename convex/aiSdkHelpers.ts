import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Helper to clean message content for AI processing
export const cleanMessageContent = (content: string): string => {
    return content
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/\n\s*\n\s*\n/g, "\n\n") // Normalize line breaks
        .trim();
};

// Update message content - simplified without rawParts
export const updateMessageContent = internalMutation({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
        isStreaming: v.optional(v.boolean()),
        metadata: v.optional(v.any()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.messageId, {
            content: args.content,
            isStreaming: args.isStreaming,
            metadata: args.metadata,
            timestamp: Date.now(),
        });
        return null;
    },
});
