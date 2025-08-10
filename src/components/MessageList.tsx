import { toast } from "sonner";
import {
    Dispatch,
    SetStateAction,
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
    Clock,
    Copy,
    Edit3,
    RotateCcw,
    ChevronDown,
    ChevronUp,
    Trash2,
    MoreVertical,
    Link,
    ExternalLink,
    FileText,
    Image,
    Video,
    Palette,
    Trash,
} from "lucide-react";
import { Button } from "./ui/button";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { AttachmentPreview } from "./AttachmentPreview";
import { LoadingPlaceholder } from "./LoadingPlaceholder";
import { MessageBranchNavigator } from "./MessageBranchNavigator";
import { ModelSelector } from "./ModelSelector";
import { MultiAIResponseCarousel } from "./MultiAIResponseCarousel";

interface Message {
    _id: Id<"messages">;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    model?: string;
    isStreaming?: boolean;
    attachments?: Array<{
        type: "image" | "pdf" | "file" | "audio" | "video";
        storageId: Id<"_storage">;
        name: string;
        size: number;
    }>;
    // Auto-populated artifacts from backend query
    artifacts?: Array<{
        _id: Id<"artifacts">;
        artifactId: string;
        filename: string;
        language: string;
        content: string;
        description?: string;
        isPreviewable?: boolean;
        editCount?: number;
        updatedAt: number;
    }>;
    metadata?: {
        // Updated to use new citations schema instead of searchResults
        citations?: Array<{
            number: number;
            title: string;
            url: string;
            source: string;
            startIndex?: number;
            endIndex?: number;
            citedText?: string;
        }>;
        imagePrompt?: string;
        generatedImageUrl?: string;
        structuredOutput?: boolean;
        canvasIntro?: string;
        canvasSummary?: string;
        // artifacts now contains array of artifact IDs (v.array(v.id("artifacts")))
        artifacts?: Array<Id<"artifacts">>;
        audioTranscription?: string;
        videoPrompt?: string;
        generatedVideoUrl?: string;
        videoThumbnailUrl?: string;
        videoDuration?: string;
        videoResolution?: string;
        multiAIResponses?: {
            selectedModels: string[];
            responses: Array<{
                responseId: string;
                model: string;
                content: string;
                timestamp: number;
                isPrimary: boolean;
                isDeleted?: boolean;
                metadata?: any;
            }>;
            primaryResponseId?: string;
        };
    };
    // Branch information (optional for now until fully implemented)
    activeBranchId?: string;
}

interface MessageListProps {
    messages: Message[];
    chat?: {
        _id: Id<"chats">;
        title: string;
        model: string;
        shareId?: string;
        isPublic?: boolean;
        sharePermissions?: string[];
        shareExpiresAt?: number;
    };
    onRetryMessage?: (
        messageId: Id<"messages">,
        model: string
    ) => Promise<void> | void;
    onBranchFromMessage: (
        messageId: Id<"messages">,
        newContent: string
    ) => Promise<void> | void;
    onPrefill: (prompText: string) => void;
    onMessageHover?: (messageId: Id<"messages"> | null) => void;
    setSelectedChatId: Dispatch<SetStateAction<Id<"chats"> | null>>;
    scrollToBottom: () => void;
    // NEW: Edit mode props to replace custom events
    editingMessageId?: Id<"messages"> | null;
    onStartEdit: (
        messageId: Id<"messages">,
        content: string,
        attachments: Array<{
            type: "image" | "pdf" | "file" | "audio" | "video";
            storageId: Id<"_storage">;
            name: string;
            size: number;
        }>
    ) => void;
}

