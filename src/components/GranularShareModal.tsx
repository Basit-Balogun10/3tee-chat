import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
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
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import {
    Share2,
    Copy,
    Shield,
    Globe,
    Lock,
    Users,
    Link2,
    CheckCircle2,
    AlertTriangle,
    QrCode,
    BarChart3,
    PieChart,
    LineChart,
    Activity,
    Database,
    FileText,
    UserX,
    Clock,
    Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import {
    GranularSharingService,
    type SharePermissions,
    type ShareLink,
    type EnhancedExportOptions,
} from "./AnalyticsExportServices";

interface GranularShareModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contentType: "overview" | "chart" | "dataset" | "dashboard";
    contentData: any;
    contentTitle: string;
    chartElement?: HTMLElement;
    chartId?: string;
}

interface ShareConfiguration {
    title: string;
    description: string;
    permissions: SharePermissions;
    privacy: EnhancedExportOptions["privacy"];
    customization: {
        includedSections: string[];
        customMetrics?: any[];
        removePersonalInfo: boolean;
        anonymizeData: boolean;
        includeWatermark: boolean;
    };
}

export function GranularShareModal({
    open,
    onOpenChange,
    contentType,
    contentData,
    contentTitle,
    chartElement,
    chartId,
}: GranularShareModalProps) {
    const [activeTab, setActiveTab] = useState("content");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<ShareLink | null>(null);

    const [shareConfig, setShareConfig] = useState<ShareConfiguration>({
        title: contentTitle,
        description: "",
        permissions: {
            viewerAccess: "public",
            allowDownload: true,
            allowPrint: true,
            allowCopy: true,
            watermark: false,
        },
        privacy: {
            dataObfuscation: {
                enabled: false,
                level: "light",
            },
            contentFiltering: {
                excludeChats: [],
                excludeProjects: [],
                excludeTimeRanges: [],
            },
            anonymization: {
                replaceUsernames: false,
                replaceTimestamps: false,
                generalizeMetrics: false,
            },
        },
        customization: {
            includedSections: getDefaultIncludedSections(
                contentType,
                contentData
            ),
            removePersonalInfo: false,
            anonymizeData: false,
            includeWatermark: false,
        },
    });

    const handleGenerateShareLink = async () => {
        setIsGenerating(true);
        try {
            let shareLink: ShareLink;

            switch (contentType) {
                case "chart":
                    if (!chartElement || !chartId) {
                        throw new Error(
                            "Chart element and ID required for chart sharing"
                        );
                    }
                    shareLink = await GranularSharingService.shareChart(
                        chartId,
                        contentData,
                        chartElement,
                        {
                            title: shareConfig.title,
                            permissions: shareConfig.permissions,
                            privacy: shareConfig.privacy,
                        }
                    );
                    break;

                case "dataset":
                    shareLink = await GranularSharingService.shareDataset(
                        "chats", // Determine from contentData
                        contentData,
                        {
                            title: shareConfig.title,
                            permissions: shareConfig.permissions,
                            privacy: shareConfig.privacy,
                        }
                    );
                    break;

                case "overview":
                    shareLink = await GranularSharingService.shareOverview(
                        contentData,
                        {
                            title: shareConfig.title,
                            permissions: shareConfig.permissions,
                            privacy: shareConfig.privacy,
                            customization: {
                                includedSections:
                                    shareConfig.customization.includedSections,
                            },
                        }
                    );
                    break;

                default:
                    throw new Error("Unsupported content type for sharing");
            }

            setGeneratedLink(shareLink);
            setActiveTab("share");
            toast.success("Share link generated successfully!");
        } catch {
            toast.error("Failed to generate share link");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyLink = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success("Link copied to clipboard!");
        } catch {
            toast.error("Failed to copy link");
        }
    };

    const generateQRCode = async (_url: string) => {
        // TODO: Integrate QR code generation library
        toast.info("QR code generation coming soon!");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-purple-400" />
                        Share Analytics - {getContentTypeLabel(contentType)}
                    </DialogTitle>
                </DialogHeader>

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-4 bg-purple-500/10">
                        <TabsTrigger
                            value="content"
                            className="flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            Content
                        </TabsTrigger>
                        <TabsTrigger
                            value="permissions"
                            className="flex items-center gap-2"
                        >
                            <Shield className="w-4 h-4" />
                            Permissions
                        </TabsTrigger>
                        <TabsTrigger
                            value="privacy"
                            className="flex items-center gap-2"
                        >
                            <UserX className="w-4 h-4" />
                            Privacy
                        </TabsTrigger>
                        <TabsTrigger
                            value="share"
                            className="flex items-center gap-2"
                        >
                            <Link2 className="w-4 h-4" />
                            Share
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-6 overflow-y-auto max-h-[60vh]">
                        <TabsContent value="content" className="space-y-6">
                            <ContentSelectionTab
                                contentType={contentType}
                                contentData={contentData}
                                shareConfig={shareConfig}
                                onConfigChange={setShareConfig}
                            />
                        </TabsContent>

                        <TabsContent value="permissions" className="space-y-6">
                            <PermissionsTab
                                shareConfig={shareConfig}
                                onConfigChange={setShareConfig}
                            />
                        </TabsContent>

                        <TabsContent value="privacy" className="space-y-6">
                            <PrivacyTab
                                shareConfig={shareConfig}
                                onConfigChange={setShareConfig}
                            />
                        </TabsContent>

                        <TabsContent value="share" className="space-y-6">
                            {generatedLink ? (
                                <ShareLinkTab
                                    shareLink={generatedLink}
                                    onCopyLink={handleCopyLink}
                                    onGenerateQR={generateQRCode}
                                />
                            ) : (
                                <div className="text-center py-8">
                                    <Share2 className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                                    <p className="text-purple-300 mb-4">
                                        Configure your content and permissions,
                                        then generate a share link
                                    </p>
                                    <Button
                                        onClick={handleGenerateShareLink}
                                        disabled={isGenerating}
                                        className="bg-purple-500/30 hover:bg-purple-500/40"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Zap className="w-4 h-4 mr-2 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Share2 className="w-4 h-4 mr-2" />
                                                Generate Share Link
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="flex justify-between pt-4 border-t border-purple-600/20">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    {activeTab !== "share" && (
                        <Button
                            onClick={handleGenerateShareLink}
                            disabled={isGenerating}
                            className="bg-purple-500/30 hover:bg-purple-500/40"
                        >
                            {isGenerating ? (
                                <>
                                    <Zap className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Share2 className="w-4 h-4 mr-2" />
                                    Generate Share Link
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Content Selection Tab Component
function ContentSelectionTab({
    contentType,
    contentData,
    shareConfig,
    onConfigChange,
}: {
    contentType: string;
    contentData: any;
    shareConfig: ShareConfiguration;
    onConfigChange: (config: ShareConfiguration) => void;
}) {
    const availableSections = getAvailableSections(contentType, contentData);

    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
                <div>
                    <Label className="text-purple-200">Share Title</Label>
                    <Input
                        value={shareConfig.title}
                        onChange={(e) =>
                            onConfigChange({
                                ...shareConfig,
                                title: e.target.value,
                            })
                        }
                        className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                        placeholder="Enter a descriptive title..."
                    />
                </div>

                <div>
                    <Label className="text-purple-200">
                        Description (Optional)
                    </Label>
                    <Textarea
                        value={shareConfig.description}
                        onChange={(e) =>
                            onConfigChange({
                                ...shareConfig,
                                description: e.target.value,
                            })
                        }
                        className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                        placeholder="Add context about this shared content..."
                        rows={3}
                    />
                </div>
            </div>

            {/* Content Selection */}
            {contentType !== "chart" && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-purple-100">
                        Select Content to Share
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {availableSections.map((section) => (
                            <div
                                key={section.id}
                                className={cn(
                                    "p-4 rounded-lg border transition-all cursor-pointer",
                                    shareConfig.customization.includedSections.includes(
                                        section.id
                                    )
                                        ? "bg-purple-500/30 border-purple-500/50"
                                        : "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20"
                                )}
                                onClick={() => {
                                    const newSections =
                                        shareConfig.customization.includedSections.includes(
                                            section.id
                                        )
                                            ? shareConfig.customization.includedSections.filter(
                                                  (s) => s !== section.id
                                              )
                                            : [
                                                  ...shareConfig.customization
                                                      .includedSections,
                                                  section.id,
                                              ];

                                    onConfigChange({
                                        ...shareConfig,
                                        customization: {
                                            ...shareConfig.customization,
                                            includedSections: newSections,
                                        },
                                    });
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-purple-300">
                                        {section.icon}
                                    </div>
                                    <div>
                                        <p className="font-medium text-purple-100">
                                            {section.label}
                                        </p>
                                        <p className="text-sm text-purple-400">
                                            {section.description}
                                        </p>
                                    </div>
                                    {shareConfig.customization.includedSections.includes(
                                        section.id
                                    ) && (
                                        <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Preview */}
            <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <h4 className="font-medium text-purple-100 mb-2">
                    Content Preview
                </h4>
                <div className="text-sm text-purple-300">
                    <p>Type: {getContentTypeLabel(contentType)}</p>
                    <p>
                        Sections:{" "}
                        {shareConfig.customization.includedSections.length}
                    </p>
                    {contentData.exportMetadata && (
                        <p>
                            Time Range: {contentData.exportMetadata.timeRange}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// Permissions Tab Component
function PermissionsTab({
    shareConfig,
    onConfigChange,
}: {
    shareConfig: ShareConfiguration;
    onConfigChange: (config: ShareConfiguration) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Access Level */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-100">
                    Access Level
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            id: "public",
                            label: "Public",
                            desc: "Anyone with the link",
                            icon: <Globe className="w-4 h-4" />,
                        },
                        {
                            id: "restricted",
                            label: "Restricted",
                            desc: "Specific domains only",
                            icon: <Users className="w-4 h-4" />,
                        },
                        {
                            id: "private",
                            label: "Private",
                            desc: "Password protected",
                            icon: <Lock className="w-4 h-4" />,
                        },
                    ].map((access) => (
                        <button
                            key={access.id}
                            onClick={() =>
                                onConfigChange({
                                    ...shareConfig,
                                    permissions: {
                                        ...shareConfig.permissions,
                                        viewerAccess: access.id as any,
                                    },
                                })
                            }
                            className={cn(
                                "p-4 rounded-lg border text-left transition-all",
                                shareConfig.permissions.viewerAccess ===
                                    access.id
                                    ? "bg-purple-500/30 border-purple-500/50 text-purple-100"
                                    : "bg-purple-500/10 border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {access.icon}
                                <span className="font-medium">
                                    {access.label}
                                </span>
                            </div>
                            <p className="text-sm opacity-75">{access.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Password Protection */}
            {/* Password Protection */}
            {shareConfig.permissions.viewerAccess === "private" && (
                <div className="space-y-3">
                    <Label className="text-purple-200">Password</Label>
                    <Input
                        type="password"
                        value={shareConfig.permissions.requiredPassword || ""}
                        onChange={(e) =>
                            onConfigChange({
                                ...shareConfig,
                                permissions: {
                                    ...shareConfig.permissions,
                                    requiredPassword: e.target.value,
                                },
                            })
                        }
                        className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                        placeholder="Enter password for protected access..."
                    />
                </div>
            )}

            {/* Allowed Domains */}
            {shareConfig.permissions.viewerAccess === "restricted" && (
                <div className="space-y-3">
                    <Label className="text-purple-200">Allowed Domains</Label>
                    <Input
                        value={
                            shareConfig.permissions.allowedDomains?.join(
                                ", "
                            ) || ""
                        }
                        onChange={(e) =>
                            onConfigChange({
                                ...shareConfig,
                                permissions: {
                                    ...shareConfig.permissions,
                                    allowedDomains: e.target.value
                                        .split(",")
                                        .map((d) => d.trim())
                                        .filter(Boolean),
                                },
                            })
                        }
                        className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                        placeholder="example.com, company.org"
                    />
                    <p className="text-sm text-purple-400">
                        Comma-separated list of allowed domains
                    </p>
                </div>
            )}

            {/* Viewer Permissions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-100">
                    Viewer Permissions
                </h3>
                <div className="space-y-3">
                    {[
                        {
                            key: "allowDownload",
                            label: "Allow Downloads",
                            desc: "Viewers can download data/images",
                        },
                        {
                            key: "allowPrint",
                            label: "Allow Printing",
                            desc: "Viewers can print the content",
                        },
                        {
                            key: "allowCopy",
                            label: "Allow Copy",
                            desc: "Viewers can copy text/data",
                        },
                        {
                            key: "watermark",
                            label: "Add Watermark",
                            desc: "Include T3 Chat branding on shared content",
                        },
                    ].map((permission) => (
                        <div
                            key={permission.key}
                            className="flex items-center justify-between p-3 bg-purple-500/10 rounded border border-purple-500/30"
                        >
                            <div>
                                <p className="text-purple-200 font-medium">
                                    {permission.label}
                                </p>
                                <p className="text-sm text-purple-400">
                                    {permission.desc}
                                </p>
                            </div>
                            <Switch
                                checked={
                                    shareConfig.permissions[
                                        permission.key as keyof SharePermissions
                                    ] as boolean
                                }
                                onCheckedChange={(checked) =>
                                    onConfigChange({
                                        ...shareConfig,
                                        permissions: {
                                            ...shareConfig.permissions,
                                            [permission.key]: checked,
                                        },
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Expiration */}
            <div className="space-y-3">
                <Label className="text-purple-200">
                    Link Expiration (Optional)
                </Label>
                <Input
                    type="datetime-local"
                    value={
                        shareConfig.permissions.expirationDate
                            ? new Date(
                                  shareConfig.permissions.expirationDate.getTime() -
                                      shareConfig.permissions.expirationDate.getTimezoneOffset() *
                                          60000
                              )
                                  .toISOString()
                                  .slice(0, 16)
                            : ""
                    }
                    onChange={(e) =>
                        onConfigChange({
                            ...shareConfig,
                            permissions: {
                                ...shareConfig.permissions,
                                expirationDate: e.target.value
                                    ? new Date(e.target.value)
                                    : undefined,
                            },
                        })
                    }
                    className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                />
            </div>
        </div>
    );
}

// Privacy Tab Component
function PrivacyTab({
    shareConfig,
    onConfigChange,
}: {
    shareConfig: ShareConfiguration;
    onConfigChange: (config: ShareConfiguration) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Data Anonymization */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-100">
                    Data Anonymization
                </h3>
                <div className="space-y-3">
                    {[
                        {
                            key: "replaceUsernames",
                            label: "Replace Usernames",
                            desc: "Replace real usernames with generic identifiers (User 1, User 2...)",
                        },
                        {
                            key: "replaceTimestamps",
                            label: "Generalize Timestamps",
                            desc: "Convert absolute times to relative times (3 days ago...)",
                        },
                        {
                            key: "generalizeMetrics",
                            label: "Generalize Metrics",
                            desc: "Round numbers to ranges for privacy (10-50, 100-500...)",
                        },
                    ].map((option) => (
                        <div
                            key={option.key}
                            className="flex items-center justify-between p-3 bg-purple-500/10 rounded border border-purple-500/30"
                        >
                            <div>
                                <p className="text-purple-200 font-medium">
                                    {option.label}
                                </p>
                                <p className="text-sm text-purple-400">
                                    {option.desc}
                                </p>
                            </div>
                            <Switch
                                checked={
                                    shareConfig.privacy.anonymization[
                                        option.key as keyof typeof shareConfig.privacy.anonymization
                                    ]
                                }
                                onCheckedChange={(checked) =>
                                    onConfigChange({
                                        ...shareConfig,
                                        privacy: {
                                            ...shareConfig.privacy,
                                            anonymization: {
                                                ...shareConfig.privacy
                                                    .anonymization,
                                                [option.key]: checked,
                                            },
                                        },
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Data Obfuscation */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-purple-100">
                        Data Obfuscation
                    </h3>
                    <Switch
                        checked={shareConfig.privacy.dataObfuscation.enabled}
                        onCheckedChange={(checked) =>
                            onConfigChange({
                                ...shareConfig,
                                privacy: {
                                    ...shareConfig.privacy,
                                    dataObfuscation: {
                                        ...shareConfig.privacy.dataObfuscation,
                                        enabled: checked,
                                    },
                                },
                            })
                        }
                    />
                </div>

                {shareConfig.privacy.dataObfuscation.enabled && (
                    <div className="space-y-3">
                        <Label className="text-purple-200">
                            Obfuscation Level
                        </Label>
                        <Select
                            value={shareConfig.privacy.dataObfuscation.level}
                            onValueChange={(
                                value: "light" | "medium" | "heavy"
                            ) =>
                                onConfigChange({
                                    ...shareConfig,
                                    privacy: {
                                        ...shareConfig.privacy,
                                        dataObfuscation: {
                                            ...shareConfig.privacy
                                                .dataObfuscation,
                                            level: value,
                                        },
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="bg-purple-500/10 border-purple-500/30 text-purple-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-purple-900/90 border border-purple-500/30">
                                <SelectItem value="light">
                                    Light (10% noise)
                                </SelectItem>
                                <SelectItem value="medium">
                                    Medium (25% noise)
                                </SelectItem>
                                <SelectItem value="heavy">
                                    Heavy (50% noise)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-purple-400">
                            Adds statistical noise to numerical data to protect
                            exact values while preserving trends
                        </p>
                    </div>
                )}
            </div>

            {/* Privacy Warning */}
            <div className="p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                        <p className="text-yellow-200 font-medium">
                            Privacy Notice
                        </p>
                        <p className="text-sm text-yellow-300 mt-1">
                            Even with privacy settings enabled, shared analytics
                            may still contain patterns that could be analyzed.
                            Only share data you're comfortable making public to
                            your intended audience.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Share Link Tab Component
function ShareLinkTab({
    shareLink,
    onCopyLink,
    onGenerateQR,
}: {
    shareLink: ShareLink;
    onCopyLink: (url: string) => void;
    onGenerateQR: (url: string) => void;
}) {
    const embedCode = GranularSharingService.generateEmbedCode(shareLink);

    return (
        <div className="space-y-6">
            {/* Success Message */}
            <div className="p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <p className="text-green-200 font-medium">
                        Share link generated successfully!
                    </p>
                </div>
            </div>

            {/* Share URL */}
            <div className="space-y-3">
                <Label className="text-purple-200">Share URL</Label>
                <div className="flex gap-2">
                    <Input
                        value={shareLink.fullUrl}
                        readOnly
                        className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                    />
                    <Button
                        onClick={() => onCopyLink(shareLink.fullUrl)}
                        variant="outline"
                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={() => onGenerateQR(shareLink.fullUrl)}
                        variant="outline"
                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                    >
                        <QrCode className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Embed Code */}
            <div className="space-y-3">
                <Label className="text-purple-200">Embed Code</Label>
                <div className="relative">
                    <Textarea
                        value={embedCode}
                        readOnly
                        className="bg-purple-500/10 border-purple-500/30 text-purple-100 font-mono text-sm"
                        rows={6}
                    />
                    <Button
                        onClick={() => onCopyLink(embedCode)}
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                    >
                        <Copy className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Share Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30">
                    <p className="text-sm font-medium text-purple-200">
                        Created
                    </p>
                    <p className="text-purple-100">
                        {shareLink.createdAt.toLocaleString()}
                    </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30">
                    <p className="text-sm font-medium text-purple-200">
                        Status
                    </p>
                    <Badge
                        variant={
                            shareLink.status === "active"
                                ? "default"
                                : "secondary"
                        }
                    >
                        {shareLink.status}
                    </Badge>
                </div>
            </div>
        </div>
    );
}

// Utility Functions
function getContentTypeLabel(type: string): string {
    switch (type) {
        case "overview":
            return "Analytics Overview";
        case "chart":
            return "Individual Chart";
        case "dataset":
            return "Raw Dataset";
        case "dashboard":
            return "Full Dashboard";
        default:
            return "Analytics Content";
    }
}

function getDefaultIncludedSections(
    contentType: string,
    contentData: any
): string[] {
    // Return all available sections by default
    return getAvailableSections(contentType, contentData).map((s) => s.id);
}

function getAvailableSections(contentType: string, contentData: any) {
    const commonSections = [
        {
            id: "overview",
            label: "Overview Stats",
            description: "Key metrics and summary",
            icon: <BarChart3 className="w-4 h-4" />,
        },
        {
            id: "chats",
            label: "Chat Analytics",
            description: "Chat creation and usage patterns",
            icon: <Activity className="w-4 h-4" />,
        },
        {
            id: "messages",
            label: "Message Analytics",
            description: "Message trends and AI model usage",
            icon: <PieChart className="w-4 h-4" />,
        },
        {
            id: "projects",
            label: "Project Analytics",
            description: "Project organization and activity",
            icon: <Database className="w-4 h-4" />,
        },
        {
            id: "library",
            label: "Library Analytics",
            description: "Content library breakdown",
            icon: <FileText className="w-4 h-4" />,
        },
        {
            id: "time",
            label: "Time Analytics",
            description: "Activity patterns over time",
            icon: <Clock className="w-4 h-4" />,
        },
    ];

    switch (contentType) {
        case "chart":
            return [
                {
                    id: "chart",
                    label: "Chart Data",
                    description: "Individual chart and data",
                    icon: <LineChart className="w-4 h-4" />,
                },
            ];
        case "dataset":
            return commonSections.filter((s) => contentData[s.id]);
        case "overview":
        case "dashboard":
        default:
            return commonSections;
    }
}
