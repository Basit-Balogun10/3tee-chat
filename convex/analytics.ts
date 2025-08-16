import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Main analytics query that returns comprehensive insights
export const getAnalytics = query({
    args: {
        timeRange: v.object({
            start: v.number(),
            end: v.number(),
            granularity: v.union(
                v.literal("hour"),
                v.literal("day"),
                v.literal("week"),
                v.literal("month")
            ),
        }),
    },
    returns: v.object({
        overview: v.object({
            totalChats: v.number(),
            totalMessages: v.number(),
            totalProjects: v.number(),
            totalAttachments: v.number(),
            totalArtifacts: v.number(),
            totalMedia: v.number(),
            averageMessagesPerChat: v.number(),
            mostActiveDay: v.string(),
            mostActiveHour: v.number(),
        }),
        chatAnalytics: v.object({
            totalChats: v.number(),
            newChats: v.number(),
            temporaryChats: v.number(),
            forkedChats: v.number(),
            starredChats: v.number(),
            archivedChats: v.number(),
            passwordProtectedChats: v.number(),
            sharedChats: v.number(),
            averageChatLifespan: v.number(),
            chatsByModel: v.array(
                v.object({
                    model: v.string(),
                    count: v.number(),
                    percentage: v.number(),
                })
            ),
            chatCreationTrend: v.array(
                v.object({
                    period: v.string(),
                    count: v.number(),
                    timestamp: v.number(),
                })
            ),
            chatActivityHeatmap: v.array(
                v.object({
                    hour: v.number(),
                    day: v.number(),
                    activity: v.number(),
                })
            ),
        }),
        messageAnalytics: v.object({
            totalMessages: v.number(),
            userMessages: v.number(),
            assistantMessages: v.number(),
            averageMessageLength: v.number(),
            longestMessage: v.number(),
            commandUsage: v.array(
                v.object({
                    command: v.string(),
                    count: v.number(),
                })
            ),
            modelUsage: v.array(
                v.object({
                    model: v.string(),
                    count: v.number(),
                    percentage: v.number(),
                })
            ),
            messageTrend: v.array(
                v.object({
                    period: v.string(),
                    userMessages: v.number(),
                    assistantMessages: v.number(),
                    timestamp: v.number(),
                })
            ),
            responseTimeAnalytics: v.object({
                averageResponseTime: v.number(),
                fastestResponse: v.number(),
                slowestResponse: v.number(),
            }),
            multiAIUsage: v.object({
                totalMultiAIMessages: v.number(),
                averageModelsPerMessage: v.number(),
                mostUsedCombination: v.array(v.string()),
            }),
        }),
        projectAnalytics: v.object({
            totalProjects: v.number(),
            nestedProjects: v.number(),
            averageChatsPerProject: v.number(),
            mostActiveProject: v.optional(
                v.object({
                    name: v.string(),
                    chatCount: v.number(),
                    messageCount: v.number(),
                })
            ),
            projectDistribution: v.array(
                v.object({
                    projectName: v.string(),
                    chatCount: v.number(),
                    messageCount: v.number(),
                })
            ),
        }),
        libraryAnalytics: v.object({
            attachments: v.object({
                total: v.number(),
                favorites: v.number(),
                totalSize: v.number(),
                byType: v.object({
                    image: v.number(),
                    pdf: v.number(),
                    file: v.number(),
                    audio: v.number(),
                    video: v.number(),
                }),
                mostUsed: v.array(
                    v.object({
                        name: v.string(),
                        usageCount: v.number(),
                    })
                ),
            }),
            artifacts: v.object({
                total: v.number(),
                favorites: v.number(),
                byLanguage: v.array(
                    v.object({
                        language: v.string(),
                        count: v.number(),
                    })
                ),
                mostReferenced: v.array(
                    v.object({
                        filename: v.string(),
                        referenceCount: v.number(),
                    })
                ),
            }),
            media: v.object({
                total: v.number(),
                favorites: v.number(),
                byType: v.object({
                    image: v.number(),
                    video: v.number(),
                    audio: v.number(),
                }),
                generatedContent: v.number(),
            }),
        }),
        collaborationAnalytics: v.object({
            sharedChats: v.number(),
            sharedProjects: v.number(),
            publicContent: v.number(),
            collaborativeChats: v.number(),
            totalViews: v.number(),
            averageViewsPerShare: v.number(),
        }),
        timeAnalytics: v.object({
            activityByHour: v.array(
                v.object({
                    hour: v.number(),
                    activity: v.number(),
                })
            ),
            activityByDay: v.array(
                v.object({
                    day: v.string(),
                    activity: v.number(),
                })
            ),
            peakActivityHour: v.number(),
            peakActivityDay: v.string(),
            totalActiveHours: v.number(),
        }),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("Authentication required");
        }

        const { start, end } = args.timeRange;

        // Get all user data within time range
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user_updated", (q) =>
                q
                    .eq("userId", userId)
                    .gte("updatedAt", start)
                    .lte("updatedAt", end)
            )
            .collect();

        const allChats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        const projects = await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Get messages for analytics
        const allMessages: any[] = [];
        for (const chat of allChats) {
            if (chat.activeBranchId) {
                const branchMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_branch_and_timestamp", (q) =>
                        q.eq("branchId", chat.activeBranchId!)
                    )
                    .collect();
                allMessages.push(...branchMessages);
            }
        }

        // Filter messages by time range
        const messages = allMessages.filter(
            (msg) => msg.timestamp >= start && msg.timestamp <= end
        );

        // Get library data
        const [attachments, artifacts, media] = await Promise.all([
            ctx.db
                .query("attachmentLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db
                .query("artifacts")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db
                .query("mediaLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
        ]);

        // Calculate overview metrics
        const overview = {
            totalChats: allChats.length,
            totalMessages: allMessages.length,
            totalProjects: projects.length,
            totalAttachments: attachments.length,
            totalArtifacts: artifacts.length,
            totalMedia: media.length,
            averageMessagesPerChat:
                allChats.length > 0
                    ? Math.round((allMessages.length / allChats.length) * 100) /
                      100
                    : 0,
            mostActiveDay: getMostActiveDay(messages),
            mostActiveHour: getMostActiveHour(messages),
        };

        // Calculate chat analytics
        const chatAnalytics = calculateChatAnalytics(
            chats,
            allChats,
            args.timeRange
        );

        // Calculate message analytics
        const messageAnalytics = calculateMessageAnalytics(
            messages,
            allMessages
        );

        // Calculate project analytics
        const projectAnalytics = calculateProjectAnalytics(
            projects,
            allChats,
            allMessages
        );

        // Calculate library analytics
        const libraryAnalytics = calculateLibraryAnalytics(
            attachments,
            artifacts,
            media
        );

        // Calculate collaboration analytics
        const collaborationAnalytics = calculateCollaborationAnalytics(
            allChats,
            projects
        );

        // Calculate time analytics
        const timeAnalytics = calculateTimeAnalytics(messages);

        return {
            overview,
            chatAnalytics,
            messageAnalytics,
            projectAnalytics,
            libraryAnalytics,
            collaborationAnalytics,
            timeAnalytics,
        };
    },
});

