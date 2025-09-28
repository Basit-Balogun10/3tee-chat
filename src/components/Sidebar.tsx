import { Dispatch, SetStateAction, useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { UserAvatar } from "./UserAvatar";
import { SearchInput } from "./SearchInput";
import { ProjectTree } from "./ProjectTree";
import { AdvancedSearchModal } from "./AdvancedSearchModal";
import { LibraryModal } from "./LibraryModal";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";
import {
    Plus,
    PanelLeft,
    ChevronRight,
    ChevronDown,
    MessageSquare,
    FolderTree,
    Archive,
    SearchX,
    Clock, // Add Clock icon for temporary chats
    BookOpen, // Add Library icon
} from "lucide-react";
import { toast } from "sonner";

interface Chat {
    _id: Id<"chats">;
    title: string;
    model: string;
    updatedAt: number;
    isStarred?: boolean;
    isArchived?: boolean;
    archivedAt?: number;
    // Phase 2: Temporary chat fields
    isTemporary?: boolean;
    temporaryUntil?: number;
    // Phase 6: Password protection fields
    isPasswordProtected?: boolean;
    // Sharing fields
    isPublic?: boolean;
    shareId?: string;
}

interface SidebarProps {
    chats: { 
        starred: Chat[]; 
        regular: Chat[]; 
        archived: Chat[];
        temporary: Chat[];
        protected: Chat[]; // Add protected chats section
    };
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

    // Advanced Search modal state
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    
    // Library modal state
    const [showLibrary, setShowLibrary] = useState(false);

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
    const [sharedChatsExpanded, setSharedChatsExpanded] = useLocalStorage(
        "sharedChatsExpanded",
        true
    );
    const [sharedProjectsExpanded, setSharedProjectsExpanded] = useLocalStorage(
        "sharedProjectsExpanded",
        true
    );
    const [archivedExpanded, setArchivedExpanded] = useLocalStorage(
        "archivedExpanded",
        false // Collapsed by default
    );
    // Add temporary chats expanded state
    const [temporaryExpanded, setTemporaryExpanded] = useLocalStorage(
        "temporaryExpanded",
        true
    );
    // Add protected chats expanded state - Phase 6
    const [protectedExpanded, setProtectedExpanded] = useLocalStorage(
        "protectedExpanded",
        true
    );

    // Get current user to check if anonymous
    const user = useQuery(api.users.getCurrentUser);
    const isAnonymous = !user?.email && !user?.name;

    const deleteChat = useMutation(api.chats.deleteChat);
    const toggleStar = useMutation(api.chats.toggleChatStar);
    const updateTitle = useMutation(api.chats.updateChatTitle);
    const toggleArchive = useMutation(api.chats.toggleChatArchive);

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

        // Handle Advanced Search modal event
        const handleOpenAdvancedSearch = () => {
            setShowAdvancedSearch(true);
        };

        // Handle project view toggle keyboard shortcut using custom shortcuts
        const handleToggleProjectView = (e: KeyboardEvent) => {
            if (checkShortcutMatch(e, "toggleProjectView")) {
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
        document.addEventListener("openAdvancedSearch", handleOpenAdvancedSearch);
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
            document.removeEventListener("openAdvancedSearch", handleOpenAdvancedSearch);
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

    const handleToggleArchive = async (
        chatId: Id<"chats">,
        e?: React.MouseEvent
    ) => {
        e?.stopPropagation();

        try {
            await toggleArchive({ chatId });
            const chat = [...chats.starred, ...chats.regular].find(
                (c) => c._id === chatId
            );
            toast.success(
                chat?.isArchived ? "Unarchived chat" : "Archived chat"
            );
        } catch (error) {
            console.error("Failed to toggle archive:", error);
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
        archived: chats.archived.filter((chat) =>
            chat.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        // Add temporary chats filtering
        temporary: chats.temporary.filter((chat) =>
            chat.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        // Add protected chats filtering - Phase 6
        protected: chats.protected.filter((chat) =>
            chat.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    };

    // Filter shared content based on search query
    const filteredSharedChats =
        sharedContent?.sharedChats.filter((chat) =>
            chat.title.toLowerCase().includes(searchQuery.toLowerCase())
        ) || [];

    const filteredSharedProjects =
        sharedContent?.sharedProjects.filter((project) =>
            project.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) || [];

    // Enhanced renderChat function with compact temporary badge
    const renderChat = (chat: Chat, isTemporary = false) => (
        <div
            key={chat._id}
            onClick={() => onSelectChat(chat._id)}
            className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 mb-2 ${
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
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate text-purple-100 flex-1">
                                    {chat.title}
                                </span>
                                {/* Visual indicators for protected and shared chats */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {chat.isPasswordProtected && (
                                        <div className="w-3 h-3 text-green-400" title="Password Protected">
                                            🔒
                                        </div>
                                    )}
                                    {chat.isPublic && chat.shareId && (
                                        <div className="w-3 h-3 text-blue-400" title="Shared">
                                            🔗
                                        </div>
                                    )}
                                    {chat.isTemporary && (
                                        <div className="w-3 h-3 text-orange-400" title="Temporary">
                                            ⏱️
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
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
                            onClick={(e) => handleToggleArchive(chat._id, e)}
                            className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                            title={
                                chat.isArchived ? "Unarchive chat" : "Archive chat"
                            }
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
                                    d="M15 17h5l-1.403 4.809a1 1 0 01-1.894-.309L17 17zm-6 0H4l1.403 4.809a1 1 0 001.894-.309L11 17zm0-6H4l1.403 4.809a1 1 0 001.894-.309L11 11zm10-7H3a1 1 0 00-1 1v2h18V5a1 1 0 00-1-1z"
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

                <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
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
                        
                        {/* Grouped Advanced Search and Library Icons */}
                        <div className="flex bg-purple-500/10 rounded-lg p-1">
                            <button
                                onClick={() => setShowAdvancedSearch(true)}
                                className="p-2 rounded-md transition-all duration-200 text-purple-300 hover:text-purple-200 hover:bg-purple-500/20"
                                title="Advanced Search (Ctrl+Shift+F)"
                            >
                                <SearchX className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setShowLibrary(true)}
                                className="p-2 rounded-md transition-all duration-200 text-purple-300 hover:text-purple-200 hover:bg-purple-500/20"
                                title="Library (Ctrl+L)"
                            >
                                <BookOpen className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
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
                        filteredChats.temporary.length === 0 &&
                        filteredChats.archived.length === 0 &&
                        filteredSharedChats.length === 0 &&
                        filteredSharedProjects.length === 0 &&
                        searchQuery ? (
                            <div className="p-4 text-center text-purple-300">
                                No chats found
                            </div>
                        ) : (
                            <div className="px-4 py-3 space-y-8">
                                {/* Starred Chats - Collapsible */}
                                {filteredChats.starred.length > 0 && (
                                    <div className="mb-2">
                                        <button
                                            onClick={() =>
                                                setStarredExpanded(
                                                    !starredExpanded
                                                )
                                            }
                                            className="flex items-center justify-between w-full px-3 rounded-lg transition-colors"
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
                                                <ChevronDown className="w-5 h-5 text-purple-200/80" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-purple-200/80" />
                                            )}
                                        </button>
                                        {starredExpanded && (
                                            <div className="mt-2">
                                                {filteredChats.starred.map((chat) => 
                                                    renderChat(chat)
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TEMPORARY CHATS Section - NEW */}
                                {filteredChats.temporary.length > 0 && (
                                    <div className="mb-2">
                                        <button
                                            onClick={() =>
                                                setTemporaryExpanded(
                                                    !temporaryExpanded
                                                )
                                            }
                                            className="flex items-center justify-between w-full px-3 rounded-lg transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-orange-400" />
                                                <h4 className="text-xs font-semibold text-orange-200/80 uppercase tracking-wider">
                                                    TEMPORARY (
                                                    {filteredChats.temporary.length}
                                                    )
                                                </h4>
                                            </div>
                                            {temporaryExpanded ? (
                                                <ChevronDown className="w-5 h-5 text-orange-200/80" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-orange-200/80" />
                                            )}
                                        </button>
                                        {temporaryExpanded && (
                                            <div className="mt-2">
                                                {filteredChats.temporary.map((chat) => 
                                                    renderChat(chat, true)
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* PROTECTED CHATS Section - Phase 6 */}
                                {filteredChats.protected.length > 0 && (
                                    <div className="mb-2">
                                        <button
                                            onClick={() =>
                                                setProtectedExpanded(
                                                    !protectedExpanded
                                                )
                                            }
                                            className="flex items-center justify-between w-full px-3 rounded-lg transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                <h4 className="text-xs font-semibold text-green-200/80 uppercase tracking-wider">
                                                    PROTECTED ({filteredChats.protected.length})
                                                </h4>
                                            </div>
                                            {protectedExpanded ? (
                                                <ChevronDown className="w-5 h-5 text-green-200/80" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-green-200/80" />
                                            )}
                                        </button>
                                        {protectedExpanded && (
                                            <div className="mt-2">
                                                {filteredChats.protected.map((chat) => renderChat(chat))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* SHARED CHATS Section - Same styling as starred */}
                                {filteredSharedChats.length > 0 && (
                                    <div className="mb-2">
                                        <button
                                            onClick={() =>
                                                setSharedChatsExpanded(
                                                    !sharedChatsExpanded
                                                )
                                            }
                                            className="flex items-center justify-between w-full px-3 rounded-lg transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-semibold text-purple-200/80 uppercase tracking-wider">
                                                    SHARED CHATS (
                                                    {filteredSharedChats.length}
                                                    )
                                                </h4>
                                            </div>
                                            {sharedChatsExpanded ? (
                                                <ChevronDown className="w-5 h-5 text-purple-200/80" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-purple-200/80" />
                                            )}
                                        </button>
                                        {sharedChatsExpanded && (
                                            <div className="mt-2">
                                                {filteredSharedChats.map((chat) =>
                                                    renderChat(chat)
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* SHARED PROJECTS Section - Same styling as regular chats */}
                                {filteredSharedProjects.length > 0 && (
                                    <div className="mb-2">
                                        <button
                                            onClick={() =>
                                                setSharedProjectsExpanded(
                                                    !sharedProjectsExpanded
                                                )
                                            }
                                            className="flex items-center justify-between w-full px-3 rounded-lg transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-semibold text-purple-200/80 uppercase tracking-wider">
                                                    SHARED PROJECTS (
                                                    {
                                                        filteredSharedProjects.length
                                                    }
                                                    )
                                                </h4>
                                            </div>
                                            {sharedProjectsExpanded ? (
                                                <ChevronDown className="w-5 h-5 text-purple-200/80" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-purple-200/80" />
                                            )}
                                        </button>
                                        {sharedProjectsExpanded && (
                                            <div className="mt-2">
                                                {filteredSharedProjects.map(
                                                    (project) => (
                                                        <div
                                                            key={project._id}
                                                            onClick={() => {
                                                                // Navigate to project view for shared projects
                                                                window.location.href = `/project/${project._id}`;
                                                            }}
                                                            className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 mb-2`}
                                                        >
                                                            <div className="flex items-start">
                                                                <div className="flex-1 min-w-0">
                                                                    <h3
                                                                        className="text-purple-100 font-medium truncate"
                                                                        title={`${project.name}\nShared project • ${project.description || "No description"}`}
                                                                    >
                                                                        {
                                                                            project.name
                                                                        }
                                                                    </h3>
                                                                    {project.description && (
                                                                        <p className="text-xs text-purple-300/60 mt-1 line-clamp-1">
                                                                            {
                                                                                project.description
                                                                            }
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}
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
                                                <h4 className="px-3 text-xs font-semibold text-purple-200/80 uppercase tracking-wider mb-2">
                                                    {category}
                                                </h4>
                                                {categoryChats.map((chat) => renderChat(chat))}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Archived Chats - Collapsible */}
                                {filteredChats.archived.length > 0 && (
                                    <div className="mb-4">
                                        <button
                                            onClick={() =>
                                                setArchivedExpanded(
                                                    !archivedExpanded
                                                )
                                            }
                                            className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-purple-300 hover:text-purple-100 hover:bg-purple-600/10 rounded-lg transition-colors mb-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Archive className="w-4 h-4" />
                                                <span>Archived</span>
                                                <span className="text-xs bg-purple-600/20 px-1.5 py-0.5 rounded">
                                                    {filteredChats.archived.length}
                                                </span>
                                            </div>
                                            <ChevronDown
                                                className={`w-4 h-4 transition-transform ${
                                                    archivedExpanded ? "rotate-180" : ""
                                                }`}
                                            />
                                        </button>

                                        {archivedExpanded && (
                                            <div className="space-y-1 pl-2">
                                                {filteredChats.archived.map((chat) => renderChat(chat))}
                                            </div>
                                        )}
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

            {/* Advanced Search Modal */}
            <AdvancedSearchModal 
                open={showAdvancedSearch}
                onOpenChange={setShowAdvancedSearch}
                onSelectChat={onSelectChat}
            />

            {/* Library Modal */}
            <LibraryModal
                open={showLibrary}
                onOpenChange={setShowLibrary}
                chatId={selectedChatId}
                onSelectItem={(item) => {
                    // This will be handled by the "#" command integration in MessageInput
                    console.log("Selected library item:", item);
                }}
            />
        </div>
    );
}
