import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAuthToken } from "@convex-dev/auth/react";

type ConvexMessage = {
    _id: Id<"messages">;
    role: "user" | "assistant" | "system";
    content: string;
    renderedText?: string;
    timestamp: number;
    model?: string;
    isStreaming?: boolean;
    metadata?: unknown;
    attachments?: Array<{
        type: string;
        storageId: Id<"_storage">;
        name: string;
        size: number;
    }>;
    isTransient?: boolean;
};

type AttachmentInput = {
    type: string;
    storageId: string;
    name: string;
    size: number;
};

type ReferencedItemInput = {
    type: "attachment" | "artifact" | "media";
    id: string;
    name: string;
    description?: string;
    size?: number;
    mimeType?: string;
};

type SendMessageOptions = {
    model?: string;
    commands?: string[];
    attachments?: AttachmentInput[];
    referencedLibraryItems?: ReferencedItemInput[];
};

const getTextFromUIMessage = (message: UIMessage): string =>
    message.parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("");

const normalizePath = (path: string): string =>
    path.startsWith("/") ? path : `/${path}`;

const resolveConvexActionsBaseUrl = (): string => {
    const envValue = import.meta.env.VITE_CONVEX_ACTIONS_URL;

    if (typeof envValue === "string") {
        const trimmed = envValue.trim();
        if (trimmed.length > 0) {
            return trimmed.replace(/\/+$/, "");
        }
    }

    if (typeof window !== "undefined" && window.location) {
        return window.location.origin.replace(/\/+$/, "");
    }

    return "";
};

const buildConvexActionUrl = (path: string): string => {
    const normalizedPath = normalizePath(path);
    const baseUrl = resolveConvexActionsBaseUrl();

    if (!baseUrl) return normalizedPath;

    return `${baseUrl}${normalizedPath}`;
};

const createConvexChatTransport = (
    path: string,
    authToken?: string | null
): DefaultChatTransport =>
    new DefaultChatTransport({
        api: buildConvexActionUrl(path),
        credentials: "include",
        headers:
            authToken && authToken.length > 0
                ? () => ({ Authorization: `Bearer ${authToken}` })
                : undefined,
    });

const isUiMessageStreaming = (message: UIMessage): boolean =>
    message.parts.some(
        (part) => part.type === "text" && part.state === "streaming"
    );

const convertConvexToUIMessage = (message: ConvexMessage): UIMessage => ({
    id: String(message._id),
    role: message.role,
    metadata: message.metadata,
    parts: [
        {
            type: "text",
            text: message.renderedText ?? message.content ?? "",
            state: message.isStreaming ? "streaming" : "done",
        },
    ],
});

const areUiMessageListsEqual = (a: UIMessage[], b: UIMessage[]): boolean => {
    if (a.length !== b.length) return false;

    for (let index = 0; index < a.length; index += 1) {
        const first = a[index];
        const second = b[index];

        if (first.id !== second.id || first.role !== second.role) return false;
        if (getTextFromUIMessage(first) !== getTextFromUIMessage(second))
            return false;
    }

    return true;
};

const createSyntheticMessage = (message: UIMessage): ConvexMessage => {
    const text = getTextFromUIMessage(message);

    return {
        _id: message.id as unknown as Id<"messages">,
        role: message.role,
        content: text,
        renderedText: text,
        timestamp: Date.now(),
        isStreaming: isUiMessageStreaming(message),
        metadata: message.metadata,
        isTransient: true,
    };
};

const mergeMessages = (
    persisted: ConvexMessage[] | undefined,
    uiMessages: UIMessage[]
): ConvexMessage[] => {
    const base = persisted
        ? persisted.map((message) => ({ ...message, isTransient: false }))
        : [];
    const persistedIds = new Set(base.map((message) => String(message._id)));

    const merged = base.map((message) => {
        const uiMatch = uiMessages.find(
            (uiMessage) => String(uiMessage.id) === String(message._id)
        );

        if (!uiMatch) return message;

        const text = getTextFromUIMessage(uiMatch);

        return {
            ...message,
            content: text || message.content,
            renderedText: text || message.renderedText,
            isStreaming: isUiMessageStreaming(uiMatch),
            metadata:
                uiMatch.metadata !== undefined
                    ? uiMatch.metadata
                    : message.metadata,
            isTransient: false,
        };
    });

    uiMessages.forEach((uiMessage) => {
        const messageId = String(uiMessage.id);
        if (persistedIds.has(messageId)) return;

        merged.push(createSyntheticMessage(uiMessage));
    });

    merged.sort((a, b) => a.timestamp - b.timestamp);

    return merged;
};

