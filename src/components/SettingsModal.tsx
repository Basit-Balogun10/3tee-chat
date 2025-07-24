import { useState, useEffect, useCallback } from "react";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";
import { ModelSelector } from "./ModelSelector";
import { DefaultPasswordModal } from "./DefaultPasswordModal";
import { NotificationSounds } from "../lib/utils";
import {
    AlertTriangle,
    Clock,
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
    Volume2,
    X,
    Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import jsPDF from "jspdf";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

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
        currentPage === "export" && exportMode === "projects" && selectedProject
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
    const [showDefaultPasswordModal, setShowDefaultPasswordModal] =
        useState(false);
    const [settings, setSettings] = useState({
        defaultModel: "gemini-2.0-flash",
        theme: "dark" as "light" | "dark" | "system",
        chatTitleGeneration: "first-message" as
            | "first-message"
            | "ai-generated",
        temporaryChatsSettings: {
            defaultToTemporary: false,
            defaultLifespanHours: 24,
            showExpirationWarnings: true,
            autoCleanup: true,
        },
        voiceSettings: {
            autoPlay: false,
            voice: "aoede",
            speed: 1.0,
            buzzWord: "",
            language: "en-US",
        },
        // Add Phase 2 settings
        notificationSettings: {
            soundEnabled: false,
            soundOnlyWhenUnfocused: true,
            soundVolume: 0.5,
            soundType: "subtle",
        },
        chatLifecycleSettings: {
            autoDeleteEnabled: false,
            autoDeleteDays: 30,
            autoArchiveEnabled: false,
            autoArchiveDays: 30,
        },
        aiSettings: {
            temperature: 0.7,
            maxTokens: undefined,
            systemPrompt: "",
            responseMode: "balanced",
            promptEnhancement: false,
            contextWindow: undefined,
            topP: 0.9,
            frequencyPenalty: 0,
            presencePenalty: 0,
        },
        passwordSettings: {
            useDefaultPassword: false,
            sessionTimeoutEnabled: true,
            autoLockTimeout: 30,
            defaultLockNewChats: false, // <-- add this
        },
    });

    useEffect(() => {
        if (preferences) {
            setSettings({
                defaultModel: preferences.defaultModel || "gemini-2.0-flash",
                theme:
                    (preferences.theme as "light" | "dark" | "system") ||
                    "dark",
                chatTitleGeneration:
                    preferences.chatTitleGeneration || "first-message",
                temporaryChatsSettings: {
                    defaultToTemporary:
                        preferences.temporaryChatsSettings
                            ?.defaultToTemporary || false,
                    defaultLifespanHours:
                        preferences.temporaryChatsSettings
                            ?.defaultLifespanHours || 24,
                    showExpirationWarnings:
                        preferences.temporaryChatsSettings
                            ?.showExpirationWarnings ?? true,
                    autoCleanup:
                        preferences.temporaryChatsSettings?.autoCleanup ?? true,
                },
                voiceSettings: {
                    autoPlay: preferences.voiceSettings?.autoPlay || false,
                    voice: preferences.voiceSettings?.voice || "aoede",
                    speed: preferences.voiceSettings?.speed || 1.0,
                    buzzWord: preferences.voiceSettings?.buzzWord || "",
                    language: preferences.voiceSettings?.language || "en-US", // Add this
                },
                notificationSettings: {
                    soundEnabled:
                        preferences.notificationSettings?.soundEnabled || false,
                    soundOnlyWhenUnfocused:
                        preferences.notificationSettings
                            ?.soundOnlyWhenUnfocused ?? true,
                    soundVolume:
                        preferences.notificationSettings?.soundVolume || 0.5,
                    soundType:
                        preferences.notificationSettings?.soundType || "subtle",
                },
                chatLifecycleSettings: {
                    autoDeleteEnabled:
                        preferences.chatLifecycleSettings?.autoDeleteEnabled ||
                        false,
                    autoDeleteDays:
                        preferences.chatLifecycleSettings?.autoDeleteDays || 30,
                    autoArchiveEnabled:
                        preferences.chatLifecycleSettings?.autoArchiveEnabled ||
                        false,
                    autoArchiveDays:
                        preferences.chatLifecycleSettings?.autoArchiveDays ||
                        30,
                },
                aiSettings: {
                    temperature: preferences.aiSettings?.temperature || 0.7,
                    maxTokens: preferences.aiSettings?.maxTokens || undefined,
                    systemPrompt: preferences.aiSettings?.systemPrompt || "",
                    responseMode:
                        preferences.aiSettings?.responseMode || "balanced",
                    promptEnhancement:
                        preferences.aiSettings?.promptEnhancement || false,
                    contextWindow:
                        preferences.aiSettings?.contextWindow || undefined,
                    topP: preferences.aiSettings?.topP || 0.9,
                    frequencyPenalty:
                        preferences.aiSettings?.frequencyPenalty || 0,
                    presencePenalty:
                        preferences.aiSettings?.presencePenalty || 0,
                },
                passwordSettings: {
                    useDefaultPassword:
                        preferences.passwordSettings?.useDefaultPassword ??
                        false,
                    sessionTimeoutEnabled:
                        preferences.passwordSettings?.sessionTimeoutEnabled ??
                        true,
                    autoLockTimeout:
                        preferences.passwordSettings?.autoLockTimeout ?? 30,
                    defaultLockNewChats:
                        preferences.passwordSettings?.defaultLockNewChats ??
                        false, // <-- add this
                },
            });
            if (
                preferences.apiKeys &&
                typeof preferences.apiKeys === "object"
            ) {
                setApiKeys({
                    openai: preferences.apiKeys.openai || "",
                    anthropic: preferences.apiKeys.anthropic || "",
                    gemini: preferences.apiKeys.gemini || "",
                    deepseek: preferences.apiKeys.deepseek || "",
                    openrouter: preferences.apiKeys.openrouter || "",
                });
            }
            if (
                preferences.apiKeyPreferences &&
                typeof preferences.apiKeyPreferences === "object"
            ) {
                setApiKeyPreferences({
                    openai: preferences.apiKeyPreferences.openai ?? true,
                    anthropic: preferences.apiKeyPreferences.anthropic ?? true,
                    gemini: preferences.apiKeyPreferences.gemini ?? true,
                    deepseek: preferences.apiKeyPreferences.deepseek ?? true,
                    openrouter:
                        preferences.apiKeyPreferences.openrouter ?? true,
                });
            }
        }
    }, [preferences]);

    const handleSave = useCallback(async () => {
        try {
            const currentApiKeys = preferences?.apiKeys || {};
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
    }, [
        settings,
        apiKeys,
        apiKeyPreferences,
        preferences?.apiKeys,
        updatePreferences,
        onOpenChange,
    ]);

    // Add keyboard shortcut for saving settings
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSave();
            }
        };

        if (open) {
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, handleSave]);

    useEffect(() => {
        if (!open) {
            setCurrentPage("main");
            setSelectedChats([]);
            setSelectedProject(null);
            setDeleteConfirmation("");
            setShowDeleteDropdown(false);
        }
    }, [open]);

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
        const totalChats =
            workspaceData.projects.reduce(
                (total: number, project: any) => total + project.chats.length,
                0
            ) + workspaceData.unorganizedChats.length;

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
                unorganizedChats: workspaceData.unorganizedChats.map(
                    (chat: any) => ({
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
                    })
                ),
            },
        };

        return exportData;
    };

    // PHASE 6 FIX: Enhanced Export System for Branched Conversations
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
                // PHASE 6 FIX: Enhanced export data with branching support
                exportData = generateEnhancedExportData(
                    chatsData,
                    exportSettings ? settings : null
                );
                exportCount = chatsData.length;
                exportType = "chats";
            } else if (exportMode === "projects") {
                const projectData = getSelectedProjectData;
                if (!projectData) {
                    toast.error(
                        "Could not fetch project data. Please try again."
                    );
                    return;
                }
                // PHASE 6 FIX: Enhanced project export with branching
                exportData = generateEnhancedProjectExportData(
                    projectData,
                    exportSettings ? settings : null
                );
                exportCount = 1;
                exportType = "project";
            } else if (exportMode === "workspace") {
                const workspaceData = fullWorkspaceData;
                if (!workspaceData) {
                    toast.error(
                        "Could not fetch workspace data. Please try again."
                    );
                    return;
                }
                // PHASE 6 FIX: Enhanced workspace export with branching
                exportData = generateEnhancedWorkspaceExportData(
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

            if (exportFormat === "pdf") {
                const pdfUrl = await generateEnhancedPDFExport(exportData);
                const response = await fetch(pdfUrl);
                content = await response.blob();
                filename = `chat-export-branched-${timestamp}.pdf`;
                mimeType = "application/pdf";
                isBlob = true;
            } else {
                switch (exportFormat) {
                    case "json":
                        content = JSON.stringify(exportData, null, 2);
                        filename = `chat-export-branched-${timestamp}.json`;
                        mimeType = "application/json";
                        break;
                    case "markdown":
                        content = generateEnhancedMarkdownExport(exportData);
                        filename = `chat-export-branched-${timestamp}.md`;
                        mimeType = "text/markdown";
                        break;
                    case "csv":
                        content = generateEnhancedCSVExport(exportData);
                        filename = `chat-export-branched-${timestamp}.csv`;
                        mimeType = "text/csv";
                        break;
                    case "txt":
                        content = generateEnhancedTextExport(exportData);
                        filename = `chat-export-branched-${timestamp}.txt`;
                        mimeType = "text/plain";
                        break;
                }
            }

            const finalContent = isBlob
                ? (content as Blob)
                : new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(finalContent);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // PHASE 6 FIX: Enhanced success message with branch information
            const branchInfo =
                exportData.exportInfo.branchCount > 0
                    ? ` including ${exportData.exportInfo.branchCount} conversation branches`
                    : "";

            toast.success(
                `Exported ${exportType === "workspace" ? "your workspace" : `${exportMode === "chats" ? selectedChats.length : 1} ${exportType}${exportMode === "chats" && selectedChats.length > 1 ? "s" : ""}`} as ${exportFormat.toUpperCase()}${branchInfo}`
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
        { id: "aoede", name: "Aoede" },
        { id: "puck", name: "Puck" },
        { id: "Fenrir", name: "Fenrir" },
        { id: "kore", name: "Kore" },
        { id: "charon", name: "Charon" },
    ];

    // Add this after the voices array:
    const supportedLanguages = [
        { code: "en-US", name: "English (US)", flag: "🇺🇸" },
        { code: "en-GB", name: "English (UK)", flag: "🇬🇧" },
        { code: "en-AU", name: "English (Australia)", flag: "🇦🇺" },
        { code: "en-IN", name: "English (India)", flag: "🇮🇳" },
        { code: "es-US", name: "Spanish (US)", flag: "🇺🇸" },
        { code: "es-ES", name: "Spanish (Spain)", flag: "🇪🇸" },
        { code: "fr-FR", name: "French (France)", flag: "🇫🇷" },
        { code: "fr-CA", name: "French (Canada)", flag: "🇨🇦" },
        { code: "de-DE", name: "German (Germany)", flag: "🇩🇪" },
        { code: "it-IT", name: "Italian (Italy)", flag: "🇮🇹" },
        { code: "pt-BR", name: "Portuguese (Brazil)", flag: "🇧🇷" },
        { code: "ja-JP", name: "Japanese (Japan)", flag: "🇯🇵" },
        { code: "ko-KR", name: "Korean (South Korea)", flag: "🇰🇷" },
        { code: "cmn-CN", name: "Mandarin Chinese (China)", flag: "🇨🇳" },
        { code: "hi-IN", name: "Hindi (India)", flag: "🇮🇳" },
        { code: "ar-XA", name: "Arabic (Generic)", flag: "🌍" },
        { code: "ru-RU", name: "Russian (Russia)", flag: "🇷🇺" },
        { code: "th-TH", name: "Thai (Thailand)", flag: "🇹🇭" },
        { code: "vi-VN", name: "Vietnamese (Vietnam)", flag: "🇻🇳" },
        { code: "id-ID", name: "Indonesian (Indonesia)", flag: "🇮🇩" },
        { code: "tr-TR", name: "Turkish (Turkey)", flag: "🇹🇷" },
        { code: "nl-NL", name: "Dutch (Netherlands)", flag: "🇳🇱" },
        { code: "pl-PL", name: "Polish (Poland)", flag: "🇵🇱" },
        { code: "bn-IN", name: "Bengali (India)", flag: "🇮🇳" },
        { code: "gu-IN", name: "Gujarati (India)", flag: "🇮🇳" },
        { code: "kn-IN", name: "Kannada (India)", flag: "🇮🇳" },
        { code: "mr-IN", name: "Marathi (India)", flag: "🇮🇳" },
        { code: "ml-IN", name: "Malayalam (India)", flag: "🇮🇳" },
        { code: "ta-IN", name: "Tamil (India)", flag: "🇮🇳" },
        { code: "te-IN", name: "Telugu (India)", flag: "🇮🇳" },
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
                    return `Export (${selectedChats.length} chat${selectedChats.length !== 1 ? "s" : ""})`;
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
            if (exportMode === "workspace") return !fullWorkspaceData;
            return true;
        };

        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
                    hideCloseButton
                >
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
                                                    const newSelection =
                                                        selectedChats.includes(
                                                            chat._id
                                                        )
                                                            ? selectedChats.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      chat._id
                                                              )
                                                            : [
                                                                  ...selectedChats,
                                                                  chat._id,
                                                              ];
                                                    setSelectedChats(
                                                        newSelection
                                                    );
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
                                                onClick={() =>
                                                    setSelectedProject(
                                                        project._id
                                                    )
                                                }
                                            >
                                                <input
                                                    type="radio"
                                                    name="project-select"
                                                    readOnly
                                                    checked={
                                                        selectedProject ===
                                                        project._id
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
                                                        total +
                                                        (p.chats?.length || 0),
                                                    0
                                                ) +
                                                    (fullWorkspaceData
                                                        .unorganizedChats
                                                        ?.length || 0)}{" "}
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
                <DialogContent
                    className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-md"
                    hideCloseButton
                >
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

    // PHASE 6 FIX: Enhanced export functions for branched conversations
    const generateEnhancedExportData = (chatsData: any[], settings: any) => {
        const timestamp = new Date().toISOString();
        let totalBranches = 0;
        let branchedConversations = 0;

        const enhancedChats = chatsData.map(({ chat, messages }) => {
            const chatBranches = messages.reduce((count: number, msg: any) => {
                if (msg.branches && msg.branches.length > 1) {
                    return count + msg.branches.length;
                }
                return count;
            }, 0);

            if (chatBranches > 0) branchedConversations++;
            totalBranches += chatBranches;

            return {
                id: chat._id,
                title: chat.title,
                model: chat.model,
                createdAt: chat._creationTime,
                updatedAt: chat.updatedAt,
                isStarred: chat.isStarred,
                // PHASE 6 FIX: Include branching metadata
                activeBranchId: chat.activeBranchId,
                baseMessages: chat.baseMessages || [],
                hasBranches: chatBranches > 0,
                messages: messages.map((msg: any) => ({
                    id: msg._id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    model: msg.model,
                    attachments: msg.attachments,
                    metadata: msg.metadata,
                    // PHASE 6 FIX: Include branch information
                    branchId: msg.branchId,
                    branches: msg.branches || [],
                    activeBranchId: msg.activeBranchId,
                    hasBranches: msg.branches && msg.branches.length > 1,
                })),
            };
        });

        return {
            exportInfo: {
                version: "2.0.0", // Updated for branching system
                timestamp,
                totalChats: chatsData.length,
                format: exportFormat,
                includesSettings: exportSettings,
                // PHASE 6 FIX: Enhanced metadata
                branchingSystemVersion: "1.0.0",
                branchCount: totalBranches,
                branchedConversations,
            },
            ...(exportSettings && { userSettings: settings }),
            chats: enhancedChats,
            // PHASE 6 FIX: Branching metadata
            branchingMetadata: {
                totalBranches,
                branchedConversations,
                exportNote:
                    "This export includes conversation branches and message versions",
            },
        };
    };

    const generateEnhancedProjectExportData = (
        projectData: any,
        settings: any
    ) => {
        // Similar enhanced structure for projects...
        const timestamp = new Date().toISOString();
        let totalBranches = 0;
        let branchedConversations = 0;

        const enhancedChats = projectData.chats.map((chat: any) => {
            const chatBranches = chat.messages.reduce(
                (count: number, msg: any) => {
                    if (msg.branches && msg.branches.length > 1) {
                        return count + msg.branches.length;
                    }
                    return count;
                },
                0
            );

            if (chatBranches > 0) branchedConversations++;
            totalBranches += chatBranches;

            return {
                ...chat,
                hasBranches: chatBranches > 0,
                messages: chat.messages.map((msg: any) => ({
                    ...msg,
                    hasBranches: msg.branches && msg.branches.length > 1,
                })),
            };
        });

        return {
            exportInfo: {
                version: "2.0.0",
                timestamp,
                totalChats: projectData.chats.length,
                format: exportFormat,
                includesSettings: exportSettings,
                branchingSystemVersion: "1.0.0",
                branchCount: totalBranches,
                branchedConversations,
            },
            ...(exportSettings && { userSettings: settings }),
            project: {
                ...projectData,
                chats: enhancedChats,
            },
            branchingMetadata: {
                totalBranches,
                branchedConversations,
                exportNote:
                    "This export includes conversation branches and message versions",
            },
        };
    };

    const generateEnhancedWorkspaceExportData = (
        workspaceData: any,
        settings: any
    ) => {
        const timestamp = new Date().toISOString();
        let totalBranches = 0;
        let branchedConversations = 0;

        // Process all projects
        const enhancedProjects = workspaceData.projects.map((project: any) => {
            const enhancedChats = project.chats.map((chat: any) => {
                const chatBranches = chat.messages.reduce(
                    (count: number, msg: any) => {
                        if (msg.branches && msg.branches.length > 1) {
                            return count + msg.branches.length;
                        }
                        return count;
                    },
                    0
                );

                if (chatBranches > 0) branchedConversations++;
                totalBranches += chatBranches;

                return {
                    ...chat,
                    hasBranches: chatBranches > 0,
                    messages: chat.messages.map((msg: any) => ({
                        ...msg,
                        hasBranches: msg.branches && msg.branches.length > 1,
                    })),
                };
            });

            return {
                ...project,
                chats: enhancedChats,
            };
        });

        // Process unorganized chats
        const enhancedUnorganizedChats = workspaceData.unorganizedChats.map(
            (chat: any) => {
                const chatBranches = chat.messages.reduce(
                    (count: number, msg: any) => {
                        if (msg.branches && msg.branches.length > 1) {
                            return count + msg.branches.length;
                        }
                        return count;
                    },
                    0
                );

                if (chatBranches > 0) branchedConversations++;
                totalBranches += chatBranches;

                return {
                    ...chat,
                    hasBranches: chatBranches > 0,
                    messages: chat.messages.map((msg: any) => ({
                        ...msg,
                        hasBranches: msg.branches && msg.branches.length > 1,
                    })),
                };
            }
        );

        const totalChats =
            enhancedProjects.reduce(
                (total: number, project: any) => total + project.chats.length,
                0
            ) + enhancedUnorganizedChats.length;

        return {
            exportInfo: {
                version: "2.0.0",
                timestamp,
                totalProjects: enhancedProjects.length,
                totalChats,
                unorganizedChats: enhancedUnorganizedChats.length,
                format: exportFormat,
                includesSettings: exportSettings,
                branchingSystemVersion: "1.0.0",
                branchCount: totalBranches,
                branchedConversations,
            },
            ...(exportSettings && { userSettings: settings }),
            workspace: {
                projects: enhancedProjects,
                unorganizedChats: enhancedUnorganizedChats,
            },
            branchingMetadata: {
                totalBranches,
                branchedConversations,
                exportNote:
                    "This export includes conversation branches and message versions",
            },
        };
    };

    // PHASE 6 FIX: Enhanced text export with branch information
    const generateEnhancedTextExport = (data: any) => {
        let text = `ADVANCED CHAT EXPORT (with Branching Support)\n${"=".repeat(60)}\n\n`;
        text += `Exported on: ${new Date(data.exportInfo.timestamp).toLocaleString()}\n`;
        text += `Format: ${data.exportInfo.format.toUpperCase()}\n`;
        text += `Branching System Version: ${data.exportInfo.branchingSystemVersion}\n`;
        text += `Total Branches: ${data.exportInfo.branchCount}\n`;
        text += `Conversations with Branches: ${data.exportInfo.branchedConversations}\n\n`;

        // Add the existing text export logic but with branch information
        const formatChatWithBranches = (chat: any, prefix = "") => {
            let chatText = `${prefix}${chat.title}\n`;
            chatText += `${prefix}Model: ${chat.model} | Created: ${new Date(chat.createdAt).toLocaleDateString()}\n`;
            if (chat.hasBranches) {
                chatText += `${prefix}🌿 This conversation contains branches\n`;
            }
            chatText += `${prefix}${"-".repeat(40)}\n`;

            chat.messages.forEach((message: any) => {
                const role = message.role === "user" ? "YOU" : "ASSISTANT";
                const time = new Date(message.timestamp).toLocaleTimeString();
                chatText += `${prefix}[${time}] ${role}`;

                if (message.hasBranches) {
                    chatText += ` 🌿 (${message.branches.length} branches)`;
                }
                chatText += `:\n${message.content}\n\n`;
            });
            return chatText + `\n${prefix}${"=".repeat(50)}\n\n`;
        };

        if (data.project) {
            text += `PROJECT: ${data.project.name}\n${"-".repeat(30)}\n`;
            data.project.chats.forEach((chat: any) => {
                text += formatChatWithBranches(chat);
            });
        } else {
            data.chats.forEach((chat: any) => {
                text += formatChatWithBranches(chat);
            });
        }

        return text;
    };

    // PHASE 6 FIX: Enhanced markdown export with branch information
    const generateEnhancedMarkdownExport = (data: any) => {
        let markdown = `# Advanced Chat Export (with Branching Support)\n\n`;
        markdown += `**Exported on:** ${new Date(data.exportInfo.timestamp).toLocaleString()}\n`;
        markdown += `**Total Chats:** ${data.exportInfo.totalChats}\n`;
        markdown += `**Branching System:** v${data.exportInfo.branchingSystemVersion}\n`;
        markdown += `**Total Branches:** ${data.exportInfo.branchCount}\n`;
        markdown += `**Conversations with Branches:** ${data.exportInfo.branchedConversations}\n\n`;

        data.chats.forEach((chat: any, index: number) => {
            markdown += `## ${index + 1}. ${chat.title}`;
            if (chat.hasBranches) {
                markdown += ` 🌿`;
            }
            markdown += `\n\n`;

            markdown += `**Model:** ${chat.model} | **Created:** ${new Date(chat.createdAt).toLocaleDateString()}\n\n`;

            chat.messages.forEach((message: any) => {
                const role =
                    message.role === "user" ? "👤 **You**" : "🤖 **Assistant**";
                const time = new Date(message.timestamp).toLocaleTimeString();
                markdown += `### ${role} *(${time})*`;

                if (message.hasBranches) {
                    markdown += ` 🌿 *[${message.branches.length} branches]*`;
                }
                markdown += `\n\n`;

                markdown += `${message.content}\n\n`;
            });

            markdown += `---\n\n`;
        });

        return markdown;
    };

    // PHASE 6 FIX: Enhanced CSV export with branch information
    const generateEnhancedCSVExport = (data: any) => {
        let csv =
            "Chat ID,Chat Title,Message Role,Message Content,Timestamp,Model,Project ID,Project Name,Has Branches,Branch Count,Branch ID,Active Branch\n";

        const processChat = (chat: any, projectId = "", projectName = "") => {
            chat.messages.forEach((message: any) => {
                const escapedContent = `"${message.content.replace(/"/g, '""')}"`;
                const escapedTitle = `"${chat.title.replace(/"/g, '""')}"`;
                const escapedProjectName = `"${projectName.replace(/"/g, '""')}"`;
                const branchCount = message.branches
                    ? message.branches.length
                    : 0;
                const hasBranches = message.hasBranches ? "Yes" : "No";
                const branchId = message.branchId || "";
                const activeBranchId = message.activeBranchId || "";

                csv += `${chat.id},${escapedTitle},${message.role},${escapedContent},${new Date(
                    message.timestamp
                ).toISOString()},${message.model || chat.model},${projectId},${escapedProjectName},${hasBranches},${branchCount},${branchId},${activeBranchId}\n`;
            });
        };

        if (data.project) {
            data.project.chats.forEach((chat: any) =>
                processChat(chat, data.project.id, data.project.name)
            );
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

    // PHASE 6 FIX: Enhanced PDF export with branch information
    const generateEnhancedPDFExport = async (data: any) => {
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

            // Enhanced Title Page with Branch Info
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text("Advanced Chat Export", pageWidth / 2, yPosition, {
                align: "center",
            });
            yPosition += 15;

            doc.setFontSize(14);
            doc.setTextColor(100, 100, 200);
            doc.text("(with Branching Support)", pageWidth / 2, yPosition, {
                align: "center",
            });
            yPosition += 20;

            // Enhanced Metadata with Branch Stats
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
            const metadataLines = [
                `Exported on: ${new Date(data.exportInfo.timestamp).toLocaleString()}`,
                `Export Format: Enhanced PDF v${data.exportInfo.version}`,
                `Branching System: v${data.exportInfo.branchingSystemVersion}`,
                `Total Branches: ${data.exportInfo.branchCount}`,
                `Conversations with Branches: ${data.exportInfo.branchedConversations}`,
                `Includes Settings: ${data.exportInfo.includesSettings ? "Yes" : "No"}`,
            ];

            metadataLines.forEach((line) => {
                doc.text(line, pageWidth / 2, yPosition, { align: "center" });
                yPosition += 8;
            });

            // Branch Summary Box
            if (data.exportInfo.branchCount > 0) {
                checkNewPage(40);
                yPosition += 10;
                doc.setDrawColor(0, 100, 200);
                doc.setFillColor(240, 248, 255);
                doc.rect(margin, yPosition - 5, maxLineWidth, 25, "FD");

                doc.setFontSize(10);
                doc.setTextColor(0, 100, 200);
                doc.text(
                    "🌿 This export contains conversation branches - look for branch indicators throughout the document",
                    pageWidth / 2,
                    yPosition + 8,
                    { align: "center" }
                );
                yPosition += 30;
            }

            if (data.userSettings) {
                checkNewPage(80);
                yPosition += 20;
                doc.setFontSize(16);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 0, 0);
                doc.text("User Settings", margin, yPosition);
                yPosition += 15;

                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                const settingsLines = [
                    `Default Model: ${data.userSettings.defaultModel}`,
                    `Theme: ${data.userSettings.theme}`,
                    `Voice Auto-play: ${data.userSettings.voiceSettings?.autoPlay ? "Enabled" : "Disabled"}`,
                    `Voice: ${data.userSettings.voiceSettings?.voice || "aoede"}`,
                    `Speech Speed: ${data.userSettings.voiceSettings?.speed || 1.0}x`,
                ];

                settingsLines.forEach((line) => {
                    doc.text(line, margin, yPosition);
                    yPosition += 6;
                });
            }

            doc.addPage();
            yPosition = margin;

            const drawChatWithBranches = (chat: any, chatIndex: number) => {
                checkNewPage(80);

                // Enhanced Chat header with branch indicator
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 100, 200);
                let title = `${chatIndex + 1}. ${chat.title}`;
                if (chat.hasBranches) {
                    title += " 🌿";
                }
                doc.text(title, margin, yPosition);
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

                if (chat.hasBranches) {
                    chatMetadata.push("🌿 Contains conversation branches");
                }

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

                    let messageHeader = `${role} - ${timestamp}`;
                    if (message.hasBranches) {
                        messageHeader += ` 🌿 (${message.branches.length} branches)`;
                    }
                    doc.text(messageHeader, margin, yPosition);
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
                data.project.chats.forEach(drawChatWithBranches);
            } else if (data.workspace) {
                data.workspace.projects.forEach((project: any) => {
                    checkNewPage(60);
                    doc.setFontSize(18);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(0, 150, 0);
                    doc.text(`📁 Project: ${project.name}`, margin, yPosition);
                    yPosition += 15;

                    project.chats.forEach(drawChatWithBranches);
                });

                if (data.workspace.unorganizedChats.length > 0) {
                    checkNewPage(60);
                    doc.setFontSize(18);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(150, 150, 0);
                    doc.text("📄 Unorganized Chats", margin, yPosition);
                    yPosition += 15;

                    data.workspace.unorganizedChats.forEach(
                        drawChatWithBranches
                    );
                }
            } else {
                data.chats.forEach(drawChatWithBranches);
            }

            const pdfBlob = doc.output("blob");
            return URL.createObjectURL(pdfBlob);
        } catch (error) {
            console.error("Enhanced PDF generation error:", error);
            throw new Error("Failed to generate enhanced PDF");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-2xl max-h-[80vh] overflow-y-scroll"
                hideCloseButton
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <Zap className="w-5 h-5" />
                            <h2 className="text-lg font-semibold text-purple-100">
                                Settings
                            </h2>
                        </div>

                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                        >
                            <X className="w-5 h-5 text-purple-300" />
                        </button>
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
                        <TabsTrigger value="chats">Chats</TabsTrigger>
                        <TabsTrigger
                            value="notifications"
                            className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                            Notifications
                        </TabsTrigger>
                        <TabsTrigger
                            value="ai"
                            className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                            AI Settings
                        </TabsTrigger>
                        <TabsTrigger
                            value="security"
                            className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                        >
                            Security
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
                                                Download chats, projects, or
                                                workspace
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

                        <div>
                            <Label className="text-purple-200 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Chat Title Generation
                            </Label>
                            <p className="text-sm text-purple-400/80 mb-2">
                                Choose how new chat titles are created
                            </p>
                            <Select
                                value={settings.chatTitleGeneration}
                                onValueChange={(
                                    value: "first-message" | "ai-generated"
                                ) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        chatTitleGeneration: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="bg-gray-900/60 border-purple-600/30 text-purple-100">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="glass border border-purple-600/30">
                                    <SelectItem
                                        value="first-message"
                                        className="text-purple-100"
                                    >
                                        📝 Use First Message
                                    </SelectItem>
                                    <SelectItem
                                        value="ai-generated"
                                        className="text-purple-100"
                                    >
                                        🤖 AI Generated Title
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="mt-2 p-3 bg-blue-600/10 rounded-lg border border-blue-600/20">
                                <h4 className="text-sm font-medium text-blue-200 mb-1">
                                    💡 How it works
                                </h4>
                                <ul className="text-xs text-blue-300 space-y-1">
                                    {settings.chatTitleGeneration ===
                                    "first-message" ? (
                                        <>
                                            <li>
                                                • Chat titles will be based on
                                                your first message content
                                            </li>
                                            <li>
                                                • Faster title generation with
                                                no additional AI calls
                                            </li>
                                            <li>
                                                • Titles are created immediately
                                                when you send your first message
                                            </li>
                                        </>
                                    ) : (
                                        <>
                                            <li>
                                                • AI will create contextually
                                                appropriate titles for your
                                                chats
                                            </li>
                                            <li>
                                                • More descriptive and relevant
                                                titles based on conversation
                                                content
                                            </li>
                                            <li>
                                                • May take a moment longer as it
                                                requires an additional AI call
                                            </li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="voice" className="space-y-4">
                        <div className="mt-6 space-y-4 border-purple-600/30">
                            <Label className="text-purple-200">
                                Voice Recording End Word
                            </Label>
                            <p className="text-sm text-purple-400/80 mb-2">
                                Say this word to automatically end recording and
                                send your message
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
                                        • Choose a simple, unique word that you
                                        don't use often in conversation
                                    </li>
                                    <li>
                                        • When this word is detected in your
                                        speech, recording will stop
                                        automatically
                                    </li>
                                    <li>
                                        • Your message will be sent immediately
                                        after detection
                                    </li>
                                    <li>
                                        • Leave empty to manually control
                                        recording start/stop
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-purple-600/30">
                            <Label className="text-purple-200">
                                Voice Selection
                            </Label>
                            <p className="text-sm text-purple-400/80 mb-2">
                                Choose your preferred AI voice during live chat
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
                                    <SelectValue placeholder="Select a voice">
                                        {voices.find(
                                            (v) =>
                                                v.id ===
                                                settings.voiceSettings.voice
                                        )?.name || "Select a voice"}
                                    </SelectValue>
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
                        <div className="border-purple-600/30">
                            <Label className="text-purple-200">Language</Label>
                            <p className="text-sm text-purple-400/80 mb-2">
                                Choose AI's language during live chat
                            </p>
                            <Select
                                value={settings.voiceSettings.language}
                                onValueChange={(value) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        voiceSettings: {
                                            ...prev.voiceSettings,
                                            language: value,
                                        },
                                    }))
                                }
                            >
                                <SelectTrigger className="bg-gray-900/60 border-purple-600/30 text-purple-100">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="glass border border-purple-600/30 max-h-64 overflow-y-auto">
                                    {supportedLanguages.map((lang) => (
                                        <SelectItem
                                            key={lang.code}
                                            value={lang.code}
                                            className="text-purple-100"
                                        >
                                            {lang.flag} {lang.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>

                    <TabsContent value="chats" className="space-y-4">
                        <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between p-4 bg-orange-600/10 rounded-lg border border-orange-600/20">
                                <div>
                                    <Label className="text-purple-200">
                                        Default to Temporary Chats
                                    </Label>
                                    <p className="text-sm text-purple-400/80">
                                        New chats will be temporary by default
                                        and auto-expire
                                    </p>
                                </div>
                                <Switch
                                    checked={
                                        settings.temporaryChatsSettings
                                            .defaultToTemporary
                                    }
                                    onCheckedChange={(checked) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            temporaryChatsSettings: {
                                                ...prev.temporaryChatsSettings,
                                                defaultToTemporary: checked,
                                            },
                                        }))
                                    }
                                />
                            </div>

                            <div>
                                <Label className="text-purple-200">
                                    Default Lifespan (Hours)
                                </Label>
                                <p className="text-sm text-purple-400/80 mb-2">
                                    How long temporary chats should exist before
                                    expiring
                                </p>
                                <Select
                                    value={settings.temporaryChatsSettings.defaultLifespanHours.toString()}
                                    onValueChange={(value) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            temporaryChatsSettings: {
                                                ...prev.temporaryChatsSettings,
                                                defaultLifespanHours:
                                                    parseInt(value),
                                            },
                                        }))
                                    }
                                >
                                    <SelectTrigger className="bg-gray-900/60 border-purple-600/30 text-purple-100">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="glass border border-purple-600/30">
                                        <SelectItem
                                            value="1"
                                            className="text-purple-100"
                                        >
                                            1 Hour
                                        </SelectItem>
                                        <SelectItem
                                            value="6"
                                            className="text-purple-100"
                                        >
                                            6 Hours
                                        </SelectItem>
                                        <SelectItem
                                            value="12"
                                            className="text-purple-100"
                                        >
                                            12 Hours
                                        </SelectItem>
                                        <SelectItem
                                            value="24"
                                            className="text-purple-100"
                                        >
                                            24 Hours (1 Day)
                                        </SelectItem>
                                        <SelectItem
                                            value="48"
                                            className="text-purple-100"
                                        >
                                            48 Hours (2 Days)
                                        </SelectItem>
                                        <SelectItem
                                            value="72"
                                            className="text-purple-100"
                                        >
                                            72 Hours (3 Days)
                                        </SelectItem>
                                        <SelectItem
                                            value="168"
                                            className="text-purple-100"
                                        >
                                            1 Week
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-purple-600/10 rounded-lg border border-purple-600/20">
                                <div>
                                    <Label className="text-purple-200">
                                        Auto-cleanup Expired Chats
                                    </Label>
                                    <p className="text-sm text-purple-400/80">
                                        Automatically delete temporary chats
                                        when they expire
                                    </p>
                                </div>
                                <Switch
                                    checked={
                                        settings.temporaryChatsSettings
                                            .autoCleanup
                                    }
                                    onCheckedChange={(checked) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            temporaryChatsSettings: {
                                                ...prev.temporaryChatsSettings,
                                                autoCleanup: checked,
                                            },
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="notifications" className="space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Volume2 className="w-5 h-5 text-purple-400" />
                            <h3 className="text-lg font-medium text-purple-100">
                                Notification Settings
                            </h3>
                        </div>

                        {/* Sound Notifications Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-purple-200">
                                    Sound Notifications
                                </label>
                                <p className="text-xs text-purple-400">
                                    Play a sound when AI responds to your
                                    messages
                                </p>
                            </div>
                            <Switch
                                checked={
                                    settings.notificationSettings.soundEnabled
                                }
                                onCheckedChange={(checked) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        notificationSettings: {
                                            ...prev.notificationSettings,
                                            soundEnabled: checked,
                                        },
                                    }))
                                }
                            />
                        </div>

                        {/* Only When Unfocused Toggle */}
                        {settings.notificationSettings.soundEnabled && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-purple-200">
                                        Only When Tab Unfocused
                                    </label>
                                    <p className="text-xs text-purple-400">
                                        Only play sounds when you're not
                                        actively viewing the tab
                                    </p>
                                </div>
                                <Switch
                                    checked={
                                        settings.notificationSettings
                                            .soundOnlyWhenUnfocused
                                    }
                                    onCheckedChange={(checked) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            notificationSettings: {
                                                ...prev.notificationSettings,
                                                soundOnlyWhenUnfocused: checked,
                                            },
                                        }))
                                    }
                                />
                            </div>
                        )}

                        {/* Sound Type Selection */}
                        {settings.notificationSettings.soundEnabled && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-purple-200">
                                    Notification Sound
                                </label>
                                <Select
                                    value={
                                        settings.notificationSettings.soundType
                                    }
                                    onValueChange={(value) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            notificationSettings: {
                                                ...prev.notificationSettings,
                                                soundType: value,
                                            },
                                        }))
                                    }
                                >
                                    <SelectTrigger className="bg-gray-900/60 border-purple-600/30 text-purple-100">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="glass border border-purple-600/30">
                                        <SelectItem value="subtle">
                                            Subtle
                                        </SelectItem>
                                        <SelectItem value="chime">
                                            Chime
                                        </SelectItem>
                                        <SelectItem value="ping">
                                            Ping
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Volume Slider */}
                        {settings.notificationSettings.soundEnabled && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-purple-200">
                                        Volume
                                    </label>
                                    <span className="text-xs text-purple-400">
                                        {Math.round(
                                            settings.notificationSettings
                                                .soundVolume * 100
                                        )}
                                        %
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={
                                        settings.notificationSettings
                                            .soundVolume
                                    }
                                    onChange={(e) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            notificationSettings: {
                                                ...prev.notificationSettings,
                                                soundVolume: parseFloat(
                                                    e.target.value
                                                ),
                                            },
                                        }))
                                    }
                                    className="w-full"
                                />
                            </div>
                        )}

                        {/* Test Sound Button */}
                        {settings.notificationSettings.soundEnabled && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        await NotificationSounds.testSound(
                                            settings.notificationSettings
                                                .soundType,
                                            settings.notificationSettings
                                                .soundVolume
                                        );
                                    } catch (error) {
                                        toast.error(
                                            "Failed to play test sound"
                                        );
                                    }
                                }}
                                className="border-purple-600/30 text-purple-300 hover:bg-purple-600/20"
                            >
                                <Volume2 className="w-4 h-4 mr-2" />
                                Test Sound
                            </Button>
                        )}

                        {/* Chat Lifecycle Settings */}
                        <div className="pt-6 border-t border-purple-600/20">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock className="w-5 h-5 text-purple-400" />
                                <h3 className="text-lg font-medium text-purple-100">
                                    Chat Lifecycle
                                </h3>
                            </div>

                            {/* Auto-Archive Settings */}
                            <div className="space-y-4 p-4 bg-purple-600/10 rounded-lg border border-purple-600/20 mb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium text-purple-200">
                                            Auto-Archive Chats
                                        </label>
                                        <p className="text-xs text-purple-400">
                                            Automatically archive chats after a
                                            period of inactivity
                                        </p>
                                    </div>
                                    <Switch
                                        checked={
                                            settings.chatLifecycleSettings
                                                .autoArchiveEnabled
                                        }
                                        onCheckedChange={(checked) =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                chatLifecycleSettings: {
                                                    ...prev.chatLifecycleSettings,
                                                    autoArchiveEnabled: checked,
                                                },
                                            }))
                                        }
                                    />
                                </div>

                                {settings.chatLifecycleSettings
                                    .autoArchiveEnabled && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-purple-200">
                                            Archive After (Days)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            value={
                                                settings.chatLifecycleSettings
                                                    .autoArchiveDays
                                            }
                                            onChange={(e) =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    chatLifecycleSettings: {
                                                        ...prev.chatLifecycleSettings,
                                                        autoArchiveDays:
                                                            parseInt(
                                                                e.target.value
                                                            ) || 30,
                                                    },
                                                }))
                                            }
                                            className="w-full p-2 bg-purple-800/30 border border-purple-600/30 rounded-lg text-purple-100 focus:outline-none focus:border-purple-500"
                                        />
                                        <p className="text-xs text-purple-400">
                                            Chats inactive for{" "}
                                            {
                                                settings.chatLifecycleSettings
                                                    .autoArchiveDays
                                            }{" "}
                                            days will be automatically archived
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Auto-Delete Settings */}
                            <div className="space-y-4 p-4 bg-red-600/10 rounded-lg border border-red-600/20">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium text-red-200">
                                            Auto-Delete Archived Chats
                                        </label>
                                        <p className="text-xs text-red-400">
                                            Permanently delete chats after
                                            they've been archived for a while
                                        </p>
                                    </div>
                                    <Switch
                                        checked={
                                            settings.chatLifecycleSettings
                                                .autoDeleteEnabled
                                        }
                                        onCheckedChange={(checked) =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                chatLifecycleSettings: {
                                                    ...prev.chatLifecycleSettings,
                                                    autoDeleteEnabled: checked,
                                                },
                                            }))
                                        }
                                    />
                                </div>

                                {settings.chatLifecycleSettings
                                    .autoDeleteEnabled && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-red-200">
                                                Delete After (Days in Archive)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={
                                                    settings
                                                        .chatLifecycleSettings
                                                        .autoDeleteDays
                                                }
                                                onChange={(e) =>
                                                    setSettings((prev) => ({
                                                        ...prev,
                                                        chatLifecycleSettings: {
                                                            ...prev.chatLifecycleSettings,
                                                            autoDeleteDays:
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                ) || 30,
                                                        },
                                                    }))
                                                }
                                                className="w-full p-2 bg-red-800/30 border border-red-600/30 rounded-lg text-red-100 focus:outline-none focus:border-red-500"
                                            />
                                            <p className="text-xs text-red-400">
                                                Archived chats will be
                                                permanently deleted after{" "}
                                                {
                                                    settings
                                                        .chatLifecycleSettings
                                                        .autoDeleteDays
                                                }{" "}
                                                days
                                            </p>
                                        </div>

                                        <div className="flex items-start gap-2 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
                                            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                            <div className="text-xs text-red-300">
                                                <strong>Warning:</strong>{" "}
                                                Auto-deleted chats cannot be
                                                recovered. Make sure to export
                                                important conversations before
                                                they are deleted.
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="ai" className="space-y-6">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-purple-100">
                                    Advanced AI Settings
                                </h3>
                                <button
                                    onClick={() => {
                                        setSettings((prev) => ({
                                            ...prev,
                                            aiSettings: {
                                                temperature: 0.7,
                                                maxTokens: undefined,
                                                systemPrompt: "",
                                                responseMode: "balanced",
                                                promptEnhancement: false,
                                                contextWindow: undefined,
                                                topP: 0.9,
                                                frequencyPenalty: 0,
                                                presencePenalty: 0,
                                            },
                                        }));
                                    }}
                                    className="px-3 py-1.5 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-md border border-purple-500/30 transition-all duration-200"
                                >
                                    Reset to Defaults
                                </button>
                            </div>

                            {/* Temperature Setting */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-purple-200 font-medium">
                                        Temperature
                                    </label>
                                    <span className="text-purple-300 text-sm">
                                        {settings.aiSettings?.temperature ||
                                            0.7}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={
                                        settings.aiSettings?.temperature || 0.7
                                    }
                                    onChange={(e) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            aiSettings: {
                                                ...prev.aiSettings,
                                                temperature: parseFloat(
                                                    e.target.value
                                                ),
                                            },
                                        }))
                                    }
                                    className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                />
                                <p className="text-xs text-purple-400">
                                    Lower values make responses more focused and
                                    deterministic. Higher values increase
                                    creativity and randomness.
                                </p>
                            </div>

                            {/* Response Mode */}
                            <div className="space-y-3">
                                <label className="text-purple-200 font-medium">
                                    Response Mode
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {[
                                        {
                                            id: "balanced",
                                            label: "Balanced",
                                            desc: "Well-rounded responses",
                                        },
                                        {
                                            id: "concise",
                                            label: "Concise",
                                            desc: "Brief and to the point",
                                        },
                                        {
                                            id: "detailed",
                                            label: "Detailed",
                                            desc: "Comprehensive explanations",
                                        },
                                        {
                                            id: "creative",
                                            label: "Creative",
                                            desc: "More imaginative responses",
                                        },
                                        {
                                            id: "analytical",
                                            label: "Analytical",
                                            desc: "Data-driven approach",
                                        },
                                        {
                                            id: "friendly",
                                            label: "Friendly",
                                            desc: "Casual and approachable",
                                        },
                                        {
                                            id: "professional",
                                            label: "Professional",
                                            desc: "Formal business tone",
                                        },
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    aiSettings: {
                                                        ...prev.aiSettings,
                                                        responseMode: mode.id,
                                                    },
                                                }))
                                            }
                                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                                                (settings.aiSettings
                                                    ?.responseMode ||
                                                    "balanced") === mode.id
                                                    ? "bg-purple-500/30 border-purple-500/50 text-purple-100"
                                                    : "bg-purple-500/10 border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
                                            }`}
                                            title={mode.desc}
                                        >
                                            <div className="font-medium text-sm">
                                                {mode.label}
                                            </div>
                                            <div className="text-xs opacity-70 mt-1">
                                                {mode.desc}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div className="space-y-3">
                                <label className="text-purple-200 font-medium">
                                    Custom System Prompt
                                </label>
                                <textarea
                                    value={
                                        settings.aiSettings?.systemPrompt || ""
                                    }
                                    onChange={(e) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            aiSettings: {
                                                ...prev.aiSettings,
                                                systemPrompt: e.target.value,
                                            },
                                        }))
                                    }
                                    placeholder="Enter a custom system prompt to guide AI behavior..."
                                    className="w-full h-24 px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                                />
                                <p className="text-xs text-purple-400">
                                    This prompt will be sent with every message
                                    to guide the AI's behavior and responses.
                                </p>
                            </div>

                            {/* Prompt Enhancement */}
                            <div className="flex items-center justify-between p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                                <div>
                                    <h4 className="text-purple-100 font-medium">
                                        1-Click Prompt Enhancement
                                    </h4>
                                    <p className="text-sm text-purple-300 mt-1">
                                        Automatically enhance your prompts for
                                        better AI responses
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={
                                            settings.aiSettings
                                                ?.promptEnhancement || false
                                        }
                                        onChange={(e) =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                aiSettings: {
                                                    ...prev.aiSettings,
                                                    promptEnhancement:
                                                        e.target.checked,
                                                },
                                            }))
                                        }
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-purple-600/30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                                </label>
                            </div>

                            {/* Advanced Parameters */}
                            <details className="group">
                                <summary className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30 cursor-pointer hover:bg-purple-500/20 transition-colors">
                                    <span className="text-purple-200 font-medium">
                                        Advanced Parameters
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-purple-400 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="mt-4 space-y-4 p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
                                    {/* Max Tokens */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-purple-200 text-sm">
                                                Max Tokens
                                            </label>
                                            <span className="text-purple-300 text-sm">
                                                {settings.aiSettings
                                                    ?.maxTokens || "Auto"}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            max="32000"
                                            value={
                                                settings.aiSettings
                                                    ?.maxTokens || ""
                                            }
                                            onChange={(e) =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    aiSettings: {
                                                        ...prev.aiSettings,
                                                        maxTokens: e.target
                                                            .value
                                                            ? parseInt(
                                                                  e.target.value
                                                              )
                                                            : undefined,
                                                    },
                                                }))
                                            }
                                            placeholder="Auto"
                                            className="w-full px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-md text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        />
                                    </div>

                                    {/* Top P */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-purple-200 text-sm">
                                                Top P (Nucleus Sampling)
                                            </label>
                                            <span className="text-purple-300 text-sm">
                                                {settings.aiSettings?.topP ||
                                                    0.9}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={
                                                settings.aiSettings?.topP || 0.9
                                            }
                                            onChange={(e) =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    aiSettings: {
                                                        ...prev.aiSettings,
                                                        topP: parseFloat(
                                                            e.target.value
                                                        ),
                                                    },
                                                }))
                                            }
                                            className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                        />
                                    </div>

                                    {/* Frequency Penalty */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-purple-200 text-sm">
                                                Frequency Penalty
                                            </label>
                                            <span className="text-purple-300 text-sm">
                                                {settings.aiSettings
                                                    ?.frequencyPenalty || 0}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={
                                                settings.aiSettings
                                                    ?.frequencyPenalty || 0
                                            }
                                            onChange={(e) =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    aiSettings: {
                                                        ...prev.aiSettings,
                                                        frequencyPenalty:
                                                            parseFloat(
                                                                e.target.value
                                                            ),
                                                    },
                                                }))
                                            }
                                            className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                        />
                                    </div>

                                    {/* Presence Penalty */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-purple-200 text-sm">
                                                Presence Penalty
                                            </label>
                                            <span className="text-purple-300 text-sm">
                                                {settings.aiSettings
                                                    ?.presencePenalty || 0}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={
                                                settings.aiSettings
                                                    ?.presencePenalty || 0
                                            }
                                            onChange={(e) =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    aiSettings: {
                                                        ...prev.aiSettings,
                                                        presencePenalty:
                                                            parseFloat(
                                                                e.target.value
                                                            ),
                                                    },
                                                }))
                                            }
                                            className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                        />
                                    </div>
                                </div>
                            </details>
                        </div>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-green-400" />
                                <h3 className="text-lg font-semibold text-purple-100">
                                    Password Protection
                                </h3>
                            </div>
                            <p className="text-purple-300 text-sm">
                                Secure your chats with password protection. Set
                                a default password or customize protection for
                                individual chats.
                            </p>

                            {/* Default Password Management */}
                            <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Key className="w-4 h-4 text-purple-400" />
                                        <span className="text-purple-200 font-medium">
                                            Default Password
                                        </span>
                                    </div>
                                    <div
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            preferences?.passwordSettings
                                                ?.defaultPasswordHash
                                                ? "bg-green-500/20 text-green-300"
                                                : "bg-gray-500/20 text-gray-300"
                                        }`}
                                    >
                                        {preferences?.passwordSettings
                                            ?.defaultPasswordHash
                                            ? "Set"
                                            : "Not Set"}
                                    </div>
                                </div>

                                <p className="text-purple-300 text-sm mb-3">
                                    Set a default password to quickly protect
                                    new chats without entering a password each
                                    time.
                                </p>

                                <Button
                                    onClick={() =>
                                        setShowDefaultPasswordModal(true)
                                    }
                                    className={
                                        preferences?.passwordSettings
                                            ?.defaultPasswordHash
                                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                                            : "bg-green-600 hover:bg-green-700 text-white"
                                    }
                                >
                                    <Shield className="w-4 h-4 mr-2" />
                                    {preferences?.passwordSettings
                                        ?.defaultPasswordHash
                                        ? "Change Default Password"
                                        : "Set Default Password"}
                                </Button>

                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <span className="text-purple-200 text-sm font-medium">
                                            Lock New Chats by Default
                                        </span>
                                        <p className="text-purple-400 text-xs">
                                            Automatically protect all new chats
                                            with your default password.
                                        </p>
                                    </div>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>
                                                    <Switch
                                                        checked={
                                                            settings
                                                                .passwordSettings
                                                                .defaultLockNewChats
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            setSettings(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    passwordSettings:
                                                                        {
                                                                            ...prev.passwordSettings,
                                                                            defaultLockNewChats:
                                                                                checked,
                                                                        },
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            !preferences
                                                                ?.passwordSettings
                                                                ?.defaultPasswordHash
                                                        }
                                                    />
                                                </span>
                                            </TooltipTrigger>
                                            {!preferences?.passwordSettings
                                                ?.defaultPasswordHash && (
                                                <TooltipContent
                                                    side="left"
                                                    className="bg-gray-900 border border-purple-500/30 text-purple-200"
                                                >
                                                    Set a default password first
                                                    to enable this option.
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>

                            {/* Session Settings */}
                            <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <Clock className="w-4 h-4 text-purple-400" />
                                    <span className="text-purple-200 font-medium">
                                        Session Settings
                                    </span>
                                </div>

                                {/* Use Default Password Toggle */}
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <span className="text-purple-200 text-sm font-medium">
                                            Use Default Password
                                        </span>
                                        <p className="text-purple-400 text-xs">
                                            Automatically use your default
                                            password for new protected chats
                                        </p>
                                    </div>
                                    <Switch
                                        checked={
                                            settings.passwordSettings
                                                .useDefaultPassword
                                        }
                                        onCheckedChange={(checked) =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                passwordSettings: {
                                                    ...prev.passwordSettings,
                                                    useDefaultPassword: checked,
                                                },
                                            }))
                                        }
                                    />
                                </div>

                                {/* Session Timeout Toggle */}
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <span className="text-purple-200 text-sm font-medium">
                                            Session Timeout
                                        </span>
                                        <p className="text-purple-400 text-xs">
                                            Require password re-entry after
                                            period of inactivity
                                        </p>
                                    </div>
                                    <Switch
                                        checked={
                                            settings.passwordSettings
                                                .sessionTimeoutEnabled
                                        }
                                        onCheckedChange={(checked) =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                passwordSettings: {
                                                    ...prev.passwordSettings,
                                                    sessionTimeoutEnabled:
                                                        checked,
                                                },
                                            }))
                                        }
                                    />
                                </div>

                                {/* Timeout Duration - Updated to 6 hours max */}
                                {settings.passwordSettings
                                    .sessionTimeoutEnabled && (
                                    <div className="space-y-2">
                                        <label className="text-purple-200 text-sm font-medium">
                                            Auto-lock timeout:{" "}
                                            {
                                                settings.passwordSettings
                                                    .autoLockTimeout
                                            }{" "}
                                            minutes
                                        </label>
                                        <input
                                            type="range"
                                            min="5"
                                            max="360"
                                            step="5"
                                            value={
                                                settings.passwordSettings
                                                    .autoLockTimeout
                                            }
                                            onChange={(e) =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    passwordSettings: {
                                                        ...prev.passwordSettings,
                                                        autoLockTimeout:
                                                            parseInt(
                                                                e.target.value
                                                            ),
                                                    },
                                                }))
                                            }
                                            className="w-full h-2 bg-purple-500/20 rounded-lg appearance-none cursor-pointer slider"
                                        />
                                        <div className="flex justify-between text-xs text-purple-400">
                                            <span>5 min</span>
                                            <span>1 hour</span>
                                            <span>3 hours</span>
                                            <span>6 hours</span>
                                        </div>
                                    </div>
                                )}
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
                        className="px-4 py-2 space-x-2 rounded-lg bg-gradient-to-r from-pink-500/60 to-purple-500/60 text-white font-medium hover:from-pink-500/50 hover:to-purple-500/50 transition-all duration-200 shadow-lg hover:shadow-xl"
                        title="Save settings (Ctrl + Enter)"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                    </Button>
                </div>
            </DialogContent>

            <DefaultPasswordModal
                open={showDefaultPasswordModal}
                onOpenChange={setShowDefaultPasswordModal}
            />
        </Dialog>
    );
}