// Get quick overview stats for dashboard header
export const getAnalyticsOverview = query({
    args: {},
    returns: v.object({
        totalChats: v.number(),
        totalMessages: v.number(),
        totalProjects: v.number(),
        totalLibraryItems: v.number(),
        thisWeekChats: v.number(),
        thisWeekMessages: v.number(),
        mostUsedModel: v.string(),
        averageResponseTime: v.number(),
    }),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("Authentication required");
        }

        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        const [allChats, allProjects, attachments, artifacts, media] =
            await Promise.all([
                ctx.db
                    .query("chats")
                    .withIndex("by_user", (q) => q.eq("userId", userId))
                    .collect(),
                ctx.db
                    .query("projects")
                    .withIndex("by_user", (q) => q.eq("userId", userId))
                    .collect(),
                ctx.db
                    .query("attachmentLibrary")
                    .withIndex("by_user", (q) => q.eq("userId", userId))
                    .collect(),
                ctx.db
                    .query("artifacts")
                    .withIndex("by_user", (q) => q.eq("userId", userId))
                    .collect(),
                ctx.db
                    .query("mediaLibrary")
                    .withIndex("by_user", (q) => q.eq("userId", userId))
                    .collect(),
            ]);

        // Get all messages
        const allMessages = [];
        for (const chat of allChats) {
            if (chat.activeBranchId) {
                const branchMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_branch_and_timestamp", (q) =>
                        q.eq("branchId", chat.activeBranchId!)
                    )
                    .collect();
                allMessages.push(...branchMessages);
            }
        }

        const thisWeekChats = allChats.filter(
            (chat) => chat.createdAt >= oneWeekAgo
        ).length;
        const thisWeekMessages = allMessages.filter(
            (msg) => msg.timestamp >= oneWeekAgo
        ).length;

        // Calculate most used model
        const modelUsage = new Map<string, number>();
        allMessages.forEach((msg) => {
            if (msg.model) {
                modelUsage.set(msg.model, (modelUsage.get(msg.model) || 0) + 1);
            }
        });
        allChats.forEach((chat) => {
            modelUsage.set(chat.model, (modelUsage.get(chat.model) || 0) + 1);
        });

        const mostUsedModel =
            Array.from(modelUsage.entries()).sort(
                (a, b) => b[1] - a[1]
            )[0]?.[0] || "Unknown";

        // Calculate average response time (simplified)
        const responseTimes = [];
        for (let i = 0; i < allMessages.length - 1; i++) {
            const current = allMessages[i];
            const next = allMessages[i + 1];
            if (current.role === "user" && next.role === "assistant") {
                responseTimes.push(next.timestamp - current.timestamp);
            }
        }
        const averageResponseTime =
            responseTimes.length > 0
                ? responseTimes.reduce((a, b) => a + b, 0) /
                  responseTimes.length
                : 0;

        return {
            totalChats: allChats.length,
            totalMessages: allMessages.length,
            totalProjects: allProjects.length,
            totalLibraryItems:
                attachments.length + artifacts.length + media.length,
            thisWeekChats,
            thisWeekMessages,
            mostUsedModel,
            averageResponseTime: Math.round(averageResponseTime / 1000), // Convert to seconds
        };
    },
});

