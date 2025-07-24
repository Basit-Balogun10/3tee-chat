import { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
    Crown,
    Brain,
    Copy,
    Trash2,
    X,
    RotateCcw,
    Edit3,
    GitBranch,
} from "lucide-react";
import { Button } from "./ui/button";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { toast } from "sonner";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";
import { getAvailableModels, PROVIDER_CONFIGS } from "../lib/modelConfig";

interface MultiAIResponse {
    responseId: string;
    model: string;
    content: string;
    timestamp: number;
    isPrimary: boolean;
    isDeleted?: boolean;
    metadata?: any;
}

interface MultiAIResponseCarouselProps {
    messageId: Id<"messages">;
    responses: MultiAIResponse[];
    onPrimaryChange?: (responseId: string) => void;
    onDeleteResponse?: (responseId: string) => void;
    onClose?: () => void;
}

export function MultiAIResponseCarousel({
    messageId,
    responses,
    onPrimaryChange,
    onDeleteResponse,
    onClose,
}: MultiAIResponseCarouselProps) {
    const [hoveredResponseId, setHoveredResponseId] = useState<string | null>(
        null
    );

    const updateMessageMultiAI = useMutation(api.messages.updateMessageMultiAI);
    const retryMessage = useAction(api.messages.retryMessage);
    const preferences = useQuery(api.preferences.getUserPreferences);
    const userApiKeys = preferences?.apiKeys || {};
    const userApiKeyPreferences = preferences?.apiKeyPreferences || {};

    const availableModels = useMemo(
        () => getAvailableModels(userApiKeys, userApiKeyPreferences),
        [userApiKeys, userApiKeyPreferences]
    );

    // Filter out deleted responses and sort by timestamp
    const activeResponses = useMemo(() => {
        return responses
            .filter((response) => !response.isDeleted)
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [responses]);

    const primaryResponse = useMemo(() => {
        return activeResponses.find((response) => response.isPrimary);
    }, [activeResponses]);

    const { checkShortcutMatch } = useCustomShortcuts();

    const getModelInfo = (modelId: string) => {
        const model = availableModels.find((m) => m.id === modelId);
        if (!model)
            return {
                name: modelId,
                provider: "unknown",
                color: "text-gray-400",
            };

        const providerConfig = PROVIDER_CONFIGS[model.provider];
        const colorMap: Record<string, string> = {
            openai: "text-green-400",
            google: "text-blue-400",
            anthropic: "text-orange-400",
            deepseek: "text-purple-400",
            openrouter: "text-indigo-400",
        };

        return {
            name: model.name,
            provider: providerConfig?.displayName || model.provider,
            color: colorMap[model.provider] || "text-gray-400",
        };
    };

    const handleSetPrimary = async (responseId: string) => {
        try {
            await updateMessageMultiAI({
                messageId,
                primaryResponseId: responseId,
            });
            onPrimaryChange?.(responseId);
            toast.success("Primary response updated");
        } catch (error) {
            console.error("Failed to set primary response:", error);
            toast.error("Failed to update primary response");
            return false;
        }
        return true;
    };

    const handleDeleteResponse = async (responseId: string) => {
        if (activeResponses.length <= 1) {
            toast.error("Cannot delete the last remaining response");
            return;
        }

        // Show confirmation dialog
        if (
            !confirm(
                "Are you sure you want to delete this AI response? This action cannot be undone."
            )
        ) {
            return;
        }

        try {
            await updateMessageMultiAI({
                messageId,
                deleteResponseId: responseId,
            });
            onDeleteResponse?.(responseId);
            toast.success("Response deleted");
        } catch (error) {
            console.error("Failed to delete response:", error);
            toast.error("Failed to delete response");
        }
    };

    const handleCopyResponse = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            toast.success("Response copied to clipboard");
        } catch (error) {
            toast.error("Failed to copy response");
        }
    };

    // Actions that require setting as primary first
    const handleRetryResponse = async (responseId: string) => {
        const success = await handleSetPrimary(responseId);
        if (success) {
            try {
                await retryMessage({ messageId });
                toast.success("Retrying with selected response...");
            } catch (error) {
                console.error("Failed to retry message:", error);
                toast.error("Failed to retry message");
            }
        }
    };

    const handleEditResponse = (responseId: string) => {
        // Set as primary first, then trigger edit
        void handleSetPrimary(responseId).then((success) => {
            if (success) {
                const response = activeResponses.find(
                    (r) => r.responseId === responseId
                );
                if (response) {
                    const editEvent = new CustomEvent("editMessage", {
                        detail: {
                            messageId,
                            content: response.content,
                        },
                    });
                    document.dispatchEvent(editEvent);
                }
            }
        });
    };

    const handleForkResponse = (responseId: string) => {
        // Set as primary first, then trigger fork
        void handleSetPrimary(responseId).then((success) => {
            if (success) {
                const forkEvent = new CustomEvent("forkFromMessage", {
                    detail: { messageId },
                });
                document.dispatchEvent(forkEvent);
            }
        });
    };

    // Keyboard shortcuts for hovered response
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!hoveredResponseId) return;

            const hoveredResponse = activeResponses.find(
                (r) => r.responseId === hoveredResponseId
            );
            if (!hoveredResponse) return;

            // Skip if user is typing in input/textarea
            const isTyping =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement)?.isContentEditable;

            if (isTyping) return;

            // Pick as primary (P key)
            if (checkShortcutMatch(e, "pickPrimaryResponse")) {
                e.preventDefault();
                void handleSetPrimary(hoveredResponseId);
                return;
            }

            // Delete response (Delete/Backspace key)
            if (checkShortcutMatch(e, "deleteMultiAIResponse")) {
                e.preventDefault();
                void handleDeleteResponse(hoveredResponseId);
                return;
            }

            // Copy response (C key)
            if (checkShortcutMatch(e, "copyMessage")) {
                e.preventDefault();
                void handleCopyResponse(hoveredResponse.content);
                return;
            }

            // Retry response (R key)
            if (checkShortcutMatch(e, "retryMessage")) {
                e.preventDefault();
                void handleRetryResponse(hoveredResponseId);
                return;
            }

            // Edit response (E key)
            if (checkShortcutMatch(e, "editMessage")) {
                e.preventDefault();
                handleEditResponse(hoveredResponseId);
                return;
            }

            // Fork response (F key)
            if (checkShortcutMatch(e, "forkConversation")) {
                e.preventDefault();
                handleForkResponse(hoveredResponseId);
                return;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [hoveredResponseId, activeResponses, checkShortcutMatch]);

    // Don't show carousel if no responses
    if (!activeResponses.length) {
        return (
            <div className="p-4 text-center text-purple-400 text-sm bg-purple-900/20 rounded-lg border border-purple-600/30">
                <Brain className="w-6 h-6 mx-auto mb-2 opacity-50" />
                No responses available
            </div>
        );
    }

    // Single response - render with MessageList styling
    if (activeResponses.length === 1) {
        const response = activeResponses[0];
        const modelInfo = getModelInfo(response.model);

        return (
            <div className="space-y-3">
                {/* Model header matching MessageList style */}
                <div className="text-xs text-purple-300 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-600/30 rounded">
                            {modelInfo.name}
                        </span>
                        <Crown
                            className="w-4 h-4 text-yellow-400"
                            title="Primary response"
                        />
                    </div>
                </div>
                {/* Content with MessageList styling */}
                <div className="relative">
                    <MarkdownRenderer
                        content={response.content}
                        className="text-purple-100"
                    />
                </div>
            </div>
        );
    }

    // Multiple responses - horizontal scrolling carousel
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium text-purple-200">
                        Multi-AI Responses ({activeResponses.length})
                    </span>
                </div>

                {onClose && primaryResponse && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-purple-400 hover:text-purple-300"
                        title="Close and show primary response"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Horizontal Scrolling Cards Container */}
            <div className="relative">
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-purple-900/20 scrollbar-thumb-purple-600/50 hover:scrollbar-thumb-purple-500/70">
                    {activeResponses.map((response) => {
                        const modelInfo = getModelInfo(response.model);
                        const isHovered =
                            hoveredResponseId === response.responseId;

                        return (
                            <div
                                key={response.responseId}
                                className={`flex-shrink-0 w-80 bg-transparent backdrop-blur-sm border border-purple-600/30 text-purple-100 rounded-2xl px-4 py-3 group transition-all relative ${
                                    response.isPrimary
                                        ? "ring-2 ring-yellow-500/40 border-yellow-500/50"
                                        : "hover:border-purple-500/50"
                                }`}
                                onMouseEnter={() =>
                                    setHoveredResponseId(response.responseId)
                                }
                                onMouseLeave={() => setHoveredResponseId(null)}
                            >
                                {/* Model Header matching MessageList style */}
                                <div className="text-xs text-purple-300 mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-purple-600/30 rounded">
                                            {modelInfo.name}
                                        </span>
                                        {response.isPrimary && (
                                            <Crown
                                                className="w-4 h-4 text-yellow-400"
                                                title="Primary response"
                                            />
                                        )}
                                    </div>

                                    {/* Top-right corner actions (Pick & Delete) */}
                                    <div
                                        className={`flex items-center gap-1 transition-opacity ${
                                            isHovered
                                                ? "opacity-100"
                                                : "opacity-0"
                                        }`}
                                    >
                                        {!response.isPrimary && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleSetPrimary(
                                                        response.responseId
                                                    )
                                                }
                                                className="h-6 px-2 text-xs text-yellow-400 hover:text-yellow-300"
                                                title="Pick as primary (P)"
                                            >
                                                <Crown className="w-3 h-3" />
                                            </Button>
                                        )}
                                        {activeResponses.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleDeleteResponse(
                                                        response.responseId
                                                    )
                                                }
                                                className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                                                title="Delete response (Delete)"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Content with MessageList styling */}
                                <div className="max-h-64 overflow-y-auto">
                                    <div className="relative">
                                        <MarkdownRenderer
                                            content={response.content}
                                            className="text-purple-100"
                                        />
                                    </div>
                                </div>

                                {/* Bottom hover actions (matching MessageList hover pattern) */}
                                <div
                                    className={`absolute bottom-2 left-2 right-2 flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm rounded-lg px-2 py-1 transition-opacity ${
                                        isHovered ? "opacity-100" : "opacity-0"
                                    }`}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleCopyResponse(response.content)
                                        }
                                        className="h-6 px-2 text-xs text-purple-400 hover:text-purple-300"
                                        title="Copy (C)"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleRetryResponse(
                                                response.responseId
                                            )
                                        }
                                        className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300"
                                        title="Pick & Retry (R)"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleEditResponse(
                                                response.responseId
                                            )
                                        }
                                        className="h-6 px-2 text-xs text-green-400 hover:text-green-300"
                                        title="Pick & Edit (E)"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleForkResponse(
                                                response.responseId
                                            )
                                        }
                                        className="h-6 px-2 text-xs text-orange-400 hover:text-orange-300"
                                        title="Pick & Fork (F)"
                                    >
                                        <GitBranch className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Scroll indicators */}
            <div className="flex justify-center gap-1">
                {activeResponses.map((response, index) => (
                    <div
                        key={response.responseId}
                        className={`w-2 h-2 rounded-full transition-colors ${
                            response.isPrimary
                                ? "bg-yellow-400"
                                : "bg-purple-600/30"
                        }`}
                        title={`${getModelInfo(response.model).name}${response.isPrimary ? " (Primary)" : ""}`}
                    />
                ))}
            </div>
        </div>
    );
}
