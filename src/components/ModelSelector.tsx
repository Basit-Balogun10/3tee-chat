import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SettingsModal } from "./SettingsModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
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
    Filter,
} from "lucide-react";
import {
    PROVIDER_CONFIGS,
    getAvailableModels,
    getProviderInfo,
    ModelCapabilities,
} from "../lib/modelConfig";

// --- PROPS INTERFACE ---
interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (model: string) => void;
    context?: "message" | "settings" | "retry-message" | "multi-ai";
    currentDefaultModel?: string;
    openByDefault?: boolean;
    // Multi-AI support
    multiSelect?: boolean;
    selectedModels?: string[];
    onModelsChange?: (models: string[]) => void;
    maxSelections?: number;
}

export function ModelSelector({
    selectedModel,
    onModelChange,
    context = "message",
    currentDefaultModel,
    openByDefault = false,
    // Multi-AI props
    multiSelect = false,
    selectedModels = [],
    onModelsChange,
    maxSelections = 8,
}: ModelSelectorProps) {
    // --- STATE MANAGEMENT ---
    const [showModal, setShowModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCapability, setSelectedCapability] = useState<string>("all");
    const [selectedProvider, setSelectedProvider] = useState<string>("all");
    const [contextWindowFilter, setContextWindowFilter] =
        useState<string>("all");
    const [showFilters, setShowFilters] = useState(false);

    // Context window filter options
    const contextWindowOptions = [
        { id: "all", label: "All Context" },
        { id: "small", label: "Small (≤32K)", max: 32000 },
        { id: "medium", label: "Medium (≤128K)", max: 128000 },
        { id: "large", label: "Large (≤1M)", max: 1000000 },
        { id: "xlarge", label: "Extra Large (>1M)", min: 1000000 },
    ];

    // --- DATA FETCHING & LOGIC ---
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

    // Create capability tabs and icons based on actual capabilities from modelConfig
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

    // This is the core filtering logic, now with provider filtering
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

            // Check capability filter - now using actual capability keys from ModelCapabilities
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

    // --- EVENT HANDLERS & DERIVED STATE ---
    const selectedModelInfo = availableModels.find(
        (m) => m.id === selectedModel
    );

    const getModalTitle = () => {
        if (context === "multi-ai")
            return {
                title: "Select AI Models",
                subtitle: `Choose 2-${maxSelections} models to generate multiple responses`,
            };
        if (context === "settings")
            return {
                title: "Select Default AI Model",
                subtitle: "Choose your preferred model for new conversations",
            };
        if (context === "retry-message")
            return {
                title: "Retry with Different Model",
                subtitle:
                    "Choose a different model to regenerate this response",
            };
        return {
            title: "Select AI Model",
            subtitle: "Choose your preferred model for this conversation",
        };
    };

    const handleSelectModel = (modelId: string) => {
        if (multiSelect && onModelsChange) {
            const currentSelections = selectedModels || [];

            if (currentSelections.includes(modelId)) {
                // Remove if already selected
                const newSelections = currentSelections.filter(
                    (id) => id !== modelId
                );
                onModelsChange(newSelections);
            } else {
                // Add if not at max limit
                if (currentSelections.length < maxSelections) {
                    onModelsChange([...currentSelections, modelId]);
                }
            }
        } else {
            onModelChange(modelId);
            setShowModal(false);
        }
    };

    const handleOpenModal = () => {
        setShowModal(true);
        setSearchQuery("");
        setSelectedCapability("all");
        setSelectedProvider(selectedModelInfo?.provider || "all");
    };

    const getProviderDisplayInfo = (providerId: string) => {
        const config = PROVIDER_CONFIGS[providerId];
        if (!config) return { name: "Unknown", color: "text-gray-400" };
        // We'll create a simple color mapping to match your old UI's style
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

    // Listen for keyboard shortcut to open model selector
    useEffect(() => {
        document.addEventListener("openModelSelector", handleOpenModal);
        return () =>
            document.removeEventListener("openModelSelector", handleOpenModal);
    }, []);

    // --- OPEN MODAL ON DEFAULT ---
    useEffect(() => {
        if (openByDefault) {
            handleOpenModal();
        }
    }, [openByDefault, handleOpenModal]);

    const { title, subtitle } = getModalTitle();
    const highlightedModelId =
        context === "settings"
            ? currentDefaultModel || selectedModel
            : selectedModel;

    return (
        <>
            <button
                onClick={handleOpenModal}
                className="flex h-8 min-w-max items-center justify-between rounded-md border border-purple-600/30 bg-gray-900/60 px-3 py-2 text-sm text-purple-100 hover:border-purple-500/50 transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400 focus:outline-none"
            >
                {multiSelect ? (
                    <div className="flex items-center gap-2">
                        {selectedModels.length === 0 ? (
                            <span>Select AI models</span>
                        ) : (
                            <>
                                <span className="text-xs text-purple-300">
                                    {selectedModels.length} models selected
                                </span>
                                {selectedModels.slice(0, 2).map((modelId) => {
                                    const model = availableModels.find(
                                        (m) => m.id === modelId
                                    );
                                    return model ? (
                                        <span
                                            key={modelId}
                                            className="text-xs bg-purple-500/20 px-1 rounded"
                                        >
                                            {model.name}
                                        </span>
                                    ) : null;
                                })}
                                {selectedModels.length > 2 && (
                                    <span className="text-xs text-purple-400">
                                        +{selectedModels.length - 2} more
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                ) : selectedModelInfo ? (
                    <div className="flex items-center gap-2">
                        <span
                            className={`text-xs ${getProviderDisplayInfo(selectedModelInfo.provider).color}`}
                        >
                            {selectedModelInfo.providerName}
                        </span>
                        <span className="text-xs">
                            {selectedModelInfo.name}
                        </span>
                        {selectedModelInfo.userKeyEnabled && (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                        )}
                    </div>
                ) : (
                    <span>Select AI model</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
            </button>

            {/* Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent
                    className="bg-transparent backdrop-blur-md border border-purple-600/30 text-purple-100 max-w-2xl max-h-[95vh] overflow-y-scroll p-0"
                    hideCloseButton
                >
                    <div className="p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-purple-100">
                                        {title}
                                    </h2>
                                    {!multiSelect && (
                                        <p className="text-sm text-purple-400">
                                            {subtitle}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {multiSelect &&
                                        selectedModels.length >= 2 && (
                                            <button
                                                onClick={() =>
                                                    setShowModal(false)
                                                }
                                                className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-sm hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                                            >
                                                Done ({selectedModels.length})
                                            </button>
                                        )}
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-purple-300" />
                                    </button>
                                </div>
                            </DialogTitle>
                        </DialogHeader>

                        {/* Search Input with Filter Button */}
                        <div className="flex gap-2 mb-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
                                <input
                                    type="text"
                                    placeholder="Search models..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-purple-600/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:border-purple-500/50 text-sm"
                                    autoFocus
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
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                                    showFilters || selectedProvider !== "all" || selectedCapability !== "all" || contextWindowFilter !== "all"
                                        ? "bg-purple-500/20 border-purple-500/40 text-purple-200"
                                        : "bg-gray-800/50 border-purple-600/30 text-purple-400 hover:border-purple-500/50"
                                }`}
                                title="Filter models"
                            >
                                <Filter className="w-4 h-4" />
                                <span className="text-sm">Filter</span>
                            </button>
                        </div>

                        {/* Collapsible Filter Panel */}
                        {showFilters && (
                            <div className="mb-4 p-4 bg-gray-800/30 rounded-lg border border-purple-600/20 space-y-4">
                                {/* Provider Filter */}
                                <div>
                                    <label className="block text-sm text-purple-400 mb-2">Provider</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedProvider("all")}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                selectedProvider === "all"
                                                    ? "bg-purple-500/20 text-purple-100 border border-purple-500/40"
                                                    : "bg-gray-800/30 text-purple-300 hover:bg-purple-500/10 border border-transparent"
                                            }`}
                                        >
                                            All Providers
                                        </button>
                                        {availableProviders.map((provider) => (
                                            <button
                                                key={provider.id}
                                                onClick={() => setSelectedProvider(provider.id)}
                                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                    selectedProvider === provider.id
                                                        ? "bg-purple-500/20 text-purple-100 border border-purple-500/40"
                                                        : "bg-gray-800/30 text-purple-300 hover:bg-purple-500/10 border border-transparent"
                                                }`}
                                            >
                                                {provider.displayName}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Capability Filter */}
                                <div>
                                    <label className="block text-sm text-purple-400 mb-2">Capabilities</label>
                                    <div className="flex flex-wrap gap-2">
                                        {capabilityTabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setSelectedCapability(tab.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                    selectedCapability === tab.id
                                                        ? "bg-purple-500/20 text-purple-100 border border-purple-500/40"
                                                        : "bg-gray-800/30 text-purple-300 hover:bg-purple-500/10 border border-transparent"
                                                }`}
                                            >
                                                {tab.icon}
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Context Window Filter */}
                                <div>
                                    <label className="block text-sm text-purple-400 mb-2">Context Window</label>
                                    <div className="flex flex-wrap gap-2">
                                        {contextWindowOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                onClick={() => setContextWindowFilter(option.id)}
                                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                    contextWindowFilter === option.id
                                                        ? "bg-purple-500/20 text-purple-100 border border-purple-500/40"
                                                        : "bg-gray-800/30 text-purple-300 hover:bg-purple-500/10 border border-transparent"
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Clear Filters */}
                                {(selectedProvider !== "all" || selectedCapability !== "all" || contextWindowFilter !== "all") && (
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => {
                                                setSelectedProvider("all");
                                                setSelectedCapability("all");
                                                setContextWindowFilter("all");
                                            }}
                                            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                                        >
                                            Clear all filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="overflow-y-auto px-2">
                            {filteredModels.length === 0 ? (
                                <div className="p-8 text-center text-purple-400 text-sm">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-600/20 flex items-center justify-center">
                                        <Search className="w-6 h-6" />
                                    </div>
                                    No models found matching your criteria
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredModels.map((model) => {
                                        const isSelected = multiSelect
                                            ? selectedModels.includes(model.id)
                                            : model.id === highlightedModelId;
                                        const isDisabled =
                                            multiSelect &&
                                            !selectedModels.includes(
                                                model.id
                                            ) &&
                                            selectedModels.length >=
                                                maxSelections;

                                        const capabilitiesToDisplay =
                                            Object.entries(model.capabilities)
                                                .filter(([, hasCap]) => hasCap)
                                                .map(([cap]) => {
                                                    const map: Record<
                                                        string,
                                                        string
                                                    > = {
                                                        liveChat: "voice",
                                                        webSearch: "web-search",
                                                        structuredOutput:
                                                            "research",
                                                    };
                                                    return map[cap] || cap;
                                                });

                                        return (
                                            <div
                                                key={model.id}
                                                ref={
                                                    isSelected && !multiSelect
                                                        ? (el) => {
                                                              if (el) {
                                                                  setTimeout(
                                                                      () => {
                                                                          el.scrollIntoView(
                                                                              {
                                                                                  block: "center",
                                                                              }
                                                                          );
                                                                      },
                                                                      100
                                                                  );
                                                              }
                                                          }
                                                        : null
                                                }
                                                onClick={() =>
                                                    !isDisabled &&
                                                    handleSelectModel(model.id)
                                                }
                                                className={`group relative p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                                                    isSelected
                                                        ? "bg-purple-500/20 border-purple-500/40"
                                                        : isDisabled
                                                          ? "opacity-50 cursor-not-allowed border-transparent"
                                                          : "hover:bg-purple-500/10 border-transparent hover:border-purple-600/30"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-2">
                                                            {multiSelect && (
                                                                <div
                                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                                        isSelected
                                                                            ? "bg-purple-500 border-purple-500"
                                                                            : "border-purple-400"
                                                                    }`}
                                                                >
                                                                    {isSelected && (
                                                                        <CheckCircle className="w-3 h-3 text-white" />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <h3 className="font-semibold text-purple-100">
                                                                {model.name}
                                                            </h3>
                                                            {/* Context Window Badge */}
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
                                                                (
                                                                    capability
                                                                ) => {
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
                                                                setShowSettings(
                                                                    true
                                                                );
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-3 py-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 rounded-lg border border-purple-500/30"
                                                        >
                                                            Configure
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {showSettings && context !== "settings" && (
                <SettingsModal
                    open={showSettings}
                    onOpenChange={setShowSettings}
                />
            )}
        </>
    );
}
