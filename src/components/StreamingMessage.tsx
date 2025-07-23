import React, { useState, useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useNormalStreaming } from "../hooks/useNormalStreaming";
import { Button } from "./ui/button";
import { RefreshCw, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface StreamingMessageProps {
    messageId: Id<"messages">;
    initialContent?: string;
    className?: string;
    onStreamingComplete?: () => void;
}

export function StreamingMessage({
    messageId,
    initialContent = "",
    className = "",
    onStreamingComplete,
}: StreamingMessageProps) {
    const [displayContent, setDisplayContent] = useState(initialContent);
    const [hasError, setHasError] = useState(false);

    // Normal streaming hook
    const normalStreaming = useNormalStreaming({
        messageId: messageId,
        onContentUpdate: (newContent, isComplete) => {
            setDisplayContent(newContent);
            setHasError(false);

            // Notify parent when streaming is complete
            if (isComplete && onStreamingComplete) {
                onStreamingComplete();
            }
        },
        onError: (error) => {
            setHasError(true);
            console.error("Normal streaming error:", error);
            toast.error("Message streaming failed", {
                action: {
                    label: "Retry",
                    onClick: () => {
                        setHasError(false);
                        normalStreaming.startStream();
                    },
                },
            });
        },
    });

    const { content, isStreaming, error } = normalStreaming;

    // Update display content when streaming provides new content
    useEffect(() => {
        if (content) {
            setDisplayContent(content);
        }
    }, [content]);

    // Handle errors
    useEffect(() => {
        if (error) {
            setHasError(true);
            console.error("Streaming error:", error);

            // Show error toast only once per error
            toast.error("Message streaming interrupted", {
                action: {
                    label: "Retry",
                    onClick: () => void handleManualRetry(),
                },
            });
        }
    }, [error]);

    const handleManualRetry = async () => {
        try {
            setHasError(false);
            if (normalStreaming.startStream) {
                normalStreaming.startStream();
            }
            toast.success("Streaming resumed");
        } catch (err) {
            console.error("Manual retry failed:", err);
            toast.error("Failed to resume streaming");
        }
    };

    const handleStopStreaming = () => {
        if (normalStreaming.stopStream) {
            normalStreaming.stopStream();
            toast.success("Streaming stopped");
        }
    };

    return (
        <div className={`relative ${className}`}>
            {/* Streaming Status Indicator */}
            {isStreaming && (
                <div className="flex items-center gap-2 mb-2 text-xs">
                    {hasError ? (
                        <>
                            <WifiOff className="w-3 h-3 text-red-400" />
                            <span className="text-red-400">
                                Connection lost
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleManualRetry}
                                className="h-5 px-2 text-xs text-red-400 hover:text-red-300"
                            >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-green-400">
                                Streaming...
                            </span>
                            <span className="text-purple-400">
                                {content.length} chars
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleStopStreaming}
                                className="h-5 px-2 text-xs text-purple-400 hover:text-purple-300"
                            >
                                Stop
                            </Button>
                        </>
                    )}
                </div>
            )}

            {/* Error Banner */}
            {hasError && (
                <div className="mb-3 p-2 bg-red-600/10 border border-red-600/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <div className="flex-1 text-sm text-red-300">
                        Streaming was interrupted. Content may be incomplete.
                    </div>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleManualRetry}
                            className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Retry
                        </Button>
                    </div>
                </div>
            )}

            {/* Message Content */}
            <div className="relative">
                <MarkdownRenderer
                    content={displayContent || "..."}
                    className="text-purple-100"
                    isStreaming={isStreaming}
                />

                {/* Streaming Cursor */}
                {isStreaming && !hasError && (
                    <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1 align-middle" />
                )}
            </div>

            {/* Connection Status Footer */}
            {isStreaming && (
                <div className="mt-2 flex items-center justify-between text-xs text-purple-400">
                    <div className="flex items-center gap-2">
                        {hasError ? (
                            <WifiOff className="w-3 h-3 text-red-400" />
                        ) : (
                            <Wifi className="w-3 h-3 text-green-400" />
                        )}
                        <span>
                            Position: {content.length} |{" "}
                            {hasError ? "Offline" : "Connected"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
