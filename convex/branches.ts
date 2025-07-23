import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// PHASE 3: FIXED - Branching Logic - Message Editing & Branch Creation

/**
 * Create a main branch for a new chat
 * Case 0 - New Chat Creation: When a new chat is created, create a new branch called "main" branch
 */
export const createMainBranch = mutation({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, { chatId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const now = Date.now();

        // Create the main branch
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

        // Update the chat to reference this as the active branch
        await ctx.db.patch(chatId, {
            activeBranchId: mainBranchId,
            baseMessages: [],
            activeMessages: [], // Will be computed
            updatedAt: now,
        });

        return mainBranchId;
    },
});

/**
 * Get the main branch for a chat
 */
export const getMainBranch = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, { chatId }) => {
        const mainBranch = await ctx.db
            .query("branches")
            .withIndex("by_chat_main", (q) =>
                q.eq("chatId", chatId).eq("isMain", true)
            )
            .first();

        return mainBranch;
    },
});

/**
 * Get all branches for a chat
 */
export const getChatBranches = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, { chatId }) => {
        const branches = await ctx.db
            .query("branches")
            .withIndex("by_chat", (q) => q.eq("chatId", chatId))
            .collect();

        return branches.sort((a, b) => a.createdAt - b.createdAt);
    },
});

/**
 * Get a specific branch with its populated messages
 * PHASE 2: Implement efficient message population
 */
export const getBranchWithMessages = query({
    args: {
        branchId: v.id("branches"),
    },
    handler: async (ctx, { branchId }) => {
        const branch = await ctx.db.get(branchId);
        if (!branch) return null;

        // Populate messages efficiently - join pattern to avoid repeated queries
        const messages = await Promise.all(
            branch.messages.map((messageId) => ctx.db.get(messageId))
        );

        // Filter out null messages and sort by timestamp
        const validMessages = messages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        return {
            ...branch,
            populatedMessages: validMessages,
        };
    },
});

/**
 * Get complete chat messages (baseMessages + active branch messages)
 * PHASE 2: Core message retrieval with efficient querying
 */
export const getChatMessages = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, { chatId }) => {
        const chat = await ctx.db.get(chatId);
        if (!chat) return [];

        // Get active branch
        const activeBranchId = chat.activeBranchId;
        if (!activeBranchId) return [];

        const activeBranch = await ctx.db.get(activeBranchId);
        if (!activeBranch) return [];

        // Combine baseMessages + activeBranch.messages efficiently
        const baseMessageIds = chat.baseMessages || [];
        const branchMessageIds = activeBranch.messages || [];
        const allMessageIds = [...baseMessageIds, ...branchMessageIds];

        // Single query to get all messages
        const messages = await Promise.all(
            allMessageIds.map((messageId) => ctx.db.get(messageId))
        );

        // Filter out null messages and maintain order
        const validMessages = messages
            .filter((msg) => msg !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        return validMessages;
    },
});

/**
 * PHASE 3 FIX: Create a new branch from a message edit
 * FIXED: Branch Navigation Numbering, baseMessages Calculation, Error Handling
 */
