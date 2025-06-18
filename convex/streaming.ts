import { v } from "convex/values";
import {
    mutation,
    internalQuery,
    internalMutation,
    query,
    action,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Enhanced streaming session creation with resumable features
export const createStreamingSession = mutation({
    args: {
        messageId: v.id("messages"),
        sessionId: v.optional(v.string()),
        provider: v.optional(v.string()),
        modelId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const sessionId =
            args.sessionId ||
            `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return await ctx.db.insert("streamingSessions", {
            messageId: args.messageId,
            userId,
            isStopped: false,
            createdAt: Date.now(),
            sessionId,
            provider: args.provider || "unknown",
            modelId: args.modelId || "unknown",
            isComplete: false,
            lastChunkIndex: 0,
            errorCount: 0,
        });
    },
});

// Internal version for use in actions with enhanced resumable support
export const createStreamingSessionInternal = internalMutation({
    args: {
        messageId: v.id("messages"),
        userId: v.id("users"),
        sessionId: v.optional(v.string()),
        provider: v.optional(v.string()),
        modelId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const sessionId =
            args.sessionId ||
            `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return await ctx.db.insert("streamingSessions", {
            messageId: args.messageId,
            userId: args.userId,
            isStopped: false,
            createdAt: Date.now(),
            sessionId,
            provider: args.provider || "unknown",
            modelId: args.modelId || "unknown",
            isComplete: false,
            lastChunkIndex: 0,
            errorCount: 0,
        });
    },
});

// Update streaming session with chunk tracking
export const updateStreamingSession = internalMutation({
    args: {
        sessionId: v.string(),
        lastChunkIndex: v.optional(v.number()),
        resumeToken: v.optional(v.string()),
        isComplete: v.optional(v.boolean()),
        errorCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("streamingSessions")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .first();

        if (!session) {
            throw new Error("Streaming session not found");
        }

        const updates: any = {};
        if (args.lastChunkIndex !== undefined)
            updates.lastChunkIndex = args.lastChunkIndex;
        if (args.resumeToken !== undefined)
            updates.resumeToken = args.resumeToken;
        if (args.isComplete !== undefined) updates.isComplete = args.isComplete;
        if (args.errorCount !== undefined) updates.errorCount = args.errorCount;
        if (Object.keys(updates).length > 0) {
            updates.lastResumedAt = Date.now();
        }

        await ctx.db.patch(session._id, updates);
        return session._id;
    },
});

// Resume a streaming session after page reload
export const resumeStreamingSession = action({
    args: {
        sessionId: v.string(),
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Get the streaming session
        const session = await ctx.runQuery(
            internal.streaming.getStreamingSessionBySessionId,
            {
                sessionId: args.sessionId,
            }
        );

        if (!session) {
            throw new Error("Streaming session not found");
        }

        if (session.userId !== userId) {
            throw new Error("Access denied");
        }

        if (session.isComplete) {
            return { status: "complete", message: "Stream already completed" };
        }

        if (session.isStopped) {
            return { status: "stopped", message: "Stream was stopped by user" };
        }

        // Check if too many errors occurred
        if (session.errorCount && session.errorCount >= 3) {
            await ctx.runMutation(internal.streaming.markSessionStopped, {
                sessionId: args.sessionId,
            });
            return { status: "failed", message: "Too many errors occurred" };
        }

        try {
            // Get the message and current content
            const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
                messageId: args.messageId,
            });

            if (!message) {
                throw new Error("Message not found");
            }

            // Continue the stream from where it left off using the AI resume function directly
            await ctx.runAction(internal.ai.resumeStreamingResponse, {
                sessionId: args.sessionId,
                messageId: args.messageId,
                currentContent: message.content,
                lastChunkIndex: session.lastChunkIndex || 0,
                resumeToken: session.resumeToken,
            });

            return {
                status: "resumed",
                message: "Stream resumed successfully",
            };
        } catch (error) {
            console.error("Resume streaming error:", error);

            // Increment error count
            await ctx.runMutation(internal.streaming.updateStreamingSession, {
                sessionId: args.sessionId,
                errorCount: (session.errorCount || 0) + 1,
            });

            throw error;
        }
    },
});

// Check for incomplete streams on user reconnection
export const getIncompleteStreams = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];

        // Find streams that are not complete and not stopped
        const incompleteSessions = await ctx.db
            .query("streamingSessions")
            .withIndex("by_user_active", (q) =>
                q.eq("userId", userId).eq("isComplete", false)
            )
            .filter((q) => q.eq(q.field("isStopped"), false))
            .collect();

        // Only return recent sessions (within last hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        return incompleteSessions.filter(
            (session) =>
                session.createdAt > oneHourAgo ||
                (session.lastResumedAt && session.lastResumedAt > oneHourAgo)
        );
    },
});

