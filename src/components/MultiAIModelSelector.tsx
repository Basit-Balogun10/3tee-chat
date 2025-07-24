import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import {
    ChevronDown,
    CheckCircle,
    Eye,
    Paperclip,
    Mic,
    FileText,
    Search,
    Globe,
    MessageSquare,
    X,
    Video,
    Image,
    Zap,
    Plus,
    Minus,
    Sparkles,
    Brain,
} from "lucide-react";
import {
    PROVIDER_CONFIGS,
    getAvailableModels,
    getProviderInfo,
    ModelCapabilities,
} from "../lib/modelConfig";
import { toast } from "sonner";

interface MultiAIModelSelectorProps {
    selectedModels: string[];
    onModelsChange: (models: string[]) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MultiAIModelSelector({
    selectedModels,
    onModelsChange,
    open,
    onOpenChange,
}: MultiAIModelSelectorProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCapability, setSelectedCapability] = useState<string>("all");
    const [selectedProvider, setSelectedProvider] = useState<string>("all");
    const [contextWindowFilter, setContextWindowFilter] =
        useState<string>("all");

    // Context window filter options
    const contextWindowOptions = [
        { id: "all", label: "All Context" },
        { id: "small", label: "Small (≤32K)", max: 32000 },
        { id: "medium", label: "Medium (≤128K)", max: 128000 },
        { id: "large", label: "Large (≤1M)", max: 1000000 },
        { id: "xlarge", label: "Extra Large (>1M)", min: 1000000 },
    ];

    // Data fetching & logic
    const preferences = useQuery(api.preferences.getUserPreferences);
    const userApiKeys = preferences?.apiKeys || {};
    const userApiKeyPreferences = preferences?.apiKeyPreferences || {};

    const availableProviders = useMemo(
        () => getProviderInfo(userApiKeys, userApiKeyPreferences),
        [userApiKeys, userApiKeyPreferences]
    );

    const availableModels = useMemo(
        () => getAvailableModels(userApiKeys, userApiKeyPreferences),
        [userApiKeys, userApiKeyPreferences]
    );

    // Create capability tabs and icons
    const capabilityIcons: Record<
        keyof ModelCapabilities,
        { icon: JSX.Element; label: string }
    > = {
        textGeneration: {
            icon: <FileText className="w-3 h-3" />,
            label: "Text",
        },
        imageGeneration: {
            icon: <Image className="w-3 h-3" />,
            label: "Image Gen",
        },
        videoGeneration: {
            icon: <Video className="w-3 h-3" />,
            label: "Video Gen",
        },
        vision: { icon: <Eye className="w-3 h-3" />, label: "Vision" },
        files: { icon: <Paperclip className="w-3 h-3" />, label: "Files" },
        webSearch: { icon: <Globe className="w-3 h-3" />, label: "Web Search" },
        liveChat: { icon: <Mic className="w-3 h-3" />, label: "Live Chat" },
        structuredOutput: {
            icon: <Zap className="w-3 h-3" />,
            label: "Structured",
        },
    };

    const capabilityTabs = [
        {
            id: "all",
            label: "All",
            icon: <MessageSquare className="w-3 h-3" />,
        },
        {
            id: "vision",
            label: "Vision",
            icon: capabilityIcons.vision.icon,
        },
        {
            id: "files",
            label: "Files",
            icon: capabilityIcons.files.icon,
        },
        {
            id: "liveChat",
            label: "Voice",
            icon: capabilityIcons.liveChat.icon,
        },
        {
            id: "webSearch",
            label: "Web",
            icon: capabilityIcons.webSearch.icon,
        },
        {
            id: "imageGeneration",
            label: "Image Gen",
            icon: capabilityIcons.imageGeneration.icon,
        },
        {
            id: "videoGeneration",
            label: "Video Gen",
            icon: capabilityIcons.videoGeneration.icon,
        },
        {
            id: "structuredOutput",
            label: "Canvas",
            icon: capabilityIcons.structuredOutput.icon,
        },
    ];

