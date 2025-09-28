import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { ShareModal } from "./ShareModal";
import { PasswordProtectionModal } from "./PasswordProtectionModal";
import {
    Share2,
    Link,
    FileText,
    Code,
    FileDown,
    Lock,
    Unlock,
    Shield,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
} from "docx";

interface ShareMenuProps {
    chatId: Id<"chats">;
}

export function ShareMenu({ chatId }: ShareMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordMode, setPasswordMode] = useState<"set" | "remove">("set");

    const menuRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const chat = useQuery(api.chats.getChat, { chatId });
    const messages = useQuery(api.chats.getChatMessages, { chatId }) || [];
    const passwordStatus = useQuery(api.chats.checkPasswordStatus, { chatId });

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
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleOpenShareModalFromMenu = (e: Event) => {
            const { chatId: eventChatId } = (e as CustomEvent).detail;
            if (eventChatId === chatId) {
                setShowShareModal(true);
                setIsOpen(false);
            }
        };
        document.addEventListener(
            "openShareModalFromMenu",
            handleOpenShareModalFromMenu
        );
        return () => {
            document.removeEventListener(
                "openShareModalFromMenu",
                handleOpenShareModalFromMenu
            );
        };
    }, [chatId]);

    const handleToggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const clearCloseTimeout = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    };

    const scheduleClose = () => {
        clearCloseTimeout();
        closeTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 100);
    };

    const downloadFile = (
        content: string | Blob,
        filename: string,
        mimeType: string
    ) => {
        const blob =
            content instanceof Blob
                ? content
                : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleMouseEnter = () => {
        clearCloseTimeout();
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        scheduleClose();
    };

    const handleDropdownMouseEnter = () => {
        clearCloseTimeout();
    };

    const handleDropdownMouseLeave = () => {
        scheduleClose();
    };

    const handlePasswordProtection = (mode: "set" | "remove") => {
        setPasswordMode(mode);
        setShowPasswordModal(true);
        setIsOpen(false);
    };

    // Enhanced Export System from SettingsModal (adapted for a single chat)

    const generateEnhancedExportData = (chatData: any, messagesData: any[]) => {
        const timestamp = new Date().toISOString();
        let totalBranches = 0;
        let branchedConversations = 0;

        const chatBranches = messagesData.reduce((count: number, msg: any) => {
            if (msg.branches && msg.branches.length > 1) {
                return count + msg.branches.length;
            }
            return count;
        }, 0);

        if (chatBranches > 0) {
            branchedConversations = 1;
            totalBranches = chatBranches;
        }

        const enhancedChat = {
            id: chatData._id,
            title: chatData.title,
            model: chatData.model,
            createdAt: chatData._creationTime,
            updatedAt: chatData.updatedAt,
            isStarred: chatData.isStarred,
            activeBranchId: chatData.activeBranchId,
            baseMessages: chatData.baseMessages || [],
            hasBranches: chatBranches > 0,
            messages: messagesData.map((msg: any) => ({
                id: msg._id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                model: msg.model,
                attachments: msg.attachments,
                metadata: msg.metadata,
                branchId: msg.branchId,
                branches: msg.branches || [],
                activeBranchId: msg.activeBranchId,
                hasBranches: msg.branches && msg.branches.length > 1,
            })),
        };

        return {
            exportInfo: {
                version: "2.0.0",
                timestamp,
                totalChats: 1,
                branchingSystemVersion: "1.0.0",
                branchCount: totalBranches,
                branchedConversations,
            },
            chats: [enhancedChat],
        };
    };

    const generateEnhancedMarkdownExport = (data: any) => {
        let markdown = `# Advanced Chat Export (with Branching Support)\n\n`;
        markdown += `**Exported on:** ${new Date(
            data.exportInfo.timestamp
        ).toLocaleString()}\n`;
        if (data.exportInfo.branchCount > 0) {
            markdown += `**Total Branches:** ${data.exportInfo.branchCount}\n`;
        }
        markdown += `\n`;

        data.chats.forEach((chat: any) => {
            markdown += `## ${chat.title}${chat.hasBranches ? " 🌿" : ""}\n\n`;
            markdown += `**Model:** ${chat.model} | **Created:** ${new Date(
                chat.createdAt
            ).toLocaleDateString()}\n\n`;
            chat.messages.forEach((message: any) => {
                const role =
                    message.role === "user" ? "👤 **You**" : "🤖 **Assistant**";
                const time = new Date(message.timestamp).toLocaleTimeString();
                markdown += `### ${role} *(${time})*`;
                if (message.hasBranches) {
                    markdown += ` 🌿 *[${message.branches.length} branches]*`;
                }
                markdown += `\n\n${message.content}\n\n---\n\n`;
            });
        });
        return markdown;
    };

    const generateEnhancedPDFExport = async (data: any) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const maxLineWidth = pageWidth - 2 * margin;
        let yPosition = margin;

        const chat = data.chats[0];

        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text(chat.title || "Chat Export", pageWidth / 2, yPosition, {
            align: "center",
        });
        yPosition += 15;

        if (chat.hasBranches) {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 200);
            doc.text(
                "🌿 (Includes Conversation Branches)",
                pageWidth / 2,
                yPosition,
                { align: "center" }
            );
            yPosition += 15;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        const metadataLines = [
            `Exported on: ${new Date(
                data.exportInfo.timestamp
            ).toLocaleString()}`,
            `Model: ${chat.model}`,
        ];
        metadataLines.forEach((line) => {
            doc.text(line, pageWidth / 2, yPosition, { align: "center" });
            yPosition += 7;
        });

        doc.addPage();
        yPosition = margin;

        for (const message of chat.messages) {
            const role = message.role === "user" ? "👤 You" : "🤖 Assistant";
            const timestamp = new Date(message.timestamp).toLocaleString();
            let messageHeader = `${role} - ${timestamp}`;
            if (message.hasBranches) {
                messageHeader += ` 🌿 (${message.branches.length} branches)`;
            }

            if (yPosition > doc.internal.pageSize.getHeight() - 40) {
                doc.addPage();
                yPosition = margin;
            }

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(
                message.role === "user" ? 60 : 120,
                message.role === "user" ? 120 : 60,
                message.role === "user" ? 220 : 180
            );
            doc.text(messageHeader, margin, yPosition);
            yPosition += 10;

            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
            const lines = doc.splitTextToSize(message.content, maxLineWidth);
            lines.forEach((line: string) => {
                if (yPosition > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    yPosition = margin;
                }
                doc.text(line, margin, yPosition);
                yPosition += 6;
            });
            yPosition += 10;
        }

        const pdfBlob = doc.output("blob");
        return pdfBlob;
    };

    const generateEnhancedDOCXExport = async (data: any) => {
        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: [],
                },
            ],
        });

        const chat = data.chats[0];

        // Title
        doc.addSection({
            children: [
                new Paragraph({
                    text: chat.title || "Chat Export",
                    heading: HeadingLevel.HEADING_1,
                }),
            ],
        });

        if (chat.hasBranches) {
            doc.addSection({
                children: [
                    new Paragraph({
                        text: "🌿 (Includes Conversation Branches)",
                        heading: HeadingLevel.HEADING_2,
                    }),
                ],
            });
        }

        // Metadata
        const metadataTable = [
            [
                "Exported on",
                new Date(data.exportInfo.timestamp).toLocaleString(),
            ],
            ["Model", chat.model],
        ];

        doc.addSection({
            children: [
                new Table({
                    rows: metadataTable.map((row) =>
                        new TableRow({
                            children: row.map(
                                (cell) =>
                                    new TableCell({
                                        children: [
                                            new Paragraph({
                                                text: cell,
                                                heading: HeadingLevel.HEADING_3,
                                            }),
                                        ],
                                    })
                            ),
                        })
                    ),
                }),
            ],
        });

        // Chat Messages
        for (const message of chat.messages) {
            const role = message.role === "user" ? "👤 You" : "🤖 Assistant";
            const timestamp = new Date(message.timestamp).toLocaleString();
            let messageHeader = `${role} - ${timestamp}`;
            if (message.hasBranches) {
                messageHeader += ` 🌿 (${message.branches.length} branches)`;
            }

            doc.addSection({
                children: [
                    new Paragraph({
                        text: messageHeader,
                        heading: HeadingLevel.HEADING_2,
                    }),
                    new Paragraph({
                        text: message.content,
                        heading: HeadingLevel.HEADING_3,
                    }),
                ],
            });
        }

        const blob = await Packer.toBlob(doc);
        return blob;
    };

    const handleExport = async (format: "json" | "markdown" | "pdf" | "docx") => {
        if (!chat || messages.length === 0) {
            toast.error("No content to export.");
            return;
        }

        toast.info(`Generating ${format.toUpperCase()} export...`);

        try {
            const exportData = generateEnhancedExportData(chat, messages);
            const timestamp = new Date().toISOString().split("T")[0];
            const baseFilename = `${chat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${timestamp}`;

            let content: string | Blob = "";
            let filename = "";
            let mimeType = "";

            switch (format) {
                case "json":
                    content = JSON.stringify(exportData, null, 2);
                    filename = `${baseFilename}.json`;
                    mimeType = "application/json";
                    break;
                case "markdown":
                    content = generateEnhancedMarkdownExport(exportData);
                    filename = `${baseFilename}.md`;
                    mimeType = "text/markdown";
                    break;
                case "pdf":
                    content = await generateEnhancedPDFExport(exportData);
                    filename = `${baseFilename}.pdf`;
                    mimeType = "application/pdf";
                    break;
                case "docx":
                    content = await generateEnhancedDOCXExport(exportData);
                    filename = `${baseFilename}.docx`;
                    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    break;
            }

            downloadFile(content, filename, mimeType);
            toast.success(
                `Chat successfully exported as ${format.toUpperCase()}.`
            );
        } catch (error) {
            console.error(`Export failed for format: ${format}`, error);
            toast.error(`Failed to export chat as ${format.toUpperCase()}.`);
        } finally {
            setIsOpen(false);
        }
    };

    return (
        <div ref={menuRef}>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleDropdown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="p-2 rounded-lg hover:bg-purple-500/30 transition-colors text-purple-200"
                title="Share & Export"
            >
                <Share2 className="w-5 h-5" />
            </Button>

            {isOpen && (
                <div
                    className="absolute right-24 top-14 mt-2 min-w-[220px] bg-gray-900/95 backdrop-blur-md border border-purple-600/30 rounded-lg shadow-xl z-[9999]"
                    onMouseEnter={handleDropdownMouseEnter}
                    onMouseLeave={handleDropdownMouseLeave}
                >
                    <div className="p-1 space-y-0.5">
                        <button
                            onClick={() => {
                                clearCloseTimeout();
                                setIsOpen(false);
                                setShowShareModal(true);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left"
                        >
                            <Link className="w-4 h-4" />
                            Share Chat
                        </button>

                        <div className="border-t border-purple-600/20 my-1"></div>

                        <button
                            onClick={() => handleExport("markdown")}
                            disabled={!messages.length}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" />
                            Export as Markdown
                        </button>

                        <button
                            onClick={() => handleExport("json")}
                            disabled={!messages.length}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left disabled:opacity-50"
                        >
                            <Code className="w-4 h-4" />
                            Export as JSON
                        </button>

                        <button
                            onClick={() => handleExport("pdf")}
                            disabled={!messages.length}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left disabled:opacity-50"
                        >
                            <FileDown className="w-4 h-4" />
                            Export as PDF
                        </button>

                        <button
                            onClick={() => handleExport("docx")}
                            disabled={!messages.length}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left disabled:opacity-50"
                        >
                            <FileDown className="w-4 h-4" />
                            Export as DOCX
                        </button>
                    </div>

                    <div className="border-t border-purple-600/20 my-1"></div>

                    <div className="px-2 py-1.5">
                        <div className="text-xs font-medium text-purple-200/80 uppercase tracking-wider mb-2 px-1">
                            Security
                        </div>
                        {passwordStatus?.isPasswordProtected ? (
                            <>
                                <button
                                    onClick={() =>
                                        handlePasswordProtection("remove")
                                    }
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-orange-300 hover:bg-orange-600/20 rounded-lg transition-colors text-left"
                                >
                                    <Unlock className="w-4 h-4" />
                                    Remove Password
                                </button>
                                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-green-400">
                                    <Shield className="w-3 h-3" />
                                    <span>Protected</span>
                                </div>
                            </>
                        ) : (
                            <button
                                onClick={() => handlePasswordProtection("set")}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-300 hover:bg-purple-600/20 rounded-lg transition-colors text-left"
                            >
                                <Lock className="w-4 h-4" />
                                Set Password
                            </button>
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

            <PasswordProtectionModal
                open={showPasswordModal}
                onOpenChange={setShowPasswordModal}
                chatId={chatId}
                mode={passwordMode}
            />
        </div>
    );
}

