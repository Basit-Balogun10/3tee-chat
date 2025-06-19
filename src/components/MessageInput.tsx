import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { VoiceInput } from "./VoiceInput";
import { VoiceChat } from "./VoiceChat";
import { FileUpload } from "./FileUpload";
import { ModelSelector } from "./ModelSelector";
import {
    Send,
    Image,
    Search,
    X,
    Cpu,
    Square,
    Video,
    FileText,
    Phone,
    Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getModelCapabilities, getProviderForModel } from "../lib/modelConfig";

interface MessageInputProps {
    message: string;
    onMessageChange: (value: string) => void;
    activeCommands: string[];
    onCommandsChange: (commands: string[]) => void;
    onSendMessage: (
        content: string,
        attachments?: any[],
        referencedArtifacts?: string[]
    ) => Promise<void> | void;
    isLoading?: boolean;
    isStreaming?: boolean;
    onStopStreaming?: () => Promise<void> | void;
    placeholder?: string;
    selectedModel: string;
    onModelChange: (model: string) => Promise<void> | void;
    showMessageInput?: boolean;
    chatId?: Id<"chats">;
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
    chatId,
}: MessageInputProps) {
    const [attachments, setAttachments] = useState<any[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [showCommandsPopup, setShowCommandsPopup] = useState(false);
    const [filteredCommands, setFilteredCommands] = useState<any[]>([]);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
    const [isToolboxOpen, setIsToolboxOpen] = useState(false);
    const [messageHistory, setMessageHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Artifact referencing state
    const [showArtifactsPopup, setShowArtifactsPopup] = useState(false);
    const [filteredArtifacts, setFilteredArtifacts] = useState<any[]>([]);
    const [selectedArtifactIndex, setSelectedArtifactIndex] = useState(0);
    const [referencedArtifacts, setReferencedArtifacts] = useState<string[]>(
        []
    );

    // Voice chat state
    const [showVoiceChat, setShowVoiceChat] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const defaultPlaceholder = "Type your message here...";

    // Get chat artifacts for @ referencing
    const chatArtifacts =
        useQuery(
            chatId ? api.artifacts.getChatArtifacts : "skip",
            chatId ? { chatId } : undefined
        ) || [];

    // Get user preferences for API keys (needed for voice chat)
    const preferences = useQuery(api.preferences.getUserPreferences);

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
            if (allCommands.length === 2) {
                const hasSearch = allCommands.includes("/search");
                const hasCanvas = allCommands.includes("/canvas");
                return hasSearch && hasCanvas;
            }

            // Single commands are always valid
            return true;
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (
            message.trim() ||
            attachments.length > 0 ||
            referencedArtifacts.length > 0
        ) {
            // Add to message history (avoid duplicates)
            const newHistory = [
                message,
                ...messageHistory.filter((h) => h !== message),
            ].slice(0, 50);
            setMessageHistory(newHistory);
            setHistoryIndex(-1);
        }
        void onSendMessage(message, attachments, referencedArtifacts);
        setAttachments([]);
        setReferencedArtifacts([]);
    };

    // Message input keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle shortcuts when textarea is focused
            if (document.activeElement !== textareaRef.current) return;

            const hasModifier = e.metaKey || e.ctrlKey;

            // Message history navigation (Up/Down arrows) - only when at start/end of textarea
            if (!hasModifier && !e.shiftKey && !e.altKey) {
                const textarea = textareaRef.current;
                if (!textarea) return;

                switch (e.key) {
                    case "ArrowUp": {
                        // Navigate to previous message in history only if cursor is at the start/first line
                        const isAtFirstLine =
                            textarea.selectionStart === 0 ||
                            textarea.value
                                .substring(0, textarea.selectionStart)
                                .indexOf("\n") === -1;

                        if (messageHistory.length > 0 && isAtFirstLine) {
                            e.preventDefault();
                            const newIndex = Math.min(
                                historyIndex + 1,
                                messageHistory.length - 1
                            );
                            setHistoryIndex(newIndex);
                            onMessageChange(messageHistory[newIndex] || "");
                        }
                        return;
                    }

                    case "ArrowDown": {
                        // Navigate to next message in history only if cursor is at the end/last line
                        const isAtLastLine =
                            textarea.selectionEnd === textarea.value.length ||
                            textarea.value
                                .substring(textarea.selectionEnd)
                                .indexOf("\n") === -1;

                        if (isAtLastLine) {
                            e.preventDefault();
                            if (historyIndex > 0) {
                                const newIndex = historyIndex - 1;
                                setHistoryIndex(newIndex);
                                onMessageChange(messageHistory[newIndex] || "");
                            } else if (historyIndex === 0) {
                                setHistoryIndex(-1);
                                onMessageChange("");
                            }
                        }
                        return;
                    }
                }
            }

            if (hasModifier) {
                switch (e.key) {
                    case "Enter":
                        // Cmd/Ctrl + Enter to send message
                        e.preventDefault();
                        handleSubmit(e as any);
                        return;

                    case "l":
                    case "L":
                        // Cmd/Ctrl + L to clear input
                        e.preventDefault();
                        onMessageChange("");
                        onCommandsChange([]);
                        setAttachments([]);
                        setHistoryIndex(-1);
                        return;
                }
            }

            // Voice recording shortcut (Ctrl + Space when input is empty or focused)
            if (e.ctrlKey && e.key === " " && !message.trim()) {
                e.preventDefault();
                setIsRecording(!isRecording);
                return;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [
        message,
        messageHistory,
        historyIndex,
        isRecording,
        onMessageChange,
        onCommandsChange,
        setAttachments,
        handleSubmit,
    ]);

    // Listen for custom events from keyboard shortcuts
    useEffect(() => {
        const handleFocusMessageInput = () => {
            textareaRef.current?.focus();
        };

        document.addEventListener("focusMessageInput", handleFocusMessageInput);
        return () =>
            document.removeEventListener(
                "focusMessageInput",
                handleFocusMessageInput
            );
    }, []);

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
        setReferencedArtifacts((prev) =>
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
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Highlight commands
        const availableCommands = commands.filter(
            (c) => !activeCommands.includes(c.command)
        );
        if (availableCommands.length > 0) {
            const commandRegex = new RegExp(
                `(\\b(${availableCommands.map((c) => c.command.replace("/", "\\/")).join("|")})\\b)`,
                "g"
            );
            escapedText = escapedText.replace(
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

        return escapedText.replace(/\n/g, "<br />");
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

    const handleInputChange = (newValue: string, cursorPosition?: number) => {
        const finalCursorPos = cursorPosition ?? newValue.length;
        onMessageChange(newValue);

        // Check for command query
        const commandQuery = getCommandQuery(newValue, finalCursorPos);
        if (commandQuery) {
            setShowArtifactsPopup(false);
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
                (a) => !referencedArtifacts.includes(a.artifactId)
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
            setFilteredArtifacts(filtered.length > 0 ? filtered : []);
            setShowArtifactsPopup(filtered.length > 0);
            setSelectedArtifactIndex(0);
            return;
        }

        // Hide popups if no queries
        setShowCommandsPopup(false);
        setShowArtifactsPopup(false);
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
        setReferencedArtifacts([
            ...new Set([...referencedArtifacts, artifact.artifactId]),
        ]);

        setShowArtifactsPopup(false);
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
                e.preventDefault();
                setShowCommandsPopup(false);
                return;
            }
        }

        // Handle artifacts popup
        if (showArtifactsPopup && filteredArtifacts.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedArtifactIndex(
                    (i) => (i + 1) % filteredArtifacts.length
                );
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedArtifactIndex(
                    (i) =>
                        (i - 1 + filteredArtifacts.length) %
                        filteredArtifacts.length
                );
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                selectArtifact(filteredArtifacts[selectedArtifactIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setShowArtifactsPopup(false);
                return;
            }
        }

        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    // Listen for custom events from keyboard shortcuts
    useEffect(() => {
        const handleFocusMessageInput = () => {
            textareaRef.current?.focus();
        };

        document.addEventListener("focusMessageInput", handleFocusMessageInput);
        return () =>
            document.removeEventListener(
                "focusMessageInput",
                handleFocusMessageInput
            );
    }, []);

    return (
        <div
            className={`relative w-4/5 mx-auto z-[999] transition-all duration-300 ease-in-out ${showMessageInput ? "transform translate-y-0 opacity-100" : "transform translate-y-full opacity-0 pointer-events-none"}`}
        >
            {/* Commands Popup */}
            {showCommandsPopup && filteredCommands.length > 0 && (
                <div className="absolute bottom-full mb-2 left-4 right-4 bg-gray-900/95 backdrop-blur-md border border-purple-600/30 rounded-lg p-3 shadow-xl z-[60]">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-purple-100">
                            Available Commands
                        </h4>
                        <button
                            onClick={() => setShowCommandsPopup(false)}
                            className="p-1 rounded hover:bg-purple-600/20 transition-colors text-purple-400 hover:text-purple-300"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="space-y-1">
                        {filteredCommands.map((cmd, index) => {
                            const isDisabled =
                                !cmd.isValid || cmd.isAlreadyActive;
                            const canClick =
                                cmd.isValid && !cmd.isAlreadyActive;

                            return (
                                <button
                                    key={cmd.command}
                                    onClick={() =>
                                        canClick && selectCommand(cmd.command)
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
                                            className={`font-medium flex items-center gap-2 ${isDisabled ? "text-gray-400" : "text-purple-100"}`}
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

            {/* Artifacts Popup */}
            {showArtifactsPopup && filteredArtifacts.length > 0 && (
                <div className="absolute bottom-full mb-2 left-4 right-4 bg-gray-900/95 backdrop-blur-md border border-blue-600/30 rounded-lg p-3 shadow-xl z-[60]">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-blue-100">
                            Available Artifacts
                        </h4>
                        <button
                            onClick={() => setShowArtifactsPopup(false)}
                            className="p-1 rounded hover:bg-blue-600/20 transition-colors text-blue-400 hover:text-blue-300"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {filteredArtifacts.map((artifact, index) => (
                            <button
                                key={artifact.artifactId}
                                onClick={() => selectArtifact(artifact)}
                                className={`w-full flex items-start gap-3 p-2 rounded text-left transition-colors ${index === selectedArtifactIndex ? "bg-blue-600/30" : "hover:bg-blue-600/20"}`}
                            >
                                <div className="text-blue-400 mt-0.5">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-blue-100 font-medium font-mono text-sm truncate">
                                        @{artifact.filename}
                                    </div>
                                    <div className="text-xs text-blue-300 line-clamp-2">
                                        {artifact.description ||
                                            `${artifact.language} file`}
                                    </div>
                                    <div className="text-xs text-blue-400 mt-1">
                                        Created{" "}
                                        {new Date(
                                            artifact.createdAt
                                        ).toLocaleDateString()}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-600/20">
                        <div className="text-xs text-blue-400">
                            ↑↓ to navigate • Enter to select • Esc to close
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative border border-purple-600/20 rounded-xl bg-black/20 backdrop-blur-md p-3 focus-within:border-purple-500 transition-colors">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-purple-600/20">
                        <div className="flex items-center gap-2 flex-wrap">
                            <ModelSelector
                                selectedModel={selectedModel}
                                onModelChange={(model) =>
                                    void onModelChange(model)
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowCommandsPopup(true);
                                    setFilteredCommands(commandsWithValidation);
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
                            {/* Referenced Artifacts */}
                            {referencedArtifacts.map((artifactId) => {
                                const artifact = chatArtifacts.find(
                                    (a) => a.artifactId === artifactId
                                );
                                if (!artifact) return null;
                                return (
                                    <div
                                        key={artifactId}
                                        className="flex items-center h-6 px-2 text-xs bg-transparent border border-blue-500/30 rounded-md text-blue-300"
                                    >
                                        <span className="text-blue-400 mr-1.5">
                                            <FileText className="w-3 h-3" />
                                        </span>
                                        @{artifact.filename}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeReferencedArtifact(
                                                    artifactId
                                                )
                                            }
                                            className="ml-1.5 -mr-0.5 text-blue-400 hover:text-red-400"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-purple-400">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded">
                                    Ctrl+Enter
                                </kbd>{" "}
                                <span>to send</span>
                            </span>
                            <span className="text-purple-500">•</span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-purple-600/20 border border-purple-500/30 rounded">
                                    /
                                </kbd>{" "}
                                <span>for commands</span>
                            </span>
                            {chatArtifacts.length > 0 && (
                                <>
                                    <span className="text-purple-500">•</span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded">
                                            @
                                        </kbd>{" "}
                                        <span>for artifacts</span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

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
                                placeholder={placeholder || defaultPlaceholder}
                                className="relative text-base min-h-10 max-h-80 resize-none border-0 bg-transparent p-0 text-purple-200/90 placeholder-purple-400/80 focus-visible:ring-0 focus-visible:ring-offset-0"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Voice Input - only show for voice-capable models */}
                            {modelCapabilities.voice && (
                                <VoiceInput
                                    onTranscription={handleInputChange}
                                    isRecording={isRecording}
                                    onRecordingChange={setIsRecording}
                                />
                            )}

                            {/* Voice Chat Button - only show for live chat capable models */}
                            {modelCapabilities.liveChat && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowVoiceChat(true)}
                                    className="h-8 w-8 p-0 text-green-400 bg-green-600/20 hover:bg-green-600/30"
                                    title="Start real-time voice chat"
                                >
                                    <Phone className="w-4 h-4" />
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
                                        toast.success(`${file.name} attached`);
                                    }}
                                />
                            )}
                            {/* Send/Stop Button */}
                            {isStreaming && onStopStreaming ? (
                                <Button
                                    type="button"
                                    onClick={() => void onStopStreaming()}
                                    size="sm"
                                    className="h-8 w-8 p-0 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all"
                                    title="Stop streaming"
                                >
                                    <Square className="w-4 h-4" />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    disabled={
                                        isLoading ||
                                        (!message.trim() &&
                                            attachments.length === 0 &&
                                            activeCommands.length === 0 &&
                                            referencedArtifacts.length === 0)
                                    }
                                    size="sm"
                                    className="h-8 w-8 p-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all"
                                    title="Send message"
                                >
                                    {isLoading ? (
                                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </form>

            {/* Voice Chat Modal - only show when voice chat is active */}
            {showVoiceChat && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[1000]">
                    <div className="bg-gray-900/95 backdrop-blur-md border border-green-600/30 rounded-xl p-6 shadow-xl max-w-lg w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-green-100">
                                Real-time Voice Chat
                            </h3>
                            <button
                                onClick={() => setShowVoiceChat(false)}
                                className="p-2 rounded-lg hover:bg-green-600/20 transition-colors text-green-400 hover:text-green-300"
                                title="Close voice chat"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <VoiceChat
                            onTranscription={(transcript) => {
                                // Voice chat transcriptions can be used to auto-populate the message input
                                handleInputChange(transcript);
                                // Optionally close the modal after transcription
                                // setShowVoiceChat(false);
                            }}
                            apiKey={
                                selectedModel.includes("gemini")
                                    ? preferences?.apiKeys?.gemini
                                    : preferences?.apiKeys?.openai
                            }
                            provider={
                                selectedModel.includes("gemini")
                                    ? "gemini"
                                    : "openai"
                            }
                            className="w-full"
                        />

                        <div className="mt-4 p-3 bg-green-600/10 rounded-lg border border-green-600/20">
                            <div className="text-xs text-green-300 mb-2">
                                💡 <strong>Voice Chat Features:</strong>
                            </div>
                            <ul className="text-xs text-green-400 space-y-1">
                                <li>• Real-time conversation with AI</li>
                                <li>• Automatic speech recognition</li>
                                <li>• Natural voice responses</li>
                                <li>• Hands-free interaction</li>
                                {!preferences?.apiKeys?.gemini &&
                                    !preferences?.apiKeys?.openai && (
                                        <li className="text-orange-300">
                                            • Configure API keys in settings for
                                            full functionality
                                        </li>
                                    )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
