import React, { useState, useMemo, useEffect, useRef } from "react";
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
    FolderOpen,
    Clock,
    Zap,
    ArrowLeft,
    Download,
    Share2,
    Eye,
    BarChart,
    Brain,
    Cpu,
    Star,
    Archive,
    Timer,
    Hash,
    FileText,
    Image,
    Code,
    Crown,
    RefreshCw,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
    ActivityHeatmap,
    MessageTrendChart,
    ModelUsagePieChart,
    ChatCreationTrendChart,
    ResponseTimeChart,
    HourlyActivityChart,
    ProjectDistributionChart,
    AnimatedCounter,
    LibraryTypeChart,
} from "./AnalyticsCharts";
import {
    AnalyticsPDFExporter,
    AnalyticsCSVExporter,
    AnalyticsJSONExporter,
    AnalyticsPNGExporter,
    type ExportOptions,
    type AnalyticsExportData,
} from "./AnalyticsExportServices";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
    AnalyticsSearchFilter,
    type AnalyticsFilter,
} from "./AnalyticsSearchFilter";
import { AnalyticsDrilldown } from "./AnalyticsDrilldown";
import { CustomDatePicker, type DateRange } from "./CustomDatePicker";
import { GranularShareModal } from "./GranularShareModal";

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
    { label: "6M", days: 180, granularity: "week" as const },
    { label: "1Y", days: 365, granularity: "month" as const },
];

