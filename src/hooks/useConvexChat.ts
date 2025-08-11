import { useChat } from "ai/react";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// =============================================================================
// AI SDK MIGRATION - PHASE 4: Frontend Hook Migration
// =============================================================================

/**
 * Custom hook that integrates AI SDK's useChat with Convex backend
 * Replaces existing manual streaming logic with AI SDK SSE endpoints
 */
export function useConvexChat(chatId: Id<"chats">) {
    // Get existing chat messages for initialization
    const existingMessages = useQuery(api.chats.getChatMessages, { chatId });

    // Convert stored messages to AI SDK UIMessage format
    const initialMessages = useMemo(() => {
        if (!existingMessages) return [];

        return existingMessages.map((msg) => ({
            id: msg._id,
            role: msg.role,
            content: msg.renderedText || msg.content,
            createdAt: new Date(msg.timestamp),
        }));
    }, [existingMessages]);

    // AI SDK useChat hook with our Convex SSE endpoints
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit: originalHandleSubmit,
        append,
        reload,
        stop,
        isLoading,
        error,
        setMessages,
    } = useChat({
        api: "/api/chat", // Our Convex SSE endpoint
        initialMessages,
        body: {
            chatId,
        },
        onFinish: async (message) => {
            console.log("✅ AI SDK Message finished:", message);
            // Message is already persisted by SSE endpoint onFinish callback
        },
        onError: (error) => {
            console.error("❌ AI SDK Chat error:", error);
        },
    });

    // Custom submit handler that includes chat context
    const handleSubmit = useCallback(
        (
            e?: React.FormEvent<HTMLFormElement>,
            options?: {
                model?: string;
                commands?: string[];
                attachments?: Array<{
                    type: string;
                    storageId: string;
                    name: string;
                    size: number;
                }>;
                referencedLibraryItems?: Array<{
                    type: "attachment" | "artifact" | "media";
                    id: string;
                    name: string;
                    description?: string;
                    size?: number;
                    mimeType?: string;
                }>;
            }
        ) => {
            const {
                model = "gemini-2.0-flash",
                commands = [],
                attachments = [],
                referencedLibraryItems = [],
            } = options || {};

            // Enhance the request body with additional context
            return originalHandleSubmit(e, {
                body: {
                    chatId,
                    model,
                    commands,
                    attachments,
                    referencedLibraryItems,
                },
            });
        },
        [originalHandleSubmit, chatId]
    );

    // Send message programmatically (replaces old sendMessage action)
    const sendMessage = useCallback(
        async (
            content: string,
            options?: {
                model?: string;
                commands?: string[];
                attachments?: Array<{
                    type: string;
                    storageId: string;
                    name: string;
                    size: number;
                }>;
                referencedLibraryItems?: Array<{
                    type: "attachment" | "artifact" | "media";
                    id: string;
                    name: string;
                    description?: string;
                    size?: number;
                    mimeType?: string;
                }>;
            }
        ) => {
            const {
                model = "gemini-2.0-flash",
                commands = [],
                attachments = [],
                referencedLibraryItems = [],
            } = options || {};

            return append(
                {
                    role: "user",
                    content,
                },
                {
                    body: {
                        chatId,
                        model,
                        commands,
                        attachments,
                        referencedLibraryItems,
                    },
                }
            );
        },
        [append, chatId]
    );

    return {
        // AI SDK state
        messages,
        input,
        handleInputChange,
        handleSubmit,
        sendMessage,
        append,
        reload,
        stop,
        isLoading,
        error,
        setMessages,

        // Convex integration helpers
        chatId,
        existingMessages,
    };
}

/**
 * Multi-AI chat hook for parallel model responses
 * Uses /api/multi-chat endpoint for multiple model streaming
 */
export function useMultiAIChat(chatId: Id<"chats">) {
    const existingMessages = useQuery(api.chats.getChatMessages, { chatId });

    const initialMessages = useMemo(() => {
        if (!existingMessages) return [];

        return existingMessages.map((msg) => ({
            id: msg._id,
            role: msg.role,
            content: msg.renderedText || msg.content,
            createdAt: new Date(msg.timestamp),
        }));
    }, [existingMessages]);

    const {
        messages,
        input,
        handleInputChange,
        append,
        isLoading,
        error,
        setMessages,
    } = useChat({
        api: "/api/multi-chat", // Multi-model SSE endpoint
        initialMessages,
        body: {
            chatId,
        },
        onFinish: async (message) => {
            console.log("✅ Multi-AI Message finished:", message);
        },
        onError: (error) => {
            console.error("❌ Multi-AI Chat error:", error);
        },
    });

    // Send message to multiple models
    const sendMultiAIMessage = useCallback(
        async (
            content: string,
            models: string[] = ["gemini-2.0-flash", "gpt-4o"],
            options?: {
                commands?: string[];
                attachments?: Array<{
                    type: string;
                    storageId: string;
                    name: string;
                    size: number;
                }>;
                referencedLibraryItems?: Array<{
                    type: "attachment" | "artifact" | "media";
                    id: string;
                    name: string;
                    description?: string;
                    size?: number;
                    mimeType?: string;
                }>;
            }
        ) => {
            if (models.length < 2) {
                throw new Error("Multi-AI requires at least 2 models");
            }

            const {
                commands = [],
                attachments = [],
                referencedLibraryItems = [],
            } = options || {};

            return append(
                {
                    role: "user",
                    content,
                },
                {
                    body: {
                        chatId,
                        models,
                        commands,
                        attachments,
                        referencedLibraryItems,
                    },
                }
            );
        },
        [append, chatId]
    );

    return {
        messages,
        input,
        handleInputChange,
        sendMultiAIMessage,
        isLoading,
        error,
        setMessages,
        chatId,
        existingMessages,
    };
}
