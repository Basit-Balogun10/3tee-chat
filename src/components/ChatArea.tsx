import {
    Dispatch,
    SetStateAction,
    useState,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PasswordGateway } from "./PasswordGateway";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { toast } from "sonner";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";
import { useNotificationSounds } from "../lib/utils";

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
    // State
    const [selectedModel, setSelectedModel] =
        useState<string>("gemini-2.0-flash"); // Default fallback
    const [messageInput, setMessageInput] = useState("");
    const [activeCommands, setActiveCommands] = useState<string[]>([]);
    const [hoveredMessageId, setHoveredMessageId] =
        useState<Id<"messages"> | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Queries and mutations
    const chat = useQuery(api.chats.getChat, { chatId });
    const messagesResult = useQuery(api.chats.getChatMessages, { chatId });
    const messages = useMemo(() => messagesResult || [], [messagesResult]);

    const sendMessage = useAction(api.messages.sendMessage);
    const sendMultiAIMessage = useAction(api.messages.sendMultiAIMessage);
    const markStreamingComplete = useAction(api.ai.markStreamingComplete);
    const updateChatModel = useMutation(api.chats.updateChatModel);
    const deleteMessage = useMutation(api.messages.deleteMessage);
    const retryMessage = useAction(api.messages.retryMessage);
    const switchMessageVersion = useMutation(api.messages.switchMessageVersion);

    // PHASE 3 & 4 FIX: Branching system mutations
    const createBranchFromMessageEdit = useMutation(
        api.branches.createBranchFromMessageEdit
    );
    const navigateToBranch = useMutation(api.branches.navigateToBranch);

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

    const handleSendMessage = useCallback(
        async (
            content: string,
            referencedLibraryItems?: Array<{
                type: "attachment" | "artifact" | "media";
                id: string;
                name: string;
                description?: string;
                size?: number;
                mimeType?: string;
            }>
        ) => {
            if (isLoading) return;

            if (
                !content.trim() &&
                (!referencedLibraryItems || referencedLibraryItems.length === 0) &&
                activeCommands.length === 0
            )
                return;

            try {
                setIsLoading(true);
                
                // UNIFIED: Convert referencedLibraryItems to backend format
                const attachments = referencedLibraryItems
                    ?.filter(item => item.type === "attachment")
                    .map(item => ({
                        type: item.mimeType?.startsWith('image/') ? 'image' as const :
                              item.mimeType === 'application/pdf' ? 'pdf' as const :
                              item.mimeType?.startsWith('audio/') ? 'audio' as const :
                              item.mimeType?.startsWith('video/') ? 'video' as const :
                              'file' as const,
                        storageId: item.id as Id<"_storage">, // Library ID used as storage ID
                        name: item.name,
                        size: item.size || 0,
                    })) || [];

                const referencedArtifacts = referencedLibraryItems
                    ?.filter(item => item.type === "artifact")
                    .map(item => item.id) || [];

                await sendMessage({
                    chatId,
                    content: content.trim(),
                    commands: activeCommands,
                    model: selectedModel,
                    attachments,
                    referencedArtifacts,
                });
                setMessageInput("");
                setActiveCommands([]);
            } catch (error) {
                console.error("Failed to send message:", error);
                toast.error("Failed to send message");
            } finally {
                setIsLoading(false);
            }
        },
        [chatId, selectedModel, activeCommands, sendMessage, isLoading]
    );

    // Multi-AI send message handler
    const handleSendMultiAIMessage = useCallback(
        async (
            content: string,
            models: string[],
            referencedLibraryItems?: Array<{
                type: "attachment" | "artifact" | "media";
                id: string;
                name: string;
                description?: string;
                size?: number;
                mimeType?: string;
            }>
        ) => {
            if (isLoading) return;

            if (
                !content.trim() &&
                (!referencedLibraryItems || referencedLibraryItems.length === 0) &&
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
                setIsLoading(true);

                // UNIFIED: Convert referencedLibraryItems to backend format
                const attachments = referencedLibraryItems
                    ?.filter(item => item.type === "attachment")
                    .map(item => ({
                        type: item.mimeType?.startsWith('image/') ? 'image' as const :
                              item.mimeType === 'application/pdf' ? 'pdf' as const :
                              item.mimeType?.startsWith('audio/') ? 'audio' as const :
                              item.mimeType?.startsWith('video/') ? 'video' as const :
                              'file' as const,
                        storageId: item.id as Id<"_storage">, // Library ID used as storage ID
                        name: item.name,
                        size: item.size || 0,
                    })) || [];

                const referencedArtifacts = referencedLibraryItems
                    ?.filter(item => item.type === "artifact")
                    .map(item => item.id) || [];

                await sendMultiAIMessage({
                    chatId,
                    content: content.trim(),
                    models,
                    commands: activeCommands,
                    attachments,
                    referencedArtifacts,
                });

                setMessageInput("");
                setActiveCommands([]);
                toast.success(
                    `Generating responses from ${models.length} AI models...`
                );
            } catch (error) {
                console.error("Failed to send multi-AI message:", error);
                toast.error("Failed to send multi-AI message");
            } finally {
                setIsLoading(false);
            }
        },
        [chatId, activeCommands, sendMultiAIMessage, isLoading]
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

    // PHASE 3 & 4 FIX: Branch creation from message edit
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
            if (isLoading) return;

            setIsLoading(true);
            try {
                await retryMessage({ messageId });
            } catch (error) {
                console.error("Error retrying message:", error);
                toast.error("Failed to retry message. Please try again.");
            } finally {
                setIsLoading(false);
            }
        },
        [retryMessage, isLoading]
    );

    const handleStopStreaming = useCallback(async () => {
        if (streamingMessage) {
            try {
                await markStreamingComplete({
                    messageId: streamingMessage._id,
                });
                setIsLoading(false);
                toast.success("Streaming stopped");
            } catch (error) {
                console.error("Failed to stop streaming:", error);
                toast.error("Failed to stop streaming");
            }
        }
    }, [streamingMessage, markStreamingComplete]);

    const handleDeleteMessage = useCallback(
        async (messageId: Id<"messages">) => {
            try {
                // PHASE 5 FIX: Use the new branch cleanup deletion function
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

    // PHASE 4 FIX: Branch navigation function
    const handleBranchNavigation = useCallback(
        async (messageId: Id<"messages">, direction: "prev" | "next") => {
            try {
                const message = messages.find((m) => m._id === messageId);
                if (!message?.branches || message.branches.length <= 1) {
                    console.warn("No branches available for navigation");
                    return;
                }

                // Simple branch data construction for navigation
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
        const isCurrentlyStreaming = !!streamingMessage?.isStreaming;

        if (previousStreamingState.current && !isCurrentlyStreaming) {
            // Play notification sound for completed AI reply
            void playAIReplySound();
        }

        previousStreamingState.current = isCurrentlyStreaming;
    }, [streamingMessage?.isStreaming, playAIReplySound]);

    // PHASE 4 FIX: Enhanced keyboard shortcuts with branch navigation
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
                    // Check if it's left or right arrow to determine direction
                    const isLeft = e.key === "ArrowLeft";
                    const direction = isLeft ? "prev" : "next";

                    // Check if message has versions (retries) first, then branches (edits)
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

                if (checkShortcutMatch(e, "collapseMessage")) {
                    e.preventDefault();
                    // Collapse message - dedicated action
                    if (hoveredMessage && hoveredMessage.content.length > 100) {
                        const collapseEvent = new CustomEvent(
                            "collapseMessage",
                            {
                                detail: {
                                    messageId: hoveredMessageId,
                                    action: "collapse",
                                },
                            }
                        );
                        document.dispatchEvent(collapseEvent);
                    }
                    return;
                }

                if (checkShortcutMatch(e, "expandMessage")) {
                    e.preventDefault();
                    // Expand message - dedicated action
                    if (hoveredMessage && hoveredMessage.content.length > 100) {
                        const expandEvent = new CustomEvent("expandMessage", {
                            detail: {
                                messageId: hoveredMessageId,
                                action: "expand",
                            },
                        });
                        document.dispatchEvent(expandEvent);
                    }
                    return;
                }

                if (checkShortcutMatch(e, "scrollToMessageEnd")) {
                    e.preventDefault();
                    // Scroll to end of hovered message
                    const scrollEvent = new CustomEvent("scrollToMessageEnd", {
                        detail: { messageId: hoveredMessageId },
                    });
                    document.dispatchEvent(scrollEvent);
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

                if (checkShortcutMatch(e, "editMessage")) {
                    e.preventDefault();
                    if (hoveredMessage?.role === "user") {
                        const editEvent = new CustomEvent("editMessage", {
                            detail: {
                                messageId: hoveredMessageId,
                                content: hoveredMessage.content,
                            },
                        });
                        document.dispatchEvent(editEvent);
                    }
                    return;
                }

                if (checkShortcutMatch(e, "retryMessage")) {
                    e.preventDefault();
                    if (hoveredMessage?.role === "assistant") {
                        const retryEvent = new CustomEvent(
                            "retryMessageWithSameModel",
                            {
                                detail: { messageId: hoveredMessageId },
                            }
                        );
                        document.dispatchEvent(retryEvent);
                    }
                    return;
                }

                if (checkShortcutMatch(e, "retryDifferentModel")) {
                    e.preventDefault();
                    if (hoveredMessage?.role === "assistant") {
                        const retryEvent = new CustomEvent(
                            "retryMessageWithDifferentModel",
                            {
                                detail: { messageId: hoveredMessageId },
                            }
                        );
                        document.dispatchEvent(retryEvent);
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

                if (checkShortcutMatch(e, "forkConversation")) {
                    e.preventDefault();
                    if (hoveredMessage?.role === "assistant") {
                        const forkEvent = new CustomEvent("forkFromMessage", {
                            detail: { messageId: hoveredMessageId },
                        });
                        document.dispatchEvent(forkEvent);
                    }
                    return;
                }

                // Enhanced Deep Link Shortcuts
                if (
                    checkShortcutMatch(e, "copyDirectMessageLink") &&
                    hoveredMessageId
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    const copyDirectLinkEvent = new CustomEvent(
                        "copyDirectMessageLink",
                        {
                            detail: { messageId: hoveredMessageId },
                        }
                    );
                    document.dispatchEvent(copyDirectLinkEvent);
                    return;
                }

                if (
                    checkShortcutMatch(e, "createSharedMessageLink") &&
                    hoveredMessageId
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    const createSharedLinkEvent = new CustomEvent(
                        "createSharedMessageLink",
                        {
                            detail: { messageId: hoveredMessageId },
                        }
                    );
                    document.dispatchEvent(createSharedLinkEvent);
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

    return (
        <PasswordGateway chatId={chatId}>
            <div className="flex flex-col w-4/5 mx-auto h-full">
                {/* Header section with sliding animation */}
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
                    />
                </div>

                {showMessageInput && (
                    <MessageInput
                        message={messageInput}
                        onMessageChange={setMessageInput}
                        activeCommands={activeCommands}
                        onCommandsChange={setActiveCommands}
                        onSendMessage={(
                            content,
                            attachments,
                            referencedArtifacts
                        ) =>
                            void handleSendMessage(
                                content,
                                attachments,
                                referencedArtifacts
                            )
                        }
                        isStreaming={streamingMessage?.isStreaming || false}
                        onStopStreaming={handleStopStreaming}
                        selectedModel={selectedModel}
                        onModelChange={(model) => void handleModelChange(model)}
                        showMessageInput={showMessageInput}
                        sidebarOpen={sidebarOpen}
                        chatId={chatId}
                        onSendMultiAIMessage={handleSendMultiAIMessage}
                    />
                )}
            </div>
        </PasswordGateway>
    );
}
