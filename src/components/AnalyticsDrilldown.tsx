import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Eye,
    Share2,
    Download,
    ExternalLink,
    User,
    Cpu,
    Hash,
    MessageSquare,
    Calendar,
    Clock,
    FolderOpen,
} from "lucide-react";
import { cn } from "../lib/utils";

export interface DrilldownData {
    type: "chat" | "project" | "timeframe" | "model" | "user";
    title: string;
    id: string;

    // Common metrics
    messageCount?: number;
    userCount?: number;
    averageResponseTime?: number;
    lastActivity?: string;
    createdAt?: string;

    // Chat-specific data
    chatData?: {
        model: string;
        isStarred: boolean;
        isArchived: boolean;
        totalTokens: number;
        averageMessageLength: number;
        recentMessages: Array<{
            role: "user" | "assistant" | "system";
            content: string;
            timestamp: string;
            tokenCount?: number;
        }>;
        modelDistribution?: Array<{
            model: string;
            usage: number;
            percentage: number;
        }>;
    };

    // Project-specific data
    projectData?: {
        chatCount: number;
        activeChats: number;
        modelsUsed: string[];
        totalTokens: number;
        topChats: Array<{
            id: string;
            title: string;
            messageCount: number;
            lastActivity: string;
        }>;
        modelDistribution: Array<{
            name: string;
            percentage: number;
            usage: number;
        }>;
        activityTimeline: Array<{
            date: string;
            messages: number;
            chats: number;
        }>;
    };

    // Timeframe-specific data
    timeframeData?: {
        period: string;
        peakHour: string;
        mostActiveDay: string;
        averageDaily: number;
        growthRate: number;
        hourlyPattern: Array<{
            hour: number;
            activity: number;
        }>;
        weeklyPattern: Array<{
            day: string;
            activity: number;
        }>;
        trends: Array<{
            metric: string;
            change: number;
            direction: "up" | "down" | "stable";
        }>;
    };

    // Model-specific data
    modelData?: {
        modelName: string;
        totalUsage: number;
        averageResponseTime: number;
        successRate: number;
        topProjects: Array<{
            name: string;
            usage: number;
        }>;
        performanceMetrics: {
            averageTokensPerMessage: number;
            averageLatency: number;
            errorRate: number;
        };
        usageOverTime: Array<{
            date: string;
            usage: number;
        }>;
    };

    // User-specific data
    userData?: {
        totalChats: number;
        totalMessages: number;
        favoriteModels: string[];
        activityScore: number;
        joinDate: string;
        lastSeen: string;
        chatHistory: Array<{
            chatId: string;
            title: string;
            messageCount: number;
            lastActivity: string;
        }>;
    };
}

interface AnalyticsDrilldownProps {
    isOpen: boolean;
    data: DrilldownData | null;
    onClose: () => void;
    onNavigateToChat: (chatId: string) => void;
    onNavigateToProject: (projectId: string) => void;
}

