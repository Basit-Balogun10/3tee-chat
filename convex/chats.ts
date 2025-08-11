import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { generateRandomString } from "@oslojs/crypto/random";
import type { RandomReader } from "@oslojs/crypto/random";
import type { Doc } from "./_generated/dataModel"; // added for strong typing

// Oslo RandomReader for crypto operations
const random: RandomReader = {
    read(bytes: Uint8Array): void {
        crypto.getRandomValues(bytes);
    },
};

// Generate secure salt using oslo/crypto
function generateSalt(): string {
    const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return generateRandomString(random, alphabet, 32);
}

// Hash password using oslo/crypto SHA-256 with iterations
function hashPassword(password: string, salt: string): string {
    const passwordBytes = new TextEncoder().encode(password);
    const saltBytes = new TextEncoder().encode(salt);

    // Combine password and salt
    const combined = new Uint8Array(passwordBytes.length + saltBytes.length);
    combined.set(passwordBytes);
    combined.set(saltBytes, passwordBytes.length);

    // Apply multiple iterations of SHA-256 for security (PBKDF2-like)
    let hash = combined;
    for (let i = 0; i < 100000; i++) {
        hash = sha256(hash);
    }

    return encodeHexLowerCase(hash);
}

// Verify password function using same hash algorithm
async function verifyPassword(password: string, chat: any): Promise<boolean> {
    const hashedInput = hashPassword(password, chat.passwordSalt);
    return hashedInput === chat.passwordHash;
}

export const listChats = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId)
            return {
                starred: [],
                regular: [],
                archived: [],
                temporary: [],
                protected: [],
            };

        const allChats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        // Filter chats by category with protected chats section
        const archived = allChats.filter((chat) => chat.isArchived);
        const temporary = allChats.filter(
            (chat) => chat.isTemporary && !chat.isArchived
        );
        const nonArchivedPermanent = allChats.filter(
            (chat) => !chat.isArchived && !chat.isTemporary
        );

        const starred = nonArchivedPermanent.filter((chat) => chat.isStarred);
        const passwordProtected = nonArchivedPermanent.filter(
            (chat) => chat.isPasswordProtected && !chat.isStarred
        );
        const regular = nonArchivedPermanent.filter(
            (chat) => !chat.isStarred && !chat.isPasswordProtected
        );

        return {
            starred,
            regular,
            archived,
            temporary,
            protected: passwordProtected,
        };
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
        if (!chat || (chat.userId !== userId && !chat.isPublic)) return null;

        return chat;
    },
});

export const getChatMessages = query({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const chat = await ctx.db.get(args.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) return [];

        // NEW BRANCHING SYSTEM: Get messages from active branch
        // PHASE 2: Core message retrieval with efficient querying
        const activeBranchId = chat.activeBranchId;
        if (!activeBranchId) return [];

        const activeBranch = await ctx.db.get(activeBranchId);
        if (!activeBranch) return [];

        // Combine baseMessages + activeBranch.messages efficiently
        const baseMessageIds = chat.baseMessages || [];
        const branchMessageIds = activeBranch.messages || [];
        const allMessageIds = [...baseMessageIds, ...branchMessageIds];

        // Single query to get all messages - more efficient than old approach
        const messages = await Promise.all(
            allMessageIds.map((messageId) => ctx.db.get(messageId))
        );

        // Filter out null messages and sort by timestamp
        const validMessages = messages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        // // Auto-populate artifacts for messages that reference them in metadata
        // const messagesWithArtifacts = await Promise.all(
        //     validMessages.map(async (message) => {
        //         if (
        //             message.metadata?.artifacts &&
        //             message.metadata.artifacts.length > 0
        //         ) {
        //             // Get full artifact objects for the artifact IDs stored in metadata
        //             const artifacts = await Promise.all(
        //                 message.metadata.artifacts.map(async (artifactId) => {
        //                     // Get artifact by _id since metadata.artifacts contains artifact _ids
        //                     const artifact = await ctx.db.get(artifactId);
        //                     return artifact;
        //                 })
        //             );

        //             // Filter out any null artifacts (in case of cleanup/deletion)
        //             const validArtifacts = artifacts.filter(Boolean);

        //             return {
        //                 ...message,
        //                 // Add populated artifacts field for frontend convenience
        //                 artifacts: validArtifacts,
        //             };
        //         }
        //         return message;
        //     })
        // );

        return validMessages;
    },
});

