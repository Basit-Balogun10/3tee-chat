import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Enhanced chat sharing with collaboration modes
export const createChatShare = mutation({
    args: {
        chatId: v.id("chats"),
        shareMode: v.union(v.literal("read-only"), v.literal("collaboration")),
        expiresAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        const shareId = crypto.randomUUID();

        // Update chat with share info directly
        await ctx.db.patch(args.chatId, {
            shareId,
            isPublic: true,
            shareMode: args.shareMode,
            sharedAt: Date.now(),
            viewCount: 0,
            updatedAt: Date.now(),
        });

        return shareId;
    },
});

export const updateChatShareMode = mutation({
    args: {
        chatId: v.id("chats"),
        shareMode: v.union(v.literal("read-only"), v.literal("collaboration")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        await ctx.db.patch(args.chatId, {
            shareMode: args.shareMode,
            updatedAt: Date.now(),
        });
    },
});

export const getSharedChat = query({
    args: { shareId: v.string() },
    handler: async (ctx, args) => {
        const chat = await ctx.db
            .query("chats")
            .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
            .first();

        if (!chat || !chat.isPublic) return null;

        // FIX: Get messages through branches instead of old index
        const activeBranchId = chat.activeBranchId;
        if (!activeBranchId) return { chat, messages: [] };

        const activeBranch = await ctx.db.get(activeBranchId);
        if (!activeBranch) return { chat, messages: [] };

        // Get messages from baseMessages + activeBranch.messages
        const baseMessageIds = chat.baseMessages || [];
        const branchMessageIds = activeBranch.messages || [];
        const allMessageIds = [...baseMessageIds, ...branchMessageIds];

        const messages = await Promise.all(
            allMessageIds.map((messageId) => ctx.db.get(messageId))
        );

        const validMessages = messages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        return {
            chat,
            messages: validMessages,
        };
    },
});

export const getSharedProject = query({
    args: { shareId: v.string() },
    handler: async (ctx, args) => {
        const project = await ctx.db
            .query("projects")
            .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
            .first();

        if (!project || !project.isPublic) return null;

        // Get all chats in the project
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .order("desc")
            .collect();

        // Get messages for each chat using new branching system
        const chatsWithMessages = [];
        for (const chat of chats) {
            // FIX: Get messages through branches instead of old index
            const activeBranchId = chat.activeBranchId;
            if (!activeBranchId) {
                chatsWithMessages.push({
                    ...chat,
                    messages: [],
                });
                continue;
            }

            const activeBranch = await ctx.db.get(activeBranchId);
            if (!activeBranch) {
                chatsWithMessages.push({
                    ...chat,
                    messages: [],
                });
                continue;
            }

            // Get messages from baseMessages + activeBranch.messages
            const baseMessageIds = chat.baseMessages || [];
            const branchMessageIds = activeBranch.messages || [];
            const allMessageIds = [...baseMessageIds, ...branchMessageIds];

            const messages = await Promise.all(
                allMessageIds.map((messageId) => ctx.db.get(messageId))
            );

            const validMessages = messages
                .filter((msg) => msg !== null)
                .sort((a, b) => a.timestamp - b.timestamp);

            chatsWithMessages.push({
                ...chat,
                messages: validMessages,
            });
        }

        // Get nested projects too
        const nestedProjects = await ctx.db
            .query("projects")
            .withIndex("by_parent", (q) => q.eq("parentId", project._id))
            .collect();

        return {
            project,
            chats: chatsWithMessages,
            nestedProjects,
        };
    },
});

export const incrementViewCount = mutation({
    args: {
        shareId: v.string(),
        type: v.optional(v.union(v.literal("chat"), v.literal("project"))),
    },
    handler: async (ctx, args) => {
        if (args.type === "project") {
            const project = await ctx.db
                .query("projects")
                .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
                .first();

            if (project) {
                await ctx.db.patch(project._id, {
                    viewCount: (project.viewCount || 0) + 1,
                });
            }
        } else {
            const chat = await ctx.db
                .query("chats")
                .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
                .first();

            if (chat) {
                await ctx.db.patch(chat._id, {
                    viewCount: (chat.viewCount || 0) + 1,
                });
            }
        }
    },
});

export const revokeChatShare = mutation({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        await ctx.db.patch(args.chatId, {
            shareId: undefined,
            isPublic: false,
            shareMode: undefined,
            updatedAt: Date.now(),
        });
    },
});

