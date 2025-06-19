// Custom hook for simple resumable streaming
import { useState, useEffect, useRef, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface UseResumableStreamingOptions {
    messageId?: Id<"messages">;
    onContentUpdate?: (content: string, isStreaming: boolean) => void;
    resumeInterval?: number; // How often to check for updates (ms)
}

interface StreamingState {
    content: string;
    isStreaming: boolean;
    lastPosition: number;
    isResuming: boolean;
    error: string | null;
}

export function useResumableStreaming({
    messageId,
    onContentUpdate,
    resumeInterval = 10000,
}: UseResumableStreamingOptions) {
    const [state, setState] = useState<StreamingState>({
        content: "",
        isStreaming: false,
        lastPosition: 0,
        isResuming: false,
        error: null,
    });

    const resumeStreaming = useAction(api.ai.resumeStreaming);
    const markComplete = useAction(api.ai.markStreamingComplete);
    
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isActiveRef = useRef(true);

    // Resume streaming from current position
    const resumeFromPosition = useCallback(async () => {
        if (!messageId || !isActiveRef.current) return;

        try {
            setState(prev => ({ ...prev, isResuming: true, error: null }));
            
            const result = await resumeStreaming({
                messageId,
                fromPosition: state.lastPosition,
            });

            if (!isActiveRef.current) return;

            const newContent = state.content + result.content;
            const newState = {
                content: newContent,
                isStreaming: !result.isComplete,
                lastPosition: result.streamPosition,
                isResuming: false,
                error: null,
            };

            setState(newState);
            onContentUpdate?.(newContent, !result.isComplete);

            // If streaming is complete, mark it as such
            if (result.isComplete && state.isStreaming) {
                await markComplete({ messageId });
            }

            return result;
        } catch (error) {
            if (!isActiveRef.current) return;
            
            console.error("Resume streaming error:", error);
            setState(prev => ({
                ...prev,
                isResuming: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }));
        }
    }, [messageId, state.lastPosition, state.content, state.isStreaming, resumeStreaming, markComplete, onContentUpdate]);

    // Initialize or resume streaming when messageId changes
    useEffect(() => {
        if (!messageId) {
            setState({
                content: "",
                isStreaming: false,
                lastPosition: 0,
                isResuming: false,
                error: null,
            });
            return;
        }

        // Reset state for new message
        setState({
            content: "",
            isStreaming: true,
            lastPosition: 0,
            isResuming: false,
            error: null,
        });

        // Start polling for updates
        const startPolling = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            intervalRef.current = setInterval(async () => {
                if (!isActiveRef.current) return;
                
                await resumeFromPosition();
            }, 10000);
            // }, resumeInterval);
        };

        // Initial resume call
        resumeFromPosition().then(() => {
            if (isActiveRef.current) {
                startPolling();
            }
        });

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [messageId, resumeInterval, resumeFromPosition]);

    // Stop polling when streaming is complete
    useEffect(() => {
        if (!state.isStreaming && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, [state.isStreaming]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Manual resume function for when connection is restored
    const manualResume = useCallback(async () => {
        return await resumeFromPosition();
    }, [resumeFromPosition]);

    // Mark streaming as complete (called by frontend when user sees full content)
    const markStreamingComplete = useCallback(async () => {
        if (!messageId) return;
        
        try {
            await markComplete({ messageId });
            setState(prev => ({ ...prev, isStreaming: false }));
        } catch (error) {
            console.error("Failed to mark streaming complete:", error);
        }
    }, [messageId, markComplete]);

    return {
        content: state.content,
        isStreaming: state.isStreaming,
        isResuming: state.isResuming,
        error: state.error,
        lastPosition: state.lastPosition,
        manualResume,
        markStreamingComplete,
    };
}