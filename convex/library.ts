import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// ========================
// ATTACHMENT LIBRARY MANAGEMENT
// ========================

// Get user's attachment library with filtering and sorting
export const getAttachmentLibrary = query({
    args: {
        type: v.optional(
            v.union(
                v.literal("all"),
                v.literal("image"),
                v.literal("pdf"),
                v.literal("file"),
                v.literal("audio"),
                v.literal("video")
            )
        ),
        sortBy: v.optional(
            v.union(
                v.literal("recent"),
                v.literal("name"),
                v.literal("size"),
                v.literal("usage")
            )
        ),
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
                    q
                        .eq("userId", userId)
                        .eq(
                            "type",
                            args.type as
                                | "image"
                                | "pdf"
                                | "file"
                                | "audio"
                                | "video"
                        )
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
            attachments = attachments.filter(
                (attachment) =>
                    (attachment.displayName || attachment.originalName)
                        .toLowerCase()
                        .includes(searchLower) ||
                    attachment.description
                        ?.toLowerCase()
                        .includes(searchLower) ||
                    attachment.tags?.some((tag) =>
                        tag.toLowerCase().includes(searchLower)
                    )
            );
        }

        // Apply sorting
        const sortBy = args.sortBy || "recent";
        attachments.sort((a, b) => {
            switch (sortBy) {
                case "name":
                    return (a.displayName || a.originalName).localeCompare(
                        b.displayName || b.originalName
                    );
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
        if (args.displayName !== undefined)
            updates.displayName = args.displayName;
        if (args.description !== undefined)
            updates.description = args.description;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.isFavorited !== undefined)
            updates.isFavorited = args.isFavorited;

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
        type: v.optional(
            v.union(
                v.literal("all"),
                v.literal("image"),
                v.literal("video"),
                v.literal("audio")
            )
        ),
        sortBy: v.optional(
            v.union(v.literal("recent"), v.literal("name"), v.literal("usage"))
        ),
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
                    q
                        .eq("userId", userId)
                        .eq("type", args.type as "image" | "video" | "audio")
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
            media = media.filter(
                (item) =>
                    item.title.toLowerCase().includes(searchLower) ||
                    item.description?.toLowerCase().includes(searchLower) ||
                    item.prompt?.toLowerCase().includes(searchLower) ||
                    item.tags?.some((tag) =>
                        tag.toLowerCase().includes(searchLower)
                    )
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
        if (args.description !== undefined)
            updates.description = args.description;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.isFavorited !== undefined)
            updates.isFavorited = args.isFavorited;

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
        sortBy: v.optional(
            v.union(
                v.literal("recent"),
                v.literal("name"),
                v.literal("usage"),
                v.literal("language")
            )
        ),
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
            artifacts = artifacts.filter(
                (artifact) => artifact.language === args.language
            );
        }

        if (args.searchQuery) {
            const searchLower = args.searchQuery.toLowerCase();
            artifacts = artifacts.filter(
                (artifact) =>
                    artifact.filename.toLowerCase().includes(searchLower) ||
                    artifact.description?.toLowerCase().includes(searchLower) ||
                    artifact.content.toLowerCase().includes(searchLower) ||
                    artifact.tags?.some((tag) =>
                        tag.toLowerCase().includes(searchLower)
                    )
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
            .withIndex("by_artifact_id", (q) =>
                q.eq("artifactId", args.artifactId)
            )
            .first();

        if (!artifact || artifact.userId !== userId) {
            throw new Error("Artifact not found or unauthorized");
        }

        const updates: any = { updatedAt: Date.now() };
        if (args.filename !== undefined) updates.filename = args.filename;
        if (args.description !== undefined)
            updates.description = args.description;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.isFavorited !== undefined)
            updates.isFavorited = args.isFavorited;

        await ctx.db.patch(artifact._id, updates);
    },
});

// ========================
// UNIFIED LIBRARY SEARCH FOR "#" COMMAND
// ========================

// PRIORITY 4: Advanced Library Search - Enhanced intelligent search and filtering
export const searchLibraryItems = query({
    args: {
        query: v.optional(v.string()),
        type: v.optional(
            v.union(
                v.literal("all"),
                v.literal("attachment"),
                v.literal("artifact"),
                v.literal("media")
            )
        ),
        limit: v.optional(v.number()),
        chatId: v.optional(v.id("chats")), // For contextual suggestions
        includeRecentlyUsed: v.optional(v.boolean()),
        includePopular: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const searchQuery = args.query?.toLowerCase() || "";
        const limit = args.limit || 20;
        const type = args.type || "all";

        // Search results array with relevance scoring
        let results: Array<{
            type: "attachment" | "artifact" | "media";
            id: string;
            name: string;
            filename: string;
            description?: string;
            createdAt: number;
            updatedAt: number;
            tags?: string[];
            relevanceScore: number;
            isRecentlyUsed?: boolean;
            isPopular?: boolean;
            contextualMatch?: boolean;
            [key: string]: any;
        }> = [];

        // Get contextual information if chatId provided
        let chatContext: string[] = [];
        const recentlyUsedInChat: string[] = [];

        if (args.chatId) {
            try {
                // Get recent messages from chat for context
                const chat = await ctx.db.get(args.chatId);
                if (chat && chat.activeBranchId) {
                    const branch = await ctx.db.get(chat.activeBranchId);
                    if (branch) {
                        const recentMessageIds = branch.messages.slice(-10); // Last 10 messages
                        const messages = await Promise.all(
                            recentMessageIds.map((id) => ctx.db.get(id))
                        );

                        // Extract keywords from recent messages for contextual matching
                        chatContext = messages
                            .filter((m) => m && m.content)
                            .flatMap(
                                (m) =>
                                    m!.content
                                        .toLowerCase()
                                        .split(/\s+/)
                                        .filter((word) => word.length > 3)
                                        .slice(0, 5) // Top 5 words per message
                            );

                        // Get recently used items in this chat
                        messages.forEach((m) => {
                            if (m?.referencedLibraryItems) {
                                recentlyUsedInChat.push(
                                    ...m.referencedLibraryItems.map(
                                        (item) => item.id
                                    )
                                );
                            }
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to get chat context:", error);
            }
        }

        // Helper function to calculate relevance score
        const calculateRelevanceScore = (
            item: any,
            _itemType: string
        ): number => {
            let score = 0;

            // Base score from usage
            const usageCount = item.usageCount || item.referenceCount || 0;
            score += Math.min(usageCount * 2, 20); // Max 20 points from usage

            // Recency boost (more recent = higher score)
            const daysSinceUpdate =
                (Date.now() - item.updatedAt) / (1000 * 60 * 60 * 24);
            score += Math.max(10 - daysSinceUpdate, 0); // Max 10 points for very recent items

            // Search query matching
            if (searchQuery) {
                const name =
                    item.originalName || item.filename || item.title || "";
                const description = item.description || "";
                const tags = (item.tags || []).join(" ");
                const allText = `${name} ${description} ${tags}`.toLowerCase();

                // Exact name match gets highest score
                if (name.toLowerCase() === searchQuery) {
                    score += 50;
                } else if (name.toLowerCase().includes(searchQuery)) {
                    score += 30;
                } else if (description.toLowerCase().includes(searchQuery)) {
                    score += 20;
                } else if (tags.toLowerCase().includes(searchQuery)) {
                    score += 15;
                } else if (allText.includes(searchQuery)) {
                    score += 10;
                }

                // Fuzzy matching for typos (simple implementation)
                const searchWords = searchQuery.split(" ");
                const textWords = allText.split(" ");
                let fuzzyMatches = 0;
                searchWords.forEach((searchWord) => {
                    textWords.forEach((textWord) => {
                        if (
                            textWord.includes(searchWord) ||
                            searchWord.includes(textWord)
                        ) {
                            fuzzyMatches++;
                        }
                    });
                });
                score += fuzzyMatches * 2;
            } else {
                // No search query - boost popular and recent items
                score += usageCount > 5 ? 15 : 0;
                score += daysSinceUpdate < 7 ? 10 : 0;
            }

            // Contextual relevance (if chat context available)
            let contextualMatch = false;
            let isRecentlyUsed = false;
            let isPopular = false;

            if (chatContext.length > 0) {
                const itemText =
                    `${item.originalName || item.filename || item.title} ${item.description || ""}`.toLowerCase();
                const contextMatches = chatContext.filter((word) =>
                    itemText.includes(word)
                ).length;
                score += contextMatches * 5; // 5 points per context match

                if (contextMatches > 0) {
                    contextualMatch = true;
                }
            }

            // Recently used in this chat gets boost
            if (recentlyUsedInChat.includes(item._id || item.artifactId)) {
                score += 25;
                isRecentlyUsed = true;
            }

            // Favorites get boost
            if (item.isFavorited) {
                score += 15;
            }

            // Popular items boost
            if (usageCount > 10) {
                isPopular = true;
                score += 10;
            }

            // Store flags on item for later use
            item.contextualMatch = contextualMatch;
            item.isRecentlyUsed = isRecentlyUsed;
            item.isPopular = isPopular;

            return score;
        };

        // 1. Search attachmentLibrary
        if (type === "all" || type === "attachment") {
            const attachments = await ctx.db
                .query("attachmentLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect();

            const filteredAttachments = attachments
                .filter((item) => {
                    if (!searchQuery) return true;
                    const searchableText =
                        `${item.originalName} ${item.displayName || ""} ${item.description || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
                    return searchableText.includes(searchQuery);
                })
                .map((item) => {
                    const relevanceScore = calculateRelevanceScore(
                        item,
                        "attachment"
                    );

                    return {
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
                        fileType: item.type,
                        usageCount: item.usageCount || 0,
                        relevanceScore,
                        isRecentlyUsed: (item as any).isRecentlyUsed,
                        isPopular: (item as any).isPopular,
                        contextualMatch: (item as any).contextualMatch,
                    };
                });

            results.push(...filteredAttachments);
        }

        // 2. Search artifacts
        if (type === "all" || type === "artifact") {
            const artifacts = await ctx.db
                .query("artifacts")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect();

            const filteredArtifacts = artifacts
                .filter((item) => {
                    if (!searchQuery) return true;
                    const searchableText =
                        `${item.filename} ${item.description || ""} ${item.language} ${(item.tags || []).join(" ")} ${item.content.substring(0, 200)}`.toLowerCase();
                    return searchableText.includes(searchQuery);
                })
                .map((item) => {
                    const relevanceScore = calculateRelevanceScore(
                        item,
                        "artifact"
                    );

                    return {
                        type: "artifact" as const,
                        id: item.artifactId,
                        name: item.filename,
                        filename: item.filename,
                        description:
                            item.description || `${item.language} file`,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        tags: item.tags,
                        language: item.language,
                        usageCount: item.usageCount || 0,
                        referenceCount: item.referenceCount || 0,
                        relevanceScore,
                        isRecentlyUsed: (item as any).isRecentlyUsed,
                        isPopular: (item as any).isPopular,
                        contextualMatch: (item as any).contextualMatch,
                        contentPreview: item.content.substring(0, 100) + "...",
                    };
                });

            results.push(...filteredArtifacts);
        }

        // 3. Search mediaLibrary
        if (type === "all" || type === "media") {
            const mediaItems = await ctx.db
                .query("mediaLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect();

            const filteredMedia = mediaItems
                .filter((item) => {
                    if (!searchQuery) return true;
                    const searchableText =
                        `${item.title} ${item.description || ""} ${item.prompt || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
                    return searchableText.includes(searchQuery);
                })
                .map((item) => {
                    const relevanceScore = calculateRelevanceScore(
                        item,
                        "media"
                    );

                    return {
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
                        relevanceScore,
                        isRecentlyUsed: (item as any).isRecentlyUsed,
                        isPopular: (item as any).isPopular,
                        contextualMatch: (item as any).contextualMatch,
                        prompt: item.prompt,
                        model: item.model,
                    };
                });

            results.push(...filteredMedia);
        }

        // Sort by relevance score (highest first), then by recency
        results.sort((a, b) => {
            if (a.relevanceScore !== b.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }
            return b.updatedAt - a.updatedAt;
        });

        // Apply filtering based on options
        if (args.includeRecentlyUsed && !args.includePopular) {
            results = results.filter((item) => item.isRecentlyUsed);
        } else if (args.includePopular && !args.includeRecentlyUsed) {
            results = results.filter((item) => item.isPopular);
        } else if (args.includeRecentlyUsed && args.includePopular) {
            results = results.filter(
                (item) => item.isRecentlyUsed || item.isPopular
            );
        }

        // Return top results with metadata for UI
        const topResults = results.slice(0, limit);

        // Add search metadata for better UX
        const metadata = {
            totalResults: results.length,
            hasContextualMatches: results.some((r) => r.contextualMatch),
            hasRecentlyUsed: results.some((r) => r.isRecentlyUsed),
            hasPopular: results.some((r) => r.isPopular),
            searchQuery,
            chatContext: chatContext.length > 0,
        };

        return {
            results: topResults,
            metadata,
        };
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
            const attachment = await ctx.db.get(
                args.itemId as Id<"attachmentLibrary">
            );
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
                .withIndex("by_artifact_id", (q) =>
                    q.eq("artifactId", args.itemId)
                )
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
            ctx.db
                .query("attachmentLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db
                .query("artifacts")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db
                .query("mediaLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
        ]);

        return {
            attachments: {
                total: attachments.length,
                favorites: attachments.filter((a) => a.isFavorited).length,
                totalSize: attachments.reduce((sum, a) => sum + a.size, 0),
                byType: {
                    image: attachments.filter((a) => a.type === "image").length,
                    pdf: attachments.filter((a) => a.type === "pdf").length,
                    file: attachments.filter((a) => a.type === "file").length,
                    audio: attachments.filter((a) => a.type === "audio").length,
                    video: attachments.filter((a) => a.type === "video").length,
                },
            },
            artifacts: {
                total: artifacts.length,
                favorites: artifacts.filter((a) => a.isFavorited).length,
                totalReferences: artifacts.reduce(
                    (sum, a) => sum + (a.referenceCount || 0),
                    0
                ),
                byLanguage: artifacts.reduce(
                    (acc, a) => {
                        acc[a.language] = (acc[a.language] || 0) + 1;
                        return acc;
                    },
                    {} as Record<string, number>
                ),
            },
            media: {
                total: media.length,
                favorites: media.filter((m) => m.isFavorited).length,
                totalReferences: media.reduce(
                    (sum, m) => sum + (m.referenceCount || 0),
                    0
                ),
                byType: {
                    image: media.filter((m) => m.type === "image").length,
                    video: media.filter((m) => m.type === "video").length,
                    audio: media.filter((m) => m.type === "audio").length,
                },
            },
        };
    },
});

// Helper to get single attachment library item (internal use)
export const getAttachmentLibraryItem = query({
    args: {
        attachmentId: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const attachment = await ctx.db.get(
            args.attachmentId as Id<"attachmentLibrary">
        );
        if (!attachment || attachment.userId !== userId) {
            return null;
        }

        return attachment;
    },
});

// Helper to get single media library item (internal use)
export const getMediaLibraryItem = query({
    args: {
        mediaId: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const media = await ctx.db.get(args.mediaId as Id<"mediaLibrary">);
        if (!media || media.userId !== userId) {
            return null;
        }

        return media;
    },
});