export const revokeProjectShare = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const project = await ctx.db.get(args.projectId);
        if (!project || project.userId !== userId) {
            throw new Error("Project not found");
        }

        await ctx.db.patch(args.projectId, {
            shareId: undefined,
            isPublic: false,
            shareMode: undefined,
            updatedAt: Date.now(),
        });
    },
});

// Check if user can access shared content
export const canAccessSharedContent = query({
    args: {
        shareId: v.string(),
        type: v.union(v.literal("chat"), v.literal("project")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);

        if (args.type === "project") {
            const project = await ctx.db
                .query("projects")
                .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
                .first();

            if (!project) return { canAccess: false, reason: "not_found" };
            if (!project.isPublic)
                return { canAccess: false, reason: "not_public" };

            return {
                canAccess: true,
                isOwner: userId === project.userId,
                shareMode: project.shareMode,
                canCollaborate: project.shareMode === "collaboration",
            };
        } else {
            const chat = await ctx.db
                .query("chats")
                .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
                .first();

            if (!chat) return { canAccess: false, reason: "not_found" };
            if (!chat.isPublic)
                return { canAccess: false, reason: "not_public" };

            return {
                canAccess: true,
                isOwner: userId === chat.userId,
                shareMode: chat.shareMode,
                canCollaborate: chat.shareMode === "collaboration",
            };
        }
    },
});

// Project sharing functions
export const shareProject = mutation({
    args: {
        projectId: v.id("projects"),
        shareMode: v.union(v.literal("read-only"), v.literal("collaboration")),
        expiresAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const project = await ctx.db.get(args.projectId);
        if (!project || project.userId !== userId) {
            throw new Error("Project not found");
        }

        const shareId = crypto.randomUUID();

        // Update project with share info directly
        await ctx.db.patch(args.projectId, {
            shareId,
            isPublic: true,
            shareMode: args.shareMode,
            sharedAt: Date.now(),
            viewCount: 0,
            updatedAt: Date.now(),
        });

        return shareId;
    },
});

// Fork entire project (simplified without separate tables)
export const forkProject = internalMutation({
    args: {
        projectId: v.id("projects"),
        newName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const originalProject = await ctx.db.get(args.projectId);
        if (!originalProject) {
            throw new Error("Project not found");
        }

        // Create new forked project
        const now = Date.now();
        const forkedProjectId = await ctx.db.insert("projects", {
            userId: originalProject.userId, // Use original project's userId for internal calls
            name: args.newName || `Fork of ${originalProject.name}`,
            description: `Forked from ${originalProject.name}`,
            color: originalProject.color || "#8b5cf6",
            createdAt: now,
            updatedAt: now,
            path: `/${(args.newName || `fork-of-${originalProject.name}`).toLowerCase().replace(/\s+/g, "-")}`,
            parentProjectId: args.projectId,
            forkedAt: now,
        });

        // Fork all chats in the project
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();

        let totalMessages = 0;

        for (const chat of chats) {
            const forkedChatId = await ctx.db.insert("chats", {
                userId: originalProject.userId, // Use original project's userId
                title: chat.title,
                model: chat.model,
                projectId: forkedProjectId,
                createdAt: now,
                updatedAt: now,
                isStarred: false,
                parentChatId: chat._id,
                // NEW BRANCHING SYSTEM FIELDS
                baseMessages: [],
                activeMessages: [],
            });

            // PHASE 1: Create main branch for forked chat
            const mainBranchId = await ctx.db.insert("branches", {
                chatId: forkedChatId,
                fromMessageId: undefined,
                messages: [],
                isMain: true,
                createdAt: now,
                updatedAt: now,
                branchName: "Main",
                description: "Main conversation thread",
            });

            // FIX: Get messages through branches instead of old index
            const activeBranchId = chat.activeBranchId;
            if (!activeBranchId) continue;

            const activeBranch = await ctx.db.get(activeBranchId);
            if (!activeBranch) continue;

            // Get messages from baseMessages + activeBranch.messages
            const baseMessageIds = chat.baseMessages || [];
            const branchMessageIds = activeBranch.messages || [];
            const allMessageIds = [...baseMessageIds, ...branchMessageIds];

            const messages = await Promise.all(
                allMessageIds.map((messageId) => ctx.db.get(messageId))
            );

            const validMessages = messages
                .filter((msg) => msg !== null)
                .sort((a, b) => a.timestamp - b.timestamp);

            totalMessages += validMessages.length;

            // Copy messages to new branch
            const copiedMessageIds = [];
            for (const message of validMessages) {
                const newMessageId = await ctx.db.insert("messages", {
                    branchId: mainBranchId, // Messages belong to branches now
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp,
                    model: message.model,
                    attachments: message.attachments,
                    metadata: message.metadata,
                    branches: [mainBranchId],
                    activeBranchId: mainBranchId,
                });
                copiedMessageIds.push(newMessageId);
            }

            // Update branch with copied messages
            await ctx.db.patch(mainBranchId, {
                messages: copiedMessageIds,
                updatedAt: now,
            });

            // Update chat with active branch and messages
            await ctx.db.patch(forkedChatId, {
                activeBranchId: mainBranchId,
                activeMessages: copiedMessageIds,
            });
        }

        return {
            projectId: forkedProjectId,
            chatCount: chats.length,
            messageCount: totalMessages,
        };
    },
});

