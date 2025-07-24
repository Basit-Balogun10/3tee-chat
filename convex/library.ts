import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// ========================
// ATTACHMENT LIBRARY MANAGEMENT
// ========================

// Get user's attachment library with filtering and sorting
export const getAttachmentLibrary = query({
    args: {
        type: v.optional(v.union(
            v.literal("all"),
            v.literal("image"),
            v.literal("pdf"),
            v.literal("file"),
            v.literal("audio"),
            v.literal("video")
        )),
        sortBy: v.optional(v.union(
            v.literal("recent"),
            v.literal("name"),
            v.literal("size"),
            v.literal("usage")
        )),
        favoriteOnly: v.optional(v.boolean()),
        searchQuery: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        let query = ctx.db
            .query("attachmentLibrary")
            .withIndex("by_user", (q) => q.eq("userId", userId));

        // Filter by type
        if (args.type && args.type !== "all") {
            query = ctx.db
                .query("attachmentLibrary")
                .withIndex("by_user_type", (q) => 
                    q.eq("userId", userId).eq("type", args.type)
                );
        }

        // Filter by favorites
        if (args.favoriteOnly) {
            query = ctx.db
                .query("attachmentLibrary")
                .withIndex("by_user_favorited", (q) => 
                    q.eq("userId", userId).eq("isFavorited", true)
                );
        }

        let attachments = await query.collect();

        // Apply search filter
        if (args.searchQuery) {
            const searchLower = args.searchQuery.toLowerCase();
            attachments = attachments.filter(attachment => 
                (attachment.displayName || attachment.originalName).toLowerCase().includes(searchLower) ||
                attachment.description?.toLowerCase().includes(searchLower) ||
                attachment.tags?.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Apply sorting
        const sortBy = args.sortBy || "recent";
        attachments.sort((a, b) => {
            switch (sortBy) {
                case "name":
                    return (a.displayName || a.originalName).localeCompare(b.displayName || b.originalName);
                case "size":
                    return b.size - a.size;
                case "usage":
                    return (b.usageCount || 0) - (a.usageCount || 0);
                case "recent":
                default:
                    return b.updatedAt - a.updatedAt;
            }
        });

        return attachments;
    },
});

// Add attachment to library when uploaded
export const addToAttachmentLibrary = mutation({
    args: {
        storageId: v.id("_storage"),
        originalName: v.string(),
        displayName: v.optional(v.string()),
        type: v.union(
            v.literal("image"),
            v.literal("pdf"),
            v.literal("file"),
            v.literal("audio"),
            v.literal("video")
        ),
        mimeType: v.string(),
        size: v.number(),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const now = Date.now();
        
        return await ctx.db.insert("attachmentLibrary", {
            userId,
            storageId: args.storageId,
            originalName: args.originalName,
            displayName: args.displayName,
            type: args.type,
            mimeType: args.mimeType,
            size: args.size,
            description: args.description,
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
            isFavorited: false,
            usageCount: 0,
        });
    },
});

// Update attachment library item
export const updateAttachmentLibraryItem = mutation({
    args: {
        attachmentId: v.id("attachmentLibrary"),
        displayName: v.optional(v.string()),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        isFavorited: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const attachment = await ctx.db.get(args.attachmentId);
        if (!attachment || attachment.userId !== userId) {
            throw new Error("Attachment not found or unauthorized");
        }

        const updates: any = { updatedAt: Date.now() };
        if (args.displayName !== undefined) updates.displayName = args.displayName;
        if (args.description !== undefined) updates.description = args.description;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.isFavorited !== undefined) updates.isFavorited = args.isFavorited;

        await ctx.db.patch(args.attachmentId, updates);
    },
});

// Delete attachment from library
export const deleteAttachmentLibraryItem = mutation({
    args: {
        attachmentId: v.id("attachmentLibrary"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const attachment = await ctx.db.get(args.attachmentId);
        if (!attachment || attachment.userId !== userId) {
            throw new Error("Attachment not found or unauthorized");
        }

        // Remove from all active chat attachments
        const activeAttachments = await ctx.db
            .query("chatActiveAttachments")
            .withIndex("by_attachment_library", (q) => 
                q.eq("attachmentLibraryId", args.attachmentId)
            )
            .collect();

        for (const active of activeAttachments) {
            await ctx.db.delete(active._id);
        }

        // Delete the storage file
        await ctx.storage.delete(attachment.storageId);
        
        // Delete the library entry
        await ctx.db.delete(args.attachmentId);
    },
});

// ========================
// MEDIA LIBRARY MANAGEMENT
// ========================

// Get user's media library
export const getMediaLibrary = query({
    args: {
        type: v.optional(v.union(
            v.literal("all"),
            v.literal("image"),
            v.literal("video"),
            v.literal("audio")
        )),
        sortBy: v.optional(v.union(
            v.literal("recent"),
            v.literal("name"),
            v.literal("usage")
        )),
        favoriteOnly: v.optional(v.boolean()),
        searchQuery: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        let query = ctx.db
            .query("mediaLibrary")
            .withIndex("by_user", (q) => q.eq("userId", userId));

        // Filter by type
        if (args.type && args.type !== "all") {
            query = ctx.db
                .query("mediaLibrary")
                .withIndex("by_user_type", (q) => 
                    q.eq("userId", userId).eq("type", args.type)
                );
        }

        // Filter by favorites
        if (args.favoriteOnly) {
            query = ctx.db
                .query("mediaLibrary")
                .withIndex("by_user_favorited", (q) => 
                    q.eq("userId", userId).eq("isFavorited", true)
                );
        }

        let media = await query.collect();

        // Apply search filter
        if (args.searchQuery) {
            const searchLower = args.searchQuery.toLowerCase();
            media = media.filter(item => 
                item.title.toLowerCase().includes(searchLower) ||
                item.description?.toLowerCase().includes(searchLower) ||
                item.prompt?.toLowerCase().includes(searchLower) ||
                item.tags?.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Apply sorting
        const sortBy = args.sortBy || "recent";
        media.sort((a, b) => {
            switch (sortBy) {
                case "name":
                    return a.title.localeCompare(b.title);
                case "usage":
                    return (b.referenceCount || 0) - (a.referenceCount || 0);
                case "recent":
                default:
                    return b.updatedAt - a.updatedAt;
            }
        });

        return media;
    },
});

// Add media to library (typically called when AI generates media)
export const addToMediaLibrary = mutation({
    args: {
        type: v.union(
            v.literal("image"),
            v.literal("video"),
            v.literal("audio")
        ),
        title: v.string(),
        description: v.optional(v.string()),
        sourceMessageId: v.optional(v.id("messages")),
        sourceChatId: v.optional(v.id("chats")),
        storageId: v.optional(v.id("_storage")),
        externalUrl: v.optional(v.string()),
        thumbnailStorageId: v.optional(v.id("_storage")),
        thumbnailUrl: v.optional(v.string()),
        prompt: v.optional(v.string()),
        model: v.optional(v.string()),
        generationParams: v.optional(v.any()),
        metadata: v.optional(v.any()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const now = Date.now();
        
        return await ctx.db.insert("mediaLibrary", {
            userId,
            type: args.type,
            title: args.title,
            description: args.description,
            sourceMessageId: args.sourceMessageId,
            sourceChatId: args.sourceChatId,
            storageId: args.storageId,
            externalUrl: args.externalUrl,
            thumbnailStorageId: args.thumbnailStorageId,
            thumbnailUrl: args.thumbnailUrl,
            prompt: args.prompt,
            model: args.model,
            generationParams: args.generationParams,
            metadata: args.metadata,
            tags: args.tags || [],
            createdAt: now,
            updatedAt: now,
            isFavorited: false,
            referenceCount: 0,
            referencedInChats: [],
        });
    },
});

// Update media library item
export const updateMediaLibraryItem = mutation({
    args: {
        mediaId: v.id("mediaLibrary"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        isFavorited: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const media = await ctx.db.get(args.mediaId);
        if (!media || media.userId !== userId) {
            throw new Error("Media not found or unauthorized");
        }

        const updates: any = { updatedAt: Date.now() };
        if (args.title !== undefined) updates.title = args.title;
        if (args.description !== undefined) updates.description = args.description;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.isFavorited !== undefined) updates.isFavorited = args.isFavorited;

        await ctx.db.patch(args.mediaId, updates);
    },
});

// Delete media from library
export const deleteMediaLibraryItem = mutation({
    args: {
        mediaId: v.id("mediaLibrary"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const media = await ctx.db.get(args.mediaId);
        if (!media || media.userId !== userId) {
            throw new Error("Media not found or unauthorized");
        }

        // Remove from all active chat attachments
        const activeAttachments = await ctx.db
            .query("chatActiveAttachments")
            .withIndex("by_media_library", (q) => 
                q.eq("mediaLibraryId", args.mediaId)
            )
            .collect();

        for (const active of activeAttachments) {
            await ctx.db.delete(active._id);
        }

        // Delete storage files if they exist
        if (media.storageId) {
            await ctx.storage.delete(media.storageId);
        }
        if (media.thumbnailStorageId) {
            await ctx.storage.delete(media.thumbnailStorageId);
        }
        
        // Delete the library entry
        await ctx.db.delete(args.mediaId);
    },
});

// ========================
// ARTIFACT LIBRARY MANAGEMENT
// ========================

// Get user's artifact library (enhanced existing artifacts)
export const getArtifactLibrary = query({
    args: {
        sortBy: v.optional(v.union(
            v.literal("recent"),
            v.literal("name"),
            v.literal("usage"),
            v.literal("language")
        )),
        favoriteOnly: v.optional(v.boolean()),
        searchQuery: v.optional(v.string()),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        let query = ctx.db
            .query("artifacts")
            .withIndex("by_user", (q) => q.eq("userId", userId));

        // Filter by favorites
        if (args.favoriteOnly) {
            query = ctx.db
                .query("artifacts")
                .withIndex("by_user_favorited", (q) => 
                    q.eq("userId", userId).eq("isFavorited", true)
                );
        }

        let artifacts = await query.collect();

        // Apply filters
        if (args.language) {
            artifacts = artifacts.filter(artifact => artifact.language === args.language);
        }

        if (args.searchQuery) {
            const searchLower = args.searchQuery.toLowerCase();
            artifacts = artifacts.filter(artifact => 
                artifact.filename.toLowerCase().includes(searchLower) ||
                artifact.description?.toLowerCase().includes(searchLower) ||
                artifact.content.toLowerCase().includes(searchLower) ||
                artifact.tags?.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Apply sorting
        const sortBy = args.sortBy || "recent";
        artifacts.sort((a, b) => {
            switch (sortBy) {
                case "name":
                    return a.filename.localeCompare(b.filename);
                case "usage":
                    return (b.referenceCount || 0) - (a.referenceCount || 0);
                case "language":
                    return a.language.localeCompare(b.language);
                case "recent":
                default:
                    return b.updatedAt - a.updatedAt;
            }
        });

        return artifacts;
    },
});

// Update artifact library properties
export const updateArtifactLibraryItem = mutation({
    args: {
        artifactId: v.string(),
        filename: v.optional(v.string()),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        isFavorited: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const artifact = await ctx.db
            .query("artifacts")
            .withIndex("by_artifact_id", (q) => q.eq("artifactId", args.artifactId))
            .first();

        if (!artifact || artifact.userId !== userId) {
            throw new Error("Artifact not found or unauthorized");
        }

        const updates: any = { updatedAt: Date.now() };
        if (args.filename !== undefined) updates.filename = args.filename;
        if (args.description !== undefined) updates.description = args.description;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.isFavorited !== undefined) updates.isFavorited = args.isFavorited;

        await ctx.db.patch(artifact._id, updates);
    },
});

// ========================
// CHAT ACTIVE ATTACHMENTS MANAGEMENT
// ========================

// Get active attachments for a chat
export const getChatActiveAttachments = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const activeAttachments = await ctx.db
            .query("chatActiveAttachments")
            .withIndex("by_chat_active", (q) => 
                q.eq("chatId", args.chatId).eq("isActive", true)
            )
            .collect();

        // Sort by order
        activeAttachments.sort((a, b) => (a.order || 0) - (b.order || 0));

        // Populate full attachment data
        const populatedAttachments = await Promise.all(
            activeAttachments.map(async (active) => {
                let fullData = null;

                if (active.attachmentLibraryId) {
                    fullData = await ctx.db.get(active.attachmentLibraryId);
                } else if (active.artifactId) {
                    fullData = await ctx.db
                        .query("artifacts")
                        .withIndex("by_artifact_id", (q) => q.eq("artifactId", active.artifactId))
                        .first();
                } else if (active.mediaLibraryId) {
                    fullData = await ctx.db.get(active.mediaLibraryId);
                }

                return {
                    ...active,
                    fullData,
                };
            })
        );

        return populatedAttachments.filter(item => item.fullData !== null);
    },
});

// Add item to chat's active attachments
export const addToChatActiveAttachments = mutation({
    args: {
        chatId: v.id("chats"),
        type: v.union(
            v.literal("attachment"),
            v.literal("artifact"),
            v.literal("media")
        ),
        attachmentLibraryId: v.optional(v.id("attachmentLibrary")),
        artifactId: v.optional(v.string()),
        mediaLibraryId: v.optional(v.id("mediaLibrary")),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Verify chat access
        const chat = await ctx.db.get(args.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Chat not found or unauthorized");
        }

        const now = Date.now();

        // Check if already active
        const existing = await ctx.db
            .query("chatActiveAttachments")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .filter((q) => {
                if (args.attachmentLibraryId) {
                    return q.eq(q.field("attachmentLibraryId"), args.attachmentLibraryId);
                } else if (args.artifactId) {
                    return q.eq(q.field("artifactId"), args.artifactId);
                } else if (args.mediaLibraryId) {
                    return q.eq(q.field("mediaLibraryId"), args.mediaLibraryId);
                }
                return false;
            })
            .first();

        if (existing) {
            // Reactivate if exists but inactive
            if (!existing.isActive) {
                await ctx.db.patch(existing._id, {
                    isActive: true,
                    lastUsedAt: now,
                });
            }
            return existing._id;
        }

        // Get next order position
        const maxOrder = await ctx.db
            .query("chatActiveAttachments")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .collect()
            .then(items => Math.max(0, ...items.map(item => item.order || 0)));

        return await ctx.db.insert("chatActiveAttachments", {
            chatId: args.chatId,
            userId,
            type: args.type,
            attachmentLibraryId: args.attachmentLibraryId,
            artifactId: args.artifactId,
            mediaLibraryId: args.mediaLibraryId,
            name: args.name,
            isActive: true,
            addedAt: now,
            order: maxOrder + 1,
        });
    },
});

// Remove item from chat's active attachments
export const removeFromChatActiveAttachments = mutation({
    args: {
        chatId: v.id("chats"),
        activeAttachmentId: v.id("chatActiveAttachments"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const activeAttachment = await ctx.db.get(args.activeAttachmentId);
        if (!activeAttachment || 
            activeAttachment.chatId !== args.chatId || 
            activeAttachment.userId !== userId) {
            throw new Error("Active attachment not found or unauthorized");
        }

        await ctx.db.patch(args.activeAttachmentId, {
            isActive: false,
        });
    },
});

// Reorder chat active attachments
export const reorderChatActiveAttachments = mutation({
    args: {
        chatId: v.id("chats"),
        orderedIds: v.array(v.id("chatActiveAttachments")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Verify all attachments belong to user and chat
        const attachments = await Promise.all(
            args.orderedIds.map(id => ctx.db.get(id))
        );

        for (const attachment of attachments) {
            if (!attachment || 
                attachment.chatId !== args.chatId || 
                attachment.userId !== userId) {
                throw new Error("Unauthorized attachment in reorder");
            }
        }

        // Update order
        for (let i = 0; i < args.orderedIds.length; i++) {
            await ctx.db.patch(args.orderedIds[i], {
                order: i + 1,
            });
        }
    },
});

// ========================
// UNIFIED LIBRARY SEARCH FOR "#" COMMAND
// ========================

// Search across all library types for "#" command integration
export const searchLibraryItems = query({
    args: {
        query: v.optional(v.string()),
        type: v.optional(v.union(
            v.literal("all"),
            v.literal("attachment"),
            v.literal("artifact"),
            v.literal("media")
        )),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const searchQuery = args.query?.toLowerCase() || "";
        const limit = args.limit || 20;
        const type = args.type || "all";

        // Search results array
        let results: any[] = [];

        // 1. Search attachmentLibrary
        if (type === "all" || type === "attachment") {
            const attachments = await ctx.db
                .query("attachmentLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect();

            const filteredAttachments = attachments
                .filter(item => {
                    if (!searchQuery) return true;
                    return (
                        item.originalName.toLowerCase().includes(searchQuery) ||
                        item.displayName?.toLowerCase().includes(searchQuery) ||
                        item.description?.toLowerCase().includes(searchQuery) ||
                        item.tags?.some(tag => tag.toLowerCase().includes(searchQuery))
                    );
                })
                .map(item => ({
                    type: "attachment" as const,
                    id: item._id,
                    name: item.displayName || item.originalName,
                    filename: item.displayName || item.originalName,
                    description: item.description || `${item.type} file`,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    tags: item.tags,
                    size: item.size,
                    mimeType: item.mimeType,
                    usageCount: item.usageCount || 0,
                }));

            results.push(...filteredAttachments);
        }

        // 2. Search artifacts
        if (type === "all" || type === "artifact") {
            const artifacts = await ctx.db
                .query("artifacts")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect();

            const filteredArtifacts = artifacts
                .filter(item => {
                    if (!searchQuery) return true;
                    return (
                        item.filename.toLowerCase().includes(searchQuery) ||
                        item.description?.toLowerCase().includes(searchQuery) ||
                        item.language.toLowerCase().includes(searchQuery) ||
                        item.tags?.some(tag => tag.toLowerCase().includes(searchQuery))
                    );
                })
                .map(item => ({
                    type: "artifact" as const,
                    id: item.artifactId,
                    name: item.filename,
                    filename: item.filename,
                    description: item.description || `${item.language} file`,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    tags: item.tags,
                    language: item.language,
                    usageCount: item.usageCount || 0,
                    referenceCount: item.referenceCount || 0,
                }));

            results.push(...filteredArtifacts);
        }

        // 3. Search mediaLibrary
        if (type === "all" || type === "media") {
            const mediaItems = await ctx.db
                .query("mediaLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect();

            const filteredMedia = mediaItems
                .filter(item => {
                    if (!searchQuery) return true;
                    return (
                        item.title.toLowerCase().includes(searchQuery) ||
                        item.description?.toLowerCase().includes(searchQuery) ||
                        item.prompt?.toLowerCase().includes(searchQuery) ||
                        item.tags?.some(tag => tag.toLowerCase().includes(searchQuery))
                    );
                })
                .map(item => ({
                    type: "media" as const,
                    id: item._id,
                    name: item.title,
                    filename: item.title,
                    description: item.description || `${item.type} media`,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    tags: item.tags,
                    mediaType: item.type,
                    referenceCount: item.referenceCount || 0,
                }));

            results.push(...filteredMedia);
        }

        // Sort by usage/relevance and limit results
        results.sort((a, b) => {
            // Sort by usage count first, then by recency
            const usageA = a.usageCount || a.referenceCount || 0;
            const usageB = b.usageCount || b.referenceCount || 0;
            
            if (usageA !== usageB) {
                return usageB - usageA; // Higher usage first
            }
            
            return b.updatedAt - a.updatedAt; // More recent first
        });

        return results.slice(0, limit);
    },
});

// Track usage when library items are referenced
export const trackLibraryItemUsage = mutation({
    args: {
        type: v.union(
            v.literal("attachment"),
            v.literal("artifact"),
            v.literal("media")
        ),
        itemId: v.string(),
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const now = Date.now();

        if (args.type === "attachment") {
            const attachment = await ctx.db.get(args.itemId as Id<"attachmentLibrary">);
            if (attachment && attachment.userId === userId) {
                const currentChats = attachment.usedInChats || [];
                const updatedChats = currentChats.includes(args.chatId) 
                    ? currentChats 
                    : [...currentChats, args.chatId];

                await ctx.db.patch(attachment._id, {
                    usedInChats: updatedChats,
                    usageCount: (attachment.usageCount || 0) + 1,
                    lastUsedAt: now,
                });
            }
        } else if (args.type === "artifact") {
            const artifact = await ctx.db
                .query("artifacts")
                .withIndex("by_artifact_id", (q) => q.eq("artifactId", args.itemId))
                .first();

            if (artifact && artifact.userId === userId) {
                const currentChats = artifact.referencedInChats || [];
                const updatedChats = currentChats.includes(args.chatId) 
                    ? currentChats 
                    : [...currentChats, args.chatId];

                await ctx.db.patch(artifact._id, {
                    referencedInChats: updatedChats,
                    referenceCount: (artifact.referenceCount || 0) + 1,
                    lastReferencedAt: now,
                });
            }
        } else if (args.type === "media") {
            const media = await ctx.db.get(args.itemId as Id<"mediaLibrary">);
            if (media && media.userId === userId) {
                const currentChats = media.referencedInChats || [];
                const updatedChats = currentChats.includes(args.chatId) 
                    ? currentChats 
                    : [...currentChats, args.chatId];

                await ctx.db.patch(media._id, {
                    referencedInChats: updatedChats,
                    referenceCount: (media.referenceCount || 0) + 1,
                    lastReferencedAt: now,
                });
            }
        }
    },
});

// Get library statistics for dashboard
export const getLibraryStats = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const [attachments, artifacts, media] = await Promise.all([
            ctx.db.query("attachmentLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db.query("artifacts")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db.query("mediaLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
        ]);

        return {
            attachments: {
                total: attachments.length,
                favorites: attachments.filter(a => a.isFavorited).length,
                totalSize: attachments.reduce((sum, a) => sum + a.size, 0),
                byType: {
                    image: attachments.filter(a => a.type === "image").length,
                    pdf: attachments.filter(a => a.type === "pdf").length,
                    file: attachments.filter(a => a.type === "file").length,
                    audio: attachments.filter(a => a.type === "audio").length,
                    video: attachments.filter(a => a.type === "video").length,
                },
            },
            artifacts: {
                total: artifacts.length,
                favorites: artifacts.filter(a => a.isFavorited).length,
                totalReferences: artifacts.reduce((sum, a) => sum + (a.referenceCount || 0), 0),
                byLanguage: artifacts.reduce((acc, a) => {
                    acc[a.language] = (acc[a.language] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
            },
            media: {
                total: media.length,
                favorites: media.filter(m => m.isFavorited).length,
                totalReferences: media.reduce((sum, m) => sum + (m.referenceCount || 0), 0),
                byType: {
                    image: media.filter(m => m.type === "image").length,
                    video: media.filter(m => m.type === "video").length,
                    audio: media.filter(m => m.type === "audio").length,
                },
            },
        };
    },
});