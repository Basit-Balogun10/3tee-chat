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
    }).index("email", ["email"]),

    chats: defineTable({
        userId: v.id("users"),
        title: v.string(),
        model: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
        isStarred: v.optional(v.boolean()),
        isArchived: v.optional(v.boolean()),
        archivedAt: v.optional(v.number()), // When the chat was archived
        // Temporary chat support - Phase 2
        isTemporary: v.optional(v.boolean()), // Whether this is a temporary chat
        temporaryUntil: v.optional(v.number()), // Timestamp when this temporary chat expires
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

        // Per-chat AI settings - Phase 4
        aiSettings: v.optional(
            v.object({
                temperature: v.optional(v.number()),
                maxTokens: v.optional(v.number()),
                systemPrompt: v.optional(v.string()),
                responseMode: v.optional(
                    v.union(
                        v.literal("balanced"),
                        v.literal("concise"),
                        v.literal("detailed"),
                        v.literal("creative"),
                        v.literal("analytical"),
                        v.literal("friendly"),
                        v.literal("professional")
                    )
                ),
                promptEnhancement: v.optional(v.boolean()),
                topP: v.optional(v.number()),
                frequencyPenalty: v.optional(v.number()),
                presencePenalty: v.optional(v.number()),
            })
        ),

        // Password Protection - Phase 6
        isPasswordProtected: v.optional(v.boolean()), // Whether chat requires password
        passwordHash: v.optional(v.string()), // Hashed password using bcrypt
        passwordSalt: v.optional(v.string()), // Salt for password hashing
        passwordHint: v.optional(v.string()), // Optional hint for password
        lastPasswordVerified: v.optional(v.number()), // Last time password was verified (session tracking)

        // NEW BRANCHING SYSTEM FIELDS - Phase 1
        activeBranchId: v.optional(v.id("branches")), // Current active branch
        baseMessages: v.optional(v.array(v.id("messages"))), // Shared conversation history
        activeMessages: v.optional(v.array(v.id("messages"))), // Computed: baseMessages + activeBranch.messages
    })
        .index("by_user", ["userId"])
        .index("by_user_and_starred", ["userId", "isStarred"])
        .index("by_user_and_archived", ["userId", "isArchived"])
        .index("by_user_updated", ["userId", "updatedAt"])
        .index("by_project", ["projectId"])
        .index("by_share_id", ["shareId"])
        .index("by_public", ["isPublic"])
        .index("by_active_branch", ["activeBranchId"]), // New index for efficient branch queries

    // NEW BRANCHES TABLE - Phase 1
    branches: defineTable({
        chatId: v.id("chats"), // Parent chat this branch belongs to
        fromMessageId: v.optional(v.id("messages")), // Message this branch was created from (null for main branch)
        messages: v.array(v.id("messages")), // Array of message IDs in this branch
        isMain: v.boolean(), // True for the main/default branch
        createdAt: v.number(),
        updatedAt: v.number(),
        // Branch metadata
        branchName: v.optional(v.string()), // Optional custom name for branch
        description: v.optional(v.string()), // Optional description of what this branch explores
    })
        .index("by_chat", ["chatId"])
        .index("by_chat_main", ["chatId", "isMain"]) // Efficient lookup for main branch
        .index("by_from_message", ["fromMessageId"])
        .index("by_chat_created", ["chatId", "createdAt"]),

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
        // Messages now belong to branches, not directly to chats
        branchId: v.id("branches"), // Required field - messages belong to branches
        role: v.union(
            v.literal("user"),
            v.literal("assistant"),
            v.literal("system")
        ),
        content: v.string(),
        timestamp: v.number(),
        model: v.optional(v.string()),
        isStreaming: v.optional(v.boolean()),
        // Simple resumable streaming support
        streamPosition: v.optional(v.number()), // Total characters streamed by backend
        parentMessageId: v.optional(v.id("messages")),

        // NEW BRANCHING SYSTEM FIELDS - Phase 1
        branches: v.optional(v.array(v.id("branches"))), // Array of branch IDs this message appears in
        activeBranchId: v.optional(v.id("branches")), // Current active branch for this message

        // MESSAGE VERSIONING SYSTEM (for retries)
        // Multiple AI response versions for the same message
        messageVersions: v.optional(
            v.array(
                v.object({
                    versionId: v.string(),
                    content: v.string(),
                    model: v.optional(v.string()),
                    timestamp: v.number(),
                    isActive: v.boolean(),
                    metadata: v.optional(v.any()),
                })
            )
        ),

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
        // Canvas/Artifact support - REMOVED top-level artifacts field
        // Use referencedArtifacts for IDs, and artifacts will be populated automatically via queries
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
                // Simplified: just store artifact IDs like sharedChats pattern
                artifacts: v.optional(v.array(v.id("artifacts"))), // Array of artifact IDs
                // Structured output schema and data
                structuredData: v.optional(v.any()), // The actual parsed structured output
                schema: v.optional(v.any()), // The JSON schema used for structured output
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
        .index("by_branch", ["branchId"]) // Primary index for branch-based queries
        .index("by_branch_and_timestamp", ["branchId", "timestamp"]) // Efficient branch message ordering
        .index("by_parent", ["parentMessageId"])
        .index("by_contributor", ["contributorId"])
        .index("by_stream_session", ["streamSession.sessionId"])
        .index("by_active_branch", ["activeBranchId"]), // Index for branch navigation

    preferences: defineTable({
        userId: v.id("users"),
        defaultModel: v.optional(v.string()),
        theme: v.optional(
            v.union(v.literal("light"), v.literal("dark"), v.literal("system"))
        ),
        localFirst: v.optional(v.boolean()),
        // Chat title generation preference
        chatTitleGeneration: v.optional(
            v.union(
                v.literal("first-message"), // Use first message content as title (default)
                v.literal("ai-generated") // Let AI generate appropriate title
            )
        ),
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
                language: v.optional(v.string()),
            })
        ),
        customShortcuts: v.optional(
            v.object({
                // General
                showShortcuts: v.optional(v.string()),
                openSettings: v.optional(v.string()),

                // Chat Management
                newChat: v.optional(v.string()),
                newTemporaryChat: v.optional(v.string()), // Phase 2: New temporary chat shortcut
                toggleSidebar: v.optional(v.string()),
                toggleRightSidebar: v.optional(v.string()),
                toggleProjectView: v.optional(v.string()),
                focusSearch: v.optional(v.string()),
                renameChat: v.optional(v.string()),
                starChat: v.optional(v.string()),
                deleteChat: v.optional(v.string()),

                // Navigation
                navigateChats: v.optional(v.string()),
                focusInput: v.optional(v.string()),

                // Message Input
                navigateHistory: v.optional(v.string()),
                sendMessage: v.optional(v.string()),
                clearInput: v.optional(v.string()),
                openModelSelector: v.optional(v.string()),
                voiceRecording: v.optional(v.string()),
                openLiveChatModal: v.optional(v.string()),

                // Sharing
                shareChat: v.optional(v.string()),
                shareCollaboration: v.optional(v.string()),
                exportMarkdown: v.optional(v.string()),
                exportJson: v.optional(v.string()),

                // Theme & UI
                toggleTheme: v.optional(v.string()),
                toggleMessageInput: v.optional(v.string()),
                toggleHeader: v.optional(v.string()),
                toggleZenMode: v.optional(v.string()),

                // Message Actions (When Hovering)
                navigateVersionsBranches: v.optional(v.string()),
                collapseMessage: v.optional(v.string()),
                expandMessage: v.optional(v.string()),
                scrollToMessageEnd: v.optional(v.string()),
                copyMessage: v.optional(v.string()),
                editMessage: v.optional(v.string()),
                retryMessage: v.optional(v.string()),
                retryDifferentModel: v.optional(v.string()),
                deleteMessage: v.optional(v.string()),
                forkConversation: v.optional(v.string()),
                copyDirectMessageLink: v.optional(v.string()),
                createSharedMessageLink: v.optional(v.string()),

                // Phase 3 & 4 shortcuts
                advancedSearch: v.optional(v.string()),
                enhancePrompt: v.optional(v.string()),
                openChatAISettings: v.optional(v.string()),

                // Phase 2 notification shortcuts
                toggleNotifications: v.optional(v.string()),
                adjustNotificationVolume: v.optional(v.string()),
            })
        ),
        // Temporary chat settings - Phase 2
        temporaryChatsSettings: v.optional(
            v.object({
                defaultToTemporary: v.optional(v.boolean()), // Whether new chats are temporary by default
                defaultLifespanHours: v.optional(v.number()), // Default lifespan in hours (24 default)
                showExpirationWarnings: v.optional(v.boolean()), // Show warnings before expiration
                autoCleanup: v.optional(v.boolean()), // Auto-delete expired temporary chats
            })
        ),
        // Chat lifecycle management settings - Phase 2
        chatLifecycleSettings: v.optional(
            v.object({
                autoDeleteEnabled: v.optional(v.boolean()), // Enable auto-deletion of regular chats
                autoDeleteDays: v.optional(v.number()), // Days before auto-deletion (default 30)
                autoArchiveEnabled: v.optional(v.boolean()), // Enable auto-archiving of regular chats
                autoArchiveDays: v.optional(v.number()), // Days before auto-archiving (default 30)
            })
        ),
        // Notification settings - Phase 2
        notificationSettings: v.optional(
            v.object({
                soundEnabled: v.optional(v.boolean()), // Enable sound notifications
                soundOnlyWhenUnfocused: v.optional(v.boolean()), // Only play sound when tab is not focused
                soundVolume: v.optional(v.number()), // Sound volume (0.0 to 1.0)
                soundType: v.optional(v.string()), // Sound type/file to play
            })
        ),
        // AI Settings - Phase 4: Advanced AI configuration
        aiSettings: v.optional(
            v.object({
                temperature: v.optional(v.number()), // 0.0 to 2.0
                maxTokens: v.optional(v.number()), // Max response length
                systemPrompt: v.optional(v.string()), // Custom system prompt
                responseMode: v.optional(
                    v.union(
                        v.literal("balanced"),
                        v.literal("concise"),
                        v.literal("detailed"),
                        v.literal("creative"),
                        v.literal("analytical"),
                        v.literal("friendly"),
                        v.literal("professional")
                    )
                ), // Response style mode
                promptEnhancement: v.optional(v.boolean()), // 1-click prompt enhancement
                contextWindow: v.optional(v.number()), // Context window size
                topP: v.optional(v.number()), // Nucleus sampling (0.0 to 1.0)
                frequencyPenalty: v.optional(v.number()), // Frequency penalty (0.0 to 2.0)
                presencePenalty: v.optional(v.number()), // Presence penalty (0.0 to 2.0)
            })
        ),

        // Password Protection Settings - Phase 6
        passwordSettings: v.optional(
            v.object({
                defaultPasswordHash: v.optional(v.string()), // Encrypted default password
                defaultPasswordSalt: v.optional(v.string()), // Salt for default password
                useDefaultPassword: v.optional(v.boolean()), // Whether to use default password for new protected chats
                autoLockTimeout: v.optional(v.number()), // Minutes before requiring password re-entry (0 = never timeout, default 30)
                sessionTimeoutEnabled: v.optional(v.boolean()), // Whether to enable session timeout (default true)
            })
        ),
    }).index("by_user", ["userId"]),

    anonymousUsage: defineTable({
        sessionId: v.string(),
        messageCount: v.number(),
        lastUsed: v.number(),
    }).index("by_session", ["sessionId"]),

    // Enhanced artifacts table with provider file tracking
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

        // Provider file tracking - for efficient re-use across conversations
        providerFiles: v.optional(
            v.object({
                openai: v.optional(
                    v.object({
                        fileId: v.string(),
                        uploadedAt: v.number(),
                        lastUsedAt: v.number(),
                        expiresAt: v.optional(v.number()),
                    })
                ),
                anthropic: v.optional(
                    v.object({
                        fileId: v.string(),
                        uploadedAt: v.number(),
                        lastUsedAt: v.number(),
                        expiresAt: v.optional(v.number()),
                    })
                ),
                gemini: v.optional(
                    v.object({
                        fileId: v.string(),
                        uploadedAt: v.number(),
                        lastUsedAt: v.number(),
                        expiresAt: v.optional(v.number()),
                    })
                ),
                deepseek: v.optional(
                    v.object({
                        fileId: v.string(),
                        uploadedAt: v.number(),
                        lastUsedAt: v.number(),
                        expiresAt: v.optional(v.number()),
                    })
                ),
            })
        ),

        // File metadata for upload optimization
        fileSize: v.optional(v.number()),
        mimeType: v.optional(v.string()),

        // Usage tracking for caching decisions
        usageCount: v.optional(v.number()),
        lastReferencedAt: v.optional(v.number()),
    })
        .index("by_message", ["messageId"])
        .index("by_chat", ["chatId"])
        .index("by_user", ["userId"])
        .index("by_artifact_id", ["artifactId"])
        .index("by_chat_created", ["chatId", "createdAt"])
        .index("by_usage", ["usageCount"])
        .index("by_last_referenced", ["lastReferencedAt"]),

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
