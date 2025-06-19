import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
    Share2,
    Copy,
    Eye,
    Users,
    Globe,
    Lock,
    Check,
    Info,
    X,
    AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface ShareModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemId: Id<"chats"> | Id<"projects">;
    itemType: "chat" | "project";
    itemTitle?: string;
}

export function ShareModal({
    open,
    onOpenChange,
    itemId,
    itemType,
    itemTitle,
}: ShareModalProps) {
    const [isPublic, setIsPublic] = useState(false);
    const [shareMode, setShareMode] = useState<"read-only" | "collaboration">(
        "read-only"
    );
    const [shareUrl, setShareUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Mutations for sharing
    const createChatShare = useMutation(api.sharing.createChatShare);
    const revokeChatShare = useMutation(api.sharing.revokeChatShare);
    const updateChatShareMode = useMutation(api.sharing.updateChatShareMode);
    const shareProject = useMutation(api.projects.shareProject);
    const unshareProject = useMutation(api.projects.unshareProject);

    // Query current item to get sharing status
    const chatData = useQuery(
        api.chats.getChat,
        itemType === "chat" ? { chatId: itemId as Id<"chats"> } : "skip"
    );
    const projectData = useQuery(
        api.projects.getProjectTree,
        itemType === "project" ? {} : "skip"
    );

    // Get current sharing status
    useEffect(() => {
        if (itemType === "chat" && chatData) {
            setIsPublic(chatData.isPublic || false);
            setShareMode(chatData.shareMode || "read-only");
            if (chatData.shareId) {
                // Fix: Use shareId with /share/chat/ prefix
                setShareUrl(
                    `${window.location.origin}/share/chat/${chatData.shareId}`
                );
            }
        } else if (itemType === "project" && projectData) {
            // Find the specific project in the tree
            const findProject = (projects: any[]): any => {
                for (const project of projects) {
                    if (project._id === itemId) return project;
                    const found = findProject(project.children || []);
                    if (found) return found;
                }
                return null;
            };

            const project = findProject(projectData.projects || []);
            if (project) {
                setIsPublic(project.isPublic || false);
                setShareMode(project.shareMode || "read-only");
                if (project.shareId) {
                    // Fix: Use shareId with /share/project/ prefix
                    setShareUrl(
                        `${window.location.origin}/share/project/${project.shareId}`
                    );
                }
            }
        }
    }, [chatData, projectData, itemId, itemType]);

    const handleTogglePublic = async (checked: boolean) => {
        setIsLoading(true);
        try {
            if (checked) {
                // Enable sharing
                let shareId: string;
                if (itemType === "chat") {
                    shareId = await createChatShare({
                        chatId: itemId as Id<"chats">,
                        shareMode,
                    });
                } else {
                    shareId = await shareProject({
                        projectId: itemId as Id<"projects">,
                        shareMode,
                    });
                }

                // Fix: Generate correct share URL with shareId
                const url = `${window.location.origin}/share/${itemType}/${shareId}`;
                setShareUrl(url);
                setIsPublic(true);

                // Copy to clipboard
                await navigator.clipboard.writeText(url);
                toast.success("Link copied to clipboard!", {
                    description: `${itemType === "chat" ? "Chat" : "Project"} is now ${shareMode === "read-only" ? "publicly viewable" : "open for collaboration"}`,
                    action: {
                        label: "Undo",
                        onClick: () => void handleTogglePublic(false),
                    },
                });
            } else {
                // Disable sharing
                if (itemType === "chat") {
                    await revokeChatShare({ chatId: itemId as Id<"chats"> });
                } else {
                    await unshareProject({
                        projectId: itemId as Id<"projects">,
                    });
                }

                setIsPublic(false);
                setShareUrl("");
                toast.success(
                    `${itemType === "chat" ? "Chat" : "Project"} is no longer public`
                );
            }
        } catch (_error) {
            console.error("Failed to update sharing:", _error);
            toast.error("Failed to update sharing settings");
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareModeChange = async (
        mode: "read-only" | "collaboration"
    ) => {
        if (!isPublic) {
            setShareMode(mode);
            return;
        }

        setIsLoading(true);
        try {
            if (itemType === "chat") {
                await updateChatShareMode({
                    chatId: itemId as Id<"chats">,
                    shareMode: mode,
                });
            } else {
                // For projects, we need to re-share with new mode
                await shareProject({
                    projectId: itemId as Id<"projects">,
                    shareMode: mode,
                });
            }

            setShareMode(mode);
            toast.success(
                `Updated to ${mode === "read-only" ? "read-only" : "collaboration"} mode`
            );
        } catch (_error) {
            console.error("Failed to update share mode:", _error);
            toast.error("Failed to update share mode");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Link copied to clipboard!");
        } catch (_error) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement("textarea");
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand("copy");
                toast.success("Link copied to clipboard!");
            } catch (_fallbackError) {
                toast.error("Failed to copy link");
            }
            document.body.removeChild(textArea);
        }
    };

    const shareModeTabs = [
        {
            id: "read-only" as const,
            label: "Read-only",
            icon: <Eye className="w-4 h-4" />,
            description: "Viewers can see content but cannot add messages",
            details:
                "New messages from viewers will automatically create their own fork",
        },
        {
            id: "collaboration" as const,
            label: "Collaboration",
            icon: <Users className="w-4 h-4" />,
            description: "Viewers can add messages and collaborate",
            details:
                "All participants can contribute directly to the conversation",
        },
    ];

    const flexibilityTips = [
        "Toggle public visibility on/off anytime",
        "Switch between read-only and collaboration modes freely",
        "Viewers can always fork content to their own workspace",
        itemType === "project"
            ? "Sharing includes all nested folders and chats"
            : "Individual messages remain private until shared",
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-2xl max-h-[85vh] overflow-y-scroll" hideCloseButton>
                <DialogHeader>
                    <DialogTitle className="text-purple-100 flex items-center gap-2">
                        <Share2 className="w-5 h-5" />
                        Share {itemType === "chat" ? "Chat" : "Project"}
                        <button
                            onClick={() => onOpenChange(false)}
                            className="ml-auto p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                        >
                            <X className="w-5 h-5 text-purple-300" />
                        </button>
                    </DialogTitle>
                    {itemTitle && (
                        <p
                            className="text-sm text-purple-400 truncate"
                            title={itemTitle}
                        >
                            {itemTitle}
                        </p>
                    )}
                </DialogHeader>

                <div className="space-y-6">
                    {/* Public Toggle */}
                    <div className="flex items-center justify-between p-4 bg-purple-600/10 rounded-lg border border-purple-600/20">
                        <div className="flex items-center gap-3">
                            {isPublic ? (
                                <Globe className="w-5 h-5 text-green-400" />
                            ) : (
                                <Lock className="w-5 h-5 text-purple-400" />
                            )}
                            <div>
                                <Label className="text-purple-200 font-medium">
                                    {isPublic ? "Public" : "Private"}
                                </Label>
                                <p className="text-sm text-purple-400/80">
                                    {isPublic
                                        ? `Anyone with the link can ${shareMode === "read-only" ? "view" : "collaborate"}`
                                        : `Only you can access this ${itemType}`}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={isPublic}
                            onCheckedChange={(checked) =>
                                void handleTogglePublic(checked)
                            }
                            disabled={isLoading}
                        />
                    </div>

                    {/* Share Mode Selection */}
                    {isPublic && (
                        <div>
                            <Label className="text-purple-200 mb-3 block">
                                Sharing Mode
                            </Label>
                            <div className="space-y-2">
                                {shareModeTabs.map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() =>
                                            void handleShareModeChange(mode.id)
                                        }
                                        disabled={isLoading}
                                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                                            shareMode === mode.id
                                                ? "border-purple-500/50 bg-purple-500/20"
                                                : "border-purple-600/30 hover:border-purple-500/40 hover:bg-purple-500/10"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            {mode.icon}
                                            <span className="font-medium text-purple-100">
                                                {mode.label}
                                            </span>
                                            {shareMode === mode.id && (
                                                <Check className="w-4 h-4 text-green-400 ml-auto" />
                                            )}
                                        </div>
                                        <p className="text-sm text-purple-300 mb-1">
                                            {mode.description}
                                        </p>
                                        <p className="text-xs text-purple-400/80">
                                            {mode.details}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Share URL */}
                    {isPublic && shareUrl && (
                        <div>
                            <Label className="text-purple-200 mb-2 block">
                                Share Link
                            </Label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-gray-800/50 border border-purple-600/30 rounded-lg px-3 py-2 text-sm text-purple-300 truncate">
                                    {shareUrl}
                                </div>
                                <Button
                                    onClick={() => void handleCopyLink()}
                                    size="sm"
                                    className="px-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200"
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Flexibility Tips */}
                    <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <Info className="w-4 h-4 text-blue-400" />
                            <h4 className="text-sm font-medium text-blue-200">
                                Sharing Flexibility
                            </h4>
                        </div>
                        <ul className="space-y-1">
                            {flexibilityTips.map((tip, index) => (
                                <li
                                    key={index}
                                    className="text-xs text-blue-300 flex items-start gap-2"
                                >
                                    <span className="text-blue-400 mt-0.5">
                                        •
                                    </span>
                                    <span>{tip}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Warning for collaboration mode */}
                    {isPublic && shareMode === "collaboration" && (
                        <div className="p-3 bg-orange-600/10 border border-orange-600/20 rounded-lg">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="text-sm font-medium text-orange-200 mb-1">
                                        Collaboration Mode
                                    </h4>
                                    <p className="text-xs text-orange-300">
                                        Anyone with the link can add messages.
                                        Consider switching to read-only if you
                                        only want to share for viewing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-4 border-t border-purple-600/20">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
