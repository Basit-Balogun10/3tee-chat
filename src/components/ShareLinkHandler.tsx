import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { ExternalLink, GitFork, Users, Eye, AlertCircle, Share2, MessageSquare, Folder, X } from "lucide-react";
import { toast } from "sonner";

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
                toast.success(`${shareInfo.type} forked successfully`);
            } else if (result.action === "added_to_shared") {
                toast.success(`Added to shared ${shareInfo.type}s`);
            }

            setShowDialog(false);
            setShareInfo(null);
        } catch (error) {
            console.error("Error accessing shared content:", error);
            toast.error("Failed to access shared content");
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
                <div className="space-y-4">
                    <div className="p-4 bg-purple-600/10 rounded-lg border border-purple-600/20">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-purple-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-purple-100 text-lg mb-2">
                                    {getSharedChat.chat.title}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-purple-300/80 mb-3">
                                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 border-purple-500/30">
                                        {getSharedChat.chat.model}
                                    </Badge>
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" />
                                        {getSharedChat.messages.length} messages
                                    </span>
                                    {getSharedChat.chat.viewCount && (
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-3 h-3" />
                                            {getSharedChat.chat.viewCount} views
                                        </span>
                                    )}
                                </div>
                                {getSharedChat.messages.length > 0 && (
                                    <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                        <p className="text-sm text-purple-300/80 mb-1">Latest message:</p>
                                        <p className="text-purple-100 text-sm leading-relaxed line-clamp-2">
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
                    </div>
                </div>
            );
        }

        if (shareInfo?.type === "project" && getSharedProject) {
            return (
                <div className="space-y-4">
                    <div className="p-4 bg-purple-600/10 rounded-lg border border-purple-600/20">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Folder className="w-5 h-5 text-purple-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-purple-100 text-lg mb-2">
                                    {getSharedProject.project.name}
                                </h3>
                                {getSharedProject.project.description && (
                                    <p className="text-purple-200/80 mb-3 text-sm leading-relaxed">
                                        {getSharedProject.project.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-3 text-sm text-purple-300/80 mb-3">
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" />
                                        {getSharedProject.chats.length} chats
                                    </span>
                                    {getSharedProject.project.viewCount && (
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-3 h-3" />
                                            {getSharedProject.project.viewCount} views
                                        </span>
                                    )}
                                </div>
                                {getSharedProject.chats.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm text-purple-300/80">
                                            Recent chats:
                                        </p>
                                        <div className="space-y-1">
                                            {getSharedProject.chats
                                                .slice(0, 3)
                                                .map((chat) => (
                                                    <div
                                                        key={chat._id}
                                                        className="flex items-center justify-between p-2 bg-purple-500/10 rounded border border-purple-500/20"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-purple-100 truncate">
                                                                {chat.title}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-purple-300/60 ml-2">
                                                            {chat.messages?.length || 0} msgs
                                                        </div>
                                                    </div>
                                                ))}
                                            {getSharedProject.chats.length > 3 && (
                                                <div className="text-xs text-purple-300/60 text-center py-1">
                                                    +{getSharedProject.chats.length - 3} more chats
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-purple-200/80">Loading shared content...</p>
            </div>
        );
    };

    const getShareModeInfo = () => {
        if (!canAccessSharedContent) return null;

        const { shareMode, isOwner, canCollaborate } = canAccessSharedContent;

        if (isOwner) {
            return {
                icon: <ExternalLink className="w-4 h-4" />,
                text: "Your Content",
                action: "Open",
                description: "This is your own shared content",
                color: "bg-blue-600/10 border-blue-600/20 text-blue-200",
                iconColor: "text-blue-300",
            };
        }

        if (shareMode === "read-only") {
            return {
                icon: <GitFork className="w-4 h-4" />,
                text: "Read-Only Share",
                action: "Fork & Open",
                description: "A copy will be created in your workspace",
                color: "bg-green-600/10 border-green-600/20 text-green-200",
                iconColor: "text-green-300",
            };
        }

        if (shareMode === "collaboration") {
            return {
                icon: <Users className="w-4 h-4" />,
                text: "Collaboration Share",
                action: "Join & Open",
                description: "You'll be added as a collaborator",
                color: "bg-orange-600/10 border-orange-600/20 text-orange-200",
                iconColor: "text-orange-300",
            };
        }

        return null;
    };

    return (
        <>
            {children}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-2xl" hideCloseButton>
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-purple-300" />
                                <span className="text-lg font-semibold text-purple-100">
                                    Shared {shareInfo?.type === "chat" ? "Chat" : "Project"}
                                </span>
                            </div>
                            <button
                                onClick={handleCancel}
                                className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                            >
                                <X className="w-5 h-5 text-purple-300" />
                            </button>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {canAccessSharedContent?.canAccess === false ? (
                            <div className="text-center py-12">
                                <div className="p-4 bg-red-600/10 rounded-full w-fit mx-auto mb-4">
                                    <AlertCircle className="w-12 h-12 text-red-400" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2 text-purple-100">
                                    Unable to Access
                                </h3>
                                <p className="text-purple-200/80 max-w-sm mx-auto leading-relaxed">
                                    {canAccessSharedContent.reason === "not_found"
                                        ? "This share link is invalid or has been removed."
                                        : "This content is no longer shared publicly."}
                                </p>
                                <Button 
                                    onClick={handleCancel} 
                                    className="mt-6 bg-purple-600/80 hover:bg-purple-600/70 text-white"
                                >
                                    Return to Home
                                </Button>
                            </div>
                        ) : (
                            <>
                                {renderSharePreview()}

                                {getShareModeInfo() && (
                                    <div className={`p-4 rounded-lg border ${getShareModeInfo()!.color}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={getShareModeInfo()!.iconColor}>
                                                {getShareModeInfo()!.icon}
                                            </span>
                                            <span className="font-medium">
                                                {getShareModeInfo()!.text}
                                            </span>
                                        </div>
                                        <p className="text-sm opacity-80">
                                            {getShareModeInfo()!.description}
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-3 justify-end pt-4 border-t border-purple-600/20">
                                    <Button
                                        variant="ghost"
                                        onClick={handleCancel}
                                        className="text-purple-200 hover:bg-purple-500/20"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleAcceptShare}
                                        disabled={
                                            isProcessing ||
                                            !canAccessSharedContent?.canAccess
                                        }
                                        className="min-w-[140px] bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-600/70 hover:to-indigo-600/70 text-white"
                                    >
                                        {isProcessing ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                <span>Processing...</span>
                                            </div>
                                        ) : (
                                            getShareModeInfo()?.action || "Access"
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
