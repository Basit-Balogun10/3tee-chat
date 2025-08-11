import React, { useMemo } from "react";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadialBarChart,
    RadialBar,
    ComposedChart,
} from "recharts";
import {
    format,
    startOfDay,
    eachDayOfInterval,
    eachHourOfInterval,
    startOfHour,
} from "date-fns";
import { cn } from "../lib/utils";

// Color palette consistent with app theme
const COLORS = {
    primary: "#a855f7", // purple-500
    secondary: "#3b82f6", // blue-500
    accent: "#06b6d4", // cyan-500
    success: "#10b981", // emerald-500
    warning: "#f59e0b", // amber-500
    error: "#ef4444", // red-500
    purple: "#8b5cf6", // violet-500
    pink: "#ec4899", // pink-500
    indigo: "#6366f1", // indigo-500
    teal: "#14b8a6", // teal-500
};

const CHART_COLORS = [
    COLORS.primary,
    COLORS.secondary,
    COLORS.accent,
    COLORS.success,
    COLORS.warning,
    COLORS.purple,
    COLORS.pink,
    COLORS.indigo,
    COLORS.teal,
    COLORS.error,
];

// Custom Tooltip Component
const CustomTooltip = ({
    active,
    payload,
    label,
    labelFormatter,
    valueFormatter,
}: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg p-3 shadow-xl">
                <p className="text-purple-100 font-medium mb-2">
                    {labelFormatter ? labelFormatter(label) : label}
                </p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-purple-200 text-sm">
                            {entry.name}:{" "}
                            {valueFormatter
                                ? valueFormatter(entry.value)
                                : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Activity Heatmap Component
interface ActivityHeatmapProps {
    data: Array<{ hour: number; day: number; activity: number }>;
    className?: string;
}

export function ActivityHeatmap({ data, className }: ActivityHeatmapProps) {
    const maxActivity = Math.max(...data.map((d) => d.activity));
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getIntensity = (activity: number) => {
        if (activity === 0) return 0;
        return Math.max(0.1, activity / maxActivity);
    };

    const getActivityForCell = (day: number, hour: number) => {
        return (
            data.find((d) => d.day === day && d.hour === hour)?.activity || 0
        );
    };

    return (
        <div className={cn("space-y-4", className)}>
            <div className="grid grid-cols-25 gap-1 text-xs">
                {/* Hour labels */}
                <div></div>
                {hours.map((hour) => (
                    <div key={hour} className="text-center text-purple-400">
                        {hour % 6 === 0 ? hour : ""}
                    </div>
                ))}

                {/* Heatmap cells */}
                {days.map((day, dayIndex) => (
                    <React.Fragment key={day}>
                        <div className="text-purple-400 text-right pr-2 py-1">
                            {day}
                        </div>
                        {hours.map((hour) => {
                            const activity = getActivityForCell(dayIndex, hour);
                            const intensity = getIntensity(activity);
                            return (
                                <div
                                    key={`${day}-${hour}`}
                                    className="aspect-square rounded-sm cursor-pointer hover:ring-2 hover:ring-purple-400/50 transition-all group relative"
                                    style={{
                                        backgroundColor:
                                            intensity > 0
                                                ? `rgba(168, 85, 247, ${intensity})`
                                                : "rgba(75, 85, 99, 0.3)",
                                    }}
                                    title={`${day} ${hour}:00 - ${activity} messages`}
                                >
                                    <div className="absolute inset-0 bg-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm" />
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-xs text-purple-400">
                <span>Less</span>
                {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((intensity) => (
                    <div
                        key={intensity}
                        className="w-3 h-3 rounded-sm"
                        style={{
                            backgroundColor:
                                intensity > 0
                                    ? `rgba(168, 85, 247, ${intensity})`
                                    : "rgba(75, 85, 99, 0.3)",
                        }}
                    />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

// Message Trend Chart
interface MessageTrendChartProps {
    data: Array<{
        period: string;
        userMessages: number;
        assistantMessages: number;
        timestamp: number;
    }>;
    className?: string;
}

export function MessageTrendChart({ data, className }: MessageTrendChartProps) {
    const formatLabel = (timestamp: number) => {
        return format(new Date(timestamp), "MMM dd");
    };

    return (
        <div className={cn("h-64", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(168, 85, 247, 0.2)"
                    />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatLabel}
                        stroke="#9ca3af"
                        fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                        content={
                            <CustomTooltip
                                labelFormatter={formatLabel}
                                valueFormatter={(value: number) =>
                                    `${value} messages`
                                }
                            />
                        }
                    />
                    <Legend />
                    <Area
                        type="monotone"
                        dataKey="userMessages"
                        stackId="1"
                        stroke={COLORS.primary}
                        fill={COLORS.primary}
                        fillOpacity={0.6}
                        name="Your Messages"
                    />
                    <Area
                        type="monotone"
                        dataKey="assistantMessages"
                        stackId="1"
                        stroke={COLORS.secondary}
                        fill={COLORS.secondary}
                        fillOpacity={0.6}
                        name="AI Responses"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

// Model Usage Pie Chart
interface ModelUsagePieChartProps {
    data: Array<{ model: string; count: number; percentage: number }>;
    className?: string;
}

export function ModelUsagePieChart({
    data,
    className,
}: ModelUsagePieChartProps) {
    const chartData = data.map((item, index) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return (
        <div className={cn("h-64", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="count"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        content={
                            <CustomTooltip
                                valueFormatter={(
                                    value: number,
                                    name: string,
                                    props: any
                                ) => `${value} (${props.payload.percentage}%)`}
                            />
                        }
                    />
                    <Legend
                        wrapperStyle={{ fontSize: "12px", color: "#d1d5db" }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// Chat Creation Trend Line Chart
interface ChatCreationTrendProps {
    data: Array<{ period: string; count: number; timestamp: number }>;
    className?: string;
}

export function ChatCreationTrendChart({
    data,
    className,
}: ChatCreationTrendProps) {
    const formatLabel = (timestamp: number) => {
        return format(new Date(timestamp), "MMM dd");
    };

    return (
        <div className={cn("h-64", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(168, 85, 247, 0.2)"
                    />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatLabel}
                        stroke="#9ca3af"
                        fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                        content={
                            <CustomTooltip
                                labelFormatter={formatLabel}
                                valueFormatter={(value: number) =>
                                    `${value} chats`
                                }
                            />
                        }
                    />
                    <Line
                        type="monotone"
                        dataKey="count"
                        stroke={COLORS.accent}
                        strokeWidth={3}
                        dot={{ fill: COLORS.accent, strokeWidth: 2, r: 4 }}
                        activeDot={{
                            r: 6,
                            stroke: COLORS.accent,
                            strokeWidth: 2,
                        }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// Response Time Distribution
interface ResponseTimeChartProps {
    data: {
        averageResponseTime: number;
        fastestResponse: number;
        slowestResponse: number;
    };
    className?: string;
}

export function ResponseTimeChart({ data, className }: ResponseTimeChartProps) {
    const chartData = [
        { name: "Fastest", time: data.fastestResponse, color: COLORS.success },
        {
            name: "Average",
            time: data.averageResponseTime,
            color: COLORS.primary,
        },
        { name: "Slowest", time: data.slowestResponse, color: COLORS.warning },
    ];

    return (
        <div className={cn("h-64", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="horizontal">
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(168, 85, 247, 0.2)"
                    />
                    <XAxis
                        type="number"
                        stroke="#9ca3af"
                        fontSize={12}
                        tickFormatter={(value) => `${value}s`}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#9ca3af"
                        fontSize={12}
                        width={80}
                    />
                    <Tooltip
                        content={
                            <CustomTooltip
                                valueFormatter={(value: number) =>
                                    `${value} seconds`
                                }
                            />
                        }
                    />
                    <Bar
                        dataKey="time"
                        fill={(entry: any) => entry.color}
                        radius={[0, 4, 4, 0]}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Hourly Activity Chart
interface HourlyActivityChartProps {
    data: Array<{ hour: number; activity: number }>;
    className?: string;
}

export function HourlyActivityChart({
    data,
    className,
}: HourlyActivityChartProps) {
    const formatHour = (hour: number) => {
        return `${hour}:00`;
    };

    return (
        <div className={cn("h-64", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(168, 85, 247, 0.2)"
                    />
                    <XAxis
                        dataKey="hour"
                        tickFormatter={formatHour}
                        stroke="#9ca3af"
                        fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                        content={
                            <CustomTooltip
                                labelFormatter={formatHour}
                                valueFormatter={(value: number) =>
                                    `${value} messages`
                                }
                            />
                        }
                    />
                    <Area
                        type="monotone"
                        dataKey="activity"
                        stroke={COLORS.purple}
                        fill={COLORS.purple}
                        fillOpacity={0.6}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// Project Distribution Chart
interface ProjectDistributionChartProps {
    data: Array<{
        projectName: string;
        chatCount: number;
        messageCount: number;
    }>;
    className?: string;
}

export function ProjectDistributionChart({
    data,
    className,
}: ProjectDistributionChartProps) {
    const chartData = data.slice(0, 10).map((item, index) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return (
        <div className={cn("h-64", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(168, 85, 247, 0.2)"
                    />
                    <XAxis
                        dataKey="projectName"
                        stroke="#9ca3af"
                        fontSize={12}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                        content={
                            <CustomTooltip
                                valueFormatter={(
                                    value: number,
                                    name: string
                                ) =>
                                    name === "chatCount"
                                        ? `${value} chats`
                                        : `${value} messages`
                                }
                            />
                        }
                    />
                    <Legend />
                    <Bar
                        dataKey="chatCount"
                        fill={COLORS.primary}
                        name="Chats"
                        radius={[2, 2, 0, 0]}
                    />
                    <Bar
                        dataKey="messageCount"
                        fill={COLORS.secondary}
                        name="Messages"
                        radius={[2, 2, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Animated Counter Component
interface AnimatedCounterProps {
    value: number;
    duration?: number;
    formatValue?: (value: number) => string;
    className?: string;
}

export function AnimatedCounter({
    value,
    duration = 1000,
    formatValue = (v) => v.toLocaleString(),
    className,
}: AnimatedCounterProps) {
    const [currentValue, setCurrentValue] = React.useState(0);

    React.useEffect(() => {
        const startTime = Date.now();
        const startValue = currentValue;
        const difference = value - startValue;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const newValue = startValue + difference * easeOutQuart;

            setCurrentValue(Math.floor(newValue));

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setCurrentValue(value);
            }
        };

        animate();
    }, [value, duration]);

    return <span className={className}>{formatValue(currentValue)}</span>;
}

// Progress Ring Component
interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    className?: string;
    children?: React.ReactNode;
}

export function ProgressRing({
    progress,
    size = 120,
    strokeWidth = 8,
    className,
    children,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div
            className={cn("relative", className)}
            style={{ width: size, height: size }}
        >
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(168, 85, 247, 0.2)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#a855f7"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            {children && (
                <div className="absolute inset-0 flex items-center justify-center">
                    {children}
                </div>
            )}
        </div>
    );
}

// Library Type Distribution Chart
interface LibraryTypeChartProps {
    attachments: {
        image: number;
        pdf: number;
        file: number;
        audio: number;
        video: number;
    };
    artifacts: Array<{ language: string; count: number }>;
    media: { image: number; video: number; audio: number };
    className?: string;
}

export function LibraryTypeChart({
    attachments,
    artifacts,
    media,
    className,
}: LibraryTypeChartProps) {
    const attachmentData = [
        { name: "Images", value: attachments.image, color: COLORS.primary },
        { name: "PDFs", value: attachments.pdf, color: COLORS.secondary },
        { name: "Files", value: attachments.file, color: COLORS.accent },
        { name: "Audio", value: attachments.audio, color: COLORS.success },
        { name: "Video", value: attachments.video, color: COLORS.warning },
    ].filter((item) => item.value > 0);

    const artifactData = artifacts.slice(0, 8).map((item, index) => ({
        name: item.language,
        value: item.count,
        color: CHART_COLORS[index % CHART_COLORS.length],
    }));

    const mediaData = [
        { name: "Images", value: media.image, color: COLORS.pink },
        { name: "Videos", value: media.video, color: COLORS.indigo },
        { name: "Audio", value: media.audio, color: COLORS.teal },
    ].filter((item) => item.value > 0);

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", className)}>
            {/* Attachments */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-purple-200">
                    Attachments
                </h4>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={attachmentData}
                                cx="50%"
                                cy="50%"
                                innerRadius={20}
                                outerRadius={60}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {attachmentData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Artifacts */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-purple-200">
                    Artifacts by Language
                </h4>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={artifactData}>
                            <XAxis
                                dataKey="name"
                                stroke="#9ca3af"
                                fontSize={10}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis stroke="#9ca3af" fontSize={10} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                {artifactData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Media */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-purple-200">
                    Media Library
                </h4>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={mediaData}
                                cx="50%"
                                cy="50%"
                                innerRadius={20}
                                outerRadius={60}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {mediaData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