export const createChat = mutation({
    args: {
        title: v.string(),
        model: v.string(),
        projectId: v.optional(v.id("projects")),
    },
    handler: async (ctx, args): Promise<any> => {
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

        // Fetch user preferences for password protection
        const preferences = await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal,
            { userId }
        );

        let isPasswordProtected = false;
        let passwordHash, passwordSalt;
        if (
            preferences?.passwordSettings?.useDefaultPassword &&
            preferences?.passwordSettings?.defaultPasswordHash &&
            preferences?.passwordSettings?.defaultPasswordSalt
        ) {
            isPasswordProtected = true;
            passwordHash = preferences.passwordSettings.defaultPasswordHash;
            passwordSalt = preferences.passwordSettings.defaultPasswordSalt;
        }

        // If creating a "New Chat", check if one already exists with no messages
        if (args.title === "New Chat") {
            const existingNewChat = await ctx.db
                .query("chats")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .filter((q) => q.eq(q.field("title"), "New Chat"))
                .first();

            if (existingNewChat) {
                // Check if chat has any messages using the new branching system
                const activeBranch = existingNewChat.activeBranchId
                    ? await ctx.db.get(existingNewChat.activeBranchId)
                    : null;

                const hasMessages =
                    (existingNewChat.baseMessages?.length ?? 0) > 0 ||
                    (activeBranch?.messages?.length ?? 0) > 0;

                if (!hasMessages) {
                    await ctx.db.patch(existingNewChat._id, {
                        updatedAt: Date.now(),
                        model: args.model, // Update model in case it changed
                        projectId: defaultProjectId, // Ensure it's in a project
                        isPasswordProtected,
                        passwordHash,
                        passwordSalt,
                    });
                    return existingNewChat._id;
                }
            }
        }

        const now = Date.now();
        const chatId = await ctx.db.insert("chats", {
            userId,
            title: args.title,
            model: args.model,
            projectId: defaultProjectId,
            createdAt: now,
            updatedAt: now,
            isStarred: false,
            // NEW BRANCHING SYSTEM FIELDS - Phase 1
            baseMessages: [],
            activeMessages: [],
            isPasswordProtected,
            passwordHash,
            passwordSalt,
        });

        // PHASE 1: Create main branch for new chat (Case 0)
        const mainBranchId = await ctx.db.insert("branches", {
            chatId,
            fromMessageId: undefined, // Main branch doesn't branch from any message
            messages: [], // Empty array initially
            isMain: true,
            createdAt: now,
            updatedAt: now,
            branchName: "Main",
            description: "Main conversation thread",
        });

        // Update chat to reference the main branch as active
        await ctx.db.patch(chatId, {
            activeBranchId: mainBranchId,
        });

        return chatId;
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
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
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
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
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
        if (
            !originalChat ||
            (originalChat.userId !== userId && !originalChat.isPublic)
        ) {
            throw new Error("Chat not found");
        }

        // FIX: Remove old index usage - get messages through branches now
        // Get the branch message to find its position
        const branchMessage = await ctx.db.get(args.branchFromMessageId);
        if (!branchMessage) throw new Error("Branch message not found");

        const branch = await ctx.db.get(branchMessage.branchId);
        if (!branch) throw new Error("Branch not found");

        const chat = await ctx.db.get(branch.chatId);
        if (!chat) throw new Error("Chat not found");

        // Get messages from baseMessages + activeBranch.messages up to the branch point
        const baseMessageIds = chat.baseMessages || [];
        const branchMessageIds = branch.messages || [];
        const allMessageIds = [...baseMessageIds, ...branchMessageIds];

        // Find messages up to and including the branch point
        const allMessages = await Promise.all(
            allMessageIds.map((messageId) => ctx.db.get(messageId))
        );

        const validMessages = allMessages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        const messagesToCopy = validMessages.filter(
            (msg) => msg.timestamp <= branchMessage.timestamp
        );

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
            // NEW BRANCHING SYSTEM FIELDS
            baseMessages: [],
            activeMessages: [],
        });

        // PHASE 1: Create main branch for new chat
        const mainBranchId = await ctx.db.insert("branches", {
            chatId: newChatId,
            fromMessageId: undefined,
            messages: [],
            createdAt: now,
            updatedAt: now,
            branchName: "Main",
            description: "Main conversation thread",
        });

        // Copy messages to new chat and branch
        const copiedMessageIds = [];
        for (const message of messagesToCopy) {
            const newMessageId = await ctx.db.insert("messages", {
                branchId: mainBranchId, // Messages belong to branches now
                role: message.role,
                content: message.content,
                timestamp: message.timestamp,
                model: message.model,
                attachments: message.attachments,
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
        await ctx.db.patch(newChatId, {
            activeBranchId: mainBranchId,
            activeMessages: copiedMessageIds,
        });

        return newChatId;
    },
});

