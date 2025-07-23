import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
    Settings,
    X,
    ChevronDown,
    RotateCcw,
    Zap,
    Brain,
    Thermometer,
    MessageSquare,
    Hash,
    Sliders,
} from "lucide-react";

interface ChatAISettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chatId: Id<"chats">;
}

interface ChatAISettings {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    responseMode?: "balanced" | "concise" | "detailed" | "creative" | "analytical" | "friendly" | "professional";
    promptEnhancement?: boolean;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}

export function ChatAISettingsModal({
    open,
    onOpenChange,
    chatId,
}: ChatAISettingsModalProps) {
    const [localSettings, setLocalSettings] = useState<ChatAISettings>({});
    const [useGlobalSettings, setUseGlobalSettings] = useState(true);

    // Get global user preferences
    const globalPreferences = useQuery(api.preferences.getUserPreferences);
    
    // Get chat-specific settings (we'll extend the chat schema to store per-chat AI settings)
    const chat = useQuery(api.chats.getChat, { chatId });

    // Mutations
    const updateChatAISettings = useMutation(api.chats.updateChatAISettings);

    // Initialize local settings
    useEffect(() => {
        if (chat && globalPreferences) {
            const chatAISettings = chat.aiSettings || {};
            const hasCustomSettings = Object.keys(chatAISettings).length > 0;
            
            setUseGlobalSettings(!hasCustomSettings);
            setLocalSettings(hasCustomSettings ? chatAISettings : globalPreferences.aiSettings || {});
        }
    }, [chat, globalPreferences]);

    const handleSave = async () => {
        try {
            if (useGlobalSettings) {
                // Remove chat-specific settings to use global ones
                await updateChatAISettings({
                    chatId,
                    aiSettings: null, // Clear custom settings
                });
            } else {
                // Save chat-specific settings
                await updateChatAISettings({
                    chatId,
                    aiSettings: localSettings,
                });
            }
            
            toast.success("AI settings updated for this chat!");
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save chat AI settings:", error);
            toast.error("Failed to save AI settings. Please try again.");
        }
    };

    const resetToDefaults = () => {
        const defaultSettings: ChatAISettings = {
            temperature: 0.7,
            maxTokens: undefined,
            systemPrompt: "",
            responseMode: "balanced",
            promptEnhancement: false,
            topP: 0.9,
            frequencyPenalty: 0,
            presencePenalty: 0,
        };
        setLocalSettings(defaultSettings);
    };

    const responseModes = [
        { id: 'balanced', label: 'Balanced', desc: 'Well-rounded responses', icon: <Sliders className="w-3 h-3" /> },
        { id: 'concise', label: 'Concise', desc: 'Brief and to the point', icon: <MessageSquare className="w-3 h-3" /> },
        { id: 'detailed', label: 'Detailed', desc: 'Comprehensive explanations', icon: <Hash className="w-3 h-3" /> },
        { id: 'creative', label: 'Creative', desc: 'More imaginative responses', icon: <Zap className="w-3 h-3" /> },
        { id: 'analytical', label: 'Analytical', desc: 'Data-driven approach', icon: <Brain className="w-3 h-3" /> },
        { id: 'friendly', label: 'Friendly', desc: 'Casual and approachable', icon: <MessageSquare className="w-3 h-3" /> },
        { id: 'professional', label: 'Professional', desc: 'Formal business tone', icon: <Settings className="w-3 h-3" /> }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900/95 backdrop-blur-lg border border-purple-500/30 text-purple-100 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-purple-400" />
                            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Chat AI Settings
                            </span>
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5 text-purple-400" />
                        </button>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-1">
                    <div className="space-y-6">
                        {/* Chat Title */}
                        <div className="text-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                            <h3 className="text-purple-200 font-medium">{chat?.title}</h3>
                            <p className="text-sm text-purple-400">Model: {chat?.model}</p>
                        </div>

                        {/* Global vs Custom Settings Toggle */}
                        <div className="flex items-center justify-between p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                            <div>
                                <h4 className="text-purple-100 font-medium">Settings Source</h4>
                                <p className="text-sm text-purple-300 mt-1">
                                    {useGlobalSettings ? "Using global AI settings" : "Using custom settings for this chat"}
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!useGlobalSettings}
                                    onChange={(e) => setUseGlobalSettings(!e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-purple-600/30 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                            </label>
                        </div>

                        {!useGlobalSettings && (
                            <div className="space-y-6">
                                {/* Reset Button */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={resetToDefaults}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-md border border-purple-500/30 transition-all duration-200"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Reset to Defaults
                                    </button>
                                </div>

                                {/* Temperature */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Thermometer className="w-4 h-4 text-purple-400" />
                                            <label className="text-purple-200 font-medium">Temperature</label>
                                        </div>
                                        <span className="text-purple-300 text-sm">{localSettings.temperature || 0.7}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={localSettings.temperature || 0.7}
                                        onChange={(e) => setLocalSettings(prev => ({
                                            ...prev,
                                            temperature: parseFloat(e.target.value)
                                        }))}
                                        className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                    <p className="text-xs text-purple-400">
                                        Lower values make responses more focused. Higher values increase creativity.
                                    </p>
                                </div>

                                {/* Response Mode */}
                                <div className="space-y-3">
                                    <label className="text-purple-200 font-medium">Response Mode</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {responseModes.map(mode => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setLocalSettings(prev => ({
                                                    ...prev,
                                                    responseMode: mode.id as any
                                                }))}
                                                className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                                                    (localSettings.responseMode || 'balanced') === mode.id
                                                        ? 'bg-purple-500/30 border-purple-500/50 text-purple-100'
                                                        : 'bg-purple-500/10 border-purple-500/30 text-purple-200 hover:bg-purple-500/20'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    {mode.icon}
                                                    <span className="font-medium text-sm">{mode.label}</span>
                                                </div>
                                                <div className="text-xs opacity-70">{mode.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* System Prompt */}
                                <div className="space-y-3">
                                    <label className="text-purple-200 font-medium">Custom System Prompt</label>
                                    <textarea
                                        value={localSettings.systemPrompt || ''}
                                        onChange={(e) => setLocalSettings(prev => ({
                                            ...prev,
                                            systemPrompt: e.target.value
                                        }))}
                                        placeholder="Enter a custom system prompt for this chat..."
                                        className="w-full h-20 px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-sm"
                                    />
                                </div>

                                {/* Prompt Enhancement */}
                                <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                                    <div>
                                        <h4 className="text-purple-100 font-medium text-sm">1-Click Prompt Enhancement</h4>
                                        <p className="text-xs text-purple-300 mt-1">
                                            Enable automatic prompt improvement
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={localSettings.promptEnhancement || false}
                                            onChange={(e) => setLocalSettings(prev => ({
                                                ...prev,
                                                promptEnhancement: e.target.checked
                                            }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-purple-600/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                                    </label>
                                </div>

                                {/* Advanced Settings */}
                                <details className="group">
                                    <summary className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30 cursor-pointer hover:bg-purple-500/20 transition-colors">
                                        <span className="text-purple-200 font-medium text-sm">Advanced Parameters</span>
                                        <ChevronDown className="w-4 h-4 text-purple-400 group-open:rotate-180 transition-transform" />
                                    </summary>
                                    <div className="mt-3 space-y-4 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                                        {/* Max Tokens */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-purple-200 text-sm">Max Tokens</label>
                                                <span className="text-purple-300 text-sm">{localSettings.maxTokens || 'Auto'}</span>
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                max="32000"
                                                value={localSettings.maxTokens || ''}
                                                onChange={(e) => setLocalSettings(prev => ({
                                                    ...prev,
                                                    maxTokens: e.target.value ? parseInt(e.target.value) : undefined
                                                }))}
                                                placeholder="Auto"
                                                className="w-full px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-md text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                                            />
                                        </div>

                                        {/* Top P */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-purple-200 text-sm">Top P</label>
                                                <span className="text-purple-300 text-sm">{localSettings.topP || 0.9}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={localSettings.topP || 0.9}
                                                onChange={(e) => setLocalSettings(prev => ({
                                                    ...prev,
                                                    topP: parseFloat(e.target.value)
                                                }))}
                                                className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                            />
                                        </div>

                                        {/* Frequency & Presence Penalties */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-purple-200 text-xs">Freq. Penalty</label>
                                                    <span className="text-purple-300 text-xs">{localSettings.frequencyPenalty || 0}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="0.1"
                                                    value={localSettings.frequencyPenalty || 0}
                                                    onChange={(e) => setLocalSettings(prev => ({
                                                        ...prev,
                                                        frequencyPenalty: parseFloat(e.target.value)
                                                    }))}
                                                    className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-purple-200 text-xs">Pres. Penalty</label>
                                                    <span className="text-purple-300 text-xs">{localSettings.presencePenalty || 0}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="0.1"
                                                    value={localSettings.presencePenalty || 0}
                                                    onChange={(e) => setLocalSettings(prev => ({
                                                        ...prev,
                                                        presencePenalty: parseFloat(e.target.value)
                                                    }))}
                                                    className="w-full h-2 bg-purple-600/30 rounded-lg appearance-none cursor-pointer slider"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        )}

                        {useGlobalSettings && globalPreferences?.aiSettings && (
                            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                <h4 className="text-blue-200 font-medium mb-2">Current Global Settings</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-blue-300">Temperature:</span>
                                        <span className="text-blue-100 ml-2">{globalPreferences.aiSettings.temperature || 0.7}</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-300">Response Mode:</span>
                                        <span className="text-blue-100 ml-2 capitalize">{globalPreferences.aiSettings.responseMode || 'balanced'}</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-300">Prompt Enhancement:</span>
                                        <span className="text-blue-100 ml-2">{globalPreferences.aiSettings.promptEnhancement ? 'Enabled' : 'Disabled'}</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-300">System Prompt:</span>
                                        <span className="text-blue-100 ml-2">{globalPreferences.aiSettings.systemPrompt ? 'Custom' : 'None'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-purple-600/20">
                    <div className="text-xs text-purple-400">
                        💡 These settings only apply to this chat
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="text-purple-300 border-purple-500/30 hover:bg-purple-500/20"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                        >
                            Save Settings
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}