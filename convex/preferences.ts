import { v } from "convex/values";
import {
    query,
    mutation,
    internalQuery,
    internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// API Key Encryption Utilities - Phase C1
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Generate a key from user ID and master secret
function deriveKey(userId: string, salt: Buffer): Buffer {
    const crypto = require("node:crypto");
    const masterKey =
        process.env.ENCRYPTION_MASTER_KEY ||
        "fallback-dev-key-not-for-production";
    return crypto.pbkdf2Sync(
        `${userId}:${masterKey}`,
        salt,
        100000,
        KEY_LENGTH,
        "sha256"
    );
}

export const encryptApiKey = (apiKey: string, userId: string): string => {
    if (!apiKey || apiKey.trim() === "") return "";

    const crypto = require("node:crypto");

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from user ID and salt
    const key = deriveKey(userId, salt);

    // Create cipher
    const cipher = crypto.createCipherGCM(ENCRYPTION_ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(userId)); // Additional authenticated data

    // Encrypt
    let encrypted = cipher.update(apiKey, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);

    return combined.toString("base64");
};

export const decryptApiKey = (encryptedKey: string, userId: string): string => {
    if (!encryptedKey || encryptedKey.trim() === "") return "";

    try {
        const crypto = require("node:crypto");

        // Parse the combined data
        const combined = Buffer.from(encryptedKey, "base64");

        if (combined.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
            throw new Error("Invalid encrypted data format");
        }

        const salt = combined.subarray(0, SALT_LENGTH);
        const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = combined.subarray(
            SALT_LENGTH + IV_LENGTH,
            SALT_LENGTH + IV_LENGTH + TAG_LENGTH
        );
        const encrypted = combined.subarray(
            SALT_LENGTH + IV_LENGTH + TAG_LENGTH
        );

        // Derive key
        const key = deriveKey(userId, salt);

        // Create decipher
        const decipher = crypto.createDecipherGCM(
            ENCRYPTION_ALGORITHM,
            key,
            iv
        );
        decipher.setAAD(Buffer.from(userId));
        decipher.setAuthTag(tag);

        // Decrypt
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString("utf8");
    } catch (error) {
        console.error("Failed to decrypt API key:", error);
        return ""; // Return empty string if decryption fails
    }
};

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
                    together: true, // Add Together.ai default preference
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
                    together: true, // Add Together.ai default preference
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
        chatTitleGeneration: v.optional(
            v.union(
                v.literal("first-message"),
                v.literal("ai-generated")
            )
        ),
        apiKeys: v.optional(
            v.object({
                openai: v.optional(v.string()),
                anthropic: v.optional(v.string()),
                gemini: v.optional(v.string()),
                deepseek: v.optional(v.string()),
                openrouter: v.optional(v.string()),
                together: v.optional(v.string()), // Add Together.ai API key support
            })
        ),
        apiKeyPreferences: v.optional(
            v.object({
                openai: v.optional(v.boolean()),
                anthropic: v.optional(v.boolean()),
                gemini: v.optional(v.boolean()),
                deepseek: v.optional(v.boolean()),
                openrouter: v.optional(v.boolean()),
                together: v.optional(v.boolean()), // Add Together.ai preference support
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

        // Encrypt API keys if provided
        const updates = { ...args };
        if (args.apiKeys) {
            const encryptedApiKeys: any = {};
            for (const [provider, apiKey] of Object.entries(args.apiKeys)) {
                if (apiKey && apiKey.trim() !== "") {
                    encryptedApiKeys[provider] = encryptApiKey(apiKey, userId);
                } else {
                    encryptedApiKeys[provider] = "";
                }
            }
            updates.apiKeys = encryptedApiKeys;
        }

        // Remove undefined values
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        if (existing) {
            await ctx.db.patch(existing._id, cleanUpdates);
        } else {
            await ctx.db.insert("preferences", {
                userId,
                ...cleanUpdates,
            });
        }
    },
});

// Function to get decrypted API keys for AI generation (internal use only)
export const getDecryptedApiKeys = internalQuery({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const preferences = await ctx.db
            .query("preferences")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        if (!preferences?.apiKeys) {
            return {};
        }

        const decryptedKeys: any = {};
        for (const [provider, encryptedKey] of Object.entries(
            preferences.apiKeys
        )) {
            if (encryptedKey && typeof encryptedKey === "string") {
                decryptedKeys[provider] = decryptApiKey(
                    encryptedKey,
                    args.userId
                );
            }
        }

        return decryptedKeys;
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
