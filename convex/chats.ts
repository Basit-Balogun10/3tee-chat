import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listChats = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return { starred: [], regular: [] };

        const allChats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        const starred = allChats.filter((chat) => chat.isStarred);
        const regular = allChats.filter((chat) => !chat.isStarred);

        return { starred, regular };
    },
});

export const searchChats = query({
    args: { query: v.string() },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        return chats.filter((chat) =>
            chat.title.toLowerCase().includes(args.query.toLowerCase())
        );
    },
});

export const getChat = query({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) return null;

        return chat;
    },
});

export const getChatMessages = query({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) return [];

        return await ctx.db
            .query("messages")
            .withIndex("by_chat_and_timestamp", (q) =>
                q.eq("chatId", args.chatId)
            )
            .order("asc")
            .collect();
    },
});

export const createChat = mutation({
    args: {
        title: v.string(),
        model: v.string(),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Ensure user has a default "General" project
        let defaultProjectId = args.projectId;
        if (!defaultProjectId) {
            const defaultProject = await ctx.db
                .query("projects")
                .withIndex("by_default", (q) => q.eq("isDefault", true))
                .filter((q) => q.eq(q.field("userId"), userId))
                .first();

            if (!defaultProject) {
                // Create default project if it doesn't exist
                const now = Date.now();
                defaultProjectId = await ctx.db.insert("projects", {
                    userId,
                    name: "General",
                    description: "Default project for organizing your chats",
                    color: "#8b5cf6",
                    createdAt: now,
                    updatedAt: now,
                    isDefault: true,
                    path: "/general",
                });
            } else {
                defaultProjectId = defaultProject._id;
            }
        }

        // If creating a "New Chat", check if one already exists with no messages
        if (args.title === "New Chat") {
            const existingNewChat = await ctx.db
                .query("chats")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .filter((q) => q.eq(q.field("title"), "New Chat"))
                .first();

            if (existingNewChat) {
                const messages = await ctx.db
                    .query("messages")
                    .withIndex("by_chat", (q) =>
                        q.eq("chatId", existingNewChat._id)
                    )
                    .first();

                if (!messages) {
                    await ctx.db.patch(existingNewChat._id, {
                        updatedAt: Date.now(),
                        model: args.model, // Update model in case it changed
                        projectId: defaultProjectId, // Ensure it's in a project
                    });
                    return existingNewChat._id;
                }
            }
        }

        const now = Date.now();
        return await ctx.db.insert("chats", {
            userId,
            title: args.title,
            model: args.model,
            projectId: defaultProjectId,
            createdAt: now,
            updatedAt: now,
            isStarred: false,
        });
    },
});

export const updateChatTitle = mutation({
    args: {
        chatId: v.id("chats"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        await ctx.db.patch(args.chatId, {
            title: args.title,
            updatedAt: Date.now(),
        });
    },
});

export const toggleChatStar = mutation({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        await ctx.db.patch(args.chatId, {
            isStarred: !chat.isStarred,
            updatedAt: Date.now(),
        });
    },
});

export const branchChat = mutation({
    args: {
        originalChatId: v.id("chats"),
        branchFromMessageId: v.id("messages"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const originalChat = await ctx.db.get(args.originalChatId);
        if (!originalChat || originalChat.userId !== userId) {
            throw new Error("Chat not found");
        }

        const now = Date.now();
        const newChatId = await ctx.db.insert("chats", {
            userId,
            title: args.title,
            model: originalChat.model,
            createdAt: now,
            updatedAt: now,
            isStarred: false,
            parentChatId: args.originalChatId,
            branchPoint: args.branchFromMessageId,
        });

        // Copy messages up to the branch point
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat_and_timestamp", (q) =>
                q.eq("chatId", args.originalChatId)
            )
            .order("asc")
            .collect();

        const branchMessage = await ctx.db.get(args.branchFromMessageId);
        if (!branchMessage) throw new Error("Branch message not found");

        for (const message of messages) {
            if (message.timestamp <= branchMessage.timestamp) {
                await ctx.db.insert("messages", {
                    chatId: newChatId,
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp,
                    model: message.model,
                    attachments: message.attachments,
                });
            }
        }

        return newChatId;
    },
});

export const deleteChat = mutation({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        // Delete all messages in the chat
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .collect();

        for (const message of messages) {
            await ctx.db.delete(message._id);
        }

        // Delete the chat
        await ctx.db.delete(args.chatId);
    },
});

export const forkChatFromMessage = mutation({
    args: {
        messageId: v.id("messages"),
    },
    returns: v.object({
        newChatId: v.id("chats"),
        messageCount: v.number(),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const originalChat = await ctx.db.get(message.chatId);
        if (!originalChat || originalChat.userId !== userId) {
            throw new Error("Chat not found or unauthorized");
        }

        // Get all messages up to and including the fork point
        const messagesToCopy = await ctx.db
            .query("messages")
            .withIndex("by_chat_and_timestamp", (q) =>
                q
                    .eq("chatId", message.chatId)
                    .lte("timestamp", message.timestamp)
            )
            .order("asc")
            .collect();

        // Create new forked chat
        const newChatId = await ctx.db.insert("chats", {
            userId,
            title: `Fork of ${originalChat.title}`,
            model: originalChat.model,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            parentChatId: originalChat._id,
            branchPoint: args.messageId,
        });

        // Copy messages to new chat
        for (const msg of messagesToCopy) {
            await ctx.db.insert("messages", {
                chatId: newChatId,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                model: msg.model,
                attachments: msg.attachments,
                metadata: msg.metadata,
                parentMessageId: msg.parentMessageId,
                branchId: msg.branchId,
                editHistory: msg.editHistory,
            });
        }

        return {
            newChatId,
            messageCount: messagesToCopy.length,
        };
    },
});

// Add these new backend functions for data management
export const getAllUserChats = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        return chats;
    },
});

export const getSelectedChatsData = query({
    args: { chatIds: v.array(v.id("chats")) },
    handler: async (ctx, { chatIds }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chatsData = [];

        for (const chatId of chatIds) {
            const chat = await ctx.db.get(chatId);
            if (!chat || chat.userId !== userId) continue;

            const messages = await ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", chatId))
                .order("asc")
                .collect();

            chatsData.push({
                chat,
                messages,
            });
        }

        return chatsData;
    },
});

export const updateChatModel = mutation({
    args: {
        chatId: v.id("chats"),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        await ctx.db.patch(args.chatId, {
            model: args.model,
            updatedAt: Date.now(),
        });
    },
});

export const deleteAllUserChats = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Get all user chats
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Delete all messages for each chat
        for (const chat of chats) {
            const messages = await ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .collect();

            for (const message of messages) {
                await ctx.db.delete(message._id);
            }

            await ctx.db.delete(chat._id);
        }

        return { deletedChats: chats.length };
    },
});

export const deleteUserAccount = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Delete all user chats and messages (duplicate the logic instead of calling handler)
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Delete all messages for each chat
        for (const chat of chats) {
            const messages = await ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .collect();

            for (const message of messages) {
                await ctx.db.delete(message._id);
            }

            await ctx.db.delete(chat._id);
        }

        // Delete user preferences
        const preferences = await ctx.db
            .query("preferences")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first();

        if (preferences) {
            await ctx.db.delete(preferences._id);
        }

        // Delete the user record itself (name, email, profile data)
        const user = await ctx.db.get(userId);
        if (user) {
            await ctx.db.delete(userId);
        }

        return {
            success: true,
            deletedChats: chats.length,
            deletedUser: true,
        };
    },
});
