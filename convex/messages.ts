import { v } from "convex/values";
import {
    mutation,
    action,
    query,
    internalAction,
    internalMutation,
    internalQuery
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { decryptApiKey } from "./preferences";
import { ConvexError } from "convex/values";

// Helper function to get user ID with proper error handling
async function getUserId(ctx: any) {
    return await getAuthUserId(ctx);
}

export const getMessageInternal = internalQuery({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.messageId);
    },
});

// Internal version of addMessage for use by other backend functions
export const addMessageInternal = internalMutation({
    args: {
        chatId: v.id("chats"),
        role: v.union(
            v.literal("user"),
            v.literal("assistant"),
            v.literal("system")
        ),
        content: v.string(),
        model: v.optional(v.string()),
        isStreaming: v.optional(v.boolean()),
        parentMessageId: v.optional(v.id("messages")),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio"),
                        v.literal("video")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        referencedLibraryItems: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("attachment"),
                        v.literal("artifact"),
                        v.literal("media")
                    ),
                    id: v.string(), // Library ID or artifact ID
                    name: v.string(),
                    size: v.optional(v.number()),
                    mimeType: v.optional(v.string()),
                })
            )
        ),
        commands: v.optional(v.array(v.string())),
        userId: v.optional(v.id("users")), // Allow passing userId for internal calls
    },
    handler: async (ctx, args) => {
        // For internal calls, userId can be passed directly, otherwise get from auth
        const userId = args.userId || await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Chat not found or access denied");
        }

        // ...existing code... (copy the entire handler logic from the original addMessage)
        const activeBranchId = chat.activeBranchId;
        if (!activeBranchId) {
            throw new Error("No active branch found for chat");
        }

        const activeBranch = await ctx.db.get(activeBranchId);
        if (!activeBranch) {
            throw new Error("Active branch not found");
        }

        // Create the message - now belongs to a branch, not directly to chat
        const messageId = await ctx.db.insert("messages", {
            branchId: activeBranchId,
            role: args.role,
            content: args.content,
            timestamp: Date.now(),
            model: args.model,
            isStreaming: args.isStreaming,
            parentMessageId: args.parentMessageId,
            attachments: args.attachments,
            referencedLibraryItems: args.referencedLibraryItems,
            commands: args.commands,
            branches: [activeBranchId],
            activeBranchId: activeBranchId,
        });

        // Add message to the active branch's messages array
        const updatedMessages = [...(activeBranch.messages || []), messageId];
        await ctx.db.patch(activeBranchId, {
            messages: updatedMessages,
            updatedAt: Date.now(),
        });

        // Update chat's activeMessages array and updatedAt timestamp
        const baseMessages = chat.baseMessages || [];
        const newActiveMessages = [...baseMessages, ...updatedMessages];

        const updates: any = {
            updatedAt: Date.now(),
            activeMessages: newActiveMessages,
        };

        // Generate title for first user message if chat is still "New Chat"
        if (
            chat.title === "New Chat" &&
            args.role === "user" &&
            args.content.trim()
        ) {
            // Get user preferences to determine title generation method
            const preferences = await ctx.runQuery(
                internal.preferences.getUserPreferencesInternal,
                {
                    userId,
                }
            );

            if (preferences?.chatTitleGeneration === "ai-generated") {
                // Schedule AI title generation (async, doesn't block message creation)
                ctx.scheduler.runAfter(0, internal.messages.generateChatTitle, {
                    chatId: args.chatId,
                    userMessage: args.content,
                    model: args.model || "gemini-2.0-flash",
                });
            } else {
                // Use first message approach (default/fallback)
                const title = args.content.slice(0, 50).trim();
                updates.title =
                    title.length < args.content.length ? title + "..." : title;
            }
        }

        await ctx.db.patch(args.chatId, updates);

        return messageId;
    },
});