// Public wrapper for forkProject
export const forkProjectPublic = mutation({
    args: {
        projectId: v.id("projects"),
        newName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const originalProject = await ctx.db.get(args.projectId);
        if (!originalProject) {
            throw new Error("Project not found");
        }

        // Create new forked project
        const now = Date.now();
        const forkedProjectId = await ctx.db.insert("projects", {
            userId,
            name: args.newName || `Fork of ${originalProject.name}`,
            description: `Forked from ${originalProject.name}`,
            color: originalProject.color || "#8b5cf6",
            createdAt: now,
            updatedAt: now,
            path: `/${(args.newName || `fork-of-${originalProject.name}`).toLowerCase().replace(/\s+/g, "-")}`,
            parentProjectId: args.projectId,
            forkedAt: now,
        });

        // Fork all chats in the project
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();

        let totalMessages = 0;

        for (const chat of chats) {
            const forkedChatId = await ctx.db.insert("chats", {
                userId,
                title: chat.title,
                model: chat.model,
                projectId: forkedProjectId,
                createdAt: now,
                updatedAt: now,
                isStarred: false,
                parentChatId: chat._id,
                // NEW BRANCHING SYSTEM FIELDS
                baseMessages: [],
                activeMessages: [],
            });

            // PHASE 1: Create main branch for forked chat
            const mainBranchId = await ctx.db.insert("branches", {
                chatId: forkedChatId,
                fromMessageId: undefined,
                messages: [],
                isMain: true,
                createdAt: now,
                updatedAt: now,
                branchName: "Main",
                description: "Main conversation thread",
            });

            // FIX: Get messages through branches instead of old index
            const activeBranchId = chat.activeBranchId;
            if (!activeBranchId) continue;

            const activeBranch = await ctx.db.get(activeBranchId);
            if (!activeBranch) continue;

            // Get messages from baseMessages + activeBranch.messages
            const baseMessageIds = chat.baseMessages || [];
            const branchMessageIds = activeBranch.messages || [];
            const allMessageIds = [...baseMessageIds, ...branchMessageIds];

            const messages = await Promise.all(
                allMessageIds.map((messageId) => ctx.db.get(messageId))
            );

            const validMessages = messages
                .filter((msg) => msg !== null)
                .sort((a, b) => a.timestamp - b.timestamp);

            totalMessages += validMessages.length;

            // Copy messages to new branch
            const copiedMessageIds = [];
            for (const message of validMessages) {
                const newMessageId = await ctx.db.insert("messages", {
                    branchId: mainBranchId, // Messages belong to branches now
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp,
                    model: message.model,
                    attachments: message.attachments,
                    metadata: message.metadata,
                    branches: [mainBranchId],
                    activeBranchId: mainBranchId,
                });
                copiedMessageIds.push(newMessageId);
            }

            // Update branch with copied messages
            await ctx.db.patch(mainBranchId, {
                messages: copiedMessageIds,
                updatedAt: now,
            });

            // Update chat with active branch and messages
            await ctx.db.patch(forkedChatId, {
                activeBranchId: mainBranchId,
                activeMessages: copiedMessageIds,
            });
        }

        return {
            projectId: forkedProjectId,
            chatCount: chats.length,
            messageCount: totalMessages,
        };
    },
});