// Filtered analytics query for search and filtering
export const getFilteredAnalytics = query({
    args: {
        timeRange: v.object({
            start: v.number(),
            end: v.number(),
            granularity: v.union(
                v.literal("hour"),
                v.literal("day"),
                v.literal("week"),
                v.literal("month")
            ),
        }),
        filters: v.object({
            search: v.optional(v.string()),
            messageType: v.optional(v.array(v.string())),
            userGroups: v.optional(v.array(v.string())),
            models: v.optional(v.array(v.string())),
            projects: v.optional(v.array(v.string())),
            dateRange: v.optional(v.string()),
            minMessages: v.optional(v.number()),
            showDeleted: v.optional(v.boolean()),
            sortBy: v.optional(v.string()),
            sortOrder: v.optional(v.string()),
        }),
    },
    returns: v.object({
        overview: v.object({
            totalChats: v.number(),
            totalMessages: v.number(),
            totalProjects: v.number(),
            totalAttachments: v.number(),
            totalArtifacts: v.number(),
            totalMedia: v.number(),
            averageMessagesPerChat: v.number(),
            mostActiveDay: v.string(),
            mostActiveHour: v.number(),
        }),
        chatAnalytics: v.object({
            totalChats: v.number(),
            newChats: v.number(),
            temporaryChats: v.number(),
            forkedChats: v.number(),
            starredChats: v.number(),
            archivedChats: v.number(),
            passwordProtectedChats: v.number(),
            sharedChats: v.number(),
            averageChatLifespan: v.number(),
            chatsByModel: v.array(
                v.object({
                    model: v.string(),
                    count: v.number(),
                    percentage: v.number(),
                })
            ),
            chatCreationTrend: v.array(
                v.object({
                    period: v.string(),
                    count: v.number(),
                    timestamp: v.number(),
                })
            ),
            chatActivityHeatmap: v.array(
                v.object({
                    hour: v.number(),
                    day: v.number(),
                    activity: v.number(),
                })
            ),
        }),
        messageAnalytics: v.object({
            totalMessages: v.number(),
            userMessages: v.number(),
            assistantMessages: v.number(),
            averageMessageLength: v.number(),
            longestMessage: v.number(),
            commandUsage: v.array(
                v.object({
                    command: v.string(),
                    count: v.number(),
                })
            ),
            modelUsage: v.array(
                v.object({
                    model: v.string(),
                    count: v.number(),
                    percentage: v.number(),
                })
            ),
            messageTrend: v.array(
                v.object({
                    period: v.string(),
                    userMessages: v.number(),
                    assistantMessages: v.number(),
                    timestamp: v.number(),
                })
            ),
            responseTimeAnalytics: v.object({
                averageResponseTime: v.number(),
                fastestResponse: v.number(),
                slowestResponse: v.number(),
            }),
            multiAIUsage: v.object({
                totalMultiAIMessages: v.number(),
                averageModelsPerMessage: v.number(),
                mostUsedCombination: v.array(v.string()),
            }),
        }),
        projectAnalytics: v.object({
            totalProjects: v.number(),
            nestedProjects: v.number(),
            averageChatsPerProject: v.number(),
            mostActiveProject: v.optional(
                v.object({
                    name: v.string(),
                    chatCount: v.number(),
                    messageCount: v.number(),
                })
            ),
            projectDistribution: v.array(
                v.object({
                    projectName: v.string(),
                    chatCount: v.number(),
                    messageCount: v.number(),
                })
            ),
        }),
        libraryAnalytics: v.object({
            attachments: v.object({
                total: v.number(),
                favorites: v.number(),
                totalSize: v.number(),
                byType: v.object({
                    image: v.number(),
                    pdf: v.number(),
                    file: v.number(),
                    audio: v.number(),
                    video: v.number(),
                }),
                mostUsed: v.array(
                    v.object({
                        name: v.string(),
                        usageCount: v.number(),
                    })
                ),
            }),
            artifacts: v.object({
                total: v.number(),
                favorites: v.number(),
                byLanguage: v.array(
                    v.object({
                        language: v.string(),
                        count: v.number(),
                    })
                ),
                mostReferenced: v.array(
                    v.object({
                        filename: v.string(),
                        referenceCount: v.number(),
                    })
                ),
            }),
            media: v.object({
                total: v.number(),
                favorites: v.number(),
                byType: v.object({
                    image: v.number(),
                    video: v.number(),
                    audio: v.number(),
                }),
                generatedContent: v.number(),
            }),
        }),
        collaborationAnalytics: v.object({
            sharedChats: v.number(),
            sharedProjects: v.number(),
            publicContent: v.number(),
            collaborativeChats: v.number(),
            totalViews: v.number(),
            averageViewsPerShare: v.number(),
        }),
        timeAnalytics: v.object({
            activityByHour: v.array(
                v.object({
                    hour: v.number(),
                    activity: v.number(),
                })
            ),
            activityByDay: v.array(
                v.object({
                    day: v.string(),
                    activity: v.number(),
                })
            ),
            peakActivityHour: v.number(),
            peakActivityDay: v.string(),
            totalActiveHours: v.number(),
        }),
        availableOptions: v.object({
            messageTypes: v.array(v.string()),
            userGroups: v.array(v.string()),
            models: v.array(v.string()),
            projects: v.array(v.string()),
        }),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("Authentication required");
        }

        const { start, end } = args.timeRange;
        const { filters } = args;

        // Get all user data
        let chats = await ctx.db
            .query("chats")
            .withIndex("by_user_updated", (q) =>
                q
                    .eq("userId", userId)
                    .gte("updatedAt", start)
                    .lte("updatedAt", end)
            )
            .collect();

        const allChats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        const projects = await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Apply filters
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            chats = chats.filter(
                (chat) =>
                    chat.title?.toLowerCase().includes(searchTerm) ||
                    chat.model?.toLowerCase().includes(searchTerm)
            );
        }

        if (filters.models && filters.models.length > 0) {
            chats = chats.filter((chat) =>
                filters.models!.includes(chat.model)
            );
        }

        if (filters.projects && filters.projects.length > 0) {
            chats = chats.filter((chat) => {
                const project = projects.find((p) => p._id === chat.projectId);
                return project && filters.projects!.includes(project.name);
            });
        }

        if (filters.showDeleted === false) {
            // Note: isDeleted property may not exist on all chat objects
            // Filter out chats that have isDeleted: true, but keep chats without this property
            chats = chats.filter((chat) => !(chat as any).isDeleted);
        }

        if (filters.minMessages && filters.minMessages > 0) {
            // Filter chats based on message count
            const chatMessageCounts = new Map();
            for (const chat of chats) {
                if (chat.activeBranchId) {
                    const messageCount = await ctx.db
                        .query("messages")
                        .withIndex("by_branch_and_timestamp", (q) =>
                            q.eq("branchId", chat.activeBranchId!)
                        )
                        .collect()
                        .then((messages) => messages.length);
                    chatMessageCounts.set(chat._id, messageCount);
                }
            }
            chats = chats.filter(
                (chat) =>
                    (chatMessageCounts.get(chat._id) || 0) >=
                    filters.minMessages!
            );
        }

        // Apply sorting
        if (filters.sortBy) {
            chats.sort((a, b) => {
                let aValue: any, bValue: any;
                switch (filters.sortBy) {
                    case "date":
                        aValue = a.createdAt;
                        bValue = b.createdAt;
                        break;
                    case "activity":
                        aValue = a.updatedAt;
                        bValue = b.updatedAt;
                        break;
                    default:
                        aValue = a.createdAt;
                        bValue = b.createdAt;
                }

                const order = filters.sortOrder === "asc" ? 1 : -1;
                return (aValue > bValue ? 1 : -1) * order;
            });
        }

        // Get messages for filtered chats
        const allMessages = [];
        for (const chat of allChats) {
            if (chat.activeBranchId) {
                const branchMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_branch_and_timestamp", (q) =>
                        q.eq("branchId", chat.activeBranchId!)
                    )
                    .collect();
                allMessages.push(...branchMessages);
            }
        }

        // Filter messages by time range and type
        let messages = allMessages.filter(
            (msg) => msg.timestamp >= start && msg.timestamp <= end
        );

        if (filters.messageType && filters.messageType.length > 0) {
            messages = messages.filter((msg) =>
                filters.messageType!.includes(msg.role)
            );
        }

        // Get library data
        const [attachments, artifacts, media] = await Promise.all([
            ctx.db
                .query("attachmentLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db
                .query("artifacts")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
            ctx.db
                .query("mediaLibrary")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect(),
        ]);

        // Calculate overview metrics
        const overview = {
            totalChats: chats.length,
            totalMessages: messages.length,
            totalProjects: projects.length,
            totalAttachments: attachments.length,
            totalArtifacts: artifacts.length,
            totalMedia: media.length,
            averageMessagesPerChat:
                chats.length > 0
                    ? Math.round((messages.length / chats.length) * 100) / 100
                    : 0,
            mostActiveDay: getMostActiveDay(messages),
            mostActiveHour: getMostActiveHour(messages),
        };

        // Calculate analytics with filtered data
        const chatAnalytics = calculateChatAnalytics(
            chats,
            allChats,
            args.timeRange
        );
        const messageAnalytics = calculateMessageAnalytics(
            messages,
            allMessages
        );
        const projectAnalytics = calculateProjectAnalytics(
            projects,
            allChats,
            allMessages
        );
        const libraryAnalytics = calculateLibraryAnalytics(
            attachments,
            artifacts,
            media
        );
        const collaborationAnalytics = calculateCollaborationAnalytics(
            allChats,
            projects
        );
        const timeAnalytics = calculateTimeAnalytics(messages);

        // Generate available options for filters
        const availableOptions = {
            messageTypes: ["user", "assistant", "system"],
            userGroups: [], // TODO: Implement user groups if needed
            models: [
                ...new Set(allChats.map((chat) => chat.model).filter(Boolean)),
            ],
            projects: projects.map((p) => p.name),
        };

        return {
            overview,
            chatAnalytics,
            messageAnalytics,
            projectAnalytics,
            libraryAnalytics,
            collaborationAnalytics,
            timeAnalytics,
            availableOptions,
        };
    },
});