export const addMessage = mutation({
    args: {
        chatId: v.id("chats"),
        role: v.union(
            v.literal("user"),
            v.literal("assistant"),
            v.literal("system")
        ),
        content: v.string(),
        model: v.optional(v.string()),
        isStreaming: v.optional(v.boolean()),
        parentMessageId: v.optional(v.id("messages")),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio"),
                        v.literal("video")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        referencedLibraryItems: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("attachment"),
                        v.literal("artifact"),
                        v.literal("media")
                    ),
                    id: v.string(), // Library ID or artifact ID
                    name: v.string(),
                    size: v.optional(v.number()),
                    mimeType: v.optional(v.string()),
                })
            )
        ),
        commands: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const chat = await ctx.db.get(args.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Chat not found or access denied");
        }

        // NEW BRANCHING SYSTEM: Get the active branch
        // PHASE 2: Case 3 - When we send a new message to a chat, it's stored in the active branch's messages array
        const activeBranchId = chat.activeBranchId;
        if (!activeBranchId) {
            throw new Error("No active branch found for chat");
        }

        const activeBranch = await ctx.db.get(activeBranchId);
        if (!activeBranch) {
            throw new Error("Active branch not found");
        }

        // Create the message - now belongs to a branch, not directly to chat
        const messageId = await ctx.db.insert("messages", {
            branchId: activeBranchId,
            role: args.role,
            content: args.content,
            timestamp: Date.now(),
            model: args.model,
            isStreaming: args.isStreaming,
            parentMessageId: args.parentMessageId,
            attachments: args.attachments,
            referencedLibraryItems: args.referencedLibraryItems,
            commands: args.commands,
            branches: [activeBranchId],
            activeBranchId: activeBranchId,
        });

        // Add message to the active branch's messages array
        const updatedMessages = [...(activeBranch.messages || []), messageId];
        await ctx.db.patch(activeBranchId, {
            messages: updatedMessages,
            updatedAt: Date.now(),
        });

        // Update chat's activeMessages array and updatedAt timestamp
        const baseMessages = chat.baseMessages || [];
        const newActiveMessages = [...baseMessages, ...updatedMessages];

        const updates: any = {
            updatedAt: Date.now(),
            activeMessages: newActiveMessages,
        };

        // Generate title for first user message if chat is still "New Chat"
        if (
            chat.title === "New Chat" &&
            args.role === "user" &&
            args.content.trim()
        ) {
            // Get user preferences to determine title generation method
            const preferences = await ctx.runQuery(
                internal.preferences.getUserPreferencesInternal,
                {
                    userId,
                }
            );

            if (preferences?.chatTitleGeneration === "ai-generated") {
                // Schedule AI title generation (async, doesn't block message creation)
                ctx.scheduler.runAfter(0, internal.messages.generateChatTitle, {
                    chatId: args.chatId,
                    userMessage: args.content,
                    model: args.model || "gemini-2.0-flash",
                });
            } else {
                // Use first message approach (default/fallback)
                const title = args.content.slice(0, 50).trim();
                updates.title =
                    title.length < args.content.length ? title + "..." : title;
            }
        }

        await ctx.db.patch(args.chatId, updates);

        return messageId;
    },
});

// New internal action to generate AI-powered chat titles
export const generateChatTitle = internalAction({
    args: {
        chatId: v.id("chats"),
        userMessage: v.string(),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            console.log("🤖 GENERATING AI TITLE:", {
                chatId: args.chatId,
                userMessage: args.userMessage.substring(0, 100) + "...",
                model: args.model,
                timestamp: new Date().toISOString(),
            });

            // Get the chat to verify it still needs a title
            const chat = await ctx.runQuery(internal.aiHelpers.getChat, {
                chatId: args.chatId,
            });

            if (!chat || chat.title !== "New Chat") {
                console.log("Chat no longer needs AI title generation");
                return;
            }

            // Generate title using AI
            const titlePrompt = `Based on this user message, generate a concise, descriptive title for the conversation (max 50 characters, no quotes):

User message: "${args.userMessage}"

Generate only the title, nothing else:`;

            // Use the AI generation system to create the title
            const titleResponse = await ctx.runAction(
                internal.ai.generateStructuredOutput,
                {
                    chatId: args.chatId,
                    messageId: "dummy" as any, // We'll handle this properly
                    model: args.model,
                    schema: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                maxLength: 50,
                                description:
                                    "A concise, descriptive title for the conversation",
                            },
                        },
                        required: ["title"],
                    },
                    enhancedPrompt: titlePrompt,
                    metadata: { purpose: "chat_title_generation" },
                }
            );

            let aiTitle = "New Chat"; // Fallback

            if (
                titleResponse &&
                typeof titleResponse === "object" &&
                "title" in titleResponse
            ) {
                aiTitle = (titleResponse as any).title.trim();
            }

            // Ensure title is not empty and within limits
            if (!aiTitle || aiTitle.length === 0) {
                aiTitle = args.userMessage.slice(0, 50).trim();
                aiTitle =
                    aiTitle.length < args.userMessage.length
                        ? aiTitle + "..."
                        : aiTitle;
            } else if (aiTitle.length > 50) {
                aiTitle = aiTitle.slice(0, 47) + "...";
            }

            // Update chat title
            await ctx.runMutation(internal.messages.updateChatTitle, {
                chatId: args.chatId,
                title: aiTitle,
            });

            console.log("✅ AI TITLE GENERATED:", {
                chatId: args.chatId,
                generatedTitle: aiTitle,
                originalMessage: args.userMessage.substring(0, 50) + "...",
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            console.error("❌ AI TITLE GENERATION FAILED:", {
                chatId: args.chatId,
                error: error?.message || String(error),
                timestamp: new Date().toISOString(),
            });

            // Fallback to first-message approach
            const fallbackTitle = args.userMessage.slice(0, 50).trim();
            const title =
                fallbackTitle.length < args.userMessage.length
                    ? fallbackTitle + "..."
                    : fallbackTitle;

            await ctx.runMutation(internal.messages.updateChatTitle, {
                chatId: args.chatId,
                title: title,
            });
        }
    },
});

