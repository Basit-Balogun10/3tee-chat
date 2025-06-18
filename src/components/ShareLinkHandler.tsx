import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { ExternalLink, GitFork, Users, Eye, AlertCircle } from "lucide-react";

interface ShareLinkHandlerProps {
    children: React.ReactNode;
}

export const ShareLinkHandler: React.FC<ShareLinkHandlerProps> = ({
    children,
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [shareInfo, setShareInfo] = useState<{
        shareId: string;
        type: "chat" | "project";
        detected: boolean;
    } | null>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleShareLinkAccess = useMutation(
        api.sharing.handleShareLinkAccess
    );
    const canAccessSharedContent = useQuery(
        api.sharing.canAccessSharedContent,
        shareInfo
            ? { shareId: shareInfo.shareId, type: shareInfo.type }
            : "skip"
    );
    const getSharedChat = useQuery(
        api.sharing.getSharedChat,
        shareInfo?.type === "chat" ? { shareId: shareInfo.shareId } : "skip"
    );
    const getSharedProject = useQuery(
        api.sharing.getSharedProject,
        shareInfo?.type === "project" ? { shareId: shareInfo.shareId } : "skip"
    );

    // Detect share links in URL
    useEffect(() => {
        const detectShareLink = () => {
            const path = location.pathname;
            const searchParams = new URLSearchParams(location.search);

            // Check for share URL patterns
            // Pattern 1: /share/chat/[shareId]
            const chatShareMatch = path.match(/^\/share\/chat\/([a-f0-9-]+)$/);
            if (chatShareMatch) {
                setShareInfo({
                    shareId: chatShareMatch[1],
                    type: "chat",
                    detected: true,
                });
                setShowDialog(true);
                return;
            }

            // Pattern 2: /share/project/[shareId]
            const projectShareMatch = path.match(
                /^\/share\/project\/([a-f0-9-]+)$/
            );
            if (projectShareMatch) {
                setShareInfo({
                    shareId: projectShareMatch[1],
                    type: "project",
                    detected: true,
                });
                setShowDialog(true);
                return;
            }

            // Pattern 3: Query parameter ?share=[type]:[shareId]
            const shareParam = searchParams.get("share");
            if (shareParam) {
                const [type, shareId] = shareParam.split(":");
                if ((type === "chat" || type === "project") && shareId) {
                    setShareInfo({
                        shareId,
                        type: type,
                        detected: true,
                    });
                    setShowDialog(true);
                    return;
                }
            }

            // Pattern 4: Full URL detection in hash or query
            const hashShare = location.hash.match(/#share=([^&]+)/);
            if (hashShare) {
                const [type, shareId] = hashShare[1].split(":");
                if ((type === "chat" || type === "project") && shareId) {
                    setShareInfo({
                        shareId,
                        type: type,
                        detected: true,
                    });
                    setShowDialog(true);
                    return;
                }
            }
        };

        detectShareLink();
    }, [location]);

    const handleAcceptShare = async () => {
        if (!shareInfo || !canAccessSharedContent?.canAccess) return;

        setIsProcessing(true);
        try {
            const result = await handleShareLinkAccess({
                shareId: shareInfo.shareId,
                type: shareInfo.type,
            });

            // Emit event for ChatInterface to handle
            const shareContentProcessedEvent = new CustomEvent(
                "shareContentProcessed",
                {
                    detail: {
                        chatId: result.chatId,
                        projectId: result.projectId,
                        action: result.action,
                        type: shareInfo.type,
                    },
                }
            );
            document.dispatchEvent(shareContentProcessedEvent);

            // Navigate to the appropriate content
            if (shareInfo.type === "chat") {
                navigate(`/chat/${result.chatId}`);
            } else {
                navigate(`/project/${result.projectId}`);
            }

            // Show success message based on action
            if (result.action === "forked") {
                // Could show a toast notification here
                console.log(`${shareInfo.type} forked successfully`);
            } else if (result.action === "added_to_shared") {
                console.log(`Added to shared ${shareInfo.type}s`);
            }

            setShowDialog(false);
            setShareInfo(null);
        } catch (error) {
            console.error("Error accessing shared content:", error);
            // Could show error toast here
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = () => {
        setShowDialog(false);
        setShareInfo(null);
        navigate("/"); // Navigate to home
    };

    const renderSharePreview = () => {
        if (shareInfo?.type === "chat" && getSharedChat) {
            return (
                <div className="space-y-3">
                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold">
                            {getSharedChat.chat.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                            <Badge variant="secondary">
                                {getSharedChat.chat.model}
                            </Badge>
                            <span>•</span>
                            <span>
                                {getSharedChat.messages.length} messages
                            </span>
                            {getSharedChat.chat.viewCount && (
                                <>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                        <Eye className="h-3 w-3" />
                                        <span>
                                            {getSharedChat.chat.viewCount} views
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        {getSharedChat.messages.length > 0 && (
                            <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                                <p className="text-gray-600">Latest message:</p>
                                <p className="truncate">
                                    {
                                        getSharedChat.messages[
                                            getSharedChat.messages.length - 1
                                        ].content
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (shareInfo?.type === "project" && getSharedProject) {
            return (
                <div className="space-y-3">
                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold">
                            {getSharedProject.project.name}
                        </h3>
                        {getSharedProject.project.description && (
                            <p className="text-gray-600 mt-1">
                                {getSharedProject.project.description}
                            </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                            <span>{getSharedProject.chats.length} chats</span>
                            {getSharedProject.project.viewCount && (
                                <>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                        <Eye className="h-3 w-3" />
                                        <span>
                                            {getSharedProject.project.viewCount}{" "}
                                            views
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        {getSharedProject.chats.length > 0 && (
                            <div className="mt-3">
                                <p className="text-sm text-gray-600 mb-2">
                                    Recent chats:
                                </p>
                                <div className="space-y-1">
                                    {getSharedProject.chats
                                        .slice(0, 3)
                                        .map((chat) => (
                                            <div
                                                key={chat._id}
                                                className="text-sm p-2 bg-gray-50 rounded"
                                            >
                                                <div className="font-medium">
                                                    {chat.title}
                                                </div>
                                                <div className="text-gray-500">
                                                    {chat.messages?.length || 0}{" "}
                                                    messages
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading shared content...</p>
            </div>
        );
    };

    const getShareModeInfo = () => {
        if (!canAccessSharedContent) return null;

        const { shareMode, isOwner, canCollaborate } = canAccessSharedContent;

        if (isOwner) {
            return {
                icon: <ExternalLink className="h-4 w-4" />,
                text: "This is your own content",
                action: "Open",
                description: "You're accessing your own shared content",
            };
        }

        if (shareMode === "read-only") {
            return {
                icon: <GitFork className="h-4 w-4" />,
                text: "Read-only share",
                action: "Fork & Open",
                description: "A copy will be created in your workspace",
            };
        }

        if (shareMode === "collaboration") {
            return {
                icon: <Users className="h-4 w-4" />,
                text: "Collaboration share",
                action: "Join & Open",
                description: "You'll be added as a collaborator",
            };
        }

        return null;
    };

    return (
        <>
            {children}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ExternalLink className="h-5 w-5" />
                            Shared{" "}
                            {shareInfo?.type === "chat" ? "Chat" : "Project"}
                        </DialogTitle>
                    </DialogHeader>

                    {canAccessSharedContent?.canAccess === false ? (
                        <div className="text-center py-8">
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">
                                Unable to Access
                            </h3>
                            <p className="text-gray-600">
                                {canAccessSharedContent.reason === "not_found"
                                    ? "This share link is invalid or has been removed."
                                    : "This content is no longer shared publicly."}
                            </p>
                            <Button onClick={handleCancel} className="mt-4">
                                Return to Home
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {renderSharePreview()}

                            {getShareModeInfo() && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        {getShareModeInfo()!.icon}
                                        <span className="font-medium">
                                            {getShareModeInfo()!.text}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {getShareModeInfo()!.description}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAcceptShare}
                                    disabled={
                                        isProcessing ||
                                        !canAccessSharedContent?.canAccess
                                    }
                                    className="min-w-[120px]"
                                >
                                    {isProcessing ? (
                                        <div className="flex items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            <span>Processing...</span>
                                        </div>
                                    ) : (
                                        getShareModeInfo()?.action || "Access"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};
