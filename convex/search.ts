import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Phase 3: Message-level search within a single chat (active branch + base messages)
export const searchMessagesInChat = query({
  args: {
    chatId: v.id("chats"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      messageId: v.id("messages"),
      chatId: v.id("chats"),
      role: v.string(),
      timestamp: v.number(),
      snippet: v.string(),
      fullMatch: v.boolean(),
    })
  ),
  handler: async (ctx, { chatId, query: searchQuery, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const q = searchQuery.trim();
    if (!q) return [];
    const qLower = q.toLowerCase();

    const chat = await ctx.db.get(chatId);
    if (!chat || (chat.userId !== userId && !chat.isPublic)) return [];

    // Collect message ids from base + active branch
    const baseIds = (chat.baseMessages || []) as Id<"messages">[];
    let branchIds: Id<"messages">[] = [];
    if (chat.activeBranchId) {
      const branch = await ctx.db.get(chat.activeBranchId);
      if (branch) branchIds = (branch.messages || []) as Id<"messages">[];
    }
    const allIds = [...baseIds, ...branchIds];

    const messages = await Promise.all(allIds.map((id) => ctx.db.get(id)));
    const results: Array<{
      messageId: Id<"messages">;
      chatId: Id<"chats">;
      role: string;
      timestamp: number;
      snippet: string;
      fullMatch: boolean;
    }> = [];

    for (const m of messages) {
      if (!m) continue;
      const content: string = (m as any).content || "";
      const lower = content.toLowerCase();
      const idx = lower.indexOf(qLower);
      if (idx !== -1) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(content.length, idx + q.length + 60);
        const snippet = content.slice(start, end);
        results.push({
          messageId: (m as any)._id,
          chatId: chat._id,
          role: (m as any).role || "user",
          timestamp: (m as any).timestamp || (m as any)._creationTime,
          snippet,
          fullMatch: content.trim().length === q.trim().length,
        });
      }
      if (limit && results.length >= limit) break;
    }

    // Sort by timestamp asc, then earliest match
    results.sort((a, b) => a.timestamp - b.timestamp);
    return results;
  },
});

// Phase 3: Global user message search across all own chats (active branches only)
export const searchUserMessages = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      messageId: v.id("messages"),
      chatId: v.id("chats"),
      chatTitle: v.string(),
      role: v.string(),
      timestamp: v.number(),
      snippet: v.string(),
      score: v.number(),
    })
  ),
  handler: async (ctx, { query: searchQuery, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const q = searchQuery.trim();
    if (!q) return [];
    const qLower = q.toLowerCase();
    const max = limit ?? 50;

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const results: Array<{
      messageId: Id<"messages">;
      chatId: Id<"chats">;
      chatTitle: string;
      role: string;
      timestamp: number;
      snippet: string;
      score: number;
    }> = [];

    for (const chat of chats) {
      const baseIds = (chat.baseMessages || []) as Id<"messages">[];
      let branchIds: Id<"messages">[] = [];
      if (chat.activeBranchId) {
        const branch = await ctx.db.get(chat.activeBranchId);
        if (branch) branchIds = (branch.messages || []) as Id<"messages">[];
      }
      const allIds = [...baseIds, ...branchIds];
      if (!allIds.length) continue;

      const messages = await Promise.all(allIds.map((id) => ctx.db.get(id)));
      for (const m of messages) {
        if (!m) continue;
        const content: string = (m as any).content || "";
        const lower = content.toLowerCase();
        const idx = lower.indexOf(qLower);
        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(content.length, idx + q.length + 60);
          const snippet = content.slice(start, end);
          const distanceFromEnd = content.length - (idx + q.length);
          const score = 100 - Math.min(90, idx) - Math.min(10, Math.log10(allIds.length + 1) * 4) - Math.min(20, distanceFromEnd / 10);
          results.push({
            messageId: (m as any)._id,
            chatId: chat._id,
            chatTitle: chat.title,
            role: (m as any).role || "user",
            timestamp: (m as any).timestamp || (m as any)._creationTime,
            snippet,
            score: Number(score.toFixed(2)),
          });
        }
        if (results.length >= max) break;
      }
      if (results.length >= max) break;
    }

    results.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
    return results;
  },
});
