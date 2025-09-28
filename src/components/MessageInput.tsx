import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { VoiceInput } from "./VoiceInput";
import { VoiceChat } from "./VoiceChat";
import { FileUpload } from "./FileUpload";
import { ModelSelector } from "./ModelSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
    Send,
    Image,
    Search,
    X,
    Cpu,
    Square,
    Video,
    FileText,
    Zap,
    Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getModelCapabilities, getProviderForModel } from "../lib/modelConfig";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";
import { ChatAISettingsModal } from "./ChatAISettingsModal";

interface MessageInputProps {
    message: string;
    onMessageChange: (value: string) => void;
    activeCommands: string[];
    onCommandsChange: (commands: string[]) => void;
    // UNIFIED: Single referencedLibraryItems parameter instead of separate attachments + referencedLibraryItems
    onSendMessage: (
        content: string,
        referencedLibraryItems?: Array<{
            type: "attachment" | "artifact" | "media";
            id: string;
            name: string;
            description?: string;
            size?: number;
            mimeType?: string;
        }>
    ) => Promise<void> | void;
    isLoading?: boolean;
    isStreaming?: boolean;
    onStopStreaming?: () => Promise<void> | void;
    placeholder?: string;
    selectedModel: string;
    onModelChange: (model: string) => Promise<void> | void;
    showMessageInput?: boolean;
    sidebarOpen?: boolean;
    chatId?: Id<"chats">;
    onSendMultiAIMessage?: (
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
    ) => Promise<void> | void;
    // NEW: Edit mode prop
    editMode?: {
        isEditing: boolean;
        messageId: Id<"messages">;
        originalContent: string;
        onSave: (
            content: string,
            referencedItems?: any[]
        ) => Promise<void> | void;
        onCancel: () => void;
    };
    // Add Multi-AI props
    isMultiAIMode?: boolean;
    selectedModels?: string[];
    onSelectedModelsChange?: (models: string[]) => void;
}