// Export Options Modal Component
function ExportOptionsModal({
    open,
    onOpenChange,
    onExport,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onExport: (options: ExportOptions) => void;
}) {
    const [exportOptions, setExportOptions] = useState<ExportOptions>({
        format: "pdf",
        includeCharts: true,
        includeData: true,
        timeRange: "30D",
        quality: "medium",
    });

    const handleExport = () => {
        onExport(exportOptions);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-purple-400" />
                        Export Analytics
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Export Format */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-purple-200">
                            Export Format
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: "pdf", label: "PDF Report", icon: "📄" },
                                { id: "csv", label: "CSV Data", icon: "📊" },
                                { id: "json", label: "JSON Data", icon: "📋" },
                                { id: "png", label: "PNG Image", icon: "🖼️" },
                            ].map((format) => (
                                <button
                                    key={format.id}
                                    onClick={() =>
                                        setExportOptions((prev) => ({
                                            ...prev,
                                            format: format.id as any,
                                        }))
                                    }
                                    className={cn(
                                        "p-3 rounded-lg border text-left transition-all",
                                        exportOptions.format === format.id
                                            ? "bg-purple-500/30 border-purple-500/50 text-purple-100"
                                            : "bg-purple-500/10 border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{format.icon}</span>
                                        <span className="text-sm font-medium">
                                            {format.label}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Include Options */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-purple-200">
                            Include
                        </label>

                        <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded border border-purple-500/30">
                            <span className="text-sm text-purple-200">
                                Charts & Visualizations
                            </span>
                            <input
                                type="checkbox"
                                checked={exportOptions.includeCharts}
                                onChange={(e) =>
                                    setExportOptions((prev) => ({
                                        ...prev,
                                        includeCharts: e.target.checked,
                                    }))
                                }
                                className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                            />
                        </div>

                        <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded border border-purple-500/30">
                            <span className="text-sm text-purple-200">
                                Raw Data Tables
                            </span>
                            <input
                                type="checkbox"
                                checked={exportOptions.includeData}
                                onChange={(e) =>
                                    setExportOptions((prev) => ({
                                        ...prev,
                                        includeData: e.target.checked,
                                    }))
                                }
                                className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    {/* Quality Settings */}
                    {(exportOptions.format === "pdf" ||
                        exportOptions.format === "png") && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-purple-200">
                                Quality
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "low", label: "Low" },
                                    { id: "medium", label: "Medium" },
                                    { id: "high", label: "High" },
                                ].map((quality) => (
                                    <button
                                        key={quality.id}
                                        onClick={() =>
                                            setExportOptions((prev) => ({
                                                ...prev,
                                                quality: quality.id as any,
                                            }))
                                        }
                                        className={cn(
                                            "p-2 rounded text-xs font-medium transition-all",
                                            exportOptions.quality === quality.id
                                                ? "bg-purple-500/30 text-purple-100"
                                                : "bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
                                        )}
                                    >
                                        {quality.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Export Button */}
                    <div className="flex gap-2 pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleExport}
                            className="flex-1 bg-purple-500/30 hover:bg-purple-500/40"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function AnalyticsDashboard({
    open,
    onOpenChange,
    onBackToSettings,
}: AnalyticsDashboardProps) {
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedTimeRange, setSelectedTimeRange] = useState(TIME_RANGES[1]); // Default to 30D
    const [showExportModal, setShowExportModal] = useState(false);
    const [showGranularShareModal, setShowGranularShareModal] = useState(false);
    const [shareContentType, setShareContentType] = useState<
        "overview" | "chart" | "dataset" | "dashboard"
    >("dashboard");
    const [shareContentData, setShareContentData] = useState<any>(null);
    const [shareContentTitle, setShareContentTitle] = useState("");
    const [searchFilters, setSearchFilters] = useState<AnalyticsFilter>({
        sortBy: "date",
        sortOrder: "desc",
    });
    const [showDrilldown, setShowDrilldown] = useState(false);
    const [drilldownConfig, setDrilldownConfig] = useState<any>(null);
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [comparisonRange, setComparisonRange] = useState<DateRange>();
    const dashboardRef = useRef<HTMLDivElement>(null);

    // Calculate time range based on date picker selection
    const timeRange = useMemo(() => {
        const start = dateRange.from.getTime();
        const end = dateRange.to.getTime();
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        // Determine granularity based on date range
        let granularity: "day" | "week" | "month" = "day";
        if (daysDiff > 180) granularity = "month";
        else if (daysDiff > 90) granularity = "week";

        return {
            start,
            end,
            granularity,
        };
    }, [dateRange]);

    // Analytics data queries with filters
    const analytics = useQuery(api.analytics.getFilteredAnalytics, {
        timeRange,
        filters: searchFilters,
    });
    const overview = useQuery(api.analytics.getAnalyticsOverview);

    // Prepare available options for filters
    const availableFilterOptions = useMemo(() => {
        if (!analytics) return {};

        return {
            models: analytics.chatAnalytics?.chatsByModel?.map((model: any) => model.model) || [],
            projects: analytics.projectAnalytics?.projectDistribution?.map(
                (p: any) => p.projectName
            ) || [],
        };
    }, [analytics]);

    // Handle filter changes
    const handleFiltersChange = (filters: AnalyticsFilter) => {
        setSearchFilters(filters);
    };

    const handleApplyFilters = () => {
        // Filters are already applied through handleFiltersChange
        // This could trigger additional actions like analytics tracking
        console.log("Filters applied:", searchFilters);
    };

    const handleClearFilters = () => {
        setSearchFilters({
            sortBy: "date",
            sortOrder: "desc",
        });
    };

    // Handle drilldown navigation
    const handleDrilldown = (config: any) => {
        setDrilldownConfig(config);
        setShowDrilldown(true);
    };

    // Navigation handlers for drilldown
    const handleNavigateToChat = (chatId: string) => {
        // Close the analytics modal and drilldown
        setShowDrilldown(false);
        onOpenChange(false);
        
        // Navigate to the specific chat
        // This would typically use router navigation or state management
        console.log("Navigating to chat:", chatId);
        // TODO: Implement actual navigation logic
    };

    const handleNavigateToProject = (projectId: string) => {
        // Close the analytics modal and drilldown
        setShowDrilldown(false);
        onOpenChange(false);
        
        // Navigate to the specific project
        console.log("Navigating to project:", projectId);
        // TODO: Implement actual navigation logic
    };

    // Prepare export data
    const prepareExportData = (): AnalyticsExportData | null => {
        if (!analytics || !overview) return null;

        return {
            overview,
            chatAnalytics: analytics.chatAnalytics,
            messageAnalytics: analytics.messageAnalytics,
            projectAnalytics: analytics.projectAnalytics,
            libraryAnalytics: analytics.libraryAnalytics,
            timeAnalytics: analytics.timeAnalytics,
            exportMetadata: {
                timestamp: Date.now(),
                timeRange: selectedTimeRange.label,
                format: "analytics",
                version: "1.0.0",
            },
        };
    };

    const handleExport = async (options: ExportOptions) => {
        const data = prepareExportData();
        if (!data) {
            toast.error("No data available to export");
            return;
        }

        try {
            switch (options.format) {
                case "pdf": {
                    const pdfExporter = new AnalyticsPDFExporter();
                    await pdfExporter.exportAnalyticsDashboard(
                        data,
                        options,
                        dashboardRef
                    );
                    break;
                }
                case "csv": {
                    // For CSV, let user choose which section to export
                    AnalyticsCSVExporter.exportToCSV(data, "overview");
                    break;
                }
                case "json": {
                    AnalyticsJSONExporter.exportToJSON(data);
                    break;
                }
                case "png": {
                    if (dashboardRef.current) {
                        await AnalyticsPNGExporter.exportDashboardAsPNG(
                            dashboardRef.current,
                            { quality: options.quality }
                        );
                    }
                    break;
                }
            }
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Export failed. Please try again.");
        }
    };

    // Enhanced sharing handlers
    const handleShare = async (
        contentType?: "overview" | "chart" | "dataset" | "dashboard",
        contentData?: any,
        title?: string
    ) => {
        setShareContentType(contentType || "dashboard");
        setShareContentData(contentData || prepareExportData());
        setShareContentTitle(
            title ||
                `Analytics Dashboard - ${format(dateRange.from, "MMM dd")} to ${format(dateRange.to, "MMM dd, yyyy")}`
        );
        setShowGranularShareModal(true);
    };

    // Chart-specific sharing handlers
    const handleChartShare = (chartId: string, _chartElement?: HTMLElement) => {
        const chartData = extractChartData(chartId);
        void handleShare("chart", chartData, `${chartId} Chart`);
    };

    const extractChartData = (chartId: string) => {
        if (!analytics) return null;

        switch (chartId) {
            case "usage-trends":
                return analytics.chatAnalytics.chatCreationTrend;
            case "model-usage":
                return analytics.chatAnalytics.chatsByModel;
            case "message-trends":
                return analytics.messageAnalytics.messageTrend;
            case "project-distribution":
                return analytics.projectAnalytics.projectDistribution;
            case "library-breakdown":
                return {
                    attachments: analytics.libraryAnalytics.attachments,
                    artifacts: analytics.libraryAnalytics.artifacts,
                    media: analytics.libraryAnalytics.media,
                };
            case "activity-heatmap":
                return analytics.timeAnalytics.activityByHour;
            default:
                return analytics;
        }
    };

    // Apply date filters to data
    const filteredData = useMemo(() => {
        if (!analytics) return null;

        return {
            ...analytics,
            chats: analytics.chats?.filter((chat: any) => {
                const chatDate = new Date(chat.createdAt);
                return chatDate >= dateRange.from && chatDate <= dateRange.to;
            }) || [],
            messages: analytics.messages?.filter((message: any) => {
                const messageDate = new Date(message.createdAt);
                return (
                    messageDate >= dateRange.from && messageDate <= dateRange.to
                );
            }) || [],
            projects: analytics.projects?.filter((project: any) => {
                const projectDate = new Date(project.createdAt);
                return (
                    projectDate >= dateRange.from && projectDate <= dateRange.to
                );
            }) || [],
        };
    }, [analytics, dateRange]);

    if (!analytics || !overview) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-7xl max-h-[95vh] bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 overflow-hidden">
                    <div className="flex items-center justify-center h-96">
                        <div className="flex flex-col items-center gap-4">
                            <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
                            <p className="text-purple-300">
                                Loading analytics...
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <>
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
                                {/* Action Buttons */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleShare()}
                                    className="text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                                >
                                    <Share2 className="w-4 h-4 mr-2" />
                                    Share
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowExportModal(true)}
                                    className="text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </Button>
                            </div>
                        </div>

                        {/* Date Range Picker */}
                        <div className="mt-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div className="w-full lg:w-auto lg:min-w-[400px]">
                                    <CustomDatePicker
                                        value={dateRange}
                                        onChange={setDateRange}
                                        showComparison={true}
                                        onComparisonChange={() => {}}
                                        comparisonRange={comparisonRange}
                                        onComparisonRangeChange={setComparisonRange}
                                    />
                                </div>

                                {/* Quick Time Range Buttons */}
                                <div className="flex items-center gap-1 bg-purple-500/10 rounded-lg p-1">
                                    {TIME_RANGES.map((range) => (
                                        <Button
                                            key={range.label}
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const newRange = {
                                                    from: subDays(
                                                        new Date(),
                                                        range.days - 1
                                                    ),
                                                    to: new Date(),
                                                };
                                                setDateRange(newRange);
                                                setSelectedTimeRange(range);
                                            }}
                                            className={cn(
                                                "px-3 py-1 text-xs transition-all",
                                                selectedTimeRange.label ===
                                                    range.label
                                                    ? "bg-purple-500/30 text-purple-100"
                                                    : "text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                                            )}
                                        >
                                            {range.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Analytics Search Filter */}
                        <div className="mt-4">
                            <AnalyticsSearchFilter
                                filters={searchFilters}
                                onFiltersChange={handleFiltersChange}
                                onApplyFilters={handleApplyFilters}
                                onClearFilters={handleClearFilters}
                                availableOptions={availableFilterOptions}
                                dateRange={dateRange}
                                onDateRangeChange={setDateRange}
                            />
                        </div>

                        {/* Enhanced Quick Stats Row with Animated Counters */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-4">
                            <StatCard
                                icon={<MessageSquare className="w-4 h-4" />}
                                label="Total Chats"
                                value={
                                    <AnimatedCounter
                                        value={overview.totalChats}
                                    />
                                }
                                change={0}
                                trend="up"
                            />
                            <StatCard
                                icon={<Hash className="w-4 h-4" />}
                                label="Messages"
                                value={
                                    <AnimatedCounter
                                        value={overview.totalMessages}
                                    />
                                }
                                change={0}
                                trend="up"
                            />
                            <StatCard
                                icon={<FolderOpen className="w-4 h-4" />}
                                label="Projects"
                                value={
                                    <AnimatedCounter
                                        value={overview.totalProjects}
                                    />
                                }
                                change={0}
                                trend="neutral"
                            />
                            <StatCard
                                icon={<FileText className="w-4 h-4" />}
                                label="Library Items"
                                value={
                                    <AnimatedCounter
                                        value={overview.totalLibraryItems}
                                    />
                                }
                                change={0}
                                trend="up"
                            />
                            <StatCard
                                icon={<TrendingUp className="w-4 h-4" />}
                                label="This Week"
                                value={
                                    <AnimatedCounter
                                        value={overview.thisWeekChats}
                                    />
                                }
                                subtitle="new chats"
                                trend="up"
                            />
                            <StatCard
                                icon={<Cpu className="w-4 h-4" />}
                                label="Top Model"
                                value={overview.mostUsedModel.split("-")[0]}
                                subtitle={
                                    overview.mostUsedModel.includes("-")
                                        ? overview.mostUsedModel
                                              .split("-")
                                              .slice(1)
                                              .join("-")
                                        : ""
                                }
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
                                value={`${analytics?.overview?.mostActiveHour || 0}:00`}
                                subtitle={analytics?.overview?.mostActiveDay?.slice(0, 3) || "N/A"}
                                trend="neutral"
                            />
                        </div>
                    </DialogHeader>

                    {/* Main Content with Chart Container References */}
                    <div className="flex-1 overflow-hidden" ref={dashboardRef}>
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="h-full flex flex-col"
                        >
                            <TabsList className="mx-6 mt-4 grid w-fit grid-cols-6 bg-purple-500/10">
                                <TabsTrigger
                                    value="overview"
                                    className="flex items-center gap-2"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    Overview
                                </TabsTrigger>
                                <TabsTrigger
                                    value="chats"
                                    className="flex items-center gap-2"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Chats
                                </TabsTrigger>
                                <TabsTrigger
                                    value="messages"
                                    className="flex items-center gap-2"
                                >
                                    <Hash className="w-4 h-4" />
                                    Messages
                                </TabsTrigger>
                                <TabsTrigger
                                    value="projects"
                                    className="flex items-center gap-2"
                                >
                                    <FolderOpen className="w-4 h-4" />
                                    Projects
                                </TabsTrigger>
                                <TabsTrigger
                                    value="library"
                                    className="flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Library
                                </TabsTrigger>
                                <TabsTrigger
                                    value="time"
                                    className="flex items-center gap-2"
                                >
                                    <Clock className="w-4 h-4" />
                                    Activity
                                </TabsTrigger>
                            </TabsList>

                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                <TabsContent
                                    value="overview"
                                    className="mt-0 space-y-6"
                                >
                                    <OverviewTab
                                        analytics={filteredData}
                                        onDrilldown={handleDrilldown}
                                        onShare={handleChartShare}
                                    />
                                </TabsContent>

                                <TabsContent
                                    value="chats"
                                    className="mt-0 space-y-6"
                                >
                                    <ChatsTab
                                        analytics={filteredData}
                                        onDrilldown={handleDrilldown}
                                        onShare={handleChartShare}
                                    />
                                </TabsContent>

                                <TabsContent
                                    value="messages"
                                    className="mt-0 space-y-6"
                                >
                                    <MessagesTab
                                        analytics={filteredData}
                                        onDrilldown={handleDrilldown}
                                        onShare={handleChartShare}
                                    />
                                </TabsContent>

                                <TabsContent
                                    value="projects"
                                    className="mt-0 space-y-6"
                                >
                                    <ProjectsTab
                                        analytics={filteredData}
                                        onDrilldown={handleDrilldown}
                                        onShare={handleChartShare}
                                    />
                                </TabsContent>

                                <TabsContent
                                    value="library"
                                    className="mt-0 space-y-6"
                                >
                                    <LibraryTab
                                        analytics={filteredData}
                                        onDrilldown={handleDrilldown}
                                        onShare={handleChartShare}
                                    />
                                </TabsContent>

                                <TabsContent
                                    value="time"
                                    className="mt-0 space-y-6"
                                >
                                    <TimeTab
                                        analytics={filteredData}
                                        onDrilldown={handleDrilldown}
                                        onShare={handleChartShare}
                                    />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Export Options Modal */}
            <ExportOptionsModal
                open={showExportModal}
                onOpenChange={setShowExportModal}
                onExport={(options) => void handleExport(options)}
            />

            {/* Granular Share Modal */}
            <GranularShareModal
                open={showGranularShareModal}
                onOpenChange={setShowGranularShareModal}
                contentType={shareContentType}
                contentData={shareContentData}
                contentTitle={shareContentTitle}
                chartElement={dashboardRef.current || undefined}
            />

            {/* Analytics Drilldown */}
            {showDrilldown && drilldownConfig && (
                <AnalyticsDrilldown
                    isOpen={showDrilldown}
                    onClose={() => setShowDrilldown(false)}
                    data={drilldownConfig}
                    onNavigateToChat={handleNavigateToChat}
                    onNavigateToProject={handleNavigateToProject}
                />
            )}
        </>
    );
}

// Tab Components
function OverviewTab({
    analytics,
    onDrilldown,
    onShare,
}: {
    analytics: any;
    onDrilldown: (config: any) => void;
    onShare: (chartId: string, chartElement?: HTMLElement) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Chat Growth"
                    value={analytics?.chatAnalytics?.totalChats || 0}
                    change={analytics?.chatAnalytics?.growthRate || 0}
                    icon={<TrendingUp className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Active Models"
                    value={
                        analytics?.chatAnalytics?.chatsByModel?.length || 0
                    }
                    subtitle="AI models used"
                    icon={<Brain className="w-5 h-5" />}
                    trend="neutral"
                />
                <MetricCard
                    title="Project Activity"
                    value={analytics?.projectAnalytics?.totalProjects || 0}
                    change={analytics?.projectAnalytics?.growthRate || 0}
                    icon={<FolderOpen className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Library Size"
                    value={analytics?.libraryAnalytics?.attachments?.total || 0}
                    subtitle="files & artifacts"
                    icon={<Archive className="w-5 h-5" />}
                    trend="up"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title="Usage Trends"
                    description="Chat creation and activity over time"
                    onShare={() => onShare("usage-trends")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "usage-trends",
                            data: analytics?.chatAnalytics,
                        })
                    }
                >
                    <ChatCreationTrendChart
                        data={analytics?.chatAnalytics?.chatCreationTrend || []}
                    />
                </ChartCard>

                <ChartCard
                    title="Model Usage"
                    description="Distribution of AI model usage"
                    onShare={() => onShare("model-usage")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "model-usage",
                            data: analytics?.chatAnalytics?.chatsByModel,
                        })
                    }
                >
                    <ModelUsagePieChart
                        data={analytics?.chatAnalytics?.chatsByModel || []}
                    />
                </ChartCard>

                <ChartCard
                    title="Message Trends"
                    description="Message volume and patterns"
                    onShare={() => onShare("message-trends")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "message-trends",
                            data: analytics?.messageAnalytics,
                        })
                    }
                >
                    <MessageTrendChart
                        data={analytics?.messageAnalytics?.messageTrend || []}
                    />
                </ChartCard>

                <ChartCard
                    title="Activity Heatmap"
                    description="Usage patterns by hour and day"
                    onShare={() => onShare("activity-heatmap")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "activity-heatmap",
                            data: analytics?.timeAnalytics,
                        })
                    }
                >
                    <ActivityHeatmap
                        data={analytics?.timeAnalytics?.activityByHour || []}
                    />
                </ChartCard>
            </div>
        </div>
    );
}

