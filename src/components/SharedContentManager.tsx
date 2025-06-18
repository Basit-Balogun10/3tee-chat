import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import {
    Users,
    GitFork,
    Eye,
    Trash2,
    ExternalLink,
    RefreshCw,
} from "lucide-react";

interface SharedContentManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SharedContentManager: React.FC<SharedContentManagerProps> = ({
    isOpen,
    onClose,
}) => {
    const [activeTab, setActiveTab] = useState<"chats" | "projects">("chats");
    const [isCleaningUp, setIsCleaningUp] = useState(false);

    const sharedContent = useQuery(api.sharing.getUserSharedContent);
    const removeFromSharedContent = useMutation(
        api.sharing.removeFromSharedContent
    );
    const cleanupSharedContent = useMutation(api.sharing.cleanupSharedContent);

    const handleRemoveFromShared = async (
        contentId: string,
        type: "chat" | "project"
    ) => {
        try {
            await removeFromSharedContent({ contentId, type });
        } catch (error) {
            console.error("Error removing from shared content:", error);
        }
    };

    const handleCleanupSharedContent = async () => {
        setIsCleaningUp(true);
        try {
            const result = await cleanupSharedContent();
            console.log(
                `Cleaned up ${result.removedChats} chats and ${result.removedProjects} projects`
            );
        } catch (error) {
            console.error("Error cleaning up shared content:", error);
        } finally {
            setIsCleaningUp(false);
        }
    };

    const handleOpenContent = (contentId: string, type: "chat" | "project") => {
        if (type === "chat") {
            window.open(`/chat/${contentId}`, "_blank");
        } else {
            window.open(`/project/${contentId}`, "_blank");
        }
    };

    const renderSharedChats = () => {
        if (!sharedContent?.sharedChats?.length) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No shared chats yet</p>
                    <p className="text-sm">
                        Chats shared with you in collaboration mode will appear
                        here
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {sharedContent.sharedChats.map((chat) => (
                    <div
                        key={chat._id}
                        className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="font-medium text-sm">
                                    {chat.title}
                                </h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <Badge
                                        variant="outline"
                                        className="text-xs px-1 py-0"
                                    >
                                        {chat.model}
                                    </Badge>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        <span>Collaboration</span>
                                    </div>
                                    {chat.viewCount && (
                                        <>
                                            <span>•</span>
                                            <div className="flex items-center gap-1">
                                                <Eye className="h-3 w-3" />
                                                <span>
                                                    {chat.viewCount} views
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {chat.sharedAt && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Shared{" "}
                                        {new Date(
                                            chat.sharedAt
                                        ).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        handleOpenContent(chat._id, "chat")
                                    }
                                    className="h-8 w-8 p-0"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        handleRemoveFromShared(chat._id, "chat")
                                    }
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderSharedProjects = () => {
        if (!sharedContent?.sharedProjects?.length) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No shared projects yet</p>
                    <p className="text-sm">
                        Projects shared with you in collaboration mode will
                        appear here
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {sharedContent.sharedProjects.map((project) => (
                    <div
                        key={project._id}
                        className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="font-medium text-sm">
                                    {project.name}
                                </h3>
                                {project.description && (
                                    <p className="text-xs text-gray-600 mt-1">
                                        {project.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        <span>Collaboration</span>
                                    </div>
                                    {project.viewCount && (
                                        <>
                                            <span>•</span>
                                            <div className="flex items-center gap-1">
                                                <Eye className="h-3 w-3" />
                                                <span>
                                                    {project.viewCount} views
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {project.sharedAt && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Shared{" "}
                                        {new Date(
                                            project.sharedAt
                                        ).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        handleOpenContent(
                                            project._id,
                                            "project"
                                        )
                                    }
                                    className="h-8 w-8 p-0"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        handleRemoveFromShared(
                                            project._id,
                                            "project"
                                        )
                                    }
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Shared Content
                        </DialogTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCleanupSharedContent}
                            disabled={isCleaningUp}
                            className="text-xs"
                        >
                            {isCleaningUp ? (
                                <div className="flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    <span>Cleaning...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3" />
                                    <span>Cleanup</span>
                                </div>
                            )}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex border-b">
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                activeTab === "chats"
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                            onClick={() => setActiveTab("chats")}
                        >
                            Shared Chats (
                            {sharedContent?.sharedChats?.length || 0})
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                activeTab === "projects"
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                            onClick={() => setActiveTab("projects")}
                        >
                            Shared Projects (
                            {sharedContent?.sharedProjects?.length || 0})
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="max-h-96 overflow-y-auto">
                        {activeTab === "chats"
                            ? renderSharedChats()
                            : renderSharedProjects()}
                    </div>

                    {/* Help Text */}
                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium mb-1">
                            About Shared Content:
                        </p>
                        <ul className="space-y-1">
                            <li>
                                • Content shared with you in{" "}
                                <strong>collaboration mode</strong> appears here
                            </li>
                            <li>
                                • You can contribute and edit collaborative
                                content
                            </li>
                            <li>
                                • <strong>Read-only</strong> shares are
                                automatically forked to your workspace
                            </li>
                            <li>
                                • Use the cleanup button to remove invalid
                                shared content
                            </li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