export const createBranchFromMessageEdit = mutation({
    args: {
        messageId: v.id("messages"),
        newContent: v.string(),
    },
    handler: async (ctx, { messageId, newContent }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        try {
            const now = Date.now();

            // Get the message being edited
            const message = await ctx.db.get(messageId);
            if (!message) throw new Error("Message not found");

            // Get the current branch
            const currentBranch = await ctx.db.get(message.branchId);
            if (!currentBranch) throw new Error("Current branch not found");

            // Get the chat and verify ownership
            const chat = await ctx.db.get(currentBranch.chatId);
            if (!chat) throw new Error("Chat not found");
            if (chat.userId !== userId && !chat.isPublic) {
                throw new Error("Unauthorized to edit this message");
            }

            // PHASE 3 FIX: Improved baseMessages calculation BEFORE branch creation
            await updateBaseMessagesFromBranch(ctx, chat._id, messageId);

            // Check if this message already has branches
            const existingBranches = await ctx.db
                .query("branches")
                .withIndex("by_from_message", (q) =>
                    q.eq("fromMessageId", messageId)
                )
                .collect();

            let newBranchId: Id<"branches">;
            let allBranches: Id<"branches">[];
            let branchNumber: number;

            if (existingBranches.length === 0) {
                // FIRST EDIT: Create Branch 1 & 2
                
                // PHASE 3 FIX: Branch 1 becomes the CURRENT activeBranchId (following spec)
                const branch1Id = await ctx.db.insert("branches", {
                    chatId: currentBranch.chatId,
                    fromMessageId: messageId,
                    messages: [], // Will be populated from current messages up to this point
                    isMain: false,
                    createdAt: now,
                    updatedAt: now,
                    branchName: "Branch 1",
                    description: "Original version",
                });

                // Branch 2: New branch with edited message (becomes active)
                newBranchId = await ctx.db.insert("branches", {
                    chatId: currentBranch.chatId,
                    fromMessageId: messageId,
                    messages: [messageId], // Start with the edited message
                    isMain: false,
                    createdAt: now,
                    updatedAt: now,
                    branchName: "Branch 2", 
                    description: "Edited version",
                });

                allBranches = [branch1Id, newBranchId];
                branchNumber = 2; // New branch becomes #2, making it active

                // PHASE 3 FIX: Update chat to use new branch as active
                await ctx.db.patch(chat._id, {
                    activeBranchId: newBranchId,
                    updatedAt: now,
                });

            } else {
                // SUBSEQUENT EDIT: Create new branch (Branch 3, 4, etc.)
                branchNumber = existingBranches.length + 2;

                newBranchId = await ctx.db.insert("branches", {
                    chatId: currentBranch.chatId,
                    fromMessageId: messageId,
                    messages: [messageId],
                    isMain: false,
                    createdAt: now,
                    updatedAt: now,
                    branchName: `Branch ${branchNumber}`,
                    description: `Edited version ${branchNumber - 1}`,
                });

                const messageBranches = message.branches || [];
                allBranches = [...messageBranches, newBranchId];

                // PHASE 3 FIX: Update chat to use new branch as active
                await ctx.db.patch(chat._id, {
                    activeBranchId: newBranchId,
                    updatedAt: now,
                });
            }

            // Update the message with new content and branch relationships
            await ctx.db.patch(messageId, {
                content: newContent,
                branches: allBranches,
                activeBranchId: newBranchId,
            });

            // PHASE 3 FIX: Update activeMessages consistently
            await updateActiveMessagesForChat(ctx, chat._id);

            return {
                newBranchId,
                branchNumber,
                totalBranches: allBranches.length,
                activeBranchName: `Branch ${branchNumber}`,
            };

        } catch (error) {
            console.error("Error creating branch from message edit:", error);
            throw new Error(`Failed to create branch: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
});

/**
 * PHASE 3 FIX: Navigate between branches of a message
 * FIXED: Proper branch navigation with consistent baseMessages updates
 */
export const navigateToBranch = mutation({
    args: {
        messageId: v.id("messages"),
        branchId: v.id("branches"),
    },
    handler: async (ctx, { messageId, branchId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        try {
            const now = Date.now();

            // Get the message and target branch
            const message = await ctx.db.get(messageId);
            if (!message) throw new Error("Message not found");

            const targetBranch = await ctx.db.get(branchId);
            if (!targetBranch) throw new Error("Target branch not found");

            // Get chat and verify ownership
            const chat = await ctx.db.get(targetBranch.chatId);
            if (!chat) throw new Error("Chat not found");
            if (chat.userId !== userId && !chat.isPublic) {
                throw new Error("Unauthorized to navigate this chat");
            }

            // Verify this branch is associated with this message
            const messageBranches = message.branches || [];
            if (!messageBranches.includes(branchId)) {
                throw new Error("Branch is not associated with this message");
            }

            // PHASE 3 FIX: Update baseMessages calculation BEFORE switching
            await updateBaseMessagesFromBranch(ctx, targetBranch.chatId, messageId);

            // Update message to point to new active branch
            await ctx.db.patch(messageId, {
                activeBranchId: branchId,
            });

            // Update chat's active branch
            await ctx.db.patch(targetBranch.chatId, {
                activeBranchId: branchId,
                updatedAt: now,
            });

            // PHASE 3 FIX: Update active messages consistently
            await updateActiveMessagesForChat(ctx, targetBranch.chatId);

            return {
                switchedToBranch: branchId,
                branchName: targetBranch.branchName,
                success: true,
            };

        } catch (error) {
            console.error("Error navigating to branch:", error);
            throw new Error(`Failed to navigate to branch: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
});

/**
 * PHASE 3 FIX: Improved BaseMessages Calculation Algorithm
 * Now consistently applied across all branch operations
 */
async function updateBaseMessagesFromBranch(
    ctx: any,
    chatId: Id<"chats">,
    fromMessageId: Id<"messages">
) {
    const chat = await ctx.db.get(chatId);
    if (!chat || !chat.activeBranchId) return;

    const activeBranch = await ctx.db.get(chat.activeBranchId);
    if (!activeBranch) return;

    // Get all messages from baseMessages + activeBranch.messages
    const currentBaseMessages = chat.baseMessages || [];
    const currentBranchMessages = activeBranch.messages || [];
    const allMessages = [...currentBaseMessages, ...currentBranchMessages];

    // Find the index of the message we're branching from
    const fromMessageIndex = allMessages.findIndex(
        (msgId) => msgId === fromMessageId
    );

    if (fromMessageIndex !== -1) {
        // PHASE 3 FIX: CALCULATING BASE MESSAGES (following spec exactly):
        // newBaseMessages = allMessages.slice(0, allMessages.indexOf(fromMessageId))
        const newBaseMessages = allMessages.slice(0, fromMessageIndex);

        await ctx.db.patch(chatId, {
            baseMessages: newBaseMessages,
            updatedAt: Date.now(),
        });

        console.log("📊 BASE MESSAGES UPDATED:", {
            chatId,
            fromMessageId,
            newBaseMessagesCount: newBaseMessages.length,
            previousCount: currentBaseMessages.length,
        });
    }
}

/**
 * PHASE 3 FIX: Consistent activeMessages update function
 * Called whenever baseMessages or active branch changes
 */
async function updateActiveMessagesForChat(
    ctx: any,
    chatId: Id<"chats">
) {
    const chat = await ctx.db.get(chatId);
    if (!chat || !chat.activeBranchId) return;

    const activeBranch = await ctx.db.get(chat.activeBranchId);
    if (!activeBranch) return;

    // Compute activeMessages = baseMessages + activeBranch.messages
    const baseMessages = chat.baseMessages || [];
    const branchMessages = activeBranch.messages || [];
    const activeMessages = [...baseMessages, ...branchMessages];

    await ctx.db.patch(chatId, {
        activeMessages,
        updatedAt: Date.now(),
    });

    console.log("🔄 ACTIVE MESSAGES UPDATED:", {
        chatId,
        baseMessagesCount: baseMessages.length,
        branchMessagesCount: branchMessages.length,
        totalActiveMessages: activeMessages.length,
    });

    return activeMessages;
}

/**
 * Update active messages array efficiently
 * Called whenever baseMessages or active branch changes
 */
export const updateActiveMessages = mutation({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, { chatId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        return await updateActiveMessagesForChat(ctx, chatId);
    },
});

/**
 * PHASE 3 FIX: Get all branches for a specific message
 * FIXED: Proper branch numbering according to specification
 */
export const getMessageBranches = query({
    args: {
        messageId: v.id("messages"),
    },
    handler: async (ctx, { messageId }) => {
        const message = await ctx.db.get(messageId);
        if (!message || !message.branches || message.branches.length === 0) {
            return null;
        }

        try {
            // Get all branches and populate with their data
            const branches = await Promise.all(
                message.branches.map(async (branchId) => {
                    const branch = await ctx.db.get(branchId);
                    return branch;
                })
            );

            const validBranches = branches.filter((branch) => branch !== null);
            const activeBranchId = message.activeBranchId;

            // PHASE 3 FIX: Branch Navigation Numbering
            // The first branch in the branches array becomes the CURRENT activeBranchId (defaults to the main branch)
            // Display as 1/2, 1/3 in frontend message branch navigator
            const currentBranchIndex = validBranches.findIndex(branch => branch._id === activeBranchId);
            const displayNumber = currentBranchIndex + 1;

            return {
                branches: validBranches.map((branch, index) => ({
                    id: branch._id,
                    name: branch.branchName || `Branch ${index + 1}`,
                    description: branch.description,
                    isActive: branch._id === activeBranchId,
                    displayNumber: index + 1,
                    messageCount: branch.messages.length,
                    createdAt: branch.createdAt,
                })),
                totalBranches: validBranches.length,
                activeBranchId,
                currentDisplayNumber: displayNumber,
                navigationDisplay: `${displayNumber}/${validBranches.length}`,
            };

        } catch (error) {
            console.error("Error getting message branches:", error);
            return null;
        }
    },
});

/**
 * PHASE 3 FIX: Handle message deletion with branch cleanup
 * IMPROVED: Better error handling and data consistency
 */
export const handleMessageDeletion = mutation({
    args: {
        messageId: v.id("messages"),
    },
    handler: async (ctx, { messageId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        try {
            const message = await ctx.db.get(messageId);
            if (!message) throw new Error("Message not found");

            const branch = await ctx.db.get(message.branchId);
            if (!branch) throw new Error("Branch not found");

            const chat = await ctx.db.get(branch.chatId);
            if (!chat) throw new Error("Chat not found");
            
            // Verify ownership
            if (chat.userId !== userId && !chat.isPublic) {
                throw new Error("Unauthorized to delete this message");
            }

            // Get all branches associated with this message
            const messageBranches = message.branches || [];

            // PHASE 3 FIX: Clean up branches properly
            if (messageBranches.length > 0) {
                for (const branchId of messageBranches) {
                    try {
                        await ctx.db.delete(branchId);
                    } catch (error) {
                        console.warn(`Failed to delete branch ${branchId}:`, error);
                    }
                }
            }

            // Remove message from branch
            const updatedMessages = branch.messages.filter(
                (id) => id !== messageId
            );
            await ctx.db.patch(branch._id, {
                messages: updatedMessages,
                updatedAt: Date.now(),
            });

            // PHASE 3 FIX: Data Consistency - Reinitialize main branch if needed
            if (updatedMessages.length === 0 && !branch.isMain) {
                // Get main branch
                const mainBranch = await ctx.db
                    .query("branches")
                    .withIndex("by_chat_main", (q) =>
                        q.eq("chatId", chat._id).eq("isMain", true)
                    )
                    .first();

                if (mainBranch) {
                    await ctx.db.patch(mainBranch._id, {
                        messages: [],
                        updatedAt: Date.now(),
                    });

                    await ctx.db.patch(chat._id, {
                        activeBranchId: mainBranch._id,
                        baseMessages: chat.baseMessages || [],
                        updatedAt: Date.now(),
                    });

                    // Update activeMessages consistently
                    await updateActiveMessagesForChat(ctx, chat._id);
                }
            } else {
                // Update activeMessages for the chat
                await updateActiveMessagesForChat(ctx, chat._id);
            }

            return { success: true, deletedBranches: messageBranches.length };

        } catch (error) {
            console.error("Error deleting message with branch cleanup:", error);
            throw new Error(`Failed to delete message: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
});