export function AnalyticsDrilldown({
    isOpen,
    data,
    onClose,
    onNavigateToChat,
    onNavigateToProject,
}: AnalyticsDrilldownProps) {
    const [activeTab, setActiveTab] = useState("overview");
    const navigate = useNavigate();

    if (!data) return null;

    // Enhanced navigation handlers with Ctrl+click support
    const handleChatNavigation = (chatId: string, event: React.MouseEvent) => {
        if (event.ctrlKey || event.metaKey) {
            // Open in new tab
            window.open(`/chat/${chatId}`, "_blank");
        } else {
            // Navigate in current tab
            onNavigateToChat(chatId);
        }
    };

    const handleProjectNavigation = (
        projectId: string,
        event: React.MouseEvent
    ) => {
        if (event.ctrlKey || event.metaKey) {
            // Open in new tab
            window.open(`/project/${projectId}`, "_blank");
        } else {
            // Navigate in current tab
            onNavigateToProject(projectId);
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const formatPercentage = (num: number) => {
        const abs = Math.abs(num);
        return `${num >= 0 ? "+" : "-"}${abs.toFixed(1)}%`;
    };

    const renderOverviewTab = () => (
        <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data.messageCount !== undefined && (
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">Messages</div>
                        <div className="text-2xl font-bold text-purple-100">
                            {formatNumber(data.messageCount)}
                        </div>
                    </div>
                )}

                {data.userCount !== undefined && (
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">Users</div>
                        <div className="text-2xl font-bold text-purple-100">
                            {formatNumber(data.userCount)}
                        </div>
                    </div>
                )}

                {data.averageResponseTime !== undefined && (
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Avg Response
                        </div>
                        <div className="text-2xl font-bold text-purple-100">
                            {data.averageResponseTime}ms
                        </div>
                    </div>
                )}

                {data.lastActivity && (
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Last Activity
                        </div>
                        <div className="text-2xl font-bold text-purple-100">
                            {data.lastActivity}
                        </div>
                    </div>
                )}
            </div>

            {/* Type-specific overview content */}
            {data.type === "chat" && data.chatData && renderChatOverview()}
            {data.type === "project" &&
                data.projectData &&
                renderProjectOverview()}
            {data.type === "timeframe" &&
                data.timeframeData &&
                renderTimeframeOverview()}
            {data.type === "model" && data.modelData && renderModelOverview()}
            {data.type === "user" && data.userData && renderUserOverview()}
        </div>
    );

    const renderChatOverview = () => {
        const { chatData } = data;
        if (!chatData) return null;

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-purple-100">
                        Chat Details
                    </h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                            <span className="text-purple-300">Model</span>
                            <Badge className="bg-purple-500/20 text-purple-100">
                                {chatData.model}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                            <span className="text-purple-300">
                                Total Tokens
                            </span>
                            <span className="text-purple-100 font-medium">
                                {formatNumber(chatData.totalTokens)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                            <span className="text-purple-300">
                                Avg Message Length
                            </span>
                            <span className="text-purple-100 font-medium">
                                {chatData.averageMessageLength} chars
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-purple-100">
                        Recent Activity
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {chatData.recentMessages
                            ?.slice(0, 5)
                            .map((message, index) => (
                                <div
                                    key={index}
                                    className="p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            {message.role === "user" && (
                                                <User className="w-3 h-3 text-blue-400" />
                                            )}
                                            {message.role === "assistant" && (
                                                <Cpu className="w-3 h-3 text-green-400" />
                                            )}
                                            {message.role === "system" && (
                                                <Hash className="w-3 h-3 text-purple-400" />
                                            )}
                                            <span className="text-xs text-purple-400 capitalize">
                                                {message.role}
                                            </span>
                                        </div>
                                        <span className="text-xs text-purple-500">
                                            {message.timestamp}
                                        </span>
                                    </div>
                                    <div className="text-sm text-purple-200 truncate">
                                        {message.content.substring(0, 100)}
                                        {message.content.length > 100 && "..."}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderProjectOverview = () => {
        const { projectData } = data;
        if (!projectData) return null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                        <div className="text-sm text-blue-400">Total Chats</div>
                        <div className="text-2xl font-bold text-blue-100">
                            {projectData.chatCount}
                        </div>
                    </div>
                    <div className="p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
                        <div className="text-sm text-green-400">
                            Active Chats
                        </div>
                        <div className="text-2xl font-bold text-green-100">
                            {projectData.activeChats}
                        </div>
                    </div>
                    <div className="p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                        <div className="text-sm text-yellow-400">
                            Models Used
                        </div>
                        <div className="text-2xl font-bold text-yellow-100">
                            {projectData.modelsUsed.length}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-purple-100">
                            Top Chats
                        </h4>
                        <div className="space-y-2">
                            {projectData.topChats?.map((chat, index) => (
                                <div
                                    key={chat.id}
                                    className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded hover:bg-purple-600/10 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-purple-200 font-medium truncate">
                                            {chat.title}
                                        </div>
                                        <div className="text-sm text-purple-400">
                                            {chat.messageCount} messages •{" "}
                                            {chat.lastActivity}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) =>
                                            handleChatNavigation(chat.id, e)
                                        }
                                        className="text-purple-300 hover:text-purple-100"
                                        title="Click to open • Ctrl+Click to open in new tab"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-purple-100">
                            Model Distribution
                        </h4>
                        <div className="space-y-2">
                            {projectData.modelDistribution?.map(
                                (model, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                    >
                                        <div className="text-purple-200">
                                            {model.name}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-purple-400">
                                                {model.percentage}%
                                            </span>
                                            <div className="w-16 bg-purple-600/20 rounded-full h-2">
                                                <div
                                                    className="bg-purple-500/60 h-full rounded-full"
                                                    style={{
                                                        width: `${model.percentage}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTimeframeOverview = () => {
        const { timeframeData } = data;
        if (!timeframeData) return null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">Peak Hour</div>
                        <div className="text-xl font-bold text-purple-100">
                            {timeframeData.peakHour}
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Most Active Day
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {timeframeData.mostActiveDay}
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Daily Average
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {timeframeData.averageDaily}
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Growth Rate
                        </div>
                        <div
                            className={cn(
                                "text-xl font-bold flex items-center gap-1",
                                timeframeData.growthRate >= 0
                                    ? "text-green-400"
                                    : "text-red-400"
                            )}
                        >
                            {timeframeData.growthRate >= 0 ? (
                                <TrendingUp className="w-4 h-4" />
                            ) : (
                                <TrendingDown className="w-4 h-4" />
                            )}
                            {formatPercentage(timeframeData.growthRate)}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-purple-100">
                        Hourly Activity Pattern
                    </h4>
                    <div className="grid grid-cols-12 gap-1">
                        {timeframeData.hourlyPattern?.map((hour, index) => (
                            <div key={index} className="text-center">
                                <div className="text-xs text-purple-400 mb-1">
                                    {index}h
                                </div>
                                <div
                                    className="bg-purple-500/60 rounded mx-auto"
                                    style={{
                                        height: `${Math.max(4, (hour.activity / Math.max(...timeframeData.hourlyPattern.map((h) => h.activity))) * 40)}px`,
                                        width: "12px",
                                    }}
                                    title={`${hour.activity} messages at ${index}:00`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderModelOverview = () => {
        const { modelData } = data;
        if (!modelData) return null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Total Usage
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {formatNumber(modelData.totalUsage)}
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Avg Response Time
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {modelData.averageResponseTime}ms
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Success Rate
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {modelData.successRate}%
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Error Rate
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {modelData.performanceMetrics.errorRate}%
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-purple-100">
                            Top Projects
                        </h4>
                        <div className="space-y-2">
                            {modelData.topProjects?.map((project, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                >
                                    <span className="text-purple-200">
                                        {project.name}
                                    </span>
                                    <span className="text-purple-100 font-medium">
                                        {formatNumber(project.usage)} uses
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-purple-100">
                            Performance Metrics
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                <span className="text-purple-300">
                                    Avg Tokens/Message
                                </span>
                                <span className="text-purple-100 font-medium">
                                    {
                                        modelData.performanceMetrics
                                            .averageTokensPerMessage
                                    }
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                <span className="text-purple-300">
                                    Avg Latency
                                </span>
                                <span className="text-purple-100 font-medium">
                                    {
                                        modelData.performanceMetrics
                                            .averageLatency
                                    }
                                    ms
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderUserOverview = () => {
        const { userData } = data;
        if (!userData) return null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Total Chats
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {userData.totalChats}
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Total Messages
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {formatNumber(userData.totalMessages)}
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Activity Score
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {userData.activityScore}/100
                        </div>
                    </div>
                    <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                        <div className="text-sm text-purple-400">
                            Member Since
                        </div>
                        <div className="text-xl font-bold text-purple-100">
                            {userData.joinDate}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-purple-100">
                            Favorite Models
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {userData.favoriteModels?.map((model, index) => (
                                <Badge
                                    key={index}
                                    variant="outline"
                                    className="border-purple-500/30 text-purple-300"
                                >
                                    {model}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-purple-100">
                            Recent Chats
                        </h4>
                        <div className="space-y-2">
                            {userData.chatHistory
                                ?.slice(0, 5)
                                .map((chat, index) => (
                                    <div
                                        key={chat.chatId}
                                        className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-purple-200 font-medium truncate">
                                                {chat.title}
                                            </div>
                                            <div className="text-sm text-purple-400">
                                                {chat.messageCount} messages •{" "}
                                                {chat.lastActivity}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                onNavigateToChat?.(chat.chatId)
                                            }
                                            className="text-purple-300 hover:text-purple-100"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const getTabsForType = () => {
        const commonTabs = [
            {
                value: "overview",
                label: "Overview",
                icon: <BarChart3 className="w-4 h-4" />,
            },
        ];

        switch (data.type) {
            case "chat":
                return [
                    ...commonTabs,
                    {
                        value: "messages",
                        label: "Messages",
                        icon: <MessageSquare className="w-4 h-4" />,
                    },
                    {
                        value: "analytics",
                        label: "Analytics",
                        icon: <TrendingUp className="w-4 h-4" />,
                    },
                ];
            case "project":
                return [
                    ...commonTabs,
                    {
                        value: "chats",
                        label: "Chats",
                        icon: <MessageSquare className="w-4 h-4" />,
                    },
                    {
                        value: "models",
                        label: "Models",
                        icon: <Cpu className="w-4 h-4" />,
                    },
                    {
                        value: "timeline",
                        label: "Timeline",
                        icon: <Calendar className="w-4 h-4" />,
                    },
                ];
            case "timeframe":
                return [
                    ...commonTabs,
                    {
                        value: "patterns",
                        label: "Patterns",
                        icon: <TrendingUp className="w-4 h-4" />,
                    },
                    {
                        value: "trends",
                        label: "Trends",
                        icon: <BarChart3 className="w-4 h-4" />,
                    },
                ];
            case "model":
                return [
                    ...commonTabs,
                    {
                        value: "performance",
                        label: "Performance",
                        icon: <TrendingUp className="w-4 h-4" />,
                    },
                    {
                        value: "usage",
                        label: "Usage",
                        icon: <BarChart3 className="w-4 h-4" />,
                    },
                ];
            case "user":
                return [
                    ...commonTabs,
                    {
                        value: "activity",
                        label: "Activity",
                        icon: <TrendingUp className="w-4 h-4" />,
                    },
                    {
                        value: "chats",
                        label: "Chats",
                        icon: <MessageSquare className="w-4 h-4" />,
                    },
                ];
            default:
                return commonTabs;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden bg-purple-600/10 backdrop-blur-lg border border-purple-600/30 flex flex-col">
                <DialogHeader className="border-b border-purple-600/20 pb-4">
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Eye className="w-5 h-5 text-purple-400" />
                            <div>
                                <h2 className="text-purple-100 text-xl font-semibold">
                                    {data.title}
                                </h2>
                                <p className="text-purple-300 text-sm capitalize">
                                    {data.type} Analytics
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-purple-600/30 text-purple-300"
                            >
                                <Share2 className="w-4 h-4 mr-1" />
                                Share
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-purple-600/30 text-purple-300"
                            >
                                <Download className="w-4 h-4 mr-1" />
                                Export
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="h-full flex flex-col"
                    >
                        <TabsList
                            className="grid w-full bg-purple-600/20"
                            style={{
                                gridTemplateColumns: `repeat(${getTabsForType().length}, 1fr)`,
                            }}
                        >
                            {getTabsForType().map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="text-purple-200 flex items-center gap-2"
                                >
                                    {tab.icon}
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <div className="flex-1 overflow-y-auto p-6">
                            <TabsContent value="overview" className="mt-0">
                                {renderOverviewTab()}
                            </TabsContent>

                            {/* Additional tabs content would be implemented here */}
                            <TabsContent value="messages" className="mt-0">
                                {data.type === "chat" && data.chatData && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-purple-100">
                                                Message History
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className="border-purple-500/30 text-purple-300"
                                            >
                                                {data.chatData.recentMessages
                                                    ?.length || 0}{" "}
                                                messages
                                            </Badge>
                                        </div>

                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {data.chatData.recentMessages?.map(
                                                (message, index) => (
                                                    <div
                                                        key={index}
                                                        className="p-4 bg-purple-600/5 border border-purple-600/20 rounded-lg"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                {message.role ===
                                                                    "user" && (
                                                                    <User className="w-4 h-4 text-blue-400" />
                                                                )}
                                                                {message.role ===
                                                                    "assistant" && (
                                                                    <Cpu className="w-4 h-4 text-green-400" />
                                                                )}
                                                                {message.role ===
                                                                    "system" && (
                                                                    <Hash className="w-4 h-4 text-purple-400" />
                                                                )}
                                                                <span className="text-sm font-medium text-purple-200 capitalize">
                                                                    {
                                                                        message.role
                                                                    }
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-purple-400">
                                                                <Clock className="w-3 h-3" />
                                                                {
                                                                    message.timestamp
                                                                }
                                                                {message.tokenCount && (
                                                                    <>
                                                                        <span>
                                                                            •
                                                                        </span>
                                                                        <span>
                                                                            {
                                                                                message.tokenCount
                                                                            }{" "}
                                                                            tokens
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-sm text-purple-200 leading-relaxed">
                                                            {message.content}
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="analytics" className="mt-0">
                                {data.type === "chat" && data.chatData && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold text-purple-100">
                                                    Usage Analytics
                                                </h3>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Total Tokens Used
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {formatNumber(
                                                                data.chatData
                                                                    .totalTokens
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Average Message
                                                            Length
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {
                                                                data.chatData
                                                                    .averageMessageLength
                                                            }{" "}
                                                            chars
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Messages Count
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {data.messageCount}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {data.chatData
                                                .modelDistribution && (
                                                <div className="space-y-4">
                                                    <h3 className="text-lg font-semibold text-purple-100">
                                                        Model Distribution
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {data.chatData.modelDistribution.map(
                                                            (model, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                                                >
                                                                    <span className="text-purple-200">
                                                                        {
                                                                            model.model
                                                                        }
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm text-purple-400">
                                                                            {
                                                                                model.percentage
                                                                            }
                                                                            %
                                                                        </span>
                                                                        <div className="w-16 bg-purple-600/20 rounded-full h-2">
                                                                            <div
                                                                                className="bg-purple-500/60 h-full rounded-full"
                                                                                style={{
                                                                                    width: `${model.percentage}%`,
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="chats" className="mt-0">
                                {data.type === "project" &&
                                    data.projectData && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold text-purple-100">
                                                    Project Chats
                                                </h3>
                                                <div className="flex items-center gap-4">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-green-500/30 text-green-300"
                                                    >
                                                        {
                                                            data.projectData
                                                                .activeChats
                                                        }{" "}
                                                        active
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className="border-purple-500/30 text-purple-300"
                                                    >
                                                        {
                                                            data.projectData
                                                                .chatCount
                                                        }{" "}
                                                        total
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
                                                {data.projectData.topChats?.map(
                                                    (chat, index) => (
                                                        <div
                                                            key={chat.id}
                                                            className="flex items-center justify-between p-4 bg-purple-600/5 border border-purple-600/20 rounded-lg hover:bg-purple-600/10 transition-colors"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <MessageSquare className="w-4 h-4 text-purple-400" />
                                                                    <h4 className="text-purple-200 font-medium truncate">
                                                                        {
                                                                            chat.title
                                                                        }
                                                                    </h4>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-sm text-purple-400">
                                                                    <span>
                                                                        {
                                                                            chat.messageCount
                                                                        }{" "}
                                                                        messages
                                                                    </span>
                                                                    <span>
                                                                        •
                                                                    </span>
                                                                    <span>
                                                                        Last
                                                                        active:{" "}
                                                                        {
                                                                            chat.lastActivity
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={(e) =>
                                                                    handleChatNavigation(
                                                                        chat.id,
                                                                        e
                                                                    )
                                                                }
                                                                className="text-purple-300 hover:text-purple-100"
                                                                title="Click to open • Ctrl+Click to open in new tab"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                {data.type === "user" && data.userData && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-purple-100">
                                                User Chat History
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className="border-purple-500/30 text-purple-300"
                                            >
                                                {data.userData.totalChats} chats
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {data.userData.chatHistory?.map(
                                                (chat, index) => (
                                                    <div
                                                        key={chat.chatId}
                                                        className="flex items-center justify-between p-4 bg-purple-600/5 border border-purple-600/20 rounded-lg hover:bg-purple-600/10 transition-colors"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <MessageSquare className="w-4 h-4 text-purple-400" />
                                                                <h4 className="text-purple-200 font-medium truncate">
                                                                    {chat.title}
                                                                </h4>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm text-purple-400">
                                                                <span>
                                                                    {
                                                                        chat.messageCount
                                                                    }{" "}
                                                                    messages
                                                                </span>
                                                                <span>•</span>
                                                                <span>
                                                                    Last active:{" "}
                                                                    {
                                                                        chat.lastActivity
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) =>
                                                                handleChatNavigation(
                                                                    chat.chatId,
                                                                    e
                                                                )
                                                            }
                                                            className="text-purple-300 hover:text-purple-100"
                                                            title="Click to open • Ctrl+Click to open in new tab"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="models" className="mt-0">
                                {data.type === "project" &&
                                    data.projectData && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold text-purple-100">
                                                    Model Usage
                                                </h3>
                                                <Badge
                                                    variant="outline"
                                                    className="border-purple-500/30 text-purple-300"
                                                >
                                                    {
                                                        data.projectData
                                                            .modelsUsed.length
                                                    }{" "}
                                                    models
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <h4 className="text-md font-semibold text-purple-200">
                                                        Distribution
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {data.projectData.modelDistribution?.map(
                                                            (model, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <Cpu className="w-4 h-4 text-purple-400" />
                                                                        <span className="text-purple-200">
                                                                            {
                                                                                model.name
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm text-purple-400">
                                                                            {formatNumber(
                                                                                model.usage
                                                                            )}{" "}
                                                                            uses
                                                                        </span>
                                                                        <span className="text-xs text-purple-500">
                                                                            (
                                                                            {
                                                                                model.percentage
                                                                            }
                                                                            %)
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h4 className="text-md font-semibold text-purple-200">
                                                        Usage Overview
                                                    </h4>
                                                    <div className="p-4 bg-purple-600/5 border border-purple-600/20 rounded-lg">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-purple-300">
                                                                    Total Tokens
                                                                </span>
                                                                <span className="text-purple-100 font-medium">
                                                                    {formatNumber(
                                                                        data
                                                                            .projectData
                                                                            .totalTokens
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-purple-300">
                                                                    Most Used
                                                                    Model
                                                                </span>
                                                                <span className="text-purple-100 font-medium">
                                                                    {data
                                                                        .projectData
                                                                        .modelDistribution?.[0]
                                                                        ?.name ||
                                                                        "N/A"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                            </TabsContent>

                            <TabsContent value="timeline" className="mt-0">
                                {data.type === "project" &&
                                    data.projectData && (
                                        <div className="space-y-6">
                                            <h3 className="text-lg font-semibold text-purple-100">
                                                Activity Timeline
                                            </h3>

                                            <div className="space-y-3">
                                                {data.projectData.activityTimeline?.map(
                                                    (activity, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center gap-4 p-3 bg-purple-600/5 border border-purple-600/20 rounded-lg"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <Calendar className="w-4 h-4 text-purple-400" />
                                                                <span className="text-purple-200">
                                                                    {
                                                                        activity.date
                                                                    }
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm">
                                                                <div className="flex items-center gap-1">
                                                                    <MessageSquare className="w-3 h-3 text-blue-400" />
                                                                    <span className="text-purple-300">
                                                                        {
                                                                            activity.messages
                                                                        }{" "}
                                                                        messages
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Hash className="w-3 h-3 text-green-400" />
                                                                    <span className="text-purple-300">
                                                                        {
                                                                            activity.chats
                                                                        }{" "}
                                                                        chats
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </TabsContent>

                            <TabsContent value="patterns" className="mt-0">
                                {data.type === "timeframe" &&
                                    data.timeframeData && (
                                        <div className="space-y-6">
                                            <h3 className="text-lg font-semibold text-purple-100">
                                                Usage Patterns
                                            </h3>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <h4 className="text-md font-semibold text-purple-200">
                                                        Daily Pattern
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {data.timeframeData.weeklyPattern?.map(
                                                            (day, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                                                >
                                                                    <span className="text-purple-200">
                                                                        {
                                                                            day.day
                                                                        }
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-purple-100 font-medium">
                                                                            {
                                                                                day.activity
                                                                            }
                                                                        </span>
                                                                        <div className="w-16 bg-purple-600/20 rounded-full h-2">
                                                                            <div
                                                                                className="bg-purple-500/60 h-full rounded-full"
                                                                                style={{
                                                                                    width: `${Math.max(...data.timeframeData.weeklyPattern.map((d) => d.activity)) === day.activity ? 100 : (day.activity / Math.max(...data.timeframeData.weeklyPattern.map((d) => d.activity))) * 100}%`,
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h4 className="text-md font-semibold text-purple-200">
                                                        Peak Times
                                                    </h4>
                                                    <div className="space-y-3">
                                                        <div className="p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                            <div className="text-sm text-purple-300 mb-1">
                                                                Most Active Hour
                                                            </div>
                                                            <div className="text-lg font-semibold text-purple-100">
                                                                {
                                                                    data
                                                                        .timeframeData
                                                                        .peakHour
                                                                }
                                                            </div>
                                                        </div>
                                                        <div className="p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                            <div className="text-sm text-purple-300 mb-1">
                                                                Most Active Day
                                                            </div>
                                                            <div className="text-lg font-semibold text-purple-100">
                                                                {
                                                                    data
                                                                        .timeframeData
                                                                        .mostActiveDay
                                                                }
                                                            </div>
                                                        </div>
                                                        <div className="p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                            <div className="text-sm text-purple-300 mb-1">
                                                                Daily Average
                                                            </div>
                                                            <div className="text-lg font-semibold text-purple-100">
                                                                {
                                                                    data
                                                                        .timeframeData
                                                                        .averageDaily
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                            </TabsContent>

                            <TabsContent value="trends" className="mt-0">
                                {data.type === "timeframe" &&
                                    data.timeframeData && (
                                        <div className="space-y-6">
                                            <h3 className="text-lg font-semibold text-purple-100">
                                                Trend Analysis
                                            </h3>

                                            <div className="grid grid-cols-1 gap-4">
                                                {data.timeframeData.trends?.map(
                                                    (trend, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center justify-between p-4 bg-purple-600/5 border border-purple-600/20 rounded-lg"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <BarChart3 className="w-5 h-5 text-purple-400" />
                                                                <span className="text-purple-200 font-medium">
                                                                    {
                                                                        trend.metric
                                                                    }
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className={cn(
                                                                        "flex items-center gap-1 px-2 py-1 rounded",
                                                                        trend.direction ===
                                                                            "up" &&
                                                                            "bg-green-500/20 text-green-300",
                                                                        trend.direction ===
                                                                            "down" &&
                                                                            "bg-red-500/20 text-red-300",
                                                                        trend.direction ===
                                                                            "stable" &&
                                                                            "bg-gray-500/20 text-gray-300"
                                                                    )}
                                                                >
                                                                    {trend.direction ===
                                                                        "up" && (
                                                                        <TrendingUp className="w-3 h-3" />
                                                                    )}
                                                                    {trend.direction ===
                                                                        "down" && (
                                                                        <TrendingDown className="w-3 h-3" />
                                                                    )}
                                                                    {trend.direction ===
                                                                        "stable" && (
                                                                        <ArrowRight className="w-3 h-3" />
                                                                    )}
                                                                    <span className="text-sm font-medium">
                                                                        {formatPercentage(
                                                                            trend.change
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </TabsContent>

                            <TabsContent value="performance" className="mt-0">
                                {data.type === "model" && data.modelData && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-purple-100">
                                            Performance Metrics
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h4 className="text-md font-semibold text-purple-200">
                                                    Response Times
                                                </h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Average Response
                                                            Time
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {
                                                                data.modelData
                                                                    .averageResponseTime
                                                            }
                                                            ms
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Average Latency
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {
                                                                data.modelData
                                                                    .performanceMetrics
                                                                    .averageLatency
                                                            }
                                                            ms
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-md font-semibold text-purple-200">
                                                    Quality Metrics
                                                </h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Success Rate
                                                        </span>
                                                        <span className="text-green-400 font-medium">
                                                            {
                                                                data.modelData
                                                                    .successRate
                                                            }
                                                            %
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Error Rate
                                                        </span>
                                                        <span className="text-red-400 font-medium">
                                                            {
                                                                data.modelData
                                                                    .performanceMetrics
                                                                    .errorRate
                                                            }
                                                            %
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Avg Tokens/Message
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {
                                                                data.modelData
                                                                    .performanceMetrics
                                                                    .averageTokensPerMessage
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="usage" className="mt-0">
                                {data.type === "model" && data.modelData && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-purple-100">
                                            Usage Analytics
                                        </h3>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h4 className="text-md font-semibold text-purple-200">
                                                    Top Projects
                                                </h4>
                                                <div className="space-y-3">
                                                    {data.modelData.topProjects?.map(
                                                        (project, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded hover:bg-purple-600/10 transition-colors"
                                                            >
                                                                <span className="text-purple-200">
                                                                    {
                                                                        project.name
                                                                    }
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-purple-100 font-medium">
                                                                        {formatNumber(
                                                                            project.usage
                                                                        )}{" "}
                                                                        uses
                                                                    </span>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={(
                                                                            e
                                                                        ) =>
                                                                            handleProjectNavigation(
                                                                                project.name,
                                                                                e
                                                                            )
                                                                        }
                                                                        className="text-purple-300 hover:text-purple-100"
                                                                        title="Click to open project • Ctrl+Click to open in new tab"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-md font-semibold text-purple-200">
                                                    Usage Timeline
                                                </h4>
                                                <div className="space-y-2">
                                                    {data.modelData.usageOverTime
                                                        ?.slice(0, 7)
                                                        .map((usage, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded"
                                                            >
                                                                <span className="text-purple-300">
                                                                    {usage.date}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-purple-100 font-medium">
                                                                        {formatNumber(
                                                                            usage.usage
                                                                        )}
                                                                    </span>
                                                                    <div className="w-12 bg-purple-600/20 rounded-full h-2">
                                                                        <div
                                                                            className="bg-purple-500/60 h-full rounded-full"
                                                                            style={{
                                                                                width: `${Math.max(...data.modelData.usageOverTime.map((u) => u.usage)) === usage.usage ? 100 : (usage.usage / Math.max(...data.modelData.usageOverTime.map((u) => u.usage))) * 100}%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="activity" className="mt-0">
                                {data.type === "user" && data.userData && (
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-semibold text-purple-100">
                                            Activity Overview
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h4 className="text-md font-semibold text-purple-200">
                                                    Statistics
                                                </h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Activity Score
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-20 bg-purple-600/20 rounded-full h-2">
                                                                <div
                                                                    className="bg-purple-500/60 h-full rounded-full"
                                                                    style={{
                                                                        width: `${data.userData.activityScore}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-purple-100 font-medium">
                                                                {
                                                                    data
                                                                        .userData
                                                                        .activityScore
                                                                }
                                                                /100
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Total Messages
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {formatNumber(
                                                                data.userData
                                                                    .totalMessages
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <span className="text-purple-300">
                                                            Total Chats
                                                        </span>
                                                        <span className="text-purple-100 font-medium">
                                                            {
                                                                data.userData
                                                                    .totalChats
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-md font-semibold text-purple-200">
                                                    Timeline
                                                </h4>
                                                <div className="space-y-3">
                                                    <div className="p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <div className="text-sm text-purple-300 mb-1">
                                                            Member Since
                                                        </div>
                                                        <div className="text-lg font-semibold text-purple-100">
                                                            {
                                                                data.userData
                                                                    .joinDate
                                                            }
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-purple-600/5 border border-purple-600/20 rounded">
                                                        <div className="text-sm text-purple-300 mb-1">
                                                            Last Seen
                                                        </div>
                                                        <div className="text-lg font-semibold text-purple-100">
                                                            {
                                                                data.userData
                                                                    .lastSeen
                                                            }
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <h5 className="text-sm font-medium text-purple-300">
                                                        Favorite Models
                                                    </h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {data.userData.favoriteModels?.map(
                                                            (model, index) => (
                                                                <Badge
                                                                    key={index}
                                                                    variant="outline"
                                                                    className="border-purple-500/30 text-purple-300"
                                                                >
                                                                    <Cpu className="w-3 h-3 mr-1" />
                                                                    {model}
                                                                </Badge>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
