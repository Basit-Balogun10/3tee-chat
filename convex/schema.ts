import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
    // Extended users table with shared content arrays
    users: defineTable({
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        emailVerificationTime: v.optional(v.number()),
        image: v.optional(v.string()),
        phone: v.optional(v.string()),
        phoneVerificationTime: v.optional(v.number()),
        isAnonymous: v.optional(v.boolean()),
        // Shared content arrays for collaboration
        sharedChats: v.optional(v.array(v.id("chats"))),
        sharedProjects: v.optional(v.array(v.id("projects"))),
    }),

    chats: defineTable({
        userId: v.id("users"),
        title: v.string(),
        model: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
        isStarred: v.optional(v.boolean()),
        isArchived: v.optional(v.boolean()),
        // Forking support (existing)
        parentChatId: v.optional(v.id("chats")),
        branchPoint: v.optional(v.id("messages")),
        // Project organization
        projectId: v.optional(v.id("projects")),
        // Sharing support
        shareId: v.optional(v.string()),
        isPublic: v.optional(v.boolean()),
        shareMode: v.optional(
            v.union(v.literal("read-only"), v.literal("collaboration"))
        ),
        sharedAt: v.optional(v.number()),
        viewCount: v.optional(v.number()),
    })
        .index("by_user", ["userId"])
        .index("by_user_and_starred", ["userId", "isStarred"])
        .index("by_user_and_archived", ["userId", "isArchived"])
        .index("by_user_updated", ["userId", "updatedAt"])
        .index("by_project", ["projectId"])
        .index("by_share_id", ["shareId"])
        .index("by_public", ["isPublic"]),

    projects: defineTable({
        userId: v.id("users"),
        name: v.string(),
        description: v.optional(v.string()),
        color: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
        isArchived: v.optional(v.boolean()),
        // Nesting support (folders)
        parentId: v.optional(v.id("projects")),
        path: v.optional(v.string()),
        isDefault: v.optional(v.boolean()),
        // Sharing support
        shareId: v.optional(v.string()),
        isPublic: v.optional(v.boolean()),
        shareMode: v.optional(
            v.union(v.literal("read-only"), v.literal("collaboration"))
        ),
        sharedAt: v.optional(v.number()),
        viewCount: v.optional(v.number()),
        // Forking support
        parentProjectId: v.optional(v.id("projects")),
        forkedAt: v.optional(v.number()),
    })
        .index("by_user", ["userId"])
        .index("by_parent", ["parentId"])
        .index("by_user_and_parent", ["userId", "parentId"])
        .index("by_share_id", ["shareId"])
        .index("by_public", ["isPublic"])
        .index("by_default", ["isDefault"]),

    messages: defineTable({
        chatId: v.id("chats"),
        role: v.union(
            v.literal("user"),
            v.literal("assistant"),
            v.literal("system")
        ),
        content: v.string(),
        timestamp: v.number(),
        model: v.optional(v.string()),
        isStreaming: v.optional(v.boolean()),
        parentMessageId: v.optional(v.id("messages")),
        branchId: v.optional(v.string()),
        editHistory: v.optional(
            v.array(
                v.object({
                    content: v.string(),
                    timestamp: v.number(),
                })
            )
        ),
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
        // Canvas/Artifact support
        artifacts: v.optional(
            v.array(
                v.object({
                    id: v.string(),
                    filename: v.string(),
                    language: v.string(), // markdown, javascript, typescript, python, html, css, etc.
                    content: v.string(),
                    description: v.optional(v.string()),
                    createdAt: v.number(),
                    updatedAt: v.number(),
                })
            )
        ),
        referencedArtifacts: v.optional(v.array(v.string())), // Array of artifact IDs referenced in this message
        metadata: v.optional(
            v.object({
                // Updated citation schema - removed searchResults and added citations
                citations: v.optional(
                    v.array(
                        v.object({
                            number: v.number(),
                            title: v.string(),
                            url: v.string(),
                            source: v.string(),
                            startIndex: v.optional(v.number()),
                            endIndex: v.optional(v.number()),
                            citedText: v.optional(v.string()),
                        })
                    )
                ),
                imagePrompt: v.optional(v.string()),
                generatedImageUrl: v.optional(v.string()),
                videoPrompt: v.optional(v.string()),
                generatedVideoUrl: v.optional(v.string()),
                videoThumbnailUrl: v.optional(v.string()),
                videoDuration: v.optional(v.string()),
                videoResolution: v.optional(v.string()),
                audioTranscription: v.optional(v.string()),
                // Enhanced for canvas responses
                structuredOutput: v.optional(v.boolean()), // Indicates if this was a canvas/structured response
                canvasIntro: v.optional(v.string()), // Intro text before artifacts
                canvasSummary: v.optional(v.string()), // Summary text after artifacts
            })
        ),
        // Simple collaboration tracking - just track who contributed
        contributorId: v.optional(v.id("users")),
        // Resumable streams support
        streamSession: v.optional(
            v.object({
                sessionId: v.string(),
                isComplete: v.boolean(),
                lastChunkIndex: v.optional(v.number()),
                resumeToken: v.optional(v.string()),
            })
        ),
    })
        .index("by_chat", ["chatId"])
        .index("by_chat_and_timestamp", ["chatId", "timestamp"])
        .index("by_parent", ["parentMessageId"])
        .index("by_contributor", ["contributorId"])
        .index("by_stream_session", ["streamSession.sessionId"]),

    preferences: defineTable({
        userId: v.id("users"),
        defaultModel: v.optional(v.string()),
        theme: v.optional(
            v.union(v.literal("light"), v.literal("dark"), v.literal("system"))
        ),
        localFirst: v.optional(v.boolean()),
        apiKeys: v.optional(
            v.object({
                openai: v.optional(v.string()),
                anthropic: v.optional(v.string()),
                gemini: v.optional(v.string()),
                deepseek: v.optional(v.string()),
                openrouter: v.optional(v.string()),
            })
        ),
        apiKeyPreferences: v.optional(
            v.object({
                openai: v.optional(v.boolean()),
                anthropic: v.optional(v.boolean()),
                gemini: v.optional(v.boolean()),
                deepseek: v.optional(v.boolean()),
                openrouter: v.optional(v.boolean()),
            })
        ),
        voiceSettings: v.optional(
            v.object({
                autoPlay: v.boolean(),
                voice: v.string(),
                speed: v.number(),
                buzzWord: v.optional(v.string()),
            })
        ),
    }).index("by_user", ["userId"]),

    anonymousUsage: defineTable({
        sessionId: v.string(),
        messageCount: v.number(),
        lastUsed: v.number(),
    }).index("by_session", ["sessionId"]),

    authVerificationCodes: defineTable({
        email: v.string(),
        code: v.string(),
        expiresAt: v.number(),
        createdAt: v.number(),
        verified: v.optional(v.boolean()),
    }).index("by_email", ["email"]),

    streamingSessions: defineTable({
        messageId: v.id("messages"),
        userId: v.id("users"),
        isStopped: v.boolean(),
        createdAt: v.number(),
        // Enhanced for resumable streams
        sessionId: v.string(),
        provider: v.string(), // google, openai, anthropic, deepseek, openrouter
        modelId: v.string(),
        isComplete: v.optional(v.boolean()),
        lastChunkIndex: v.optional(v.number()),
        resumeToken: v.optional(v.string()),
        errorCount: v.optional(v.number()),
        lastResumedAt: v.optional(v.number()),
    })
        .index("by_message", ["messageId"])
        .index("by_user", ["userId"])
        .index("by_session", ["sessionId"])
        .index("by_user_active", ["userId", "isComplete"]),

    // New table for canvas artifacts (separate from messages for better querying)
    artifacts: defineTable({
        messageId: v.id("messages"),
        chatId: v.id("chats"),
        userId: v.id("users"),
        artifactId: v.string(), // Unique ID for referencing
        filename: v.string(),
        language: v.string(),
        content: v.string(),
        originalContent: v.string(), // Original AI-generated content
        description: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
        editCount: v.optional(v.number()),
        isPreviewable: v.optional(v.boolean()), // Can be previewed (HTML/JS/React/Markdown)
    })
        .index("by_message", ["messageId"])
        .index("by_chat", ["chatId"])
        .index("by_user", ["userId"])
        .index("by_artifact_id", ["artifactId"])
        .index("by_chat_created", ["chatId", "createdAt"]),

    // Local storage backup for local-first users
    localBackups: defineTable({
        userId: v.id("users"),
        backupType: v.union(
            v.literal("chats"),
            v.literal("preferences"),
            v.literal("artifacts")
        ),
        data: v.string(), // JSON stringified data
        createdAt: v.number(),
        isRestored: v.optional(v.boolean()),
    })
        .index("by_user", ["userId"])
        .index("by_user_type", ["userId", "backupType"])
        .index("by_user_created", ["userId", "createdAt"]),
};

export default defineSchema({
    ...authTables,
    ...applicationTables,
});
