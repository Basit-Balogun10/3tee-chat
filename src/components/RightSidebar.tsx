import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { SearchInput } from "./SearchInput";
import { Canvas } from "./Canvas";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { X, MessageSquare, Palette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface Message {
    _id: Id<"messages">;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    model?: string;
}

interface RightSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    chatId: Id<"chats"> | null;
    messages: Message[];
    onScrollToMessage: (messageId: Id<"messages">) => void;
    mode: "navigation" | "canvas";
    onModeChange: (mode: "navigation" | "canvas") => void;
    artifacts: any[]; // Mock artifacts - will be replaced by real data
    activeArtifactId?: string;
    onSelectArtifact: (artifactId: string) => void;
}

export function RightSidebar({
    isOpen,
    onClose,
    chatId,
    messages,
    onScrollToMessage,
    mode,
    onModeChange,
    artifacts,
    activeArtifactId,
    onSelectArtifact,
}: RightSidebarProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [canvasWidth, setCanvasWidth] = useLocalStorage("canvasWidth", 400);
    const [isResizing, setIsResizing] = useState(false);

    const sidebarRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    // Get real artifacts from database
    const realArtifacts =
        useQuery(
            api.artifacts.getChatArtifacts,
            chatId ? { chatId } : "skip"
        ) || [];

    // Filter messages based on search query for navigation mode
    const filteredMessages = searchQuery
        ? messages.filter((message) =>
              message.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : messages;

    // Handle canvas resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || mode !== "canvas") return;

            const newWidth = window.innerWidth - e.clientX;
            const minWidth = 300;
            const maxWidth = window.innerWidth * 0.7;

            const clampedWidth = Math.max(
                minWidth,
                Math.min(maxWidth, newWidth)
            );
            setCanvasWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isResizing, mode, setCanvasWidth]);

    const handleResizeStart = (e: React.MouseEvent) => {
        if (mode !== "canvas") return;
        e.preventDefault();
        setIsResizing(true);
    };

    const truncateText = (text: string, maxLength: number = 60) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const renderNavigationContent = () => (
        <div className="flex-1 overflow-y-scroll overflow-x-hidden">
            <div className="px-4 py-2">
                <div className="mb-4">
                    <SearchInput
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search messages..."
                        autoFocus={false}
                    />
                </div>

                {filteredMessages.length === 0 ? (
                    <div className="text-center text-purple-300 py-8">
                        {searchQuery ? "No messages found" : "No messages yet"}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredMessages.map((message) => (
                            <div
                                key={message._id}
                                onClick={() => onScrollToMessage(message._id)}
                                className="group relative px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20"
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                            message.role === "user"
                                                ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-200"
                                                : "bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-purple-200"
                                        }`}
                                    >
                                        {message.role === "user" ? "You" : "AI"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-purple-400">
                                                {formatTimestamp(
                                                    message.timestamp
                                                )}
                                            </span>
                                            {message.model && (
                                                <span className="text-xs text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded">
                                                    {message.model}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-purple-100 text-sm leading-relaxed">
                                            {truncateText(message.content)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (!isOpen) return null;

    const sidebarWidth = mode === "canvas" ? canvasWidth : 400;
    const hasArtifacts = realArtifacts.length > 0;

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-md lg:hidden z-40"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                className={`fixed right-0 top-0 h-full bg-black/20 backdrop-blur-md border-l border-purple-600/10 z-50 transition-all duration-200 ease-out ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
                style={{ width: sidebarWidth }}
            >
                {/* Resize handle for canvas mode */}
                {mode === "canvas" && (
                    <div
                        className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-purple-500/50 transition-colors z-10"
                        onMouseDown={handleResizeStart}
                    />
                )}

                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-">
                            <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                                {mode === "navigation"
                                    ? "Chat Navigator"
                                    : "Canvas"}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                            >
                                <X className="w-5 h-5 text-purple-200" />
                            </button>
                        </div>

                        {/* Mode Tabs - only show if there are artifacts */}
                        {hasArtifacts && (
                            <Tabs
                                value={mode}
                                onValueChange={onModeChange}
                                className="w-full"
                            >
                                <TabsList className="grid w-full grid-cols-2 bg-purple-600/20  space-x-2">
                                    <TabsTrigger
                                        value="navigation"
                                        className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                                    >
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        Navigate
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="canvas"
                                        className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                                    >
                                        <Palette className="w-4 h-4 mr-2" />
                                        Canvas
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}
                    </div>

                    {/* Content */}
                    {mode === "navigation" ? (
                        renderNavigationContent()
                    ) : (
                        <Canvas
                            chatId={chatId}
                            activeArtifactId={activeArtifactId}
                            onSelectArtifact={onSelectArtifact}
                            onClose={onClose}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
