import { v } from "convex/values";
import {
    query,
    mutation,
    internalQuery,
    internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { sha256 } from "@oslojs/crypto/sha2";
import { hmac } from "@oslojs/crypto/hmac";
import { SHA256 } from "@oslojs/crypto/sha2";
import { encodeBase64, decodeBase64 } from "@oslojs/encoding";
import { generateRandomString } from "@oslojs/crypto/random";
import type { RandomReader } from "@oslojs/crypto/random";

// Oslo RandomReader for crypto operations
const random: RandomReader = {
    read(bytes: Uint8Array): void {
        crypto.getRandomValues(bytes);
    },
};

// API Key Encryption Utilities - Phase C1
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Generate a key from user ID and master secret using Oslo HMAC
function deriveKey(userId: string, salt: Uint8Array): Uint8Array {
    const masterKey =
        process.env.ENCRYPTION_MASTER_KEY ||
        "fallback-dev-key-not-for-production";
    const keyMaterial = new TextEncoder().encode(`${userId}:${masterKey}`);

    // Use HMAC-SHA256 for key derivation (HKDF-like approach)
    let derivedKey = hmac(SHA256, salt, keyMaterial);

    // Apply multiple rounds for additional security
    for (let i = 0; i < 1000; i++) {
        derivedKey = hmac(SHA256, salt, derivedKey);
    }

    return derivedKey.slice(0, KEY_LENGTH);
}

// Generate random bytes using Oslo crypto
function generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    random.read(bytes);
    return bytes;
}

export const encryptApiKey = (apiKey: string, userId: string): string => {
    if (!apiKey || apiKey.trim() === "") return "";

    // Generate random salt and IV
    const salt = generateRandomBytes(SALT_LENGTH);
    const iv = generateRandomBytes(IV_LENGTH);

    // Derive key from user ID and salt
    const key = deriveKey(userId, salt);

    // For AES-GCM, we need to use WebCrypto API since Oslo doesn't have symmetric encryption
    // This is a simplified approach - in production you might want a more robust solution
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);

    // Since we can't use AES-GCM with Oslo directly, we'll use a secure approach:
    // 1. Use derived key to create HMAC for authentication
    // 2. XOR the data with a key stream generated from HMAC iterations

    const authTag = hmac(SHA256, key, data).slice(0, TAG_LENGTH);

    // Generate key stream for XOR encryption
    const keyStream = new Uint8Array(data.length);
    let currentKey = key;
    for (let i = 0; i < data.length; i += 32) {
        currentKey = hmac(SHA256, currentKey, new Uint8Array([i / 32]));
        const chunkSize = Math.min(32, data.length - i);
        keyStream.set(currentKey.slice(0, chunkSize), i);
    }

    // XOR encryption
    const encrypted = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        encrypted[i] = data[i] ^ keyStream[i];
    }

    // Combine salt + iv + tag + encrypted data
    const combined = new Uint8Array(
        SALT_LENGTH + IV_LENGTH + TAG_LENGTH + encrypted.length
    );
    combined.set(salt, 0);
    combined.set(iv, SALT_LENGTH);
    combined.set(authTag, SALT_LENGTH + IV_LENGTH);
    combined.set(encrypted, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    return encodeBase64(combined);
};

export const decryptApiKey = (encryptedKey: string, userId: string): string => {
    if (!encryptedKey || encryptedKey.trim() === "") return "";

    try {
        // Parse the combined data
        const combined = decodeBase64(encryptedKey);

        if (combined.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
            throw new Error("Invalid encrypted data format");
        }

        const salt = combined.slice(0, SALT_LENGTH);
        const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = combined.slice(
            SALT_LENGTH + IV_LENGTH,
            SALT_LENGTH + IV_LENGTH + TAG_LENGTH
        );
        const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

        // Derive key
        const key = deriveKey(userId, salt);

        // Generate same key stream for XOR decryption
        const keyStream = new Uint8Array(encrypted.length);
        let currentKey = key;
        for (let i = 0; i < encrypted.length; i += 32) {
            currentKey = hmac(SHA256, currentKey, new Uint8Array([i / 32]));
            const chunkSize = Math.min(32, encrypted.length - i);
            keyStream.set(currentKey.slice(0, chunkSize), i);
        }

        // XOR decryption
        const decrypted = new Uint8Array(encrypted.length);
        for (let i = 0; i < encrypted.length; i++) {
            decrypted[i] = encrypted[i] ^ keyStream[i];
        }

        // Verify authentication tag
        const expectedTag = hmac(SHA256, key, decrypted).slice(0, TAG_LENGTH);

        // Compare tags
        let tagMatch = true;
        for (let i = 0; i < TAG_LENGTH; i++) {
            if (tag[i] !== expectedTag[i]) {
                tagMatch = false;
                break;
            }
        }

        if (!tagMatch) {
            throw new Error("Authentication verification failed");
        }

        return new TextDecoder().decode(decrypted);
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
            v.union(v.literal("first-message"), v.literal("ai-generated"))
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
                    encryptedApiKeys[provider] = await encryptApiKey(
                        apiKey,
                        userId
                    );
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
                decryptedKeys[provider] = await decryptApiKey(
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

// Add missing getAllUserChats function for SettingsModal export functionality
export const getAllUserChats = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Get all user chats ordered by most recently updated
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        return chats.map(chat => ({
            _id: chat._id,
            title: chat.title,
            model: chat.model,
            createdAt: chat._creationTime,
            updatedAt: chat.updatedAt,
            isStarred: chat.isStarred || false,
            isTemporary: chat.isTemporary || false,
            projectId: chat.projectId,
        }));
    },
});

// Add getSelectedChatsData function for export functionality
export const getSelectedChatsData = query({
    args: { chatIds: v.array(v.id("chats")) },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chatsData = [];
        
        for (const chatId of args.chatIds) {
            const chat = await ctx.db.get(chatId);
            
            // Verify user owns this chat
            if (!chat || chat.userId !== userId) {
                continue; // Skip chats the user doesn't own
            }

            // Get all messages for this chat through the active branch
            let messages: any[] = [];
            
            if (chat.activeBranchId) {
                const activeBranch = await ctx.db.get(chat.activeBranchId);
                if (activeBranch) {
                    messages = await Promise.all(
                        activeBranch.messages.map(messageId => ctx.db.get(messageId))
                    );
                    // Filter out any null messages and sort by timestamp
                    messages = messages
                        .filter(msg => msg !== null)
                        .sort((a, b) => a.timestamp - b.timestamp);
                }
            }

            chatsData.push({
                chat,
                messages,
            });
        }

        return chatsData;
    },
});