export const deleteChat = mutation({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("You cannot delete a shared chat");
        } else if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found");
        }

        // FIX: Delete all messages through branches instead of old index
        // Delete all branches and their messages
        const branches = await ctx.db
            .query("branches")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .collect();

        for (const branch of branches) {
            // Delete all messages in this branch
            for (const messageId of branch.messages) {
                await ctx.db.delete(messageId);
            }
            // Delete the branch itself
            await ctx.db.delete(branch._id);
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

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.db.get(message.branchId);
        if (!branch) throw new Error("Branch not found");

        const originalChat = await ctx.db.get(branch.chatId);
        if (
            !originalChat ||
            (originalChat.userId !== userId && !originalChat.isPublic)
        ) {
            throw new Error("Chat not found or unauthorized");
        }

        // FIX: Get messages through branching system instead of old index
        // Get all messages from baseMessages + activeBranch.messages up to the fork point
        const baseMessageIds = originalChat.baseMessages || [];
        const branchMessageIds = branch.messages || [];
        const allMessageIds = [...baseMessageIds, ...branchMessageIds];

        // Get all messages and filter up to the fork point
        const allMessages = await Promise.all(
            allMessageIds.map((messageId) => ctx.db.get(messageId))
        );

        const validMessages = allMessages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        const messagesToCopy = validMessages.filter(
            (msg) => msg.timestamp <= message.timestamp
        );

        const now = Date.now();
        // Create new forked chat
        const newChatId = await ctx.db.insert("chats", {
            userId,
            title: `Fork of ${originalChat.title}`,
            model: originalChat.model,
            createdAt: now,
            updatedAt: now,
            parentChatId: originalChat._id,
            branchPoint: args.messageId,
            // NEW BRANCHING SYSTEM FIELDS
            baseMessages: [],
            activeMessages: [],
        });

        // PHASE 1: Create main branch for new chat
        const mainBranchId = await ctx.db.insert("branches", {
            chatId: newChatId,
            fromMessageId: undefined,
            messages: [],
            isMain: true,
            createdAt: now,
            updatedAt: now,
            branchName: "Main",
            description: "Main conversation thread",
        });

        // Copy messages to new chat and branch
        const copiedMessageIds = [];
        for (const msg of messagesToCopy) {
            const newMessageId = await ctx.db.insert("messages", {
                branchId: mainBranchId, // Messages belong to branches now
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                model: msg.model,
                attachments: msg.attachments,
                metadata: msg.metadata,
                parentMessageId: msg.parentMessageId,
                editHistory: msg.editHistory,
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
        await ctx.db.patch(newChatId, {
            activeBranchId: mainBranchId,
            activeMessages: copiedMessageIds,
        });

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
            if (!chat || (chat.userId !== userId && !chat.isPublic)) continue;

            // FIX: Get messages through branches instead of old chat index
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

export const updateChatModel = mutation({
    args: {
        chatId: v.id("chats"),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
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

        // Delete all user chats and messages (duplicate the logic instead of calling handler)
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

// Add archiving functionality after existing mutations
export const toggleChatArchive = mutation({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or unauthorized");
        }

        // Toggle archive status
        const isArchived = chat.isArchived || false;
        await ctx.db.patch(args.chatId, {
            isArchived: !isArchived,
            archivedAt: !isArchived ? Date.now() : undefined,
            updatedAt: Date.now(),
        });

        return {
            chatId: args.chatId,
            isArchived: !isArchived,
            archivedAt: !isArchived ? Date.now() : undefined,
        };
    },
});

// Bulk archive operations
export const bulkArchiveChats = mutation({
    args: {
        chatIds: v.array(v.id("chats")),
        archive: v.boolean(), // true to archive, false to unarchive
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        let processed = 0;
        const timestamp = Date.now();

        for (const chatId of args.chatIds) {
            const chat = await ctx.db.get(chatId);
            if (chat && chat.userId === userId) {
                await ctx.db.patch(chatId, {
                    isArchived: args.archive,
                    archivedAt: args.archive ? timestamp : undefined,
                    updatedAt: timestamp,
                });
                processed++;
            }
        }

        return {
            processed,
            total: args.chatIds.length,
            archived: args.archive,
        };
    },
});

// Create a new temporary chat - Phase 2
export const createTemporaryChat = mutation({
    args: {
        title: v.optional(v.string()),
        model: v.optional(v.string()),
        lifespanHours: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<Id<"chats">> => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const preferences: any = await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal,
            { userId }
        );
        const defaultLifespanHours: number =
            preferences?.temporaryChatsSettings?.defaultLifespanHours || 24;
        const lifespanHours: number =
            args.lifespanHours || defaultLifespanHours;

        const now = Date.now();
        const temporaryUntil: number = now + lifespanHours * 60 * 60 * 1000; // Convert hours to milliseconds

        const chatId: Id<"chats"> = await ctx.db.insert("chats", {
            userId,
            title:
                args.title || `Temporary Chat - ${new Date().toLocaleString()}`,
            model:
                args.model || preferences?.defaultModel || "gemini-2.0-flash",
            isTemporary: true,
            temporaryUntil,
            createdAt: now,
            updatedAt: now,
            isStarred: false,
            baseMessages: [],
            activeMessages: [],
        });

        // Create main branch for temporary chat
        const mainBranchId = await ctx.db.insert("branches", {
            chatId,
            fromMessageId: undefined,
            messages: [],
            isMain: true,
            createdAt: now,
            updatedAt: now,
            branchName: "Main",
            description: "Main conversation thread",
        });

        // Update chat to reference the main branch as active
        await ctx.db.patch(chatId, {
            activeBranchId: mainBranchId,
        });

        return chatId;
    },
});

// Convert temporary chat to permanent - Phase 2
export const convertTemporaryToPermanent = mutation({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or unauthorized");
        }

        if (!chat.isTemporary) {
            throw new Error("Chat is not temporary");
        }

        // Convert to permanent chat
        await ctx.db.patch(args.chatId, {
            isTemporary: false,
            temporaryUntil: undefined,
            updatedAt: Date.now(),
        });

        return {
            chatId: args.chatId,
            convertedAt: Date.now(),
        };
    },
});

// Extend temporary chat lifespan - Phase 2
export const extendTemporaryChatLifespan = mutation({
    args: {
        chatId: v.id("chats"),
        additionalHours: v.number(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or unauthorized");
        }

        if (!chat.isTemporary || !chat.temporaryUntil) {
            throw new Error("Chat is not temporary");
        }

        const newExpirationTime =
            chat.temporaryUntil + args.additionalHours * 60 * 60 * 1000;

        await ctx.db.patch(args.chatId, {
            temporaryUntil: newExpirationTime,
            updatedAt: Date.now(),
        });

        return {
            chatId: args.chatId,
            newExpirationTime,
            extendedBy: args.additionalHours,
        };
    },
});

// Get expired temporary chats for cleanup - Phase 2
export const getExpiredTemporaryChats = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        const now = Date.now();
        const allChats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        return allChats.filter(
            (chat) =>
                chat.isTemporary &&
                chat.temporaryUntil &&
                chat.temporaryUntil < now
        );
    },
});

