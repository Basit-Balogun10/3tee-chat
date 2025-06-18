import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { ShareModal } from "./ShareModal";
import { Share2, Link, FileText, Code, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface ShareMenuProps {
    chatId: Id<"chats">;
}

export function ShareMenu({ chatId }: ShareMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Get chat data and messages for export
    const chat = useQuery(api.chats.getChat, { chatId });
    const messages = useQuery(api.chats.getChatMessages, { chatId }) || [];

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Listen for keyboard shortcut events to open share modal
    useEffect(() => {
        const handleOpenShareModalFromMenu = (e: Event) => {
            const { chatId, mode } = (e as CustomEvent).detail;
            if (chatId === chatId) {
                setShowShareModal(true);
                setIsOpen(false);
            }
        };

        document.addEventListener(
            "openShareModalFromMenu",
            handleOpenShareModalFromMenu
        );
        return () =>
            document.removeEventListener(
                "openShareModalFromMenu",
                handleOpenShareModalFromMenu
            );
    }, [chatId]);

    const handleToggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportmarkdown = () => {
        if (!chat || !messages.length) {
            toast.error("No messages to export");
            return;
        }

        const chatTitle = chat.title || "Chat Export";
        const timestamp = new Date().toLocaleDateString();

        let markdown = `# ${chatTitle}\n\n`;
        markdown += `*Exported on ${timestamp}*\n\n`;
        markdown += `**Model:** ${chat.model}\n\n`;
        markdown += `---\n\n`;

        messages.forEach((message, index) => {
            const role =
                message.role === "user" ? "👤 **You**" : "🤖 **Assistant**";
            const time = new Date(message.timestamp).toLocaleTimeString();

            markdown += `## ${role} *(${time})*\n\n`;

            // Handle attachments
            if (message.attachments && message.attachments.length > 0) {
                markdown += `📎 **Attachments:**\n`;
                message.attachments.forEach((attachment) => {
                    markdown += `- ${attachment.name} (${attachment.type})\n`;
                });
                markdown += `\n`;
            }

            // Handle metadata (search results, images, etc.)
            if (message.metadata) {
                if (message.metadata.audioTranscription) {
                    markdown += `🎤 **Voice Input:** "${message.metadata.audioTranscription}"\n\n`;
                }

                if (message.metadata.imagePrompt) {
                    markdown += `🎨 **Image Prompt:** "${message.metadata.imagePrompt}"\n\n`;
                }

                if (message.metadata.searchResults) {
                    markdown += `🔍 **Web Search Results:**\n`;
                    message.metadata.searchResults.forEach((result: any) => {
                        markdown += `- [${result.title}](${result.url})\n`;
                        markdown += `  *${result.snippet}*\n`;
                    });
                    markdown += `\n`;
                }
            }

            markdown += `${message.content}\n\n`;

            if (index < messages.length - 1) {
                markdown += `---\n\n`;
            }
        });

        const filename = `${chatTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.md`;
        downloadFile(markdown, filename, "text/markdown");

        toast.success("Exporting chat as markdown...");
        setIsOpen(false);
    };

    const handleExportJSON = () => {
        if (!chat || !messages.length) {
            toast.error("No messages to export");
            return;
        }

        const exportData = {
            chat: {
                id: chatId,
                title: chat.title,
                model: chat.model,
                createdAt: chat._creationTime,
                updatedAt: chat.updatedAt,
                exportedAt: new Date().toISOString(),
            },
            messages: messages.map((message) => ({
                id: message._id,
                role: message.role,
                content: message.content,
                timestamp: message.timestamp,
                model: message.model,
                attachments: message.attachments,
                metadata: message.metadata,
            })),
            statistics: {
                totalMessages: messages.length,
                userMessages: messages.filter((m) => m.role === "user").length,
                assistantMessages: messages.filter(
                    (m) => m.role === "assistant"
                ).length,
                totalCharacters: messages.reduce(
                    (sum, m) => sum + m.content.length,
                    0
                ),
            },
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const filename = `${chat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.json`;
        downloadFile(jsonString, filename, "application/json");

        toast.success("Exporting file as JSON...");
        setIsOpen(false);
    };

    const handleExportPDF = async () => {
        if (!chat || !messages.length) {
            toast.error("No messages to export");
            return;
        }

        try {
            toast.info("Generating PDF...", { duration: 2000 });

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const maxLineWidth = pageWidth - 2 * margin;
            let yPosition = margin;

            // Title Page
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text(chat.title || "Chat Export", pageWidth / 2, yPosition, {
                align: "center",
            });
            yPosition += 20;

            // Metadata
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            const metadataLines = [
                `Exported on: ${new Date().toLocaleString()}`,
                `Model: ${chat.model}`,
                `Chat ID: ${chatId}`,
                `Total Messages: ${messages.length}`,
                `Created: ${new Date(chat._creationTime).toLocaleString()}`,
                `Last Updated: ${new Date(chat.updatedAt).toLocaleString()}`,
            ];

            metadataLines.forEach((line) => {
                doc.text(line, pageWidth / 2, yPosition, { align: "center" });
                yPosition += 8;
            });

            yPosition += 20;

            // Statistics
            const userMessages = messages.filter(
                (m) => m.role === "user"
            ).length;
            const assistantMessages = messages.filter(
                (m) => m.role === "assistant"
            ).length;
            const totalChars = messages.reduce(
                (sum, m) => sum + m.content.length,
                0
            );

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Chat Statistics", margin, yPosition);
            yPosition += 15;

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const statsLines = [
                `User Messages: ${userMessages}`,
                `Assistant Messages: ${assistantMessages}`,
                `Total Characters: ${totalChars.toLocaleString()}`,
                `Average Message Length: ${Math.round(totalChars / messages.length)} characters`,
            ];

            statsLines.forEach((line) => {
                doc.text(line, margin, yPosition);
                yPosition += 6;
            });

            // Start new page for messages
            doc.addPage();
            yPosition = margin;

            // Messages header
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Chat Messages", margin, yPosition);
            yPosition += 20;

            // Process each message
            messages.forEach((message, index) => {
                const role =
                    message.role === "user" ? "👤 You" : "🤖 Assistant";
                const timestamp = new Date(message.timestamp).toLocaleString();

                // Check if we need a new page
                if (yPosition > pageHeight - 60) {
                    doc.addPage();
                    yPosition = margin;
                }

                // Message header
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(
                    message.role === "user" ? [0, 100, 200] : [150, 0, 150]
                );
                doc.text(`${role} - ${timestamp}`, margin, yPosition);
                yPosition += 10;

                // Message content
                doc.setFont("helvetica", "normal");
                doc.setTextColor(0, 0, 0);

                // Split long content into lines
                const lines = doc.splitTextToSize(
                    message.content,
                    maxLineWidth
                );
                lines.forEach((line: string) => {
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = margin;
                    }
                    doc.text(line, margin, yPosition);
                    yPosition += 6;
                });

                // Handle attachments
                if (message.attachments && message.attachments.length > 0) {
                    yPosition += 5;
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(100, 100, 100);
                    message.attachments.forEach((attachment) => {
                        if (yPosition > pageHeight - 20) {
                            doc.addPage();
                            yPosition = margin;
                        }
                        doc.text(
                            `📎 Attachment: ${attachment.name} (${attachment.type})`,
                            margin,
                            yPosition
                        );
                        yPosition += 6;
                    });
                }

                // Handle metadata
                if (message.metadata) {
                    if (message.metadata.audioTranscription) {
                        yPosition += 3;
                        doc.setFont("helvetica", "italic");
                        doc.setTextColor(0, 150, 0);
                        const transcriptLines = doc.splitTextToSize(
                            `🎤 Voice Input: "${message.metadata.audioTranscription}"`,
                            maxLineWidth
                        );
                        transcriptLines.forEach((line: string) => {
                            if (yPosition > pageHeight - 20) {
                                doc.addPage();
                                yPosition = margin;
                            }
                            doc.text(line, margin, yPosition);
                            yPosition += 6;
                        });
                    }

                    if (message.metadata.searchResults) {
                        yPosition += 5;
                        doc.setFont("helvetica", "italic");
                        doc.setTextColor(200, 100, 0);
                        doc.text("🔍 Web Search Results:", margin, yPosition);
                        yPosition += 6;

                        message.metadata.searchResults.forEach(
                            (result: any) => {
                                if (yPosition > pageHeight - 30) {
                                    doc.addPage();
                                    yPosition = margin;
                                }
                                const resultLines = doc.splitTextToSize(
                                    `• ${result.title} - ${result.snippet}`,
                                    maxLineWidth - 10
                                );
                                resultLines.forEach((line: string) => {
                                    doc.text(line, margin + 5, yPosition);
                                    yPosition += 5;
                                });
                                yPosition += 2;
                            }
                        );
                    }
                }

                yPosition += 15; // Space between messages

                // Add separator line
                if (index < messages.length - 1) {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(
                        margin,
                        yPosition - 8,
                        pageWidth - margin,
                        yPosition - 8
                    );
                }
            });

            // Save the PDF
            const filename = `${chat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.pdf`;
            doc.save(filename);

            toast.success("PDF exported successfully!");
            setIsOpen(false);
        } catch (error) {
            console.error("PDF export error:", error);
            toast.error("Failed to export PDF");
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleDropdown}
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => {
                    setIsOpen(false);
                }}
                className="p-2 rounded-lg hover:bg-purple-500/30 transition-colors text-purple-200"
                title="Share & Export"
            >
                <Share2 className="w-5 h-5" />
            </Button>

            {isOpen && (
                <div
                    className="absolute top-full right-0 mt-2 min-w-[200px] h-[25rem] bg-gray-900/95 backdrop-blur-md border border-purple-600/30 rounded-lg shadow-xl z-[999]"
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                >
                    <div className="p-1 space-y-0.5">
                        <button
                            onClick={() => {
                                setShowShareModal(true);
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left"
                        >
                            <Link className="w-4 h-4" />
                            Share Chat
                        </button>

                        <div className="border-t border-purple-600/20 my-1"></div>

                        <button
                            onClick={handleExportmarkdown}
                            disabled={!messages.length}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" />
                            Export as markdown
                        </button>

                        <button
                            onClick={handleExportJSON}
                            disabled={!messages.length}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left disabled:opacity-50"
                        >
                            <Code className="w-4 h-4" />
                            Export as JSON
                        </button>

                        <button
                            onClick={handleExportPDF}
                            disabled={!messages.length}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left disabled:opacity-50"
                        >
                            <FileDown className="w-4 h-4" />
                            Export as PDF
                        </button>

                        {!messages.length && (
                            <div className="px-3 py-2 text-xs text-purple-400 text-center border-t border-purple-600/20 mt-1">
                                No messages to export
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ShareModal
                open={showShareModal}
                onOpenChange={setShowShareModal}
                itemId={chatId}
                itemType="chat"
                itemTitle={chat?.title}
            />
        </div>
    );
}
