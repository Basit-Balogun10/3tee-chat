import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
    BarChart3,
    TrendingUp,
    Activity,
    MessageSquare,
    Users,
    FolderOpen,
    Clock,
    Zap,
    ArrowLeft,
    Calendar,
    Download,
    Share2,
    Eye,
    Target,
    Gauge,
    PieChart,
    LineChart,
    BarChart,
    Brain,
    Cpu,
    Globe,
    Star,
    Archive,
    Shield,
    Timer,
    Hash,
    FileText,
    Image,
    Video,
    Music,
    Code,
    Sparkles,
    Crown,
    Filter,
    RefreshCw,
} from "lucide-react";
import { cn } from "../lib/utils";

interface AnalyticsDashboardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBackToSettings: () => void;
}

// Time range presets
const TIME_RANGES = [
    { label: "7D", days: 7, granularity: "day" as const },
    { label: "30D", days: 30, granularity: "day" as const },
    { label: "90D", days: 90, granularity: "week" as const },
    { label: "1Y", days: 365, granularity: "month" as const },
];

const CUSTOM_RANGES = [
    { label: "Today", days: 1, granularity: "hour" as const },
    { label: "This Week", days: 7, granularity: "day" as const },
    { label: "This Month", days: 30, granularity: "day" as const },
    { label: "This Quarter", days: 90, granularity: "week" as const },
    { label: "This Year", days: 365, granularity: "month" as const },
];

