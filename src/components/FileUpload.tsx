import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface FileUploadProps {
    onFileUploaded: (attachment: {
        type: "image" | "pdf" | "file";
        storageId: string;
        name: string;
        size: number;
    }) => void;
}

export function FileUpload({ onFileUploaded }: FileUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const generateUploadUrl = useMutation(api.messages.generateUploadUrl);

    const handleFileSelect = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert("File size must be less than 10MB");
            return;
        }

        setIsUploading(true);
        try {
            // Get upload URL
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

            // Determine file type
            let type: "image" | "pdf" | "file" = "file";
            if (file.type.startsWith("image/")) {
                type = "image";
            } else if (file.type === "application/pdf") {
                type = "pdf";
            }

            onFileUploaded({
                type,
                storageId,
                name: file.name,
                size: file.size,
            });
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload file");
        } finally {
            setIsUploading(false);
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
                accept="image/*,.pdf,.txt,.doc,.docx"
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 w-8 p-0 bg-purple-500/20 hover:bg-purple-500/30 transition-colors duration-200 ease-in-out disabled:opacity-50"
                title="Upload file"
            >
                {isUploading ? (
                    <div className="w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin"></div>
                ) : (
                    <svg
                        className="w-4 h-4 text-purple-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                    </svg>
                )}
            </Button>
        </>
    );
}
