import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Create default "General" project for new users
export const createDefaultProject = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Check if user already has a default project
        const existingDefault = await ctx.db
            .query("projects")
            .withIndex("by_default", (q) => q.eq("isDefault", true))
            .filter((q) => q.eq(q.field("userId"), userId))
            .first();

        if (existingDefault) return existingDefault._id;

        const now = Date.now();
        return await ctx.db.insert("projects", {
            userId,
            name: "General",
            description: "Default project for organizing your chats",
            color: "#8b5cf6",
            createdAt: now,
            updatedAt: now,
            isDefault: true,
            path: "/general",
        });
    },
});

export const listProjects = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        return await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) => q.neq(q.field("isArchived"), true))
            .order("desc")
            .collect();
    },
});

// Get project tree structure
export const getProjectTree = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return { projects: [], tree: {} };

        const projects = await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) => q.neq(q.field("isArchived"), true))
            .collect();

        // Build tree structure
        const tree: Record<string, any> = {};
        const rootProjects: any[] = [];

        // First pass: create all nodes
        projects.forEach((project) => {
            tree[project._id] = {
                ...project,
                children: [],
                chats: [],
            };
        });

        // Second pass: build parent-child relationships
        projects.forEach((project) => {
            if (project.parentId && tree[project.parentId]) {
                tree[project.parentId].children.push(tree[project._id]);
            } else {
                rootProjects.push(tree[project._id]);
            }
        });

        // Third pass: add chats to each project
        for (const project of projects) {
            const chats = await ctx.db
                .query("chats")
                .withIndex("by_project", (q) => q.eq("projectId", project._id))
                .filter((q) => q.eq(q.field("userId"), userId))
                .order("desc")
                .collect();

            if (tree[project._id]) {
                tree[project._id].chats = chats;
            }
        }

        return { projects: rootProjects, tree };
    },
});

export const createProject = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()),
        color: v.optional(v.string()),
        parentId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Validate parent project belongs to user
        if (args.parentId) {
            const parentProject = await ctx.db.get(args.parentId);
            if (!parentProject || parentProject.userId !== userId) {
                throw new Error("Parent project not found");
            }
        }

        // Generate path for nested structure
        let path = `/${args.name.toLowerCase().replace(/\s+/g, "-")}`;
        if (args.parentId) {
            const parentProject = await ctx.db.get(args.parentId);
            if (parentProject?.path) {
                path = `${parentProject.path}${path}`;
            }
        }

        const now = Date.now();
        return await ctx.db.insert("projects", {
            userId,
            name: args.name,
            description: args.description,
            color: args.color || "#8b5cf6",
            parentId: args.parentId,
            path,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateProject = mutation({
    args: {
        projectId: v.id("projects"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        color: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const project = await ctx.db.get(args.projectId);
        if (!project || project.userId !== userId) {
            throw new Error("Project not found");
        }

        // Prevent updating default project name
        if (project.isDefault && args.name && args.name !== "General") {
            throw new Error("Cannot rename the default General project");
        }

        const updates = Object.fromEntries(
            Object.entries(args).filter(
                ([key, value]) => key !== "projectId" && value !== undefined
            )
        );

        await ctx.db.patch(args.projectId, {
            ...updates,
            updatedAt: Date.now(),
        });
    },
});

export const moveProject = mutation({
    args: {
        projectId: v.id("projects"),
        newParentId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const project = await ctx.db.get(args.projectId);
        if (!project || project.userId !== userId) {
            throw new Error("Project not found");
        }

        // Prevent moving default project
        if (project.isDefault) {
            throw new Error("Cannot move the default General project");
        }

        // Validate new parent
        if (args.newParentId) {
            const newParent = await ctx.db.get(args.newParentId);
            if (!newParent || newParent.userId !== userId) {
                throw new Error("New parent project not found");
            }

            // Prevent circular references
            if (args.newParentId === args.projectId) {
                throw new Error("Cannot move project to itself");
            }
        }

        // Update path
        let newPath = `/${project.name.toLowerCase().replace(/\s+/g, "-")}`;
        if (args.newParentId) {
            const newParent = await ctx.db.get(args.newParentId);
            if (newParent?.path) {
                newPath = `${newParent.path}${newPath}`;
            }
        }

        await ctx.db.patch(args.projectId, {
            parentId: args.newParentId,
            path: newPath,
            updatedAt: Date.now(),
        });
    },
});

export const deleteProject = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const project = await ctx.db.get(args.projectId);
        if (!project || project.userId !== userId) {
            throw new Error("Project not found");
        }

        // Prevent deleting default project
        if (project.isDefault) {
            throw new Error("Cannot delete the default General project");
        }

        // Get default project to move chats to
        const defaultProject = await ctx.db
            .query("projects")
            .withIndex("by_default", (q) => q.eq("isDefault", true))
            .filter((q) => q.eq(q.field("userId"), userId))
            .first();

        // Move all chats in this project to default project
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();

        for (const chat of chats) {
            await ctx.db.patch(chat._id, {
                projectId: defaultProject?._id,
                updatedAt: Date.now(),
            });
        }

        // Move all child projects to root level
        const childProjects = await ctx.db
            .query("projects")
            .withIndex("by_parent", (q) => q.eq("parentId", args.projectId))
            .collect();

        for (const child of childProjects) {
            await ctx.db.patch(child._id, {
                parentId: undefined,
                path: `/${child.name.toLowerCase().replace(/\s+/g, "-")}`,
                updatedAt: Date.now(),
            });
        }

        await ctx.db.delete(args.projectId);
    },
});

