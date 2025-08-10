import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
    Search,
    Star,
    StarOff,
    Grid,
    List,
    Trash2,
    FileText,
    Image,
    Video,
    Music,
    File,
    Code,
    Plus,
    Heart,
    TrendingUp,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { cn } from "../lib/utils";

interface LibraryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectItem?: (item: any) => void;
    chatId?: Id<"chats">;
    initialTab?: "attachments" | "artifacts" | "media";
    // Custom actions for specialized use cases (like attachment replacement)
    customActions?: Array<{
        label: string;
        icon: React.ReactNode;
        onClick: () => void;
        variant?: "default" | "outline" | "ghost";
    }>;
}

interface LibraryItem {
    id: string;
    type: "attachment" | "artifact" | "media";
    name: string;
    description?: string;
    isFavorited?: boolean;
    lastUsed?: number;
    tags?: string[];
    [key: string]: any;
}

export function LibraryModal({
    open,
    onOpenChange,
    onSelectItem,
    chatId,
    initialTab = "attachments",
    customActions,
}: LibraryModalProps) {
    const [activeTab, setActiveTab] = useState<
        "attachments" | "artifacts" | "media"
    >(initialTab);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [_selectedItems, _setSelectedItems] = useState<Set<string>>(
        new Set()
    );
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [sortBy, setSortBy] = useState<"recent" | "name" | "usage">("recent");

    // Queries for each library type
    const attachmentLibrary = useQuery(api.library.getAttachmentLibrary, {
        searchQuery: searchQuery || undefined,
        favoriteOnly: showFavoritesOnly,
        sortBy,
    });

    const artifactLibrary = useQuery(api.library.getArtifactLibrary, {
        searchQuery: searchQuery || undefined,
        favoriteOnly: showFavoritesOnly,
        sortBy,
    });

    const mediaLibrary = useQuery(api.library.getMediaLibrary, {
        searchQuery: searchQuery || undefined,
        favoriteOnly: showFavoritesOnly,
        sortBy,
    });

    const libraryStats = useQuery(api.library.getLibraryStats);

    // Mutations
    const updateAttachment = useMutation(
        api.library.updateAttachmentLibraryItem
    );
    const updateArtifact = useMutation(api.library.updateArtifactLibraryItem);
    const updateMedia = useMutation(api.library.updateMediaLibraryItem);
    const deleteAttachment = useMutation(
        api.library.deleteAttachmentLibraryItem
    );
    const deleteMedia = useMutation(api.library.deleteMediaLibraryItem);
    const addToChatActive = useMutation(api.library.addToChatActiveAttachments);
    const trackUsage = useMutation(api.library.trackLibraryItemUsage);

    // Current library data based on active tab
    const currentLibraryData = useMemo(() => {
        switch (activeTab) {
            case "attachments":
                return attachmentLibrary || [];
            case "artifacts":
                return artifactLibrary || [];
            case "media":
                return mediaLibrary || [];
            default:
                return [];
        }
    }, [activeTab, attachmentLibrary, artifactLibrary, mediaLibrary]);

    // Handle item selection
    const handleSelectItem = async (item: LibraryItem) => {
        if (onSelectItem) {
            onSelectItem(item);

            // Track usage if chatId is provided
            if (chatId) {
                try {
                    await trackUsage({
                        type: item.type,
                        itemId: item.id,
                        chatId,
                    });
                } catch (error) {
                    console.error("Failed to track usage:", error);
                }
            }

            onOpenChange(false);
        }
    };

    // Toggle favorite status
    const handleToggleFavorite = async (item: LibraryItem) => {
        try {
            const newFavoriteStatus = !item.isFavorited;

            if (item.type === "attachment") {
                await updateAttachment({
                    attachmentId: item.id as Id<"attachmentLibrary">,
                    isFavorited: newFavoriteStatus,
                });
            } else if (item.type === "artifact") {
                await updateArtifact({
                    artifactId: item.id,
                    isFavorited: newFavoriteStatus,
                });
            } else if (item.type === "media") {
                await updateMedia({
                    mediaId: item.id as Id<"mediaLibrary">,
                    isFavorited: newFavoriteStatus,
                });
            }

            toast.success(
                newFavoriteStatus
                    ? `Added ${item.name} to favorites`
                    : `Removed ${item.name} from favorites`
            );
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
            toast.error("Failed to update favorite status");
        }
    };

    // Delete item
    const handleDeleteItem = async (item: LibraryItem) => {
        if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
            return;
        }

        try {
            if (item.type === "attachment") {
                await deleteAttachment({
                    attachmentId: item.id as Id<"attachmentLibrary">,
                });
            } else if (item.type === "media") {
                await deleteMedia({
                    mediaId: item.id as Id<"mediaLibrary">,
                });
            }
            // Note: Artifacts are not deletable as they're tied to messages

            toast.success(`Deleted ${item.name}`);
        } catch (error) {
            console.error("Failed to delete item:", error);
            toast.error("Failed to delete item");
        }
    };

    // Add library item to message input via custom event
    const handleAddToMessage = async (item: LibraryItem) => {
        // Dispatch custom event that MessageInput will listen for
        const addLibraryItemEvent = new CustomEvent("addLibraryItemToMessage", {
            detail: {
                type: item.type,
                id: item.id,
                name: item.name,
                description: item.description,
                size: item.size,
                mimeType: item.mimeType,
            },
        });

        document.dispatchEvent(addLibraryItemEvent);
        toast.success(`Added ${item.name} to message input`);
    };

    // Get file type icon
    const getFileTypeIcon = (item: LibraryItem) => {
        if (item.type === "attachment") {
            switch (item.fileType) {
                case "image":
                    return <Image className="w-4 h-4" />;
                case "pdf":
                    return <FileText className="w-4 h-4" />;
                case "audio":
                    return <Music className="w-4 h-4" />;
                case "video":
                    return <Video className="w-4 h-4" />;
                default:
                    return <File className="w-4 h-4" />;
            }
        } else if (item.type === "artifact") {
            return <Code className="w-4 h-4" />;
        } else if (item.type === "media") {
            switch (item.mediaType) {
                case "image":
                    return <Image className="w-4 h-4" />;
                case "video":
                    return <Video className="w-4 h-4" />;
                case "audio":
                    return <Music className="w-4 h-4" />;
                default:
                    return <File className="w-4 h-4" />;
            }
        }
        return <File className="w-4 h-4" />;
    };

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    // Format relative time
    const formatRelativeTime = (timestamp?: number) => {
        if (!timestamp) return "Never";
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return "Just now";
    };

    // Render library item
    const renderLibraryItem = (item: LibraryItem) => {
        const isSelected = _selectedItems.has(item.id);

        if (viewMode === "grid") {
            return (
                <div
                    key={item.id}
                    className={cn(
                        "group relative p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-300 dark:hover:border-purple-600 transition-all cursor-pointer bg-white dark:bg-gray-800",
                        isSelected &&
                            "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    )}
                    onClick={() => handleSelectItem(item)}
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            {getFileTypeIcon(item)}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {item.name}
                                </h3>
                                {item.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                        {item.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(item);
                                }}
                                className="p-1 h-6 w-6"
                            >
                                {item.isFavorited ? (
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                ) : (
                                    <StarOff className="w-3 h-3" />
                                )}
                            </Button>

                            {chatId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToMessage(item);
                                    }}
                                    className="p-1 h-6 w-6"
                                    title="Add to message input"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            )}

                            {(item.type === "attachment" ||
                                item.type === "media") && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteItem(item);
                                    }}
                                    className="p-1 h-6 w-6 text-red-500 hover:text-red-600"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                            {item.type === "attachment" && item.size && (
                                <span>{formatFileSize(item.size)}</span>
                            )}
                            {item.type === "artifact" && item.language && (
                                <Badge
                                    variant="secondary"
                                    className="text-xs px-1 py-0"
                                >
                                    {item.language}
                                </Badge>
                            )}
                            {item.referenceCount && (
                                <span className="flex items-center space-x-1">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>{item.referenceCount}</span>
                                </span>
                            )}
                        </div>
                        <span>{formatRelativeTime(item.lastUsed)}</span>
                    </div>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {item.tags.slice(0, 3).map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="text-xs px-1 py-0"
                                >
                                    {tag}
                                </Badge>
                            ))}
                            {item.tags.length > 3 && (
                                <Badge
                                    variant="outline"
                                    className="text-xs px-1 py-0"
                                >
                                    +{item.tags.length - 3}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            );
        } else {
            // List view
            return (
                <div
                    key={item.id}
                    className={cn(
                        "group flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer",
                        isSelected && "bg-purple-50 dark:bg-purple-900/20"
                    )}
                    onClick={() => handleSelectItem(item)}
                >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getFileTypeIcon(item)}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {item.name}
                                </h3>
                                {item.isFavorited && (
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                )}
                            </div>
                            {item.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {item.description}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        {item.type === "attachment" && item.size && (
                            <span>{formatFileSize(item.size)}</span>
                        )}
                        {item.referenceCount && (
                            <span className="flex items-center space-x-1">
                                <TrendingUp className="w-3 h-3" />
                                <span>{item.referenceCount}</span>
                            </span>
                        )}
                        <span>{formatRelativeTime(item.lastUsed)}</span>

                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(item);
                                }}
                                className="p-1 h-6 w-6"
                            >
                                {item.isFavorited ? (
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                ) : (
                                    <StarOff className="w-3 h-3" />
                                )}
                            </Button>

                            {chatId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToMessage(item);
                                    }}
                                    className="p-1 h-6 w-6"
                                    title="Add to message input"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-full h-[80vh] flex flex-col p-0">
                <DialogHeader className="flex flex-row items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <DialogTitle className="text-lg font-semibold">
                            Library
                        </DialogTitle>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Manage your attachments, artifacts, and media
                        </p>
                    </div>

                    {libraryStats && (
                        <div className="flex items-center space-x-6 text-xs text-gray-500 dark:text-gray-400">
                            <div className="text-center">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {libraryStats.attachments.total}
                                </div>
                                <div>Attachments</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {libraryStats.artifacts.total}
                                </div>
                                <div>Artifacts</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {libraryStats.media.total}
                                </div>
                                <div>Media</div>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0">
                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="flex-1 flex flex-col"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <TabsList className="grid w-fit grid-cols-3">
                                <TabsTrigger
                                    value="attachments"
                                    className="flex items-center space-x-2"
                                >
                                    <File className="w-4 h-4" />
                                    <span>Attachments</span>
                                    {libraryStats && (
                                        <Badge
                                            variant="secondary"
                                            className="ml-1 text-xs"
                                        >
                                            {libraryStats.attachments.total}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="artifacts"
                                    className="flex items-center space-x-2"
                                >
                                    <Code className="w-4 h-4" />
                                    <span>Artifacts</span>
                                    {libraryStats && (
                                        <Badge
                                            variant="secondary"
                                            className="ml-1 text-xs"
                                        >
                                            {libraryStats.artifacts.total}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="media"
                                    className="flex items-center space-x-2"
                                >
                                    <Image className="w-4 h-4" />
                                    <span>Media</span>
                                    {libraryStats && (
                                        <Badge
                                            variant="secondary"
                                            className="ml-1 text-xs"
                                        >
                                            {libraryStats.media.total}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            {/* Controls */}
                            <div className="flex items-center space-x-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search library..."
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                        className="pl-10 w-64"
                                    />
                                </div>

                                <div className="flex items-center space-x-1 border rounded-lg p-1">
                                    <Button
                                        variant={
                                            showFavoritesOnly
                                                ? "default"
                                                : "ghost"
                                        }
                                        size="sm"
                                        onClick={() =>
                                            setShowFavoritesOnly(
                                                !showFavoritesOnly
                                            )
                                        }
                                        className="p-2"
                                    >
                                        <Heart className="w-4 h-4" />
                                    </Button>
                                </div>

                                <select
                                    value={sortBy}
                                    onChange={(e) =>
                                        setSortBy(e.target.value as any)
                                    }
                                    className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm bg-white dark:bg-gray-800"
                                >
                                    <option value="recent">Recent</option>
                                    <option value="name">Name</option>
                                    <option value="usage">Usage</option>
                                </select>

                                <div className="flex items-center space-x-1 border rounded-lg p-1">
                                    <Button
                                        variant={
                                            viewMode === "grid"
                                                ? "default"
                                                : "ghost"
                                        }
                                        size="sm"
                                        onClick={() => setViewMode("grid")}
                                        className="p-2"
                                    >
                                        <Grid className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant={
                                            viewMode === "list"
                                                ? "default"
                                                : "ghost"
                                        }
                                        size="sm"
                                        onClick={() => setViewMode("list")}
                                        className="p-2"
                                    >
                                        <List className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Tab Contents */}
                        <div className="flex-1 overflow-hidden">
                            <TabsContent
                                value={activeTab}
                                className="h-full m-0 p-6 overflow-y-auto"
                            >
                                {currentLibraryData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                            {activeTab === "attachments" && (
                                                <File className="w-8 h-8 text-gray-400" />
                                            )}
                                            {activeTab === "artifacts" && (
                                                <Code className="w-8 h-8 text-gray-400" />
                                            )}
                                            {activeTab === "media" && (
                                                <Image className="w-8 h-8 text-gray-400" />
                                            )}
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                                            No {activeTab} found
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                                            {searchQuery
                                                ? `No ${activeTab} match your search criteria.`
                                                : `You haven't added any ${activeTab} yet. Start by uploading files or creating content.`}
                                        </p>
                                    </div>
                                ) : (
                                    <div
                                        className={
                                            viewMode === "grid"
                                                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                                                : "space-y-0"
                                        }
                                    >
                                        {currentLibraryData.map(
                                            renderLibraryItem
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>

                    {/* Custom Actions - NEW */}
                    {customActions && customActions.length > 0 && (
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                Actions
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {customActions.map((action, index) => (
                                    <Button
                                        key={index}
                                        variant={action.variant || "default"}
                                        size="sm"
                                        onClick={action.onClick}
                                        className="flex items-center space-x-2"
                                    >
                                        {action.icon}
                                        <span>{action.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