// Phase 3: Share Link Handling Functions

// Validate and handle share link access
export const handleShareLinkAccess = mutation({
    args: {
        shareId: v.string(),
        type: v.union(v.literal("chat"), v.literal("project")),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ chatId?: any; projectId?: any; action: string }> => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        if (args.type === "chat") {
            const chat = await ctx.db
                .query("chats")
                .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
                .first();

            if (!chat || !chat.isPublic) {
                throw new Error("Share link not found or no longer public");
            }

            // If user is owner, just return the chat ID
            if (chat.userId === userId) {
                return { chatId: chat._id, action: "owner_access" };
            }

            // Handle based on share mode
            if (chat.shareMode === "read-only") {
                // Auto-fork for read-only shares
                const forkedChatId = await forkChatForUser(
                    ctx,
                    chat._id,
                    userId
                );
                return { chatId: forkedChatId, action: "forked" };
            } else if (chat.shareMode === "collaboration") {
                // Add to shared chats array
                await addToSharedChats(ctx, userId, chat._id);
                return { chatId: chat._id, action: "added_to_shared" };
            }
        } else {
            const project = await ctx.db
                .query("projects")
                .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
                .first();

            if (!project || !project.isPublic) {
                throw new Error("Share link not found or no longer public");
            }

            // If user is owner, just return the project ID
            if (project.userId === userId) {
                return { projectId: project._id, action: "owner_access" };
            }

            // Handle based on share mode
            if (project.shareMode === "read-only") {
                // Auto-fork for read-only shares
                const forkedProject: {
                    projectId: any;
                    chatCount: number;
                    messageCount: number;
                } = await ctx.runMutation(internal.sharing.forkProject, {
                    projectId: project._id,
                    newName: `Fork of ${project.name}`,
                });
                return { projectId: forkedProject.projectId, action: "forked" };
            } else if (project.shareMode === "collaboration") {
                // Add to shared projects array
                await addToSharedProjects(ctx, userId, project._id);
                return { projectId: project._id, action: "added_to_shared" };
            }
        }

        throw new Error("Invalid share mode");
    },
});

