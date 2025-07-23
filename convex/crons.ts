import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Phase 2: Chat Lifecycle Management - Run cleanup tasks every day at 2 AM UTC
crons.cron(
    "chat-lifecycle-cleanup",
    "0 2 * * *", // Daily at 2:00 AM UTC
    internal.cleanup.runChatLifecycleCleanup,
    {}
);

// Phase 2: Temporary chat cleanup - Run every 6 hours to clean up expired temporary chats
crons.interval(
    "temporary-chat-cleanup", 
    { hours: 6 }, // Every 6 hours
    internal.cleanup.cleanupExpiredTemporaryChats,
    {}
);

export default crons;