// Get analytics drilldown data for specific metrics
export const getAnalyticsDrilldown = query({
    args: {
        metric: v.string(),
        timeRange: v.object({
            start: v.number(),
            end: v.number(),
            granularity: v.union(
                v.literal("hour"),
                v.literal("day"),
                v.literal("week"),
                v.literal("month")
            ),
        }),
        filters: v.optional(
            v.object({
                search: v.optional(v.string()),
                messageType: v.optional(v.array(v.string())),
                models: v.optional(v.array(v.string())),
                projects: v.optional(v.array(v.string())),
            })
        ),
    },
    returns: v.object({
        metric: v.string(),
        data: v.any(),
        summary: v.object({
            total: v.number(),
            average: v.number(),
            trend: v.string(),
            change: v.number(),
        }),
        breakdown: v.array(
            v.object({
                label: v.string(),
                value: v.number(),
                percentage: v.number(),
            })
        ),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("Authentication required");
        }

        const { start, end } = args.timeRange;
        const { metric, filters } = args;

        // Get base data
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user_updated", (q) =>
                q
                    .eq("userId", userId)
                    .gte("updatedAt", start)
                    .lte("updatedAt", end)
            )
            .collect();

        const allMessages = [];
        for (const chat of chats) {
            if (chat.activeBranchId) {
                const branchMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_branch_and_timestamp", (q) =>
                        q.eq("branchId", chat.activeBranchId!)
                    )
                    .collect();
                allMessages.push(...branchMessages);
            }
        }

        const messages = allMessages.filter(
            (msg) => msg.timestamp >= start && msg.timestamp <= end
        );

        // Calculate drilldown data based on metric
        let data: any = {};
        const summary = {
            total: 0,
            average: 0,
            trend: "neutral" as const,
            change: 0,
        };
        let breakdown: any[] = [];

        switch (metric) {
            case "message_activity":
                const hourlyActivity = new Array(24).fill(0);
                messages.forEach((msg) => {
                    const hour = new Date(msg.timestamp).getHours();
                    hourlyActivity[hour]++;
                });
                data = hourlyActivity.map((count, hour) => ({ hour, count }));
                summary.total = messages.length;
                summary.average = Math.round(messages.length / 24);
                breakdown = hourlyActivity
                    .map((count, hour) => ({
                        label: `${hour}:00`,
                        value: count,
                        percentage: Math.round((count / messages.length) * 100),
                    }))
                    .filter((item) => item.value > 0);
                break;

            case "model_usage":
                const modelCounts = new Map<string, number>();
                messages.forEach((msg) => {
                    if (msg.model) {
                        modelCounts.set(
                            msg.model,
                            (modelCounts.get(msg.model) || 0) + 1
                        );
                    }
                });
                data = Array.from(modelCounts.entries()).map(
                    ([model, count]) => ({ model, count })
                );
                summary.total = messages.length;
                breakdown = Array.from(modelCounts.entries()).map(
                    ([model, count]) => ({
                        label: model,
                        value: count,
                        percentage: Math.round((count / messages.length) * 100),
                    })
                );
                break;

            case "chat_creation":
                const dailyCreation = new Map<string, number>();
                chats.forEach((chat) => {
                    const date = new Date(chat.createdAt).toDateString();
                    dailyCreation.set(date, (dailyCreation.get(date) || 0) + 1);
                });
                data = Array.from(dailyCreation.entries()).map(
                    ([date, count]) => ({ date, count })
                );
                summary.total = chats.length;
                summary.average = Math.round(chats.length / dailyCreation.size);
                breakdown = Array.from(dailyCreation.entries()).map(
                    ([date, count]) => ({
                        label: date,
                        value: count,
                        percentage: Math.round((count / chats.length) * 100),
                    })
                );
                break;

            default:
                // Default case for unknown metrics
                data = { error: `Unknown metric: ${metric}` };
        }

        return {
            metric,
            data,
            summary,
            breakdown,
        };
    },
});

