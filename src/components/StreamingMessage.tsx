import React, { useState, useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useResumableStreaming } from "../hooks/useResumableStreaming";
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

    const {
        content,
        isStreaming,
        isResuming,
        error,
        lastPosition,
        manualResume,
        markStreamingComplete,
    } = useResumableStreaming({
        messageId,
        onContentUpdate: (newContent, streaming) => {
            setDisplayContent(newContent);
            setHasError(false);
            
            // Notify parent when streaming is complete
            if (!streaming && onStreamingComplete) {
                onStreamingComplete();
            }
        },
        // resumeInterval: 1000, // Check for updates every second
        resumeInterval: 0, // Check for updates every second
    });

    // Update display content when resumable streaming provides new content
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
                    onClick: () => void handleManualResume(),
                },
            });
        }
    }, [error]);

    const handleManualResume = async () => {
        try {
            setHasError(false);
            await manualResume();
            toast.success("Streaming resumed");
        } catch (err) {
            console.error("Manual resume failed:", err);
            toast.error("Failed to resume streaming");
        }
    };

    const handleMarkComplete = async () => {
        try {
            await markStreamingComplete();
            toast.success("Streaming marked as complete");
            if (onStreamingComplete) {
                onStreamingComplete();
            }
        } catch (err) {
            console.error("Failed to mark complete:", err);
            toast.error("Failed to mark as complete");
        }
    };

    return (
        <div className={`relative ${className}`}>
            {/* Streaming Status Indicator */}
            {isStreaming && (
                <div className="flex items-center gap-2 mb-2 text-xs">
                    {isResuming ? (
                        <>
                            <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-yellow-400">Resuming...</span>
                        </>
                    ) : hasError ? (
                        <>
                            <WifiOff className="w-3 h-3 text-red-400" />
                            <span className="text-red-400">Connection lost</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleManualResume}
                                className="h-5 px-2 text-xs text-red-400 hover:text-red-300"
                            >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-green-400">Streaming...</span>
                            <span className="text-purple-400">
                                {lastPosition} chars
                            </span>
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
                            onClick={handleManualResume}
                            className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Resume
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleMarkComplete}
                            className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                        >
                            Mark Complete
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
                            Position: {lastPosition} | {hasError ? "Offline" : "Connected"}
                        </span>
                    </div>
                    
                    {!hasError && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleMarkComplete}
                            className="h-5 px-2 text-xs text-purple-400 hover:text-purple-300"
                            title="Mark streaming as complete"
                        >
                            Mark Complete
                        </Button>
                    )}
                </div>
            )}

            {/* Debug Info (only in development) */}
            {process.env.NODE_ENV === "development" && (
                <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-400 space-y-1">
                    <div>Message ID: {messageId}</div>
                    <div>Content Length: {displayContent.length}</div>
                    <div>Last Position: {lastPosition}</div>
                    <div>Is Streaming: {isStreaming.toString()}</div>
                    <div>Is Resuming: {isResuming.toString()}</div>
                    <div>Has Error: {hasError.toString()}</div>
                    {error && <div className="text-red-400">Error: {error}</div>}
                </div>
            )}
        </div>
    );
}