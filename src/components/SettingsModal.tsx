import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ModelSelector } from "./ModelSelector";
import {
    Eye,
    EyeOff,
    Key,
    Zap,
    Palette,
    Save,
    Download,
    Trash2,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Folder,
    MessageSquare,
    Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import jsPDF from "jspdf";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Helper functions moved to the top level for clarity and to fix syntax errors
const generateTextExport = (data: any) => {
    let text = `DATA EXPORT\n${"=".repeat(50)}\n\n`;
    text += `Exported on: ${new Date(
        data.exportInfo.timestamp
    ).toLocaleString()}\n`;
    text += `Format: ${data.exportInfo.format.toUpperCase()}\n\n`;

    if (data.userSettings) {
        text += `USER SETTINGS\n${"-".repeat(20)}\n`;
        text += `Default Model: ${data.userSettings.defaultModel}\n`;
        text += `Theme: ${data.userSettings.theme}\n`;
        text += `Local First: ${
            data.userSettings.localFirst ? "Yes" : "No"
        }\n\n`;
    }

    const formatChat = (chat: any, prefix = "") => {
        let chatText = `${prefix}${chat.title}\n`;
        chatText += `${prefix}Model: ${chat.model} | Created: ${new Date(
            chat.createdAt
        ).toLocaleDateString()}\n`;
        chatText += `${prefix}${"-".repeat(40)}\n`;

        chat.messages.forEach((message: any) => {
            const role = message.role === "user" ? "YOU" : "ASSISTANT";
            const time = new Date(message.timestamp).toLocaleTimeString();
            chatText += `${prefix}[${time}] ${role}:\n${message.content}\n\n`;
        });
        return chatText + `\n${prefix}${"=".repeat(50)}\n\n`;
    };

    if (data.project) {
        text += `PROJECT: ${data.project.name}\n${"-".repeat(30)}\n`;
        text += `Description: ${
            data.project.description || "No description"
        }\n`;
        text += `Created: ${new Date(
            data.project.createdAt
        ).toLocaleString()}\n`;
        text += `Total Chats: ${data.project.chats.length}\n\n`;
        data.project.chats.forEach((chat: any) => {
            text += formatChat(chat);
        });
    } else if (data.workspace) {
        text += `WORKSPACE EXPORT\nTotal Projects: ${
            data.workspace.projects.length
        }\nTotal Unorganized Chats: ${
            data.workspace.unorganizedChats.length
        }\n\n`;
        data.workspace.projects.forEach((project: any) => {
            text += `PROJECT: ${project.name}\n${"=".repeat(30)}\n`;
            project.chats.forEach((chat: any) => {
                text += formatChat(chat, "  ");
            });
        });
        if (data.workspace.unorganizedChats.length > 0) {
            text += `UNORGANIZED CHATS\n${"=".repeat(30)}\n`;
            data.workspace.unorganizedChats.forEach((chat: any) => {
                text += formatChat(chat);
            });
        }
    } else {
        data.chats.forEach((chat: any) => {
            text += formatChat(chat);
        });
    }

    return text;
};

const generateMarkdownExport = (data: any) => {
    let markdown = `# Chat Export\n\n`;
    markdown += `**Exported on:** ${new Date(
        data.exportInfo.timestamp
    ).toLocaleString()}\n`;
    markdown += `**Total Chats:** ${data.exportInfo.totalChats}\n\n`;

    if (data.userSettings) {
        markdown += `## User Settings\n\n`;
        markdown += `- **Default Model:** ${data.userSettings.defaultModel}\n`;
        markdown += `- **Theme:** ${data.userSettings.theme}\n`;
        markdown += `- **Local First:** ${
            data.userSettings.localFirst ? "Yes" : "No"
        }\n\n`;
    }

    data.chats.forEach((chat: any, index: number) => {
        markdown += `## ${index + 1}. ${chat.title}\n\n`;
        markdown += `**Model:** ${chat.model} | **Created:** ${new Date(
            chat.createdAt
        ).toLocaleDateString()}\n\n`;

        chat.messages.forEach((message: any) => {
            const role =
                message.role === "user" ? "👤 **You**" : "🤖 **Assistant**";
            const time = new Date(message.timestamp).toLocaleTimeString();
            markdown += `### ${role} *(${time})*\n\n`;
            markdown += `${message.content}\n\n`;
        });

        markdown += `---\n\n`;
    });

    return markdown;
};

const generateCSVExport = (data: any) => {
    let csv =
        "Chat ID,Chat Title,Message Role,Message Content,Timestamp,Model,Project ID,Project Name\n";
    const processChat = (chat: any, projectId = "", projectName = "") => {
        chat.messages.forEach((message: any) => {
            const escapedContent = `"${message.content.replace(/"/g, '""')}"`;
            const escapedTitle = `"${chat.title.replace(/"/g, '""')}"`;
            const escapedProjectName = `"${projectName.replace(/"/g, '""')}"`;
            csv += `${chat.id},${escapedTitle},${message.role},${escapedContent},${new Date(
                message.timestamp
            ).toISOString()},${message.model || chat.model},${projectId},${escapedProjectName}\n`;
        });
    };

    if (data.project) {
        data.project.chats.forEach((chat: any) => processChat(chat, data.project.id, data.project.name));
    } else if (data.workspace) {
        data.workspace.projects.forEach((project: any) => {
            project.chats.forEach((chat: any) =>
                processChat(chat, project.id, project.name)
            );
        });
        data.workspace.unorganizedChats.forEach((chat: any) =>
            processChat(chat)
        );
    } else {
        data.chats.forEach((chat: any) => processChat(chat));
    }
    return csv;
};

const generatePDFExport = async (data: any) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const maxLineWidth = pageWidth - 2 * margin;
        let yPosition = margin;

        const checkNewPage = (neededHeight: number) => {
            if (yPosition > pageHeight - neededHeight) {
                doc.addPage();
                yPosition = margin;
            }
        };

        // Title Page
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("Chat Export", pageWidth / 2, yPosition, {
            align: "center",
        });
        yPosition += 20;

        // Metadata
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const metadataLines = [
            `Exported on: ${new Date(
                data.exportInfo.timestamp
            ).toLocaleString()}`,
            `Export Format: PDF`,
            `Includes Settings: ${
                data.exportInfo.includesSettings ? "Yes" : "No"
            }`,
        ];

        metadataLines.forEach((line) => {
            doc.text(line, pageWidth / 2, yPosition, { align: "center" });
            yPosition += 8;
        });

        if (data.userSettings) {
            checkNewPage(80);
            yPosition += 20;
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("User Settings", margin, yPosition);
            yPosition += 15;

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const settingsLines = [
                `Default Model: ${data.userSettings.defaultModel}`,
                `Theme: ${data.userSettings.theme}`,
                `Local First: ${
                    data.userSettings.localFirst ? "Enabled" : "Disabled"
                }`,
                `Voice Auto-play: ${
                    data.userSettings.voiceSettings?.autoPlay
                        ? "Enabled"
                        : "Disabled"
                }`,
                `Voice: ${data.userSettings.voiceSettings?.voice || "alloy"}`,
                `Speech Speed: ${
                    data.userSettings.voiceSettings?.speed || 1.0
                }x`,
            ];

            settingsLines.forEach((line) => {
                doc.text(line, margin, yPosition);
                yPosition += 6;
            });
        }

        doc.addPage();
        yPosition = margin;

        const drawChat = (chat: any, chatIndex: number) => {
            checkNewPage(80);

            // Chat header
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 100, 200);
            doc.text(`${chatIndex + 1}. ${chat.title}`, margin, yPosition);
            yPosition += 10;

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            const chatMetadata = [
                `Model: ${chat.model}`,
                `Created: ${new Date(chat.createdAt).toLocaleString()}`,
                `Last Updated: ${new Date(chat.updatedAt).toLocaleString()}`,
                `Messages: ${chat.messages.length}`,
                `Starred: ${chat.isStarred ? "Yes" : "No"}`,
            ];

            chatMetadata.forEach((line) => {
                checkNewPage(20);
                doc.text(line, margin, yPosition);
                yPosition += 6;
            });

            yPosition += 10;

            chat.messages.forEach((message: any, msgIndex: number) => {
                const role =
                    message.role === "user" ? "👤 You" : "🤖 Assistant";
                const timestamp = new Date(
                    message.timestamp
                ).toLocaleString();

                checkNewPage(60);

                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                if (message.role === "user") {
                    doc.setTextColor(0, 100, 200);
                } else {
                    doc.setTextColor(150, 0, 150);
                }
                doc.text(`${role} - ${timestamp}`, margin, yPosition);
                yPosition += 10;

                doc.setFont("helvetica", "normal");
                doc.setTextColor(0, 0, 0);

                const lines = doc.splitTextToSize(
                    message.content,
                    maxLineWidth
                );
                lines.forEach((line: string) => {
                    checkNewPage(20);
                    doc.text(line, margin, yPosition);
                    yPosition += 6;
                });

                if (msgIndex < chat.messages.length - 1) {
                    yPosition += 8;
                    checkNewPage(20);
                    doc.setDrawColor(200, 200, 200);
                    doc.line(
                        margin,
                        yPosition - 4,
                        pageWidth - margin,
                        yPosition - 4
                    );
                }
            });

            yPosition += 15;
        };

        if (data.project) {
            // ... (Project PDF Logic)
        } else if (data.workspace) {
            // ... (Workspace PDF Logic)
        } else {
            data.chats.forEach(drawChat);
        }

        const pdfBlob = doc.output("blob");
        // Returning blob URL, not the blob itself
        return URL.createObjectURL(pdfBlob);
    } catch (error) {
        console.error("PDF generation error:", error);
        throw new Error("Failed to generate PDF");
    }
};

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const preferences = useQuery(api.preferences.getUserPreferences);
    const allChats = useQuery(api.preferences.getAllUserChats) || [];
    const allProjects = useQuery(api.projects.listProjects) || [];
    const fullWorkspaceData = useQuery(api.projects.getFullWorkspaceExport);
    const updatePreferences = useMutation(api.preferences.updatePreferences);
    const deleteAllChats = useMutation(api.preferences.deleteAllUserChats);
    const deleteAccount = useMutation(api.preferences.deleteUserAccount);

    // Navigation state
    const [currentPage, setCurrentPage] = useState<
        "main" | "export" | "delete"
    >("main");

    // Export page state
    const [exportMode, setExportMode] = useState<
        "chats" | "projects" | "workspace"
    >("chats");
    const [selectedChats, setSelectedChats] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [exportSettings, setExportSettings] = useState(true);
    const [exportFormat, setExportFormat] = useState<
        "json" | "markdown" | "csv" | "txt" | "pdf"
    >("json");
    const [showDeleteDropdown, setShowDeleteDropdown] = useState(false);

    // Delete confirmation state
    const [deleteType, setDeleteType] = useState<"chats" | "account">("chats");
    const [deleteConfirmation, setDeleteConfirmation] = useState("");

    const getSelectedChatsData = useQuery(
        api.preferences.getSelectedChatsData,
        currentPage === "export" &&
            exportMode === "chats" &&
            selectedChats.length > 0
            ? { chatIds: selectedChats as Id<"chats">[] }
            : "skip"
    );

    const getSelectedProjectData = useQuery(
        api.projects.getProjectWithAllChats,
        currentPage === "export" &&
            exportMode === "projects" &&
            selectedProject
            ? { projectId: selectedProject as Id<"projects"> }
            : "skip"
    );

    // Main settings state
    const [apiKeys, setApiKeys] = useState({
        openai: "",
        anthropic: "",
        gemini: "",
        deepseek: "",
        openrouter: "",
    });
    const [apiKeyPreferences, setApiKeyPreferences] = useState({
        openai: true,
        anthropic: true,
        gemini: true,
        deepseek: true,
        openrouter: true,
    });
    const [showApiKeys, setShowApiKeys] = useState({
        openai: false,
        anthropic: false,
        gemini: false,
        deepseek: false,
        openrouter: false,
    });
    const [settings, setSettings] = useState({
        defaultModel: "gpt-4o-mini",
        theme: "dark" as "light" | "dark" | "system",
        localFirst: false,
        voiceSettings: {
            autoPlay: false,
            voice: "alloy",
            speed: 1.0,
            buzzWord: "",
        },
    });

    useEffect(() => {
        if (preferences) {
            setSettings({
                defaultModel: preferences.defaultModel || "gpt-4o-mini",
                theme:
                    (preferences.theme as "light" | "dark" | "system") ||
                    "dark",
                localFirst: preferences.localFirst || false,
                voiceSettings: {
                    autoPlay: preferences.voiceSettings?.autoPlay || false,
                    voice: preferences.voiceSettings?.voice || "alloy",
                    speed: preferences.voiceSettings?.speed || 1.0,
                    buzzWord: preferences.voiceSettings?.buzzWord || "",
                },
            });
            if (
                preferences.apiKeys &&
                typeof preferences.apiKeys === "object"
            ) {
                setApiKeys({
                    openai: (preferences.apiKeys as any).openai || "",
                    anthropic: (preferences.apiKeys as any).anthropic || "",
                    gemini: (preferences.apiKeys as any).gemini || "",
                    deepseek: (preferences.apiKeys as any).deepseek || "",
                    openrouter: (preferences.apiKeys as any).openrouter || "",
                });
            }
            if (
                preferences.apiKeyPreferences &&
                typeof preferences.apiKeyPreferences === "object"
            ) {
                setApiKeyPreferences({
                    openai:
                        (preferences.apiKeyPreferences as any).openai ?? true,
                    anthropic:
                        (preferences.apiKeyPreferences as any).anthropic ??
                        true,
                    gemini:
                        (preferences.apiKeyPreferences as any).gemini ?? true,
                    deepseek:
                        (preferences.apiKeyPreferences as any).deepseek ?? true,
                    openrouter:
                        (preferences.apiKeyPreferences as any).openrouter ??
                        true,
                });
            }
        }
    }, [preferences]);

    useEffect(() => {
        if (!open) {
            setCurrentPage("main");
            setSelectedChats([]);
            setSelectedProject(null);
            setDeleteConfirmation("");
            setShowDeleteDropdown(false);
        }
    }, [open]);

    const handleSave = async () => {
        try {
            const currentApiKeys = (preferences?.apiKeys as any) || {};
            const newApiKeyPreferences = { ...apiKeyPreferences };

            Object.entries(apiKeys).forEach(([provider, key]) => {
                const currentKey = currentApiKeys[provider] || "";
                const hasNewKey =
                    key.trim().length > 0 && currentKey.trim().length === 0;
                if (hasNewKey) {
                    newApiKeyPreferences[
                        provider as keyof typeof apiKeyPreferences
                    ] = true;
                }
            });

            await updatePreferences({
                ...settings,
                apiKeys,
                apiKeyPreferences: newApiKeyPreferences,
            });
            toast.success("Settings saved successfully!");
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to save settings");
        }
    };

    const handleModelChange = (model: string) => {
        setSettings((prev) => ({ ...prev, defaultModel: model }));
    };

    const handleSelectAllChats = () => {
        if (selectedChats.length === allChats.length) {
            setSelectedChats([]);
        } else {
            setSelectedChats(allChats.map((chat) => chat._id));
        }
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
    
    const generateExportData = (chatsData: any[], settings: any) => {
        const timestamp = new Date().toISOString();
        const exportData = {
            exportInfo: {
                timestamp,
                totalChats: chatsData.length,
                format: exportFormat,
                includesSettings: exportSettings,
            },
            ...(exportSettings && { userSettings: settings }),
            chats: chatsData.map(({ chat, messages }) => ({
                id: chat._id,
                title: chat.title,
                model: chat.model,
                createdAt: chat._creationTime,
                updatedAt: chat.updatedAt,
                isStarred: chat.isStarred,
                messages: messages.map((msg: any) => ({
                    id: msg._id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    model: msg.model,
                    attachments: msg.attachments,
                    metadata: msg.metadata,
                })),
            })),
        };

        return exportData;
    };

    const generateProjectExportData = (projectData: any, settings: any) => {
        const timestamp = new Date().toISOString();
        const exportData = {
            exportInfo: {
                timestamp,
                totalChats: projectData.chats.length,
                format: exportFormat,
                includesSettings: exportSettings,
            },
            ...(exportSettings && { userSettings: settings }),
            project: {
                id: projectData._id,
                name: projectData.name,
                description: projectData.description,
                createdAt: projectData._creationTime,
                updatedAt: projectData.updatedAt,
                chats: projectData.chats.map((chat: any) => ({
                    id: chat._id,
                    title: chat.title,
                    model: chat.model,
                    createdAt: chat._creationTime,
                    updatedAt: chat.updatedAt,
                    isStarred: chat.isStarred,
                    messages: chat.messages.map((msg: any) => ({
                        id: msg._id,
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        model: msg.model,
                        attachments: msg.attachments,
                        metadata: msg.metadata,
                    })),
                })),
            },
        };

        return exportData;
    };

    const generateWorkspaceExportData = (workspaceData: any, settings: any) => {
        const timestamp = new Date().toISOString();
        const totalChats = workspaceData.projects.reduce((total: number, project: any) => total + project.chats.length, 0) + workspaceData.unorganizedChats.length;
        
        const exportData = {
            exportInfo: {
                timestamp,
                totalProjects: workspaceData.projects.length,
                totalChats,
                unorganizedChats: workspaceData.unorganizedChats.length,
                format: exportFormat,
                includesSettings: exportSettings,
            },
            ...(exportSettings && { userSettings: settings }),
            workspace: {
                projects: workspaceData.projects.map((project: any) => ({
                    id: project._id,
                    name: project.name,
                    description: project.description,
                    createdAt: project._creationTime,
                    updatedAt: project.updatedAt,
                    chats: project.chats.map((chat: any) => ({
                        id: chat._id,
                        title: chat.title,
                        model: chat.model,
                        createdAt: chat._creationTime,
                        updatedAt: chat.updatedAt,
                        isStarred: chat.isStarred,
                        messages: chat.messages.map((msg: any) => ({
                            id: msg._id,
                            role: msg.role,
                            content: msg.content,
                            timestamp: msg.timestamp,
                            model: msg.model,
                            attachments: msg.attachments,
                            metadata: msg.metadata,
                        })),
                    })),
                })),
                unorganizedChats: workspaceData.unorganizedChats.map((chat: any) => ({
                    id: chat._id,
                    title: chat.title,
                    model: chat.model,
                    createdAt: chat._creationTime,
                    updatedAt: chat.updatedAt,
                    isStarred: chat.isStarred,
                    messages: chat.messages.map((msg: any) => ({
                        id: msg._id,
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        model: msg.model,
                        attachments: msg.attachments,
                        metadata: msg.metadata,
                    })),
                })),
            },
        };

        return exportData;
    };

    const handleExport = async () => {
        if (exportMode === "chats" && selectedChats.length === 0) {
            toast.error("Please select at least one chat to export");
            return;
        }

        if (exportMode === "projects" && !selectedProject) {
            toast.error("Please select a project to export");
            return;
        }

        try {
            let exportData;
            let exportCount = 0;
            let exportType = "items";

            if (exportMode === "chats") {
                const chatsData = getSelectedChatsData || [];
                exportData = generateExportData(
                    chatsData,
                    exportSettings ? settings : null
                );
                exportCount = chatsData.length;
                exportType = "chats";
            } else if (exportMode === "projects") {
                const projectData = getSelectedProjectData;
                if (!projectData) {
                    toast.error("Could not fetch project data. Please try again.");
                    return;
                }
                exportData = generateProjectExportData(
                    projectData,
                    exportSettings ? settings : null
                );
                exportCount = 1;
                exportType = "project";
            } else if (exportMode === "workspace") {
                const workspaceData = fullWorkspaceData;
                if (!workspaceData) {
                    toast.error("Could not fetch workspace data. Please try again.");
                    return;
                }
                exportData = generateWorkspaceExportData(
                    workspaceData,
                    exportSettings ? settings : null
                );
                exportType = "workspace";
            } else {
                return;
            }

            const timestamp = new Date().toISOString().split("T")[0];
            let content: string | Blob = "";
            let filename = "";
            let mimeType = "";
            let isBlob = false;

            if (exportFormat === 'pdf') {
                const pdfUrl = await generatePDFExport(exportData);
                const response = await fetch(pdfUrl);
                content = await response.blob();
                filename = `chat-export-${timestamp}.pdf`;
                mimeType = "application/pdf";
                isBlob = true;
            } else {
                switch (exportFormat) {
                    case "json":
                        content = JSON.stringify(exportData, null, 2);
                        filename = `chat-export-${timestamp}.json`;
                        mimeType = "application/json";
                        break;
                    case "markdown":
                        content = generateMarkdownExport(exportData);
                        filename = `chat-export-${timestamp}.md`;
                        mimeType = "text/markdown";
                        break;
                    case "csv":
                        content = generateCSVExport(exportData);
filename = `chat-export-${timestamp}.csv`;
                        mimeType = "text/csv";
                        break;
                    case "txt":
                        content = generateTextExport(exportData);
                        filename = `chat-export-${timestamp}.txt`;
                        mimeType = "text/plain";
                        break;
                }
            }
            
            const finalContent = isBlob ? content as Blob : new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(finalContent);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success(
                `Exported ${exportType === 'workspace' ? 'your workspace' : `${exportMode === 'chats' ? selectedChats.length : 1} ${exportType}${exportMode === 'chats' && selectedChats.length > 1 ? 's' : ''}`} as ${exportFormat.toUpperCase()}`
            );
            setCurrentPage("main");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export data");
        }
    };

    const handleDelete = async () => {
        const expectedConfirmation =
            deleteType === "account"
                ? "Yes, delete my account"
                : "Yes, delete all chats";

        if (deleteConfirmation !== expectedConfirmation) {
            toast.error(`Please type exactly: "${expectedConfirmation}"`);
            return;
        }

        try {
            if (deleteType === "account") {
                await deleteAccount();
                toast.success("Account deleted successfully");
                window.location.href = "/";
            } else {
                const result = await deleteAllChats();
                toast.success(`Deleted ${result.deletedChats} chats`);
                setCurrentPage("main");
            }
        } catch (error) {
            toast.error(`Failed to delete ${deleteType}`);
        }
    };

    const toggleApiKeyVisibility = (provider: keyof typeof showApiKeys) => {
        setShowApiKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
    };

    const toggleApiKeyPreference = (
        provider: keyof typeof apiKeyPreferences
    ) => {
        setApiKeyPreferences((prev) => ({
            ...prev,
            [provider]: !prev[provider],
        }));
    };

    const getTooltipText = (
        provider: string,
        hasKey: boolean,
        isEnabled: boolean
    ) => {
        if (!hasKey) {
            return `Add your ${provider} API key to enable this toggle. When enabled, your personal API key will be used for ${provider} models.`;
        }
        if (isEnabled) {
            return `Using your personal ${provider} API key for requests. Click to disable and use our shared key instead.`;
        }
        return `Using our shared ${provider} API key. Click to enable your personal key for unlimited requests.`;
    };

    const voices = [
        { id: "alloy", name: "Alloy" },
        { id: "echo", name: "Echo" },
        { id: "fable", name: "Fable" },
        { id: "onyx", name: "Onyx" },
        { id: "nova", name: "Nova" },
        { id: "shimmer", name: "Shimmer" },
    ];

    const exportFormats = [
        { id: "json", name: "JSON", description: "Structured data format" },
        {
            id: "markdown",
            name: "Markdown",
            description: "Human-readable format",
        },
        { id: "csv", name: "CSV", description: "Spreadsheet compatible" },
        { id: "txt", name: "Plain Text", description: "Simple text format" },
        { id: "pdf", name: "PDF", description: "Professional document format" },
    ];

    if (currentPage === "export") {
        const getExportButtonText = () => {
            switch (exportMode) {
                case "chats":
                    return `Export (${selectedChats.length} chat${selectedChats.length !== 1 ? 's' : ''})`;
                case "projects":
                    return `Export Project`;
                case "workspace":
                    return "Export Entire Workspace";
                default:
                    return "Export";
            }
        };

        const isExportDisabled = () => {
            if (exportMode === "chats") return selectedChats.length === 0;
            if (exportMode === "projects") return !selectedProject;
            if (exportMode === 'workspace') return !fullWorkspaceData;
            return true;
        };

        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-purple-100 flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage("main")}
                                className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors mr-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <Download className="w-5 h-5" />
                            Export Data
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                        <div>
                            <Label className="text-purple-200 mb-3 block">
                                Export Format
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                {exportFormats.map((format) => (
                                    <button
                                        key={format.id}
                                        onClick={() =>
                                            setExportFormat(format.id as any)
                                        }
                                        className={`p-3 rounded-lg border text-left transition-all ${
                                            exportFormat === format.id
                                                ? "border-purple-500/50 bg-purple-500/20"
                                                : "border-purple-600/30 hover:border-purple-500/40 hover:bg-purple-500/10"
                                        }`}
                                    >
                                        <div className="font-medium text-purple-100">
                                            {format.name}
                                        </div>
                                        <div className="text-sm text-purple-400/80">
                                            {format.description}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-purple-600/10 rounded-lg border border-purple-600/20">
                            <div>
                                <Label className="text-purple-200">
                                    Include Settings
                                </Label>
                                <p className="text-sm text-purple-400/80">
                                    Export your user preferences and API keys
                                    (keys will be masked)
                                </p>
                            </div>
                            <Switch
                                checked={exportSettings}
                                onCheckedChange={setExportSettings}
                            />
                        </div>

                        <Tabs
                            value={exportMode}
                            onValueChange={(value) =>
                                setExportMode(value as any)
                            }
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-3 bg-purple-600/20 space-x-2">
                                <TabsTrigger
                                    value="chats"
                                    className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                                >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Chats
                                </TabsTrigger>
                                <TabsTrigger
                                    value="projects"
                                    className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                                >
                                    <Folder className="w-4 h-4 mr-2" />
                                    Projects
                                </TabsTrigger>
                                <TabsTrigger
                                    value="workspace"
                                    className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                                >
                                    <Globe className="w-4 h-4 mr-2" />
                                    Workspace
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="chats" className="mt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <Label className="text-purple-200">
                                        Select Chats to Export
                                    </Label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSelectAllChats}
                                        className="text-purple-200 border-purple-600/30"
                                    >
                                        {selectedChats.length ===
                                        allChats.length
                                            ? "Deselect All"
                                            : "Select All"}{" "}
                                        ({allChats.length})
                                    </Button>
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-2 border border-purple-600/30 rounded-lg p-3">
                                    {allChats.length === 0 ? (
                                        <p className="text-purple-400/80 text-center py-4">
                                            No chats found
                                        </p>
                                    ) : (
                                        allChats.map((chat) => (
                                            <div
                                                key={chat._id}
                                                className="flex items-center gap-3 p-2 rounded hover:bg-purple-500/10 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    const newSelection = selectedChats.includes(chat._id)
                                                        ? selectedChats.filter(id => id !== chat._id)
                                                        : [...selectedChats, chat._id];
                                                    setSelectedChats(newSelection);
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    readOnly
                                                    checked={selectedChats.includes(
                                                        chat._id
                                                    )}
                                                    className="accent-purple-500 pointer-events-none"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-purple-100 font-medium">
                                                        {chat.title}
                                                    </div>
                                                    <div className="text-sm text-purple-400/80">
                                                        {chat.model} •{" "}
                                                        {new Date(
                                                            chat.updatedAt
                                                        ).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                {chat.isStarred && (
                                                    <div className="text-yellow-400">
                                                        ⭐
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="projects" className="mt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <Label className="text-purple-200">
                                        Select a Project to Export
                                    </Label>
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-2 border border-purple-600/30 rounded-lg p-3">
                                    {allProjects.length === 0 ? (
                                        <p className="text-purple-400/80 text-center py-4">
                                            No projects found
                                        </p>
                                    ) : (
                                        allProjects.map((project) => (
                                            <div
                                                key={project._id}
                                                className="flex items-center gap-3 p-2 rounded hover:bg-purple-500/10 transition-colors cursor-pointer"
                                                onClick={() => setSelectedProject(project._id)}
                                            >
                                                <input
                                                    type="radio"
                                                    name="project-select"
                                                    readOnly
                                                    checked={
                                                        selectedProject === project._id
                                                    }
                                                    className="form-radio h-4 w-4 accent-purple-500 bg-gray-900 border-gray-600 pointer-events-none"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-purple-100 font-medium">
                                                        {project.name}
                                                    </div>
                                                    <div className="text-sm text-purple-400/80">
                                                        Updated:{" "}
                                                        {new Date(
                                                            project.updatedAt
                                                        ).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-purple-400/80 mt-2">
                                    Exporting a project will include all of its
                                    chats, including those in nested folders.
                                </p>
                            </TabsContent>

                            <TabsContent value="workspace" className="mt-4">
                                <div className="p-4 bg-purple-600/10 rounded-lg border border-purple-600/20 text-center">
                                    <Globe className="w-10 h-10 mx-auto text-purple-300 mb-2" />
                                    <h3 className="font-medium text-purple-200">
                                        Export Entire Workspace
                                    </h3>
                                    <p className="text-sm text-purple-400/80 mt-1">
                                        This will export all your projects,
                                        folders, and unorganized chats into a
                                        single file.
                                    </p>
                                    {fullWorkspaceData && (
                                        <div className="mt-3 text-xs text-purple-300/90 flex justify-center gap-4">
                                            <span>
                                                {
                                                    fullWorkspaceData.projects
                                                        .length
                                                }{" "}
                                                Projects
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {fullWorkspaceData.projects.reduce(
                                                    (total: number, p: any) =>
                                                        total + p.chats.length,
                                                    0
                                                ) +
                                                    fullWorkspaceData
                                                        .unorganizedChats
                                                        .length}{" "}
                                                Chats
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-purple-600/20">
                        <Button
                            variant="ghost"
                            onClick={() => setCurrentPage("main")}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                handleExport().catch(console.error);
                            }}
                            disabled={isExportDisabled()}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500/60 to-blue-500/60 text-white font-medium hover:from-green-500/50 hover:to-blue-500/50 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {getExportButtonText()}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (currentPage === "delete") {
        const expectedConfirmation =
            deleteType === "account"
                ? "Yes, delete my account"
                : "Yes, delete all chats";

        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-purple-100 flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage("main")}
                                className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors mr-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <Trash2 className="w-5 h-5 text-red-400" />
                            {deleteType === "account"
                                ? "Delete Account"
                                : "Delete All Chats"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="p-4 bg-red-600/10 border border-red-600/30 rounded-lg">
                            <h4 className="font-medium text-red-200 mb-2">
                                ⚠️ Warning
                            </h4>
                            <p className="text-sm text-red-300">
                                {deleteType === "account"
                                    ? "This will permanently delete your account, all chats, messages, and settings. This action cannot be undone."
                                    : "This will permanently delete all your chats and messages. This action cannot be undone."}
                            </p>
                        </div>

                        <div>
                            <Label className="text-purple-200 mb-2 block">
                                Type the following to confirm:
                            </Label>
                            <p className="text-sm text-purple-400/80 mb-2 font-mono bg-purple-600/10 p-2 rounded border">
                                {expectedConfirmation}
                            </p>
                            <Input
                                value={deleteConfirmation}
                                onChange={(e) =>
                                    setDeleteConfirmation(e.target.value)
                                }
                                placeholder="Type confirmation here..."
                                className="bg-gray-900/60 border-red-600/30 text-purple-100"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-purple-600/20">
                        <Button
                            variant="ghost"
                            onClick={() => setCurrentPage("main")}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                handleDelete().catch(console.error);
                            }}
                            disabled={
                                deleteConfirmation !== expectedConfirmation
                            }
                            className="bg-red-600/80 hover:bg-red-600/70 text-white"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deleteType === "account"
                                ? "Delete Account"
                                : "Delete All Chats"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-2xl max-h-[80vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-purple-100 flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        Settings
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="account" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-purple-600/20 space-x-2">
                        <TabsTrigger
                            value="account"
                            className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                            Account
                        </TabsTrigger>
                        <TabsTrigger
                            value="models"
                            className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                            AI Models
                        </TabsTrigger>
                        <TabsTrigger
                            value="interface"
                            className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                            Interface
                        </TabsTrigger>
                        <TabsTrigger
                            value="voice"
                            className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                            Voice
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="account" className="space-y-4">
                        <div className="space-y-4">
                            <div className="text-sm text-center text-purple-200/80 mb-6">
                                Bring your own API keys for infinite requests to
                                AI models with no rate limits.
                            </div>
                            {Object.entries(apiKeys).map(([provider, key]) => {
                                const hasKey = key.trim().length > 0;
                                const isEnabled =
                                    apiKeyPreferences[
                                        provider as keyof typeof apiKeyPreferences
                                    ];
                                const opacity =
                                    hasKey && isEnabled
                                        ? "opacity-100"
                                        : hasKey
                                        ? "opacity-60"
                                        : "opacity-100";

                                return (
                                    <div
                                        key={provider}
                                        className={`space-y-2 ${opacity} transition-opacity`}
                                    >
                                        <Label className="text-purple-200 capitalize flex items-center gap-2">
                                            <Key className="w-4 h-4" />
                                            {provider.charAt(0).toUpperCase() +
                                                provider.slice(1)}{" "}
                                            API Key
                                            {provider === "gemini" && (
                                                <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded">
                                                    Free tier available
                                                </span>
                                            )}
                                            {provider === "openrouter" && (
                                                <span className="text-xs bg-green-600/20 text-green-300 px-2 py-1 rounded">
                                                    200+ models
                                                </span>
                                            )}
                                            {provider === "deepseek" && (
                                                <span className="text-xs bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded">
                                                    Fast & affordable
                                                </span>
                                            )}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                type={
                                                    showApiKeys[
                                                        provider as keyof typeof showApiKeys
                                                    ]
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={key}
                                                onChange={(e) =>
                                                    setApiKeys((prev) => ({
                                                        ...prev,
                                                        [provider]:
                                                            e.target.value,
                                                    }))
                                                }
                                                placeholder={`Your ${provider} API key...`}
                                                className="bg-gray-900/60 border-purple-600/30 text-purple-100 placeholder-purple-300/60 pr-20"
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() =>
                                                        toggleApiKeyVisibility(
                                                            provider as keyof typeof showApiKeys
                                                        )
                                                    }
                                                >
                                                    {showApiKeys[
                                                        provider as keyof typeof showApiKeys
                                                    ] ? (
                                                        <EyeOff className="w-4 h-4" />
                                                    ) : (
                                                        <Eye className="w-4 h-4" />
                                                    )}
                                                </Button>
                                                <div className="relative group">
                                                    <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={() =>
                                                            toggleApiKeyPreference(
                                                                provider as keyof typeof apiKeyPreferences
                                                            )
                                                        }
                                                        disabled={!hasKey}
                                                        className="scale-75"
                                                        title={getTooltipText(
                                                            provider,
                                                            hasKey,
                                                            isEnabled
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="space-y-3 pt-6 border-t border-purple-600/20">
                                <h4 className="text-sm font-medium text-purple-200">
                                    🗂️ Data Management
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setCurrentPage("export")}
                                        className="justify-start h-auto p-3 border-purple-600/30"
                                    >
                                        <div className="text-left">
                                            <div className="font-medium text-purple-200 flex items-center gap-2">
                                                <Download className="w-4 h-4" />
                                                Export Data
                                            </div>
                                            <div className="text-xs text-purple-400/80">
                                                Download chats, projects, or workspace
                                            </div>
                                        </div>
                                    </Button>

                                    <div className="relative">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                setShowDeleteDropdown(
                                                    !showDeleteDropdown
                                                )
                                            }
                                            className="justify-start h-auto p-3 border-red-600/30 text-red-300 hover:bg-red-600/10 w-full"
                                        >
                                            <div className="text-left flex-1">
                                                <div className="font-medium flex items-center gap-2">
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete Data
                                                </div>
                                                <div className="text-xs opacity-70">
                                                    Remove chats or account
                                                </div>
                                            </div>
                                            {showDeleteDropdown ? (
                                                <ChevronUp className="w-4 h-4 ml-2" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 ml-2" />
                                            )}
                                        </Button>

                                        {showDeleteDropdown && (
                                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900/95 backdrop-blur-sm border border-red-600/30 rounded-lg shadow-xl z-50 overflow-hidden">
                                                <button
                                                    onClick={() => {
                                                        setDeleteType("chats");
                                                        setCurrentPage(
                                                            "delete"
                                                        );
                                                        setShowDeleteDropdown(
                                                            false
                                                        );
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-red-300 hover:bg-red-600/20 transition-colors text-left"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    <div>
                                                        <div className="font-medium">
                                                            Delete All Chats
                                                        </div>
                                                        <div className="text-xs opacity-70">
                                                            Remove all
                                                            conversations
                                                        </div>
                                                    </div>
                                                </button>
                                                <div className="border-t border-red-600/20"></div>
                                                <button
                                                    onClick={() => {
                                                        setDeleteType(
                                                            "account"
                                                        );
                                                        setCurrentPage(
                                                            "delete"
                                                        );
                                                        setShowDeleteDropdown(
                                                            false
                                                        );
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-red-300 hover:bg-red-600/20 transition-colors text-left"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    <div>
                                                        <div className="font-medium">
                                                            Delete Account
                                                        </div>
                                                        <div className="text-xs opacity-70">
                                                            Permanently remove
                                                            everything
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="models" className="space-y-4">
                        <div className="mt-6 space-y-4">
                            <div>
                                <Label className="text-purple-200">
                                    Default AI Model
                                </Label>
                                <p className="text-sm text-purple-400/80 mb-2">
                                    Choose your preferred model for new
                                    conversations
                                </p>
                                <ModelSelector
                                    selectedModel={settings.defaultModel}
                                    onModelChange={handleModelChange}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-purple-600/10 rounded-lg border border-purple-600/20">
                                <div>
                                    <Label className="text-purple-200">
                                        Local-First Processing
                                    </Label>
                                    <p className="text-sm text-purple-400/80">
                                        Process data locally when possible for
                                        privacy
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.localFirst}
                                    onCheckedChange={(checked) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            localFirst: checked,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="interface" className="space-y-4">
                        <div className="mt-6 space-y-4">
                            <div>
                                <Label className="text-purple-200 flex items-center gap-2">
                                    <Palette className="w-4 h-4" />
                                    Theme Preference
                                </Label>
                                <p className="text-sm text-purple-400/80 mb-2">
                                    Choose your visual theme
                                </p>
                                <Select
                                    value={settings.theme}
                                    onValueChange={(
                                        value: "light" | "dark" | "system"
                                    ) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            theme: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger className="bg-gray-900/60 border-purple-600/30 text-purple-100">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="glass border border-purple-600/30">
                                        <SelectItem
                                            value="light"
                                            className="text-purple-100"
                                        >
                                            ☀️ Light Mode
                                        </SelectItem>
                                        <SelectItem
                                            value="dark"
                                            className="text-purple-100"
                                        >
                                            🌙 Dark Mode
                                        </SelectItem>
                                        <SelectItem
                                            value="system"
                                            className="text-purple-100"
                                        >
                                            ⚡ System Default
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="voice" className="space-y-4">
                        <div className="mt-6 space-y-4 border-purple-600/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-purple-200">
                                        Auto-play AI Responses
                                    </Label>
                                    <p className="text-sm text-purple-400/80">
                                        Hear responses automatically
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.voiceSettings.autoPlay}
                                    onCheckedChange={(checked) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            voiceSettings: {
                                                ...prev.voiceSettings,
                                                autoPlay: checked,
                                            },
                                        }))
                                    }
                                />
                            </div>

                            <div>
                                <Label className="text-purple-200">
                                    Voice Selection
                                </Label>
                                <p className="text-sm text-purple-400/80 mb-2">
                                    Choose your preferred AI voice
                                </p>
                                <Select
                                    value={settings.voiceSettings.voice}
                                    onValueChange={(value) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            voiceSettings: {
                                                ...prev.voiceSettings,
                                                voice: value,
                                            },
                                        }))
                                    }
                                >
                                    <SelectTrigger className="bg-gray-900/60 border-purple-600/30 text-purple-100">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="glass border border-purple-600/30">
                                        {voices.map((voice) => (
                                            <SelectItem
                                                key={voice.id}
                                                value={voice.id}
                                                className="text-purple-100"
                                            >
                                                {voice.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-purple-200">
                                    Speech Speed
                                </Label>
                                <p className="text-sm text-purple-400/80 mb-2">
                                    Adjust playback speed
                                </p>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-purple-400/80">
                                        0.5x
                                    </span>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={settings.voiceSettings.speed}
                                        onChange={(e) =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                voiceSettings: {
                                                    ...prev.voiceSettings,
                                                    speed: parseFloat(
                                                        e.target.value
                                                    ),
                                                },
                                            }))
                                        }
                                        className="flex-1 accent-purple-500"
                                    />
                                    <span className="text-sm text-purple-400/80">
                                        2x
                                    </span>
                                </div>
                                <div className="text-center text-sm text-purple-300 mt-2 font-medium">
                                    Current: {settings.voiceSettings.speed}x
                                </div>
                            </div>

                            <div>
                                <Label className="text-purple-200">
                                    Voice Recording End Word
                                </Label>
                                <p className="text-sm text-purple-400/80 mb-2">
                                    Say this word to automatically end recording
                                    and send your message
                                </p>
                                <Input
                                    type="text"
                                    value={settings.voiceSettings.buzzWord}
                                    onChange={(e) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            voiceSettings: {
                                                ...prev.voiceSettings,
                                                buzzWord: e.target.value,
                                            },
                                        }))
                                    }
                                    placeholder="e.g., 'send now', 'submit', 'done'"
                                    className="bg-gray-900/60 border-purple-600/30 text-purple-100 placeholder-purple-300/60"
                                />
                                <div className="mt-2 p-3 bg-blue-600/10 rounded-lg border border-blue-600/20">
                                    <h4 className="text-sm font-medium text-blue-200 mb-1">
                                        💡 How it works
                                    </h4>
                                    <ul className="text-xs text-blue-300 space-y-1">
                                        <li>
                                            • Choose a simple, unique word that
                                            you don't use often in conversation
                                        </li>
                                        <li>
                                            • When this word is detected in your
                                            speech, recording will stop
                                            automatically
                                        </li>
                                        <li>
                                            • Your message will be sent
                                            immediately after detection
                                        </li>
                                        <li>
                                            • Leave empty to manually control
                                            recording start/stop
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4 border-t border-purple-600/20">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500/60 to-purple-500/60 text-white font-medium hover:from-pink-500/50 hover:to-purple-500/50 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}