export function MessageInput({
    message,
    onMessageChange,
    activeCommands,
    onCommandsChange,
    onSendMessage,
    isLoading = false,
    isStreaming = false,
    onStopStreaming,
    placeholder,
    selectedModel,
    onModelChange,
    showMessageInput = true,
    sidebarOpen,
    chatId,
    onSendMultiAIMessage,
    editMode,
    isMultiAIMode,
    selectedModels,
    onSelectedModelsChange,
}: MessageInputProps) {
    const [attachments, setAttachments] = useState<
        Array<{
            type: "attachment";
            libraryId: string;
            name: string;
            size: number;
            mimeType: string;
        }>
    >([]);
    const [isRecording, setIsRecording] = useState(false);
    const [showCommandsPopup, setShowCommandsPopup] = useState(false);
    const [filteredCommands, setFilteredCommands] = useState<any[]>([]);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
    const [isToolboxOpen, setIsToolboxOpen] = useState(false);
    const [messageHistory, setMessageHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // State for library items and search
    const [showLibraryPopup, setShowLibraryPopup] = useState(false);
    const [filteredLibraryItems, setFilteredLibraryItems] = useState<any[]>([]);
    const [selectedLibraryIndex, setSelectedLibraryIndex] = useState(0);

    // UNIFIED: Single library referencing state for "#" command
    const [referencedLibraryItems, setReferencedLibraryItems] = useState<
        Array<{
            type: "attachment" | "artifact" | "media";
            id: string;
            name: string;
            description?: string;
        }>
    >([]);

    // Voice chat state
    const [showVoiceChat, setShowVoiceChat] = useState(false);
    const [voiceChatIsConnected, setVoiceChatIsConnected] = useState(false);

    // Chat AI Settings Modal state
    const [showChatAISettings, setShowChatAISettings] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const defaultPlaceholder = "Type your message here...";

    // Use custom shortcuts hook - MOVED BEFORE useEffect that uses it
    const { checkShortcutMatch } = useCustomShortcuts();

    // Get chat artifacts for @ referencing
    const chatArtifacts =
        useQuery(
            chatId ? api.artifacts.getChatArtifacts : "skip",
            chatId ? { chatId } : undefined
        ) || [];

    // Get library items for # referencing - NEW
    const librarySearchResults = useQuery(
        api.library.searchLibraryItems,
        showLibraryPopup && filteredLibraryItems.length === 0
            ? { query: "", limit: 50 }
            : "skip"
    );

    // Get user preferences for API keys (needed for voice chat)
    const preferences = useQuery(api.preferences.getUserPreferences);

    // Prompt enhancement mutation
    const enhancePrompt = useAction(api.messages.enhancePrompt);

    // Model capabilities detection - now using actual model config
    const modelCapabilities = useMemo(() => {
        const provider = getProviderForModel(selectedModel);
        if (!provider) {
            return {
                textGeneration: false,
                imageGeneration: false,
                videoGeneration: false,
                vision: false,
                files: false,
                webSearch: false,
                liveChat: false,
                structuredOutput: false,
            };
        }

        return getModelCapabilities(selectedModel, provider);
    }, [selectedModel]);

    // Dynamic commands based on model capabilities
    const commands = useMemo(
        () => [
            ...(modelCapabilities.imageGeneration
                ? [
                      {
                          command: "/image",
                          label: "Image",
                          description: "Generate AI artwork",
                          icon: <Image className="w-4 h-4" />,
                          example: "/image a cat wearing a space helmet",
                      },
                  ]
                : []),
            ...(modelCapabilities.videoGeneration
                ? [
                      {
                          command: "/video",
                          label: "Video",
                          description: "Generate AI video content",
                          icon: <Video className="w-4 h-4" />,
                          example: "/video a sunrise over mountains",
                      },
                  ]
                : []),
            ...(modelCapabilities.webSearch
                ? [
                      {
                          command: "/search",
                          label: "Search",
                          description: "Search the web for current info",
                          icon: <Search className="w-4 h-4" />,
                          example: "/search latest AI news",
                      },
                  ]
                : []),
            ...(modelCapabilities.structuredOutput
                ? [
                      {
                          command: "/canvas",
                          label: "Canvas",
                          description: "Create structured artifacts and code",
                          icon: <FileText className="w-4 h-4" />,
                          example: "/canvas create a React todo app",
                      },
                  ]
                : []),
        ],
        [modelCapabilities]
    );

    // Helper function to check if a command combination is valid
    const isValidCommandCombination = useCallback(
        (newCommand: string, currentCommands: string[]): boolean => {
            const allCommands = [...currentCommands, newCommand];

            // Only /search and /canvas can be combined together
            // All other combinations are invalid

            // If we have more than 2 commands, it's invalid
            if (allCommands.length > 2) return false;

            // If we have 2 commands, they must be /search and /canvas
            const hasSearch = allCommands.includes("/search");
            const hasCanvas = allCommands.includes("/canvas");
            return hasSearch && hasCanvas;
        },
        []
    );

    // Helper function to get restriction message for a command
    const getCommandRestrictionMessage = useCallback(
        (command: string, currentCommands: string[]): string | null => {
            if (currentCommands.length === 0) return null;

            const conflictingCommands = currentCommands.filter((cmd) => {
                if (command === "/search" && cmd === "/canvas") return false;
                if (command === "/canvas" && cmd === "/search") return false;
                return true;
            });

            if (conflictingCommands.length > 0) {
                if (command === "/search" || command === "/canvas") {
                    return `Cannot combine with ${conflictingCommands.join(
                        ", "
                    )}. Only /search + /canvas allowed.`;
                } else {
                    return `Cannot combine with other commands. Remove ${currentCommands.join(
                        ", "
                    )} first.`;
                }
            }

            // Check if adding this would exceed the limit
            if (currentCommands.length >= 2) {
                return "Maximum 2 commands allowed (only /search + /canvas).";
            }

            return null;
        },
        []
    );

    // Enhanced commands with validation
    const commandsWithValidation = useMemo(() => {
        return commands.map((cmd) => {
            const isValid = isValidCommandCombination(
                cmd.command,
                activeCommands
            );
            const restrictionMessage = getCommandRestrictionMessage(
                cmd.command,
                activeCommands
            );

            return {
                ...cmd,
                isValid,
                restrictionMessage,
                isAlreadyActive: activeCommands.includes(cmd.command),
            };
        });
    }, [
        commands,
        activeCommands,
        isValidCommandCombination,
        getCommandRestrictionMessage,
    ]);

    // Check if live chat is available based on API keys and preferences
    const isLiveChatAvailable = useMemo(() => {
        if (!modelCapabilities.liveChat) return false;

        const apiKeys = preferences?.apiKeys;
        const apiKeyPreferences = preferences?.apiKeyPreferences;

        if (selectedModel.includes("gemini")) {
            return !!(apiKeys?.gemini && apiKeyPreferences?.gemini);
        } else if (selectedModel.includes("gpt")) {
            // OpenAI models
            return !!(apiKeys?.openai && apiKeyPreferences?.openai);
        }
    }, [modelCapabilities.liveChat, preferences, selectedModel]);

    const handleSubmit = useCallback(
        (transcription?: string) => {
            console.log("🚀 SEND BUTTON: handleSubmit triggered", {
                timestamp: new Date().toISOString(),
                source: transcription ? "voice_transcription" : "manual_click",
                messageLength: message?.length || 0,
                hasTranscription: !!transcription,
                transcriptionLength: transcription?.length || 0,
                attachmentsCount: attachments.length,
                referencedItemsCount: referencedLibraryItems.length,
                activeCommandsCount: activeCommands.length,
                isEditMode: !!editMode?.isEditing,
                isMultiAIMode: isMultiAIMode,
                selectedModelsCount: selectedModels?.length || 0,
                isLoading: isLoading,
                isStreaming: isStreaming,
            });

            const content = message || transcription;

            // Early exit guards to prevent unnecessary execution
            if (isLoading || isStreaming) {
                console.log("⚠️ SEND BUTTON: Blocked due to loading/streaming state", {
                    timestamp: new Date().toISOString(),
                    isLoading,
                    isStreaming,
                });
                return;
            }

            // Handle edit mode
            if (editMode?.isEditing) {
                console.log("✏️ SEND BUTTON: Edit mode detected", {
                    timestamp: new Date().toISOString(),
                    messageId: editMode.messageId,
                    originalContent: editMode.originalContent?.substring(0, 50) + "...",
                    newContent: content?.substring(0, 50) + "...",
                    hasContent: !!content?.trim(),
                });

                if (content?.trim()) {
                    // UNIFIED: Merge attachments and referencedLibraryItems for edit
                    const allReferencedItems = [
                        // Convert attachments to library items format
                        ...attachments.map((attachment) => ({
                            type: "attachment" as const,
                            id: attachment.libraryId,
                            name: attachment.name,
                            description: `${attachment.mimeType} file`,
                            size: attachment.size,
                            mimeType: attachment.mimeType,
                        })),
                        // Add existing referenced library items
                        ...referencedLibraryItems,
                    ];

                    console.log("💾 SEND BUTTON: Saving edit", {
                        timestamp: new Date().toISOString(),
                        allReferencedItemsCount: allReferencedItems.length,
                        contentTrimmed: content.trim().substring(0, 100) + "...",
                    });

                    void editMode.onSave(content, allReferencedItems);
                } else {
                    console.log("⚠️ SEND BUTTON: Edit mode - no content to save", {
                        timestamp: new Date().toISOString(),
                    });
                }
                return;
            }

            // Check if there's content to send
            const hasContent = content?.trim() ||
                attachments.length > 0 ||
                referencedLibraryItems.length > 0 ||
                activeCommands.length > 0;

            console.log("🔍 SEND BUTTON: Content validation", {
                timestamp: new Date().toISOString(),
                hasContent,
                contentTrim: content?.trim()?.substring(0, 50) + "...",
                attachmentsCount: attachments.length,
                referencedItemsCount: referencedLibraryItems.length,
                activeCommandsCount: activeCommands.length,
            });

            // Normal send message logic - only proceed if there's actual content
            if (hasContent) {
                console.log("📝 SEND BUTTON: Preparing to send message", {
                    timestamp: new Date().toISOString(),
                    messageHistoryLength: messageHistory.length,
                    willAddToHistory: !!message,
                });

                // FIXED: Remove direct DOM manipulation that was causing flicker
                // The message state will be cleared by the parent component after successful send
                // if (textareaRef.current?.value) {
                //     textareaRef.current.value = "";
                // }
                
                // Add to message history (avoid duplicates)
                const newHistory = [
                    message,
                    ...messageHistory.filter((h) => h !== message),
                ].slice(0, 50);
                setMessageHistory(newHistory);
                setHistoryIndex(-1);

                console.log("📚 SEND BUTTON: Message history updated", {
                    timestamp: new Date().toISOString(),
                    newHistoryLength: newHistory.length,
                    addedMessage: message?.substring(0, 30) + "...",
                });

                // UNIFIED: Merge attachments and referencedLibraryItems into single array
                const allReferencedItems = [
                    // Convert attachments to library items format
                    ...attachments.map((attachment) => ({
                        type: "attachment" as const,
                        id: attachment.libraryId,
                        name: attachment.name,
                        description: `${attachment.mimeType} file`,
                        size: attachment.size,
                        mimeType: attachment.mimeType,
                    })),
                    // Add existing referenced library items
                    ...referencedLibraryItems,
                ];

                console.log("🔗 SEND BUTTON: Referenced items prepared", {
                    timestamp: new Date().toISOString(),
                    totalReferencedItems: allReferencedItems.length,
                    attachmentItems: attachments.length,
                    libraryItems: referencedLibraryItems.length,
                    referencedItemTypes: allReferencedItems.map(item => item.type),
                });

                // Handle multi-AI or regular submission
                if (
                    isMultiAIMode &&
                    selectedModels &&
                    selectedModels.length >= 2 &&
                    onSendMultiAIMessage
                ) {
                    console.log("🤖 SEND BUTTON: Multi-AI mode submission", {
                        timestamp: new Date().toISOString(),
                        selectedModelsCount: selectedModels.length,
                        selectedModels: selectedModels,
                        hasMultiAIHandler: !!onSendMultiAIMessage,
                    });

                    void onSendMultiAIMessage(
                        content || "",
                        selectedModels,
                        allReferencedItems
                    );
                } else {
                    console.log("🤖 SEND BUTTON: Single AI mode submission", {
                        timestamp: new Date().toISOString(),
                        isMultiAIModeButInsufficientModels: isMultiAIMode && (!selectedModels || selectedModels.length < 2),
                        hasRegularHandler: !!onSendMessage,
                        selectedModel: selectedModel,
                    });

                    void onSendMessage(content || "", allReferencedItems);
                }

                console.log("🧹 SEND BUTTON: Cleaning up UI state", {
                    timestamp: new Date().toISOString(),
                    attachmentsToRemove: attachments.length,
                    referencedItemsToRemove: referencedLibraryItems.length,
                });

                // Clean up UI state - use React state management instead of DOM manipulation
                setAttachments([]);
                setReferencedLibraryItems([]);

                console.log("✅ SEND BUTTON: Message submission complete", {
                    timestamp: new Date().toISOString(),
                    finalContentLength: (content || "").length,
                    mode: isMultiAIMode && selectedModels && selectedModels.length >= 2 ? "multi-ai" : "single-ai",
                });
            } else {
                console.log("❌ SEND BUTTON: No content to send", {
                    timestamp: new Date().toISOString(),
                    contentEmpty: !content?.trim(),
                    noAttachments: attachments.length === 0,
                    noReferencedItems: referencedLibraryItems.length === 0,
                    noActiveCommands: activeCommands.length === 0,
                });
            }
        },
        [
            attachments,
            message,
            messageHistory,
            onSendMessage,
            onSendMultiAIMessage,
            referencedLibraryItems,
            isMultiAIMode,
            selectedModels,
            editMode,
            activeCommands,
            isLoading,
            isStreaming,
            selectedModel,
        ]
    );

    // Add logging for send button state tracking
    const sendButtonDisabled = useMemo(() => {
        const disabled = isLoading ||
            (
                !message?.trim() &&
                attachments.length === 0 &&
                activeCommands.length === 0 &&
                referencedLibraryItems.length === 0
            );
        
        console.log("🔘 SEND BUTTON STATE: disabled calculation", {
            timestamp: new Date().toISOString(),
            disabled,
            isLoading,
            message,
            messageLength: message?.length || 0,
            messageTrimmed: message?.trim() || "",
            attachmentsCount: attachments.length,
            activeCommandsCount: activeCommands.length,
            referencedItemsCount: referencedLibraryItems.length,
            hasContent: !!(message?.trim() || attachments.length > 0 || activeCommands.length > 0 || referencedLibraryItems.length > 0),
        });
        
        return disabled;
    }, [isLoading, message, attachments.length, activeCommands.length, referencedLibraryItems.length]);

    // Track send button state changes
    const previousSendButtonState = useRef<boolean | null>(null);
    useEffect(() => {
        if (previousSendButtonState.current !== null && previousSendButtonState.current !== sendButtonDisabled) {
            console.log("🔄 SEND BUTTON STATE CHANGE:", {
                timestamp: new Date().toISOString(),
                from: previousSendButtonState.current ? "disabled" : "enabled",
                to: sendButtonDisabled ? "disabled" : "enabled",
                trigger: {
                    isLoading,
                    message,
                    messageLength: message?.length || 0,
                    messageTrimmed: message?.trim() || "",
                    attachmentsCount: attachments.length,
                    activeCommandsCount: activeCommands.length,
                    referencedItemsCount: referencedLibraryItems.length,
                },
                stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n'),
            });
        }
        previousSendButtonState.current = sendButtonDisabled;
    }, [sendButtonDisabled, isLoading, message, attachments.length, activeCommands.length, referencedLibraryItems.length]);

    // Message input keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle shortcuts when textarea is focused
            if (document.activeElement !== textareaRef.current) return;

            // Edit mode specific shortcuts
            if (editMode?.isEditing) {
                if (checkShortcutMatch(e, "sendMessage")) {
                    e.preventDefault();
                    handleSubmit();
                    return;
                }

                if (e.key === "Escape") {
                    e.preventDefault();
                    editMode.onCancel();
                    return;
                }
                return; // Don't handle other shortcuts in edit mode
            }

            // Handle custom shortcuts
            if (checkShortcutMatch(e, "sendMessage")) {
                e.preventDefault();
                handleSubmit();
                return;
            }

            if (checkShortcutMatch(e, "clearInput")) {
                e.preventDefault();
                onMessageChange("");
                onCommandsChange([]);
                setAttachments([]);
                return;
            }

            if (checkShortcutMatch(e, "openModelSelector")) {
                e.preventDefault();
                const event = new CustomEvent("openModelSelector");
                document.dispatchEvent(event);
                return;
            }

            if (checkShortcutMatch(e, "voiceRecording") && !message.trim()) {
                e.preventDefault();
                setIsRecording(!isRecording);
                return;
            }

            // Message history navigation - use custom shortcuts
            if (checkShortcutMatch(e, "navigateHistory")) {
                const textarea = textareaRef.current;
                if (!textarea) return;

                const { selectionStart, selectionEnd } = textarea;
                const lines = message.split("\n");
                const currentLineIndex =
                    message.substring(0, selectionStart).split("\n").length - 1;

                if (
                    e.key === "ArrowUp" &&
                    currentLineIndex === 0 &&
                    selectionStart === selectionEnd
                ) {
                    // Navigate to previous message in history
                    e.preventDefault();
                    const newIndex = Math.min(
                        historyIndex + 1,
                        messageHistory.length - 1
                    );
                    if (newIndex !== historyIndex && messageHistory[newIndex]) {
                        setHistoryIndex(newIndex);
                        onMessageChange(messageHistory[newIndex]);
                    }
                    return;
                } else if (
                    e.key === "ArrowDown" &&
                    currentLineIndex === lines.length - 1 &&
                    selectionStart === selectionEnd
                ) {
                    // Navigate to next message in history or clear
                    e.preventDefault();
                    const newIndex = historyIndex - 1;
                    if (newIndex >= 0) {
                        setHistoryIndex(newIndex);
                        onMessageChange(messageHistory[newIndex]);
                    } else if (historyIndex >= 0) {
                        setHistoryIndex(-1);
                        onMessageChange("");
                    }
                    return;
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [
        checkShortcutMatch,
        message,
        messageHistory,
        historyIndex,
        isRecording,
        onMessageChange,
        onCommandsChange,
        setAttachments,
        handleSubmit,
        editMode,
    ]);

    // Listen for custom events from keyboard shortcuts and library modal
    useEffect(() => {
        const handleFocusMessageInput = () => {
            textareaRef.current?.focus();
        };

        const handleOpenLiveChatModal = () => {
            setShowVoiceChat(true);
        };

        // Phase 3 & 4 keyboard shortcuts
        const handleEnhancePrompt = async () => {
            if (preferences?.aiSettings?.promptEnhancement && message.trim()) {
                try {
                    const result = await enhancePrompt({
                        originalPrompt: message,
                        context:
                            activeCommands.length > 0
                                ? `Active commands: ${activeCommands.join(", ")}`
                                : undefined,
                        responseMode: preferences?.aiSettings?.responseMode,
                    });
                    if (result.wasEnhanced) {
                        onMessageChange(result.enhancedPrompt);
                        toast.success("Prompt enhanced!");
                    }
                } catch (error) {
                    toast.error("Failed to enhance prompt");
                }
            }
        };

        const handleOpenChatAISettings = () => {
            if (chatId) {
                setShowChatAISettings(true);
            }
        };

        // NEW: Handle adding library items from LibraryModal
        const handleAddLibraryItemToMessage = (e: CustomEvent) => {
            const { type, id, name, description, size, mimeType } = e.detail;

            // Add to referenced library items
            setReferencedLibraryItems((prev) => [
                ...prev.filter((item) => item.id !== id), // Remove if already exists
                { type, id, name, description, size, mimeType },
            ]);
        };

        document.addEventListener("focusMessageInput", handleFocusMessageInput);
        document.addEventListener("openLiveChatModal", handleOpenLiveChatModal);
        document.addEventListener("enhancePrompt", handleEnhancePrompt);
        document.addEventListener(
            "openChatAISettings",
            handleOpenChatAISettings
        );
        document.addEventListener(
            "addLibraryItemToMessage",
            handleAddLibraryItemToMessage as EventListener
        );

        return () => {
            document.removeEventListener(
                "focusMessageInput",
                handleFocusMessageInput
            );
            document.removeEventListener(
                "openLiveChatModal",
                handleOpenLiveChatModal
            );
            document.removeEventListener("enhancePrompt", handleEnhancePrompt);
            document.removeEventListener(
                "openChatAISettings",
                handleOpenChatAISettings
            );
            document.removeEventListener(
                "addLibraryItemToMessage",
                handleAddLibraryItemToMessage as EventListener
            );
        };
    }, [
        preferences,
        message,
        activeCommands,
        enhancePrompt,
        onMessageChange,
        chatId,
    ]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    const removeActiveCommand = (commandToRemove: string) => {
        onCommandsChange(activeCommands.filter((c) => c !== commandToRemove));
        onMessageChange(
            message.replace(commandToRemove, "").replace(/\s\s+/g, " ").trim()
        );
    };

    const removeReferencedArtifact = (artifactIdToRemove: string) => {
        setReferencedLibraryItems((prev) =>
            prev.filter((id) => id !== artifactIdToRemove)
        );
        // Remove @artifact reference from message
        const artifactToRemove = chatArtifacts.find(
            (a) => a.artifactId === artifactIdToRemove
        );
        if (artifactToRemove) {
            const referencePattern = new RegExp(
                `@${artifactToRemove.filename}\\b`,
                "g"
            );
            onMessageChange(
                message
                    .replace(referencePattern, "")
                    .replace(/\s\s+/g, " ")
                    .trim()
            );
        }
    };

    const highlightedText = useMemo(() => {
        let escapedText = message
            ?.replace(/&/g, "&amp;")
            ?.replace(/</g, "&lt;")
            ?.replace(/>/g, "&gt;");

        // Highlight commands
        const availableCommands = commands.filter(
            (c) => !activeCommands.includes(c.command)
        );
        if (availableCommands.length > 0) {
            const commandRegex = new RegExp(
                `(\\b(${availableCommands.map((c) => c.command.replace("/", "\\/")).join("|")})\\b)`,
                "g"
            );
            escapedText = escapedText?.replace(
                commandRegex,
                (match) =>
                    `<span class="bg-purple-600/30 rounded-sm px-0.5 font-mono">${match}</span>`
            );
        }

        // Highlight artifact references
        if (chatArtifacts.length > 0) {
            const artifactRegex = new RegExp(
                `(@(${chatArtifacts.map((a) => a.filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b)`,
                "g"
            );
            escapedText = escapedText.replace(
                artifactRegex,
                (match) =>
                    `<span class="bg-blue-600/30 rounded-sm px-0.5 font-mono">${match}</span>`
            );
        }

        return escapedText?.replace(/\n/g, "<br />");
    }, [message, activeCommands, commands, chatArtifacts]);

    const getCommandQuery = (text: string, cursor: number): string | null => {
        const textUpToCursor = text.substring(0, cursor);
        const lastSlashIndex = textUpToCursor.lastIndexOf("/");
        if (lastSlashIndex === -1) return null;
        const potentialQuery = textUpToCursor.substring(lastSlashIndex);
        if (/\s/.test(potentialQuery)) return null;
        return potentialQuery;
    };

    const getArtifactQuery = (text: string, cursor: number): string | null => {
        const textUpToCursor = text.substring(0, cursor);
        const lastAtIndex = textUpToCursor.lastIndexOf("@");
        if (lastAtIndex === -1) return null;
        const potentialQuery = textUpToCursor.substring(lastAtIndex);
        if (/\s/.test(potentialQuery)) return null;
        return potentialQuery;
    };

    const getLibraryQuery = (text: string, cursor: number): string | null => {
        const textUpToCursor = text.substring(0, cursor);
        const lastHashIndex = textUpToCursor.lastIndexOf("#");
        if (lastHashIndex === -1) return null;
        const potentialQuery = textUpToCursor.substring(lastHashIndex);
        if (/\s/.test(potentialQuery)) return null;
        return potentialQuery;
    };

    const handleInputChange = (newValue: string, cursorPosition?: number) => {
        const finalCursorPos = cursorPosition ?? newValue.length;
        onMessageChange(newValue);

        // Check for command query
        const commandQuery = getCommandQuery(newValue, finalCursorPos);
        if (commandQuery) {
            setShowLibraryPopup(false);
            setIsToolboxOpen(false);
            const availableCommands = commandsWithValidation.filter(
                (c) => !c.isAlreadyActive
            );
            const filtered = availableCommands.filter((c) =>
                c.command.startsWith(commandQuery)
            );
            setFilteredCommands(filtered.length > 0 ? filtered : []);
            setShowCommandsPopup(filtered.length > 0);
            setSelectedCommandIndex(0);
            return;
        }

        // Check for artifact query
        const artifactQuery = getArtifactQuery(newValue, finalCursorPos);
        if (artifactQuery && chatArtifacts.length > 0) {
            setShowCommandsPopup(false);
            const queryWithoutAt = artifactQuery.substring(1); // Remove @
            const availableArtifacts = chatArtifacts.filter(
                (a) => !referencedLibraryItems.includes(a.artifactId)
            );
            const filtered = availableArtifacts.filter(
                (a) =>
                    a.filename
                        .toLowerCase()
                        .includes(queryWithoutAt.toLowerCase()) ||
                    a.description
                        ?.toLowerCase()
                        .includes(queryWithoutAt.toLowerCase())
            );
            setFilteredLibraryItems(filtered.length > 0 ? filtered : []);
            setShowLibraryPopup(filtered.length > 0);
            setSelectedLibraryIndex(0);
            return;
        }

        // Check for library query - NEW "#" COMMAND INTEGRATION
        const libraryQuery = getLibraryQuery(newValue, finalCursorPos);
        if (libraryQuery) {
            setShowCommandsPopup(false);
            setShowLibraryPopup(false);
            const queryWithoutHash = libraryQuery.substring(1); // Remove #

            // Use proper library search instead of chatArtifacts
            if (librarySearchResults && librarySearchResults.length > 0) {
                const filtered = librarySearchResults.filter(
                    (item) =>
                        item.name
                            .toLowerCase()
                            .includes(queryWithoutHash.toLowerCase()) ||
                        item.description
                            ?.toLowerCase()
                            .includes(queryWithoutHash.toLowerCase()) ||
                        item.tags?.some((tag) =>
                            tag
                                .toLowerCase()
                                .includes(queryWithoutHash.toLowerCase())
                        )
                );
                setFilteredLibraryItems(filtered.length > 0 ? filtered : []);
                setShowLibraryPopup(filtered.length > 0);
                setSelectedLibraryIndex(0);
            } else {
                // If no library results yet, show empty state
                setFilteredLibraryItems([]);
                setShowLibraryPopup(false);
            }
            return;
        }

        // Hide popups if no queries
        setShowCommandsPopup(false);
        setShowLibraryPopup(false);
    };

    const selectCommand = (command: string) => {
        if (isToolboxOpen) {
            // If opened from Tools, just add the tag
            onCommandsChange([...new Set([...activeCommands, command])]);
        } else {
            // If opened from typing, replace the query and add the tag
            const query = getCommandQuery(
                message,
                textareaRef.current?.selectionStart || 0
            );
            const cursorPosition = textareaRef.current?.selectionStart || 0;
            const textBefore = message.substring(
                0,
                cursorPosition - (query?.length || 0)
            );
            const textAfter = message.substring(cursorPosition);

            onMessageChange(`${textBefore}${textAfter}`.trim());
            onCommandsChange([...new Set([...activeCommands, command])]);
        }

        setShowCommandsPopup(false);
        setIsToolboxOpen(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const selectArtifact = (artifact: any) => {
        // Replace the @query with @filename and add to referenced artifacts
        const query = getArtifactQuery(
            message,
            textareaRef.current?.selectionStart || 0
        );
        const cursorPosition = textareaRef.current?.selectionStart || 0;
        const textBefore = message.substring(
            0,
            cursorPosition - (query?.length || 0)
        );
        const textAfter = message.substring(cursorPosition);

        onMessageChange(`${textBefore}@${artifact.filename}${textAfter}`);
        setReferencedLibraryItems([
            ...new Set([...referencedLibraryItems, artifact.artifactId]),
        ]);

        setShowLibraryPopup(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const selectLibraryItem = (item: any) => {
        // Replace the #query with #filename and add to referenced library items
        const query = getLibraryQuery(
            message,
            textareaRef.current?.selectionStart || 0
        );
        const cursorPosition = textareaRef.current?.selectionStart || 0;
        const textBefore = message.substring(
            0,
            cursorPosition - (query?.length || 0)
        );
        const textAfter = message.substring(cursorPosition);

        onMessageChange(`${textBefore}#${item.filename}${textAfter}`);
        setReferencedLibraryItems([
            ...new Set([...referencedLibraryItems, item.artifactId]),
        ]);

        setShowLibraryPopup(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Handle commands popup
        if (showCommandsPopup && filteredCommands.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedCommandIndex(
                    (i) => (i + 1) % filteredCommands.length
                );
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedCommandIndex(
                    (i) =>
                        (i - 1 + filteredCommands.length) %
                        filteredCommands.length
                );
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                selectCommand(filteredCommands[selectedCommandIndex].command);
                return;
            }
            if (e.key === "Escape") {
                setShowCommandsPopup(false);
                return;
            }
        }

        // Handle artifacts popup
        if (showLibraryPopup && filteredLibraryItems.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedLibraryIndex(
                    (i) => (i + 1) % filteredLibraryItems.length
                );
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedLibraryIndex(
                    (i) =>
                        (i - 1 + filteredLibraryItems.length) %
                        filteredLibraryItems.length
                );
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                selectLibraryItem(filteredLibraryItems[selectedLibraryIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setShowLibraryPopup(false);
                return;
            }
        }
    };

    // Listen for custom events from keyboard shortcuts
    useEffect(() => {
        const handleFocusMessageInput = () => {
            textareaRef.current?.focus();
        };

        const handleOpenLiveChatModal = () => {
            setShowVoiceChat(true);
        };

        // Phase 3 & 4 keyboard shortcuts
        const handleEnhancePrompt = async () => {
            if (preferences?.aiSettings?.promptEnhancement && message.trim()) {
                try {
                    const result = await enhancePrompt({
                        originalPrompt: message,
                        context:
                            activeCommands.length > 0
                                ? `Active commands: ${activeCommands.join(", ")}`
                                : undefined,
                        responseMode: preferences?.aiSettings?.responseMode,
                    });
                    if (result.wasEnhanced) {
                        onMessageChange(result.enhancedPrompt);
                        toast.success("Prompt enhanced!");
                    }
                } catch (error) {
                    toast.error("Failed to enhance prompt");
                }
            }
        };

        const handleOpenChatAISettings = () => {
            if (chatId) {
                setShowChatAISettings(true);
            }
        };

        // NEW: Handle adding library items from LibraryModal
        const handleAddLibraryItemToMessage = (e: CustomEvent) => {
            const { type, id, name, description, size, mimeType } = e.detail;

            // Add to referenced library items
            setReferencedLibraryItems((prev) => [
                ...prev.filter((item) => item.id !== id), // Remove if already exists
                { type, id, name, description, size, mimeType },
            ]);
        };

        document.addEventListener("focusMessageInput", handleFocusMessageInput);
        document.addEventListener("openLiveChatModal", handleOpenLiveChatModal);
        document.addEventListener("enhancePrompt", handleEnhancePrompt);
        document.addEventListener(
            "openChatAISettings",
            handleOpenChatAISettings
        );
        document.addEventListener(
            "addLibraryItemToMessage",
            handleAddLibraryItemToMessage as EventListener
        );

        return () => {
            document.removeEventListener(
                "focusMessageInput",
                handleFocusMessageInput
            );
            document.removeEventListener(
                "openLiveChatModal",
                handleOpenLiveChatModal
            );
            document.removeEventListener("enhancePrompt", handleEnhancePrompt);
            document.removeEventListener(
                "openChatAISettings",
                handleOpenChatAISettings
            );
            document.removeEventListener(
                "addLibraryItemToMessage",
                handleAddLibraryItemToMessage as EventListener
            );
        };
    }, [
        preferences,
        message,
        activeCommands,
        enhancePrompt,
        onMessageChange,
        chatId,
    ]);

    return (
        <div
            className={`fixed -bottom-1 ${sidebarOpen ? "w-[58%]" : "w-4/5"} px-4 z-[999] transition-all duration-300 ease-in-out ${showMessageInput ? "transform translate-y-0 opacity-100" : "transform translate-y-full opacity-0 pointer-events-none"}`}
        >
            {/* Commands Popup */}
            {!editMode?.isEditing &&
                showCommandsPopup &&
                filteredCommands.length > 0 && (
                    <div className="absolute bottom-full mb-2 left-4 right-4 bg-gray-900/95 backdrop-blur-md border border-purple-600/30 rounded-lg p-3 shadow-xl z-[60]">
                        <div className="flex items-center justify-between mb-2">
                            {filteredCommands.map((cmd, index) => {
                                const isDisabled =
                                    !cmd.isValid || cmd.isAlreadyActive;
                                const canClick =
                                    cmd.isValid && !cmd.isAlreadyActive;

                                return (
                                    <button
                                        key={cmd.command}
                                        onClick={() =>
                                            canClick &&
                                            selectCommand(cmd.command)
                                        }
                                        disabled={isDisabled}
                                        className={`w-full flex items-start gap-3 p-2 rounded text-left transition-colors ${
                                            isDisabled
                                                ? "opacity-50 cursor-not-allowed bg-gray-800/50"
                                                : index === selectedCommandIndex
                                                  ? "bg-purple-600/30"
                                                  : "hover:bg-purple-600/20"
                                        }`}
                                    >
                                        <div
                                            className={`mt-0.5 ${isDisabled ? "text-gray-500" : "text-purple-400"}`}
                                        >
                                            {cmd.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div
                                                className={`font-mono flex items-center gap-2 ${isDisabled ? "text-gray-400" : "text-purple-100"}`}
                                            >
                                                {cmd.command}
                                                {cmd.isAlreadyActive && (
                                                    <span className="text-xs bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className={`text-xs ${isDisabled ? "text-gray-500" : "text-purple-300"}`}
                                            >
                                                {cmd.description}
                                            </div>
                                            {cmd.restrictionMessage && (
                                                <div className="text-xs text-orange-300 mt-1 italic">
                                                    ⚠️ {cmd.restrictionMessage}
                                                </div>
                                            )}
                                            {!cmd.restrictionMessage &&
                                                !cmd.isAlreadyActive && (
                                                    <div
                                                        className={`text-xs mt-1 font-mono ${isDisabled ? "text-gray-600" : "text-purple-400"}`}
                                                    >
                                                        {cmd.example}
                                                    </div>
                                                )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-purple-600/20">
                            <div className="text-xs text-purple-400">
                                ↑↓ to navigate • Enter to select • Esc to close
                            </div>
                            {activeCommands.length > 0 && (
                                <div className="text-xs text-orange-300 mt-1">
                                    💡 Only /search and /canvas can be combined
                                    together
                                </div>
                            )}
                        </div>
                    </div>
                )}

            {/* Library Popup - NEW "#" COMMAND INTEGRATION */}
            {!editMode?.isEditing &&
                showLibraryPopup &&
                filteredLibraryItems.length > 0 && (
                    <div className="absolute bottom-full mb-2 left-4 right-4 bg-gray-900/95 backdrop-blur-md border border-green-600/30 rounded-lg p-3 shadow-xl z-[60]">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-green-100">
                                Available Library Items
                            </h4>
                            <button
                                onClick={() => setShowLibraryPopup(false)}
                                className="p-1 rounded hover:bg-green-600/20 transition-colors text-green-400 hover:text-green-300"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {filteredLibraryItems.map((item, index) => (
                                <button
                                    key={item.artifactId}
                                    onClick={() => selectLibraryItem(item)}
                                    className={`w-full flex items-start gap-3 p-2 rounded text-left transition-colors ${index === selectedLibraryIndex ? "bg-green-600/30" : "hover:bg-green-600/20"}`}
                                >
                                    <div className="text-green-400 mt-0.5">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-green-100 font-medium font-mono text-sm truncate">
                                            #{item.filename}
                                        </div>
                                        <div className="text-xs text-green-300 line-clamp-2">
                                            {item.description ||
                                                `${item.language} file`}
                                        </div>
                                        <div className="text-xs text-green-400 mt-1">
                                            Created{" "}
                                            {new Date(
                                                item.createdAt
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-green-600/20">
                            <div className="text-xs text-green-400">
                                ↑↓ to navigate • Enter to select • Esc to close
                            </div>
                        </div>
                    </div>
                )}

            <div className="space-y-3">
                {/* Edit Mode Header */}
                {editMode?.isEditing && (
                    <div className="bg-orange-600/10 border border-orange-600/30 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                                <span className="text-sm font-medium text-orange-300">
                                    Editing Message
                                </span>
                            </div>
                            <button
                                onClick={editMode.onCancel}
                                className="text-orange-400 hover:text-orange-300 transition-colors"
                                title="Cancel editing"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="text-xs text-orange-300/80">
                            💡 Editing this message will create a new
                            conversation branch. Press{" "}
                            <kbd className="px-1.5 py-0.5 bg-orange-600/20 rounded text-xs">
                                Ctrl+Enter
                            </kbd>{" "}
                            to save or{" "}
                            <kbd className="px-1.5 py-0.5 bg-orange-600/20 rounded text-xs">
                                Esc
                            </kbd>{" "}
                            to cancel.
                        </div>
                    </div>
                )}

                <div
                    className={`relative border rounded-xl bg-black/20 backdrop-blur-md p-3 focus-within:border-purple-500 transition-colors ${
                        editMode?.isEditing
                            ? "border-orange-600/50 bg-orange-600/5"
                            : "border-purple-600/20"
                    }`}
                >
                    {/* Header - Hide most features in edit mode */}
                    {!editMode?.isEditing && (
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-purple-600/20">
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Multi-AI Mode Toggle */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Toggle multi-AI mode via parent component
                                        const event = new CustomEvent(
                                            "toggleMultiAI"
                                        );
                                        document.dispatchEvent(event);
                                    }}
                                    className={`h-6 px-2 text-xs transition-colors duration-200 rounded flex items-center gap-1 ${
                                        isMultiAIMode
                                            ? "bg-green-600/20 text-green-300 border border-green-500/30"
                                            : "bg-purple-600/20 text-purple-300 hover:bg-purple-600/30"
                                    }`}
                                    title={
                                        isMultiAIMode
                                            ? "Multi-AI mode active"
                                            : "Enable Multi-AI mode"
                                    }
                                >
                                    <Zap className="w-3 h-3" />
                                    {isMultiAIMode ? "Multi-AI" : "Single"}
                                </button>

                                {/* Model Selector */}
                                {isMultiAIMode ? (
                                    <ModelSelector
                                        selectedModel={selectedModel}
                                        onModelChange={(model) =>
                                            void onModelChange(model)
                                        }
                                        context="multi-ai"
                                        multiSelect={true}
                                        selectedModels={selectedModels || []}
                                        onModelsChange={onSelectedModelsChange}
                                        maxSelections={8}
                                    />
                                ) : (
                                    <ModelSelector
                                        selectedModel={selectedModel}
                                        onModelChange={(model) =>
                                            void onModelChange(model)
                                        }
                                    />
                                )}

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (showCommandsPopup) {
                                            setShowCommandsPopup(false);
                                            return;
                                        }
                                        setShowCommandsPopup(true);
                                        setFilteredCommands(
                                            commandsWithValidation
                                        );
                                        setIsToolboxOpen(true);
                                    }}
                                    className="h-6 px-2 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300"
                                >
                                    <Cpu className="w-3 h-3 mr-1" />
                                    Tools
                                </Button>

                                {/* Active Commands */}
                                {activeCommands.map((cmdString) => {
                                    const command = commands.find(
                                        (c) => c.command === cmdString
                                    );
                                    if (!command) return null;
                                    return (
                                        <div
                                            key={command.command}
                                            className="flex items-center h-6 px-2 text-xs bg-transparent border border-purple-500/30 rounded-md text-purple-300"
                                        >
                                            <span className="text-purple-400 mr-1.5">
                                                {command.icon}
                                            </span>
                                            {command.label}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeActiveCommand(
                                                        command.command
                                                    )
                                                }
                                                className="ml-1.5 -mr-0.5 text-purple-400 hover:text-red-400"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {/* Referenced Library Items - NEW "#" COMMAND INTEGRATION */}
                                {referencedLibraryItems.map((itemId) => {
                                    const item = chatArtifacts.find(
                                        (a) => a.artifactId === itemId
                                    );
                                    if (!item) return null;
                                    return (
                                        <div
                                            key={itemId}
                                            className="flex items-center h-6 px-2 text-xs bg-transparent border border-green-500/30 rounded-md text-green-300"
                                        >
                                            <span className="text-green-400 mr-1.5">
                                                <FileText className="w-3 h-3" />
                                            </span>
                                            #{item.filename}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeReferencedArtifact(
                                                        itemId
                                                    )
                                                }
                                                className="ml-1.5 -mr-0.5 text-green-400 hover:text-red-400"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-purple-400">
                                <span className="items-center gap-1 hidden md:flex">
                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded">
                                        Ctrl+Enter
                                    </kbd>{" "}
                                    <span>to send</span>
                                </span>
                                <span className="text-purple-500 hidden md:inline">
                                    •
                                </span>
                                <span>
                                    <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded">
                                        /
                                    </kbd>{" "}
                                    <span>for commands</span>
                                </span>
                                {/* {chatArtifacts.length > 0 && (
                                    <>
                                        <span className="text-purple-500">•</span>
                                        <span className="flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded">
                                                @
                                            </kbd>{" "}
                                            <span>for artifacts</span>
                                        </span>
                                    </>
                                )} */}
                                {chatArtifacts.length > 0 && (
                                    <>
                                        <span className="text-purple-500">
                                            •
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 bg-green-600/20 border border-green-500/30 rounded">
                                                #
                                            </kbd>{" "}
                                            <span>for libraries</span>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Attachment Preview */}
                    {attachments.length > 0 && (
                        <div className="mb-3 pb-3 border-b border-purple-600/20">
                            <div className="text-xs text-purple-400 mb-2">
                                Attached files:
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {attachments.map((attachment, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 bg-purple-600/10 border border-purple-500/30 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <span className="text-purple-300">
                                            {attachment.type === "image"
                                                ? "🖼️"
                                                : attachment.type === "pdf"
                                                  ? "📄"
                                                  : attachment.type === "video"
                                                    ? "🎬"
                                                    : attachment.type ===
                                                        "audio"
                                                      ? "🎵"
                                                      : "📁"}
                                        </span>
                                        <span className="text-purple-100 truncate max-w-32">
                                            {attachment.name}
                                        </span>
                                        <span className="text-purple-400 text-xs">
                                            (
                                            {Math.round(attachment.size / 1024)}
                                            KB)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAttachments((prev) =>
                                                    prev.filter(
                                                        (_, i) => i !== index
                                                    )
                                                )
                                            }
                                            className="text-purple-400 hover:text-red-400 transition-colors"
                                            title="Remove attachment"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 items-end">
                        <div className="flex-1 relative">
                            <div
                                className="absolute inset-0 text-base min-h-10 max-h-80 border-0 bg-transparent p-0 text-transparent whitespace-pre-wrap break-words pointer-events-none"
                                dangerouslySetInnerHTML={{
                                    __html: highlightedText,
                                }}
                                style={{
                                    fontFamily:
                                        textareaRef.current?.style.fontFamily,
                                }}
                            />
                            <Textarea
                                autoFocus
                                ref={textareaRef}
                                value={message}
                                onChange={(e) =>
                                    handleInputChange(
                                        e.target.value,
                                        e.target.selectionStart
                                    )
                                }
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    editMode?.isEditing
                                        ? "Edit your message... Press Ctrl+Enter to save, Esc to cancel"
                                        : placeholder || defaultPlaceholder
                                }
                                className={`relative text-base min-h-10 max-h-80 resize-none border-0 bg-transparent p-0 placeholder-purple-400/80 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                                    editMode?.isEditing
                                        ? "text-orange-200/90 placeholder-orange-400/80"
                                        : "text-purple-200/90"
                                }`}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            {editMode?.isEditing ? (
                                // Edit mode buttons
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={editMode.onCancel}
                                        className="h-8 w-8 p-0 text-orange-400 hover:text-orange-300 hover:bg-orange-600/20"
                                        title="Cancel editing"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        onClick={() => handleSubmit()}
                                        disabled={isLoading || !message.trim()}
                                        size="sm"
                                        className="h-8 w-8 p-0 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 transition-all"
                                        title="Save changes (Ctrl+Enter)"
                                    >
                                        {isLoading ? (
                                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                    </Button>
                                </>
                            ) : (
                                // Normal mode buttons
                                <>
                                    <VoiceInput
                                        onTranscription={handleInputChange}
                                        isRecording={isRecording}
                                        onRecordingChange={setIsRecording}
                                        sendMessage={handleSubmit}
                                    />
                                    {/* 1-Click Prompt Enhancement Button - Phase 4 */}
                                    {preferences?.aiSettings
                                        ?.promptEnhancement &&
                                        message.trim() && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={async () => {
                                                    try {
                                                        const result =
                                                            await enhancePrompt(
                                                                {
                                                                    originalPrompt:
                                                                        message,
                                                                    context:
                                                                        activeCommands.length >
                                                                        0
                                                                            ? `Active commands: ${activeCommands.join(", ")}`
                                                                            : undefined,
                                                                    responseMode:
                                                                        preferences
                                                                            ?.aiSettings
                                                                            ?.responseMode,
                                                                }
                                                            );
                                                        if (
                                                            result.wasEnhanced
                                                        ) {
                                                            onMessageChange(
                                                                result.enhancedPrompt
                                                            );
                                                            toast.success(
                                                                "Prompt enhanced!"
                                                            );
                                                        }
                                                    } catch (error) {
                                                        toast.error(
                                                            "Failed to enhance prompt"
                                                        );
                                                    }
                                                }}
                                                className="h-8 w-8 p-0 text-yellow-400 bg-yellow-600/20 hover:bg-yellow-600/30 transition-colors duration-200 ease-in-out"
                                                title="Enhance this prompt with AI (Ctrl+Shift+E)"
                                            >
                                                <Zap className="w-4 h-4" />
                                            </Button>
                                        )}
                                    {/* Chat AI Settings Button - Phase 4 */}
                                    {chatId && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setShowChatAISettings(true)
                                            }
                                            className="h-8 w-8 p-0 text-purple-400 bg-purple-600/20 hover:bg-purple-600/30 transition-colors duration-200 ease-in-out"
                                            title="Chat AI Settings (Ctrl+Shift+A)"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </Button>
                                    )}
                                    {/* Voice Chat Button - only show for live chat capable models */}
                                    {modelCapabilities.liveChat && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setShowVoiceChat(true)
                                            }
                                            className="h-8 w-8 p-0 text-purple-400 bg-purple-600/20 hover:bg-purple-600/30 transition-colors duration-200 ease-in-out"
                                            title="Start real-time live chat"
                                        >
                                            <Zap className="w-4 h-4" />
                                        </Button>
                                    )}
                                    {/* File Upload - only show for models that support files or vision */}
                                    {(modelCapabilities.files ||
                                        modelCapabilities.vision) && (
                                        <FileUpload
                                            onFileUploaded={(file) => {
                                                setAttachments((prev) => [
                                                    ...prev,
                                                    file,
                                                ]);
                                                toast.success(
                                                    `${file.name} attached`
                                                );
                                            }}
                                        />
                                    )}
                                    {/* Send/Stop Button */}
                                    {isStreaming && onStopStreaming ? (
                                        <Button
                                            type="button"
                                            onClick={() =>
                                                void onStopStreaming()
                                            }
                                            size="sm"
                                            className="h-8 w-8 p-0 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all"
                                            title="Stop streaming"
                                        >
                                            <Square className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleSubmit()}
                                            disabled={sendButtonDisabled}
                                            size="sm"
                                            className="h-8 w-8 p-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Send message"
                                        >   
                                            {isLoading ? (
                                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat AI Settings Modal - Phase 4 */}
            {chatId && (
                <ChatAISettingsModal
                    open={showChatAISettings}
                    onOpenChange={setShowChatAISettings}
                    chatId={chatId}
                />
            )}

            {/* Voice Chat Modal - Centered like ShareModal and ModelSelector */}
            <Dialog open={showVoiceChat} onOpenChange={setShowVoiceChat}>
                <DialogContent
                    className={`bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 ${voiceChatIsConnected ? "max-w-4xl" : "max-w-md"} max-h-[85vh] overflow-hidden flex flex-col`}
                    hideCloseButton
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-purple-400" />
                                <span className="text-purple-100">
                                    Real-time Live Chat
                                </span>
                            </div>
                            <button
                                onClick={() => setShowVoiceChat(false)}
                                className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors text-purple-400 hover:text-purple-300"
                                title="Close voice chat"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <VoiceChat
                            isConnected={voiceChatIsConnected}
                            setIsConnected={setVoiceChatIsConnected}
                            // onTranscription={(transcript) => {
                            //     // Voice chat transcriptions can be used to auto-populate the message input
                            //     // handleInputChange(transcript);
                            //     console.log('transcript: ', transcript)
                            //     // Optionally close the modal after transcription
                            //     // setShowVoiceChat(false);
                            // }}
                            provider={
                                selectedModel.includes("gemini")
                                    ? "gemini"
                                    : "openai"
                            }
                            className="w-full"
                            disabled={!isLiveChatAvailable}
                        />

                        {!voiceChatIsConnected && (
                            <div className="p-4 bg-purple-600/10 rounded-lg border border-purple-600/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-4 h-4 rounded-full bg-purple-400 flex items-center justify-center">
                                        <span className="text-xs">💡</span>
                                    </div>
                                    <h4 className="text-sm font-medium text-purple-200">
                                        Voice Chat Features
                                    </h4>
                                </div>
                                <ul className="text-sm text-purple-300 space-y-2">
                                    <li className="flex items-center gap-2">
                                        <span className="text-purple-400 mt-0.5">
                                            •
                                        </span>
                                        <span>
                                            Real-time conversation with AI using
                                            live connection
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-purple-400 mt-0.5">
                                            •
                                        </span>
                                        <span>
                                            Voice, video, and text interaction
                                            in one interface
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-purple-400 mt-0.5">
                                            •
                                        </span>
                                        <span>
                                            Hands-free interaction with voice
                                            and visual controls
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-purple-400 mt-0.5">
                                            •
                                        </span>
                                        <span>
                                            Secure connection using ephemeral
                                            keys
                                        </span>
                                    </li>
                                    {!isLiveChatAvailable && (
                                        <li className="flex items-center justify-center gap-2 text-orange-300">
                                            <span className="text-orange-400 mt-0.5">
                                                ⚠️
                                            </span>
                                            <span>
                                                Configure API keys in settings
                                                to use live chat
                                            </span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}