// Internal mutation to update chat title
export const updateChatTitle = internalMutation({
    args: {
        chatId: v.id("chats"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.chatId, {
            title: args.title,
            updatedAt: Date.now(),
        });
    },
});

export const updateMessage = mutation({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
        isStreaming: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.db.get(message.branchId);
        if (!branch) throw new Error("Branch not found");

        const chat = await ctx.db.get(branch.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Unauthorized");
        }

        // Save edit history
        const editHistory = message.editHistory || [];
        editHistory.push({
            content: message.content,
            timestamp: Date.now(),
        });

        await ctx.db.patch(args.messageId, {
            content: args.content,
            isStreaming: args.isStreaming,
            editHistory,
        });
    },
});

export const retryMessage = action({
    args: {
        messageId: v.id("messages"),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<string> => {
        const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
            messageId: args.messageId,
        });

        if (!message || message.role !== "assistant") {
            throw new Error("Invalid message for retry");
        }

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.runQuery(api.branches.getBranchWithMessages, {
            branchId: message.branchId,
        });
        if (!branch) throw new Error("Branch not found");

        // Create a new version with empty content and set to streaming
        const versionId: string = await ctx.runMutation(
            api.messages.createMessageVersion,
            {
                messageId: args.messageId,
                newContent: "",
                model: args.model || message.model || "gemini-2.0-flash",
            }
        );

        // Mark message as streaming
        await ctx.runMutation(api.messages.updateMessage, {
            messageId: args.messageId,
            content: "",
            isStreaming: true,
        });

        // Generate new AI response using streaming
        await ctx.runAction(internal.ai.generateStreamingResponse, {
            chatId: branch.chatId, // Get chatId from branch
            retryMessageId: args.messageId,
            model: args.model || message.model || "gemini-2.0-flash",
            referencedLibraryItems: message.referencedLibraryItems || [],
        });

        return versionId;
    },
});

export const sendMessage = action({
    args: {
        messageId: v.optional(v.id("messages")), // Make messageId optional
        chatId: v.id("chats"),
        content: v.string(),
        model: v.string(),
        commands: v.optional(v.array(v.string())),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio"),
                        v.literal("video")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        referencedLibraryItems: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("attachment"),
                        v.literal("artifact"),
                        v.literal("media")
                    ),
                    id: v.string(),
                    name: v.string(),
                    size: v.optional(v.number()),
                    mimeType: v.optional(v.string()),
                })
            )
        ),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ userMessageId: any; assistantMessageId: any }> => {
        // If messageId is provided, then it's a retry and we don't need to add new user message
        const userMessageId: any = args.messageId
            ? args.messageId
            : await ctx.runMutation(api.messages.addMessage, {
                  chatId: args.chatId,
                  role: "user",
                  content: args.content,
                  attachments: args.attachments,
                  referencedLibraryItems: args.referencedLibraryItems,
                  commands: args.commands,
              });

        // Create assistant message placeholder
        const assistantMessageId: any = await ctx.runMutation(
            api.messages.addMessage,
            {
                chatId: args.chatId,
                role: "assistant",
                content: "",
                model: args.model,
                isStreaming: true,
            }
        );

        // Pass unified library items to AI generation
        await ctx.runAction(internal.ai.generateStreamingResponse, {
            chatId: args.chatId,
            model: args.model,
            commands: args.commands,
            attachments: args.attachments,
            referencedLibraryItems: args.referencedLibraryItems,
        });

        return { userMessageId, assistantMessageId };
    },
});

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        return await ctx.storage.generateUploadUrl();
    },
});

