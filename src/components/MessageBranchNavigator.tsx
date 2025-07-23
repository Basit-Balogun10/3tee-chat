import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Edit3 } from "lucide-react";
import { Button } from "./ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface MessageBranchNavigatorProps {
    messageId: Id<"messages">;
    onRetry?: () => void;
    onEdit?: () => void;
    className?: string;
}

export function MessageBranchNavigator({
    messageId,
    onRetry,
    onEdit,
    className = "",
}: MessageBranchNavigatorProps) {
    // Query for message versions (retries)
    const versionsData = useQuery(api.messages.getMessageVersions, {
        messageId,
    });

    // PHASE 6 FIX: Query for message branches using corrected system with preloaded content
    const branchesData = useQuery(api.branches.getMessageBranches, {
        messageId,
    });

    const switchVersion = useMutation(api.messages.switchMessageVersion);
    const navigateToBranch = useMutation(api.branches.navigateToBranch);

    const [isLoading, setIsLoading] = useState(false);
    const [loadingOperation, setLoadingOperation] = useState<string>("");

    // Check if we have multiple versions (retry system)
    const hasVersions = versionsData && versionsData.totalVersions > 1;
    const hasBranches = branchesData && branchesData.totalBranches > 1;

    // PHASE 6 FIX: Prefetch branch content previews for hover tooltips
    const branchPreviews = useMemo(() => {
        if (!branchesData) return {};
        
        const previews: Record<string, string> = {};
        branchesData.branches.forEach((branch, index) => {
            // Create preview from branch description and metadata
            const branchNum = index + 1;
            const isActive = branch.isActive ? " (current)" : "";
            previews[branch.id] = `Branch ${branchNum}${isActive}: ${branch.description || "No description"}`;
        });
        
        return previews;
    }, [branchesData]);

    // PHASE 6 FIX: Version content previews
    const versionPreviews = useMemo(() => {
        if (!versionsData) return {};
        
        const previews: Record<string, string> = {};
        versionsData.versions.forEach((version, index) => {
            const versionNum = index + 1;
            const isActive = version.isActive ? " (current)" : "";
            const contentPreview = version.content.length > 100 
                ? version.content.substring(0, 100) + "..."
                : version.content;
            previews[version.versionId] = `Version ${versionNum}${isActive} (${version.model}): ${contentPreview}`;
        });
        
        return previews;
    }, [versionsData]);

    // Don't render if no navigation needed
    if (!hasVersions && !hasBranches) {
        return null;
    }

    const handleVersionNavigation = async (direction: "prev" | "next") => {
        if (!versionsData || isLoading) return;

        setIsLoading(true);
        setLoadingOperation(`Switching to ${direction === "prev" ? "previous" : "next"} version...`);
        
        try {
            const currentIndex = versionsData.currentVersionIndex;
            let newIndex;

            if (direction === "prev") {
                newIndex = currentIndex > 0 ? currentIndex - 1 : versionsData.totalVersions - 1;
            } else {
                newIndex = currentIndex < versionsData.totalVersions - 1 ? currentIndex + 1 : 0;
            }

            const targetVersion = versionsData.versions[newIndex];
            if (targetVersion) {
                await switchVersion({
                    messageId,
                    versionId: targetVersion.versionId,
                });

                console.log("🔄 VERSION NAVIGATION:", {
                    messageId,
                    direction,
                    fromVersion: currentIndex + 1,
                    toVersion: newIndex + 1,
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error("Error switching version:", error);
            toast.error("Failed to switch version");
        } finally {
            setIsLoading(false);
            setLoadingOperation("");
        }
    };

    const handleBranchNavigation = async (direction: "prev" | "next") => {
        if (!branchesData || isLoading) return;

        setIsLoading(true);
        setLoadingOperation(`Switching to ${direction === "prev" ? "previous" : "next"} branch...`);
        
        try {
            const currentBranches = branchesData.branches;
            const currentActiveIndex = currentBranches.findIndex(branch => branch.isActive);
            
            if (currentActiveIndex === -1) {
                console.error("No active branch found");
                toast.error("Unable to navigate branches");
                return;
            }
            
            let newIndex;
            if (direction === "prev") {
                newIndex = currentActiveIndex > 0 ? currentActiveIndex - 1 : branchesData.totalBranches - 1;
            } else {
                newIndex = currentActiveIndex < branchesData.totalBranches - 1 ? currentActiveIndex + 1 : 0;
            }

            const targetBranch = currentBranches[newIndex];
            if (targetBranch) {
                const result = await navigateToBranch({
                    messageId,
                    branchId: targetBranch.id,
                });

                if (result.success) {
                    console.log("🌿 BRANCH NAVIGATION SUCCESS:", {
                        messageId,
                        direction,
                        fromBranch: currentActiveIndex + 1,
                        toBranch: newIndex + 1,
                        targetBranchId: targetBranch.id,
                        branchName: result.branchName,
                        timestamp: new Date().toISOString(),
                    });

                    toast.success(`Switched to ${result.branchName}`);
                } else {
                    throw new Error("Branch navigation failed");
                }
            }
        } catch (error) {
            console.error("Error switching branch:", error);
            toast.error(`Failed to switch branch: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoading(false);
            setLoadingOperation("");
        }
    };

    return (
        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
            {/* PHASE 6 FIX: Conversation Branches Navigator with Content Previews */}
            {hasBranches && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-blue-100/50 dark:hover:bg-blue-800/50"
                        onClick={() => void handleBranchNavigation("prev")}
                        disabled={isLoading}
                        title={(() => {
                            if (isLoading) return "Switching...";
                            const currentBranches = branchesData.branches;
                            const currentActiveIndex = currentBranches.findIndex(branch => branch.isActive);
                            const prevIndex = currentActiveIndex > 0 ? currentActiveIndex - 1 : branchesData.totalBranches - 1;
                            const prevBranch = currentBranches[prevIndex];
                            return prevBranch ? branchPreviews[prevBranch.id] || "Previous branch" : "Previous branch";
                        })()}
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </Button>

                    <span className="text-blue-700 dark:text-blue-300 font-mono min-w-[2rem] text-center">
                        {branchesData.navigationDisplay}
                    </span>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-blue-100/50 dark:hover:bg-blue-800/50"
                        onClick={() => void handleBranchNavigation("next")}
                        disabled={isLoading}
                        title={(() => {
                            if (isLoading) return "Switching...";
                            const currentBranches = branchesData.branches;
                            const currentActiveIndex = currentBranches.findIndex(branch => branch.isActive);
                            const nextIndex = currentActiveIndex < branchesData.totalBranches - 1 ? currentActiveIndex + 1 : 0;
                            const nextBranch = currentBranches[nextIndex];
                            return nextBranch ? branchPreviews[nextBranch.id] || "Next branch" : "Next branch";
                        })()}
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>

                    {onEdit && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-1 hover:bg-blue-100/50 dark:hover:bg-blue-800/50"
                            onClick={onEdit}
                            title="Edit message (creates new branch)"
                        >
                            <Edit3 className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            )}

            {/* PHASE 6 FIX: Message Versions Navigator with Content Previews */}
            {hasVersions && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-purple-100/50 dark:hover:bg-purple-800/50"
                        onClick={() => void handleVersionNavigation("prev")}
                        disabled={isLoading}
                        title={(() => {
                            if (isLoading) return "Switching...";
                            const currentIndex = versionsData.currentVersionIndex;
                            const prevIndex = currentIndex > 0 ? currentIndex - 1 : versionsData.totalVersions - 1;
                            const prevVersion = versionsData.versions[prevIndex];
                            return prevVersion ? versionPreviews[prevVersion.versionId] || "Previous version" : "Previous version";
                        })()}
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </Button>

                    <span className="text-purple-700 dark:text-purple-300 font-mono min-w-[2rem] text-center">
                        {(versionsData.currentVersionIndex || 0) + 1}/{versionsData.totalVersions}
                    </span>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-purple-100/50 dark:hover:bg-purple-800/50"
                        onClick={() => void handleVersionNavigation("next")}
                        disabled={isLoading}
                        title={(() => {
                            if (isLoading) return "Switching...";
                            const currentIndex = versionsData.currentVersionIndex;
                            const nextIndex = currentIndex < versionsData.totalVersions - 1 ? currentIndex + 1 : 0;
                            const nextVersion = versionsData.versions[nextIndex];
                            return nextVersion ? versionPreviews[nextVersion.versionId] || "Next version" : "Next version";
                        })()}
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>

                    {onRetry && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-1 hover:bg-purple-100/50 dark:hover:bg-purple-800/50"
                            onClick={onRetry}
                            title="Retry message (creates new version)"
                        >
                            <RotateCcw className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            )}

            {/* PHASE 6 FIX: Enhanced Loading States */}
            {isLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-800/50 px-3 py-1 rounded-md border border-gray-600/30">
                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-purple-300">{loadingOperation || "Processing..."}</span>
                </div>
            )}
        </div>
    );
}
