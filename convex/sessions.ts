import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
    getAuthUserId,
    getAuthSessionId,
    invalidateSessions,
} from "@convex-dev/auth/server";

// Store session metadata when user logs in
export const storeSessionMetadata = mutation({
    args: {
        deviceInfo: v.string(),
        deviceName: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        const sessionId = await getAuthSessionId(ctx);

        if (!userId || !sessionId) {
            throw new Error("Not authenticated");
        }

        // Check if metadata already exists for this session
        const existing = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
            .first();

        if (existing) {
            // Update existing metadata
            await ctx.db.patch(existing._id, {
                lastActivity: Date.now(),
                deviceInfo: args.deviceInfo,
                deviceName: args.deviceName,
                ipAddress: args.ipAddress,
            });
            return existing._id;
        } else {
            // Create new metadata
            const metadataId = await ctx.db.insert("sessionMetadata", {
                sessionId,
                userId,
                deviceInfo: args.deviceInfo,
                deviceName: args.deviceName,
                ipAddress: args.ipAddress,
                lastActivity: Date.now(),
                createdAt: Date.now(),
            });
            return metadataId;
        }
    },
});

// Get all sessions for current user
export const getUserSessions = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        const currentSessionId = await getAuthSessionId(ctx);

        if (!userId) return [];

        // Get all session metadata for user
        const sessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Get actual auth sessions and combine with metadata
        const sessions = await Promise.all(
            sessionMetadata.map(async (metadata) => {
                const authSession = await ctx.db.get(metadata.sessionId);
                return {
                    sessionId: metadata.sessionId,
                    deviceInfo: metadata.deviceInfo,
                    deviceName: metadata.deviceName,
                    ipAddress: metadata.ipAddress,
                    lastActivity: metadata.lastActivity,
                    createdAt: metadata.createdAt,
                    isCurrentSession: metadata.sessionId === currentSessionId,
                    isActive: authSession !== null, // Session still exists in auth table
                };
            })
        );

        // Filter out sessions that no longer exist and sort by last activity
        return sessions
            .filter((session) => session.isActive)
            .sort((a, b) => b.lastActivity - a.lastActivity);
    },
});

// Sign out from a specific session
export const signOutSession = mutation({
    args: {
        sessionId: v.id("authSessions"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Verify the session belongs to the current user
        const sessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .first();

        if (!sessionMetadata || sessionMetadata.userId !== userId) {
            throw new Error("Session not found or unauthorized");
        }

        // Delete the auth session
        await ctx.db.delete(args.sessionId);

        // Clean up related auth data
        const [authRefreshTokens, authVerifiers] = await Promise.all([
            ctx.db
                .query("authRefreshTokens")
                .withIndex("sessionId", (q) =>
                    q.eq("sessionId", args.sessionId)
                )
                .collect(),
            ctx.db
                .query("authVerifiers")
                .withIndex("sessionId", (q) =>
                    q.eq("sessionId", args.sessionId)
                )
                .collect(),
        ]);

        // Delete refresh tokens and verifiers
        await Promise.all([
            ...authRefreshTokens.map((token) => ctx.db.delete(token._id)),
            ...authVerifiers.map((verifier) => ctx.db.delete(verifier._id)),
        ]);

        // Delete session metadata
        await ctx.db.delete(sessionMetadata._id);

        return { success: true };
    },
});

// Sign out from all other sessions (keep current session)
export const signOutAllOtherSessions = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        const currentSessionId = await getAuthSessionId(ctx);

        if (!userId || !currentSessionId) {
            throw new Error("Not authenticated");
        }

        // Use Convex Auth's invalidateSessions with except parameter
        await invalidateSessions(ctx, {
            userId,
            except: [currentSessionId],
        });

        // Clean up metadata for other sessions
        const otherSessionsMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) => q.neq(q.field("sessionId"), currentSessionId))
            .collect();

        // Delete metadata for other sessions
        await Promise.all(
            otherSessionsMetadata.map((metadata) => ctx.db.delete(metadata._id))
        );

        return {
            success: true,
            signedOutSessions: otherSessionsMetadata.length,
        };
    },
});

// Sign out from all sessions (including current)
export const signOutAllSessions = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        // Use Convex Auth's invalidateSessions without except parameter
        await invalidateSessions(ctx, { userId });

        // Clean up all session metadata
        const allSessionsMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Delete all metadata
        await Promise.all(
            allSessionsMetadata.map((metadata) => ctx.db.delete(metadata._id))
        );

        return {
            success: true,
            signedOutSessions: allSessionsMetadata.length,
        };
    },
});

// Update session activity (called periodically by client)
export const updateSessionActivity = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        const sessionId = await getAuthSessionId(ctx);

        if (!userId || !sessionId) return;

        const sessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
            .first();

        if (sessionMetadata) {
            await ctx.db.patch(sessionMetadata._id, {
                lastActivity: Date.now(),
            });
        }
    },
});

// Clean up orphaned session metadata (sessions that no longer exist)
export const cleanupOrphanedSessions = mutation({
    args: {},
    handler: async (ctx) => {
        const allMetadata = await ctx.db.query("sessionMetadata").collect();
        let cleanedUp = 0;

        for (const metadata of allMetadata) {
            const authSession = await ctx.db.get(metadata.sessionId);
            if (!authSession) {
                await ctx.db.delete(metadata._id);
                cleanedUp++;
            }
        }

        return { cleanedUp };
    },
});
