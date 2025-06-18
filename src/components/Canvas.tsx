import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    ChevronDown,
    Search,
    Copy,
    Download,
    X,
    Eye,
    Code2,
    FileText,
    Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

interface Artifact {
    _id: Id<"artifacts">;
    artifactId: string;
    filename: string;
    language: string;
    content: string;
    description?: string;
    isPreviewable?: boolean;
    editCount?: number;
    updatedAt: number;
}

interface CanvasProps {
    chatId: Id<"chats"> | null;
    activeArtifactId?: string;
    onSelectArtifact: (artifactId: string) => void;
    onClose: () => void;
}

export function Canvas({
    chatId,
    activeArtifactId,
    onSelectArtifact,
    onClose,
}: CanvasProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [editedContent, setEditedContent] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Get artifacts for the current chat
    const artifacts =
        useQuery(
            api.artifacts.getChatArtifacts,
            chatId ? { chatId } : "skip"
        ) || [];

    // Get the active artifact
    const activeArtifact = useQuery(
        api.artifacts.getArtifact,
        activeArtifactId ? { artifactId: activeArtifactId } : "skip"
    );

    const updateArtifact = useMutation(api.artifacts.updateArtifact);

    // Filter artifacts based on search
    const filteredArtifacts = artifacts.filter(
        (artifact) =>
            artifact.filename
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
            artifact.description
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
            artifact.language.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Set initial content and preview mode when artifact changes
    useEffect(() => {
        if (activeArtifact) {
            setEditedContent(activeArtifact.content);
            setHasUnsavedChanges(false);
            // Auto-enable preview for markdown by default
            setPreviewMode(
                activeArtifact.language.toLowerCase() === "markdown"
            );
        }
    }, [activeArtifact]);

    // Handle content changes
    useEffect(() => {
        if (activeArtifact && editedContent !== activeArtifact.content) {
            setHasUnsavedChanges(true);
        } else {
            setHasUnsavedChanges(false);
        }
    }, [editedContent, activeArtifact]);

    // Auto-save changes after 2 seconds of inactivity
    useEffect(() => {
        if (!hasUnsavedChanges || !activeArtifact) return;

        const timeout = setTimeout(() => {
            handleSave();
        }, 2000);

        return () => clearTimeout(timeout);
    }, [editedContent, hasUnsavedChanges]);

    const handleSave = async () => {
        if (!activeArtifact || !hasUnsavedChanges) return;

        try {
            await updateArtifact({
                artifactId: activeArtifact.artifactId,
                content: editedContent,
            });
            setHasUnsavedChanges(false);
            toast.success("Artifact saved");
        } catch (error) {
            console.error("Failed to save artifact:", error);
            toast.error("Failed to save artifact");
        }
    };

    const handleCopy = async () => {
        if (!activeArtifact) return;

        try {
            await navigator.clipboard.writeText(editedContent);
            toast.success("Copied to clipboard");
        } catch (error) {
            toast.error("Failed to copy to clipboard");
        }
    };

    const handleDownload = () => {
        if (!activeArtifact) return;

        const blob = new Blob([editedContent], {
            type: getContentType(activeArtifact.language),
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = activeArtifact.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Downloaded ${activeArtifact.filename}`);
    };

    const getContentType = (language: string): string => {
        const typeMap: Record<string, string> = {
            javascript: "application/javascript",
            typescript: "application/typescript",
            html: "text/html",
            css: "text/css",
            json: "application/json",
            markdown: "text/markdown",
            python: "text/x-python",
            java: "text/x-java",
            cpp: "text/x-c++src",
            xml: "application/xml",
            yaml: "application/x-yaml",
            sql: "application/sql",
        };
        return typeMap[language.toLowerCase()] || "text/plain";
    };

    const getLanguageIcon = (language: string) => {
        if (
            ["html", "css", "javascript", "typescript", "react"].includes(
                language.toLowerCase()
            )
        ) {
            return <Code2 className="w-4 h-4" />;
        }
        return <FileText className="w-4 h-4" />;
    };

    const isPreviewable = (language: string): boolean => {
        const previewableLanguages = [
            "html",
            "css",
            "javascript",
            "typescript",
            "react",
            "vue",
            "svelte",
            "markdown",
        ];
        return previewableLanguages.includes(language.toLowerCase());
    };

    const renderPreview = () => {
        if (!activeArtifact) return null;

        const language = activeArtifact.language.toLowerCase();

        if (language === "markdown") {
            return (
                <div className="prose prose-invert max-w-none p-4">
                    <MarkdownRenderer content={editedContent} />
                </div>
            );
        }

        if (["html", "css", "javascript", "react"].includes(language)) {
            // For web technologies, create a preview iframe
            let previewContent = editedContent;

            if (language === "html") {
                previewContent = editedContent;
            } else if (language === "css") {
                previewContent = `
                    <html>
                        <head><style>${editedContent}</style></head>
                        <body>
                            <div class="preview-container">
                                <h1>CSS Preview</h1>
                                <p>This is a sample paragraph to show your CSS styles.</p>
                                <button>Sample Button</button>
                                <div class="box">Sample Box</div>
                            </div>
                        </body>
                    </html>
                `;
            } else if (language === "javascript") {
                previewContent = `
                    <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 20px; background: #1a1a1a; color: white; }
                                #output { background: #2d2d2d; padding: 10px; border-radius: 5px; margin-top: 10px; }
                            </style>
                        </head>
                        <body>
                            <h3>JavaScript Preview</h3>
                            <div id="output"></div>
                            <script>
                                const originalLog = console.log;
                                console.log = function(...args) {
                                    document.getElementById('output').innerHTML += args.join(' ') + '<br>';
                                    originalLog.apply(console, args);
                                };
                                try {
                                    ${editedContent}
                                } catch (error) {
                                    document.getElementById('output').innerHTML += '<span style="color: red;">Error: ' + error.message + '</span>';
                                }
                            </script>
                        </body>
                    </html>
                `;
            }

            return (
                <iframe
                    srcDoc={previewContent}
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-scripts allow-same-origin"
                    title="Code Preview"
                />
            );
        }

        return (
            <div className="p-4 text-purple-300">
                Preview not available for {language} files
            </div>
        );
    };

    if (!chatId) {
        return (
            <div className="flex items-center justify-center h-full text-purple-300">
                Select a chat to view artifacts
            </div>
        );
    }

    if (artifacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-purple-300 p-6 text-center">
                <Code2 className="w-12 h-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Artifacts Yet</h3>
                <p className="text-sm opacity-80">
                    Use the <code>/canvas</code> command to create artifacts
                    like code files, documents, and other structured content.
                </p>
            </div>
        );
    }

    if (!activeArtifactId || !activeArtifact) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-purple-300 p-6 text-center">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select an Artifact</h3>
                <p className="text-sm opacity-80 mb-4">
                    Choose an artifact from the dropdown to view and edit it.
                </p>
                <Button
                    onClick={() => setShowDropdown(true)}
                    variant="outline"
                    className="border-purple-600/30"
                >
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Browse {artifacts.length} Artifacts
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-purple-600/20 bg-gray-900/80">
                <div className="flex items-center gap-2 flex-1">
                    {/* Artifact Dropdown */}
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="border-purple-600/30 text-purple-200"
                        >
                            <ChevronDown className="w-4 h-4 mr-2" />
                            {activeArtifact.filename}
                        </Button>

                        {showDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-80 max-h-96 bg-gray-900 border border-purple-600/30 rounded-lg shadow-xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-purple-600/20">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            placeholder="Search artifacts..."
                                            className="pl-10 bg-gray-800 border-purple-600/30"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {filteredArtifacts.map((artifact) => (
                                        <button
                                            key={artifact._id}
                                            onClick={() => {
                                                onSelectArtifact(
                                                    artifact.artifactId
                                                );
                                                setShowDropdown(false);
                                                setSearchQuery("");
                                            }}
                                            className={cn(
                                                "w-full text-left p-3 hover:bg-purple-500/10 transition-colors border-b border-purple-600/10",
                                                activeArtifactId ===
                                                    artifact.artifactId &&
                                                    "bg-purple-500/20"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                {getLanguageIcon(
                                                    artifact.language
                                                )}
                                                <span className="font-medium text-purple-100">
                                                    {artifact.filename}
                                                </span>
                                                <span className="text-xs px-2 py-1 bg-purple-600/20 rounded text-purple-300">
                                                    {artifact.language}
                                                </span>
                                            </div>
                                            {artifact.description && (
                                                <p className="text-sm text-purple-400 truncate">
                                                    {artifact.description}
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                    {filteredArtifacts.length === 0 && (
                                        <div className="p-4 text-center text-purple-400">
                                            No artifacts found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview Toggle */}
                    {isPreviewable(activeArtifact.language) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewMode(!previewMode)}
                            className={cn(
                                "border-purple-600/30 text-purple-200",
                                previewMode && "bg-purple-500/20"
                            )}
                        >
                            {previewMode ? (
                                <>
                                    <Code2 className="w-4 h-4 mr-2" />
                                    Code
                                </>
                            ) : (
                                <>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Preview
                                </>
                            )}
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Save indicator */}
                    {hasUnsavedChanges && (
                        <div className="flex items-center gap-1 text-amber-400 text-sm">
                            <Save className="w-3 h-3" />
                            <span>Unsaved</span>
                        </div>
                    )}

                    {/* Action buttons */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="border-purple-600/30 text-purple-200"
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="border-purple-600/30 text-purple-200"
                    >
                        <Download className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="border-purple-600/30 text-purple-200"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {previewMode ? (
                    <div className="h-full overflow-auto">
                        {renderPreview()}
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <textarea
                            ref={textareaRef}
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="flex-1 w-full p-4 bg-transparent text-purple-100 placeholder-purple-400 border-0 resize-none focus:outline-none font-mono text-sm leading-relaxed"
                            style={{
                                tabSize: 2,
                                lineHeight: "1.5",
                            }}
                            spellCheck={false}
                        />

                        {/* Line numbers overlay could go here */}
                        <div className="px-4 py-2 border-t border-purple-600/20 bg-gray-900/50 text-xs text-purple-400">
                            Lines: {editedContent.split("\n").length} |
                            Characters: {editedContent.length} | Language:{" "}
                            {activeArtifact.language} |
                            {activeArtifact.editCount
                                ? ` Edits: ${activeArtifact.editCount}`
                                : " Original"}
                        </div>
                    </div>
                )}
            </div>

            {/* Click outside to close dropdown */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    );
}
