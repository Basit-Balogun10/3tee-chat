import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(userId, {
      name: args.name,
    });
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Delete all user's chats and messages using new branching system
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const chat of chats) {
      // FIX: Delete all messages through branches instead of old index
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

    // Delete user account
    await ctx.db.delete(userId);
  },
});
