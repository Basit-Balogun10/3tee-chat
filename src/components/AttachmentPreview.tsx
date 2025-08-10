import { useState, useRef, useEffect, useCallback } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { LibraryModal } from "./LibraryModal";
import { toast } from "sonner";
import { X, Upload, FileText } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";

interface Attachment {
    type: "image" | "pdf" | "file" | "audio" | "video";
    storageId: Id<"_storage">;
    name: string;
    size: number;
}

interface AttachmentPreviewProps {
    attachments: Attachment[];
    messageId: Id<"messages">;
}

export function AttachmentPreview({
    attachments,
    messageId,
}: AttachmentPreviewProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [replacementIndex, setReplacementIndex] = useState<number | null>(
        null
    );
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Backend mutations
    const updateMessageAttachments = useMutation(
        api.messages.updateMessageAttachments
    );
    const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
    const addToAttachmentLibrary = useMutation(
        api.library.addToAttachmentLibrary
    );

    // Custom shortcuts hook
    const { checkShortcutMatch } = useCustomShortcuts();

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case "image":
                return (
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                );
            case "pdf":
                return (
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                );
            case "video":
                return (
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                    </svg>
                );
            case "audio":
                return (
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                    </svg>
                );
            default:
                return <FileText className="w-4 h-4" />;
        }
    };

    const handleRemove = useCallback(
        async (index: number) => {
            if (
                confirm(
                    "⚠️ Remove this attachment?\n\nThis will permanently remove the attachment from this message. This action cannot be undone."
                )
            ) {
                try {
                    const updatedAttachments = attachments.filter(
                        (_, i) => i !== index
                    );
                await updateMessageAttachments({
                        messageId,
                        attachments: updatedAttachments,
                    });
                    toast.success("Attachment removed successfully");
                } catch (error) {
                    console.error("Failed to remove attachment:", error);
                    toast.error("Failed to remove attachment");
                }
            }
        },
        [attachments, messageId, updateMessageAttachments]
    );

    const handleReplace = useCallback((index: number) => {
        setReplacementIndex(index);
        setShowLibraryModal(true);
    }, []);

    const handleLibrarySelection = useCallback(
        async (libraryItem: any) => {
            if (replacementIndex === null) return;

            try {
                // Convert library item to attachment format
                const newAttachment: Attachment = {
                    type:
                        libraryItem.fileType ||
                        libraryItem.type ||
                        (libraryItem.mimeType?.startsWith("image/")
                            ? "image"
                            : libraryItem.mimeType === "application/pdf"
                              ? "pdf"
                              : libraryItem.mimeType?.startsWith("video/")
                                ? "video"
                                : libraryItem.mimeType?.startsWith("audio/")
                                  ? "audio"
                                  : "file"),
                    storageId: libraryItem.storageId || libraryItem.id,
                    name:
                        libraryItem.displayName ||
                        libraryItem.originalName ||
                        libraryItem.name,
                    size: libraryItem.size || 0,
                };

                const updatedAttachments = [...attachments];
                updatedAttachments[replacementIndex] = newAttachment;

                await updateMessageAttachments({
                    messageId,
                    attachments: updatedAttachments,
                });

                toast.success(`Attachment replaced with ${newAttachment.name}`);
                setReplacementIndex(null);
                setShowLibraryModal(false);
            } catch (error) {
                console.error("Failed to replace attachment:", error);
                toast.error("Failed to replace attachment");
            }
        },
        [replacementIndex, attachments, messageId, updateMessageAttachments]
    );

    const handleLocalFileUpload = useCallback(
        async (file: File) => {
            if (replacementIndex === null) return;

            try {
                // Generate upload URL
                const uploadUrl = await generateUploadUrl();

                // Upload file
                const result = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": file.type },
                    body: file,
                });

                if (!result.ok) {
                    throw new Error("Upload failed");
                }

                const { storageId } = await result.json();

                // Determine attachment type
                const getAttachmentType = (
                    mimeType: string
                ): Attachment["type"] => {
                    if (mimeType.startsWith("image/")) return "image";
                    if (mimeType === "application/pdf") return "pdf";
                    if (mimeType.startsWith("video/")) return "video";
                    if (mimeType.startsWith("audio/")) return "audio";
                    return "file";
                };

                // Add to library
                await addToAttachmentLibrary({
                    storageId,
                    originalName: file.name,
                    type: getAttachmentType(file.type),
                    mimeType: file.type,
                    size: file.size,
                });

                // Update message attachments
                const updatedAttachments = [...attachments];
                updatedAttachments[replacementIndex] = {
                    type: getAttachmentType(file.type),
                    storageId,
                    name: file.name,
                    size: file.size,
                };

                await updateMessageAttachments({
                    messageId,
                    attachments: updatedAttachments,
                });

                toast.success(`Attachment replaced with ${file.name}`);
                setReplacementIndex(null);
                setShowLibraryModal(false);
            } catch (error) {
                console.error("Failed to replace attachment:", error);
                toast.error("Failed to replace attachment");
            }
        },
        [
            replacementIndex,
            attachments,
            messageId,
            generateUploadUrl,
            addToAttachmentLibrary,
            updateMessageAttachments,
        ]
    );

    const handleFileSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                await handleLocalFileUpload(file);
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        },
        [handleLocalFileUpload]
    );

    // Keyboard shortcuts for attachment management - dispatch and handle custom events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in input/textarea
            const isTyping =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement)?.isContentEditable;

            if (isTyping) return;

            // Only handle shortcuts when hovering over an attachment
            if (hoveredIndex === null) return;

            // Attachment Management Shortcuts
            if (checkShortcutMatch(e, "removeAttachment")) {
                e.preventDefault();
                const removeAttachmentEvent = new CustomEvent(
                    "removeAttachment",
                    {
                        detail: {
                            messageId: messageId,
                            attachmentIndex: hoveredIndex,
                        },
                    }
                );
                document.dispatchEvent(removeAttachmentEvent);
                return;
            }

            if (checkShortcutMatch(e, "replaceAttachment")) {
                e.preventDefault();
                const replaceAttachmentEvent = new CustomEvent(
                    "replaceAttachment",
                    {
                        detail: {
                            messageId: messageId,
                            attachmentIndex: hoveredIndex,
                        },
                    }
                );
                document.dispatchEvent(replaceAttachmentEvent);
                return;
            }
        };

        // Handle custom events dispatched from keyboard shortcuts
        const handleRemoveAttachmentEvent = (e: CustomEvent) => {
            if (
                e.detail.messageId === messageId &&
                typeof e.detail.attachmentIndex === "number"
            ) {
                void handleRemove(e.detail.attachmentIndex);
            }
        };

        const handleReplaceAttachmentEvent = (e: CustomEvent) => {
            if (
                e.detail.messageId === messageId &&
                typeof e.detail.attachmentIndex === "number"
            ) {
                handleReplace(e.detail.attachmentIndex);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener(
            "removeAttachment",
            handleRemoveAttachmentEvent as EventListener
        );
        document.addEventListener(
            "replaceAttachment",
            handleReplaceAttachmentEvent as EventListener
        );

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener(
                "removeAttachment",
                handleRemoveAttachmentEvent as EventListener
            );
            document.removeEventListener(
                "replaceAttachment",
                handleReplaceAttachmentEvent as EventListener
            );
        };
    }, [
        hoveredIndex,
        checkShortcutMatch,
        messageId,
        handleRemove,
        handleReplace,
    ]);

    if (attachments.length === 0) return null;

    return (
        <>
            <div className="flex flex-wrap gap-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                {attachments.map((attachment, index) => (
                    <div
                        key={index}
                        className="relative flex items-center gap-2 px-3 py-2 rounded-lg border bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30 transition-all duration-200"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <div className="text-purple-300">
                            {getFileIcon(attachment.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-purple-100 truncate">
                                {attachment.name}
                            </div>
                            <div className="text-xs text-purple-400">
                                {formatFileSize(attachment.size)}
                            </div>
                        </div>

                        {/* Management Actions - Show on hover */}
                        {hoveredIndex === index && (
                            <div className="flex items-center gap-1 ml-2 opacity-100 transition-opacity duration-200">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleReplace(index)}
                                    className="h-6 w-6 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-600/20"
                                    title="Replace attachment (Shift+R)"
                                >
                                    <Upload className="w-3 h-3" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void handleRemove(index)}
                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-600/20"
                                    title="Remove attachment (R)"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        )}

                        {/* Keyboard shortcut tooltip */}
                        {hoveredIndex === index && (
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm border border-purple-600/30 rounded px-2 py-1 text-xs text-purple-300 whitespace-nowrap z-10">
                                <kbd className="px-1 py-0.5 bg-purple-600/20 rounded text-xs">
                                    R
                                </kbd>{" "}
                                remove •
                                <kbd className="px-1 py-0.5 bg-purple-600/20 rounded text-xs">
                                    Shift+R
                                </kbd>{" "}
                                replace
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Hidden file input for local upload replacement */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => void handleFileSelect(e)}
                accept="image/*,application/pdf,.txt,.doc,.docx,.mp3,.wav,.mp4,.mov"
            />

            {/* Library Modal with custom action for local file upload */}
            <LibraryModal
                open={showLibraryModal}
                onOpenChange={setShowLibraryModal}
                onSelectItem={(item) => void handleLibrarySelection(item)}
                initialTab="attachments"
                customActions={[
                    {
                        label: "Upload New File",
                        icon: <Upload className="w-4 h-4" />,
                        onClick: () => fileInputRef.current?.click(),
                        variant: "outline" as const,
                    },
                ]}
            />
        </>
    );
}
