import { v } from "convex/values";
import {
    mutation,
    query,
    internalQuery,
    internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Internal version for use in other functions - this is needed for AI generation
export const getArtifactByIdInternal = internalQuery({
    args: { artifactId: v.string() },
    handler: async (ctx, args) => {
        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        return artifact;
    },
});

// Internal version for use in other functions
export const getArtifactInternal = internalQuery({
    args: { artifactId: v.string() },
    handler: async (ctx, args) => {
        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        return artifact;
    },
});

// Internal version for creating artifacts
export const createArtifactInternal = internalMutation({
    args: {
        messageId: v.id("messages"),
        chatId: v.id("chats"),
        userId: v.id("users"),
        artifactId: v.string(),
        filename: v.string(),
        language: v.string(),
        content: v.string(),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Determine if the artifact is previewable
        const previewableLanguages = [
            "html",
            "css",
            "javascript",
            "typescript",
            "react",
            "vue",
            "svelte",
            "markdown",
        ];
        const isPreviewable = previewableLanguages.includes(
            args.language.toLowerCase()
        );

        const now = Date.now();

        return await ctx.db.insert("artifacts", {
            messageId: args.messageId,
            chatId: args.chatId,
            userId: args.userId,
            artifactId: args.artifactId,
            filename: args.filename,
            language: args.language,
            content: args.content,
            originalContent: args.content,
            description: args.description,
            createdAt: now,
            updatedAt: now,
            editCount: 0,
            isPreviewable,
        });
    },
});

// Public version for creating artifacts
export const createArtifactPublic = mutation({
    args: {
        messageId: v.id("messages"),
        chatId: v.id("chats"),
        artifactId: v.string(),
        filename: v.string(),
        language: v.string(),
        content: v.string(),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Verify the chat belongs to the user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or access denied");
        }

        // Determine if the artifact is previewable
        const previewableLanguages = [
            "html",
            "css",
            "javascript",
            "typescript",
            "react",
            "vue",
            "svelte",
            "markdown",
        ];
        const isPreviewable = previewableLanguages.includes(
            args.language.toLowerCase()
        );

        const now = Date.now();

        return await ctx.db.insert("artifacts", {
            messageId: args.messageId,
            chatId: args.chatId,
            userId: userId,
            artifactId: args.artifactId,
            filename: args.filename,
            language: args.language,
            content: args.content,
            originalContent: args.content,
            description: args.description,
            createdAt: now,
            updatedAt: now,
            editCount: 0,
            isPreviewable,
        });
    },
});

// Update an artifact's content
export const updateArtifact = mutation({
    args: {
        artifactId: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        if (!artifact) throw new Error("Artifact not found");

        // Verify ownership
        if (artifact.userId !== userId) {
            throw new Error("Access denied");
        }

        await ctx.db.patch(artifact._id, {
            content: args.content,
            updatedAt: Date.now(),
            editCount: (artifact.editCount || 0) + 1,
        });

        return artifact._id;
    },
});

// Get artifacts for a chat
export const getChatArtifacts = query({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        // Verify the chat belongs to the user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            return [];
        }

        return await ctx.db
            .query("artifacts")
            .withIndex("by_chat_created", (q) => q.eq("chatId", args.chatId))
            .order("desc")
            .collect();
    },
});

// Get a specific artifact
export const getArtifact = query({
    args: { artifactId: v.string() },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        if (!artifact) return null;

        // Verify ownership
        if (artifact.userId !== userId) {
            return null;
        }

        return artifact;
    },
});

// Delete an artifact
export const deleteArtifact = mutation({
    args: { artifactId: v.string() },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        if (!artifact) throw new Error("Artifact not found");

        // Verify ownership
        if (artifact.userId !== userId) {
            throw new Error("Access denied");
        }

        await ctx.db.delete(artifact._id);
        return artifact._id;
    },
});

// Get artifacts referenced in a message
export const getMessageArtifacts = query({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        return await ctx.db
            .query("artifacts")
            .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
            .collect();
    },
});
