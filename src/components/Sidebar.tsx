import { Dispatch, SetStateAction, useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { UserAvatar } from "./UserAvatar";
import { SearchInput } from "./SearchInput";
import { ProjectTree } from "./ProjectTree";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";
import {
    Plus,
    PanelLeft,
    ChevronRight,
    ChevronDown,
    Folder,
    MessageSquare,
    FolderTree,
} from "lucide-react";
import { toast } from "sonner";

interface Chat {
    _id: Id<"chats">;
    title: string;
    model: string;
    updatedAt: number;
    isStarred?: boolean;
}

interface SidebarProps {
    chats: { starred: Chat[]; regular: Chat[] };
    selectedChatId: Id<"chats"> | null;
    onSelectChat: (chatId: Id<"chats">) => void;
    onNewChat: (projectId?: Id<"projects">) => void;
    onToggleCollapse: () => void;
    onOpenSettings?: () => void;
    setIsOpen: Dispatch<SetStateAction<boolean>>;
    // Add shared content support for Phase 3.4
    sharedContent?: {
        sharedChats: Chat[];
        sharedProjects: any[];
    };
}

export function Sidebar({
    chats,
    selectedChatId,
    onSelectChat,
    onNewChat,
    onToggleCollapse,
    onOpenSettings,
    setIsOpen,
    sharedContent, // Add shared content prop for Phase 3.4
}: SidebarProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [editingChatId, setEditingChatId] = useState<Id<"chats"> | null>(
        null
    );
    const [editTitle, setEditTitle] = useState("");

    // View toggle state - chat view vs project view
    const [isProjectView, setIsProjectView] = useLocalStorage(
        "isProjectView",
        false
    );

    // Local storage for UI state
    const [starredExpanded, setStarredExpanded] = useLocalStorage(
        "starredExpanded",
        true
    );

    // Get current user to check if anonymous
    const user = useQuery(api.users.getCurrentUser);
    const isAnonymous = !user?.email && !user?.name;

    const deleteChat = useMutation(api.chats.deleteChat);
    const toggleStar = useMutation(api.chats.toggleChatStar);
    const updateTitle = useMutation(api.chats.updateChatTitle);

    const searchInputRef = useRef<HTMLInputElement | null>(null);

    // Use custom shortcuts hook
    const { checkShortcutMatch } = useCustomShortcuts();

    // Handle keyboard shortcut events
    useEffect(() => {
        const handleDeleteCurrentChat = async (e: CustomEvent) => {
            const { chatId } = e.detail;
            await handleDeleteChat(chatId);
        };

        const handleToggleStarEvent = async (e: CustomEvent) => {
            const { chatId } = e.detail;
            await handleToggleStar(chatId);
        };

        const handleFocusSearch = (e: CustomEvent) => {
            const { openSidebarFirst } = e.detail;
            if (openSidebarFirst) {
                onToggleCollapse();
                // Small delay to ensure sidebar is open before focusing
                setTimeout(() => {
                    searchInputRef.current?.focus();
                }, 100);
            } else {
                searchInputRef.current?.focus();
            }
        };

        // Handle project view toggle keyboard shortcut using custom shortcuts
        const handleToggleProjectView = (e: KeyboardEvent) => {
            if (checkShortcutMatch(e, "toggle-project-view")) {
                e.preventDefault();
                setIsOpen(true);
                setIsProjectView(!isProjectView);
                toast.success(
                    `Switched to ${!isProjectView ? "project" : "chat"} view`
                );
            }
        };

        document.addEventListener(
            "deleteCurrentChat",
            handleDeleteCurrentChat as unknown as EventListener
        );
        document.addEventListener(
            "toggleCurrentChatStar",
            handleToggleStarEvent as unknown as EventListener
        );
        document.addEventListener(
            "focusSearch",
            handleFocusSearch as unknown as EventListener
        );
        document.addEventListener("keydown", handleToggleProjectView);

        return () => {
            document.removeEventListener(
                "deleteCurrentChat",
                handleDeleteCurrentChat as unknown as EventListener
            );
            document.removeEventListener(
                "toggleCurrentChatStar",
                handleToggleStarEvent as unknown as EventListener
            );
            document.removeEventListener(
                "focusSearch",
                handleFocusSearch as unknown as EventListener
            );
            document.removeEventListener("keydown", handleToggleProjectView);
        };
    }, [
        checkShortcutMatch,
        deleteChat,
        toggleStar,
        chats,
        selectedChatId,
        onSelectChat,
        onToggleCollapse,
        isProjectView,
        setIsProjectView,
    ]);

    // Helper function to categorize chats by date
    const categorizeByDate = (chats: Chat[]) => {
        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const thisYear = new Date(now.getFullYear(), 0, 1);
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);

        const categories: Record<string, Chat[]> = {
            TODAY: [],
            YESTERDAY: [],
            "LAST WEEK": [],
            "LAST MONTH": [],
            "THIS YEAR": [],
            "LAST YEAR": [],
        };

        chats.forEach((chat) => {
            const chatDate = new Date(chat.updatedAt);

            if (chatDate >= today) {
                categories["TODAY"].push(chat);
            } else if (chatDate >= yesterday) {
                categories["YESTERDAY"].push(chat);
            } else if (chatDate >= lastWeek) {
                categories["LAST WEEK"].push(chat);
            } else if (chatDate >= lastMonth) {
                categories["LAST MONTH"].push(chat);
            } else if (chatDate >= thisYear) {
                categories["THIS YEAR"].push(chat);
            } else if (chatDate >= lastYear) {
                categories["LAST YEAR"].push(chat);
            }
        });

        // Remove empty categories and return in order
        return Object.entries(categories).filter(
            ([_, chats]) => chats.length > 0
        );
    };

    const handleDeleteChat = async (
        chatId: Id<"chats">,
        e?: React.MouseEvent
    ) => {
        e?.stopPropagation();
        if (confirm("Are you sure you want to delete this chat?")) {
            await deleteChat({ chatId });
            if (selectedChatId === chatId) {
                const allChats = [...chats.starred, ...chats.regular];
                const remainingChats = allChats.filter((c) => c._id !== chatId);
                if (remainingChats[0]) {
                    onSelectChat(remainingChats[0]._id);
                }
            }
        }
    };

    const handleToggleStar = async (
        chatId: Id<"chats">,
        e?: React.MouseEvent
    ) => {
        e?.stopPropagation();

        try {
            await toggleStar({ chatId });
            const chat = [...chats.starred, ...chats.regular].find(
                (c) => c._id === chatId
            );
            toast.success(
                chat?.isStarred ? "Removed from starred" : "Added to starred"
            );
        } catch (error) {
            console.error("Failed to toggle star:", error);
            toast.error("Failed to update chat");
        }
    };

    const handleEditTitle = async (chatId: Id<"chats">) => {
        if (editTitle.trim()) {
            await updateTitle({ chatId, title: editTitle.trim() });
        }
        setEditingChatId(null);
        setEditTitle("");
    };

    const startEditing = (chat: Chat, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingChatId(chat._id);
        setEditTitle(chat.title);
    };

    const filteredChats = {
        starred: chats.starred.filter((chat) =>
            chat.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        regular: chats.regular.filter((chat) =>
            chat.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    };

    const renderChat = (chat: Chat) => (
        <div
            key={chat._id}
            onClick={() => onSelectChat(chat._id)}
            className={`group relative px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 mb-2 ${
                selectedChatId === chat._id
                    ? "bg-purple-500/20"
                    : "hover:bg-purple-500/10"
            } ${editingChatId === chat._id ? "bg-purple-500/10" : ""}`}
        >
            <div className="flex items-start">
                <div className="flex-1 min-w-0 group-hover:pr-28 transition-all duration-200">
                    {editingChatId === chat._id ? (
                        <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => void handleEditTitle(chat._id)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter")
                                    void handleEditTitle(chat._id);
                                if (e.key === "Escape") {
                                    setEditingChatId(null);
                                    setEditTitle("");
                                }
                            }}
                            className="w-full bg-transparent rounded text-purple-100 focus:outline-none"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <h3
                            className="text-purple-100 font-medium truncate"
                            title={`${chat.title}\nLast updated: ${new Date(chat.updatedAt).toLocaleString()}`}
                        >
                            {chat.title}
                        </h3>
                    )}
                </div>
                {!editingChatId && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 translate-x-6 group-hover:translate-x-0 transition-all duration-200 ease-out">
                        <button
                            onClick={(e) => void handleToggleStar(chat._id, e)}
                            className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                            title={
                                chat.isStarred
                                    ? "Remove from starred"
                                    : "Add to starred"
                            }
                        >
                            <svg
                                className={`w-4 h-4 ${
                                    chat.isStarred
                                        ? "text-yellow-400 fill-current"
                                        : "text-purple-400"
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => startEditing(chat, e)}
                            className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                            title="Edit chat title"
                        >
                            <svg
                                className="w-4 h-4 text-purple-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => handleDeleteChat(chat._id, e)}
                            className="p-1 rounded hover:bg-red-500/20 transition-colors"
                            title="Delete chat"
                        >
                            <svg
                                className="w-4 h-4 text-red-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-transparent backdrop-blur-sm border-r border-purple-600/10">
            {/* Header with 3Tee Chat title and controls */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onToggleCollapse}
                            className="p-2 rounded-lg bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 transition-all duration-200"
                        >
                            <PanelLeft className="w-5 h-5 text-purple-200" />
                        </button>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                            3Tee Chat
                        </h1>
                    </div>
                    <button
                        onClick={onNewChat}
                        className="p-2 rounded-lg bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 transition-all duration-200"
                        title="New Chat"
                    >
                        <Plus className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* View Toggle Buttons */}
                {!isAnonymous && (
                    <div className="flex bg-purple-500/10 rounded-lg p-1 mt-3 mb-4">
                        <button
                            onClick={() => setIsProjectView(false)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                !isProjectView
                                    ? "bg-purple-500/30 text-purple-100 shadow-sm"
                                    : "text-purple-300 hover:text-purple-200"
                            }`}
                        >
                            <MessageSquare className="w-4 h-4" />
                            Chats
                        </button>
                        <button
                            onClick={() => setIsProjectView(true)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                isProjectView
                                    ? "bg-purple-500/30 text-purple-100 shadow-sm"
                                    : "text-purple-300 hover:text-purple-200"
                            }`}
                        >
                            <FolderTree className="w-4 h-4" />
                            Projects
                        </button>
                    </div>
                )}

                <SearchInput
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={
                        isProjectView ? "Search projects..." : "Search chats..."
                    }
                    autoFocus={true}
                />
            </div>

            {/* Content Area - Chat List or Project Tree */}
            <div className="flex-1 overflow-y-scroll overflow-x-hidden">
                {isProjectView && !isAnonymous ? (
                    /* Project Tree View */
                    <div className="px-4">
                        <ProjectTree
                            onCreateChat={onNewChat}
                            onSelectChat={onSelectChat}
                            selectedChatId={selectedChatId}
                            searchQuery={searchQuery}
                        />
                    </div>
                ) : (
                    /* Chat List View */
                    <>
                        {filteredChats.starred.length === 0 &&
                        filteredChats.regular.length === 0 &&
                        searchQuery ? (
                            <div className="p-4 text-center text-purple-300">
                                No chats found
                            </div>
                        ) : (
                            <div className="px-4 py-3">
                                {/* Starred Chats - Collapsible */}
                                {filteredChats.starred.length > 0 && (
                                    <div className="mb-2">
                                        <button
                                            onClick={() =>
                                                setStarredExpanded(
                                                    !starredExpanded
                                                )
                                            }
                                            className="flex items-center justify-between w-full px-2 py-4 hover:bg-purple-500/10 rounded-lg transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-semibold text-purple-200/80 uppercase tracking-wider">
                                                    STARRED (
                                                    {
                                                        filteredChats.starred
                                                            .length
                                                    }
                                                    )
                                                </h4>
                                            </div>
                                            {starredExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-purple-200/80" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-purple-200/80" />
                                            )}
                                        </button>
                                        {starredExpanded && (
                                            <div className="mt-2">
                                                {filteredChats.starred.map(
                                                    renderChat
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* SHARED CHATS Section - Phase 3.4 */}
                                {sharedContent?.sharedChats &&
                                    sharedContent.sharedChats.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="text-xs font-semibold text-blue-200/80 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                                                <svg
                                                    className="w-3 h-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                                    />
                                                </svg>
                                                SHARED CHATS (
                                                {
                                                    sharedContent.sharedChats
                                                        .length
                                                }
                                                )
                                            </h4>
                                            <div className="space-y-1">
                                                {sharedContent.sharedChats.map(
                                                    (chat) => (
                                                        <div
                                                            key={chat._id}
                                                            onClick={() =>
                                                                onSelectChat(
                                                                    chat._id
                                                                )
                                                            }
                                                            className={`group relative px-2 py-3 rounded-lg cursor-pointer transition-all duration-200 border border-blue-500/20 ${
                                                                selectedChatId ===
                                                                chat._id
                                                                    ? "bg-blue-500/20"
                                                                    : "hover:bg-blue-500/10"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <svg
                                                                    className="w-3 h-3 text-blue-400 flex-shrink-0"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        strokeWidth={
                                                                            2
                                                                        }
                                                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                                                    />
                                                                </svg>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3
                                                                        className="text-blue-100 font-medium truncate"
                                                                        title={
                                                                            chat.title
                                                                        }
                                                                    >
                                                                        {
                                                                            chat.title
                                                                        }
                                                                    </h3>
                                                                    <p className="text-xs text-blue-300/60 truncate">
                                                                        Collaborative
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* SHARED PROJECTS Section - Phase 3.4 */}
                                {sharedContent?.sharedProjects &&
                                    sharedContent.sharedProjects.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="text-xs font-semibold text-green-200/80 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                                                <svg
                                                    className="w-3 h-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                                    />
                                                </svg>
                                                SHARED PROJECTS (
                                                {
                                                    sharedContent.sharedProjects
                                                        .length
                                                }
                                                )
                                            </h4>
                                            <div className="space-y-1">
                                                {sharedContent.sharedProjects.map(
                                                    (project) => (
                                                        <div
                                                            key={project._id}
                                                            onClick={() => {
                                                                // Navigate to project view for shared projects
                                                                window.location.href = `/project/${project._id}`;
                                                            }}
                                                            className="group relative px-2 py-3 rounded-lg cursor-pointer transition-all duration-200 border border-green-500/20 hover:bg-green-500/10"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <svg
                                                                    className="w-3 h-3 text-green-400 flex-shrink-0"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        strokeWidth={
                                                                            2
                                                                        }
                                                                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                                                    />
                                                                </svg>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3
                                                                        className="text-green-100 font-medium truncate"
                                                                        title={
                                                                            project.name
                                                                        }
                                                                    >
                                                                        {
                                                                            project.name
                                                                        }
                                                                    </h3>
                                                                    <p className="text-xs text-green-300/60 truncate">
                                                                        {project.description ||
                                                                            "Collaborative project"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* Regular Chats - Organized by Date */}
                                {filteredChats.regular.length > 0 && (
                                    <div>
                                        {categorizeByDate(
                                            filteredChats.regular
                                        ).map(([category, categoryChats]) => (
                                            <div
                                                key={category}
                                                className="mb-4"
                                            >
                                                <h4 className="text-xs font-semibold text-purple-200/80 uppercase tracking-wider mb-2 px-2">
                                                    {category}
                                                </h4>
                                                {categoryChats.map(renderChat)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* User Avatar */}
            <div className="p-4 border-purple-600/20">
                <UserAvatar onOpenSettings={onOpenSettings} />
            </div>
        </div>
    );
}
