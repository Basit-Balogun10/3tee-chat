import React from "react";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface MessageBranchNavigatorProps {
    messageId: Id<"messages">;
    className?: string;
}

export function MessageBranchNavigator({
    messageId,
    className = "",
}: MessageBranchNavigatorProps) {
    const branches = useQuery(api.messages.getMessageBranches, { messageId });
    const switchBranch = useMutation(api.messages.switchMessageBranch);
    const [isLoading, setIsLoading] = useState(false);

    if (!branches || branches.branches.length <= 1) {
        return null;
    }

    const handleSwitchBranch = async (newIndex: number) => {
        if (newIndex === branches.currentBranchIndex || isLoading) return;

        setIsLoading(true);
        try {
            await switchBranch({ messageId, branchIndex: newIndex });
            toast.success(`Switched to branch ${newIndex + 1}`);
        } catch (error) {
            console.error("Failed to switch branch:", error);
            toast.error("Failed to switch branch");
        } finally {
            setIsLoading(false);
        }
    };

    const canGoPrev = branches.currentBranchIndex > 0;
    const canGoNext =
        branches.currentBranchIndex < branches.branches.length - 1;

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                    handleSwitchBranch(branches.currentBranchIndex - 1)
                }
                disabled={!canGoPrev || isLoading}
                className="h-6 w-6 p-0 text-purple-400 hover:text-purple-200 disabled:text-purple-600"
                title="Previous branch"
            >
                <ChevronLeft className="w-3 h-3" />
            </Button>

            <span className="text-xs text-purple-400 font-mono px-1">
                {branches.currentBranchIndex + 1}/{branches.branches.length}
            </span>

            <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                    handleSwitchBranch(branches.currentBranchIndex + 1)
                }
                disabled={!canGoNext || isLoading}
                className="h-6 w-6 p-0 text-purple-400 hover:text-purple-200 disabled:text-purple-600"
                title="Next branch"
            >
                <ChevronRight className="w-3 h-3" />
            </Button>
        </div>
    );
}
