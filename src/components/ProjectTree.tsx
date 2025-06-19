import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ShareModal } from "./ShareModal";
import {
    ChevronRight,
    ChevronDown,
    Folder,
    FolderOpen,
    Plus,
    Share2,
    Trash2,
    Edit3,
    MessageSquare,
    Palette,
} from "lucide-react";
import { toast } from "sonner";
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface Project {
    _id: Id<"projects">;
    name: string;
    description?: string;
    color?: string;
    parentId?: Id<"projects">;
    isDefault?: boolean;
    children: Project[];
    chats: any[];
}

interface ProjectTreeProps {
    onSelectChat: (chatId: Id<"chats">) => void;
    selectedChatId: Id<"chats"> | null;
    searchQuery: string;
    onCreateChat: (projectId: Id<"projects">) => void;
}

// Beautiful color palette for projects
const PROJECT_COLORS = [
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#8b5a3c", // Brown
    "#06b6d4", // Cyan
    "#84cc16", // Lime
    "#a855f7", // Violet
    "#f97316", // Orange
    "#14b8a6", // Teal
    "#6366f1", // Indigo
    "#eab308", // Yellow
    "#22c55e", // Green
    "#e11d48", // Rose
    "#64748b", // Slate
    "#7c3aed", // Purple variant
    "#db2777", // Pink variant
    "#059669", // Emerald variant
];

// Generate a random beautiful color
const getRandomColor = () => {
    return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
};

