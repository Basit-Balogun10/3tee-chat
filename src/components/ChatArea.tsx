import {
    Dispatch,
    SetStateAction,
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PasswordGateway } from "./PasswordGateway";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { toast } from "sonner";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";
import { useNotificationSounds } from "../lib/utils";
// AI SDK MIGRATION - Import new hooks
import { useConvexChat, useMultiAIChat } from "../hooks/useConvexChat";

interface ChatAreaProps {
    chatId: Id<"chats">;
    setSelectedChatId: Dispatch<SetStateAction<Id<"chats"> | null>>;
    showMessageInput?: boolean;
    sidebarOpen: boolean;
    scrollToBottom: () => void;
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
    sidebarOpen,
    scrollToBottom,
}: ChatAreaProps) {
    // AI SDK MIGRATION - New hooks replacing all manual streaming
    const {
        messages: aiMessages,
        sendMessage: sendAiMessage,
        isLoading: aiIsLoading,
        stop: stopAiStreaming,
    } = useConvexChat(chatId);

    const {
        sendMultiAIMessage: sendMultiAiMessage,
        isLoading: multiAiIsLoading,
    } = useMultiAIChat(chatId);

    // State
    const [selectedModel, setSelectedModel] =
        useState<string>("gemini-2.0-flash");
    const [messageInput, setMessageInput] = useState("");
    const [activeCommands, setActiveCommands] = useState<string[]>([]);
    const [hoveredMessageId, setHoveredMessageId] =
        useState<Id<"messages"> | null>(null);
    const [editingMessage, setEditingMessage] = useState<{
        messageId: Id<"messages">;
        originalContent: string;
        originalCommands: string[];
        originalReferencedItems: Array<{
            type: "attachment" | "artifact" | "media";
            id: string;
            name: string;
            description?: string;
            size?: number;
            mimeType?: string;
        }>;
    } | null>(null);
    // Add Multi-AI mode state
    const [isMultiAIMode, setIsMultiAIMode] = useState(false);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);

    // Queries and mutations (only needed for non-messaging operations)
    const chat = useQuery(api.chats.getChat, { chatId });
    const updateChatModel = useMutation(api.chats.updateChatModel);
    const deleteMessage = useMutation(api.messages.deleteMessage);
    const switchMessageVersion = useMutation(api.messages.switchMessageVersion);

    // Branching system mutations
    const createBranchFromMessageEdit = useMutation(
        api.branches.createBranchFromMessageEdit
    );
    const navigateToBranch = useMutation(api.branches.navigateToBranch);

    // Use AI SDK messages
    const messages = aiMessages;

    // Computed values
    const streamingMessage = messages.find((message) => message.isStreaming);
    const hoveredMessage = hoveredMessageId
        ? messages.find((m) => m._id === hoveredMessageId)
        : null;

    // Initialize selectedModel from chat's model field when chat loads
    useEffect(() => {
        if (chat?.model) {
            setSelectedModel(chat.model);
        }
    }, [chat?.model]);

    // Handle model change and persist to chat
    const handleModelChange = useCallback(
        async (newModel: string) => {
            setSelectedModel(newModel);
            try {
                await updateChatModel({ chatId, model: newModel });
            } catch (error) {
                console.error("Failed to update chat model:", error);
            }
        },
        [chatId, updateChatModel]
    );

    // AI SDK enhanced send message handler
    const handleSendMessage = useCallback(
        async (
            content: string,
            attachments?: Array<{
                type: string;
                storageId: string;
                name: string;
                size: number;
            }>,
            referencedLibraryItems?: Array<{
                type: "attachment" | "artifact" | "media";
                id: string;
                name: string;
                description?: string;
                size?: number;
                mimeType?: string;
            }>
        ) => {
            if (aiIsLoading) return;

            if (
                !content.trim() &&
                (!attachments || attachments.length === 0) &&
                (!referencedLibraryItems ||
                    referencedLibraryItems.length === 0) &&
                activeCommands.length === 0
            )
                return;

            try {
                // Use AI SDK streaming with all original parameters
                await sendAiMessage(content.trim(), {
                    model: selectedModel,
                    commands: activeCommands,
                    attachments: attachments || [],
                    referencedLibraryItems: referencedLibraryItems || [],
                });

                // FIXED: Only clear the UI state AFTER successful send
                setMessageInput("");
                setActiveCommands([]);
            } catch (error) {
                console.error("Failed to send message:", error);
                toast.error("Failed to send message");
                // Don't clear the input on error so user can retry
            }
        },
        [selectedModel, activeCommands, sendAiMessage, aiIsLoading]
    );

    // AI SDK enhanced multi-AI send message handler
    const handleSendMultiAIMessage = useCallback(
        async (
            content: string,
            models: string[],
            attachments?: Array<{
                type: string;
                storageId: string;
                name: string;
                size: number;
            }>,
            referencedLibraryItems?: Array<{
                type: "attachment" | "artifact" | "media";
                id: string;
                name: string;
                description?: string;
                size?: number;
                mimeType?: string;
            }>
        ) => {
            if (aiIsLoading || multiAiIsLoading) return;

            if (
                !content.trim() &&
                (!attachments || attachments.length === 0) &&
                (!referencedLibraryItems ||
                    referencedLibraryItems.length === 0) &&
                activeCommands.length === 0
            )
                return;

            if (models.length < 2) {
                toast.error(
                    "Please select at least 2 models for multi-AI mode"
                );
                return;
            }

            try {
                // Use AI SDK multi-AI streaming with all original parameters
                await sendMultiAiMessage(content.trim(), models, {
                    commands: activeCommands,
                    attachments: attachments || [],
                    referencedLibraryItems: referencedLibraryItems || [],
                });

                setMessageInput("");
                setActiveCommands([]);
                toast.success(
                    `Generating responses from ${models.length} AI models...`
                );
            } catch (error) {
                console.error("Failed to send multi-AI message:", error);
                toast.error("Failed to send multi-AI message");
            }
        },
        [activeCommands, sendMultiAiMessage, aiIsLoading, multiAiIsLoading]
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

    // Branch creation from message edit
    const handleBranchFromMessage = useCallback(
        async (messageId: Id<"messages">, newContent: string) => {
            console.log("🌿 CREATING BRANCH FROM MESSAGE EDIT:", {
                messageId,
                newContent: newContent.substring(0, 50) + "...",
                chatId,
                timestamp: new Date().toISOString(),
            });

            try {
                const result = await createBranchFromMessageEdit({
                    messageId,
                    newContent,
                });

                console.log("✅ BRANCH CREATED SUCCESSFULLY:", {
                    newBranchId: result.newBranchId,
                    branchNumber: result.branchNumber,
                    totalBranches: result.totalBranches,
                    activeBranchName: result.activeBranchName,
                    timestamp: new Date().toISOString(),
                });

                toast.success(
                    `Created ${result.activeBranchName} (${result.branchNumber}/${result.totalBranches})`
                );
            } catch (error) {
                console.error("❌ BRANCH CREATION FAILED:", error);
                toast.error(
                    `Failed to create branch: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        },
        [createBranchFromMessageEdit]
    );

    const handleRetryMessage = useCallback(
        async (messageId: Id<"messages">) => {
            if (aiIsLoading) return;

            try {
                // For AI SDK, trigger regeneration by finding the user message before this one
                // and resending with the same content
                const messageIndex = messages.findIndex(
                    (m) => m._id === messageId
                );
                if (messageIndex > 0) {
                    const previousMessage = messages[messageIndex - 1];
                    if (previousMessage.role === "user") {
                        await sendAiMessage(previousMessage.content, {
                            model: selectedModel,
                        });
                        toast.info("Regenerating response...");
                    }
                }
            } catch (error) {
                console.error("Error retrying message:", error);
                toast.error("Failed to retry message. Please try again.");
            }
        },
        [messages, sendAiMessage, selectedModel, aiIsLoading]
    );

    // AI SDK stop streaming handler
    const handleStopStreaming = useCallback(async () => {
        try {
            stopAiStreaming();
            toast.success("Streaming stopped");
        } catch (error) {
            console.error("Failed to stop streaming:", error);
            toast.error("Failed to stop streaming");
        }
    }, [stopAiStreaming]);

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

    const handleVersionNavigation = useCallback(
        async (messageId: Id<"messages">, direction: "prev" | "next") => {
            try {
                const message = messages.find((m) => m._id === messageId);
                if (
                    !message?.messageVersions ||
                    message.messageVersions.length <= 1
                )
                    return;

                const currentIndex = message.messageVersions.findIndex(
                    (v) => v.isActive
                );
                let newIndex;

                if (direction === "prev") {
                    newIndex =
                        currentIndex > 0
                            ? currentIndex - 1
                            : message.messageVersions.length - 1;
                } else {
                    newIndex =
                        currentIndex < message.messageVersions.length - 1
                            ? currentIndex + 1
                            : 0;
                }

                const targetVersion = message.messageVersions[newIndex];
                if (targetVersion) {
                    await switchMessageVersion({
                        messageId,
                        versionId: targetVersion.versionId,
                    });

                    console.log("🔄 VERSION NAVIGATION:", {
                        messageId,
                        direction,
                        fromVersion: currentIndex + 1,
                        toVersion: newIndex + 1,
                        targetVersionId: targetVersion.versionId,
                        timestamp: new Date().toISOString(),
                    });
                }
            } catch (error) {
                console.error("Error navigating versions:", error);
            }
        },
        [messages, switchMessageVersion]
    );

    const handleBranchNavigation = useCallback(
        async (messageId: Id<"messages">, direction: "prev" | "next") => {
            try {
                const message = messages.find((m) => m._id === messageId);
                if (!message?.branches || message.branches.length <= 1) {
                    console.warn("No branches available for navigation");
                    return;
                }

                const currentActiveIndex = message.branches.findIndex(
                    (branchId) => branchId === message.activeBranchId
                );
                if (currentActiveIndex === -1) {
                    console.warn("No active branch found");
                    return;
                }

                let newIndex;
                if (direction === "prev") {
                    newIndex =
                        currentActiveIndex > 0
                            ? currentActiveIndex - 1
                            : message.branches.length - 1;
                } else {
                    newIndex =
                        currentActiveIndex < message.branches.length - 1
                            ? currentActiveIndex + 1
                            : 0;
                }

                const targetBranchId = message.branches[newIndex];
                if (targetBranchId) {
                    const result = await navigateToBranch({
                        messageId,
                        branchId: targetBranchId,
                    });

                    if (result.success) {
                        console.log("🌿 BRANCH NAVIGATION SUCCESS:", {
                            messageId,
                            direction,
                            fromBranch: currentActiveIndex + 1,
                            toBranch: newIndex + 1,
                            targetBranchId,
                            branchName: result.branchName,
                            timestamp: new Date().toISOString(),
                        });

                        toast.success(`Switched to ${result.branchName}`);
                    }
                }
            } catch (error) {
                console.error("❌ BRANCH NAVIGATION FAILED:", error);
                toast.error(
                    `Failed to navigate branch: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        },
        [messages, navigateToBranch]
    );

    const { shortcuts, checkShortcutMatch } = useCustomShortcuts();
    const { playAIReplySound } = useNotificationSounds();

    // Track when AI messages complete streaming to play notification sound
    const previousStreamingState = useRef<boolean>(false);

    useEffect(() => {
        const isCurrentlyStreaming = aiIsLoading;

        if (previousStreamingState.current && !isCurrentlyStreaming) {
            // Play notification sound for completed AI reply
            void playAIReplySound();
        }

        previousStreamingState.current = isCurrentlyStreaming;
    }, [aiIsLoading, playAIReplySound]);

    // Enhanced keyboard shortcuts with branch navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in input/textarea
            const isTyping =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement)?.isContentEditable;

            if (isTyping) return;

            // Message actions when hovering over a message
            if (hoveredMessageId) {
                const hoveredMessage = messages.find(
                    (m) => m._id === hoveredMessageId
                );

                // Use custom shortcuts for navigation
                if (checkShortcutMatch(e, "navigateVersionsBranches")) {
                    e.preventDefault();
                    const isLeft = e.key === "ArrowLeft";
                    const direction = isLeft ? "prev" : "next";

                    if (hoveredMessage) {
                        if (
                            (hoveredMessage as any).messageVersions?.length > 1
                        ) {
                            void handleVersionNavigation(
                                hoveredMessageId,
                                direction
                            );
                        } else if (
                            (hoveredMessage as any).conversationBranches
                                ?.length > 1
                        ) {
                            void handleBranchNavigation(
                                hoveredMessageId,
                                direction
                            );
                        }
                    }
                    return;
                }

                if (checkShortcutMatch(e, "copyMessage")) {
                    e.preventDefault();
                    if (hoveredMessage) {
                        void navigator.clipboard.writeText(
                            hoveredMessage.content
                        );
                        toast.success("Message copied to clipboard");
                    }
                    return;
                }

                if (checkShortcutMatch(e, "retryMessage")) {
                    e.preventDefault();
                    if (hoveredMessage?.role === "assistant") {
                        void handleRetryMessage(hoveredMessageId);
                    }
                    return;
                }

                if (checkShortcutMatch(e, "deleteMessage")) {
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
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [
        checkShortcutMatch,
        hoveredMessageId,
        messages,
        handleDeleteMessage,
        handleRetryMessage,
        handleVersionNavigation,
        handleBranchNavigation,
    ]);

    // Add Multi-AI toggle event handler
    useEffect(() => {
        const handleToggleMultiAI = () => {
            const newMultiAIMode = !isMultiAIMode;
            setIsMultiAIMode(newMultiAIMode);

            if (newMultiAIMode) {
                // When enabling Multi-AI, restore last selected models from localStorage
                const savedModels = localStorage.getItem(
                    "lastSelectedMultiAIModels"
                );
                if (savedModels) {
                    try {
                        const parsedModels = JSON.parse(savedModels);
                        if (
                            Array.isArray(parsedModels) &&
                            parsedModels.length >= 2
                        ) {
                            setSelectedModels(parsedModels);
                        } else {
                            // Fallback to default models if saved data is invalid
                            setSelectedModels(["gemini-2.0-flash", "gpt-4o"]);
                        }
                    } catch {
                        setSelectedModels(["gemini-2.0-flash", "gpt-4o"]);
                    }
                } else {
                    // First time enabling Multi-AI, set default models
                    setSelectedModels(["gemini-2.0-flash", "gpt-4o"]);
                }
            } else {
                // When disabling Multi-AI, save current selected models to localStorage
                if (selectedModels && selectedModels.length > 0) {
                    localStorage.setItem(
                        "lastSelectedMultiAIModels",
                        JSON.stringify(selectedModels)
                    );
                }
            }

            toast.success(
                newMultiAIMode
                    ? "Switched to Multi-AI mode"
                    : "Switched to Single AI mode"
            );
        };

        document.addEventListener("toggleMultiAI", handleToggleMultiAI);
        return () =>
            document.removeEventListener("toggleMultiAI", handleToggleMultiAI);
    }, [isMultiAIMode, selectedModels]);

    // Save selected models to localStorage whenever they change in Multi-AI mode
    useEffect(() => {
        if (isMultiAIMode && selectedModels && selectedModels.length > 0) {
            localStorage.setItem(
                "lastSelectedMultiAIModels",
                JSON.stringify(selectedModels)
            );
        }
    }, [isMultiAIMode, selectedModels]);

    // Edit handlers
    const handleStartEdit = useCallback(
        (
            messageId: Id<"messages">,
            content: string,
            commands: string[] = [],
            referencedItems: any[] = []
        ) => {
            setEditingMessage({
                messageId,
                originalContent: content,
                originalCommands: commands,
                originalReferencedItems: referencedItems,
            });

            setMessageInput(content);
            setActiveCommands(commands);

            setTimeout(() => {
                const messageInput = document.querySelector("textarea");
                messageInput?.focus();
            }, 100);
        },
        []
    );

    const handleSaveEdit = useCallback(
        async (content: string, referencedItems?: any[]) => {
            if (!editingMessage) return;

            try {
                await handleBranchFromMessage(
                    editingMessage.messageId,
                    content
                );

                setEditingMessage(null);
                setMessageInput("");
                setActiveCommands([]);

                toast.success("Message updated successfully");
            } catch (error) {
                toast.error("Failed to update message");
            }
        },
        [editingMessage, handleBranchFromMessage]
    );

    const handleCancelEdit = useCallback(() => {
        setEditingMessage(null);
        setMessageInput("");
        setActiveCommands([]);
    }, []);

    return (
        <PasswordGateway chatId={chatId}>
            <div className="flex flex-col w-4/5 mx-auto h-full">
                <div className="flex-1 flex flex-col">
                    <MessageList
                        messages={messages}
                        chat={chat}
                        onRetryMessage={handleRetryMessage}
                        onBranchFromMessage={handleBranchFromMessage}
                        onPrefill={handlePrefill}
                        onMessageHover={setHoveredMessageId}
                        setSelectedChatId={setSelectedChatId}
                        scrollToBottom={scrollToBottom}
                        editingMessageId={editingMessage?.messageId}
                        onStartEdit={handleStartEdit}
                    />
                </div>

                {showMessageInput && (
                    <MessageInput
                        message={messageInput}
                        onMessageChange={setMessageInput}
                        activeCommands={activeCommands}
                        onCommandsChange={setActiveCommands}
                        onSendMessage={(content, referencedLibraryItems) =>
                            void handleSendMessage(
                                content,
                                undefined, // attachments
                                referencedLibraryItems
                            )
                        }
                        isLoading={aiIsLoading}
                        isStreaming={aiIsLoading}
                        onStopStreaming={handleStopStreaming}
                        selectedModel={selectedModel}
                        onModelChange={(model) => void handleModelChange(model)}
                        showMessageInput={showMessageInput}
                        sidebarOpen={sidebarOpen}
                        chatId={chatId}
                        onSendMultiAIMessage={(
                            content,
                            models,
                            referencedLibraryItems
                        ) =>
                            void handleSendMultiAIMessage(
                                content,
                                models,
                                undefined, // attachments
                                referencedLibraryItems
                            )
                        }
                        editMode={
                            editingMessage
                                ? {
                                      isEditing: true,
                                      messageId: editingMessage.messageId,
                                      originalContent:
                                          editingMessage.originalContent,
                                      onSave: handleSaveEdit,
                                      onCancel: handleCancelEdit,
                                  }
                                : undefined
                        }
                        // Add Multi-AI props
                        isMultiAIMode={isMultiAIMode}
                        selectedModels={selectedModels}
                        onSelectedModelsChange={setSelectedModels}
                    />
                )}
            </div>
        </PasswordGateway>
    );
}