    // Filtering logic
    const filteredModels = useMemo(() => {
        return availableModels.filter((model) => {
            // Filter by selected provider tab
            if (
                selectedProvider !== "all" &&
                model.provider !== selectedProvider
            ) {
                return false;
            }

            const modelName = model.name;
            const modelDescription = model.description || "";
            const providerName = model.providerName || "";

            const matchesSearch =
                modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                modelDescription
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                providerName.toLowerCase().includes(searchQuery.toLowerCase());

            // Check capability filter
            const matchesCapability =
                selectedCapability === "all" ||
                model.capabilities[
                    selectedCapability as keyof ModelCapabilities
                ];

            // Check context window filter
            const contextWindow = contextWindowOptions.find(
                (option) => option.id === contextWindowFilter
            );
            const maxContext =
                contextWindow?.max !== undefined ? contextWindow.max : Infinity;
            const minContext =
                contextWindow?.min !== undefined
                    ? contextWindow.min
                    : -Infinity;

            const modelContextLength = model.contextLength || 0;

            const matchesContextWindow =
                modelContextLength <= maxContext &&
                modelContextLength >= minContext;

            return matchesSearch && matchesCapability && matchesContextWindow;
        });
    }, [
        availableModels,
        searchQuery,
        selectedCapability,
        selectedProvider,
        contextWindowFilter,
    ]);

    // Selected models info
    const selectedModelsInfo = useMemo(() => {
        return selectedModels
            .map((modelId) => availableModels.find((m) => m.id === modelId))
            .filter(Boolean);
    }, [selectedModels, availableModels]);

    const getProviderDisplayInfo = (providerId: string) => {
        const config = PROVIDER_CONFIGS[providerId];
        if (!config) return { name: "Unknown", color: "text-gray-400" };

        const colorMap: Record<string, string> = {
            openai: "text-green-400",
            google: "text-blue-400",
            anthropic: "text-orange-400",
            deepseek: "text-purple-400",
            openrouter: "text-indigo-400",
        };
        return {
            name: config.displayName,
            color: colorMap[providerId] || "text-gray-400",
        };
    };

    const handleAddModel = (modelId: string) => {
        if (!selectedModels.includes(modelId)) {
            onModelsChange([...selectedModels, modelId]);
        }
    };

    const handleRemoveModel = (modelId: string) => {
        onModelsChange(selectedModels.filter((id) => id !== modelId));
    };

    const handleClearAll = () => {
        onModelsChange([]);
    };

    const handleQuickSelect = (
        type: "top3" | "diverse" | "coding" | "creative"
    ) => {
        let modelsToSelect: string[] = [];

        switch (type) {
            case "top3":
                // Select top 3 recommended models
                modelsToSelect = availableModels
                    .filter((m) => m.isRecommended)
                    .slice(0, 3)
                    .map((m) => m.id);
                break;
            case "diverse":
                // Select diverse models from different providers
                const providerGroups = availableModels.reduce(
                    (acc, model) => {
                        if (!acc[model.provider]) acc[model.provider] = [];
                        acc[model.provider].push(model);
                        return acc;
                    },
                    {} as Record<string, typeof availableModels>
                );

                modelsToSelect = Object.values(providerGroups)
                    .map((models) => models[0]?.id)
                    .filter(Boolean)
                    .slice(0, 4);
                break;
            case "coding":
                // Select coding-focused models
                modelsToSelect = availableModels
                    .filter(
                        (m) =>
                            m.name.toLowerCase().includes("code") ||
                            m.name.toLowerCase().includes("coder") ||
                            m.description?.toLowerCase().includes("coding")
                    )
                    .slice(0, 3)
                    .map((m) => m.id);
                break;
            case "creative":
                // Select creative/writing models
                modelsToSelect = availableModels
                    .filter(
                        (m) =>
                            m.capabilities.imageGeneration ||
                            m.capabilities.videoGeneration ||
                            m.name.toLowerCase().includes("creative")
                    )
                    .slice(0, 3)
                    .map((m) => m.id);
                break;
        }

        if (modelsToSelect.length >= 2) {
            onModelsChange(modelsToSelect);
            toast.success(
                `Selected ${modelsToSelect.length} models for ${type} comparison`
            );
        } else {
            toast.error(`Not enough ${type} models available`);
        }
    };