// Helper function to fork a chat for a user
async function forkChatForUser(ctx: any, originalChatId: any, userId: any) {
    const originalChat = await ctx.db.get(originalChatId);
    if (!originalChat) throw new Error("Original chat not found");

    const now = Date.now();
    const forkedChatId = await ctx.db.insert("chats", {
        userId,
        title: `Fork of ${originalChat.title}`,
        model: originalChat.model,
        projectId: originalChat.projectId,
        createdAt: now,
        updatedAt: now,
        parentChatId: originalChatId,
        // NEW BRANCHING SYSTEM FIELDS
        baseMessages: [],
        activeMessages: [],
    });

    // PHASE 1: Create main branch for forked chat
    const mainBranchId = await ctx.db.insert("branches", {
        chatId: forkedChatId,
        fromMessageId: undefined,
        messages: [],
        isMain: true,
        createdAt: now,
        updatedAt: now,
        branchName: "Main",
        description: "Main conversation thread",
    });

    // FIX: Get messages through branches instead of old index
    const activeBranchId = originalChat.activeBranchId;
    if (!activeBranchId) {
        // Update chat with active branch
        await ctx.db.patch(forkedChatId, {
            activeBranchId: mainBranchId,
        });
        return forkedChatId;
    }

    const activeBranch = await ctx.db.get(activeBranchId);
    if (!activeBranch) {
        // Update chat with active branch
        await ctx.db.patch(forkedChatId, {
            activeBranchId: mainBranchId,
        });
        return forkedChatId;
    }

    // Get messages from baseMessages + activeBranch.messages
    const baseMessageIds = originalChat.baseMessages || [];
    const branchMessageIds = activeBranch.messages || [];
    const allMessageIds = [...baseMessageIds, ...branchMessageIds];

    const messages = await Promise.all(
        allMessageIds.map((messageId) => ctx.db.get(messageId))
    );

    const validMessages = messages
        .filter((msg) => msg !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

    // Copy messages to new branch
    const copiedMessageIds = [];
    for (const message of validMessages) {
        const newMessageId = await ctx.db.insert("messages", {
            branchId: mainBranchId, // Messages belong to branches now
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            model: message.model,
            attachments: message.attachments,
            metadata: message.metadata,
            branches: [mainBranchId],
            activeBranchId: mainBranchId,
        });
        copiedMessageIds.push(newMessageId);
    }

    // Update branch with copied messages
    await ctx.db.patch(mainBranchId, {
        messages: copiedMessageIds,
        updatedAt: now,
    });

    // Update chat with active branch and messages
    await ctx.db.patch(forkedChatId, {
        activeBranchId: mainBranchId,
        activeMessages: copiedMessageIds,
    });

    return forkedChatId;
}

// Helper function to add chat to user's shared chats array
async function addToSharedChats(ctx: any, userId: any, chatId: any) {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const sharedChats = user.sharedChats || [];
    if (!sharedChats.includes(chatId)) {
        await ctx.db.patch(userId, {
            sharedChats: [...sharedChats, chatId],
        });
    }
}

// Helper function to add project to user's shared projects array
async function addToSharedProjects(ctx: any, userId: any, projectId: any) {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const sharedProjects = user.sharedProjects || [];
    if (!sharedProjects.includes(projectId)) {
        await ctx.db.patch(userId, {
            sharedProjects: [...sharedProjects, projectId],
        });
    }
}

// Remove from shared arrays when content becomes unshared
export const removeFromSharedContent = mutation({
    args: {
        contentId: v.id("chats"),
        type: v.union(v.literal("chat"), v.literal("project")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const user = await ctx.db.get(userId);
        if (!user) throw new Error("User not found");

        if (args.type === "chat") {
            const sharedChats = user.sharedChats || [];
            const updatedSharedChats = sharedChats.filter(
                (id: any) => id !== args.contentId
            );
            await ctx.db.patch(userId, {
                sharedChats: updatedSharedChats,
            });
        } else {
            const sharedProjects = user.sharedProjects || [];
            const updatedSharedProjects = sharedProjects.filter(
                (id: any) => id !== args.contentId
            );
            await ctx.db.patch(userId, {
                sharedProjects: updatedSharedProjects,
            });
        }
    },
});

// Get user's shared content
export const getUserSharedContent = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return { sharedChats: [], sharedProjects: [] };

        const user = await ctx.db.get(userId);
        if (!user) return { sharedChats: [], sharedProjects: [] };

        const sharedChats = [];
        const sharedProjects = [];

        // Get shared chats with validation
        if (user.sharedChats) {
            for (const chatId of user.sharedChats) {
                const chat = await ctx.db.get(chatId);
                if (
                    chat &&
                    chat.isPublic &&
                    chat.shareMode === "collaboration"
                ) {
                    sharedChats.push(chat);
                }
            }
        }

        // Get shared projects with validation
        if (user.sharedProjects) {
            for (const projectId of user.sharedProjects) {
                const project = await ctx.db.get(projectId);
                if (
                    project &&
                    project.isPublic &&
                    project.shareMode === "collaboration"
                ) {
                    sharedProjects.push(project);
                }
            }
        }

        return { sharedChats, sharedProjects };
    },
});

// Clean up shared content
export const cleanupSharedContent = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const user = await ctx.db.get(userId);
        if (!user) throw new Error("User not found");

        const validSharedChats = [];
        const validSharedProjects = [];

        // Validate shared chats
        if (user.sharedChats) {
            for (const chatId of user.sharedChats) {
                const chat = await ctx.db.get(chatId);
                if (
                    chat &&
                    chat.isPublic &&
                    chat.shareMode === "collaboration"
                ) {
                    validSharedChats.push(chatId);
                }
            }
        }

        // Validate shared projects
        if (user.sharedProjects) {
            for (const projectId of user.sharedProjects) {
                const project = await ctx.db.get(projectId);
                if (
                    project &&
                    project.isPublic &&
                    project.shareMode === "collaboration"
                ) {
                    validSharedProjects.push(projectId);
                }
            }
        }

        // Update user with cleaned arrays
        await ctx.db.patch(userId, {
            sharedChats: validSharedChats,
            sharedProjects: validSharedProjects,
        });

        return {
            removedChats:
                (user.sharedChats?.length || 0) - validSharedChats.length,
            removedProjects:
                (user.sharedProjects?.length || 0) - validSharedProjects.length,
        };
    },
});
