import { useChat, HttpChatTransport } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// =============================================================================
// AI SDK MIGRATION - PHASE 4: Frontend Hook Migration - Transport Pattern
// =============================================================================

/**
 * Custom hook that integrates AI SDK's useChat with Convex backend
 * Uses HttpChatTransport instead of deprecated append/body patterns
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

    // Create transport for Convex SSE endpoints
    const transport = useMemo(() => {
        return new HttpChatTransport({
            url: "/api/chat",
            headers: {
                "Content-Type": "application/json",
            },
        });
    }, []);

    // AI SDK useChat hook with transport pattern
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit: originalHandleSubmit,
        reload,
        stop,
        isLoading,
        error,
        setMessages,
    } = useChat({
        transport,
        initialMessages,
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

            // Use transport to send request with context
            return originalHandleSubmit(e, {
                data: {
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

    // Send message programmatically using transport
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

            // Use transport for programmatic message sending
            return transport.send({
                messages: [...messages, { role: "user", content }],
                data: {
                    chatId,
                    model,
                    commands,
                    attachments,
                    referencedLibraryItems,
                },
            });
        },
        [transport, messages, chatId]
    );

    return {
        // AI SDK state
        messages,
        input,
        handleInputChange,
        handleSubmit,
        sendMessage,
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
 * Uses /api/multi-chat endpoint with HttpChatTransport
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

    // Create transport for multi-chat endpoint
    const transport = useMemo(() => {
        return new HttpChatTransport({
            url: "/api/multi-chat",
            headers: {
                "Content-Type": "application/json",
            },
        });
    }, []);

    const {
        messages,
        input,
        handleInputChange,
        isLoading,
        error,
        setMessages,
    } = useChat({
        transport,
        initialMessages,
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

            return transport.send({
                messages: [...messages, { role: "user", content }],
                data: {
                    chatId,
                    models,
                    commands,
                    attachments,
                    referencedLibraryItems,
                },
            });
        },
        [transport, messages, chatId]
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