    // Reset search when modal closes
    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setSelectedCapability("all");
            setSelectedProvider("all");
            setContextWindowFilter("all");
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="bg-gray-900/95 backdrop-blur-sm border border-purple-600/30 text-purple-100 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                hideCloseButton
            >
                {/* Header */}
                <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-purple-600/20 pb-4 z-10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Brain className="w-6 h-6 text-purple-400" />
                                <div>
                                    <h2 className="text-xl font-semibold text-purple-100">
                                        Multi-AI Model Selection
                                    </h2>
                                    <p className="text-sm text-purple-400">
                                        Choose 2+ models to compare responses in
                                        parallel
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="p-2 rounded-lg hover:bg-purple-500/30 transition-colors"
                            >
                                <X className="w-5 h-5 text-purple-200" />
                            </button>
                        </DialogTitle>
                    </DialogHeader>

                    {/* Selected Models Display */}
                    <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-purple-200">
                                Selected Models ({selectedModels.length}/8)
                            </span>
                            {selectedModels.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>

                        {selectedModels.length === 0 ? (
                            <div className="text-center py-4 text-purple-400 text-sm">
                                Select at least 2 models to enable multi-AI mode
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {selectedModelsInfo.map((model) => (
                                    <div
                                        key={model.id}
                                        className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/40 rounded-lg text-sm"
                                    >
                                        <span
                                            className={`text-xs ${getProviderDisplayInfo(model.provider).color}`}
                                        >
                                            {
                                                getProviderDisplayInfo(
                                                    model.provider
                                                ).name
                                            }
                                        </span>
                                        <span className="text-purple-100">
                                            {model.name}
                                        </span>
                                        <button
                                            onClick={() =>
                                                handleRemoveModel(model.id)
                                            }
                                            className="text-purple-300 hover:text-red-400 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Quick Select Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => handleQuickSelect("top3")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-xs hover:bg-blue-500/30 transition-colors"
                            >
                                <Sparkles className="w-3 h-3" />
                                Top 3
                            </button>
                            <button
                                onClick={() => handleQuickSelect("diverse")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-xs hover:bg-green-500/30 transition-colors"
                            >
                                <Globe className="w-3 h-3" />
                                Diverse
                            </button>
                            <button
                                onClick={() => handleQuickSelect("coding")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 text-orange-300 rounded-lg text-xs hover:bg-orange-500/30 transition-colors"
                            >
                                <FileText className="w-3 h-3" />
                                Coding
                            </button>
                            <button
                                onClick={() => handleQuickSelect("creative")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-pink-500/20 text-pink-300 rounded-lg text-xs hover:bg-pink-500/30 transition-colors"
                            >
                                <Image className="w-3 h-3" />
                                Creative
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 space-y-4">
                    {/* Provider Filter Tabs */}
                    <Tabs
                        value={selectedProvider}
                        onValueChange={setSelectedProvider}
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-6 bg-purple-600/20 p-1 h-auto space-x-2">
                            <TabsTrigger
                                value="all"
                                className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                            >
                                All
                            </TabsTrigger>
                            {availableProviders.map((provider) => (
                                <TabsTrigger
                                    key={provider.id}
                                    value={provider.id}
                                    className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                                >
                                    {provider.displayName}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
                        <input
                            type="text"
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-purple-600/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:border-purple-500/50 text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Capability Filter */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {capabilityTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSelectedCapability(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedCapability === tab.id ? "bg-purple-500/20 text-purple-100 border border-purple-500/40" : "bg-gray-800/30 text-purple-300 hover:bg-purple-500/10 border border-transparent"}`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Context Window Filter */}
                    <Tabs
                        value={contextWindowFilter}
                        onValueChange={setContextWindowFilter}
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-5 bg-purple-600/20 p-1 h-auto space-x-2">
                            {contextWindowOptions.map((option) => (
                                <TabsTrigger
                                    key={option.id}
                                    value={option.id}
                                    className="text-purple-200 data-[state=active]:bg-purple-500/30 hover:bg-purple-500/20 transition-colors"
                                >
                                    {option.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

                {/* Models List */}
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {filteredModels.length === 0 ? (
                        <div className="p-8 text-center text-purple-400 text-sm">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-600/20 flex items-center justify-center">
                                <Search className="w-6 h-6" />
                            </div>
                            No models found matching your criteria
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredModels.map((model) => {
                                const isSelected = selectedModels.includes(
                                    model.id
                                );
                                const canSelect = selectedModels.length < 8;

                                const capabilitiesToDisplay = Object.entries(
                                    model.capabilities
                                )
                                    .filter(([, hasCap]) => hasCap)
                                    .map(([cap]) => {
                                        const map: Record<string, string> = {
                                            textGeneration: "text",
                                            imageGeneration: "image-gen",
                                            videoGeneration: "video-gen",
                                            vision: "vision",
                                            files: "files",
                                            webSearch: "web-search",
                                            liveChat: "voice",
                                            structuredOutput: "research",
                                        };
                                        return map[cap] || cap;
                                    });

                                return (
                                    <div
                                        key={model.id}
                                        className={`group relative p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                                            isSelected
                                                ? "bg-purple-500/20 border-purple-500/40"
                                                : "hover:bg-purple-500/10 border-transparent hover:border-purple-600/30"
                                        }`}
                                        onClick={() => {
                                            if (isSelected) {
                                                handleRemoveModel(model.id);
                                            } else if (canSelect) {
                                                handleAddModel(model.id);
                                            }
                                        }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-2">
                                                    <h3 className="font-semibold text-purple-100">
                                                        {model.name}
                                                    </h3>
                                                    {model.contextLength && (
                                                        <span className="flex items-center gap-1 text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                                                            <FileText className="w-3 h-3" />
                                                            {model.contextLength >=
                                                            1000000
                                                                ? `${(model.contextLength / 1000000).toFixed(1)}M`
                                                                : model.contextLength >=
                                                                    1000
                                                                  ? `${model.contextLength / 1000}K`
                                                                  : model.contextLength.toString()}{" "}
                                                            tokens
                                                        </span>
                                                    )}
                                                    {model.userKeyEnabled && (
                                                        <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                                                            Personal Key
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-sm text-purple-300 mb-3 leading-relaxed">
                                                    {model.description ||
                                                        "No description available."}
                                                </p>

                                                <div className="flex flex-wrap gap-2">
                                                    {capabilitiesToDisplay.map(
                                                        (capability) => {
                                                            const capData =
                                                                capabilityIcons[
                                                                    capability as keyof typeof capabilityIcons
                                                                ];
                                                            return capData ? (
                                                                <div
                                                                    key={
                                                                        capability
                                                                    }
                                                                    className="flex items-center gap-1 bg-white/5 border border-white/10 text-gray-300 px-2 py-1 rounded text-xs"
                                                                    title={
                                                                        capData.label
                                                                    }
                                                                >
                                                                    {
                                                                        capData.icon
                                                                    }
                                                                    <span>
                                                                        {
                                                                            capData.label
                                                                        }
                                                                    </span>
                                                                </div>
                                                            ) : null;
                                                        }
                                                    )}
                                                </div>
                                            </div>

                                            <div className="ml-4 flex items-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isSelected) {
                                                            handleRemoveModel(
                                                                model.id
                                                            );
                                                        } else if (canSelect) {
                                                            handleAddModel(
                                                                model.id
                                                            );
                                                        }
                                                    }}
                                                    disabled={
                                                        !canSelect &&
                                                        !isSelected
                                                    }
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        isSelected
                                                            ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                                            : canSelect
                                                              ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                                                              : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                                                    }`}
                                                    title={
                                                        isSelected
                                                            ? "Remove model"
                                                            : canSelect
                                                              ? "Add model"
                                                              : "Maximum 8 models selected"
                                                    }
                                                >
                                                    {isSelected ? (
                                                        <Minus className="w-4 h-4" />
                                                    ) : (
                                                        <Plus className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-purple-600/20 pt-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-purple-400">
                            {selectedModels.length < 2 ? (
                                <span className="text-orange-300">
                                    Select at least 2 models to compare
                                    responses
                                </span>
                            ) : (
                                <span className="text-green-300">
                                    Ready to compare {selectedModels.length}{" "}
                                    models
                                </span>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="text-purple-300 hover:text-purple-200"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => onOpenChange(false)}
                                disabled={selectedModels.length < 2}
                                className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                            >
                                Use Selected Models ({selectedModels.length})
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