// Cleanup expired temporary chats - Phase 2
export const cleanupExpiredTemporaryChats = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Get user preferences to check if auto-cleanup is enabled
        const preferences = await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal,
            { userId }
        );
        if (!preferences?.temporaryChatsSettings?.autoCleanup) {
            return { cleanedUp: 0, message: "Auto-cleanup is disabled" };
        }

        const now = Date.now();
        const allChats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        const expiredChats = allChats.filter(
            (chat) =>
                chat.isTemporary &&
                chat.temporaryUntil &&
                chat.temporaryUntil < now
        );

        let cleanedUp = 0;
        for (const chat of expiredChats) {
            // Delete all branches and their messages
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

            // Delete the chat
            await ctx.db.delete(chat._id);
            cleanedUp++;
        }

        return {
            cleanedUp,
            total: expiredChats.length,
        };
    },
});

export const updateChatAISettings = mutation({
    args: {
        chatId: v.id("chats"),
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
                topP: v.optional(v.number()),
                frequencyPenalty: v.optional(v.number()),
                presencePenalty: v.optional(v.number()),
            })
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or access denied");
        }

        await ctx.db.patch(args.chatId, {
            aiSettings: args.aiSettings, // null to clear, object to set
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

// Password Protection Mutations - Phase 6
export const setPasswordProtection = mutation({
    args: {
        chatId: v.id("chats"),
        password: v.string(),
        hint: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or access denied");
        }

        // Generate salt and hash password using Node.js crypto
        const salt = generateSalt();
        const hash = hashPassword(args.password, salt);

        await ctx.db.patch(args.chatId, {
            isPasswordProtected: true,
            passwordHash: hash,
            passwordSalt: salt,
            passwordHint: args.hint,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

export const removePasswordProtection = mutation({
    args: {
        chatId: v.id("chats"),
        currentPassword: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or access denied");
        }

        if (
            !chat.isPasswordProtected ||
            !chat.passwordHash ||
            !chat.passwordSalt
        ) {
            throw new Error("Chat is not password protected");
        }

        // Verify current password
        const isValid = await verifyPassword(args.currentPassword, chat);
        if (!isValid) {
            throw new Error("Invalid password");
        }

        await ctx.db.patch(args.chatId, {
            isPasswordProtected: false,
            passwordHash: undefined,
            passwordSalt: undefined,
            passwordHint: undefined,
            lastPasswordVerified: undefined,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

export const verifyPasswordProtection = mutation({
    args: {
        chatId: v.id("chats"),
        password: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or access denied");
        }

        if (
            !chat.isPasswordProtected ||
            !chat.passwordHash ||
            !chat.passwordSalt
        ) {
            return { success: true, verified: true }; // Not password protected
        }

        // Verify password
        const isValid = await verifyPassword(args.password, chat);

        if (isValid) {
            // Update last verified time for session tracking
            await ctx.db.patch(args.chatId, {
                lastPasswordVerified: Date.now(),
            });
        }

        return { success: true, verified: isValid };
    },
});

// Query to check if chat needs password verification
export const checkPasswordStatus = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or access denied");
        }

        const needsVerification =
            chat.isPasswordProtected &&
            (!chat.lastPasswordVerified ||
                Date.now() - chat.lastPasswordVerified > 30 * 60 * 1000); // 30 minutes session

        return {
            isPasswordProtected: chat.isPasswordProtected || false,
            needsVerification,
            passwordHint: chat.passwordHint,
            lastVerified: chat.lastPasswordVerified,
        };
    },
});

// Enhanced set password protection with default password support
export const setPasswordProtectionEnhanced = mutation({
    args: {
        chatId: v.id("chats"),
        password: v.optional(v.string()),
        hint: v.optional(v.string()),
        useDefaultPassword: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== userId) {
            throw new Error("Chat not found or access denied");
        }

        let hash: string;
        let salt: string;

        if (args.useDefaultPassword) {
            // Use default password from preferences
            const currentPrefs = await ctx.runQuery(
                internal.preferences.getUserPreferencesInternal,
                { userId }
            );

            if (
                !currentPrefs?.passwordSettings?.defaultPasswordHash ||
                !currentPrefs?.passwordSettings?.defaultPasswordSalt
            ) {
                throw new Error(
                    "No default password is set. Please set a default password first or provide a specific password."
                );
            }

            hash = currentPrefs.passwordSettings.defaultPasswordHash;
            salt = currentPrefs.passwordSettings.defaultPasswordSalt;
        } else if (args.password) {
            // Use provided password
            salt = generateSalt();
            hash = hashPassword(args.password, salt);
        } else {
            throw new Error(
                "Either provide a password or enable useDefaultPassword"
            );
        }

        await ctx.db.patch(args.chatId, {
            isPasswordProtected: true,
            passwordHash: hash,
            passwordSalt: salt,
            passwordHint: args.hint,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

export const advancedSearch = query({
    args: {
        query: v.string(),
        filters: v.object({
            includeContent: v.boolean(),
            includeAttachments: v.boolean(),
            includeArchived: v.boolean(),
            includeStarred: v.boolean(),
            includeShared: v.boolean(),
            includeTemporary: v.boolean(),
            modelFilter: v.string(),
            dateRange: v.string(),
            minMessages: v.number(),
            maxMessages: v.number(),
        }),
        tab: v.string(),
    },
    returns: v.array(
        v.object({
            _id: v.id("chats"),
            title: v.string(),
            model: v.string(),
            updatedAt: v.number(),
            isStarred: v.optional(v.boolean()),
            isArchived: v.optional(v.boolean()),
            isShared: v.optional(v.boolean()),
            isTemporary: v.optional(v.boolean()),
            messageCount: v.number(),
            matchedContent: v.optional(v.string()),
            matchedAttachments: v.optional(v.array(v.string())),
            score: v.number(),
        })
    ),
    handler: async (ctx, { query: searchQuery, filters, tab }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];
        const qLower = searchQuery.trim().toLowerCase();
        if (!qLower) return [];

        // Load user chats
        const userChats: Doc<"chats">[] = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        // Load shared chats if requested
        let sharedChats: Doc<"chats">[] = [];
        if (filters.includeShared) {
            const userDoc = (await ctx.db.get(userId)) as Doc<"users"> | null;
            const sharedIds = userDoc?.sharedChats || [];
            if (sharedIds.length) {
                const loaded = await Promise.all(sharedIds.map((id) => ctx.db.get(id)));
                sharedChats = loaded.filter((c): c is Doc<"chats"> => !!c);
            }
        }

        // Merge & dedupe
        const chatMap: Record<string, Doc<"chats">> = {};
        for (const c of [...userChats, ...sharedChats]) chatMap[c._id] = c;
        let chats: Doc<"chats">[] = Object.values(chatMap);

        // High-level tab filters
        chats = chats.filter((c) => {
            if (!filters.includeArchived && c.isArchived) return false;
            if (!filters.includeStarred && c.isStarred) return false;
            if (!filters.includeTemporary && c.isTemporary) return false;
            if (!filters.includeShared && c.isPublic) return false;
            switch (tab) {
                case "starred":
                    if (!c.isStarred) return false; break;
                case "regular":
                    if (c.isStarred || c.isArchived || c.isPublic || c.isTemporary) return false; break;
                case "archived":
                    if (!c.isArchived) return false; break;
                case "shared":
                    if (!c.isPublic) return false; break;
                case "temporary":
                    if (!c.isTemporary) return false; break;
            }
            return true;
        });

        // Model filter
        if (filters.modelFilter !== "all") {
            chats = chats.filter((c) => c.model === filters.modelFilter);
        }

        // Date range filter
        if (filters.dateRange !== "all") {
            const now = Date.now();
            const day = 24 * 60 * 60 * 1000;
            const startTs = (() => {
                switch (filters.dateRange) {
                    case "today":
                        return new Date(new Date().toDateString()).getTime();
                    case "week":
                        return now - 7 * day;
                    case "month":
                        return now - 30 * day;
                    case "year":
                        return now - 365 * day;
                    default:
                        return 0;
                }
            })();
            chats = chats.filter((c) => c.updatedAt >= startTs);
        }

        const results: Array<{
            _id: Id<"chats">;
            title: string;
            model: string;
            updatedAt: number;
            isStarred?: boolean;
            isArchived?: boolean;
            isShared?: boolean;
            isTemporary?: boolean;
            messageCount: number;
            matchedContent?: string;
            matchedAttachments?: string[];
            score: number;
        }> = [];

        const now = Date.now();
        for (const chat of chats) {
            // Collect message ids from base + active branch
            const baseIds = (chat.baseMessages || []) as Id<"messages">[];
            let branchIds: Id<"messages">[] = [];
            if (chat.activeBranchId) {
                const branch = (await ctx.db.get(chat.activeBranchId)) as Doc<"branches"> | null;
                branchIds = (branch?.messages || []) as Id<"messages">[];
            }
            const allMessageIds = [...baseIds, ...branchIds];
            const messageCount = allMessageIds.length;
            if (messageCount < filters.minMessages || messageCount > filters.maxMessages) continue;

            let matchedContent: string | undefined;
            const matchedAttachments: string[] = [];
            let contentHitBoost = 0;
            let attachmentHitBoost = 0;

            if (filters.includeContent || filters.includeAttachments) {
                const messages = await Promise.all(allMessageIds.map((id) => ctx.db.get(id)));
                for (const m of messages) {
                    const msg = m as Doc<"messages"> | null;
                    if (!msg) continue;
                    if (!matchedContent && filters.includeContent) {
                        const text = (msg.content || "").toLowerCase();
                        const idx = text.indexOf(qLower);
                        if (idx !== -1) {
                            const start = Math.max(0, idx - 60);
                            const end = Math.min(msg.content.length, idx + 100);
                            matchedContent = msg.content.slice(start, end);
                            contentHitBoost = 30;
                        }
                    }
                    if (filters.includeAttachments && msg.attachments) {
                        for (const att of msg.attachments) {
                            if (att.name.toLowerCase().includes(qLower) && matchedAttachments.length < 5) {
                                matchedAttachments.push(att.name);
                                attachmentHitBoost += 5;
                            }
                        }
                    }
                    if (matchedContent && matchedAttachments.length >= 5) break;
                }
            }

            const titleMatches = chat.title.toLowerCase().includes(qLower);
            const includeByContent = !!matchedContent || matchedAttachments.length > 0;
            if (!titleMatches && !includeByContent) continue;

            const titleBoost = titleMatches ? 50 : 0;
            const recencyDays = (now - chat.updatedAt) / (24 * 60 * 60 * 1000);
            const recencyBoost = Math.max(0, 20 - recencyDays);
            const sizePenalty = messageCount > 0 ? Math.min(10, Math.log10(messageCount + 1)) : 0;
            const score = titleBoost + contentHitBoost + attachmentHitBoost + recencyBoost - sizePenalty;

            results.push({
                _id: chat._id,
                title: chat.title,
                model: chat.model,
                updatedAt: chat.updatedAt,
                isStarred: chat.isStarred,
                isArchived: chat.isArchived,
                isShared: !!chat.isPublic,
                isTemporary: chat.isTemporary || false,
                messageCount,
                matchedContent,
                matchedAttachments: matchedAttachments.length ? matchedAttachments : undefined,
                score: Number(score.toFixed(2)),
            });
        }

        results.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.updatedAt - a.updatedAt));
        return results;
    },
});
