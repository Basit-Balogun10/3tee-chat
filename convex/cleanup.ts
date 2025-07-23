import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Internal query to find chats that need auto-archiving or auto-deletion
export const findChatsForCleanup = internalQuery({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        
        // Get all users with lifecycle settings enabled
        const users = await ctx.db.query("preferences").collect();
        const cleanupTasks = [];

        for (const userPrefs of users) {
            const lifecycleSettings = userPrefs.chatLifecycleSettings;
            if (!lifecycleSettings) continue;

            // Get user's chats that are candidates for cleanup
            const userChats = await ctx.db
                .query("chats")
                .withIndex("by_user", (q) => q.eq("userId", userPrefs.userId))
                .collect();

            for (const chat of userChats) {
                // Skip temporary chats (they have their own cleanup logic)
                if (chat.isTemporary) continue;
                
                // Skip already archived chats for deletion check
                if (chat.isArchived && lifecycleSettings.autoDeleteEnabled) {
                    const deleteThreshold = now - ((lifecycleSettings.autoDeleteDays || 30) * 24 * 60 * 60 * 1000);
                    if (chat.archivedAt && chat.archivedAt < deleteThreshold) {
                        cleanupTasks.push({
                            type: "delete" as const,
                            chatId: chat._id,
                            userId: userPrefs.userId,
                            reason: `Auto-delete after ${lifecycleSettings.autoDeleteDays || 30} days in archive`
                        });
                    }
                } 
                // Check for archiving (only non-archived chats)
                else if (!chat.isArchived && lifecycleSettings.autoArchiveEnabled) {
                    const archiveThreshold = now - ((lifecycleSettings.autoArchiveDays || 30) * 24 * 60 * 60 * 1000);
                    if (chat.updatedAt < archiveThreshold) {
                        cleanupTasks.push({
                            type: "archive" as const,
                            chatId: chat._id,
                            userId: userPrefs.userId,
                            reason: `Auto-archive after ${lifecycleSettings.autoArchiveDays || 30} days of inactivity`
                        });
                    }
                }
            }
        }

        return cleanupTasks;
    },
});

// Internal mutation to perform cleanup tasks
export const performCleanupTask = internalMutation({
    args: {
        type: v.union(v.literal("archive"), v.literal("delete")),
        chatId: v.id("chats"),
        userId: v.id("users"),
        reason: v.string(),
    },
    handler: async (ctx, { type, chatId, userId, reason }) => {
        const chat = await ctx.db.get(chatId);
        if (!chat || chat.userId !== userId) {
            return { success: false, error: "Chat not found or access denied" };
        }

        try {
            if (type === "archive") {
                await ctx.db.patch(chatId, {
                    isArchived: true,
                    archivedAt: Date.now(),
                });
                return { success: true, action: "archived", reason };
            } else if (type === "delete") {
                // Delete all branches and messages for this chat
                const branches = await ctx.db
                    .query("branches")
                    .withIndex("by_chat", (q) => q.eq("chatId", chatId))
                    .collect();

                for (const branch of branches) {
                    // Delete all messages in this branch
                    for (const messageId of branch.messages) {
                        await ctx.db.delete(messageId);
                    }
                    // Delete the branch itself
                    await ctx.db.delete(branch._id);
                }

                // Delete the chat itself
                await ctx.db.delete(chatId);
                return { success: true, action: "deleted", reason };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Failed to ${type} chat: ${errorMessage}` };
        }

        return { success: false, error: "Invalid cleanup type" };
    },
});

// Cleanup expired temporary chats
export const cleanupExpiredTemporaryChats = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        
        // Find all expired temporary chats
        const expiredChats = await ctx.db
            .query("chats")
            .filter((q) => q.and(
                q.eq(q.field("isTemporary"), true),
                q.lt(q.field("temporaryUntil"), now)
            ))
            .collect();

        let deletedCount = 0;
        
        for (const chat of expiredChats) {
            // Check if user has auto-cleanup enabled
            const userPrefs = await ctx.db
                .query("preferences")
                .withIndex("by_user", (q) => q.eq("userId", chat.userId))
                .first();

            if (userPrefs?.temporaryChatsSettings?.autoCleanup) {
                // Delete all branches and messages for this chat
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

                // Delete the chat itself
                await ctx.db.delete(chat._id);
                deletedCount++;
            }
        }

        return { deletedCount, totalExpired: expiredChats.length };
    },
});

// Internal mutation to run the main chat lifecycle cleanup - Phase 2
export const runChatLifecycleCleanup = internalMutation({
    args: {},
    returns: v.object({
        message: v.string(),
        tasksProcessed: v.number(),
        successful: v.optional(v.number()),
        failed: v.optional(v.number()),
    }),
    handler: async (ctx): Promise<{
        message: string;
        tasksProcessed: number;
        successful?: number;
        failed?: number;
    }> => {
        console.log("🧹 Starting chat lifecycle cleanup job...");
        
        try {
            // Use ctx.runQuery to call the internal query
            const cleanupTasks: Array<{
                type: "archive" | "delete";
                chatId: any;
                userId: any;
                reason: string;
            }> = await ctx.runQuery(internal.cleanup.findChatsForCleanup);
            
            if (cleanupTasks.length === 0) {
                console.log("✅ No chats need cleanup");
                return { message: "No chats need cleanup", tasksProcessed: 0 };
            }

            console.log(`📋 Found ${cleanupTasks.length} cleanup tasks to process`);
            
            let successCount = 0;
            let failureCount = 0;

            // Process each cleanup task
            for (const task of cleanupTasks) {
                try {
                    // Use ctx.runMutation to call the internal mutation
                    const result = await ctx.runMutation(internal.cleanup.performCleanupTask, {
                        type: task.type,
                        chatId: task.chatId,
                        userId: task.userId,
                        reason: task.reason,
                    });

                    if (result.success) {
                        successCount++;
                        console.log(`✅ ${result.action} chat: ${result.reason}`);
                    } else {
                        failureCount++;
                        console.error(`❌ Failed cleanup task: ${result.error}`);
                    }
                } catch (error) {
                    failureCount++;
                    console.error(`❌ Error processing cleanup task:`, error);
                }
            }

            console.log(`🧹 Cleanup completed: ${successCount} successful, ${failureCount} failed`);
            
            return {
                message: `Processed ${cleanupTasks.length} tasks: ${successCount} successful, ${failureCount} failed`,
                tasksProcessed: cleanupTasks.length,
                successful: successCount,
                failed: failureCount
            };
        } catch (error) {
            console.error("❌ Chat lifecycle cleanup job failed:", error);
            throw error;
        }
    },
});