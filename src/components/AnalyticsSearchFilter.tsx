import React, { useState, useMemo } from "react";
import {
    Search,
    Filter,
    X,
    ChevronDown,
    Hash,
    MessageSquare,
    User,
    Calendar,
    Cpu,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Switch } from "./ui/switch";

export interface AnalyticsFilter {
    search?: string;
    messageType?: string[];
    userGroups?: string[];
    models?: string[];
    projects?: string[];
    dateRange?: "today" | "week" | "month" | "custom";
    minMessages?: number;
    showDeleted?: boolean;
    sortBy?: "date" | "messages" | "activity" | "responseTime";
    sortOrder?: "asc" | "desc";
}

export interface AnalyticsSearchFilterProps {
    filters: AnalyticsFilter;
    onFiltersChange: (filters: AnalyticsFilter) => void;
    onApplyFilters: () => void;
    onClearFilters: () => void;
    availableOptions?: {
        messageTypes?: string[];
        userGroups?: string[];
        models?: string[];
        projects?: string[];
    };
}

const MESSAGE_TYPES = [
    { id: "user", label: "User Messages", icon: <User className="w-3 h-3" /> },
    {
        id: "assistant",
        label: "AI Responses",
        icon: <Cpu className="w-3 h-3" />,
    },
    {
        id: "system",
        label: "System Messages",
        icon: <Hash className="w-3 h-3" />,
    },
];

const SORT_OPTIONS = [
    { id: "date", label: "Date Created" },
    { id: "messages", label: "Message Count" },
    { id: "activity", label: "Activity Level" },
    { id: "responseTime", label: "Response Time" },
];