export function ProjectTree({
    onSelectChat,
    selectedChatId,
    searchQuery,
    onCreateChat,
}: ProjectTreeProps) {
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
        new Set()
    );
    const [editingProjectId, setEditingProjectId] =
        useState<Id<"projects"> | null>(null);
    const [editName, setEditName] = useState("");
    const [hoveredProject, setHoveredProject] = useState<Id<"projects"> | null>(
        null
    );

    // Share modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareItemId, setShareItemId] = useState<Id<"projects"> | null>(null);
    const [shareItemTitle, setShareItemTitle] = useState<string>("");

    // Color picker state
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerProjectId, setColorPickerProjectId] = useState<Id<"projects"> | null>(null);

    // Drag & Drop state
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dragOverlay, setDragOverlay] = useState<any>(null);

    const projectTree = useQuery(api.projects.getProjectTree);
    const createProject = useMutation(api.projects.createProject);
    const updateProject = useMutation(api.projects.updateProject);
    const deleteProject = useMutation(api.projects.deleteProject);
    const moveChatToProject = useMutation(api.projects.moveChatToProject);
    const moveProject = useMutation(api.projects.moveProject);

    // Drag & Drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const toggleExpanded = useCallback((projectId: string) => {
        setExpandedProjects((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    }, []);

    const handleCreateProject = useCallback(
        async (parentId?: Id<"projects">) => {
            try {
                const projectId = await createProject({
                    name: "New Project",
                    description: "A new project",
                    color: getRandomColor(), // Use random color instead of static
                    parentId,
                });

                // Auto-expand parent and start editing
                if (parentId) {
                    setExpandedProjects((prev) => new Set([...prev, parentId]));
                }
                setEditingProjectId(projectId);
                setEditName("New Project");
                toast.success("Project created");
            } catch (error) {
                console.error("Failed to create project:", error);
                toast.error("Failed to create project");
            }
        },
        [createProject]
    );

    const handleCreateChat = useCallback(
        async (projectId: Id<"projects">) => {
            try {
                onCreateChat(projectId);
            } catch (error) {
                console.error("Failed to create chat:", error);
                toast.error("Failed to create chat");
            }
        },
        [onCreateChat]
    );

    const handleUpdateProject = useCallback(async () => {
        if (editingProjectId && editName.trim()) {
            try {
                await updateProject({
                    projectId: editingProjectId,
                    name: editName.trim(),
                });
                setEditingProjectId(null);
                setEditName("");
                toast.success("Project updated");
            } catch (error) {
                console.error("Failed to update project:", error);
                toast.error("Failed to update project");
            }
        }
    }, [editingProjectId, editName, updateProject]);

    const handleUpdateProjectColor = useCallback(
        async (projectId: Id<"projects">, color: string) => {
            try {
                await updateProject({
                    projectId,
                    color,
                });
                toast.success("Project color updated");
            } catch (error) {
                console.error("Failed to update project color:", error);
                toast.error("Failed to update project color");
            }
        },
        [updateProject]
    );

    const handleDeleteProject = useCallback(
        async (projectId: Id<"projects">, projectName: string) => {
            if (
                confirm(
                    `Are you sure you want to delete "${projectName}"? All chats will be moved to General.`
                )
            ) {
                try {
                    await deleteProject({ projectId });
                    toast.success("Project deleted");
                } catch (error) {
                    console.error("Failed to delete project:", error);
                    toast.error("Failed to delete project");
                }
            }
        },
        [deleteProject]
    );

    const startEditing = useCallback(
        (project: Project, e: React.MouseEvent) => {
            e.stopPropagation();
            setEditingProjectId(project._id);
            setEditName(project.name);
        },
        []
    );

    const filterProjectsAndChats = useCallback(
        (projects: Project[]): Project[] => {
            if (!searchQuery) return projects;

            return projects
                .map((project) => {
                    const filteredChats = project.chats.filter((chat) =>
                        chat.title
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                    );

                    const filteredChildren = filterProjectsAndChats(
                        project.children
                    );

                    const matchesName = project.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase());

                    if (
                        matchesName ||
                        filteredChats.length > 0 ||
                        filteredChildren.length > 0
                    ) {
                        return {
                            ...project,
                            chats: filteredChats,
                            children: filteredChildren,
                        };
                    }
                    return null;
                })
                .filter(Boolean) as Project[];
        },
        [searchQuery]
    );

    const renderProject = useCallback(
        (project: Project, depth = 0) => {
            const isExpanded = expandedProjects.has(project._id);
            const hasChildren = project.children.length > 0;
            const hasChats = project.chats.length > 0;
            const isHovered = hoveredProject === project._id;

            return (
                <div key={project._id} className="select-none">
                    {/* Project Row */}
                    <div
                        className={`group relative flex items-center px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                            isHovered
                                ? "bg-purple-500/10"
                                : "hover:bg-purple-500/5"
                        }`}
                        style={{ paddingLeft: `${8 + depth * 16}px` }}
                        onClick={() => toggleExpanded(project._id)}
                        onMouseEnter={() => setHoveredProject(project._id)}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                        {/* Expand/Collapse Icon */}
                            {(hasChildren || hasChats) && (
                        <div className="flex items-center justify-center w-4 h-4 mr-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpanded(project._id);
                                    }}
                                    className="text-purple-300 hover:text-purple-100 transition-colors"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                </button>
                        </div>
                            )}

                        {/* Folder Icon with project color */}
                        <div className="mr-2">
                            {isExpanded ? (
                                <FolderOpen 
                                    className="w-4 h-4" 
                                    style={{ color: project.color || "#c4b5fd" }}
                                />
                            ) : (
                                <Folder 
                                    className="w-4 h-4" 
                                    style={{ color: project.color || "#c4b5fd" }}
                                />
                            )}
                        </div>

                        {/* Project Name with animated truncation */}
                        <div className={`flex-1 min-w-0 ${ !editingProjectId ? 'group-hover:pr-36' : ''} transition-all duration-200`}>
                            {editingProjectId === project._id ? (
                                <input
                                    value={editName}
                                    onChange={(e) =>
                                        setEditName(e.target.value)
                                    }
                                    onBlur={() => void handleUpdateProject()}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                            void handleUpdateProject();
                                        if (e.key === "Escape") {
                                            setEditingProjectId(null);
                                            setEditName("");
                                        }
                                    }}
                                    className="w-full bg-purple-500/10 rounded px-2 py-1 text-purple-100 font-medium focus:outline-none focus:ring-1 focus:ring-purple-400"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <h3
                                    className="text-purple-100 font-medium truncate"
                                    style={{
                                        color: project.color || "#c4b5fd",
                                    }}
                                    title={project.description || project.name}
                                >
                                    {project.name}
                                    {project.isDefault && (
                                        <span className="ml-2 text-sm text-purple-400">
                                            (Default)
                                        </span>
                                    )}
                                </h3>
                            )}
                        </div>

                        {/* Chat Count Badge */}
                        {project.chats.length > 0 && !isHovered && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">
                                {project.chats.length}
                            </span>
                        )}

                        {/* Action Buttons */}
                        <div
                            className={`absolute right-2 flex items-center gap-1 transition-all duration-200 ${
                                isHovered && !editingProjectId
                                    ? "opacity-100 translate-x-0"
                                    : "opacity-0 translate-x-2"
                            }`}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handleCreateChat(project._id);
                                }}
                                className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                                title="Create new chat"
                            >
                                <MessageSquare className="w-3 h-3 text-purple-400" />
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handleCreateProject(project._id);
                                }}
                                className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                                title="Create subfolder"
                            >
                                <Plus className="w-3 h-3 text-purple-400" />
                            </button>

                            {!project.isDefault && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setColorPickerProjectId(project._id);
                                            setShowColorPicker(true);
                                        }}
                                        className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                                        title="Change color"
                                    >
                                        <Palette className="w-3 h-3 text-purple-400" />
                                    </button>

                                    <button
                                        onClick={(e) =>
                                            startEditing(project, e)
                                        }
                                        className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                                        title="Rename project"
                                    >
                                        <Edit3 className="w-3 h-3 text-purple-400" />
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShareItemId(project._id);
                                            setShareItemTitle(project.name);
                                            setShowShareModal(true);
                                        }}
                                        className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                                        title="Share project"
                                    >
                                        <Share2 className="w-3 h-3 text-purple-400" />
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleDeleteProject(
                                                project._id,
                                                project.name
                                            );
                                        }}
                                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                        title="Delete project"
                                    >
                                        <Trash2 className="w-3 h-3 text-red-400" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                        <div className="ml-4">
                            {/* Child Projects - Fix: Remove extra indentation */}
                            {project.children.map((child) =>
                                renderProject(child, depth + 1)
                            )}

                            {/* Chats in Project - Fix: Use same base indentation as child projects */}
                            {project.chats.map((chat) => (
                                <div
                                    key={chat._id}
                                    onClick={() => onSelectChat(chat._id)}
                                    className={`group relative flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                        selectedChatId === chat._id
                                            ? "bg-purple-500/20"
                                            : "hover:bg-purple-500/10"
                                    }`}
                                    style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
                                >
                                    <MessageSquare className="w-4 h-4 text-purple-400 mr-2 flex-shrink-0" />
                                    <span
                                        className="text-purple-100 text-sm truncate flex-1"
                                        title={chat.title}
                                    >
                                        {chat.title}
                                    </span>
                                    {chat.isStarred && (
                                        <svg
                                            className="w-3 h-3 text-yellow-400 fill-current ml-1 flex-shrink-0"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        },
        [
            expandedProjects,
            editingProjectId,
            editName,
            hoveredProject,
            selectedChatId,
            toggleExpanded,
            handleCreateProject,
            handleCreateChat,
            handleUpdateProject,
            handleDeleteProject,
            startEditing,
            onSelectChat,
        ]
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);

        // Find the dragged item to show in overlay
        const findItem = (projects: Project[]): any => {
            for (const project of projects) {
                if (project._id === active.id) {
                    return { type: "project", item: project };
                }

                for (const chat of project.chats) {
                    if (chat._id === active.id) {
                        return { type: "chat", item: chat };
                    }
                }

                const found = findItem(project.children);
                if (found) return found;
            }
            return null;
        };

        const draggedItem = findItem(projectTree?.projects || []);
        setDragOverlay(draggedItem);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            setActiveId(null);
            setDragOverlay(null);
            return;
        }

        try {
            const activeType = active.id.toString().startsWith("chat-")
                ? "chat"
                : "project";
            const overType = over.id.toString().startsWith("project-")
                ? "project"
                : "unknown";

            if (activeType === "chat" && overType === "project") {
                // Moving chat to project
                const chatId = active.id
                    .toString()
                    .replace("chat-", "") as Id<"chats">;
                const targetProjectId = over.id
                    .toString()
                    .replace("project-", "") as Id<"projects">;

                await moveChatToProject({
                    chatId,
                    projectId: targetProjectId,
                });

                toast.success("Chat moved successfully!");
            } else if (activeType === "project" && overType === "project") {
                // Moving project to another project (as child)
                const projectId = active.id
                    .toString()
                    .replace("project-", "") as Id<"projects">;
                const newParentId = over.id
                    .toString()
                    .replace("project-", "") as Id<"projects">;

                // Prevent moving to itself or making circular references
                if (projectId !== newParentId) {
                    await moveProject({
                        projectId,
                        newParentId,
                    });

                    toast.success("Project moved successfully!");
                }
            }
        } catch (error) {
            console.error("Failed to move item:", error);
            toast.error("Failed to move item");
        }

        setActiveId(null);
        setDragOverlay(null);
    };

    if (!projectTree) {
        return (
            <div className="p-4 text-center text-purple-300">
                <div className="w-6 h-6 border border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading projects...
            </div>
        );
    }

    const filteredProjects = filterProjectsAndChats(projectTree.projects || []);

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-1">
                {/* Projects Header */}
                <div className="flex items-center justify-between px-2 py-2">
                    <h4 className="text-xs font-semibold text-purple-200/80 uppercase tracking-wider">
                        PROJECTS
                    </h4>
                    <button
                        onClick={() => void handleCreateProject()}
                        className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                        title="Create new project"
                    >
                        <Plus className="w-4 h-4 text-purple-400" />
                    </button>
                </div>

                {/* Project Tree */}
                {filteredProjects.length === 0 ? (
                    <div className="p-4 text-center text-purple-300">
                        {searchQuery
                            ? "No projects match your search"
                            : "No projects found"}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredProjects.map((project) =>
                            renderProject(project)
                        )}
                    </div>
                )}

                {/* Color Picker Modal */}
                {showColorPicker && colorPickerProjectId && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-gray-900 rounded-lg p-6 border max-w-sm w-full mx-4">
                            <h3 className="text-center font-semibold text-purple-200 mb-4">
                                Choose Project Color
                            </h3>
                            <div className="grid grid-cols-5 gap-2 mb-4">
                                {PROJECT_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => {
                                            void handleUpdateProjectColor(colorPickerProjectId, color);
                                            setShowColorPicker(false);
                                            setColorPickerProjectId(null);
                                        }}
                                        className="w-8 h-8 rounded-full border-2 border-gray-600 hover:border-purple-400 transition-colors"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setShowColorPicker(false);
                                        setColorPickerProjectId(null);
                                    }}
                                    className="px-4 py-2 text-sm bg-purple-600/30 hover:bg-purple-600/50 text-gray-300 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Share Modal */}
                {showShareModal && shareItemId && (
                    <ShareModal
                        open={showShareModal}
                        onOpenChange={setShowShareModal}
                        itemId={shareItemId}
                        itemType="project"
                        itemTitle={shareItemTitle}
                    />
                )}
            </div>
        </DndContext>
    );
}
