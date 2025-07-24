import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface FileUploadProps {
    onFileUploaded: (file: {
        type: "attachment";
        libraryId: string;
        name: string;
        size: number;
        mimeType: string;
    }) => void;
    disabled?: boolean;
}

export function FileUpload({ onFileUploaded, disabled = false }: FileUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // FIXED: Use library system instead of direct storage upload
    const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
    const addToAttachmentLibrary = useMutation(api.library.addToAttachmentLibrary);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file size (50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            toast.error("File size must be less than 50MB");
            return;
        }

        // Validate file type
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'text/plain', 'text/markdown', 'text/csv',
            'application/json', 'text/javascript', 'text/typescript',
            'audio/mpeg', 'audio/wav', 'audio/ogg',
            'video/mp4', 'video/webm', 'video/ogg'
        ];

        if (!allowedTypes.includes(file.type)) {
            toast.error("File type not supported");
            return;
        }

        setIsUploading(true);

        try {
            // Generate upload URL
            const uploadUrl = await generateUploadUrl();

            // Upload file to storage
            const response = await fetch(uploadUrl, {
                method: "POST",
                body: file,
                headers: {
                    "Content-Type": file.type,
                },
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const { storageId } = await response.json();

            // Determine attachment type
            let attachmentType: "image" | "pdf" | "file" | "audio" | "video";
            if (file.type.startsWith('image/')) {
                attachmentType = "image";
            } else if (file.type === 'application/pdf') {
                attachmentType = "pdf";
            } else if (file.type.startsWith('audio/')) {
                attachmentType = "audio";
            } else if (file.type.startsWith('video/')) {
                attachmentType = "video";
            } else {
                attachmentType = "file";
            }

            // FIXED: Add to attachment library instead of direct storage
            const libraryId = await addToAttachmentLibrary({
                storageId,
                originalName: file.name,
                type: attachmentType,
                mimeType: file.type,
                size: file.size,
                description: `Uploaded ${attachmentType} file`,
            });

            // FIXED: Return library-based attachment format
            onFileUploaded({
                type: "attachment",
                libraryId: libraryId,
                name: file.name,
                size: file.size,
                mimeType: file.type,
            });

            toast.success(`${file.name} uploaded successfully`);

        } catch (error) {
            console.error("File upload error:", error);
            toast.error("Failed to upload file. Please try again.");
        } finally {
            setIsUploading(false);
            // Clear the input so the same file can be selected again
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,application/pdf,text/*,audio/*,video/*,.md,.json,.js,.ts,.csv"
                disabled={disabled || isUploading}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="h-8 w-8 p-0 text-purple-400 bg-purple-600/20 hover:bg-purple-600/30 transition-colors duration-200 ease-in-out"
                title="Upload file"
            >
                {isUploading ? (
                    <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Paperclip className="w-4 h-4" />
                )}
            </Button>
        </>
    );
}
