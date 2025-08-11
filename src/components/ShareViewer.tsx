import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
    Shield,
    Eye,
    Download,
    Printer,
    Copy,
    AlertTriangle,
    Lock,
    Calendar,
    BarChart3,
    ArrowLeft,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { LoadingAnimation } from "./LoadingAnimation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ShareViewerProps {
    shareId: string;
    embedMode?: boolean;
    _theme?: "light" | "dark" | "auto";
    showControls?: boolean;
}

export function ShareViewer({
    shareId,
    embedMode = false,
    _theme = "auto",
    showControls = true,
}: ShareViewerProps) {
    const navigate = useNavigate();

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [hasAccess, setHasAccess] = useState(false);

    // Real Convex queries and mutations
    const shareData = useQuery(api.sharing.getAnalyticsShare, { shareId });
    const validateAccess = useQuery(api.sharing.validateAnalyticsShareAccess, {
        shareId,
        password: isAuthenticated ? passwordInput : undefined,
        domain: window.location.hostname,
    });
    const trackView = useMutation(api.sharing.trackAnalyticsShareView);
    const trackDownload = useMutation(api.sharing.trackAnalyticsShareDownload);

    const [accessValidated, setAccessValidated] = useState(false);

    useEffect(() => {
        if (validateAccess && !accessValidated) {
            if (validateAccess.hasAccess && validateAccess.share) {
                setHasAccess(true);
                setAccessValidated(true);
                // Track view
                trackView({
                    shareId,
                    viewerInfo: {
                        userAgent: navigator.userAgent,
                        referrer: document.referrer,
                    },
                });
            } else if (validateAccess.reason) {
                switch (validateAccess.reason) {
                    case "not_found":
                        setError(
                            "This shared link could not be found or may have been removed."
                        );
                        break;
                    case "expired":
                        setError("This shared link has expired.");
                        break;
                    case "disabled":
                        setError(
                            "This shared link has been disabled by the owner."
                        );
                        break;
                    case "view_limit_exceeded":
                        setError(
                            "This shared link has reached its view limit."
                        );
                        break;
                    case "domain_restricted":
                        setError(
                            "Access denied. Your domain is not authorized to view this content."
                        );
                        break;
                    case "password_required":
                        // Don't set error for password required, show password form instead
                        if (!isAuthenticated) {
                            setHasAccess(false);
                        }
                        break;
                    default:
                        setError("Unable to access this shared content.");
                }
            }
        }
    }, [validateAccess, accessValidated, shareId, trackView, isAuthenticated]);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!passwordInput.trim()) {
            toast.error("Please enter a password");
            return;
        }

        setIsAuthenticated(true);
        setPasswordInput(passwordInput);
    };

    const handleDownload = () => {
        if (!shareData?.permissions.allowDownload) {
            toast.error("Downloads are not allowed for this shared content");
            return;
        }

        trackDownload({ shareId })
            .then(() => {
                // TODO: Implement actual download functionality
                toast.info("Download functionality coming soon!");
            })
            .catch(() => {
                toast.error("Failed to download content");
            });
    };

    const handlePrint = () => {
        if (!shareData?.permissions.allowPrint) {
            toast.error("Printing is not allowed for this shared content");
            return;
        }

        window.print();
    };

    const handleCopy = () => {
        if (!shareData?.permissions.allowCopy) {
            toast.error("Copying is not allowed for this shared content");
            return;
        }

        const fullUrl = `${window.location.origin}/shared/${shareId}?v=${shareData.metadata.version}`;
        navigator.clipboard
            .writeText(fullUrl)
            .then(() => {
                toast.success("Link copied to clipboard!");
            })
            .catch(() => {
                toast.error("Failed to copy link");
            });
    };

    const handleNavigateHome = () => {
        void navigate("/");
    };

    const handleOpenInNewTab = () => {
        window.open("/", "_blank");
    };

    // Loading state
    if (shareData === undefined || validateAccess === undefined) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                <div className="text-center">
                    <LoadingAnimation />
                    <p className="text-purple-300 mt-4">
                        Loading shared content...
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                <div className="max-w-md p-8 bg-red-600/10 border border-red-600/30 rounded-lg text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-red-200 mb-2">
                        Access Error
                    </h2>
                    <p className="text-red-300 mb-4">{error}</p>
                    {!embedMode && (
                        <Button
                            onClick={handleNavigateHome}
                            variant="outline"
                            className="border-red-500/30 text-red-300 hover:bg-red-500/20"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Go Home
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    // Not found state
    if (!shareData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <p className="text-purple-300">Shared content not found</p>
                </div>
            </div>
        );
    }

    // Password protection screen
    if (shareData.permissions.viewerAccess === "private" && !isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                <div className="max-w-md p-8 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                    <div className="text-center mb-6">
                        <Lock className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-purple-100 mb-2">
                            Protected Content
                        </h2>
                        <p className="text-purple-300">
                            This shared content is password protected. Enter the
                            password to continue.
                        </p>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <Input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Enter password..."
                            className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            className="w-full bg-purple-500/30 hover:bg-purple-500/40"
                            disabled={!passwordInput.trim()}
                        >
                            <Shield className="w-4 h-4 mr-2" />
                            Access Content
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    // Main content viewer
    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <p className="text-purple-300">
                        Checking access permissions...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "min-h-screen bg-gradient-to-br from-purple-900/20 to-blue-900/20",
                embedMode && "min-h-0 bg-transparent"
            )}
        >
            {/* Header */}
            {showControls && (
                <div className="border-b border-purple-600/20 bg-purple-600/5 backdrop-blur-sm">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {!embedMode && (
                                    <Button
                                        onClick={handleNavigateHome}
                                        variant="ghost"
                                        size="sm"
                                        className="text-purple-300 hover:text-purple-100"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                )}

                                <div>
                                    <h1 className="text-xl font-semibold text-purple-100">
                                        {shareData.title}
                                    </h1>
                                    <div className="flex items-center gap-4 text-sm text-purple-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(
                                                shareData.createdAt
                                            ).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-3 h-3" />
                                            {shareData.analytics.views} views
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="border-purple-500/30 text-purple-300"
                                        >
                                            {shareData.metadata.timeRange}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {shareData.permissions.allowCopy && (
                                    <Button
                                        onClick={handleCopy}
                                        variant="outline"
                                        size="sm"
                                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                )}

                                {shareData.permissions.allowPrint && (
                                    <Button
                                        onClick={handlePrint}
                                        variant="outline"
                                        size="sm"
                                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </Button>
                                )}

                                {shareData.permissions.allowDownload && (
                                    <Button
                                        onClick={handleDownload}
                                        variant="outline"
                                        size="sm"
                                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                )}

                                {!embedMode && (
                                    <Button
                                        onClick={handleOpenInNewTab}
                                        size="sm"
                                        className="bg-purple-500/30 hover:bg-purple-500/40"
                                    >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Open T3 Chat
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {shareData.description && (
                    <div className="mb-6 p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <p className="text-purple-200">
                            {shareData.description}
                        </p>
                    </div>
                )}

                {/* Render the actual shared content */}
                <ShareContentRenderer
                    content={shareData}
                    permissions={shareData.permissions}
                    embedMode={embedMode}
                />

                {/* Watermark */}
                {shareData.permissions.watermark && (
                    <div className="mt-8 pt-4 border-t border-purple-600/20 text-center">
                        <p className="text-sm text-purple-400">
                            Powered by{" "}
                            <a
                                href="/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-300 hover:text-purple-100 underline"
                            >
                                T3 Chat Analytics
                            </a>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Content Renderer Component
function ShareContentRenderer({
    content,
    permissions,
    embedMode,
}: {
    content: any;
    permissions: any;
    embedMode: boolean;
}) {
    const renderContent = () => {
        switch (content.contentType) {
            case "overview":
                return <OverviewRenderer data={content.data} />;
            case "chart":
                return <ChartRenderer data={content.data} />;
            case "dataset":
                return <DatasetRenderer data={content.data} />;
            case "dashboard":
                return <DashboardRenderer data={content.data} />;
            default:
                return (
                    <div className="text-center py-8">
                        <AlertTriangle className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                        <p className="text-purple-300">
                            Unsupported content type: {content.contentType}
                        </p>
                    </div>
                );
        }
    };

    return (
        <div
            className={cn(
                "space-y-6",
                !permissions.allowCopy && "select-none",
                embedMode && "embedded-content"
            )}
        >
            {renderContent()}
        </div>
    );
}

// Content Type Renderers
function OverviewRenderer({ data }: { data: any }) {
    if (data.overview) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(data.overview).map(([key, value]) => (
                    <div
                        key={key}
                        className="p-6 bg-purple-600/10 border border-purple-600/30 rounded-lg"
                    >
                        <h3 className="text-lg font-semibold text-purple-100 mb-4 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                        </h3>
                        <div className="text-purple-100 font-medium text-2xl">
                            {typeof value === "number"
                                ? value.toLocaleString()
                                : String(value)}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(data).map(([key, value]) => (
                <div
                    key={key}
                    className="p-6 bg-purple-600/10 border border-purple-600/30 rounded-lg"
                >
                    <h3 className="text-lg font-semibold text-purple-100 mb-4 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                    </h3>
                    <div className="space-y-2">
                        {typeof value === "object" && value !== null ? (
                            Object.entries(value as Record<string, any>).map(
                                ([subKey, subValue]) => (
                                    <div
                                        key={subKey}
                                        className="flex justify-between"
                                    >
                                        <span className="text-purple-300 capitalize">
                                            {subKey
                                                .replace(/([A-Z])/g, " $1")
                                                .trim()}
                                            :
                                        </span>
                                        <span className="text-purple-100 font-medium">
                                            {typeof subValue === "number"
                                                ? subValue.toLocaleString()
                                                : String(subValue)}
                                        </span>
                                    </div>
                                )
                            )
                        ) : (
                            <div className="text-purple-100 font-medium text-2xl">
                                {typeof value === "number"
                                    ? value.toLocaleString()
                                    : String(value)}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ChartRenderer({ data }: { data: any }) {
    return (
        <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-100 mb-4">
                Chart: {data.chartType || "Analytics Chart"}
            </h3>

            {data.chartData ? (
                <div className="space-y-4">
                    <div className="text-sm text-purple-300">
                        Data Points: {data.chartData.labels?.length || 0}
                    </div>

                    {/* Simple data visualization */}
                    <div className="space-y-2">
                        {data.chartData.labels
                            ?.slice(0, 10)
                            .map((label: string, index: number) => {
                                const value =
                                    data.chartData.datasets?.[0]?.data?.[
                                        index
                                    ] || 0;
                                const maxValue = Math.max(
                                    ...(data.chartData.datasets?.[0]?.data || [
                                        1,
                                    ])
                                );
                                const percentage = (value / maxValue) * 100;

                                return (
                                    <div
                                        key={label}
                                        className="flex items-center gap-4"
                                    >
                                        <div className="w-20 text-sm text-purple-300">
                                            {label}
                                        </div>
                                        <div className="flex-1 bg-purple-600/20 rounded-full h-4 relative">
                                            <div
                                                className="bg-purple-500/60 h-full rounded-full"
                                                style={{
                                                    width: `${percentage}%`,
                                                }}
                                            />
                                        </div>
                                        <div className="w-12 text-sm text-purple-200 text-right">
                                            {value}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ) : (
                <div className="aspect-video bg-purple-600/5 border border-purple-600/20 rounded flex items-center justify-center">
                    <div className="text-center">
                        <BarChart3 className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                        <p className="text-purple-300">
                            Chart visualization not available
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function DatasetRenderer({ data }: { data: any }) {
    return (
        <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-100 mb-4">
                Dataset: {data.totalRows || 0} rows
            </h3>

            <div className="space-y-4">
                {Array.isArray(data.data) ? (
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-purple-600/20">
                                <tr>
                                    {Object.keys(data.data[0] || {}).map(
                                        (key) => (
                                            <th
                                                key={key}
                                                className="text-left p-2 text-purple-300 font-medium"
                                            >
                                                {key}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {data.data
                                    .slice(0, 20)
                                    .map((row: any, index: number) => (
                                        <tr
                                            key={index}
                                            className="border-b border-purple-600/10"
                                        >
                                            {Object.values(row).map(
                                                (
                                                    value: any,
                                                    cellIndex: number
                                                ) => (
                                                    <td
                                                        key={cellIndex}
                                                        className="p-2 text-purple-200"
                                                    >
                                                        {String(value)}
                                                    </td>
                                                )
                                            )}
                                        </tr>
                                    ))}
                            </tbody>
                        </table>

                        {data.data.length > 20 && (
                            <p className="text-center text-purple-400 mt-4">
                                Showing first 20 of {data.data.length} rows
                            </p>
                        )}
                    </div>
                ) : (
                    <pre className="bg-purple-600/5 border border-purple-600/20 rounded p-4 text-purple-200 text-sm overflow-x-auto">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                )}
            </div>
        </div>
    );
}

function DashboardRenderer({ data }: { data: any }) {
    return (
        <div className="space-y-6">
            {/* Overview Section */}
            {data.overview && (
                <OverviewRenderer data={{ overview: data.overview }} />
            )}

            {/* Charts Section */}
            {data.charts && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-purple-100">
                        Charts
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {data.charts.map((chart: any) => (
                            <ChartRenderer key={chart.id} data={chart} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
