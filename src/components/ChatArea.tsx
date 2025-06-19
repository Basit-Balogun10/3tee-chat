import {
    Dispatch,
    SetStateAction,
    useState,
    useRef,
    useEffect,
    useMemo,
    useCallback,
} from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { toast } from "sonner";

interface ChatAreaProps {
    chatId: Id<"chats">;
    setSelectedChatId: Dispatch<SetStateAction<Id<"chats"> | null>>;
    showMessageInput?: boolean;
}

// Define commands in a single place to be shared
const AICommands = [
    { command: "/image", label: "Image" },
    { command: "/video", label: "Video" },
    { command: "/search", label: "Search" },
    { command: "/canvas", label: "Canvas" },
];

export function ChatArea({
    chatId,
    setSelectedChatId,
    showMessageInput = true,
}: ChatAreaProps) {
    const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini"); // Default fallback
    const [messageInput, setMessageInput] = useState("");
    const [activeCommands, setActiveCommands] = useState<string[]>([]);
    const [hoveredMessageId, setHoveredMessageId] =
        useState<Id<"messages"> | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const chat = useQuery(api.chats.getChat, { chatId });
    const messagesResult = useQuery(api.chats.getChatMessages, { chatId });
    const messages = useMemo(() => messagesResult || [], [messagesResult]);
    const sendMessage = useAction(api.messages.sendMessage);
    const editMessage = useMutation(api.messages.updateMessage);
    const branchFromMessage = useMutation(api.messages.branchFromMessage);
    const retryMessage = useAction(api.ai.retryMessage);
    const updateChatModel = useMutation(api.chats.updateChatModel);
    const deleteMessage = useMutation(api.messages.deleteMessage);

    // Check if any message is currently streaming (for UI purposes)
    const isStreaming = messages.some((message) => message.isStreaming);
    const streamingMessage = messages.find((message) => message.isStreaming);

    // Initialize selectedModel from chat's model field when chat loads
    useEffect(() => {
        if (chat?.model) {
            setSelectedModel(chat.model);
        }
    }, [chat?.model]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle model change and persist to chat
    const handleModelChange = useCallback(
        async (newModel: string) => {
            setSelectedModel(newModel);

            // Update the chat's model field in the backend
            try {
                await updateChatModel({
                    chatId,
                    model: newModel,
                });
            } catch (error) {
                console.error("Failed to update chat model:", error);
                // Don't show toast for this as it's not critical to user experience
            }
        },
        [chatId, updateChatModel]
    );

    const handleSendMessage = useCallback(
        async (
            content: string,
            attachments?: any[],
            referencedArtifacts?: string[]
        ) => {
            if (
                !content.trim() &&
                (!attachments || attachments.length === 0) &&
                activeCommands.length === 0 &&
                (!referencedArtifacts || referencedArtifacts.length === 0)
            )
                return;

            try {
                setIsLoading(true);
                await sendMessage({
                    chatId,
                    content: content.trim(),
                    commands: activeCommands,
                    model: selectedModel,
                    attachments,
                    referencedArtifacts,
                });
                // Clear input and commands after sending
                setMessageInput("");
                setActiveCommands([]);
            } catch (error) {
                console.error("Failed to send message:", error);
                toast.error("Failed to send message");
            } finally {
                setIsLoading(false);
            }
        },
        [chatId, selectedModel, activeCommands, sendMessage]
    );

    const handlePrefill = (promptText: string) => {
        let remainingText = promptText;
        const commandsToActivate: string[] = [];

        AICommands.forEach((cmd) => {
            if (remainingText.includes(cmd.command)) {
                commandsToActivate.push(cmd.command);
                remainingText = remainingText.replace(cmd.command, "").trim();
            }
        });

        setActiveCommands(commandsToActivate);
        setMessageInput(remainingText);
    };

    const handleEditMessage = useCallback(
        async (messageId: Id<"messages">, newContent: string) => {
            try {
                await editMessage({
                    messageId,
                    content: newContent,
                    isStreaming: false,
                });
                toast.success("Message edited successfully");
            } catch (error) {
                console.error("Failed to edit message:", error);
                toast.error("Failed to edit message");
            }
        },
        [editMessage]
    );

    const handleBranchFromMessage = useCallback(
        async (messageId: Id<"messages">, newContent: string) => {
            try {
                await branchFromMessage({
                    messageId,
                    newContent,
                });

                // Generate AI response for the new branch
                await sendMessage({
                    chatId,
                    content: newContent,
                    model: selectedModel,
                });

                toast.success("Created new conversation branch");
            } catch (error) {
                console.error("Failed to create branch:", error);
                toast.error("Failed to create branch");
            }
        },
        [branchFromMessage, sendMessage, chatId, selectedModel]
    );

    const handleRetryMessage = useCallback(
        async (messageId: Id<"messages">) => {
            try {
                await retryMessage({
                    messageId,
                    model: selectedModel,
                });
                toast.success("Retrying message...");
            } catch (error) {
                console.error("Failed to retry message:", error);
                toast.error("Failed to retry message");
            }
        },
        [retryMessage, selectedModel]
    );

    // Simple stop streaming function that marks streaming as complete
    const handleStopStreaming = useCallback(async () => {
        if (streamingMessage) {
            try {
                // Use the new resumable streaming action to mark as complete
                const markComplete = await import("convex/react").then(m => m.useAction);
                const markStreamingComplete = markComplete(api.ai.markStreamingComplete);
                await markStreamingComplete({ messageId: streamingMessage._id });
                toast.success("Streaming stopped");
            } catch (error) {
                console.error("Failed to stop streaming:", error);
                toast.error("Failed to stop streaming");
            }
        }
    }, [streamingMessage]);

    const handleDeleteMessage = useCallback(
        async (messageId: Id<"messages">) => {
            try {
                await deleteMessage({ messageId });
                toast.success("Message deleted");
            } catch (error) {
                console.error("Failed to delete message:", error);
                toast.error("Failed to delete message");
            }
        },
        [deleteMessage]
    );

    // Message-level keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in input/textarea
            const isTyping =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement)?.isContentEditable;

            if (isTyping) return;

            const hasModifier = e.metaKey || e.ctrlKey;

            // Branch navigation shortcuts (Left/Right arrows) - no modifiers needed
            if (!hasModifier && !e.shiftKey && !e.altKey) {
                switch (e.key) {
                    case "ArrowLeft":
                        // Navigate to previous branch
                        if (hoveredMessageId) {
                            e.preventDefault();
                            const branchEvent = new CustomEvent(
                                "navigateBranch",
                                {
                                    detail: {
                                        messageId: hoveredMessageId,
                                        direction: "previous",
                                    },
                                }
                            );
                            document.dispatchEvent(branchEvent);
                        }
                        return;

                    case "ArrowRight":
                        // Navigate to next branch
                        if (hoveredMessageId) {
                            e.preventDefault();
                            const branchEvent = new CustomEvent(
                                "navigateBranch",
                                {
                                    detail: {
                                        messageId: hoveredMessageId,
                                        direction: "next",
                                    },
                                }
                            );
                            document.dispatchEvent(branchEvent);
                        }
                        return;
                }
            }

            // Message actions when hovering over a message
            if (hoveredMessageId) {
                const hoveredMessage = messages.find(
                    (m) => m._id === hoveredMessageId
                );

                if (!hasModifier) {
                    switch (e.key) {
                        case "c":
                        case "C":
                            // Copy message content
                            e.preventDefault();
                            if (hoveredMessage) {
                                void navigator.clipboard.writeText(
                                    hoveredMessage.content
                                );
                                toast.success("Message copied to clipboard");
                            }
                            return;

                        case "e":
                        case "E":
                            // Edit message (user messages only)
                            e.preventDefault();
                            if (hoveredMessage?.role === "user") {
                                // Trigger edit mode for the message
                                const editEvent = new CustomEvent(
                                    "editMessage",
                                    {
                                        detail: {
                                            messageId: hoveredMessageId,
                                            content: hoveredMessage.content,
                                        },
                                    }
                                );
                                document.dispatchEvent(editEvent);
                            }
                            return;

                        case "f":
                        case "F":
                            // Fork conversation from message (AI messages only)
                            e.preventDefault();
                            if (hoveredMessage?.role === "assistant") {
                                // Dispatch event to MessageList to handle fork
                                const forkEvent = new CustomEvent(
                                    "forkFromMessage",
                                    {
                                        detail: { messageId: hoveredMessageId },
                                    }
                                );
                                document.dispatchEvent(forkEvent);
                            }
                            return;

                        case "r":
                        case "R":
                            // Retry AI response (AI messages only)
                            e.preventDefault();
                            if (hoveredMessage?.role === "assistant") {
                                const retryEvent = new CustomEvent(
                                    "retryMessage",
                                    {
                                        detail: { messageId: hoveredMessageId },
                                    }
                                );
                                document.dispatchEvent(retryEvent);
                            }
                            return;

                        case "Delete":
                        case "Backspace":
                            // Delete message (user messages only)
                            e.preventDefault();
                            if (hoveredMessage?.role === "user") {
                                if (
                                    confirm(
                                        "Are you sure you want to delete this message?"
                                    )
                                ) {
                                    void handleDeleteMessage(hoveredMessageId);
                                }
                            }
                            return;
                    }
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [hoveredMessageId, messages, handleDeleteMessage]);

    // Listen for edit message events from keyboard shortcuts
    useEffect(() => {
        const handleEditMessage = (e: CustomEvent) => {
            const { messageId, content } = e.detail;
            // Find the message and trigger edit mode
            const message = messages.find((m) => m._id === messageId);
            if (message && message.role === "user") {
                // Dispatch event to MessageList to start editing
                const startEditEvent = new CustomEvent("startMessageEdit", {
                    detail: { messageId, content },
                });
                document.dispatchEvent(startEditEvent);
            }
        };

        const handleStartEditingMessage = (e: CustomEvent) => {
            const { messageId, content } = e.detail;
            // Find the message and trigger edit mode
            const message = messages.find((m) => m._id === messageId);
            if (message && message.role === "user") {
                // Dispatch event to MessageList to start editing
                const startEditEvent = new CustomEvent("startMessageEdit", {
                    detail: { messageId, content },
                });
                document.dispatchEvent(startEditEvent);
            }
        };

        document.addEventListener(
            "editMessage",
            handleEditMessage as EventListener
        );
        document.addEventListener(
            "startEditingMessage",
            handleStartEditingMessage as EventListener
        );
        return () => {
            document.removeEventListener(
                "editMessage",
                handleEditMessage as EventListener
            );
            document.removeEventListener(
                "startEditingMessage",
                handleStartEditingMessage as EventListener
            );
        };
    }, [messages]);

    return (
        <div className="flex flex-col w-4/5 mx-auto h-full">
            {/* Header section with sliding animation */}
            <div className="flex-1 flex flex-col">
                <MessageList
                    messages={messages}
                    onEditMessage={(messageId, newContent) =>
                        void handleEditMessage(messageId, newContent)
                    }
                    onRetryMessage={(messageId) =>
                        void handleRetryMessage(messageId)
                    }
                    onBranchFromMessage={(messageId, newContent) =>
                        void handleBranchFromMessage(messageId, newContent)
                    }
                    onPrefill={handlePrefill}
                    onMessageHover={setHoveredMessageId}
                    setSelectedChatId={setSelectedChatId}
                />
            </div>

            <div
                className={`transition-all duration-300 ease-in-out ${showMessageInput ? "transform translate-y-0 opacity-100" : "transform translate-y-full opacity-0 pointer-events-none"}`}
            >
                <MessageInput
                    message={messageInput}
                    onMessageChange={setMessageInput}
                    activeCommands={activeCommands}
                    onCommandsChange={setActiveCommands}
                    onSendMessage={(content, attachments, referencedArtifacts) =>
                        void handleSendMessage(content, attachments, referencedArtifacts)
                    }
                    isStreaming={isStreaming}
                    onStopStreaming={handleStopStreaming}
                    selectedModel={selectedModel}
                    onModelChange={(model) => void handleModelChange(model)}
                    showMessageInput={showMessageInput}
                    chatId={chatId}
                />
            </div>
        </div>
    );
}
