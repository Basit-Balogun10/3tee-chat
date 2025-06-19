import { v } from "convex/values";
import { Id } from "../../convex/_generated/dataModel";
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
export const createArtifact = mutation({
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

// Local-first backup functions
export const createLocalBackup = mutation({
    args: {
        backupType: v.union(
            v.literal("chats"),
            v.literal("preferences"),
            v.literal("artifacts")
        ),
        data: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        return await ctx.db.insert("localBackups", {
            userId,
            backupType: args.backupType,
            data: args.data,
            createdAt: Date.now(),
            isRestored: false,
        });
    },
});

export const getLocalBackups = query({
    args: {
        backupType: v.optional(
            v.union(
                v.literal("chats"),
                v.literal("preferences"),
                v.literal("artifacts")
            )
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        let query = ctx.db
            .query("localBackups")
            .withIndex("by_user", (q) => q.eq("userId", userId));

        if (args.backupType) {
            query = ctx.db
                .query("localBackups")
                .withIndex("by_user_type", (q) =>
                    q.eq("userId", userId).eq("backupType", args.backupType!)
                );
        }

        return await query.order("desc").collect();
    },
});

export const markBackupAsRestored = mutation({
    args: { backupId: v.id("localBackups") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const backup = await ctx.db.get(args.backupId);
        if (!backup || backup.userId !== userId) {
            throw new Error("Backup not found or access denied");
        }

        await ctx.db.patch(args.backupId, { isRestored: true });
        return args.backupId;
    },
});

// Enhanced artifact operations with provider file tracking
export const updateArtifactProviderFile = internalMutation({
    args: {
        artifactId: v.string(),
        provider: v.string(),
        fileId: v.string(),
        uploadedAt: v.optional(v.number()),
        expiresAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        if (!artifact) {
            throw new Error(`Artifact ${args.artifactId} not found`);
        }

        const now = Date.now();
        const currentProviderFiles = artifact.providerFiles || {};

        // Update the specific provider's file info
        const updatedProviderFiles = {
            ...currentProviderFiles,
            [args.provider]: {
                fileId: args.fileId,
                uploadedAt: args.uploadedAt || now,
                lastUsedAt: now,
                expiresAt: args.expiresAt,
            },
        };

        await ctx.db.patch(artifact._id, {
            providerFiles: updatedProviderFiles,
            usageCount: (artifact.usageCount || 0) + 1,
            lastReferencedAt: now,
        });

        return artifact._id;
    },
});

// Get cached provider file for an artifact
export const getCachedProviderFile = internalQuery({
    args: {
        artifactId: v.string(),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        if (!artifact?.providerFiles) {
            return null;
        }

        const providerFile = (artifact.providerFiles as any)[args.provider];
        if (!providerFile) {
            return null;
        }

        // Check if file has expired
        if (providerFile.expiresAt && providerFile.expiresAt < Date.now()) {
            return null;
        }

        return {
            artifactId: args.artifactId,
            provider: args.provider,
            fileId: providerFile.fileId,
            uploadedAt: providerFile.uploadedAt,
            lastUsedAt: providerFile.lastUsedAt,
            expiresAt: providerFile.expiresAt,
            artifact,
        };
    },
});

// Update usage timestamp for cached file
export const updateProviderFileUsage = internalMutation({
    args: {
        artifactId: v.string(),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        if (!artifact?.providerFiles?.[args.provider]) {
            return;
        }

        const now = Date.now();
        const currentProviderFiles = artifact.providerFiles;
        const updatedProviderFiles = {
            ...currentProviderFiles,
            [args.provider]: {
                ...currentProviderFiles[args.provider],
                lastUsedAt: now,
            },
        };

        await ctx.db.patch(artifact._id, {
            providerFiles: updatedProviderFiles,
            usageCount: (artifact.usageCount || 0) + 1,
            lastReferencedAt: now,
        });
    },
});

// Clean up expired provider files
export const cleanupExpiredProviderFiles = internalMutation({
    args: {},
    handler: async (ctx, args) => {
        const now = Date.now();
        const artifacts = await ctx.db.query("artifacts").collect();

        let cleanedCount = 0;

        for (const artifact of artifacts) {
            if (!artifact.providerFiles) continue;

            const updatedProviderFiles = { ...artifact.providerFiles };
            let hasChanges = false;

            // Check each provider's file for expiration
            for (const [provider, fileInfo] of Object.entries(
                updatedProviderFiles
            )) {
                if (fileInfo?.expiresAt && fileInfo.expiresAt < now) {
                    delete updatedProviderFiles[provider];
                    hasChanges = true;
                    cleanedCount++;
                }
            }

            if (hasChanges) {
                await ctx.db.patch(artifact._id, {
                    providerFiles:
                        Object.keys(updatedProviderFiles).length > 0
                            ? updatedProviderFiles
                            : undefined,
                });
            }
        }

        return { cleanedCount };
    },
});

export const getUserArtifacts = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        return await ctx.db
            .query("artifacts")
            .withIndex("by_user", (q) =>
                q.eq("userId", identity.subject as Id<"users">)
            )
            .order("desc")
            .collect();
    },
});