export function MessageList({
    messages,
    chat,
    onRetryMessage,
    onBranchFromMessage,
    onPrefill: _onPrefill,
    onMessageHover,
    setSelectedChatId,
    scrollToBottom,
    editingMessageId,
    onStartEdit,
}: MessageListProps) {
    // Remove old edit states - no longer needed since we use MessageInput for editing
    // Per-message render state instead of global
    const [messageRenderModes, setMessageRenderModes] = useState<
        Record<string, "rendered" | "raw">
    >({});
    const [collapsedMessages, setCollapsedMessages] = useState<
        Set<Id<"messages">>
    >(new Set());
    const [hoveredMessageId, setHoveredMessageId] =
        useState<Id<"messages"> | null>(null);
    const [showRetryModelSelector, setShowRetryModelSelector] =
        useState<Id<"messages"> | null>(null);
    const [showRetryDropdown, setShowRetryDropdown] =
        useState<Id<"messages"> | null>(null);
    const [showDeleteDropdown, setShowDeleteDropdown] =
        useState<Id<"messages"> | null>(null);
    const [showDeepLinkDropdown, setShowDeepLinkDropdown] =
        useState<Id<"messages"> | null>(null);
    const [showCarouselForMessage, setShowCarouselForMessage] =
        useState<Id<"messages"> | null>(null);
    const lastAiMessageRef = useRef<HTMLDivElement>(null);

    // Initialize mutations at the top level to avoid hooks order issues
    const deleteMessage = useMutation(api.messages.deleteMessage);
    const deleteAllMessagesFromHere = useMutation(
        api.messages.deleteAllMessagesFromHere
    );
    const editAssistantMessage = useMutation(api.messages.editAssistantMessage);
    const forkChat = useMutation(api.chats.forkChatFromMessage);

    const lastAiMessage = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") {
                return messages[i];
            }
        }
        return null;
    }, [messages]);

    // Find the currently streaming message
    const streamingMessage = useMemo(() => {
        return messages.find((message) => message.isStreaming);
    }, [messages]);

    // Smart scroll function - scroll to streaming message or bottom with proper offset
    const smartScroll = useCallback(() => {
        if (streamingMessage) {
            // Check if streaming message is the last message
            const isLastMessage =
                messages[messages.length - 1]?._id === streamingMessage._id;

            // If it's the last message, use regular scrollToBottom (it has proper padding)
            if (isLastMessage) {
                scrollToBottom();
                return;
            }

            // For non-last streaming messages, scroll to the end of the element + offset
            const streamingElement = document.querySelector(
                `[data-message-id="${streamingMessage._id}"]`
            );
            if (streamingElement) {
                // Get the bottom position of the streaming element
                const elementRect = streamingElement.getBoundingClientRect();
                const scrollTop =
                    window.pageYOffset || document.documentElement.scrollTop;
                const elementBottomAbsolute = elementRect.bottom + scrollTop;

                // Calculate where we want the element's bottom to be positioned
                // We want it to be visible above the MessageInput (140px offset)
                const messageInputOffset = 140;
                const targetViewportPosition =
                    window.innerHeight - messageInputOffset;

                // Calculate how much we need to scroll to position the element's bottom at the target
                const targetScrollPosition =
                    elementBottomAbsolute - targetViewportPosition;

                window.scrollTo({
                    top: Math.max(0, targetScrollPosition),
                    behavior: "smooth",
                });
                return;
            }
        }
    }, [streamingMessage, messages, scrollToBottom]);

    // Function to scroll to the end of any message (for keyboard shortcut)
    const scrollToMessageEnd = useCallback((messageId: Id<"messages">) => {
        const messageElement = document.querySelector(
            `[data-message-id="${messageId}"]`
        );
        console.log("Scrolling to message end: ", messageElement);
        if (messageElement) {
            const elementRect = messageElement.getBoundingClientRect();
            const scrollTop =
                window.pageYOffset || document.documentElement.scrollTop;
            const elementBottomAbsolute = elementRect.bottom + scrollTop;

            // Position the bottom of the message comfortably above the MessageInput
            const messageInputOffset = 140;
            const targetViewportPosition =
                window.innerHeight - messageInputOffset;
            const targetScrollPosition =
                elementBottomAbsolute - targetViewportPosition;

            console.log(
                "Scrolling to: ",
                window.innerHeight,
                messageInputOffset,
                targetViewportPosition,
                elementBottomAbsolute,
                targetScrollPosition
            );

            window.scrollTo({
                top: Math.max(0, targetScrollPosition),
                behavior: "smooth",
            });
        }
    }, []);

    // Initial scroll to bottom when messages first load
    useEffect(() => {
        if (messages.length > 0) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    }, [messages.length, scrollToBottom]); // Only trigger when messages go from 0 to some, or length changes

    useEffect(() => {
        // Only trigger smart scroll when actively streaming
        if (streamingMessage?.isStreaming) {
            smartScroll();
        }
    }, [smartScroll, streamingMessage?.isStreaming]);

    // Toggle render mode for a specific message
    const toggleMessageRenderMode = (messageId: string) => {
        setMessageRenderModes((prev) => ({
            ...prev,
            [messageId]: prev[messageId] === "raw" ? "rendered" : "raw",
        }));
    };

    // Get render mode for a message (default to "rendered")
    const getMessageRenderMode = (messageId: string) => {
        return messageRenderModes[messageId] || "rendered";
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        } else {
            return date.toLocaleDateString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        }
    };

    const handleForkChat = async (messageId: Id<"messages">) => {
        try {
            const result = await forkChat({ messageId });
            toast.success(
                `Created new chat with ${result.messageCount} messages`
            );
            setSelectedChatId(result.newChatId);
        } catch {
            toast.error("Failed to fork chat");
        }
    };

    // Listen for keyboard shortcut events
    useEffect(() => {
        const handleEditMessage = (e: CustomEvent) => {
            const { messageId } = e.detail;
            const message = messages.find((m) => m._id === messageId);
            if (message && message.role === "user") {
                handleEdit(message);
            }
        };

        const handleForkFromMessage = (e: CustomEvent) => {
            const { messageId } = e.detail;
            void handleForkChat(messageId);
        };

        const handleRetryMessageWithSameModel = (e: CustomEvent) => {
            const { messageId } = e.detail;
            const message = messages.find((m) => m._id === messageId);
            if (message && message.role === "assistant" && onRetryMessage) {
                // Retry with the same model directly
                void onRetryMessage(
                    messageId,
                    message.model || "gemini-2.0-flash"
                );
                toast.success(
                    `Retrying with ${message.model || "gemini-2.0-flash"}`
                );
            }
        };

        const handleRetryMessageWithDifferentModel = (e: CustomEvent) => {
            const { messageId } = e.detail;
            const message = messages.find((m) => m._id === messageId);
            if (message && message.role === "assistant") {
                // Open model selector directly for choosing different model
                setShowRetryModelSelector(messageId);
            }
        };

        const handleNavigateBranch = (e: CustomEvent) => {
            const { messageId, direction } = e.detail;
            // Find message and handle branch navigation
            const message = messages.find((m) => m._id === messageId);
            if (message) {
                // Placeholder for branch navigation - will be implemented when message branching is fully ready
                console.log(
                    `Navigate ${direction} branch for message:`,
                    messageId
                );
            }
        };

        const handleCollapseMessage = (e: CustomEvent) => {
            const { messageId } = e.detail;
            // Dedicated collapse function
            setCollapsedMessages((prev) => {
                const newCollapsed = new Set(prev);
                newCollapsed.add(messageId);
                return newCollapsed;
            });
        };

        const handleExpandMessage = (e: CustomEvent) => {
            const { messageId } = e.detail;
            // Dedicated expand function
            setCollapsedMessages((prev) => {
                const newCollapsed = new Set(prev);
                newCollapsed.delete(messageId);
                return newCollapsed;
            });
        };

        const handleScrollToMessageEnd = (e: CustomEvent) => {
            console.log("scrollToMessageEnd event received");
            const { messageId } = e.detail;
            scrollToMessageEnd(messageId);
        };

        // Enhanced Deep Link Keyboard Shortcuts
        const handleCopyDirectMessageLink = (e: CustomEvent) => {
            const { messageId } = e.detail;
            void handleCopyMessageLink(messageId);
        };

        const handleCreateSharedMessageLink = (e: CustomEvent) => {
            const { messageId } = e.detail;
            void handleCreateSharedMessageLink(messageId);
        };

        document.addEventListener(
            "editMessage",
            handleEditMessage as EventListener
        );
        document.addEventListener(
            "forkFromMessage",
            handleForkFromMessage as EventListener
        );
        document.addEventListener(
            "retryMessageWithSameModel",
            handleRetryMessageWithSameModel as EventListener
        );
        document.addEventListener(
            "retryMessageWithDifferentModel",
            handleRetryMessageWithDifferentModel as EventListener
        );
        document.addEventListener(
            "navigateBranch",
            handleNavigateBranch as EventListener
        );
        document.addEventListener(
            "collapseMessage",
            handleCollapseMessage as EventListener
        );
        document.addEventListener(
            "expandMessage",
            handleExpandMessage as EventListener
        );
        document.addEventListener(
            "scrollToMessageEnd",
            handleScrollToMessageEnd as EventListener
        );
        document.addEventListener(
            "copyDirectMessageLink",
            handleCopyDirectMessageLink as EventListener
        );
        document.addEventListener(
            "createSharedMessageLink",
            handleCreateSharedMessageLink as EventListener
        );

        return () => {
            document.removeEventListener(
                "editMessage",
                handleEditMessage as EventListener
            );
            document.removeEventListener(
                "forkFromMessage",
                handleForkFromMessage as EventListener
            );
            document.removeEventListener(
                "retryMessageWithSameModel",
                handleRetryMessageWithSameModel as EventListener
            );
            document.removeEventListener(
                "retryMessageWithDifferentModel",
                handleRetryMessageWithDifferentModel as EventListener
            );
            document.removeEventListener(
                "navigateBranch",
                handleNavigateBranch as EventListener
            );
            document.removeEventListener(
                "collapseMessage",
                handleCollapseMessage as EventListener
            );
            document.removeEventListener(
                "expandMessage",
                handleExpandMessage as EventListener
            );
            document.removeEventListener(
                "scrollToMessageEnd",
                handleScrollToMessageEnd as EventListener
            );
            document.removeEventListener(
                "copyDirectMessageLink",
                handleCopyDirectMessageLink as EventListener
            );
            document.removeEventListener(
                "createSharedMessageLink",
                handleCreateSharedMessageLink as EventListener
            );
        };
    }, [messages, onBranchFromMessage, handleForkChat, onRetryMessage]);

    const handleEdit = (message: Message) => {
        // Use prop-based approach instead of custom events
        onStartEdit(message._id, message.content, message.attachments || []);

        // Log edit initiation
        console.log("✏️ EDIT INITIATED:", {
            messageId: message._id,
            originalContent: message.content.substring(0, 50) + "...",
            role: message.role,
            attachmentsCount: (message.attachments || []).length,
            timestamp: new Date().toISOString(),
        });
    };

    // Remove old handleSaveEdit and handleCancelEdit functions - they're no longer needed
    // const handleSaveEdit = async (isAssistantMessage = false) => { ... }
    // const handleCancelEdit = () => { ... }

    // Remove old handleKeyDown function - no longer needed
    // const handleKeyDown = (e: React.KeyboardEvent) => { ... }

    const handleCopy = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            toast.success("Copied to clipboard!");
        } catch {
            toast.error("Failed to copy to clipboard");
        }
    };

    // Enhanced Deep Link Handlers with Branch Support and Sharing Integration
    const handleCopyMessageLink = async (messageId: Id<"messages">) => {
        try {
            const currentUrl = new URL(window.location.href);
            const message = messages.find((m) => m._id === messageId);

            if (!message) {
                toast.error("Message not found");
                return;
            }

            // Create simplified deep link format: m=messageId&b=branchId
            let deepLinkHash = `m=${messageId}`;

            // Add branch info using existing branching system
            if (message.activeBranchId) {
                deepLinkHash += `&b=${message.activeBranchId}`;
            }

            // Direct chat link with deep link
            currentUrl.hash = deepLinkHash;
            await navigator.clipboard.writeText(currentUrl.toString());
            toast.success("Message link copied to clipboard!");
        } catch {
            toast.error("Failed to copy message link");
        }
    };

    const handleCreateSharedMessageLink = async (messageId: Id<"messages">) => {
        try {
            const message = messages.find((m) => m._id === messageId);
            if (!message) {
                toast.error("Message not found");
                return;
            }

            // Create simplified deep link format: m=messageId&b=branchId
            let deepLinkHash = `m=${messageId}`;
            if (message.activeBranchId) {
                deepLinkHash += `&b=${message.activeBranchId}`;
            }

            if (chat) {
                if (chat.shareId && chat.isPublic) {
                    // Chat is already shared - create the link directly
                    const shareUrl = `${window.location.origin}/shared/chat/${chat.shareId}#${deepLinkHash}`;

                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Shared message link copied to clipboard!");
                } else {
                    // Chat not shared yet - trigger ShareModal with message context
                    const shareModalEvent = new CustomEvent(
                        "openShareModalWithMessage",
                        {
                            detail: {
                                chatId: chat._id,
                                messageId,
                                deepLinkHash,
                                reason: "Create shared link to this specific message",
                            },
                        }
                    );
                    document.dispatchEvent(shareModalEvent);
                }
            }
        } catch (error) {
            console.error("Failed to create shared message link:", error);
            toast.error("Failed to create shared message link");
        }
    };

    // Handle deep link navigation on component mount
    useEffect(() => {
        const handleDeepLink = () => {
            const hash = window.location.hash;
            if (hash.startsWith("#m=")) {
                // Parse simplified deep link format: #m=messageId&b=branchId
                const params = new URLSearchParams(hash.substring(1)); // Remove '#'
                const messageId = params.get("m");
                const branchId = params.get("b");

                if (!messageId) return;

                const targetMessage = messages.find((m) => m._id === messageId);

                if (targetMessage) {
                    // Check if we need to switch branches first
                    if (branchId && targetMessage.activeBranchId !== branchId) {
                        // TODO: Switch to the specified branch before scrolling
                        console.log(
                            `Switching to branch ${branchId} for message ${messageId}`
                        );
                        // For now, we'll scroll to the message even if branch doesn't match
                    }

                    // Message found - scroll to it with enhanced highlighting
                    setTimeout(() => {
                        const messageElement = document.querySelector(
                            `[data-message-id="${messageId}"]`
                        );
                        if (messageElement) {
                            messageElement.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                            });

                            // Enhanced purple glow animation matching our theme
                            messageElement.classList.add(
                                "ring-4",
                                "ring-purple-400",
                                "ring-opacity-70",
                                "shadow-2xl",
                                "shadow-purple-400/50",
                                "transition-all",
                                "duration-1000"
                            );

                            // Add pulsing animation
                            messageElement.style.animation =
                                "deep-link-highlight 3s ease-in-out";

                            setTimeout(() => {
                                messageElement.classList.remove(
                                    "ring-4",
                                    "ring-purple-400",
                                    "ring-opacity-70",
                                    "shadow-2xl",
                                    "shadow-purple-400/50"
                                );
                                messageElement.style.animation = "";
                            }, 4000);

                            // Show success toast
                            toast.success("Navigated to linked message", {
                                description: branchId
                                    ? `Branch: ${branchId}`
                                    : undefined,
                                duration: 3000,
                            });
                        }
                    }, 500); // Allow time for messages to render
                } else {
                    // Message not found - show appropriate error
                    const isValidMessageId = messageId.length > 10; // Basic validation

                    if (isValidMessageId) {
                        // Valid ID format but message doesn't exist
                        toast.error("Message not found", {
                            description:
                                "The linked message may have been deleted or is not accessible in this conversation.",
                            duration: 5000,
                        });
                    } else {
                        // Invalid message ID format
                        toast.error("Invalid message link", {
                            description:
                                "The message link appears to be corrupted or invalid.",
                            duration: 5000,
                        });
                    }

                    // Clear the invalid hash
                    window.history.replaceState(
                        null,
                        "",
                        window.location.pathname
                    );
                }
            }
        };

        // Handle initial deep link
        if (messages.length > 0) {
            handleDeepLink();
        }

        // Handle hash changes (for SPA navigation)
        window.addEventListener("hashchange", handleDeepLink);
        return () => window.removeEventListener("hashchange", handleDeepLink);
    }, [messages]);

    const toggleMessageCollapse = (messageId: Id<"messages">) => {
        const newCollapsed = new Set(collapsedMessages);
        if (newCollapsed.has(messageId)) {
            newCollapsed.delete(messageId);
        } else {
            newCollapsed.add(messageId);
        }
        setCollapsedMessages(newCollapsed);
    };

    const renderMessageMetadata = (message: Message) => {
        if (!message.metadata || Object.keys(message.metadata).length === 0)
            return null;

        return (
            <div className="space-y-3 mb-3">
                {/* Voice transcription indicator */}
                {/* {message.metadata.audioTranscription && (
                    <div className="flex items-center gap-2 text-sm text-purple-400 bg-purple-600/10 rounded-lg p-3 border border-purple-500/20">
                        <Mic className="w-4 h-4" />
                        <span>
                            Transcribed: "{message.metadata.audioTranscription}"
                        </span>
                    </div>
                )}
 */}
                {/* Generated image display */}
                {/* Replace the existing image/video metadata rendering with
                loading-aware versions: */}
                {/* Generated image display with loading state */}
                {message.metadata.imagePrompt && (
                    <div className="my-4">
                        <div className="text-sm text-purple-400 mb-2 flex items-center gap-2">
                            <Image className="w-4 h-4" />
                            Generated image: "{message.metadata.imagePrompt}"
                        </div>

                        {message.metadata.generatedImageUrl ? (
                            // Show actual image
                            <div className="relative group">
                                <img
                                    src={message.metadata.generatedImageUrl}
                                    alt={message.metadata.imagePrompt}
                                    className="max-w-md w-full rounded-lg shadow-lg transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() =>
                                        window.open(
                                            message.metadata?.generatedImageUrl,
                                            "_blank"
                                        )
                                    }
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            // Show loading placeholder
                            <LoadingPlaceholder
                                type="image"
                                prompt={message.metadata.imagePrompt}
                                className="my-2"
                            />
                        )}
                    </div>
                )}
                {/* Generated video display with loading state */}
                {message.metadata.videoPrompt && (
                    <div className="my-4">
                        <div className="text-sm text-purple-400 mb-2 flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Generated video: "{message.metadata.videoPrompt}"
                        </div>

                        {message.metadata.generatedVideoUrl ? (
                            // Show actual video
                            <div className="relative group">
                                <video
                                    src={message.metadata.generatedVideoUrl}
                                    poster={message.metadata.videoThumbnailUrl}
                                    controls
                                    className="max-w-md w-full rounded-lg shadow-lg"
                                    preload="metadata"
                                >
                                    Your browser does not support the video tag.
                                </video>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg pointer-events-none" />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() =>
                                        window.open(
                                            message.metadata?.generatedVideoUrl,
                                            "_blank"
                                        )
                                    }
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                                {/* Video metadata overlay */}
                                {(message.metadata.videoDuration ||
                                    message.metadata.videoResolution) && (
                                    <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                                        {message.metadata.videoDuration && (
                                            <span>
                                                {message.metadata.videoDuration}
                                            </span>
                                        )}
                                        {message.metadata.videoDuration &&
                                            message.metadata
                                                .videoResolution && (
                                                <span className="mx-1">•</span>
                                            )}
                                        {message.metadata.videoResolution && (
                                            <span>
                                                {
                                                    message.metadata
                                                        .videoResolution
                                                }
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Show loading placeholder
                            <LoadingPlaceholder
                                type="video"
                                prompt={message.metadata.videoPrompt}
                                className="my-2"
                            />
                        )}
                    </div>
                )}
                {/* Canvas Artifacts Display - REPLACE EXISTING PLACEHOLDER */}
                {message.metadata?.structuredOutput &&
                    message.metadata?.artifacts && (
                        <div className="mt-4 p-4 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-lg border border-blue-600/20">
                            {/* Canvas Intro */}
                            {message.metadata.canvasIntro && (
                                <div className="mb-4">
                                    <MarkdownRenderer
                                        content={message.metadata.canvasIntro}
                                        className="text-blue-100"
                                    />
                                </div>
                            )}

                            {/* Artifacts List */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-blue-200">
                                    <Palette className="w-5 h-5" />
                                    <h4 className="font-medium">
                                        Created Artifacts
                                    </h4>
                                    <span className="text-xs bg-blue-600/20 px-2 py-1 rounded">
                                        {message.metadata.artifacts.length}{" "}
                                        files
                                    </span>
                                </div>

                                {message.metadata.artifacts.map(
                                    (artifactId, index) => {
                                        // Since artifacts is an array of artifact IDs, we need to create a mock structure
                                        // In a real implementation, you'd query the artifacts by ID
                                        const mockArtifact = {
                                            id: artifactId,
                                            filename: `artifact-${index + 1}.tsx`,
                                            language: "typescript",
                                            description: `Generated artifact ${index + 1}`,
                                        };

                                        return (
                                            <div
                                                key={artifactId}
                                                className="flex items-center justify-between p-3 bg-blue-600/20 rounded-lg border border-blue-600/30 cursor-pointer hover:bg-blue-600/30 transition-colors group"
                                                onClick={() => {
                                                    const event =
                                                        new CustomEvent(
                                                            "openArtifact",
                                                            {
                                                                detail: {
                                                                    artifactId:
                                                                        mockArtifact.id,
                                                                },
                                                            }
                                                        );
                                                    document.dispatchEvent(
                                                        event
                                                    );
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-600/20 rounded flex items-center justify-center">
                                                        <FileText className="w-4 h-4 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-blue-100">
                                                                {
                                                                    mockArtifact.filename
                                                                }
                                                            </span>
                                                            <span className="text-xs bg-blue-600/20 px-2 py-1 rounded text-blue-300">
                                                                {
                                                                    mockArtifact.language
                                                                }
                                                            </span>
                                                        </div>
                                                        {mockArtifact.description && (
                                                            <p className="text-sm text-blue-300 mt-1">
                                                                {
                                                                    mockArtifact.description
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const event =
                                                                new CustomEvent(
                                                                    "openArtifact",
                                                                    {
                                                                        detail: {
                                                                            artifactId:
                                                                                mockArtifact.id,
                                                                        },
                                                                    }
                                                                );
                                                            document.dispatchEvent(
                                                                event
                                                            );
                                                        }}
                                                        className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-600/20"
                                                        title="Open in Canvas"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>

                            {/* Canvas Summary */}
                            {message.metadata.canvasSummary && (
                                <div className="mt-4 pt-4 border-t border-blue-600/20">
                                    <MarkdownRenderer
                                        content={message.metadata.canvasSummary}
                                        className="text-blue-100"
                                    />
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="mt-4 pt-4 border-t border-blue-600/20 flex items-center justify-between">
                                <div className="text-xs text-blue-400">
                                    Canvas response •{" "}
                                    {message.metadata.artifacts.length}{" "}
                                    artifacts created
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        // Open Canvas panel if available
                                        if (
                                            message?.metadata?.artifacts
                                                .length > 0
                                        ) {
                                            const event = new CustomEvent(
                                                "openArtifact",
                                                {
                                                    detail: {
                                                        artifactId:
                                                            message?.metadata
                                                                ?.artifacts[0],
                                                    },
                                                }
                                            );
                                            document.dispatchEvent(event);
                                        }
                                    }}
                                    className="border-blue-600/30 text-blue-300 hover:bg-blue-600/20"
                                >
                                    <Palette className="w-4 h-4 mr-2" />
                                    Open Canvas
                                </Button>
                            </div>
                        </div>
                    )}
            </div>
        );
    };

    const handleDeleteMessage = async (messageId: Id<"messages">) => {
        if (
            confirm(
                "Are you sure you want to delete this message? This will also remove any AI response that follows."
            )
        ) {
            try {
                await deleteMessage({ messageId });
                toast.success("Message deleted");
            } catch {
                toast.error("Failed to delete message");
            }
        }
    };

    // Add enhanced deletion handlers
    const handleDeleteAllFromHere = async (messageId: Id<"messages">) => {
        if (
            confirm(
                "⚠️ Delete all messages from here onwards?\n\nThis will permanently delete this message and ALL messages that come after it in the conversation. This action cannot be undone."
            )
        ) {
            try {
                const result = await deleteAllMessagesFromHere({
                    messageId,
                    deleteMode: "from_here",
                });
                toast.success(
                    `Deleted ${result.deletedCount} messages from position ${result.fromIndex + 1} onwards`
                );
            } catch {
                toast.error("Failed to delete messages");
            }
        }
    };

    const handleDeleteAllAfter = async (messageId: Id<"messages">) => {
        if (
            confirm(
                "⚠️ Delete all messages after this one?\n\nThis will permanently delete ALL messages that come after this one in the conversation, but keep this message. This action cannot be undone."
            )
        ) {
            try {
                const result = await deleteAllMessagesFromHere({
                    messageId,
                    deleteMode: "all_after",
                });
                toast.success(
                    `Deleted ${result.deletedCount} messages after this one`
                );
            } catch {
                toast.error("Failed to delete messages");
            }
        }
    };

    // Updated function to work directly with the new citations schema
    const extractCitations = (content: string, citations?: any[]) => {
        // Return citations directly from metadata - no need to extract from content anymore
        // The backend now provides proper citations with all needed fields
        if (!citations || citations.length === 0) return null;

        // Sort citations by number for consistent display
        return citations.sort((a, b) => a.number - b.number);
    };

    // Close function for retry model selector and delete dropdown
    const closeRetryModels = () => {
        if (showRetryModelSelector) {
            setShowRetryModelSelector(null);
        }
        if (showDeleteDropdown) {
            setShowDeleteDropdown(null);
        }
    };

    // Add this handler function after other handlers
    const handleToggleMultiAICarousel = (messageId: Id<"messages">) => {
        setShowCarouselForMessage(
            showCarouselForMessage === messageId ? null : messageId
        );
    };

    // Add handler for primary response selection
    const handleSelectPrimaryResponse = async (
        messageId: Id<"messages">,
        responseId: string
    ) => {
        try {
            // Call backend mutation to update primary response
            await selectPrimaryAIResponse({
                messageId,
                responseId,
            });

            // Hide carousel after selection
            setShowCarouselForMessage(null);

            toast.success("Primary response updated");
        } catch (error) {
            console.error("Failed to update primary response:", error);
            toast.error("Failed to update primary response");
        }
    };

    // Find the editing message
    const editingMessage = editingMessageId
        ? messages.find((m) => m._id === editingMessageId)
        : null;

    // Scroll to editing message
    const scrollToEditingMessage = useCallback(() => {
        if (editingMessageId) {
            const messageElement = document.querySelector(
                `[data-message-id="${editingMessageId}"]`
            );
            if (messageElement) {
                messageElement.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }
        }
    }, [editingMessageId]);

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Fixed Editing Header */}
            {editingMessage && (
                <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-lg border-b border-purple-600/30 shadow-xl">
                    <div className="p-4">
                        <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-3 backdrop-blur-sm shadow-lg">
                            <div
                                className="text-sm text-purple-200/90 cursor-pointer hover:text-purple-100 transition-colors line-clamp-2"
                                onClick={scrollToEditingMessage}
                                title="Click to scroll to message"
                            >
                                {editingMessage.content.length > 120
                                    ? editingMessage.content.substring(0, 120) +
                                      "..."
                                    : editingMessage.content}
                            </div>
                            <div className="text-xs text-purple-300/70 mt-2">
                                💡 Changes will create a new conversation branch
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages Container */}
            <div
                className="flex-1 overflow-y-auto px-4 space-y-6 scrollbar-thin scrollbar-thumb-purple-600/30 scrollbar-track-transparent"
                style={{ scrollBehavior: "smooth" }}
            >
                {messages.map((message, index) => {
                    const isLastAiMessage =
                        lastAiMessage && message._id === lastAiMessage._id;
                    const isCollapsed = collapsedMessages.has(message._id);
                    const isLongMessage = message.content.length > 100; // Threshold for showing collapse
                    const isOneLine =
                        message.content.split("\n").length === 1 &&
                        message.content.length <= 80;
                    const messageRenderMode = getMessageRenderMode(message._id);

                    return (
                        <div
                            key={message._id}
                            ref={isLastAiMessage ? lastAiMessageRef : undefined}
                            data-message-id={message._id}
                            className={`flex ${
                                message.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                            } message-enter ${
                                index === messages.length - 1 ? "mb-32" : ""
                            }`}
                        >
                            <div className="relative max-w-[85%]">
                                {/* Model Selector for Retry */}
                                {showRetryModelSelector === message._id && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                        <div className="w-full max-w-2xl mx-4">
                                            <ModelSelector
                                                selectedModel={
                                                    message.model ||
                                                    "gemini-2.0-flash"
                                                }
                                                onModelChange={(model) => {
                                                    if (onRetryMessage) {
                                                        void onRetryMessage(
                                                            message._id,
                                                            model
                                                        );
                                                        toast.success(
                                                            `Retrying with ${model}`
                                                        );
                                                    }
                                                    setShowRetryModelSelector(
                                                        null
                                                    );
                                                }}
                                                context="retry-message"
                                                openByDefault={true}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={`rounded-2xl px-4 py-3 group ${
                                        message.role === "user"
                                            ? "bg-gradient-to-r from-purple-600/30 to-pink-600/10 backdrop-blur-sm text-white"
                                            : "bg-transparent backdrop-blur-sm border border-purple-600/30 text-purple-100"
                                    } ${
                                        editingMessageId === message._id
                                            ? "ring-2 ring-purple-400/50 bg-purple-600/5 border-purple-600/40"
                                            : ""
                                    }`}
                                    onMouseEnter={() => {
                                        setHoveredMessageId(message._id);
                                        if (onMessageHover) {
                                            onMessageHover(message._id);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        // Reset all retry states when leaving message
                                        setHoveredMessageId(null);
                                        setShowRetryDropdown(null);
                                        setShowRetryModelSelector(null);
                                        if (
                                            showRetryModelSelector !==
                                            message._id
                                        ) {
                                            setHoveredMessageId(null);
                                            if (onMessageHover) {
                                                onMessageHover(null);
                                            }
                                        }
                                    }}
                                >
                                    {/* Edit Mode Indicator */}
                                    {editingMessageId === message._id && (
                                        <div className="mb-3 pb-3 border-b border-purple-600/30">
                                            <div className="flex items-center gap-2 text-sm text-purple-300">
                                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                                                <span className="font-medium">
                                                    This message is being edited
                                                    below
                                                </span>
                                                <span className="text-purple-400/80">
                                                    📝
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Message Header (for assistant messages) */}
                                    {message.role === "assistant" &&
                                        message.model &&
                                        !showCarouselForMessage && (
                                            <div className="text-xs text-purple-300 mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {message.metadata
                                                        ?.multiAIResponses ? (
                                                        <button
                                                            onClick={() =>
                                                                handleToggleMultiAICarousel(
                                                                    message._id
                                                                )
                                                            }
                                                            className="px-2 py-1 bg-gradient-to-r from-purple-600/30 to-blue-600/30 rounded flex items-center gap-2 hover:from-purple-600/40 hover:to-blue-600/40 transition-colors cursor-pointer"
                                                            title="Click to switch between AI responses"
                                                        >
                                                            <span>
                                                                {message.metadata.multiAIResponses.responses.find(
                                                                    (r) =>
                                                                        r.isPrimary
                                                                )?.model ||
                                                                    message.model}
                                                            </span>
                                                            <span className="text-xs bg-purple-600/20 px-1.5 py-0.5 rounded">
                                                                {message.metadata.multiAIResponses.responses.filter(
                                                                    (r) =>
                                                                        !r.isDeleted
                                                                ).length -
                                                                    1}{" "}
                                                                more
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-purple-600/30 rounded">
                                                            {message.model}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* AI Message Header Actions */}
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            toggleMessageRenderMode(
                                                                message._id
                                                            )
                                                        }
                                                        className="h-6 px-2 text-xs text-purple-300 hover:text-purple-100"
                                                        title={
                                                            messageRenderMode ===
                                                            "rendered"
                                                                ? "Show raw markdown"
                                                                : "Show formatted view"
                                                        }
                                                    >
                                                        {messageRenderMode ===
                                                        "rendered"
                                                            ? "Raw"
                                                            : "Formatted"}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                    {/* Message Content - No more textarea editing */}
                                    <div className="relative">
                                        {renderMessageMetadata(message)}

                                        {message.role === "assistant" &&
                                        (showCarouselForMessage ===
                                            message._id ||
                                            !message.metadata.multiAIResponses
                                                ?.primaryResponseId) ? (
                                            <MultiAIResponseCarousel
                                                messageId={message._id}
                                                responses={
                                                    message.metadata
                                                        .multiAIResponses
                                                        ?.responses || []
                                                }
                                                onPrimaryChange={(
                                                    _responseId
                                                ) => {
                                                    setShowCarouselForMessage(
                                                        null
                                                    );
                                                    toast.success(
                                                        "Primary response updated"
                                                    );
                                                }}
                                                onClose={() =>
                                                    setShowCarouselForMessage(
                                                        null
                                                    )
                                                }
                                            />
                                        ) : (
                                            <div
                                                className={`${
                                                    isCollapsed
                                                        ? "line-clamp-1 cursor-pointer pr-4"
                                                        : ""
                                                }`}
                                                onClick={() => {
                                                    if (
                                                        isCollapsed &&
                                                        isLongMessage
                                                    ) {
                                                        toggleMessageCollapse(
                                                            message._id
                                                        );
                                                    }
                                                }}
                                            >
                                                {/* Use MarkdownRenderer for all messages, streaming or not */}
                                                {messageRenderMode ===
                                                "rendered" ? (
                                                    <div className="relative">
                                                        <MarkdownRenderer
                                                            content={
                                                                // Show primary response content if multi-AI, otherwise regular content
                                                                message.metadata
                                                                    ?.multiAIResponses
                                                                    ? message.metadata.multiAIResponses.responses.find(
                                                                          (r) =>
                                                                              r.isPrimary
                                                                      )
                                                                          ?.content ||
                                                                      message.content
                                                                    : message.content ||
                                                                      ""
                                                            }
                                                            className="text-purple-100"
                                                            isStreaming={
                                                                message.isStreaming
                                                            }
                                                        />
                                                        {/* Streaming cursor */}
                                                        {message.isStreaming && (
                                                            <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1 align-middle" />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="whitespace-pre-wrap break-words font-mono text-sm rounded-lg p-3">
                                                        {message.metadata
                                                            ?.multiAIResponses
                                                            ? message.metadata.multiAIResponses.responses.find(
                                                                  (r) =>
                                                                      r.isPrimary
                                                              )?.content ||
                                                              message.content
                                                            : message.content ||
                                                              ""}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Check if message has navigator content to decide layout */}

                                        {message.attachments &&
                                            message.attachments.length > 0 && (
                                                <div className="mt-3">
                                                    <AttachmentPreview
                                                        attachments={
                                                            message.attachments
                                                        }
                                                        messageId={message._id}
                                                    />
                                                </div>
                                            )}

                                        {/* Always show navigator - simplified positioning */}
                                        <div className="mt-2 flex items-center justify-end">
                                            <MessageBranchNavigator
                                                messageId={message._id}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Message Icons on Hover - Bottom Right */}
                                {hoveredMessageId === message._id && (
                                    <div
                                        className={`absolute min-w-max ${
                                            message.role === "user"
                                                ? "-bottom-[2.55rem] bg-transparent"
                                                : "-bottom-10 bg-gray-900/80"
                                        } right-0 flex items-center gap-2 backdrop-blur-sm border border-purple-600/30 rounded-lg px-3 py-1.5 z-50`}
                                        onMouseEnter={() =>
                                            setHoveredMessageId(message._id)
                                        }
                                        onMouseLeave={() => {
                                            setHoveredMessageId(null);
                                        }}
                                    >
                                        {/* Timestamp */}
                                        <div className="flex items-center gap-1 text-purple-400">
                                            <Clock className="w-3 h-3" />
                                            <span className="text-xs">
                                                {formatTimestamp(
                                                    message.timestamp
                                                )}
                                            </span>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1 ml-1 border-l border-purple-600/30 pl-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    void handleCopy(
                                                        message.content
                                                    );
                                                }}
                                                className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                title="Copy message"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </Button>

                                            {message.role === "user" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        handleEdit(message)
                                                    }
                                                    className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                    title="Edit message"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                </Button>
                                            )}

                                            {message.role === "assistant" && (
                                                <div className="relative">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setShowRetryDropdown(
                                                                showRetryDropdown ===
                                                                    message._id
                                                                    ? null
                                                                    : message._id
                                                            )
                                                        }
                                                        className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                        title="Retry"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                    </Button>

                                                    {/* Simplified Retry Dropdown with only 2 options */}
                                                    {showRetryDropdown ===
                                                        message._id && (
                                                        <div className="absolute bottom-full -right-10 mb-2 w-[20rem] bg-gray-900/95 backdrop-blur-sm border border-purple-600/30 rounded-lg shadow-xl z-40 overflow-hidden">
                                                            <div className="p-2">
                                                                {/* Option 1: Retry with same model */}
                                                                {message.model && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (
                                                                                onRetryMessage &&
                                                                                message.model
                                                                            ) {
                                                                                void onRetryMessage(
                                                                                    message._id,
                                                                                    message.model
                                                                                );
                                                                                toast.success(
                                                                                    `Retrying with ${message.model}`
                                                                                );
                                                                            }
                                                                            setShowRetryDropdown(
                                                                                null
                                                                            );
                                                                        }}
                                                                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left mb-1"
                                                                    >
                                                                        <span className="flex-1">
                                                                            Retry
                                                                            with{" "}
                                                                            {
                                                                                message.model
                                                                            }
                                                                        </span>
                                                                        <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs">
                                                                            R
                                                                        </kbd>
                                                                    </button>
                                                                )}

                                                                {/* Option 2: Retry with different model */}
                                                                <button
                                                                    onClick={() => {
                                                                        setShowRetryDropdown(
                                                                            null
                                                                        );
                                                                        setShowRetryModelSelector(
                                                                            message._id
                                                                        );
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left"
                                                                >
                                                                    <span className="flex-1">
                                                                        Retry
                                                                        with
                                                                        different
                                                                        model
                                                                    </span>
                                                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs">
                                                                        Shift +
                                                                        R
                                                                    </kbd>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Edit button for AI messages (like Google AI Studio) */}
                                            {message.role === "assistant" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        handleEdit(message)
                                                    }
                                                    className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                    title="Edit AI message"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                </Button>
                                            )}

                                            {/* Collapse/Expand button - 4th action button for long messages */}
                                            {isLongMessage && !isOneLine && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        toggleMessageCollapse(
                                                            message._id
                                                        )
                                                    }
                                                    className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                    title={
                                                        isCollapsed
                                                            ? "Expand message"
                                                            : "Collapse message"
                                                    }
                                                >
                                                    {isCollapsed ? (
                                                        <ChevronDown className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronUp className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            )}

                                            {/* Enhanced Deep Link Dropdown - 5th action button with 2 options */}
                                            <div className="relative">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setShowDeepLinkDropdown(
                                                            showDeepLinkDropdown ===
                                                                message._id
                                                                ? null
                                                                : message._id
                                                        )
                                                    }
                                                    className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                    title="Copy message link"
                                                >
                                                    <Link className="w-3 h-3" />
                                                </Button>

                                                {/* Enhanced Deep Link Dropdown - matching glassmorphism design */}
                                                {showDeepLinkDropdown ===
                                                    message._id && (
                                                    <div className="absolute bottom-full -right-10 mb-2 w-[20rem] bg-gray-900/95 backdrop-blur-sm border border-purple-600/30 rounded-lg shadow-xl z-40 overflow-hidden">
                                                        <div className="p-2">
                                                            {/* Option 1: Direct message link */}
                                                            <button
                                                                onClick={() => {
                                                                    void handleCopyMessageLink(
                                                                        message._id
                                                                    );
                                                                    setShowDeepLinkDropdown(
                                                                        null
                                                                    );
                                                                }}
                                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left mb-1"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Link className="w-4 h-4 text-purple-400" />
                                                                    <span>
                                                                        Copy
                                                                        direct
                                                                        link
                                                                    </span>
                                                                </div>
                                                                <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs">
                                                                    L
                                                                </kbd>
                                                            </button>

                                                            {/* Option 2: Shared message link */}
                                                            <button
                                                                onClick={() => {
                                                                    void handleCreateSharedMessageLink(
                                                                        message._id
                                                                    );
                                                                    setShowDeepLinkDropdown(
                                                                        null
                                                                    );
                                                                }}
                                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <ExternalLink className="w-4 h-4 text-purple-400" />
                                                                    <span>
                                                                        Create
                                                                        shared
                                                                        link
                                                                    </span>
                                                                </div>
                                                                <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs">
                                                                    Shift+L
                                                                </kbd>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {message.role === "user" && (
                                                <div className="relative">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setShowDeleteDropdown(
                                                                showDeleteDropdown ===
                                                                    message._id
                                                                    ? null
                                                                    : message._id
                                                            )
                                                        }
                                                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                                        title="Delete options"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>

                                                    {/* Enhanced Delete Dropdown - matching glassmorphism design */}
                                                    {showDeleteDropdown ===
                                                        message._id && (
                                                        <div className="absolute bottom-full -right-10 mb-2 w-[22rem] bg-gray-900/95 backdrop-blur-sm border border-purple-600/30 rounded-lg shadow-xl z-40 overflow-hidden">
                                                            <div className="p-2">
                                                                {/* Option 1: Delete this message only */}
                                                                <button
                                                                    onClick={() => {
                                                                        void handleDeleteMessage(
                                                                            message._id
                                                                        );
                                                                        setShowDeleteDropdown(
                                                                            null
                                                                        );
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-red-600/20 rounded-lg transition-colors text-left mb-1"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <Trash className="w-4 h-4 text-red-400" />
                                                                        <span className="flex-1">
                                                                            Delete
                                                                            this
                                                                            message
                                                                        </span>
                                                                    </div>
                                                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs">
                                                                        Del
                                                                    </kbd>
                                                                </button>

                                                                {/* Option 2: Delete all from here */}
                                                                <button
                                                                    onClick={() => {
                                                                        void handleDeleteAllFromHere(
                                                                            message._id
                                                                        );
                                                                        setShowDeleteDropdown(
                                                                            null
                                                                        );
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-red-600/20 rounded-lg transition-colors text-left mb-1"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <MoreVertical className="w-4 h-4 text-red-400" />
                                                                        <span className="flex-1">
                                                                            Delete
                                                                            all
                                                                            from
                                                                            here
                                                                        </span>
                                                                    </div>
                                                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs">
                                                                        Shift+Del
                                                                    </kbd>
                                                                </button>

                                                                {/* Option 3: Delete all after this */}
                                                                <button
                                                                    onClick={() => {
                                                                        void handleDeleteAllAfter(
                                                                            message._id
                                                                        );
                                                                        setShowDeleteDropdown(
                                                                            null
                                                                        );
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-red-600/20 rounded-lg transition-colors text-left"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <ChevronDown className="w-4 h-4 text-red-400" />
                                                                        <span className="flex-1">
                                                                            Delete
                                                                            all
                                                                            after
                                                                            this
                                                                        </span>
                                                                    </div>
                                                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded text-xs">
                                                                        Ctrl+Del
                                                                    </kbd>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
