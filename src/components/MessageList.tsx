import { Dispatch, SetStateAction, useState, useRef, useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { AttachmentPreview } from "./AttachmentPreview";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { StreamingMessage } from "./StreamingMessage";
import { ScrollToBottom } from "./ScrollToBottom";
import { MessageBranchNavigator } from "./MessageBranchNavigator";
import { Button } from "./ui/button";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useResumableStreaming } from "../hooks/useResumableStreaming";
import {
    Edit3,
    Copy,
    RotateCcw,
    Check,
    X,
    GitBranch,
    Mic,
    Image,
    ExternalLink,
    Search,
    ChevronDown,
    ChevronRight,
    Trash2,
    Clock,
    Video,
    Palette,
    RefreshCw,
    Wifi,
    WifiOff,
} from "lucide-react";
import { toast } from "sonner";

interface Message {
    _id: Id<"messages">;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    model?: string;
    isStreaming?: boolean;
    attachments?: Array<{
        type: "image" | "pdf" | "file" | "audio";
        storageId: Id<"_storage">;
        name: string;
        size: number;
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
        audioTranscription?: string;
        videoPrompt?: string;
        generatedVideoUrl?: string;
        videoThumbnailUrl?: string;
        videoDuration?: string;
        videoResolution?: string;
    };
}

interface MessageListProps {
    messages: Message[];
    onEditMessage?: (
        messageId: Id<"messages">,
        newContent: string
    ) => Promise<void> | void;
    onRetryMessage?: (messageId: Id<"messages">) => Promise<void> | void;
    onBranchFromMessage?: (
        messageId: Id<"messages">,
        newContent: string
    ) => Promise<void> | void;
    onPrefill: (prompText: string) => void;
    onMessageHover?: (messageId: Id<"messages"> | null) => void;
    setSelectedChatId: Dispatch<SetStateAction<Id<"chats"> | null>>;
}

