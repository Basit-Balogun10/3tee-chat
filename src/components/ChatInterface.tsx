import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { ChatArea } from "./ChatArea";
import { RightSidebar } from "./RightSidebar";
import { ShareMenu } from "./ShareMenu";
import { SettingsModal } from "./SettingsModal";
import { ThemeToggle } from "./ThemeToggle";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { WelcomeTour } from "./WelcomeTour";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Edit3, Menu, PanelRight } from "lucide-react";
import { toast } from "sonner";

export function ChatInterface() {
    // React Router hooks for URL management
    const {
        chatId: urlChatId,
        projectId: _urlProjectId,
        shareId: _urlShareId,
    } = useParams<{
        chatId?: string;
        projectId?: string;
        shareId?: string;
    }>();
    const navigate = useNavigate();

    // Define types outside of useState to avoid complex generic parsing
    type ChatId = Id<"chats"> | null;
    type SharedContentType = "chat" | "project" | null;

    const [selectedChatId, setSelectedChatId] = useState<ChatId>(null);
    // Add shared content state for Phase 3.3(b)
    const [isSharedContent, setIsSharedContent] = useState(false);
    const [_sharedContentType, setSharedContentType] =
        useState<SharedContentType>(null);

    const [sidebarOpen, setSidebarOpen] = useLocalStorage("sidebarOpen", true);
    const [rightSidebarOpen, setRightSidebarOpen] = useLocalStorage(
        "rightSidebarOpen",
        false
    );
    const [rightSidebarMode, setRightSidebarMode] = useLocalStorage<
        "navigation" | "canvas"
    >("rightSidebarMode", "navigation");
    const [activeArtifactId, setActiveArtifactId] = useState<
        string | undefined
    >();
    const [showSettings, setShowSettings] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [hasSeenTour, setHasSeenTour] = useLocalStorage("hasSeenTour", false);
    const [lastSelectedChatId, setLastSelectedChatId] = useLocalStorage<
        string | null
    >("lastSelectedChatId", null);
    const [showTour, setShowTour] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [isCreatingInitialChat, setIsCreatingInitialChat] = useState(false);

    const [showMessageInput, setShowMessageInput] = useLocalStorage(
        "showMessageInput",
        true
    );
    const [showHeader, setShowHeader] = useLocalStorage("showHeader", true);
    const [zenMode, setZenMode] = useLocalStorage("zenMode", false);

    const chats = useQuery(api.chats.listChats);
    const preferences = useQuery(api.preferences.getUserPreferences);
    // Add shared content query
    const sharedContent = useQuery(api.sharing.getUserSharedContent);
    // Add cleanup mutation for Phase 3.5
    const cleanupSharedContent = useMutation(api.sharing.cleanupSharedContent);
    const selectedChat = useQuery(
        api.chats.getChat,
        selectedChatId ? { chatId: selectedChatId } : "skip"
    );
    const messagesResult = useQuery(
        api.chats.getChatMessages,
        selectedChatId ? { chatId: selectedChatId } : "skip"
    );
    const createChat = useMutation(api.chats.createChat);
    const updateChatTitle = useMutation(api.chats.updateChatTitle);

    // Mock artifacts for now - in real implementation, these would come from the backend
    const artifacts = [
        {
            id: "artifact-1",
            title: "React Component Example",
            description: "A sample React component with TypeScript",
            content: `import React from 'react';\n\ninterface Props {\n  title: string;\n  children: React.ReactNode;\n}\n\nexport function Card({ title, children }: Props) {\n  return (\n    <div className="card">\n      <h2>{title}</h2>\n      <div className="content">\n        {children}\n      </div>\n    </div>\n  );\n}`,
            language: "typescript",
            filename: "Card.tsx",
            type: "code" as const,
        },
        {
            id: "artifact-2",
            title: "Documentation",
            description: "Project documentation in markdown",
            content: `# My Project\n\nThis is a sample project documentation.\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\nDescribe how to use your project here.`,
            language: "markdown",
            filename: "README.md",
            type: "markdown" as const,
        },
    ];

    // Handle scroll to message functionality
    const handleScrollToMessage = useCallback((messageId: Id<"messages">) => {
        const messageElement = document.querySelector(
            `[data-message-id="${messageId}"]`
        );
        if (messageElement) {
            messageElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
            // Add a highlight effect
            messageElement.classList.add("highlight-message");
            setTimeout(() => {
                messageElement.classList.remove("highlight-message");
            }, 2000);
        }
    }, []);

    // Handle artifact selection
    const handleSelectArtifact = useCallback(
        (artifactId: string) => {
            setActiveArtifactId(artifactId);
            setRightSidebarMode("canvas");
            setRightSidebarOpen(true);
        },
        [setRightSidebarMode, setRightSidebarOpen]
    );

    // Handle right sidebar mode change
    const handleRightSidebarModeChange = useCallback(
        (mode: "navigation" | "canvas") => {
            setRightSidebarMode(mode);
            // Reset canvas width when switching to navigation mode
            if (mode === "navigation") {
                localStorage.removeItem("canvasWidth");
            }
        },
        [setRightSidebarMode]
    );

    const handleNewChat = useCallback(async () => {
        const defaultModel = preferences?.defaultModel || "gpt-4o-mini";

        const chatId = await createChat({
            title: "New Chat",
            model: defaultModel,
        });
        setSelectedChatId(chatId);
        setLastSelectedChatId(chatId);
        // Navigate to the new chat URL
        void navigate(`/chat/${chatId}`);
        return chatId;
    }, [
        preferences?.defaultModel,
        createChat,
        setLastSelectedChatId,
        navigate,
    ]);

    // Update localStorage and URL when selectedChatId changes
    const handleSelectChat = useCallback(
        (chatId: Id<"chats">) => {
            setSelectedChatId(chatId);
            setLastSelectedChatId(chatId);
            // Update the browser URL
            void navigate(`/chat/${chatId}`);
        },
        [setLastSelectedChatId, navigate]
    );

    // Chat title editing handlers
    const handleStartEditTitle = useCallback(() => {
        if (selectedChat) {
            setEditTitle(selectedChat.title);
            setIsEditingTitle(true);
        }
    }, [selectedChat]);

    const handleCancelEditTitle = useCallback(() => {
        setIsEditingTitle(false);
        setEditTitle("");
    }, []);

    const handleSaveEditTitle = useCallback(async () => {
        if (selectedChat && editTitle.trim()) {
            try {
                await updateChatTitle({
                    chatId: selectedChat._id,
                    title: editTitle.trim(),
                });
                setIsEditingTitle(false);
                setEditTitle("");
                toast.success("Chat title updated");
            } catch (error) {
                console.error("Failed to update chat title:", error);
                toast.error("Failed to update chat title");
            }
        }
    }, [selectedChat, editTitle, updateChatTitle]);

    const handleTitleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                void handleSaveEditTitle();
            } else if (e.key === "Escape") {
                handleCancelEditTitle();
            }
        },
        [handleSaveEditTitle, handleCancelEditTitle]
    );

    // Handle export and share events from keyboard shortcuts
    useEffect(() => {
        const handleExportMarkdown = (e: Event) => {
            const { chatId: _chatId } = (e as CustomEvent).detail;
            void (async () => {
                try {
                    if (!selectedChatId) return;

                    // Get the ShareMenu component instance and trigger its export function
                    const chat = selectedChat;
                    const messages = messagesResult || [];

                    if (!chat || !messages.length) {
                        toast.error("No messages to export");
                        return;
                    }

                    const chatTitle = chat.title || "Chat Export";
                    const timestamp = new Date().toLocaleDateString();

                    let markdown = `# ${chatTitle}\n\n`;
                    markdown += `*Exported on ${timestamp}*\n\n`;
                    markdown += `**Model:** ${chat.model}\n\n`;
                    markdown += `---\n\n`;

                    messages.forEach((message, index) => {
                        const role =
                            message.role === "user"
                                ? "👤 **You**"
                                : "🤖 **Assistant**";
                        const time = new Date(
                            message.timestamp
                        ).toLocaleTimeString();

                        markdown += `## ${role} *(${time})*\n\n`;

                        if (
                            message.attachments &&
                            message.attachments.length > 0
                        ) {
                            markdown += `📎 **Attachments:**\n`;
                            message.attachments.forEach((attachment) => {
                                markdown += `- ${attachment.name} (${attachment.type})\n`;
                            });
                            markdown += `\n`;
                        }

                        markdown += `${message.content}\n\n`;

                        if (index < messages.length - 1) {
                            markdown += `---\n\n`;
                        }
                    });

                    const filename = `${chatTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.md`;
                    const blob = new Blob([markdown], {
                        type: "text/markdown",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    toast.success("Chat exported as Markdown!");
                } catch (error) {
                    console.error("Failed to export markdown:", error);
                    toast.error("Failed to export chat");
                }
            })();
        };

        const handleExportJSON = (e: Event) => {
            const { chatId: _chatId } = (e as CustomEvent).detail;
            void (async () => {
                try {
                    if (!selectedChatId) return;

                    const chat = selectedChat;
                    const messages = messagesResult || [];

                    if (!chat || !messages.length) {
                        toast.error("No messages to export");
                        return;
                    }

                    const exportData = {
                        chat: {
                            id: selectedChatId,
                            title: chat.title,
                            model: chat.model,
                            createdAt: chat._creationTime,
                            updatedAt: chat.updatedAt,
                            exportedAt: new Date().toISOString(),
                        },
                        messages: messages.map((message) => ({
                            id: message._id,
                            role: message.role,
                            content: message.content,
                            timestamp: message.timestamp,
                            model: message.model,
                            attachments: message.attachments,
                            metadata: message.metadata,
                        })),
                        statistics: {
                            totalMessages: messages.length,
                            userMessages: messages.filter(
                                (m) => m.role === "user"
                            ).length,
                            assistantMessages: messages.filter(
                                (m) => m.role === "assistant"
                            ).length,
                            totalCharacters: messages.reduce(
                                (sum, m) => sum + m.content.length,
                                0
                            ),
                        },
                    };

                    const jsonString = JSON.stringify(exportData, null, 2);
                    const filename = `${chat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.json`;
                    const blob = new Blob([jsonString], {
                        type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    toast.success("Chat exported as JSON!");
                } catch (error) {
                    console.error("Failed to export JSON:", error);
                    toast.error("Failed to export chat");
                }
            })();
        };

        const handleShareChat = (e: Event) => {
            const { chatId: _chatId } = (e as CustomEvent).detail;
            void (async () => {
                try {
                    const shareUrl = `${window.location.origin}/chat/${_chatId}`;
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Share link copied to clipboard!");
                } catch (error) {
                    console.error("Failed to share chat:", error);
                    toast.error("Failed to share chat");
                }
            })();
        };

        const handleShareReadOnly = (e: Event) => {
            const { chatId } = (e as CustomEvent).detail;
            // Trigger ShareModal to open in read-only mode
            const openShareModalEvent = new CustomEvent("openShareModal", {
                detail: { chatId, mode: "read-only" },
            });
            document.dispatchEvent(openShareModalEvent);
        };

        const handleShareCollaboration = (e: Event) => {
            const { chatId } = (e as CustomEvent).detail;
            // Trigger ShareModal to open in collaboration mode
            const openShareModalEvent = new CustomEvent("openShareModal", {
                detail: { chatId, mode: "collaboration" },
            });
            document.dispatchEvent(openShareModalEvent);
        };

        const handleOpenShareModal = (e: Event) => {
            const { chatId, mode } = (e as CustomEvent).detail;
            // Set the share modal data and open it
            if (chatId && selectedChatId === chatId) {
                // Create a ShareModal instance if needed
                // For now, dispatch to ShareMenu to handle
                const shareMenuEvent = new CustomEvent(
                    "openShareModalFromMenu",
                    {
                        detail: { chatId, mode },
                    }
                );
                document.dispatchEvent(shareMenuEvent);
            }
        };

        document.addEventListener("exportMarkdown", handleExportMarkdown);
        document.addEventListener("exportJSON", handleExportJSON);
        document.addEventListener("shareChat", handleShareChat);
        document.addEventListener("shareReadOnly", handleShareReadOnly);
        document.addEventListener(
            "shareCollaboration",
            handleShareCollaboration
        );
        document.addEventListener("openShareModal", handleOpenShareModal);

        return () => {
            document.removeEventListener(
                "exportMarkdown",
                handleExportMarkdown
            );
            document.removeEventListener("exportJSON", handleExportJSON);
            document.removeEventListener("shareChat", handleShareChat);
            document.removeEventListener("shareReadOnly", handleShareReadOnly);
            document.removeEventListener(
                "shareCollaboration",
                handleShareCollaboration
            );
            document.removeEventListener(
                "openShareModal",
                handleOpenShareModal
            );
        };
    }, [selectedChatId, selectedChat, messagesResult]);

    // Comprehensive keyboard shortcuts (avoiding browser conflicts)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip shortcuts if user is typing in an input/textarea or if a modal is open
            const isTyping =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement)?.isContentEditable;

            const hasModifier = e.metaKey || e.ctrlKey;

            // Shift + modifier combinations for chat actions (memorable and safe)
            if (hasModifier && e.shiftKey) {
                switch (e.key) {
                    case "B":
                        // Cmd/Ctrl + Shift + B for toggle sidebar (B = Bar/sidebar)
                        e.preventDefault();
                        e.stopPropagation();
                        setSidebarOpen(!sidebarOpen);
                        return;

                    case "F": {
                        // Cmd/Ctrl + Shift + F for focus search (F = Find)
                        e.preventDefault();
                        e.stopPropagation();
                        const focusSearchEvent = new CustomEvent(
                            "focusSearch",
                            {
                                detail: { openSidebarFirst: !sidebarOpen },
                            }
                        );
                        document.dispatchEvent(focusSearchEvent);
                        return;
                    }

                    case "D": {
                        // Cmd/Ctrl + Shift + D for dark mode toggle (D = Dark)
                        e.preventDefault();
                        e.stopPropagation();
                        const toggleThemeEvent = new CustomEvent("toggleTheme");
                        document.dispatchEvent(toggleThemeEvent);
                        return;
                    }

                    case "E":
                        // Cmd/Ctrl + Shift + E for export markdown (E = Export)
                        if (selectedChatId) {
                            e.preventDefault();
                            e.stopPropagation();
                            const exportEvent = new CustomEvent(
                                "exportMarkdown",
                                {
                                    detail: { chatId: selectedChatId },
                                }
                            );
                            document.dispatchEvent(exportEvent);
                        }
                        return;

                    case "J":
                        // Cmd/Ctrl + Shift + J for export JSON (J = JSON)
                        if (selectedChatId) {
                            e.preventDefault();
                            e.stopPropagation();
                            const exportEvent = new CustomEvent("exportJSON", {
                                detail: { chatId: selectedChatId },
                            });
                            document.dispatchEvent(exportEvent);
                        }
                        return;

                    case "S":
                        // Cmd/Ctrl + Shift + S for share chat read-only (S = Share)
                        if (selectedChatId) {
                            e.preventDefault();
                            e.stopPropagation();
                            const shareReadOnlyEvent = new CustomEvent(
                                "shareReadOnly",
                                {
                                    detail: { chatId: selectedChatId },
                                }
                            );
                            document.dispatchEvent(shareReadOnlyEvent);
                        }
                        return;
                }
            }

            // Special key combinations
            if (hasModifier && !e.shiftKey && !e.altKey) {
                switch (e.key) {
                    case "\\":
                        // Cmd/Ctrl + \ for toggle right sidebar (\ = backslash, common for sidebars)
                        e.preventDefault();
                        e.stopPropagation();
                        setRightSidebarOpen(!rightSidebarOpen);
                        return;
                }
            }

            // Alt + modifier combinations for chat management (memorable)
            if (hasModifier && e.altKey) {
                switch (e.key) {
                    case "c":
                    case "C":
                        // Cmd/Ctrl + Alt + C for share chat collaboration mode (C = Collaboration)
                        if (selectedChatId) {
                            e.preventDefault();
                            e.stopPropagation();
                            const shareCollabEvent = new CustomEvent(
                                "shareCollaboration",
                                {
                                    detail: { chatId: selectedChatId },
                                }
                            );
                            document.dispatchEvent(shareCollabEvent);
                        }
                        return;

                    case "t":
                    case "T":
                        // Cmd/Ctrl + Alt + T for rename current chat (T = Title)
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedChat && !isEditingTitle) {
                            handleStartEditTitle();
                        }
                        return;

                    case "f":
                    case "F":
                        // Cmd/Ctrl + Alt + F for fork current chat from last message (F = Fork)
                        e.preventDefault();
                        e.stopPropagation();
                        if (messagesResult && messagesResult.length > 0) {
                            const forkEvent = new CustomEvent(
                                "forkFromMessage",
                                {
                                    detail: {
                                        messageId:
                                            messagesResult[
                                                messagesResult.length - 1
                                            ]._id,
                                    },
                                }
                            );
                            document.dispatchEvent(forkEvent);
                        }
                        return;

                    case "d":
                    case "D":
                        // Cmd/Ctrl + Alt + D for current chat deletion (D = Delete)
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedChatId) {
                            const deleteChatEvent = new CustomEvent(
                                "deleteCurrentChat",
                                {
                                    detail: { chatId: selectedChatId },
                                }
                            );
                            document.dispatchEvent(deleteChatEvent);
                        }
                        return;

                    case "s":
                    case "S":
                        // Cmd/Ctrl + Alt + S for starring chat (S = Star)
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedChatId) {
                            const starToggleEvent = new CustomEvent(
                                "toggleCurrentChatStar",
                                {
                                    detail: { chatId: selectedChatId },
                                }
                            );
                            document.dispatchEvent(starToggleEvent);
                        }
                        return;

                    case "v":
                    case "V":
                        // Cmd/Ctrl + Alt + V for starting/stopping voice recorindg (V = Voice)
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedChatId) {
                            const voiceRecordingToggleEvent = new CustomEvent(
                                "focusMessageInput"
                            );
                            document.dispatchEvent(voiceRecordingToggleEvent);
                        }
                        return;

                    case "i":
                    case "I":
                        // Cmd/Ctrl + Alt + I to focus message input (I = Input)
                        e.preventDefault();
                        e.stopPropagation();
                        {
                            const focusInputEvent = new CustomEvent(
                                "focusMessageInput"
                            );
                            document.dispatchEvent(focusInputEvent);
                        }
                        return;

                    case "m":
                    case "M":
                        // Cmd/Ctrl + Alt + M to toggle message input visibility (M = Message input)
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMessageInput(!showMessageInput);
                        return;

                    case "h":
                    case "H":
                        // Cmd/Ctrl + Alt + H to toggle header visibility (H = Header)
                        e.preventDefault();
                        e.stopPropagation();
                        setShowHeader(!showHeader);
                        return;

                    case "z":
                    case "Z": {
                        // Cmd/Ctrl + Alt + Z to toggle zen mode (Z = Zen)
                        e.preventDefault();
                        e.stopPropagation();
                        const newZenMode = !zenMode;
                        setZenMode(newZenMode);
                        // In zen mode, hide sidebar, header and message input
                        // When exiting zen mode, show all
                        setShowHeader(!newZenMode);
                        setShowMessageInput(!newZenMode);
                        setSidebarOpen(!newZenMode);
                        return;
                    }

                    case "n":
                    case "N":
                        // Ctrl + Alt + N for new chat (N = New)
                        if (e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleNewChat();
                        }
                        return;
                }
            }

            // Global shortcuts
            if (hasModifier) {
                switch (e.key) {
                    case "k":
                    case "K":
                        // Cmd/Ctrl + K for keyboard shortcuts modal (safe - not a browser shortcut)
                        e.preventDefault();
                        e.stopPropagation();
                        setShowKeyboardShortcuts(true);
                        return;

                    case ",":
                        // Cmd/Ctrl + , for settings (standard OS pattern)
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSettings(true);
                        return;

                    case "m":
                    case "M":
                        // Cmd/Ctrl + M to open model selector (M = Model)
                        e.preventDefault();
                        e.stopPropagation();
                        {
                            const modelSelectorEvent = new CustomEvent(
                                "openModelSelector"
                            );
                            document.dispatchEvent(modelSelectorEvent);
                        }
                        return;
                }
            }

            // Skip other shortcuts if typing
            if (isTyping) return;

            // Simple navigation shortcuts (no modifiers needed)
            if (!hasModifier) {
                const allChats = chats
                    ? [...chats.starred, ...chats.regular]
                    : [];
                const currentIndex = selectedChatId
                    ? allChats.findIndex((chat) => chat._id === selectedChatId)
                    : -1;

                switch (e.key) {
                    case "ArrowUp":
                        // Navigate to previous chat
                        if (allChats.length > 0 && currentIndex > 0) {
                            e.preventDefault();
                            handleSelectChat(allChats[currentIndex - 1]._id);
                        }
                        return;

                    case "ArrowDown":
                        // Navigate to next chat
                        if (
                            allChats.length > 0 &&
                            currentIndex < allChats.length - 1
                        ) {
                            e.preventDefault();
                            handleSelectChat(allChats[currentIndex + 1]._id);
                        }
                        return;

                    case "Escape":
                        // Close modals/cancel actions
                        if (showSettings) {
                            setShowSettings(false);
                        } else if (showKeyboardShortcuts) {
                            setShowKeyboardShortcuts(false);
                        } else if (isEditingTitle) {
                            handleCancelEditTitle();
                        }
                        return;
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown, { capture: true });
        return () =>
            document.removeEventListener("keydown", handleKeyDown, {
                capture: true,
            });
    }, [
        handleNewChat,
        sidebarOpen,
        setSidebarOpen,
        rightSidebarOpen,
        setRightSidebarOpen,
        showSettings,
        setShowSettings,
        showKeyboardShortcuts,
        setShowKeyboardShortcuts,
        isEditingTitle,
        selectedChat,
        selectedChatId,
        handleSelectChat,
        handleStartEditTitle,
        handleCancelEditTitle,
        chats,
        showMessageInput,
        setShowMessageInput,
        showHeader,
        setShowHeader,
        zenMode,
        setZenMode,
        messagesResult,
    ]);

    // URL synchronization - handle URL parameters
    useEffect(() => {
        if (urlChatId && chats) {
            // Check if the chat from URL exists
            const allChats = [...chats.starred, ...chats.regular];
            const chatFromUrl = allChats.find((chat) => chat._id === urlChatId);

            if (chatFromUrl) {
                // Chat exists, select it
                setSelectedChatId(urlChatId as Id<"chats">);
                setLastSelectedChatId(urlChatId);
            } else if (urlChatId !== selectedChatId) {
                // Chat doesn't exist or doesn't belong to user, redirect to home or first chat
                const firstChat = chats.starred[0] || chats.regular[0];
                if (firstChat) {
                    void navigate(`/chat/${firstChat._id}`, { replace: true });
                } else {
                    void navigate("/", { replace: true });
                }
            }
        }
    }, [urlChatId, chats, selectedChatId, setLastSelectedChatId, navigate]);

    // Update URL when selectedChatId changes (but not from URL parameter)
    useEffect(() => {
        if (selectedChatId && selectedChatId !== urlChatId) {
            void navigate(`/chat/${selectedChatId}`, { replace: true });
        }
    }, [selectedChatId, urlChatId, navigate]);

    // Handle root path - redirect to last selected chat or first available
    useEffect(() => {
        if (
            !urlChatId &&
            chats &&
            (chats.starred.length > 0 || chats.regular.length > 0)
        ) {
            const allChats = [...chats.starred, ...chats.regular];

            // Try last selected chat first
            if (lastSelectedChatId) {
                const lastChat = allChats.find(
                    (chat) => chat._id === lastSelectedChatId
                );
                if (lastChat) {
                    void navigate(`/chat/${lastChat._id}`, { replace: true });
                    return;
                }
            }

            // Fallback to first available chat
            const firstChat = chats.starred[0] || chats.regular[0];
            if (firstChat) {
                void navigate(`/chat/${firstChat._id}`, { replace: true });
            }
        }
    }, [urlChatId, chats, lastSelectedChatId, navigate]);

    // Auto-create chat when no chats exist and query is done
    useEffect(() => {
        const createInitialChat = async () => {
            if (
                chats &&
                chats.starred.length === 0 &&
                chats.regular.length === 0 &&
                !isCreatingInitialChat
            ) {
                setIsCreatingInitialChat(true);
                try {
                    const chatId = await handleNewChat();
                    setSelectedChatId(chatId);
                } catch (error) {
                    console.error("Failed to create initial chat:", error);
                } finally {
                    setIsCreatingInitialChat(false);
                }
            }
        };

        void createInitialChat();
    }, [chats, isCreatingInitialChat, handleNewChat]);

    // Smart chat selection - try last selected, then first available
    useEffect(() => {
        if (
            !selectedChatId &&
            chats &&
            (chats.starred.length > 0 || chats.regular.length > 0)
        ) {
            const allChats = [...chats.starred, ...chats.regular];

            // Try to select the last selected chat if it still exists
            if (lastSelectedChatId) {
                const lastChat = allChats.find(
                    (chat) => chat._id === lastSelectedChatId
                );
                if (lastChat) {
                    setSelectedChatId(lastChat._id);
                    return;
                }
            }

            // Fallback to first available chat
            const firstChat = chats.starred[0] || chats.regular[0];
            if (firstChat) {
                setSelectedChatId(firstChat._id);
                setLastSelectedChatId(firstChat._id);
            }
        }
    }, [chats, selectedChatId, lastSelectedChatId, setLastSelectedChatId]);

    // Show welcome tour for new users
    useEffect(() => {
        if (
            !hasSeenTour &&
            chats &&
            chats.starred.length === 0 &&
            chats.regular.length === 0
        ) {
            const timer = setTimeout(() => setShowTour(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [hasSeenTour, chats]);

    const handleTourComplete = () => {
        setShowTour(false);
        setHasSeenTour(true);
    };

    // Determine if we should show loading state
    const isLoading = chats === undefined || isCreatingInitialChat;

    // Phase 3.5: Unshared Content Handling - Cleanup invalid shared content on mount
    useEffect(() => {
        const performSharedContentCleanup = async () => {
            if (
                sharedContent &&
                (sharedContent.sharedChats.length > 0 ||
                    sharedContent.sharedProjects.length > 0)
            ) {
                try {
                    const result = await cleanupSharedContent();
                    if (result.removedChats > 0 || result.removedProjects > 0) {
                        toast.info(
                            `Cleaned up ${result.removedChats} invalid shared chats and ${result.removedProjects} invalid shared projects`
                        );
                    }
                } catch (error) {
                    console.error("Failed to cleanup shared content:", error);
                }
            }
        };

        // Run cleanup on mount
        void performSharedContentCleanup();
    }, [cleanupSharedContent, sharedContent]); // Include sharedContent in deps

    // Phase 3.5: Fallback logic when shared content becomes unavailable
    useEffect(() => {
        if (selectedChatId && isSharedContent) {
            // Check if currently selected chat is still valid shared content
            const isStillShared = sharedContent?.sharedChats.some(
                (chat) => chat._id === selectedChatId
            );

            if (!isStillShared) {
                // Shared content no longer available, fallback to first regular chat
                const allChats = [
                    ...(chats?.starred || []),
                    ...(chats?.regular || []),
                ];
                const fallbackChat = allChats[0];

                if (fallbackChat) {
                    setSelectedChatId(fallbackChat._id);
                    setIsSharedContent(false);
                    setSharedContentType(null);
                    void navigate(`/chat/${fallbackChat._id}`, {
                        replace: true,
                    });

                    toast.warning(
                        "Shared content is no longer available. Switched to your regular chats.",
                        {
                            description:
                                "The content may have been unshared by the owner.",
                        }
                    );
                } else {
                    // No fallback available, navigate to home
                    void navigate("/", { replace: true });
                    toast.warning("Shared content is no longer available.");
                }
            }
        }
    }, [selectedChatId, isSharedContent, sharedContent, chats, navigate]);

    return (
        <div className="h-screen flex relative overflow-hidden">
            <div
                className={`${sidebarOpen ? "w-80" : "w-0"} transition-all duration-300 overflow-hidden relative z-10`}
            >
                <Sidebar
                    chats={chats || { starred: [], regular: [] }}
                    selectedChatId={selectedChatId}
                    onSelectChat={handleSelectChat}
                    onNewChat={() => void handleNewChat()}
                    onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
                    onOpenSettings={() => setShowSettings(true)}
                    // Add shared content support for Phase 3.4
                    sharedContent={sharedContent}
                />
            </div>

            <div
                className={`${sidebarOpen ? "w-80" : "w-0"} transition-all duration-300 overflow-hidden relative z-10`}
            >
                {/* <RightSidebar
                    chats={chats || { starred: [], regular: [] }}
                    selectedChatId={selectedChatId}
                    onSelectChat={handleSelectChat}
                    onNewChat={() => void handleNewChat()}
                    onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
                    onOpenSettings={() => setShowSettings(true)}
                    // Add shared content support for Phase 3.4
                    sharedContent={sharedContent}
                /> */}
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative z-10">
                {/* Header */}
                {showHeader && (
                    <header
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${showHeader ? "h-16 opacity-100" : "h-0 opacity-0"} flex items-center justify-between px-4 pt-2`}
                    >
                        <div className="flex items-center gap-4 flex-1">
                            {!sidebarOpen && (
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors"
                                >
                                    <Menu className="w-5 h-5 text-purple-200" />
                                </button>
                            )}
                        </div>

                        {/* Chat Title */}
                        <div className="flex justify-center">
                            {selectedChat && (
                                <div
                                    className={`${isEditingTitle ? "max-w-md w-full" : ""}`}
                                >
                                    {isEditingTitle ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) =>
                                                    setEditTitle(e.target.value)
                                                }
                                                onKeyDown={handleTitleKeyDown}
                                                onBlur={() =>
                                                    void handleSaveEditTitle()
                                                }
                                                className="flex-1 bg-purple-500/10 rounded-lg px-3 py-1 text-purple-100 font-medium focus:outline-none min-w-0 text-center"
                                                placeholder="Enter chat title..."
                                                maxLength={100}
                                                autoFocus
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleStartEditTitle}
                                            className="group flex items-center gap-2 justify-center hover:bg-purple-500/10 rounded-lg px-3 py-2 transition-colors max-w-full"
                                            title="Click to edit title"
                                        >
                                            <h2 className="font-medium text-lg text-purple-100 truncate">
                                                {selectedChat.title}
                                            </h2>
                                            <Edit3 className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right side controls */}
                        <div className="max-w-max p-2 rounded-lg flex items-center gap-3 flex-1 justify-end bg-purple-500/20">
                            <button
                                onClick={() => setShowKeyboardShortcuts(true)}
                                className="p-2 rounded-lg hover:bg-purple-500/30 transition-colors"
                                title="Keyboard shortcuts (Cmd/Ctrl + K)"
                            >
                                <svg
                                    className="w-5 h-5 text-purple-200"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </button>
                            {selectedChatId && (
                                <ShareMenu chatId={selectedChatId} />
                            )}
                            {/* Right Sidebar Toggle */}
                            <button
                                onClick={() =>
                                    setRightSidebarOpen(!rightSidebarOpen)
                                }
                                className={`p-2 rounded-lg transition-colors ${
                                    rightSidebarOpen
                                        ? "text-purple-100"
                                        : "hover:bg-purple-500/30 text-purple-200"
                                }`}
                                title="Toggle chat navigator (Cmd/Ctrl + Shift + R)"
                            >
                                <PanelRight className="w-5 h-5" />
                            </button>
                            <ThemeToggle />
                        </div>
                    </header>
                )}

                {/* Chat Content */}
                <div className="flex-1 overflow-y-scroll overflow-x-hidden">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                {/* Loading spinner */}
                                <div className="relative mx-auto mb-6">
                                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 flex items-center justify-center backdrop-blur-sm border border-purple-500/30">
                                        <svg
                                            className="w-10 h-10 text-purple-300 animate-spin"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                    </div>
                                </div>
                                <h2 className="text-2xl font-semibold text-purple-200 mb-2">
                                    {isCreatingInitialChat
                                        ? "Creating your first chat..."
                                        : "Loading..."}
                                </h2>
                                <p className="text-purple-300">
                                    {isCreatingInitialChat
                                        ? "Setting up your workspace"
                                        : "Please wait a moment"}
                                </p>{" "}
                            </div>
                        </div>
                    ) : selectedChatId ? (
                        <ChatArea
                            chatId={selectedChatId}
                            setSelectedChatId={setSelectedChatId}
                            showMessageInput={showMessageInput}
                            // onSelectArtifact={handleSelectArtifact}
                        />
                    ) : null}
                </div>
            </div>

            {/* Right Sidebar */}
            <RightSidebar
                isOpen={rightSidebarOpen}
                onClose={() => setRightSidebarOpen(false)}
                chatId={selectedChatId}
                messages={messagesResult || []}
                onScrollToMessage={handleScrollToMessage}
                mode={rightSidebarMode}
                onModeChange={handleRightSidebarModeChange}
                artifacts={artifacts}
                activeArtifactId={activeArtifactId}
                onSelectArtifact={handleSelectArtifact}
            />

            {/* Settings Modal */}
            {showSettings && (
                <SettingsModal
                    open={showSettings}
                    onOpenChange={setShowSettings}
                />
            )}

            {/* Keyboard Shortcuts */}
            <KeyboardShortcuts
                open={showKeyboardShortcuts}
                onOpenChange={setShowKeyboardShortcuts}
            />

            {/* Welcome Tour */}
            {showTour && <WelcomeTour onComplete={handleTourComplete} />}

            {/* CSS for custom animations - Using style tag without jsx attribute */}
            <style>{`
                @keyframes float {
                    0%,
                    100% {
                        transform: translateY(0px) rotate(0deg);
                        opacity: 0.1;
                    }
                    50% {
                        transform: translateY(-30px) rotate(180deg);
                        opacity: 0.3;
                    }
                }

                @keyframes floatSlow {
                    0%,
                    100% {
                        transform: translate(0px, 0px) scale(1);
                    }
                    33% {
                        transform: translate(20px, -20px) scale(1.1);
                    }
                    66% {
                        transform: translate(-20px, 20px) scale(0.9);
                    }
                }

                .highlight-message {
                    animation: highlightPulse 2s ease-in-out;
                    background: rgba(147, 51, 234, 0.2) !important;
                    border-color: rgba(147, 51, 234, 0.5) !important;
                }

                @keyframes highlightPulse {
                    0%, 100% {
                        background: rgba(147, 51, 234, 0.1);
                        transform: scale(1);
                    }
                    50% {
                        background: rgba(147, 51, 234, 0.3);
                        transform: scale(1.02);
                    }
                }
            `}</style>
        </div>
    );
}