// Auto-recovery mechanism for incomplete streams
export const autoRecoverIncompleteStreams = action({
    args: {},
    handler: async (ctx): Promise<any[]> => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const incompleteStreams: any[] = await ctx.runQuery(
            internal.streaming.getIncompleteStreamsInternal,
            {
                userId,
            }
        );

        const recoveryResults = [];

        for (const session of incompleteStreams) {
            try {
                // Check if the message still exists and is incomplete
                // Use the AI resume function directly instead of trying to call the streaming function recursively
                const result: any = await ctx.runAction(
                    internal.ai.resumeStreamingResponse,
                    {
                        sessionId: session.sessionId,
                        messageId: session.messageId,
                        currentContent: "", // Will be fetched in the AI function
                        lastChunkIndex: session.lastChunkIndex || 0,
                        resumeToken: session.resumeToken,
                    }
                );

                recoveryResults.push({
                    sessionId: session.sessionId,
                    messageId: session.messageId,
                    status: "resumed",
                    message: "Stream recovery initiated",
                });
            } catch (error: unknown) {
                console.error(
                    `Failed to recover stream ${session.sessionId}:`,
                    error
                );

                const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";

                recoveryResults.push({
                    sessionId: session.sessionId,
                    messageId: session.messageId,
                    status: "failed",
                    message: errorMessage,
                });

                // Increment error count and potentially stop
                const errorCount = (session.errorCount || 0) + 1;
                if (errorCount >= 3) {
                    await ctx.runMutation(
                        internal.streaming.markSessionStopped,
                        {
                            sessionId: session.sessionId,
                        }
                    );
                } else {
                    await ctx.runMutation(
                        internal.streaming.updateStreamingSession,
                        {
                            sessionId: session.sessionId,
                            errorCount,
                        }
                    );
                }
            }
        }

        return recoveryResults;
    },
});

// Internal query for incomplete streams
export const getIncompleteStreamsInternal = internalQuery({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        const incompleteSessions = await ctx.db
            .query("streamingSessions")
            .withIndex("by_user_active", (q) =>
                q.eq("userId", args.userId).eq("isComplete", false)
            )
            .filter((q) => q.eq(q.field("isStopped"), false))
            .collect();

        return incompleteSessions.filter(
            (session) =>
                session.createdAt > oneHourAgo ||
                (session.lastResumedAt && session.lastResumedAt > oneHourAgo)
        );
    },
});

// Get streaming session by session ID
export const getStreamingSessionBySessionId = internalQuery({
    args: { sessionId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("streamingSessions")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .first();
    },
});

// Mark session as stopped
export const markSessionStopped = internalMutation({
    args: { sessionId: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("streamingSessions")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .first();

        if (session) {
            await ctx.db.patch(session._id, {
                isStopped: true,
                isComplete: true,
            });
        }
    },
});

// Enhanced stop streaming with session ID support
export const stopStreaming = mutation({
    args: {
        messageId: v.optional(v.id("messages")),
        sessionId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        let session;

        if (args.sessionId) {
            session = await ctx.db
                .query("streamingSessions")
                .withIndex("by_session", (q) =>
                    q.eq("sessionId", args.sessionId!)
                )
                .first();
        } else if (args.messageId) {
            session = await ctx.db
                .query("streamingSessions")
                .withIndex("by_message", (q) =>
                    q.eq("messageId", args.messageId!)
                )
                .first();
        }

        if (session && session.userId === userId) {
            await ctx.db.patch(session._id, {
                isStopped: true,
                isComplete: true,
            });
            return { success: true, sessionId: session.sessionId };
        }

        return {
            success: false,
            message: "Session not found or access denied",
        };
    },
});

// Clean up old completed sessions (called periodically)
export const cleanupOldSessions = internalMutation({
    args: {},
    handler: async (ctx) => {
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

        const oldSessions = await ctx.db
            .query("streamingSessions")
            .filter((q) =>
                q.and(
                    q.lt(q.field("createdAt"), threeDaysAgo),
                    q.eq(q.field("isComplete"), true)
                )
            )
            .collect();

        for (const session of oldSessions) {
            await ctx.db.delete(session._id);
        }

        return { cleaned: oldSessions.length };
    },
});

// Get streaming session (existing function with enhanced support)
export const getStreamingSession = internalQuery({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("streamingSessions")
            .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
            .first();
    },
});