export const getProjectChats = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const project = await ctx.db.get(args.projectId);
        if (!project || project.userId !== userId) return [];

        return await ctx.db
            .query("chats")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();
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

export const unshareProject = mutation({
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

// Fork entire project (simplified)
export const forkProject = mutation({
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
            });

            // Copy all messages
            const messages = await ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .order("asc")
                .collect();

            totalMessages += messages.length;

            for (const message of messages) {
                await ctx.db.insert("messages", {
                    chatId: forkedChatId,
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp,
                    model: message.model,
                    attachments: message.attachments,
                    metadata: message.metadata,
                });
            }
        }

        return {
            projectId: forkedProjectId,
            chatCount: chats.length,
            messageCount: totalMessages,
        };
    },
});

// Move chats between projects
export const moveChatToProject = mutation({
    args: {
        chatId: v.id("chats"),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        // If no projectId provided, move to default "General" project
        let targetProjectId = args.projectId;
        if (!targetProjectId) {
            const defaultProject = await ctx.db
                .query("projects")
                .withIndex("by_default", (q) => q.eq("isDefault", true))
                .filter((q) => q.eq(q.field("userId"), userId))
                .first();

            if (!defaultProject) {
                // Create default project if it doesn't exist
                targetProjectId = await ctx.db.insert("projects", {
                    userId,
                    name: "General",
                    description: "Default project for organizing your chats",
                    color: "#8b5cf6",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    isDefault: true,
                    path: "/general",
                });
            } else {
                targetProjectId = defaultProject._id;
            }
        } else {
            // Validate target project belongs to user
            const targetProject = await ctx.db.get(args.projectId!);
            if (!targetProject || targetProject.userId !== userId) {
                throw new Error("Target project not found");
            }
        }

        await ctx.db.patch(args.chatId, {
            projectId: targetProjectId,
            updatedAt: Date.now(),
        });

        return { success: true, targetProjectId };
    },
});

// Enhanced backend functions for project and workspace export
export const getProjectWithAllChats = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const project = await ctx.db.get(args.projectId);
        if (!project || project.userId !== userId) {
            throw new Error("Project not found");
        }

        // Get all chats in this project
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();

        // Get messages for each chat
        const chatsWithMessages = [];
        for (const chat of chats) {
            const messages = await ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .order("asc")
                .collect();

            chatsWithMessages.push({
                chat,
                messages,
            });
        }

        // Get nested projects
        const childProjects = await ctx.db
            .query("projects")
            .withIndex("by_parent", (q) => q.eq("parentId", args.projectId))
            .collect();

        return {
            project,
            chatsWithMessages,
            childProjects,
            statistics: {
                totalChats: chats.length,
                totalMessages: chatsWithMessages.reduce(
                    (sum, c) => sum + c.messages.length,
                    0
                ),
                totalCharacters: chatsWithMessages.reduce(
                    (sum, c) =>
                        sum +
                        c.messages.reduce(
                            (mSum, m) => mSum + m.content.length,
                            0
                        ),
                    0
                ),
            },
        };
    },
});

export const getFullWorkspaceExport = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Get all projects
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Get all chats
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Get all messages for all chats
        const allMessages = [];
        const chatsWithMessages = [];

        for (const chat of chats) {
            const messages = await ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .order("asc")
                .collect();

            allMessages.push(...messages);
            chatsWithMessages.push({
                chat,
                messages,
            });
        }

        // Get user preferences
        const preferences = await ctx.db
            .query("preferences")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first();

        return {
            user: { id: userId },
            projects,
            chatsWithMessages,
            preferences,
            exportedAt: Date.now(),
            statistics: {
                totalProjects: projects.length,
                totalChats: chats.length,
                totalMessages: allMessages.length,
                totalCharacters: allMessages.reduce(
                    (sum, m) => sum + m.content.length,
                    0
                ),
                starredChats: chats.filter((c) => c.isStarred).length,
                modelsUsed: [...new Set(chats.map((c) => c.model))],
            },
        };
    },
});
