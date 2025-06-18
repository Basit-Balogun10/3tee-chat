import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Internal version for use in other functions
export const getUserPreferencesInternal = internalQuery({
    args: { userId: v.optional(v.id("users")) },
    handler: async (ctx, args) => {
        const userId = args.userId || (await getAuthUserId(ctx));
        if (!userId) return null;

        const preferences = await ctx.db
            .query("preferences")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first();

        return (
            preferences || {
                defaultModel: "gpt-4o-mini",
                theme: "dark",
                localFirst: false,
                apiKeys: {},
                apiKeyPreferences: {
                    openai: true,
                    anthropic: true,
                    gemini: true,
                    deepseek: true,
                    openrouter: true,
                },
                voiceSettings: {
                    autoPlay: false,
                    voice: "alloy",
                    speed: 1.0,
                    buzzWord: "",
                },
            }
        );
    },
});

// Public version for direct user queries
export const getUserPreferences = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const preferences = await ctx.db
            .query("preferences")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first();

        return (
            preferences || {
                defaultModel: "gpt-4o-mini",
                theme: "dark",
                localFirst: false,
                apiKeys: {},
                apiKeyPreferences: {
                    openai: true,
                    anthropic: true,
                    gemini: true,
                    deepseek: true,
                    openrouter: true,
                },
                voiceSettings: {
                    autoPlay: false,
                    voice: "alloy",
                    speed: 1.0,
                    buzzWord: "",
                },
            }
        );
    },
});

export const updatePreferences = mutation({
    args: {
        defaultModel: v.optional(v.string()),
        theme: v.optional(
            v.union(v.literal("light"), v.literal("dark"), v.literal("system"))
        ),
        localFirst: v.optional(v.boolean()),
        apiKeys: v.optional(
            v.object({
                openai: v.optional(v.string()),
                anthropic: v.optional(v.string()),
                gemini: v.optional(v.string()),
                deepseek: v.optional(v.string()),
                openrouter: v.optional(v.string()),
            })
        ),
        apiKeyPreferences: v.optional(
            v.object({
                openai: v.optional(v.boolean()),
                anthropic: v.optional(v.boolean()),
                gemini: v.optional(v.boolean()),
                deepseek: v.optional(v.boolean()),
                openrouter: v.optional(v.boolean()),
            })
        ),
        voiceSettings: v.optional(
            v.object({
                autoPlay: v.optional(v.boolean()),
                voice: v.optional(v.string()),
                speed: v.optional(v.number()),
                buzzWord: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const existing = await ctx.db
            .query("preferences")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first();

        const updates = Object.fromEntries(
            Object.entries(args).filter(([_, value]) => value !== undefined)
        );

        if (existing) {
            await ctx.db.patch(existing._id, updates);
        } else {
            await ctx.db.insert("preferences", {
                userId,
                ...updates,
            });
        }
    },
});

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