export function AnalyticsSearchFilter({
    filters,
    onFiltersChange,
    onApplyFilters,
    onClearFilters,
    availableOptions = {},
}: AnalyticsSearchFilterProps) {
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [localFilters, setLocalFilters] = useState<AnalyticsFilter>(filters);

    const updateFilter = (key: keyof AnalyticsFilter, value: any) => {
        const updated = { ...localFilters, [key]: value };
        setLocalFilters(updated);
        onFiltersChange(updated);
    };

    const toggleArrayFilter = (
        key: "messageType" | "userGroups" | "models" | "projects",
        value: string
    ) => {
        const current = localFilters[key] || [];
        const updated = current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value];
        updateFilter(key, updated);
    };

    const handleClear = () => {
        const clearedFilters: AnalyticsFilter = {
            sortBy: "date",
            sortOrder: "desc",
        };
        setLocalFilters(clearedFilters);
        onFiltersChange(clearedFilters);
        onClearFilters();
    };

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (localFilters.search) count++;
        if (localFilters.messageType?.length) count++;
        if (localFilters.userGroups?.length) count++;
        if (localFilters.models?.length) count++;
        if (localFilters.projects?.length) count++;
        if (localFilters.dateRange && localFilters.dateRange !== "month")
            count++;
        if (localFilters.minMessages && localFilters.minMessages > 0) count++;
        if (localFilters.showDeleted) count++;
        return count;
    }, [localFilters]);

    return (
        <div className="flex flex-col gap-4 p-4 bg-purple-600/5 border border-purple-600/20 rounded-lg">
            {/* Main Search Bar */}
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
                        <Input
                            value={localFilters.search || ""}
                            onChange={(e) =>
                                updateFilter("search", e.target.value)
                            }
                            placeholder="Search analytics data, chats, messages, or projects..."
                            className="pl-10 bg-purple-500/10 border-purple-500/30 text-purple-100"
                        />
                    </div>
                </div>

                <Button
                    onClick={() => updateFilter("search", "")}
                    variant="outline"
                    size="sm"
                    className="border-purple-600/30 text-purple-300"
                    disabled={!localFilters.search}
                >
                    <X className="w-4 h-4" />
                </Button>

                <Popover
                    open={showAdvancedFilters}
                    onOpenChange={setShowAdvancedFilters}
                >
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "border-purple-600/30 text-purple-300",
                                activeFilterCount > 0 &&
                                    "bg-purple-600/20 border-purple-500/40"
                            )}
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Advanced Filters
                            {activeFilterCount > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="ml-2 bg-purple-400/20 text-purple-100"
                                >
                                    {activeFilterCount}
                                </Badge>
                            )}
                            <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-96 p-6 bg-purple-600/10 backdrop-blur-lg border border-purple-600/30"
                        align="end"
                    >
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-medium text-purple-100">
                                    Advanced Filters
                                </h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClear}
                                    className="text-purple-300 hover:text-purple-100"
                                >
                                    Clear All
                                </Button>
                            </div>

                            {/* Message Types */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-purple-200">
                                    Message Types
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {MESSAGE_TYPES.map((type) => (
                                        <Button
                                            key={type.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                toggleArrayFilter(
                                                    "messageType",
                                                    type.id
                                                )
                                            }
                                            className={cn(
                                                "justify-start border-purple-500/30 text-purple-200 hover:bg-purple-500/20",
                                                localFilters.messageType?.includes(
                                                    type.id
                                                ) &&
                                                    "bg-purple-500/30 text-purple-100"
                                            )}
                                        >
                                            {type.icon}
                                            <span className="ml-2">
                                                {type.label}
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Models */}
                            {availableOptions.models && (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-purple-200">
                                        AI Models
                                    </label>
                                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                                        {availableOptions.models.map(
                                            (model) => (
                                                <Button
                                                    key={model}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        toggleArrayFilter(
                                                            "models",
                                                            model
                                                        )
                                                    }
                                                    className={cn(
                                                        "justify-start text-xs border-purple-500/30 text-purple-200 hover:bg-purple-500/20",
                                                        localFilters.models?.includes(
                                                            model
                                                        ) &&
                                                            "bg-purple-500/30 text-purple-100"
                                                    )}
                                                >
                                                    <Cpu className="w-3 h-3 mr-2" />
                                                    {model}
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Projects */}
                            {availableOptions.projects && (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-purple-200">
                                        Projects
                                    </label>
                                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                                        {availableOptions.projects.map(
                                            (project) => (
                                                <Button
                                                    key={project}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        toggleArrayFilter(
                                                            "projects",
                                                            project
                                                        )
                                                    }
                                                    className={cn(
                                                        "justify-start text-xs border-purple-500/30 text-purple-200 hover:bg-purple-500/20 truncate",
                                                        localFilters.projects?.includes(
                                                            project
                                                        ) &&
                                                            "bg-purple-500/30 text-purple-100"
                                                    )}
                                                >
                                                    <MessageSquare className="w-3 h-3 mr-2 flex-shrink-0" />
                                                    {project}
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Numeric Filters */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-purple-200">
                                        Min Messages
                                    </label>
                                    <Input
                                        type="number"
                                        value={localFilters.minMessages || ""}
                                        onChange={(e) =>
                                            updateFilter(
                                                "minMessages",
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        placeholder="0"
                                        className="bg-purple-500/10 border-purple-500/30 text-purple-100"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-purple-200">
                                        Date Range
                                    </label>
                                    <select
                                        value={
                                            localFilters.dateRange || "month"
                                        }
                                        onChange={(e) =>
                                            updateFilter(
                                                "dateRange",
                                                e.target.value
                                            )
                                        }
                                        className="w-full px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-md text-purple-100 text-sm"
                                    >
                                        <option value="today">Today</option>
                                        <option value="week">This Week</option>
                                        <option value="month">
                                            This Month
                                        </option>
                                        <option value="custom">
                                            Custom Range
                                        </option>
                                    </select>
                                </div>
                            </div>

                            {/* Toggle Options */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                                    <div>
                                        <label className="text-sm font-medium text-purple-200">
                                            Include Deleted Items
                                        </label>
                                        <p className="text-xs text-purple-400">
                                            Show deleted chats and messages
                                        </p>
                                    </div>
                                    <Switch
                                        checked={
                                            localFilters.showDeleted || false
                                        }
                                        onCheckedChange={(checked) =>
                                            updateFilter("showDeleted", checked)
                                        }
                                    />
                                </div>
                            </div>

                            {/* Sort Options */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-purple-200">
                                        Sort By
                                    </label>
                                    <select
                                        value={localFilters.sortBy || "date"}
                                        onChange={(e) =>
                                            updateFilter(
                                                "sortBy",
                                                e.target.value
                                            )
                                        }
                                        className="w-full px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-md text-purple-100 text-sm"
                                    >
                                        {SORT_OPTIONS.map((option) => (
                                            <option
                                                key={option.id}
                                                value={option.id}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-purple-200">
                                        Order
                                    </label>
                                    <select
                                        value={localFilters.sortOrder || "desc"}
                                        onChange={(e) =>
                                            updateFilter(
                                                "sortOrder",
                                                e.target.value
                                            )
                                        }
                                        className="w-full px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-md text-purple-100 text-sm"
                                    >
                                        <option value="desc">Descending</option>
                                        <option value="asc">Ascending</option>
                                    </select>
                                </div>
                            </div>

                            {/* Apply Button */}
                            <div className="pt-4 border-t border-purple-600/20">
                                <Button
                                    onClick={() => {
                                        onApplyFilters();
                                        setShowAdvancedFilters(false);
                                    }}
                                    className="w-full bg-purple-500/30 hover:bg-purple-500/40"
                                >
                                    Apply Filters
                                    {activeFilterCount > 0 && (
                                        <Badge
                                            variant="secondary"
                                            className="ml-2 bg-purple-400/20 text-purple-100"
                                        >
                                            {activeFilterCount}
                                        </Badge>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Active Filters Display */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {localFilters.search && (
                        <Badge
                            variant="outline"
                            className="border-purple-500/30 text-purple-300 flex items-center gap-1"
                        >
                            Search: "{localFilters.search}"
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateFilter("search", "")}
                                className="h-4 w-4 p-0 text-purple-400 hover:text-purple-200"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </Badge>
                    )}

                    {localFilters.messageType?.map((type) => (
                        <Badge
                            key={type}
                            variant="outline"
                            className="border-purple-500/30 text-purple-300 flex items-center gap-1"
                        >
                            {MESSAGE_TYPES.find((t) => t.id === type)?.label}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    toggleArrayFilter("messageType", type)
                                }
                                className="h-4 w-4 p-0 text-purple-400 hover:text-purple-200"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </Badge>
                    ))}

                    {localFilters.models?.map((model) => (
                        <Badge
                            key={model}
                            variant="outline"
                            className="border-purple-500/30 text-purple-300 flex items-center gap-1"
                        >
                            {model}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    toggleArrayFilter("models", model)
                                }
                                className="h-4 w-4 p-0 text-purple-400 hover:text-purple-200"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </Badge>
                    ))}

                    {localFilters.projects?.map((project) => (
                        <Badge
                            key={project}
                            variant="outline"
                            className="border-purple-500/30 text-purple-300 flex items-center gap-1"
                        >
                            {project}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    toggleArrayFilter("projects", project)
                                }
                                className="h-4 w-4 p-0 text-purple-400 hover:text-purple-200"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </Badge>
                    ))}

                    {activeFilterCount > 0 && (
                        <Button
                            onClick={handleClear}
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 text-red-300 hover:bg-red-500/20"
                        >
                            Clear All Filters
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