export const deleteMessage = mutation({
    args: {
        messageId: v.id("messages"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.db.get(message.branchId);
        if (!branch) throw new Error("Branch not found");

        const chat = await ctx.db.get(branch.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Unauthorized");
        }

        // PHASE 5 FIX: Enhanced orphaned branch cleanup
        // Get all branches associated with this message for cleanup
        const messageBranches = message.branches || [];

        // Clean up orphaned branches if this message has them
        if (messageBranches.length > 0) {
            console.log("🧹 CLEANING UP ORPHANED BRANCHES:", {
                messageId: args.messageId,
                branchCount: messageBranches.length,
                branches: messageBranches,
            });

            for (const branchId of messageBranches) {
                try {
                    const branchToCleanup = await ctx.db.get(branchId);
                    if (branchToCleanup && !branchToCleanup.isMain) {
                        // Only delete non-main branches
                        await ctx.db.delete(branchId);
                        console.log("🗑️ DELETED ORPHANED BRANCH:", branchId);
                    }
                } catch (error) {
                    console.warn(
                        `Failed to cleanup branch ${branchId}:`,
                        error
                    );
                }
            }
        }

        // If this is a user message, also delete the subsequent AI response
        if (message.role === "user") {
            const nextMessage = await ctx.db
                .query("messages")
                .withIndex("by_branch_and_timestamp", (q) =>
                    q
                        .eq("branchId", message.branchId)
                        .gt("timestamp", message.timestamp)
                )
                .order("asc")
                .first();

            if (nextMessage && nextMessage.role === "assistant") {
                // PHASE 5 FIX: Clean up branches for assistant message too
                const assistantBranches = nextMessage.branches || [];
                for (const branchId of assistantBranches) {
                    try {
                        const branchToCleanup = await ctx.db.get(branchId);
                        if (branchToCleanup && !branchToCleanup.isMain) {
                            await ctx.db.delete(branchId);
                        }
                    } catch (error) {
                        console.warn(
                            `Failed to cleanup assistant message branch ${branchId}:`,
                            error
                        );
                    }
                }

                // Remove from branch messages array
                const updatedBranchMessages = branch.messages.filter(
                    (id) => id !== nextMessage._id
                );
                await ctx.db.patch(branch._id, {
                    messages: updatedBranchMessages,
                    updatedAt: Date.now(),
                });

                await ctx.db.delete(nextMessage._id);
            }
        }

        // Remove message from branch messages array
        const updatedMessages = branch.messages.filter(
            (id) => id !== args.messageId
        );
        await ctx.db.patch(branch._id, {
            messages: updatedMessages,
            updatedAt: Date.now(),
        });

        // PHASE 5 FIX: Data consistency - Update chat's activeMessages if this was in active branch
        if (chat.activeBranchId === branch._id) {
            const baseMessages = chat.baseMessages || [];
            const newActiveMessages = [...baseMessages, ...updatedMessages];
            await ctx.db.patch(chat._id, {
                activeMessages: newActiveMessages,
                updatedAt: Date.now(),
            });

            // PHASE 5 FIX: If branch becomes empty and it's not main, switch to main branch
            if (updatedMessages.length === 0 && !branch.isMain) {
                const mainBranch = await ctx.db
                    .query("branches")
                    .withIndex("by_chat_main", (q) =>
                        q.eq("chatId", chat._id).eq("isMain", true)
                    )
                    .first();

                if (mainBranch) {
                    await ctx.db.patch(chat._id, {
                        activeBranchId: mainBranch._id,
                        activeMessages: [
                            ...baseMessages,
                            ...mainBranch.messages,
                        ],
                        updatedAt: Date.now(),
                    });

                    console.log("🔄 SWITCHED TO MAIN BRANCH:", {
                        chatId: chat._id,
                        fromBranch: branch._id,
                        toMainBranch: mainBranch._id,
                    });
                }
            }
        }

        await ctx.db.delete(args.messageId);

        console.log("✅ MESSAGE DELETION COMPLETE WITH CLEANUP:", {
            messageId: args.messageId,
            cleanedBranches: messageBranches.length,
            timestamp: new Date().toISOString(),
        });

        return null;
    },
});

// Add these new functions after the existing mutations

export const createMessageVersion = mutation({
    args: {
        messageId: v.id("messages"),
        newContent: v.string(),
        model: v.optional(v.string()),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.db.get(message.branchId);
        if (!branch) throw new Error("Branch not found");

        const chat = await ctx.db.get(branch.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Unauthorized");
        }

        console.log("NEW CONTENT: ", args.newContent);

        // Get existing versions or initialize with current content as first version
        const existingVersions = message.messageVersions || [];

        // If no versions exist, create first version from current content
        if (existingVersions.length === 0) {
            existingVersions.push({
                versionId: `v1_${Date.now()}`,
                content: message.content, // Use actual message content, not empty
                model: message.model,
                timestamp: message.timestamp,
                isActive: false, // Make original inactive
                metadata: null,
            });
        }

        // Create new version
        const newVersion = {
            versionId: `v${existingVersions.length + 1}_${Date.now()}`,
            content: args.newContent,
            model: args.model || message.model,
            timestamp: Date.now(),
            isActive: true, // New version becomes active
            metadata: args.metadata || null,
        };

        // Mark all existing versions as inactive - preserve their content
        const updatedVersions = existingVersions.map((v) => ({
            ...v, // Keep all existing properties including content
            isActive: false,
        }));
        updatedVersions.push(newVersion);

        // Update message with new content and versions
        await ctx.db.patch(args.messageId, {
            content: args.newContent,
            model: args.model || message.model,
            messageVersions: updatedVersions,
        });

        return newVersion.versionId;
    },
});

export const switchMessageVersion = mutation({
    args: {
        messageId: v.id("messages"),
        versionId: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const versions = message.messageVersions || [];
        const targetVersion = versions.find(
            (v) => v.versionId === args.versionId
        );
        if (!targetVersion) throw new Error("Version not found");

        const currentVersionIndex = versions.findIndex((v) => v.isActive);
        const targetVersionIndex = versions.findIndex(
            (v) => v.versionId === args.versionId
        );

        // Log backend navigation
        console.log("🔄 VERSION NAVIGATION (BACKEND):", {
            messageId: args.messageId,
            fromVersionIndex: currentVersionIndex,
            toVersionIndex: targetVersionIndex,
            fromVersionId: versions[currentVersionIndex]?.versionId,
            toVersionId: args.versionId,
            totalVersions: versions.length,
            timestamp: new Date().toISOString(),
        });

        console.log("📝 ALL VERSIONS FOR MESSAGE (BACKEND):", {
            messageId: args.messageId,
            currentTarget: `v${targetVersionIndex + 1} (${args.versionId})`,
            versions: versions.map((v, index) => ({
                versionNumber: index + 1,
                versionId: v.versionId,
                isActive: v.versionId === args.versionId, // Update active status for logging
                model: v.model,
                contentPreview: v.content.substring(0, 30) + "...",
                timestamp: new Date(v.timestamp).toISOString(),
            })),
        });

        // Update all versions to make target active
        const updatedVersions = versions.map((v) => ({
            ...v,
            isActive: v.versionId === args.versionId,
        }));

        // Update message content to target version
        await ctx.db.patch(args.messageId, {
            content: targetVersion.content,
            model: targetVersion.model,
            messageVersions: updatedVersions,
        });

        return targetVersion;
    },
});

export const getMessageVersions = query({
    args: {
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        const versions = message.messageVersions || [];
        const currentVersionIndex = versions.findIndex((v) => v.isActive);

        return {
            versions: versions.map((v, index) => ({
                versionId: v.versionId,
                content: v.content,
                model: v.model,
                timestamp: v.timestamp,
                isActive: v.isActive,
                versionNumber: index + 1,
            })),
            currentVersionIndex,
            totalVersions: versions.length,
        };
    },
});

// Add this enhanced deletion function after the existing deleteMessage mutation
export const deleteAllMessagesFromHere = mutation({
    args: {
        messageId: v.id("messages"),
        deleteMode: v.union(v.literal("from_here"), v.literal("all_after")),
    },
    returns: v.object({
        deletedCount: v.number(),
        fromIndex: v.number(),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.db.get(message.branchId);
        if (!branch) throw new Error("Branch not found");

        const chat = await ctx.db.get(branch.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Unauthorized");
        }

        // Get all messages in the active branch
        const allMessageIds = [
            ...(chat.baseMessages || []),
            ...branch.messages,
        ];
        const allMessages = await Promise.all(
            allMessageIds.map((id) => ctx.db.get(id))
        );

        const validMessages = allMessages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        // Find the index of the target message
        const targetIndex = validMessages.findIndex(
            (msg) => msg._id === args.messageId
        );
        if (targetIndex === -1) throw new Error("Message not found in branch");

        let messagesToDelete: typeof validMessages = [];
        let fromIndex = targetIndex;

        if (args.deleteMode === "from_here") {
            // Delete the target message and all messages after it
            messagesToDelete = validMessages.slice(targetIndex);
        } else if (args.deleteMode === "all_after") {
            // Delete only messages after the target message
            messagesToDelete = validMessages.slice(targetIndex + 1);
            fromIndex = targetIndex + 1;
        }

        // Delete the messages
        let deletedCount = 0;
        for (const msgToDelete of messagesToDelete) {
            try {
                await ctx.db.delete(msgToDelete._id);
                deletedCount++;
            } catch (error) {
                console.error(
                    "Failed to delete message:",
                    msgToDelete._id,
                    error
                );
            }
        }

        // Update branch messages array - remove deleted message IDs
        const deletedIds = new Set(messagesToDelete.map((msg) => msg._id));
        const updatedBranchMessages = branch.messages.filter(
            (id) => !deletedIds.has(id)
        );

        await ctx.db.patch(branch._id, {
            messages: updatedBranchMessages,
            updatedAt: Date.now(),
        });

        // Update chat's activeMessages if this was in active branch
        if (chat.activeBranchId === branch._id) {
            const baseMessages = chat.baseMessages || [];
            const newActiveMessages = [
                ...baseMessages,
                ...updatedBranchMessages,
            ];
            await ctx.db.patch(chat._id, {
                activeMessages: newActiveMessages,
                updatedAt: Date.now(),
            });
        }

        return {
            deletedCount,
            fromIndex,
        };
    },
});

export const editAssistantMessage = mutation({
    args: {
        messageId: v.id("messages"),
        newContent: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");
        if (message.role !== "assistant")
            throw new Error("Can only edit assistant messages");

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.db.get(message.branchId);
        if (!branch) throw new Error("Branch not found");

        const chat = await ctx.db.get(branch.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Unauthorized");
        }

        // Save edit history for assistant messages too
        const editHistory = message.editHistory || [];
        editHistory.push({
            content: message.content,
            timestamp: Date.now(),
        });

        // Update the assistant message content directly
        await ctx.db.patch(args.messageId, {
            content: args.newContent,
            editHistory,
            isStreaming: false, // Ensure it's not streaming after edit
        });

        return {
            success: true,
            messageId: args.messageId,
            newContent: args.newContent,
        };
    },
});

export const enhancePrompt = action({
    args: {
        originalPrompt: v.string(),
        context: v.optional(v.string()),
        responseMode: v.optional(v.string()),
    },
    handler: async (
        ctx,
        args
    ): Promise<{
        enhancedPrompt: string;
        wasEnhanced: boolean;
        originalPrompt?: string;
        error?: string;
    }> => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Get user preferences to check if prompt enhancement is enabled
        // const preferences = await ctx.db
        //     .query("preferences")
        //     .withIndex("by_user", (q) => q.eq("userId", userId))
        //     .first();

        const preferences = await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal,
            { userId }
        );

        if (!preferences?.aiSettings?.promptEnhancement) {
            return { enhancedPrompt: args.originalPrompt, wasEnhanced: false };
        }

        const responseMode =
            args.responseMode ||
            preferences.aiSettings?.responseMode ||
            "balanced";

        // Create enhancement instructions based on response mode
        const modeInstructions: Record<string, string> = {
            balanced:
                "Make this prompt clearer and more specific while maintaining balance",
            concise:
                "Make this prompt more focused and direct for brief responses",
            detailed:
                "Enhance this prompt to request comprehensive and thorough responses",
            creative:
                "Improve this prompt to encourage more creative and imaginative responses",
            analytical:
                "Refine this prompt to request data-driven and analytical responses",
            friendly:
                "Enhance this prompt for warm, conversational, and approachable responses",
            professional:
                "Improve this prompt for formal, business-appropriate responses",
        };

        const enhancementPrompt = `${modeInstructions[responseMode] || modeInstructions.balanced}.

Original prompt: "${args.originalPrompt}"

${args.context ? `Context: ${args.context}` : ""}

Provide an enhanced version that:
1. Is clearer and more specific
2. Includes relevant context if missing
3. Guides the AI toward the desired response style
4. Maintains the user's original intent
5. Is optimized for ${responseMode} responses

Return only the enhanced prompt without explanations.`;

        try {
            // Call AI generation to enhance the prompt
            const result: any = await ctx.runAction(
                internal.ai.generateResponse,
                {
                    messages: [
                        {
                            role: "user" as const,
                            content: enhancementPrompt,
                        },
                    ],
                    model: "gemini-2.0-flash", // Use a fast model for prompt enhancement
                    temperature: 0.3, // Lower temperature for consistent enhancement
                    // maxTokens: 500,
                }
            );

            return {
                enhancedPrompt: result.content || args.originalPrompt,
                wasEnhanced: true,
                originalPrompt: args.originalPrompt,
            };
        } catch (error) {
            // If enhancement fails, return original prompt
            return {
                enhancedPrompt: args.originalPrompt,
                wasEnhanced: false,
                error: "Enhancement failed",
            };
        }
    },
});

