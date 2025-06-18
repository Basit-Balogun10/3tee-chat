import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const DAILY_MESSAGE_LIMIT = 20;

export const checkAnonymousLimit = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const usage = await ctx.db
      .query("anonymousUsage")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!usage) {
      return { canSend: true, remaining: DAILY_MESSAGE_LIMIT };
    }

    // Reset count if it's a new day
    if (usage.lastUsed < todayTimestamp) {
      return { canSend: true, remaining: DAILY_MESSAGE_LIMIT, needsReset: true };
    }

    const remaining = DAILY_MESSAGE_LIMIT - usage.messageCount;
    return { canSend: remaining > 0, remaining };
  },
});

export const incrementAnonymousUsage = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const usage = await ctx.db
      .query("anonymousUsage")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (usage) {
      // Reset count if it's a new day
      if (usage.lastUsed < todayTimestamp) {
        await ctx.db.patch(usage._id, {
          messageCount: 1,
          lastUsed: Date.now(),
        });
      } else {
        await ctx.db.patch(usage._id, {
          messageCount: usage.messageCount + 1,
          lastUsed: Date.now(),
        });
      }
    } else {
      await ctx.db.insert("anonymousUsage", {
        sessionId: args.sessionId,
        messageCount: 1,
        lastUsed: Date.now(),
      });
    }
  },
});