function ChatsTab({
    analytics,
    onDrilldown,
    onShare,
}: {
    analytics: any;
    onDrilldown: (config: any) => void;
    onShare: (chartId: string, chartElement?: HTMLElement) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Chat Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Total Chats"
                    value={analytics?.chatAnalytics?.totalChats || 0}
                    change={analytics?.chatAnalytics?.growthRate || 0}
                    icon={<MessageSquare className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Average Length"
                    value={`${analytics?.chatAnalytics?.averageLength || 0}`}
                    subtitle="messages per chat"
                    icon={<BarChart className="w-5 h-5" />}
                    trend="neutral"
                />
                <MetricCard
                    title="Most Active Model"
                    value={
                        analytics?.chatAnalytics?.chatsByModel?.[0]?.model?.split("-")?.[0] || "N/A"
                    }
                    subtitle={
                        analytics?.chatAnalytics?.chatsByModel?.[0]?.model
                            ?.split("-")
                            ?.slice(1)
                            ?.join("-") || ""
                    }
                    icon={<Crown className="w-5 h-5" />}
                    trend="neutral"
                />
            </div>

            {/* Chat Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title="Chat Creation Timeline"
                    description="When new chats are created"
                    onShare={() => onShare("chat-creation-timeline")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "chat-creation",
                            data: analytics?.chatAnalytics,
                        })
                    }
                >
                    <ChatCreationTrendChart
                        data={analytics?.chatAnalytics?.chatCreationTrend || []}
                    />
                </ChartCard>

                <ChartCard
                    title="Model Distribution"
                    description="Usage breakdown by AI model"
                    onShare={() => onShare("model-distribution")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "model-distribution",
                            data: analytics?.chatAnalytics?.chatsByModel,
                        })
                    }
                >
                    <ModelUsagePieChart
                        data={analytics?.chatAnalytics?.chatsByModel || []}
                    />
                </ChartCard>
            </div>

            {/* Recent Chats List */}
            <div className="bg-purple-500/10 rounded-lg border border-purple-500/30 p-6">
                <h3 className="text-lg font-semibold text-purple-100 mb-4">
                    Recent Chats
                </h3>
                <div className="space-y-3">
                    {analytics?.chats
                        ?.slice(0, 5)
                        .map((chat: any, index: number) => (
                            <div
                                key={chat.id || index}
                                className="flex items-center justify-between p-3 bg-purple-500/10 rounded border border-purple-500/20"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center">
                                        <MessageSquare className="w-4 h-4 text-purple-300" />
                                    </div>
                                    <div>
                                        <p className="text-purple-100 font-medium">
                                            {chat.title || "Untitled Chat"}
                                        </p>
                                        <p className="text-sm text-purple-400">
                                            {chat.messageCount || 0} messages
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-purple-300">
                                        {format(
                                            new Date(chat.createdAt),
                                            "MMM dd, yyyy"
                                        )}
                                    </p>
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                    >
                                        {chat.model || "Unknown"}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}

function MessagesTab({
    analytics,
    onDrilldown,
    onShare,
}: {
    analytics: any;
    onDrilldown: (config: any) => void;
    onShare: (chartId: string, chartElement?: HTMLElement) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Message Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Messages"
                    value={analytics?.messageAnalytics?.totalMessages || 0}
                    change={analytics?.messageAnalytics?.growthRate || 0}
                    icon={<Hash className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Average Length"
                    value={`${analytics?.messageAnalytics?.averageLength || 0}`}
                    subtitle="characters"
                    icon={<FileText className="w-5 h-5" />}
                    trend="neutral"
                />
                <MetricCard
                    title="Response Time"
                    value={`${analytics?.messageAnalytics?.responseTimeAnalytics?.averageResponseTime || 0}s`}
                    subtitle="average"
                    icon={<Timer className="w-5 h-5" />}
                    trend="down"
                />
                <MetricCard
                    title="Peak Hour"
                    value={`${analytics?.messageAnalytics?.peakHour || 0}:00`}
                    subtitle="most active"
                    icon={<Activity className="w-5 h-5" />}
                    trend="neutral"
                />
            </div>

            {/* Message Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title="Message Volume"
                    description="Messages sent over time"
                    onShare={() => onShare("message-volume")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "message-volume",
                            data: analytics.messageAnalytics,
                        })
                    }
                >
                    <MessageTrendChart
                        data={analytics?.messageAnalytics?.messageTrend || []}
                    />
                </ChartCard>

                <ChartCard
                    title="Response Times"
                    description="AI response time distribution"
                    onShare={() => onShare("response-times")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "response-times",
                            data: analytics.messageAnalytics.responseTimes,
                        })
                    }
                >
                    <ResponseTimeChart
                        data={analytics?.messageAnalytics?.responseTimes || []}
                    />
                </ChartCard>
            </div>
        </div>
    );
}

function ProjectsTab({
    analytics,
    onDrilldown,
    onShare,
}: {
    analytics: any;
    onDrilldown: (config: any) => void;
    onShare: (chartId: string, chartElement?: HTMLElement) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Project Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Total Projects"
                    value={analytics?.projectAnalytics?.totalProjects || 0}
                    change={analytics?.projectAnalytics?.growthRate || 0}
                    icon={<FolderOpen className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Average Size"
                    value={`${analytics?.projectAnalytics?.averageSize || 0}`}
                    subtitle="chats per project"
                    icon={<BarChart className="w-5 h-5" />}
                    trend="neutral"
                />
                <MetricCard
                    title="Most Active"
                    value={
                        analytics?.projectAnalytics?.mostActiveProject?.name ||
                        "N/A"
                    }
                    subtitle={`${analytics?.projectAnalytics?.mostActiveProject?.chatCount || 0} chats`}
                    icon={<Star className="w-5 h-5" />}
                    trend="neutral"
                />
            </div>

            {/* Project Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title="Project Distribution"
                    description="Chat distribution across projects"
                    onShare={() => onShare("project-distribution")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "project-distribution",
                            data: analytics.projectAnalytics,
                        })
                    }
                >
                    <ProjectDistributionChart
                        data={
                            analytics?.projectAnalytics?.projectDistribution ||
                            []
                        }
                    />
                </ChartCard>

                <ChartCard
                    title="Project Activity"
                    description="Creation and usage over time"
                    onShare={() => onShare("project-activity")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "project-activity",
                            data: analytics.projectAnalytics.activityTrend,
                        })
                    }
                >
                    <MessageTrendChart
                        data={analytics?.projectAnalytics?.activityTrend || []}
                    />
                </ChartCard>
            </div>
        </div>
    );
}

function LibraryTab({
    analytics,
    onDrilldown,
    onShare,
}: {
    analytics: any;
    onDrilldown: (config: any) => void;
    onShare: (chartId: string, chartElement?: HTMLElement) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Library Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Attachments"
                    value={analytics?.libraryAnalytics?.attachments?.total || 0}
                    subtitle="files uploaded"
                    icon={<FileText className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Artifacts"
                    value={analytics?.libraryAnalytics?.artifacts?.total || 0}
                    subtitle="generated"
                    icon={<Code className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Media Files"
                    value={analytics?.libraryAnalytics?.media?.total || 0}
                    subtitle="images & videos"
                    icon={<Image className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Total Size"
                    value={`${(analytics?.libraryAnalytics?.totalSize || 0) / 1024 / 1024}MB`}
                    subtitle="storage used"
                    icon={<Archive className="w-5 h-5" />}
                    trend="up"
                />
            </div>

            {/* Library Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title="Content Types"
                    description="Breakdown by file type"
                    onShare={() => onShare("library-breakdown")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "library-breakdown",
                            data: analytics.libraryAnalytics,
                        })
                    }
                >
                    <LibraryTypeChart
                        data={analytics?.libraryAnalytics || {}}
                    />
                </ChartCard>

                <ChartCard
                    title="Upload Trends"
                    description="File uploads over time"
                    onShare={() => onShare("upload-trends")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "upload-trends",
                            data: analytics.libraryAnalytics.uploadTrend,
                        })
                    }
                >
                    <MessageTrendChart
                        data={analytics?.libraryAnalytics?.uploadTrend || []}
                    />
                </ChartCard>
            </div>
        </div>
    );
}

function TimeTab({
    analytics,
    onDrilldown,
    onShare,
}: {
    analytics: any;
    onDrilldown: (config: any) => void;
    onShare: (chartId: string, chartElement?: HTMLElement) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Time Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Peak Hour"
                    value={`${analytics?.timeAnalytics?.peakHour || 0}:00`}
                    subtitle="most active"
                    icon={<Clock className="w-5 h-5" />}
                    trend="neutral"
                />
                <MetricCard
                    title="Peak Day"
                    value={analytics?.timeAnalytics?.peakDay || "N/A"}
                    subtitle="busiest day"
                    icon={<Calendar className="w-5 h-5" />}
                    trend="neutral"
                />
                <MetricCard
                    title="Session Length"
                    value={`${analytics?.timeAnalytics?.averageSessionLength || 0}m`}
                    subtitle="average"
                    icon={<Timer className="w-5 h-5" />}
                    trend="up"
                />
                <MetricCard
                    title="Active Hours"
                    value={`${analytics?.timeAnalytics?.activeHours || 0}`}
                    subtitle="per day"
                    icon={<Activity className="w-5 h-5" />}
                    trend="up"
                />
            </div>

            {/* Time Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title="Activity Heatmap"
                    description="Usage patterns by time"
                    onShare={() => onShare("activity-heatmap")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "activity-heatmap",
                            data: analytics.timeAnalytics,
                        })
                    }
                >
                    <ActivityHeatmap
                        data={analytics?.timeAnalytics?.activityByHour || []}
                    />
                </ChartCard>

                <ChartCard
                    title="Hourly Distribution"
                    description="Activity levels throughout the day"
                    onShare={() => onShare("hourly-distribution")}
                    onDrilldown={() =>
                        onDrilldown({
                            type: "hourly-distribution",
                            data: analytics.timeAnalytics.hourlyActivity,
                        })
                    }
                >
                    <HourlyActivityChart
                        data={analytics?.timeAnalytics?.hourlyActivity || []}
                    />
                </ChartCard>
            </div>
        </div>
    );
}

// Utility Components
function StatCard({
    icon,
    label,
    value,
    change,
    trend,
    subtitle,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    change?: number;
    trend?: "up" | "down" | "neutral";
    subtitle?: string;
}) {
    return (
        <div className="bg-purple-500/10 rounded-lg border border-purple-500/30 p-3">
            <div className="flex items-center gap-2 mb-2">
                <div className="text-purple-400">{icon}</div>
                <span className="text-xs text-purple-300 uppercase tracking-wide">
                    {label}
                </span>
            </div>
            <div className="text-lg font-semibold text-purple-100">{value}</div>
            {subtitle && (
                <p className="text-xs text-purple-400 mt-1">{subtitle}</p>
            )}
            {change !== undefined && (
                <div
                    className={cn(
                        "flex items-center gap-1 mt-1 text-xs",
                        trend === "up" && "text-green-400",
                        trend === "down" && "text-red-400",
                        trend === "neutral" && "text-purple-400"
                    )}
                >
                    {trend === "up" && <TrendingUp className="w-3 h-3" />}
                    {change > 0 ? "+" : ""}
                    {change}%
                </div>
            )}
        </div>
    );
}

function MetricCard({
    title,
    value,
    change,
    subtitle,
    icon,
    trend,
}: {
    title: string;
    value: React.ReactNode;
    change?: number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: "up" | "down" | "neutral";
}) {
    return (
        <div className="bg-purple-500/10 rounded-lg border border-purple-500/30 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="text-purple-400">{icon}</div>
                {change !== undefined && (
                    <Badge
                        variant={
                            trend === "up"
                                ? "default"
                                : trend === "down"
                                  ? "destructive"
                                  : "secondary"
                        }
                    >
                        {trend === "up" && (
                            <TrendingUp className="w-3 h-3 mr-1" />
                        )}
                        {change > 0 ? "+" : ""}
                        {change}%
                    </Badge>
                )}
            </div>
            <div className="space-y-1">
                <h3 className="text-sm font-medium text-purple-200">{title}</h3>
                <div className="text-2xl font-bold text-purple-100">
                    {value}
                </div>
                {subtitle && (
                    <p className="text-sm text-purple-400">{subtitle}</p>
                )}
            </div>
        </div>
    );
}

function ChartCard({
    title,
    description,
    children,
    onShare,
    onDrilldown,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
    onShare?: () => void;
    onDrilldown?: () => void;
}) {
    return (
        <div className="bg-purple-500/10 rounded-lg border border-purple-500/30 p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-purple-100">
                        {title}
                    </h3>
                    <p className="text-sm text-purple-400">{description}</p>
                </div>
                <div className="flex items-center gap-2">
                    {onShare && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onShare}
                            className="text-purple-300 hover:text-purple-100"
                        >
                            <Share2 className="w-4 h-4" />
                        </Button>
                    )}
                    {onDrilldown && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDrilldown}
                            className="text-purple-300 hover:text-purple-100"
                        >
                            <Eye className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="h-64">{children}</div>
        </div>
    );
}