export function useConvexChat(chatId: Id<"chats">) {
    const [input, setInput] = useState("");
    const authToken = useAuthToken();

    const existingMessages = useQuery(api.chats.getChatMessages, {
        chatId,
    }) as ConvexMessage[] | undefined;

    const chatTransport = useMemo(
        () => createConvexChatTransport("/api/chat", authToken),
        [authToken]
    );

    const {
        messages: uiMessages,
        sendMessage: chatSendMessage,
        stop,
        error,
        status,
        setMessages,
    } = useChat({
        transport: chatTransport,
        onFinish: async (message) => {
            console.log("✅ AI SDK Message finished:", message);
        },
        onError: (err) => {
            console.error("❌ AI SDK Chat error here:", err);
        },
    });

    useEffect(() => {
        if (!existingMessages) return;

        const formatted = existingMessages.map(convertConvexToUIMessage);
        setMessages((current) =>
            areUiMessageListsEqual(current, formatted) ? current : formatted
        );
    }, [existingMessages, setMessages]);

    const combinedMessages = useMemo(
        () => mergeMessages(existingMessages, uiMessages),
        [existingMessages, uiMessages]
    );

    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setInput(event.target.value);
        },
        []
    );

    const sendMessage = useCallback(
        async (content: string, options?: SendMessageOptions) => {
            const trimmed = content.trim();
            if (!trimmed) return;

            const {
                model = "gemini-2.0-flash",
                commands = [],
                attachments = [],
                referencedLibraryItems = [],
            } = options || {};

            await chatSendMessage(
                { text: trimmed },
                {
                    headers:
                        authToken && authToken.length > 0
                            ? { Authorization: `Bearer ${authToken}` }
                            : undefined,
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
        [chatSendMessage, chatId, authToken]
    );

    const handleSubmit = useCallback(
        async (
            event?: FormEvent<HTMLFormElement>,
            options?: SendMessageOptions
        ) => {
            event?.preventDefault();
            if (!input.trim()) return;

            await sendMessage(input, options);
            setInput("");
        },
        [input, sendMessage]
    );

    const isLoading = status === "submitted" || status === "streaming";

    return {
        messages: combinedMessages,
        transportMessages: uiMessages,
        input,
        handleInputChange,
        handleSubmit,
        sendMessage,
        stop,
        isLoading,
        error,
        existingMessages,
    };
}

/**
 * Multi-AI chat hook for parallel model responses
 * Uses /api/multi-chat endpoint for multiple model streaming
 */
export function useMultiAIChat(chatId: Id<"chats">) {
    const existingMessages = useQuery(api.chats.getChatMessages, {
        chatId,
    }) as ConvexMessage[] | undefined;
    const authToken = useAuthToken();

    const multiChatTransport = useMemo(
        () => createConvexChatTransport("/api/multi-chat", authToken),
        [authToken]
    );

    const {
        messages: uiMessages,
        sendMessage: chatSendMessage,
        stop,
        error,
        status,
        setMessages,
    } = useChat({
        transport: multiChatTransport,
        onFinish: async (message) => {
            console.log("✅ Multi-AI Message finished:", message);
        },
        onError: (err) => {
            console.error("❌ Multi-AI Chat error:", err);
        },
    });

    useEffect(() => {
        if (!existingMessages) return;

        const formatted = existingMessages.map(convertConvexToUIMessage);
        setMessages((current) =>
            areUiMessageListsEqual(current, formatted) ? current : formatted
        );
    }, [existingMessages, setMessages]);

    const combinedMessages = useMemo(
        () => mergeMessages(existingMessages, uiMessages),
        [existingMessages, uiMessages]
    );

    const sendMultiAIMessage = useCallback(
        async (
            content: string,
            models: string[] = ["gemini-2.0-flash", "gpt-4o"],
            options?: {
                commands?: string[];
                attachments?: AttachmentInput[];
                referencedLibraryItems?: ReferencedItemInput[];
            }
        ) => {
            const trimmed = content.trim();
            if (!trimmed) return;

            if (!models || models.length < 2) {
                throw new Error("Multi-AI requires at least 2 models");
            }

            const {
                commands = [],
                attachments = [],
                referencedLibraryItems = [],
            } = options || {};

            await chatSendMessage(
                { text: trimmed },
                {
                    headers:
                        authToken && authToken.length > 0
                            ? { Authorization: `Bearer ${authToken}` }
                            : undefined,
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
        [chatSendMessage, chatId, authToken]
    );

    const isLoading = status === "submitted" || status === "streaming";

    return {
        messages: combinedMessages,
        transportMessages: uiMessages,
        sendMultiAIMessage,
        isLoading,
        error,
        stop,
        existingMessages,
    };
}