export function AnalyticsDashboard({ open, onOpenChange, onBackToSettings }: AnalyticsDashboardProps) {
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedTimeRange, setSelectedTimeRange] = useState(TIME_RANGES[1]); // Default to 30D
    const [isLoading, setIsLoading] = useState(false);

    // Calculate time range
    const timeRange = useMemo(() => {
        const end = Date.now();
        const start = end - (selectedTimeRange.days * 24 * 60 * 60 * 1000);
        return {
            start,
            end,
            granularity: selectedTimeRange.granularity,
        };
    }, [selectedTimeRange]);

    // Analytics data queries
    const analytics = useQuery(api.analytics.getAnalytics, { timeRange });
    const overview = useQuery(api.analytics.getAnalyticsOverview);

    // Loading state
    useEffect(() => {
        setIsLoading(!analytics);
    }, [analytics]);

    const handleExport = async () => {
        // TODO: Implement export functionality
        console.log("Export analytics data");
    };

    const handleShare = async () => {
        // TODO: Implement share functionality
        console.log("Share analytics dashboard");
    };

    if (!analytics || !overview) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-7xl max-h-[95vh] bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 overflow-hidden">
                    <div className="flex items-center justify-center h-96">
                        <div className="flex flex-col items-center gap-4">
                            <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
                            <p className="text-purple-300">Loading analytics...</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[95vh] bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 overflow-hidden flex flex-col p-0">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-purple-600/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onBackToSettings}
                                className="text-purple-300 hover:text-purple-100 hover:bg-purple-500/20 p-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-6 h-6 text-purple-400" />
                                <DialogTitle className="text-xl font-semibold text-purple-100">
                                    Analytics & Insights
                                </DialogTitle>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Time Range Selector */}
                            <div className="flex items-center gap-1 bg-purple-500/10 rounded-lg p-1">
                                {TIME_RANGES.map((range) => (
                                    <Button
                                        key={range.label}
                                        variant={selectedTimeRange.label === range.label ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => setSelectedTimeRange(range)}
                                        className={cn(
                                            "px-3 py-1 text-xs transition-all",
                                            selectedTimeRange.label === range.label
                                                ? "bg-purple-500/30 text-purple-100"
                                                : "text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                                        )}
                                    >
                                        {range.label}
                                    </Button>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleShare}
                                className="text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                Share
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleExport}
                                className="text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </div>
                    </div>

                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-4">
                        <StatCard
                            icon={<MessageSquare className="w-4 h-4" />}
                            label="Total Chats"
                            value={overview.totalChats.toLocaleString()}
                            change={analytics.overview.totalChats}
                            trend="up"
                        />
                        <StatCard
                            icon={<Hash className="w-4 h-4" />}
                            label="Messages"
                            value={overview.totalMessages.toLocaleString()}
                            change={analytics.overview.totalMessages}
                            trend="up"
                        />
                        <StatCard
                            icon={<FolderOpen className="w-4 h-4" />}
                            label="Projects"
                            value={overview.totalProjects.toLocaleString()}
                            change={analytics.overview.totalProjects}
                            trend="neutral"
                        />
                        <StatCard
                            icon={<FileText className="w-4 h-4" />}
                            label="Library Items"
                            value={overview.totalLibraryItems.toLocaleString()}
                            change={analytics.overview.totalAttachments + analytics.overview.totalArtifacts + analytics.overview.totalMedia}
                            trend="up"
                        />
                        <StatCard
                            icon={<TrendingUp className="w-4 h-4" />}
                            label="This Week"
                            value={overview.thisWeekChats.toLocaleString()}
                            subtitle="new chats"
                            trend="up"
                        />
                        <StatCard
                            icon={<Cpu className="w-4 h-4" />}
                            label="Top Model"
                            value={overview.mostUsedModel.split('-')[0]}
                            subtitle={overview.mostUsedModel.includes('-') ? overview.mostUsedModel.split('-').slice(1).join('-') : ''}
                            trend="neutral"
                        />
                        <StatCard
                            icon={<Zap className="w-4 h-4" />}
                            label="Avg Response"
                            value={`${overview.averageResponseTime}s`}
                            subtitle="response time"
                            trend="down"
                        />
                        <StatCard
                            icon={<Activity className="w-4 h-4" />}
                            label="Peak Hour"
                            value={`${analytics.overview.mostActiveHour}:00`}
                            subtitle={analytics.overview.mostActiveDay.slice(0, 3)}
                            trend="neutral"
                        />
                    </div>
                </DialogHeader>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                        <TabsList className="mx-6 mt-4 grid w-fit grid-cols-6 bg-purple-500/10">
                            <TabsTrigger value="overview" className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="chats" className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Chats
                            </TabsTrigger>
                            <TabsTrigger value="messages" className="flex items-center gap-2">
                                <Hash className="w-4 h-4" />
                                Messages
                            </TabsTrigger>
                            <TabsTrigger value="projects" className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4" />
                                Projects
                            </TabsTrigger>
                            <TabsTrigger value="library" className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Library
                            </TabsTrigger>
                            <TabsTrigger value="time" className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Activity
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <TabsContent value="overview" className="mt-0 space-y-6">
                                <OverviewTab analytics={analytics} />
                            </TabsContent>

                            <TabsContent value="chats" className="mt-0 space-y-6">
                                <ChatsTab analytics={analytics} />
                            </TabsContent>

                            <TabsContent value="messages" className="mt-0 space-y-6">
                                <MessagesTab analytics={analytics} />
                            </TabsContent>

                            <TabsContent value="projects" className="mt-0 space-y-6">
                                <ProjectsTab analytics={analytics} />
                            </TabsContent>

                            <TabsContent value="library" className="mt-0 space-y-6">
                                <LibraryTab analytics={analytics} />
                            </TabsContent>

                            <TabsContent value="time" className="mt-0 space-y-6">
                                <TimeTab analytics={analytics} />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Stat Card Component
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtitle?: string;
    change?: number;
    trend?: "up" | "down" | "neutral";
}

function StatCard({ icon, label, value, subtitle, change, trend = "neutral" }: StatCardProps) {
    const trendColors = {
        up: "text-green-400",
        down: "text-red-400",
        neutral: "text-purple-400",
    };

    const trendIcons = {
        up: <TrendingUp className="w-3 h-3" />,
        down: <TrendingUp className="w-3 h-3 rotate-180" />,
        neutral: <Activity className="w-3 h-3" />,
    };

    return (
        <div className="bg-purple-500/10 backdrop-blur-sm border border-purple-600/20 rounded-xl p-3 hover:bg-purple-500/15 transition-all">
            <div className="flex items-center justify-between mb-2">
                <div className="text-purple-300">{icon}</div>
                <div className={cn("flex items-center gap-1", trendColors[trend])}>
                    {trendIcons[trend]}
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-xs text-purple-400 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-semibold text-purple-100">{value}</p>
                {subtitle && (
                    <p className="text-xs text-purple-300">{subtitle}</p>
                )}
            </div>
        </div>
    );
}

// Tab Components (placeholders for now - will implement detailed visualizations)
function OverviewTab({ analytics }: { analytics: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsCard
                title="Usage Overview"
                subtitle="Your T3 Chat activity summary"
                icon={<BarChart3 className="w-5 h-5" />}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                            <p className="text-2xl font-bold text-purple-100">{analytics.overview.totalChats}</p>
                            <p className="text-sm text-purple-300">Total Chats</p>
                        </div>
                        <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                            <p className="text-2xl font-bold text-purple-100">{analytics.overview.totalMessages}</p>
                            <p className="text-sm text-purple-300">Total Messages</p>
                        </div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg">
                        <p className="text-lg font-semibold text-purple-100">{analytics.overview.averageMessagesPerChat}</p>
                        <p className="text-sm text-purple-300">Average Messages per Chat</p>
                    </div>
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Peak Activity"
                subtitle="When you're most active"
                icon={<Activity className="w-5 h-5" />}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-purple-500/10 rounded-lg">
                        <div>
                            <p className="text-lg font-semibold text-purple-100">{analytics.overview.mostActiveDay}</p>
                            <p className="text-sm text-purple-300">Most Active Day</p>
                        </div>
                        <Calendar className="w-8 h-8 text-purple-400" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-purple-500/10 rounded-lg">
                        <div>
                            <p className="text-lg font-semibold text-purple-100">{analytics.overview.mostActiveHour}:00</p>
                            <p className="text-sm text-purple-300">Peak Hour</p>
                        </div>
                        <Clock className="w-8 h-8 text-purple-400" />
                    </div>
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Content Creation"
                subtitle="Your creative output"
                icon={<Sparkles className="w-5 h-5" />}
                className="lg:col-span-2"
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                        <p className="text-xl font-bold text-blue-100">{analytics.overview.totalProjects}</p>
                        <p className="text-sm text-blue-300">Projects</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg">
                        <p className="text-xl font-bold text-green-100">{analytics.overview.totalAttachments}</p>
                        <p className="text-sm text-green-300">Attachments</p>
                    </div>
                    <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                        <p className="text-xl font-bold text-orange-100">{analytics.overview.totalArtifacts}</p>
                        <p className="text-sm text-orange-300">Artifacts</p>
                    </div>
                    <div className="text-center p-4 bg-pink-500/10 rounded-lg">
                        <p className="text-xl font-bold text-pink-100">{analytics.overview.totalMedia}</p>
                        <p className="text-sm text-pink-300">Media</p>
                    </div>
                </div>
            </AnalyticsCard>
        </div>
    );
}

function ChatsTab({ analytics }: { analytics: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsCard
                title="Chat Distribution"
                subtitle="Types of chats you create"
                icon={<PieChart className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    <ChatTypeRow icon={<MessageSquare />} label="Regular Chats" count={analytics.chatAnalytics.totalChats - analytics.chatAnalytics.temporaryChats} />
                    <ChatTypeRow icon={<Timer />} label="Temporary" count={analytics.chatAnalytics.temporaryChats} />
                    <ChatTypeRow icon={<Star />} label="Starred" count={analytics.chatAnalytics.starredChats} />
                    <ChatTypeRow icon={<Archive />} label="Archived" count={analytics.chatAnalytics.archivedChats} />
                    <ChatTypeRow icon={<Shield />} label="Protected" count={analytics.chatAnalytics.passwordProtectedChats} />
                    <ChatTypeRow icon={<Globe />} label="Shared" count={analytics.chatAnalytics.sharedChats} />
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Model Usage"
                subtitle="Your AI model preferences"
                icon={<Brain className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    {analytics.chatAnalytics.chatsByModel.slice(0, 5).map((model: any, index: number) => (
                        <div key={model.model} className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-3 h-3 rounded-full",
                                    index === 0 ? "bg-yellow-400" : 
                                    index === 1 ? "bg-purple-400" : 
                                    index === 2 ? "bg-blue-400" : "bg-gray-400"
                                )} />
                                <span className="text-purple-100 text-sm font-medium">{model.model}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-purple-100 font-semibold">{model.count}</p>
                                <p className="text-purple-300 text-xs">{model.percentage}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            </AnalyticsCard>
        </div>
    );
}

function MessagesTab({ analytics }: { analytics: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsCard
                title="Message Statistics"
                subtitle="Your conversation patterns"
                icon={<Hash className="w-5 h-5" />}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                            <p className="text-xl font-bold text-blue-100">{analytics.messageAnalytics.userMessages}</p>
                            <p className="text-sm text-blue-300">Your Messages</p>
                        </div>
                        <div className="text-center p-4 bg-green-500/10 rounded-lg">
                            <p className="text-xl font-bold text-green-100">{analytics.messageAnalytics.assistantMessages}</p>
                            <p className="text-sm text-green-300">AI Responses</p>
                        </div>
                    </div>
                    <div className="p-4 bg-purple-500/10 rounded-lg">
                        <p className="text-lg font-semibold text-purple-100">{analytics.messageAnalytics.averageMessageLength}</p>
                        <p className="text-sm text-purple-300">Average Message Length (characters)</p>
                    </div>
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Response Time Analytics"
                subtitle="AI response performance"
                icon={<Zap className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                        <span className="text-green-300 text-sm">Average Response</span>
                        <span className="text-green-100 font-semibold">{analytics.messageAnalytics.responseTimeAnalytics.averageResponseTime}s</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                        <span className="text-blue-300 text-sm">Fastest Response</span>
                        <span className="text-blue-100 font-semibold">{analytics.messageAnalytics.responseTimeAnalytics.fastestResponse}s</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                        <span className="text-orange-300 text-sm">Slowest Response</span>
                        <span className="text-orange-100 font-semibold">{analytics.messageAnalytics.responseTimeAnalytics.slowestResponse}s</span>
                    </div>
                </div>
            </AnalyticsCard>
        </div>
    );
}

function ProjectsTab({ analytics }: { analytics: any }) {
    const { projectAnalytics } = analytics;
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsCard
                title="Project Overview"
                subtitle="Your project organization"
                icon={<FolderOpen className="w-5 h-5" />}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                            <p className="text-2xl font-bold text-purple-100">{projectAnalytics.totalProjects}</p>
                            <p className="text-sm text-purple-300">Total Projects</p>
                        </div>
                        <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                            <p className="text-2xl font-bold text-blue-100">{projectAnalytics.averageChatsPerProject}</p>
                            <p className="text-sm text-blue-300">Avg Chats/Project</p>
                        </div>
                    </div>
                    {projectAnalytics.mostActiveProject && (
                        <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Crown className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-medium text-yellow-100">Most Active Project</span>
                            </div>
                            <p className="text-lg font-semibold text-orange-100">{projectAnalytics.mostActiveProject.name}</p>
                            <p className="text-sm text-orange-300">{projectAnalytics.mostActiveProject.chatCount} chats • {projectAnalytics.mostActiveProject.messageCount} messages</p>
                        </div>
                    )}
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Project Distribution"
                subtitle="Activity across projects"
                icon={<BarChart className="w-5 h-5" />}
            >
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {projectAnalytics.projectDistribution.slice(0, 10).map((project: any, index: number) => (
                        <div key={project.projectName} className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-purple-400" />
                                <span className="text-purple-100 text-sm font-medium truncate">{project.projectName}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-purple-100 text-sm font-semibold">{project.chatCount}</p>
                                <p className="text-purple-300 text-xs">{project.messageCount} msg</p>
                            </div>
                        </div>
                    ))}
                </div>
            </AnalyticsCard>
        </div>
    );
}

function LibraryTab({ analytics }: { analytics: any }) {
    const { libraryAnalytics } = analytics;
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnalyticsCard
                title="Attachments"
                subtitle="File uploads and management"
                icon={<FileText className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                        <span className="text-blue-300 text-sm">Total Files</span>
                        <span className="text-blue-100 font-semibold">{libraryAnalytics.attachments.total}</span>
                    </div>
                    <div className="space-y-2">
                        <LibraryTypeRow icon={<Image />} label="Images" count={libraryAnalytics.attachments.byType.image} />
                        <LibraryTypeRow icon={<FileText />} label="PDFs" count={libraryAnalytics.attachments.byType.pdf} />
                        <LibraryTypeRow icon={<Music />} label="Audio" count={libraryAnalytics.attachments.byType.audio} />
                        <LibraryTypeRow icon={<Video />} label="Video" count={libraryAnalytics.attachments.byType.video} />
                    </div>
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Artifacts"
                subtitle="Generated code and content"
                icon={<Code className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                        <span className="text-green-300 text-sm">Total Artifacts</span>
                        <span className="text-green-100 font-semibold">{libraryAnalytics.artifacts.total}</span>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {libraryAnalytics.artifacts.byLanguage.map((lang: any) => (
                            <div key={lang.language} className="flex items-center justify-between p-2 bg-purple-500/10 rounded">
                                <span className="text-purple-300 text-sm capitalize">{lang.language}</span>
                                <span className="text-purple-100 font-medium">{lang.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Media Library"
                subtitle="Generated and stored media"
                icon={<Image className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-pink-500/10 rounded-lg">
                        <span className="text-pink-300 text-sm">Total Media</span>
                        <span className="text-pink-100 font-semibold">{libraryAnalytics.media.total}</span>
                    </div>
                    <div className="space-y-2">
                        <LibraryTypeRow icon={<Image />} label="Images" count={libraryAnalytics.media.byType.image} />
                        <LibraryTypeRow icon={<Video />} label="Videos" count={libraryAnalytics.media.byType.video} />
                        <LibraryTypeRow icon={<Music />} label="Audio" count={libraryAnalytics.media.byType.audio} />
                    </div>
                    <div className="p-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg">
                        <p className="text-sm text-purple-300">AI Generated</p>
                        <p className="text-lg font-semibold text-purple-100">{libraryAnalytics.media.generatedContent}</p>
                    </div>
                </div>
            </AnalyticsCard>
        </div>
    );
}

function TimeTab({ analytics }: { analytics: any }) {
    const { timeAnalytics } = analytics;
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsCard
                title="Activity by Hour"
                subtitle="When you're most active"
                icon={<Clock className="w-5 h-5" />}
            >
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {timeAnalytics.activityByHour.map((hour: any) => (
                        <div key={hour.hour} className="flex items-center justify-between p-2 bg-purple-500/10 rounded">
                            <span className="text-purple-300 text-sm">{hour.hour}:00</span>
                            <div className="flex items-center gap-2">
                                <div className="w-16 bg-purple-800/30 rounded-full h-2">
                                    <div 
                                        className="bg-purple-400 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min((hour.activity / Math.max(...timeAnalytics.activityByHour.map((h: any) => h.activity))) * 100, 100)}%` }}
                                    />
                                </div>
                                <span className="text-purple-100 font-medium text-sm w-8">{hour.activity}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </AnalyticsCard>

            <AnalyticsCard
                title="Activity by Day"
                subtitle="Weekly patterns"
                icon={<Calendar className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    {timeAnalytics.activityByDay.map((day: any) => (
                        <div key={day.day} className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
                            <span className="text-purple-300 text-sm font-medium">{day.day}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-20 bg-purple-800/30 rounded-full h-2">
                                    <div 
                                        className="bg-purple-400 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min((day.activity / Math.max(...timeAnalytics.activityByDay.map((d: any) => d.activity))) * 100, 100)}%` }}
                                    />
                                </div>
                                <span className="text-purple-100 font-semibold w-8">{day.activity}</span>
                            </div>
                        </div>
                    ))}
                    <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg">
                        <p className="text-sm text-blue-300">Peak Activity</p>
                        <p className="text-lg font-semibold text-blue-100">{timeAnalytics.peakActivityDay} at {timeAnalytics.peakActivityHour}:00</p>
                    </div>
                </div>
            </AnalyticsCard>
        </div>
    );
}

// Helper Components
interface AnalyticsCardProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

function AnalyticsCard({ title, subtitle, icon, children, className }: AnalyticsCardProps) {
    return (
        <div className={cn("bg-purple-500/10 backdrop-blur-sm border border-purple-600/20 rounded-xl p-4 hover:bg-purple-500/15 transition-all", className)}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-300">
                    {icon}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-purple-100">{title}</h3>
                    {subtitle && <p className="text-sm text-purple-300">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

function ChatTypeRow({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
    return (
        <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
            <div className="flex items-center gap-3">
                <div className="text-purple-300">{icon}</div>
                <span className="text-purple-100 text-sm">{label}</span>
            </div>
            <span className="text-purple-100 font-semibold">{count}</span>
        </div>
    );
}

function LibraryTypeRow({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
    return (
        <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded">
            <div className="flex items-center gap-2">
                <div className="text-purple-400 scale-75">{icon}</div>
                <span className="text-purple-300 text-sm">{label}</span>
            </div>
            <span className="text-purple-100 font-medium">{count}</span>
        </div>
    );
}