// Multi-AI Message Sending - Phase D2 (mirrors sendMessage structure)
export const sendMultiAIMessage = action({
    args: {
        chatId: v.id("chats"),
        content: v.string(),
        models: v.array(v.string()), // Array of model names to generate responses from
        commands: v.optional(v.array(v.string())),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio"),
                        v.literal("video")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
        referencedLibraryItems: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("attachment"),
                        v.literal("artifact"),
                        v.literal("media")
                    ),
                    id: v.string(),
                    name: v.string(),
                    size: v.optional(v.number()),
                    mimeType: v.optional(v.string()),
                })
            )
        ),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ userMessageId: any; assistantMessageId: any }> => {
        // Validate that at least 2 models are selected for multi-AI mode
        if (args.models.length < 2) {
            throw new Error("Multi-AI mode requires at least 2 models");
        }

        if (args.models.length > 8) {
            throw new Error("Multi-AI mode supports maximum 8 models");
        }

        // Add user message first (same as sendMessage)
        const userMessageId = await ctx.runMutation(api.messages.addMessage, {
            chatId: args.chatId,
            role: "user",
            content: args.content,
            attachments: args.attachments,
            referencedLibraryItems: args.referencedLibraryItems,
            commands: args.commands,
        });

        // Create assistant message placeholder with multi-AI metadata
        const responseIds = args.models.map((model) => ({
            model,
            responseId: `${model}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        }));

        const assistantMessageId = await ctx.runMutation(
            api.messages.addMessage,
            {
                chatId: args.chatId,
                role: "assistant",
                content: "🧠 Generating responses from multiple AI models...",
                model: args.models[0], // Primary model
                isStreaming: true,
            }
        );

        // Initialize multi-AI metadata
        await ctx.runMutation(api.messages.initializeMultiAIMessage, {
            messageId: assistantMessageId,
            selectedModels: args.models,
            responseIds: responseIds.map((r) => r.responseId),
        });

        // Generate responses from all models in parallel using existing streaming infrastructure
        await ctx.runAction(internal.ai.generateMultiAIResponses, {
            chatId: args.chatId,
            messageId: assistantMessageId,
            models: args.models,
            commands: args.commands,
            attachments: args.attachments,
            referencedLibraryItems: args.referencedLibraryItems,
            responseIds: responseIds.map((r) => r.responseId),
        });

        return {
            userMessageId,
            assistantMessageId,
        };
    },
});

// Initialize multi-AI message metadata
export const initializeMultiAIMessage = mutation({
    args: {
        messageId: v.id("messages"),
        selectedModels: v.array(v.string()),
        responseIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        // Initialize empty responses for each model
        const responses = args.selectedModels.map((model, index) => ({
            responseId: args.responseIds[index],
            model,
            content: "",
            timestamp: Date.now(),
            isPrimary: index === 0, // First model is primary by default
            isDeleted: false,
            metadata: {},
        }));

        await ctx.db.patch(args.messageId, {
            metadata: {
                ...message.metadata,
                multiAIResponses: {
                    selectedModels: args.selectedModels,
                    responses,
                    primaryResponseId: args.responseIds[0],
                },
            },
        });
    },
});

// Update specific multi-AI response (called by streaming infrastructure)
export const updateMultiAIResponse = mutation({
    args: {
        messageId: v.id("messages"),
        responseId: v.string(),
        content: v.string(),
        isComplete: v.boolean(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message || !message.metadata?.multiAIResponses) {
            throw new Error("Message not found or not a multi-AI message");
        }

        const multiAI = message.metadata.multiAIResponses;
        const updatedResponses = multiAI.responses.map((response) => {
            if (response.responseId === args.responseId) {
                return {
                    ...response,
                    content: args.content,
                    timestamp: args.isComplete
                        ? Date.now()
                        : response.timestamp,
                    metadata: args.metadata || response.metadata,
                };
            }
            return response;
        });

        // Update primary response content if this is the primary response
        const primaryResponse = updatedResponses.find((r) => r.isPrimary);
        const messageContent = primaryResponse
            ? primaryResponse.content
            : message.content;

        // Check if all responses are complete
        const allComplete = updatedResponses.every((r) => r.content.length > 0);

        await ctx.db.patch(args.messageId, {
            content: messageContent,
            isStreaming: !allComplete,
            metadata: {
                ...message.metadata,
                multiAIResponses: {
                    ...multiAI,
                    responses: updatedResponses,
                },
            },
        });
    },
});

// Update primary response for multi-AI message
export const updatePrimaryResponse = mutation({
    args: {
        messageId: v.id("messages"),
        responseId: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message || !message.metadata?.multiAIResponses) {
            throw new Error("Message not found or not a multi-AI message");
        }

        const multiAI = message.metadata.multiAIResponses;
        const selectedResponse = multiAI.responses.find(
            (r) => r.responseId === args.responseId
        );

        if (!selectedResponse || selectedResponse.isDeleted) {
            throw new Error("Response not found or deleted");
        }

        // Update all responses to set new primary
        const updatedResponses = multiAI.responses.map((response) => ({
            ...response,
            isPrimary: response.responseId === args.responseId,
        }));

        // Update message with new primary response
        await ctx.db.patch(args.messageId, {
            content: selectedResponse.content,
            model: selectedResponse.model,
            metadata: {
                ...message.metadata,
                multiAIResponses: {
                    ...multiAI,
                    responses: updatedResponses,
                    primaryResponseId: args.responseId,
                },
            },
        });

        return { success: true };
    },
});

// Delete a response from multi-AI message
export const deleteMultiAIResponse = mutation({
    args: {
        messageId: v.id("messages"),
        responseId: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message || !message.metadata?.multiAIResponses) {
            throw new Error("Message not found or not a multi-AI message");
        }

        const multiAI = message.metadata.multiAIResponses;
        const activeResponses = multiAI.responses.filter((r) => !r.isDeleted);

        // Prevent deleting if only 2 responses remain
        if (activeResponses.length <= 2) {
            throw new Error(
                "Cannot delete response: minimum 2 responses required"
            );
        }

        // Mark response as deleted
        const updatedResponses = multiAI.responses.map((response) => ({
            ...response,
            isDeleted:
                response.responseId === args.responseId
                    ? true
                    : response.isDeleted,
        }));

        // If deleted response was primary, set new primary
        const deletedResponse = multiAI.responses.find(
            (r) => r.responseId === args.responseId
        );
        let newPrimaryId = multiAI.primaryResponseId;

        if (deletedResponse?.isPrimary) {
            const newPrimary = updatedResponses.find((r) => !r.isDeleted);
            if (newPrimary) {
                newPrimaryId = newPrimary.responseId;
                updatedResponses.forEach((r) => {
                    r.isPrimary = r.responseId === newPrimaryId;
                });
            }
        }

        await ctx.db.patch(args.messageId, {
            metadata: {
                ...message.metadata,
                multiAIResponses: {
                    ...multiAI,
                    responses: updatedResponses,
                    primaryResponseId: newPrimaryId,
                },
            },
        });

        return { success: true };
    },
});

// Multi-AI Response Management
export const updateMessageMultiAI = mutation({
    args: {
        messageId: v.id("messages"),
        primaryResponseId: v.optional(v.string()),
        deleteResponseId: v.optional(v.string()),
    },
    handler: async (
        ctx,
        { messageId, primaryResponseId, deleteResponseId }
    ) => {
        const userId = await getUserId(ctx);
        if (!userId) {
            throw new ConvexError("Authentication required");
        }

        const message = await ctx.db.get(messageId);
        if (!message) {
            throw new ConvexError("Message not found");
        }

        // Get the branch to verify ownership
        const branch = await ctx.db.get(message.branchId);
        if (!branch) {
            throw new ConvexError("Branch not found");
        }

        const chat = await ctx.db.get(branch.chatId);
        if (!chat || chat.userId !== userId) {
            throw new ConvexError("Unauthorized");
        }

        const currentMetadata = message.metadata || {};
        const multiAIResponses = currentMetadata.multiAIResponses;

        if (!multiAIResponses) {
            throw new ConvexError("Message is not in multi-AI mode");
        }

        let updatedResponses = [...multiAIResponses.responses];

        // Handle deleting a response
        if (deleteResponseId) {
            const responseIndex = updatedResponses.findIndex(
                (r) => r.responseId === deleteResponseId
            );
            if (responseIndex === -1) {
                throw new ConvexError("Response not found");
            }

            // Mark as deleted instead of removing to preserve history
            updatedResponses[responseIndex] = {
                ...updatedResponses[responseIndex],
                isDeleted: true,
            };

            // If we're deleting the primary response, set a new primary
            if (multiAIResponses.primaryResponseId === deleteResponseId) {
                const activeResponses = updatedResponses.filter(
                    (r) => !r.isDeleted
                );
                if (activeResponses.length > 0) {
                    // Set first active response as primary
                    updatedResponses = updatedResponses.map((r) => ({
                        ...r,
                        isPrimary:
                            r.responseId === activeResponses[0].responseId &&
                            !r.isDeleted,
                    }));
                    primaryResponseId = activeResponses[0].responseId;
                }
            }
        }

        // Handle setting a new primary response
        if (primaryResponseId) {
            const responseExists = updatedResponses.find(
                (r) => r.responseId === primaryResponseId && !r.isDeleted
            );
            if (!responseExists) {
                throw new ConvexError("Primary response not found or deleted");
            }

            // Update primary flags
            updatedResponses = updatedResponses.map((response) => ({
                ...response,
                isPrimary:
                    response.responseId === primaryResponseId &&
                    !response.isDeleted,
            }));

            // Update message content to match primary response
            const primaryResponse = updatedResponses.find(
                (r) => r.responseId === primaryResponseId
            );
            if (primaryResponse && !primaryResponse.isDeleted) {
                await ctx.db.patch(messageId, {
                    content: primaryResponse.content,
                    model: primaryResponse.model,
                });
            }
        }

        // Update the message metadata
        await ctx.db.patch(messageId, {
            metadata: {
                ...currentMetadata,
                multiAIResponses: {
                    ...multiAIResponses,
                    responses: updatedResponses,
                    primaryResponseId:
                        primaryResponseId || multiAIResponses.primaryResponseId,
                },
            },
        });

        return { success: true };
    },
});

// Update message attachments
export const updateMessageAttachments = mutation({
    args: {
        messageId: v.id("messages"),
        attachments: v.array(
            v.object({
                type: v.union(
                    v.literal("image"),
                    v.literal("pdf"),
                    v.literal("file"),
                    v.literal("audio"),
                    v.literal("video")
                ),
                storageId: v.id("_storage"),
                name: v.string(),
                size: v.number(),
            })
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const message = await ctx.db.get(args.messageId);
        if (!message) throw new Error("Message not found");

        // NEW BRANCHING SYSTEM: Get chat through branch relationship
        const branch = await ctx.db.get(message.branchId);
        if (!branch) throw new Error("Branch not found");

        const chat = await ctx.db.get(branch.chatId);
        if (!chat || (chat.userId !== userId && !chat.isPublic)) {
            throw new Error("Unauthorized");
        }

        // Update message with new attachments
        await ctx.db.patch(args.messageId, {
            attachments: args.attachments,
        });

        console.log("✅ MESSAGE ATTACHMENTS UPDATED:", {
            messageId: args.messageId,
            attachmentCount: args.attachments.length,
            timestamp: new Date().toISOString(),
        });
    },
});