export function MessageList({
    messages,
    onEditMessage,
    onRetryMessage,
    onBranchFromMessage,
    onPrefill: _onPrefill,
    onMessageHover,
    setSelectedChatId,
}: MessageListProps) {
    const [editingMessageId, setEditingMessageId] =
        useState<Id<"messages"> | null>(null);
    const [editContent, setEditContent] = useState("");
    // Per-message render state instead of global
    const [messageRenderModes, setMessageRenderModes] = useState<
        Record<string, "rendered" | "raw">
    >({});
    const [collapsedMessages, setCollapsedMessages] = useState<
        Set<Id<"messages">>
    >(new Set());
    const [hoveredMessageId, setHoveredMessageId] =
        useState<Id<"messages"> | null>(null);
    const [showRetryModels, setShowRetryModels] =
        useState<Id<"messages"> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize mutations at the top level to avoid hooks order issues
    const deleteMessage = useMutation(api.messages.deleteMessage);
    const forkChat = useMutation(api.chats.forkChatFromMessage);

    // Available models for retry
    const availableModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI" },
        {
            id: "gemini-1.5-pro",
            name: "Gemini 1.5 Pro",
            provider: "Google",
        },
        {
            id: "gemini-1.5-flash",
            name: "Gemini 1.5 Flash",
            provider: "Google",
        },
        {
            id: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
            provider: "Anthropic",
        },
        {
            id: "claude-3-5-haiku-20241022",
            name: "Claude 3.5 Haiku",
            provider: "Anthropic",
        },
        { id: "deepseek-chat", name: "DeepSeek Chat", provider: "DeepSeek" },
        { id: "deepseek-coder", name: "DeepSeek Coder", provider: "DeepSeek" },
    ];

    // Extract last message content to satisfy React Hook dependency array requirements
    const lastMessageContent =
        messages.length > 0 ? messages[messages.length - 1]?.content : "";

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

    // Improved auto-scroll logic
    useEffect(() => {
        if (containerRef.current && messages.length > 0) {
            const container = containerRef.current;
            const { scrollHeight, clientHeight, scrollTop } = container;

            // Always scroll to bottom on initial load or when switching chats
            // Check if we're near the bottom (within 150px) or if it's the first render
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
            const shouldAutoScroll = isNearBottom || scrollTop === 0;

            if (shouldAutoScroll) {
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(() => {
                    if (containerRef.current) {
                        containerRef.current.scrollTo({
                            top: containerRef.current.scrollHeight,
                            behavior: scrollTop === 0 ? "instant" : "smooth",
                        });
                    }
                });
            }
        }
    }, [messages.length, lastMessageContent]);

    // Force scroll to bottom when component mounts or chat changes
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: "instant",
            });
        }
    }, []);

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

        const handleRetryMessage = (e: CustomEvent) => {
            const { messageId } = e.detail;

            setShowRetryModels(
                showRetryModels === messageId ? null : messageId
            );
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

        document.addEventListener(
            "editMessage",
            handleEditMessage as EventListener
        );
        document.addEventListener(
            "forkFromMessage",
            handleForkFromMessage as EventListener
        );
        document.addEventListener(
            "retryMessage",
            handleRetryMessage as EventListener
        );
        document.addEventListener(
            "navigateBranch",
            handleNavigateBranch as EventListener
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
                "retryMessage",
                handleRetryMessage as EventListener
            );
            document.removeEventListener(
                "navigateBranch",
                handleNavigateBranch as EventListener
            );
        };
    }, [messages, onBranchFromMessage, handleForkChat, showRetryModels]);

    const handleEdit = (message: Message) => {
        setEditingMessageId(message._id);
        setEditContent(message.content);
    };

    const handleSaveEdit = (createBranch = false) => {
        if (editingMessageId && editContent.trim()) {
            if (createBranch && onBranchFromMessage) {
                void onBranchFromMessage(editingMessageId, editContent);
                toast.success("Created new conversation branch");
            } else if (onEditMessage) {
                void onEditMessage(editingMessageId, editContent);
                toast.success("Message updated");
            }
            setEditingMessageId(null);
            setEditContent("");
        }
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditContent("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSaveEdit(true); // Create branch on Ctrl+Enter
        } else if (e.key === "Escape") {
            handleCancelEdit();
        }
    };

    const handleCopy = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            toast.success("Copied to clipboard!");
        } catch {
            toast.error("Failed to copy to clipboard");
        }
    };

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
                {message.metadata.audioTranscription && (
                    <div className="flex items-center gap-2 text-sm text-purple-400 bg-purple-600/10 rounded-lg p-3 border border-purple-500/20">
                        <Mic className="w-4 h-4" />
                        <span>
                            Transcribed: "{message.metadata.audioTranscription}"
                        </span>
                    </div>
                )}

                {/* Generated image display */}
                {message.metadata.generatedImageUrl && (
                    <div className="my-4">
                        <div className="text-sm text-purple-400 mb-2 flex items-center gap-2">
                            <Image className="w-4 h-4" />
                            Generated image: "{message.metadata.imagePrompt}"
                        </div>
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
                    </div>
                )}

                {/* Generated video display */}
                {message.metadata.generatedVideoUrl && (
                    <div className="my-4">
                        <div className="text-sm text-purple-400 mb-2 flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Generated video: "{message.metadata.videoPrompt}"
                        </div>
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
                                        message.metadata.videoResolution && (
                                            <span className="mx-1">•</span>
                                        )}
                                    {message.metadata.videoResolution && (
                                        <span>
                                            {message.metadata.videoResolution}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Canvas Artifacts Display */}
                {message.metadata?.structuredOutput && (
                    <div className="my-4">
                        <div className="text-sm text-purple-400 mb-3 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            Canvas Artifacts:
                        </div>
                        {/* This will be populated by the parent component with actual artifacts */}
                        <div className="space-y-2">
                            <div className="text-xs text-purple-500 bg-purple-600/10 px-3 py-2 rounded border border-purple-500/20">
                                💡 Artifacts created - check the Canvas sidebar
                                to view and edit them
                            </div>
                        </div>
                    </div>
                )}

                {/* Web search results - REMOVED: Replace with new citations display */}
                {/* This old searchResults display is replaced by the new citations system */}
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

    const closeRetryModels = () => {
        if (showRetryModels) {
            setShowRetryModels(null);
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

    return (
        <div className="relative h-full" onClick={closeRetryModels}>
            <div
                ref={containerRef}
                className="flex-1 flex flex-col p-4 gap-y-6 overflow-y-auto"
            >
                {messages.map((message, index) => {
                    const isCollapsed = collapsedMessages.has(message._id);
                    const isLongMessage = message.content.length > 100; // Threshold for showing collapse
                    const isOneLine =
                        message.content.split("\n").length === 1 &&
                        message.content.length <= 80;
                    const messageRenderMode = getMessageRenderMode(message._id);

                    return (
                        <div
                            key={message._id}
                            data-message-id={message._id} // Add ID attribute for scroll navigation
                            className={`flex ${
                                message.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                            } message-enter ${
                                index === messages.length - 1 ? "mb-32" : ""
                            }`}
                        >
                            <div className="relative max-w-[85%]">
                                <div
                                    className={`rounded-2xl px-4 pt-3 group ${
                                        message.role === "user"
                                            ? "bg-gradient-to-r from-purple-600/30 to-pink-600/10 backdrop-blur-sm text-white"
                                            : "bg-transparent backdrop-blur-sm border border-purple-600/30 text-purple-100"
                                    }`}
                                    onMouseEnter={() => {
                                        setHoveredMessageId(message._id);
                                        if (onMessageHover) {
                                            onMessageHover(message._id);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        if (showRetryModels !== message._id) {
                                            setHoveredMessageId(null);
                                            if (onMessageHover) {
                                                onMessageHover(null);
                                            }
                                        }
                                    }}
                                >
                                    {/* Message Header (for assistant messages) */}
                                    {message.role === "assistant" &&
                                        message.model && (
                                            <div className="text-xs text-purple-300 mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 bg-purple-600/30 rounded">
                                                        {message.model}
                                                    </span>
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

                                    {/* Message Content */}
                                    {editingMessageId === message._id ? (
                                        <div className="space-y-3">
                                            <div className="text-sm text-center text-orange-300 mb-2 p-3 bg-orange-600/10 rounded border border-orange-600/20">
                                                💡 Editing this message will
                                                create a new conversation branch
                                                starting from this point of the
                                                conversation. You can switch
                                                between branches using the
                                                navigation arrows.
                                            </div>
                                            <textarea
                                                value={editContent}
                                                onChange={(e) =>
                                                    setEditContent(
                                                        e.target.value
                                                    )
                                                }
                                                onKeyDown={handleKeyDown}
                                                className="w-full min-h-[100px] p-3 bg-purple-500/10 border border-purple-400/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:border-purple-400 resize-none"
                                                placeholder="Edit your message... (Enter to save, Ctrl+Enter to save and branch, Shift+Enter for new line)"
                                                autoFocus
                                            />
                                            <div className="flex items-center gap-1 text-xs text-purple-400">
                                                <span className="flex items-center gap-1">
                                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded">
                                                        Ctrl+Enter
                                                    </kbd>
                                                    <span>
                                                        to save and branch
                                                    </span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded">
                                                        Esc
                                                    </kbd>
                                                    <span>to cancel</span>
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleSaveEdit(true)
                                                    }
                                                >
                                                    <Check className="w-3 h-3 mr-1" />
                                                    Save & Branch
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleCancelEdit}
                                                >
                                                    <X className="w-3 h-3 mr-1" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {renderMessageMetadata(message)}

                                            <div
                                                className={`${
                                                    isCollapsed
                                                        ? "line-clamp-1 cursor-pointer"
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
                                                {/* Use StreamingMessage for streaming messages, regular MarkdownRenderer for static messages */}
                                                {message.isStreaming ? (
                                                    <StreamingMessage
                                                        messageId={message._id}
                                                        initialContent={message.content}
                                                        className="text-purple-100"
                                                        onStreamingComplete={() => {
                                                            // Force re-render when streaming completes
                                                            // This will be handled by the parent component's query
                                                        }}
                                                    />
                                                ) : messageRenderMode === "rendered" ? (
                                                    <MarkdownRenderer
                                                        content={message.content || ""}
                                                        className="text-purple-100"
                                                        isStreaming={false}
                                                    />
                                                ) : (
                                                    <div className="whitespace-pre-wrap break-words font-mono text-sm rounded-lg p-3">
                                                        {message.content || ""}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Collapse/Expand arrow for long messages - only show on hover and NOT for one-line messages */}
                                            {isLongMessage &&
                                                !isOneLine &&
                                                hoveredMessageId ===
                                                    message._id && (
                                                    <button
                                                        onClick={() =>
                                                            toggleMessageCollapse(
                                                                message._id
                                                            )
                                                        }
                                                        className="absolute top-3 right-3 p-1 rounded-full bg-purple-600/20 hover:bg-purple-600/40 transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                        title={
                                                            isCollapsed
                                                                ? "Expand message"
                                                                : "Collapse message"
                                                        }
                                                    >
                                                        {isCollapsed ? (
                                                            <ChevronDown className="w-4 h-4 text-purple-300" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-purple-300" />
                                                        )}
                                                    </button>
                                                )}

                                            {message.attachments &&
                                                message.attachments.length >
                                                    0 && (
                                                    <div className="mt-3">
                                                        <AttachmentPreview
                                                            attachments={
                                                                message.attachments
                                                            }
                                                        />
                                                    </div>
                                                )}

                                            <div className="flex items-center justify-between mt-2">
                                                <MessageBranchNavigator
                                                    messageId={message._id}
                                                    className="mt-3"
                                                />
                                            </div>

                                            {/* Source Citations - Display at end of AI responses */}
                                            {message.role === "assistant" &&
                                                !message.isStreaming &&
                                                (() => {
                                                    const citations =
                                                        extractCitations(
                                                            message.content,
                                                            message.metadata
                                                                ?.citations
                                                        );
                                                    if (!citations) return null;

                                                    return (
                                                        <div className="mt-4 pt-4 border-t border-purple-600/20">
                                                            <div className="text-sm text-purple-400 mb-3 flex items-center gap-2">
                                                                <Search className="w-4 h-4" />
                                                                <span className="font-medium">
                                                                    Sources
                                                                </span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {citations.map(
                                                                    (
                                                                        citation,
                                                                        index
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                index
                                                                            }
                                                                            className="group flex items-center gap-3 p-3 bg-gradient-to-r from-purple-600/5 to-purple-500/5 border border-purple-600/20 rounded-lg hover:border-purple-500/40 hover:from-purple-600/10 hover:to-purple-500/10 transition-all duration-200"
                                                                        >
                                                                            {/* Citation Number */}
                                                                            <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                                                {
                                                                                    citation.number
                                                                                }
                                                                            </div>

                                                                            {/* Citation Content */}
                                                                            <div className="flex-1 min-w-0">
                                                                                <a
                                                                                    href={
                                                                                        citation.url
                                                                                    }
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="block group-hover:text-purple-200 transition-colors"
                                                                                >
                                                                                    <div className="text-purple-100 font-medium text-sm line-clamp-1 group-hover:text-white transition-colors">
                                                                                        {
                                                                                            citation.title
                                                                                        }
                                                                                    </div>
                                                                                    <div className="text-purple-400 text-xs mt-1 truncate">
                                                                                        {
                                                                                            citation.url
                                                                                        }
                                                                                    </div>
                                                                                </a>
                                                                            </div>

                                                                            {/* Source Badge & External Link */}
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
                                                                                    {
                                                                                        citation.source
                                                                                    }
                                                                                </span>
                                                                                <ExternalLink className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                        </div>
                                    )}
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
                                            if (
                                                showRetryModels !== message._id
                                            ) {
                                                setHoveredMessageId(null);
                                            }
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
                                                            setShowRetryModels(
                                                                showRetryModels ===
                                                                    message._id
                                                                    ? null
                                                                    : message._id
                                                            )
                                                        }
                                                        className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                        title="Retry with different model"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                    </Button>

                                                    {showRetryModels ===
                                                        message._id && (
                                                        <div className="absolute bottom-full -right-10 mb-2 w-[17rem] bg-gray-900/95 backdrop-blur-sm border border-purple-600/30 rounded-lg shadow-xl z-40 overflow-hidden">
                                                            <div className="p-2">
                                                                <div className="text-xs text-orange-300 mb-2 p-2 bg-orange-600/10 rounded border border-orange-600/20">
                                                                    ⚠️ Messages
                                                                    after this
                                                                    point will
                                                                    be lost
                                                                </div>
                                                                {message.model && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (
                                                                                onRetryMessage
                                                                            )
                                                                                onRetryMessage(
                                                                                    message._id
                                                                                );
                                                                            setShowRetryModels(
                                                                                null
                                                                            );
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left"
                                                                    >
                                                                        <span className="flex-1">
                                                                            {
                                                                                message.model
                                                                            }
                                                                        </span>
                                                                        <span className="text-xs text-purple-400">
                                                                            Same
                                                                            model
                                                                        </span>
                                                                    </button>
                                                                )}
                                                                <div className="border-t border-purple-600/20 my-1"></div>
                                                                {availableModels
                                                                    .filter(
                                                                        (
                                                                            model
                                                                        ) =>
                                                                            model.id !==
                                                                            message.model
                                                                    )
                                                                    .map(
                                                                        (
                                                                            model
                                                                        ) => (
                                                                            <button
                                                                                key={
                                                                                    model.id
                                                                                }
                                                                                onClick={() => {
                                                                                    if (
                                                                                        onRetryMessage
                                                                                    )
                                                                                        onRetryMessage(
                                                                                            message._id
                                                                                        );
                                                                                    setShowRetryModels(
                                                                                        null
                                                                                    );
                                                                                    toast.success(
                                                                                        `Retrying with ${model.name}`
                                                                                    );
                                                                                }}
                                                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left"
                                                                            >
                                                                                <span>
                                                                                    {
                                                                                        model.name
                                                                                    }
                                                                                </span>
                                                                                <span className="text-xs text-purple-400">
                                                                                    {
                                                                                        model.provider
                                                                                    }
                                                                                </span>
                                                                            </button>
                                                                        )
                                                                    )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {message.role === "assistant" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        void handleForkChat(
                                                            message._id
                                                        );
                                                    }}
                                                    className="h-6 w-6 p-0 text-purple-300 hover:text-purple-100"
                                                    title="Fork conversation from here"
                                                >
                                                    <GitBranch className="w-3 h-3" />
                                                </Button>
                                            )}

                                            {message.role === "user" && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        void handleDeleteMessage(
                                                            message._id
                                                        );
                                                    }}
                                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                                    title="Delete message"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <ScrollToBottom containerRef={containerRef} />
        </div>
    );
}
