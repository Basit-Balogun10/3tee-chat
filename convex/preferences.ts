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
                defaultModel: "gemini-2.0-flash",
                theme: "dark",
                localFirst: false,
                chatTitleGeneration: "first-message", // Add default value
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
                    voice: "aoede",
                    language: "en-US",
                    speed: 1.0,
                    buzzWord: "",
                },
                // Default temporary chat settings - Phase 2
                temporaryChatsSettings: {
                    defaultToTemporary: false, // New chats are permanent by default
                    defaultLifespanHours: 24, // 24 hour default lifespan
                    showExpirationWarnings: true, // Show warnings before expiration
                    autoCleanup: true, // Auto-delete expired temporary chats
                },
                // Default chat lifecycle settings - Phase 2
                chatLifecycleSettings: {
                    autoDeleteEnabled: false, // Disabled by default
                    autoDeleteDays: 30, // 30 days default
                    autoArchiveEnabled: false, // Disabled by default
                    autoArchiveDays: 30, // 30 days default
                },
                // Default notification settings - Phase 2
                notificationSettings: {
                    soundEnabled: false, // Disabled by default
                    soundOnlyWhenUnfocused: true, // Only when tab unfocused
                    soundVolume: 0.5, // Medium volume
                    soundType: "subtle", // Subtle notification sound
                },
                // Default AI settings - Phase 4
                aiSettings: {
                    temperature: 0.7,
                    maxTokens: undefined,
                    systemPrompt: "",
                    responseMode: "balanced",
                    promptEnhancement: false,
                    contextWindow: undefined,
                    topP: 0.9,
                    frequencyPenalty: 0,
                    presencePenalty: 0,
                },
                // Default password settings - Phase 6
                passwordSettings: {
                    defaultPasswordHash: undefined,
                    defaultPasswordSalt: undefined,
                    useDefaultPassword: false,
                    sessionTimeoutEnabled: true,
                    autoLockTimeout: 30,
                    defaultLockNewChats: false,
                },
                customShortcuts: {},
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
                defaultModel: "gemini-2.0-flash",
                theme: "dark",
                localFirst: false,
                chatTitleGeneration: "first-message", // Add default value
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
                    voice: "aoede",
                    language: "en-US",
                    speed: 1.0,
                    buzzWord: "",
                },
                // Default temporary chat settings - Phase 2
                temporaryChatsSettings: {
                    defaultToTemporary: false, // New chats are permanent by default
                    defaultLifespanHours: 24, // 24 hour default lifespan
                    showExpirationWarnings: true, // Show warnings before expiration
                    autoCleanup: true, // Auto-delete expired temporary chats
                },
                // Default chat lifecycle settings - Phase 2
                chatLifecycleSettings: {
                    autoDeleteEnabled: false, // Disabled by default
                    autoDeleteDays: 30, // 30 days default
                    autoArchiveEnabled: false, // Disabled by default
                    autoArchiveDays: 30, // 30 days default
                },
                // Default notification settings - Phase 2
                notificationSettings: {
                    soundEnabled: false, // Disabled by default
                    soundOnlyWhenUnfocused: true, // Only when tab unfocused
                    soundVolume: 0.5, // Medium volume
                    soundType: "subtle", // Subtle notification sound
                },
                // Default AI settings - Phase 4
                aiSettings: {
                    temperature: 0.7,
                    maxTokens: undefined,
                    systemPrompt: "",
                    responseMode: "balanced",
                    promptEnhancement: false,
                    contextWindow: undefined,
                    topP: 0.9,
                    frequencyPenalty: 0,
                    presencePenalty: 0,
                },
                // Default password settings - Phase 6
                passwordSettings: {
                    defaultPasswordHash: undefined,
                    defaultPasswordSalt: undefined,
                    useDefaultPassword: false,
                    sessionTimeoutEnabled: true,
                    autoLockTimeout: 30,
                    defaultLockNewChats: false,
                },
                customShortcuts: {},
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
        chatTitleGeneration: v.optional(
            v.union(v.literal("first-message"), v.literal("ai-generated"))
        ),
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
                language: v.optional(v.string()),
            })
        ),
        // Phase 2: Add temporary chats settings
        temporaryChatsSettings: v.optional(
            v.object({
                defaultToTemporary: v.optional(v.boolean()),
                defaultLifespanHours: v.optional(v.number()),
                showExpirationWarnings: v.optional(v.boolean()),
                autoCleanup: v.optional(v.boolean()),
            })
        ),
        // Phase 2: Add chat lifecycle settings
        chatLifecycleSettings: v.optional(
            v.object({
                autoDeleteEnabled: v.optional(v.boolean()),
                autoDeleteDays: v.optional(v.number()),
                autoArchiveEnabled: v.optional(v.boolean()),
                autoArchiveDays: v.optional(v.number()),
            })
        ),
        // Phase 2: Add notification settings
        notificationSettings: v.optional(
            v.object({
                soundEnabled: v.optional(v.boolean()),
                soundOnlyWhenUnfocused: v.optional(v.boolean()),
                soundVolume: v.optional(v.number()),
                soundType: v.optional(v.string()),
            })
        ),
        // Phase 4: Add AI settings
        aiSettings: v.optional(
            v.object({
                temperature: v.optional(v.number()),
                maxTokens: v.optional(v.number()),
                systemPrompt: v.optional(v.string()),
                responseMode: v.optional(
                    v.union(
                        v.literal("balanced"),
                        v.literal("concise"),
                        v.literal("detailed"),
                        v.literal("creative"),
                        v.literal("analytical"),
                        v.literal("friendly"),
                        v.literal("professional")
                    )
                ),
                promptEnhancement: v.optional(v.boolean()),
                contextWindow: v.optional(v.number()),
                topP: v.optional(v.number()),
                frequencyPenalty: v.optional(v.number()),
                presencePenalty: v.optional(v.number()),
            })
        ),
        // Phase 6: Add password settings
        passwordSettings: v.optional(
            v.object({
                defaultPasswordHash: v.optional(v.string()),
                defaultPasswordSalt: v.optional(v.string()),
                useDefaultPassword: v.optional(v.boolean()),
                sessionTimeoutEnabled: v.optional(v.boolean()),
                autoLockTimeout: v.optional(v.number()),
                defaultLockNewChats: v.optional(v.boolean()),
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

            // FIX: Get messages through branches instead of old index
            const activeBranchId = chat.activeBranchId;
            if (!activeBranchId) {
                chatsData.push({
                    chat,
                    messages: [],
                });
                continue;
            }

            const activeBranch = await ctx.db.get(activeBranchId);
            if (!activeBranch) {
                chatsData.push({
                    chat,
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

            chatsData.push({
                chat,
                messages: validMessages,
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

        // FIX: Delete all messages through branches instead of old index
        for (const chat of chats) {
            // Get all branches for this chat
            const branches = await ctx.db
                .query("branches")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .collect();

            for (const branch of branches) {
                // Delete all messages in this branch
                for (const messageId of branch.messages) {
                    await ctx.db.delete(messageId);
                }
                // Delete the branch itself
                await ctx.db.delete(branch._id);
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

        // Delete all user chats and messages using new branching system
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // FIX: Delete all messages through branches instead of old index
        for (const chat of chats) {
            // Get all branches for this chat
            const branches = await ctx.db
                .query("branches")
                .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
                .collect();

            for (const branch of branches) {
                // Delete all messages in this branch
                for (const messageId of branch.messages) {
                    await ctx.db.delete(messageId);
                }
                // Delete the branch itself
                await ctx.db.delete(branch._id);
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