// Helper functions for analytics calculations

function getMostActiveDay(messages: any[]): string {
    const dayActivity = new Map<string, number>();
    const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    messages.forEach((msg) => {
        const day = days[new Date(msg.timestamp).getDay()];
        dayActivity.set(day, (dayActivity.get(day) || 0) + 1);
    });

    return (
        Array.from(dayActivity.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "Monday"
    );
}

function getMostActiveHour(messages: any[]): number {
    const hourActivity = new Map<number, number>();

    messages.forEach((msg) => {
        const hour = new Date(msg.timestamp).getHours();
        hourActivity.set(hour, (hourActivity.get(hour) || 0) + 1);
    });

    return (
        Array.from(hourActivity.entries()).sort(
            (a, b) => b[1] - a[1]
        )[0]?.[0] || 14
    );
}

function calculateChatAnalytics(chats: any[], allChats: any[], timeRange: any) {
    const chatsByModel = new Map<string, number>();
    const chatCreationTrend: Array<{ period: string; count: number; timestamp: number }> = [];
    const chatActivityHeatmap: Array<{ hour: number; day: number; activity: number }> = [];

    // Calculate model distribution
    allChats.forEach((chat) => {
        chatsByModel.set(chat.model, (chatsByModel.get(chat.model) || 0) + 1);
    });

    const modelArray = Array.from(chatsByModel.entries())
        .map(([model, count]) => ({
            model,
            count,
            percentage: Math.round((count / allChats.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

    // Calculate creation trend
    const periods = generatePeriods(
        timeRange.start,
        timeRange.end,
        timeRange.granularity
    );
    periods.forEach((period) => {
        const count = chats.filter(
            (chat) =>
                chat.createdAt >= period.start && chat.createdAt < period.end
        ).length;
        chatCreationTrend.push({
            period: period.label,
            count,
            timestamp: period.start,
        });
    });

    // Calculate activity heatmap (24x7 grid)
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const activity = chats.filter((chat) => {
                const date = new Date(chat.updatedAt);
                return date.getDay() === day && date.getHours() === hour;
            }).length;
            chatActivityHeatmap.push({ hour, day, activity });
        }
    }

    return {
        totalChats: allChats.length,
        newChats: chats.length,
        temporaryChats: allChats.filter((c) => c.isTemporary).length,
        forkedChats: allChats.filter((c) => c.parentChatId).length,
        starredChats: allChats.filter((c) => c.isStarred).length,
        archivedChats: allChats.filter((c) => c.isArchived).length,
        passwordProtectedChats: allChats.filter((c) => c.isPasswordProtected)
            .length,
        sharedChats: allChats.filter((c) => c.isPublic).length,
        averageChatLifespan: calculateAverageChatLifespan(allChats),
        chatsByModel: modelArray,
        chatCreationTrend,
        chatActivityHeatmap,
    };
}

function calculateMessageAnalytics(messages: any[], allMessages: any[]) {
    const commandUsage = new Map<string, number>();
    const modelUsage = new Map<string, number>();
    const responseTimes: number[] = [];

    // Process all messages for statistics
    allMessages.forEach((msg, index) => {
        // Count commands
        if (msg.commands && msg.commands.length > 0) {
            msg.commands.forEach((cmd: string) => {
                commandUsage.set(cmd, (commandUsage.get(cmd) || 0) + 1);
            });
        }

        // Count model usage
        if (msg.model) {
            modelUsage.set(msg.model, (modelUsage.get(msg.model) || 0) + 1);
        }

        // Calculate response times
        if (
            index > 0 &&
            msg.role === "assistant" &&
            allMessages[index - 1].role === "user"
        ) {
            responseTimes.push(
                msg.timestamp - allMessages[index - 1].timestamp
            );
        }
    });

    const userMessages = allMessages.filter((m) => m.role === "user");
    const assistantMessages = allMessages.filter((m) => m.role === "assistant");
    const totalLength = allMessages.reduce(
        (sum, msg) => sum + msg.content.length,
        0
    );

    const multiAIMessages = allMessages.filter(
        (m) => m.metadata?.multiAIResponses
    );
    const averageModelsPerMessage =
        multiAIMessages.length > 0
            ? multiAIMessages.reduce(
                  (sum, msg) =>
                      sum +
                      (msg.metadata?.multiAIResponses?.selectedModels?.length ||
                          0),
                  0
              ) / multiAIMessages.length
            : 0;

    return {
        totalMessages: allMessages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        averageMessageLength: Math.round(totalLength / allMessages.length) || 0,
        longestMessage: Math.max(
            ...allMessages.map((m) => m.content.length),
            0
        ),
        commandUsage: Array.from(commandUsage.entries()).map(
            ([command, count]) => ({ command, count })
        ),
        modelUsage: Array.from(modelUsage.entries())
            .map(([model, count]) => ({
                model,
                count,
                percentage: Math.round((count / allMessages.length) * 100),
            }))
            .sort((a, b) => b.count - a.count),
        messageTrend: [], // TODO: Implement trend calculation
        responseTimeAnalytics: {
            averageResponseTime:
                responseTimes.length > 0
                    ? Math.round(
                          responseTimes.reduce((a, b) => a + b, 0) /
                              responseTimes.length /
                              1000
                      )
                    : 0,
            fastestResponse:
                responseTimes.length > 0
                    ? Math.round(Math.min(...responseTimes) / 1000)
                    : 0,
            slowestResponse:
                responseTimes.length > 0
                    ? Math.round(Math.max(...responseTimes) / 1000)
                    : 0,
        },
        multiAIUsage: {
            totalMultiAIMessages: multiAIMessages.length,
            averageModelsPerMessage:
                Math.round(averageModelsPerMessage * 100) / 100,
            mostUsedCombination: [], // TODO: Calculate most used model combinations
        },
    };
}

function calculateProjectAnalytics(
    projects: any[],
    allChats: any[],
    allMessages: any[]
) {
    const projectStats = projects.map((project) => {
        const projectChats = allChats.filter(
            (c) => c.projectId === project._id
        );
        const projectMessages = projectChats.reduce((count, chat) => {
            return (
                count +
                allMessages.filter((m) => {
                    // Check if message belongs to this chat's active branch
                    return allChats.some(
                        (c) =>
                            c._id === chat._id &&
                            c.activeBranchId &&
                            allMessages.some(
                                (msg) => msg.branchId === c.activeBranchId
                            )
                    );
                }).length
            );
        }, 0);

        return {
            projectName: project.name,
            chatCount: projectChats.length,
            messageCount: projectMessages,
        };
    });

    const mostActive = projectStats.sort(
        (a, b) => b.messageCount - a.messageCount
    )[0];

    return {
        totalProjects: projects.length,
        nestedProjects: projects.filter((p) => p.parentId).length,
        averageChatsPerProject:
            projects.length > 0
                ? Math.round(
                      (allChats.filter((c) => c.projectId).length /
                          projects.length) *
                          100
                  ) / 100
                : 0,
        mostActiveProject: mostActive
            ? {
                  name: mostActive.projectName,
                  chatCount: mostActive.chatCount,
                  messageCount: mostActive.messageCount,
              }
            : undefined,
        projectDistribution: projectStats,
    };
}

function calculateLibraryAnalytics(
    attachments: any[],
    artifacts: any[],
    media: any[]
) {
    return {
        attachments: {
            total: attachments.length,
            favorites: attachments.filter((a) => a.isFavorited).length,
            totalSize: attachments.reduce((sum, a) => sum + a.size, 0),
            byType: {
                image: attachments.filter((a) => a.type === "image").length,
                pdf: attachments.filter((a) => a.type === "pdf").length,
                file: attachments.filter((a) => a.type === "file").length,
                audio: attachments.filter((a) => a.type === "audio").length,
                video: attachments.filter((a) => a.type === "video").length,
            },
            mostUsed: attachments
                .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
                .slice(0, 5)
                .map((a) => ({
                    name: a.originalName,
                    usageCount: a.usageCount || 0,
                })),
        },
        artifacts: {
            total: artifacts.length,
            favorites: artifacts.filter((a) => a.isFavorited).length,
            byLanguage: getLanguageDistribution(artifacts),
            mostReferenced: artifacts
                .sort(
                    (a, b) => (b.referenceCount || 0) - (a.referenceCount || 0)
                )
                .slice(0, 5)
                .map((a) => ({
                    filename: a.filename,
                    referenceCount: a.referenceCount || 0,
                })),
        },
        media: {
            total: media.length,
            favorites: media.filter((m) => m.isFavorited).length,
            byType: {
                image: media.filter((m) => m.type === "image").length,
                video: media.filter((m) => m.type === "video").length,
                audio: media.filter((m) => m.type === "audio").length,
            },
            generatedContent: media.filter((m) => m.sourceMessageId).length,
        },
    };
}

function calculateCollaborationAnalytics(allChats: any[], projects: any[]) {
    const sharedChats = allChats.filter((c) => c.isPublic).length;
    const sharedProjects = projects.filter((p) => p.isPublic).length;
    const collaborativeChats = allChats.filter(
        (c) => c.shareMode === "collaboration"
    ).length;
    const totalViews =
        allChats.reduce((sum, c) => sum + (c.viewCount || 0), 0) +
        projects.reduce((sum, p) => sum + (p.viewCount || 0), 0);

    return {
        sharedChats,
        sharedProjects,
        publicContent: sharedChats + sharedProjects,
        collaborativeChats,
        totalViews,
        averageViewsPerShare:
            sharedChats + sharedProjects > 0
                ? Math.round(
                      (totalViews / (sharedChats + sharedProjects)) * 100
                  ) / 100
                : 0,
    };
}

function calculateTimeAnalytics(messages: any[]) {
    const activityByHour = new Array(24)
        .fill(0)
        .map((_, hour) => ({ hour, activity: 0 }));
    const activityByDay = new Map<string, number>();
    const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    messages.forEach((msg) => {
        const date = new Date(msg.timestamp);
        const hour = date.getHours();
        const day = days[date.getDay()];

        activityByHour[hour].activity++;
        activityByDay.set(day, (activityByDay.get(day) || 0) + 1);
    });

    const peakHour = activityByHour.reduce(
        (max, curr) => (curr.activity > max.activity ? curr : max),
        activityByHour[0]
    );
    const peakDay = Array.from(activityByDay.entries()).reduce(
        (max, curr) => (curr[1] > max[1] ? curr : max),
        ["Monday", 0]
    );

    return {
        activityByHour,
        activityByDay: Array.from(activityByDay.entries()).map(
            ([day, activity]) => ({ day, activity })
        ),
        peakActivityHour: peakHour.hour,
        peakActivityDay: peakDay[0],
        totalActiveHours: activityByHour.filter((h) => h.activity > 0).length,
    };
}

function calculateAverageChatLifespan(chats: any[]): number {
    const lifespans = chats
        .filter((c) => c.updatedAt && c.createdAt)
        .map((c) => c.updatedAt - c.createdAt);

    if (lifespans.length === 0) return 0;

    const avgMilliseconds =
        lifespans.reduce((sum, lifespan) => sum + lifespan, 0) /
        lifespans.length;
    return Math.round(avgMilliseconds / (1000 * 60 * 60 * 24)); // Convert to days
}

function getLanguageDistribution(artifacts: any[]) {
    const languages = new Map<string, number>();
    artifacts.forEach((artifact) => {
        const lang = artifact.language || "unknown";
        languages.set(lang, (languages.get(lang) || 0) + 1);
    });

    return Array.from(languages.entries()).map(([language, count]) => ({
        language,
        count,
    }));
}

function generatePeriods(start: number, end: number, granularity: string) {
    const periods = [];
    const duration = end - start;

    let interval: number;
    switch (granularity) {
        case "hour":
            interval = 60 * 60 * 1000;
            break;
        case "day":
            interval = 24 * 60 * 60 * 1000;
            break;
        case "week":
            interval = 7 * 24 * 60 * 60 * 1000;
            break;
        case "month":
            interval = 30 * 24 * 60 * 60 * 1000;
            break;
        default:
            interval = 24 * 60 * 60 * 1000;
    }

    for (let current = start; current < end; current += interval) {
        const periodEnd = Math.min(current + interval, end);
        periods.push({
            start: current,
            end: periodEnd,
            label: formatPeriodLabel(current, granularity),
        });
    }

    return periods;
}

function formatPeriodLabel(timestamp: number, granularity: string): string {
    const date = new Date(timestamp);

    switch (granularity) {
        case "hour":
            return date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        case "day":
            return date.toLocaleDateString([], {
                month: "short",
                day: "numeric",
            });
        case "week":
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return `Week of ${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })}`;
        case "month":
            return date.toLocaleDateString([], {
                year: "numeric",
                month: "short",
            });
        default:
            return date.toLocaleDateString();
    }
}
