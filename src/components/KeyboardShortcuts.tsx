import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { SearchInput } from "./SearchInput";
import { X, Edit2, RotateCcw, AlertTriangle, Keyboard } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    DEFAULT_SHORTCUTS,
    validateShortcut,
    checkShortcutUniqueness,
} from "../lib/shortcutsConfig";
import { useCustomShortcuts } from "../hooks/useCustomShortcuts";
import { toast } from "sonner";

interface KeyboardShortcutsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({
    open,
    onOpenChange,
}: KeyboardShortcutsProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [editingShortcutId, setEditingShortcutId] = useState<string | null>(
        null
    );
    const [editValue, setEditValue] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [detectedKeys, setDetectedKeys] = useState<Set<string>>(new Set());

    // Use custom shortcuts hook and get preferences for editing
    const { checkShortcutMatch, getShortcut } = useCustomShortcuts();
    const preferences = useQuery(api.preferences.getUserPreferences);
    const updatePreferences = useMutation(
        api.preferences.updateUserPreferences
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if the pressed keys match the show-shortcuts combination
            if (checkShortcutMatch(e, "show-shortcuts")) {
                e.preventDefault();
                onOpenChange(true);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onOpenChange, checkShortcutMatch]);

    // Keyboard detection for editing shortcuts
    useEffect(() => {
        if (!isListening || !editingShortcutId) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Skip if it's just a modifier key by itself
            if (["Control", "Meta", "Shift", "Alt"].includes(e.key)) {
                return;
            }

            // Build the shortcut string
            const parts: string[] = [];

            if (e.ctrlKey || e.metaKey) {
                parts.push("Cmd/Ctrl");
            }
            if (e.shiftKey) {
                parts.push("Shift");
            }
            if (e.altKey) {
                parts.push("Alt");
            }

            // Format the key name
            let keyName = e.key;
            if (keyName === " ") {
                keyName = "Space";
            } else if (keyName.length === 1) {
                keyName = keyName.toUpperCase();
            } else if (keyName.startsWith("Arrow")) {
                keyName = keyName.replace("Arrow", "");
            }

            parts.push(keyName);

            const shortcutString = parts.join(" + ");
            setEditValue(shortcutString);
            setValidationError(null);

            // Visual feedback
            setDetectedKeys(new Set([shortcutString]));

            // Auto-save after a short delay
            setTimeout(() => {
                setIsListening(false);
                void handleSaveShortcut(shortcutString);
            }, 300);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // Clear detected keys when all modifiers are released
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                setDetectedKeys(new Set());
            }
        };

        document.addEventListener("keydown", handleKeyDown, { capture: true });
        document.addEventListener("keyup", handleKeyUp, { capture: true });

        return () => {
            document.removeEventListener("keydown", handleKeyDown, {
                capture: true,
            });
            document.removeEventListener("keyup", handleKeyUp, { capture: true });
        };
    }, [isListening, editingShortcutId]);

    // Reset search when modal closes
    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setEditingShortcutId(null);
            setEditValue("");
            setValidationError(null);
            setIsListening(false);
            setDetectedKeys(new Set());
        }
    }, [open]);

    // Build shortcuts with user customizations
    const effectiveShortcuts = useMemo(() => {
        return DEFAULT_SHORTCUTS.map((shortcut) => ({
            ...shortcut,
            key: getShortcut(shortcut.id),
            isCustomized: getShortcut(shortcut.id) !== shortcut.defaultKey,
        }));
    }, [getShortcut]);

    // Group shortcuts by category
    const shortcutSections = useMemo(() => {
        const grouped = effectiveShortcuts.reduce(
            (acc, shortcut) => {
                if (!acc[shortcut.category]) {
                    acc[shortcut.category] = [];
                }
                acc[shortcut.category].push(shortcut);
                return acc;
            },
            {} as Record<string, typeof effectiveShortcuts>
        );

        return Object.entries(grouped).map(([title, shortcuts]) => ({
            title,
            shortcuts,
        }));
    }, [effectiveShortcuts]);

    // Filter shortcuts based on search query
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) {
            return shortcutSections;
        }

        const query = searchQuery.toLowerCase().trim();

        return shortcutSections
            .map((section) => {
                // Check if section title matches the search query
                const sectionTitleMatches = section.title
                    .toLowerCase()
                    .includes(query);

                // If section title matches, include all shortcuts in that section
                if (sectionTitleMatches) {
                    return section;
                }

                // Otherwise, filter shortcuts within the section
                const filteredShortcuts = section.shortcuts.filter(
                    (shortcut) =>
                        shortcut.action.toLowerCase().includes(query) ||
                        shortcut.key.toLowerCase().includes(query)
                );

                return {
                    ...section,
                    shortcuts: filteredShortcuts,
                };
            })
            .filter((section) => section.shortcuts.length > 0);
    }, [searchQuery, shortcutSections]);

    const handleEditShortcut = (shortcutId: string, currentKey: string) => {
        const shortcut = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId);
        if (!shortcut?.isEditable) return;

        setEditingShortcutId(shortcutId);
        setEditValue(currentKey);
        setValidationError(null);
        setIsListening(true);
        setDetectedKeys(new Set());
    };

    const handleSaveShortcut = async (shortcutToSave?: string) => {
        const finalShortcut = shortcutToSave || editValue;

        if (!editingShortcutId || !finalShortcut.trim()) return;

        // Validate the shortcut
        const validation = validateShortcut(finalShortcut);
        if (!validation.isValid) {
            setValidationError(validation.error || "Invalid shortcut");
            setIsListening(false);
            return;
        }

        // Check uniqueness
        const currentCustomShortcuts = preferences?.customShortcuts || {};
        const allShortcuts = { ...currentCustomShortcuts };

        // Add default shortcuts that aren't customized
        DEFAULT_SHORTCUTS.forEach((s) => {
            if (!allShortcuts[s.id]) {
                allShortcuts[s.id] = s.defaultKey;
            }
        });

        const uniqueness = checkShortcutUniqueness(
            finalShortcut,
            allShortcuts,
            editingShortcutId
        );
        if (!uniqueness.isUnique) {
            setValidationError(
                `This shortcut is already used by: ${uniqueness.conflictingAction}`
            );
            setIsListening(false);
            return;
        }

        // Save the custom shortcut
        try {
            const updatedCustomShortcuts = {
                ...currentCustomShortcuts,
                [editingShortcutId]: finalShortcut,
            };

            await updatePreferences({
                customShortcuts: updatedCustomShortcuts,
            });

            setEditingShortcutId(null);
            setEditValue("");
            setValidationError(null);
            setIsListening(false);
            setDetectedKeys(new Set());

            const shortcut = DEFAULT_SHORTCUTS.find(
                (s) => s.id === editingShortcutId
            );
            toast.success(`Shortcut updated: ${shortcut?.action}`);
        } catch (error) {
            console.error("Failed to save shortcut:", error);
            toast.error("Failed to save shortcut");
            setIsListening(false);
        }
    };

    const handleResetShortcut = async (shortcutId: string) => {
        try {
            const currentCustomShortcuts = preferences?.customShortcuts || {};
            const { [shortcutId]: removed, ...remaining } = currentCustomShortcuts;

            await updatePreferences({
                customShortcuts: remaining,
            });

            const shortcut = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId);
            toast.success(`Shortcut reset to default: ${shortcut?.action}`);
        } catch (error) {
            console.error("Failed to reset shortcut:", error);
            toast.error("Failed to reset shortcut");
        }
    };

    const handleCancelEdit = () => {
        setEditingShortcutId(null);
        setEditValue("");
        setValidationError(null);
        setIsListening(false);
        setDetectedKeys(new Set());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (editingShortcutId && !isListening) {
            if (e.key === "Enter") {
                e.preventDefault();
                void handleSaveShortcut();
            } else if (e.key === "Escape") {
                handleCancelEdit();
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="bg-gray-900/95 backdrop-blur-sm border border-purple-600/30 text-purple-100 max-w-2xl max-h-[80vh] overflow-y-auto"
                hideCloseButton
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-purple-100">
                            Keyboard Shortcuts
                        </h2>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-2 rounded-lg hover:bg-purple-500/30 transition-colors"
                        >
                            <X className="w-5 h-5 text-purple-200" />
                        </button>
                    </DialogTitle>
                </DialogHeader>

                <div className="mb-4 space-y-3">
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search shortcuts..."
                        autoFocus={!editingShortcutId}
                    />
                    <div className="text-center">
                        <p
                            className={`text-xs ${
                                editingShortcutId
                                    ? "text-orange-300"
                                    : "text-purple-400"
                            }`}
                        >
                            {editingShortcutId ? (
                                <>
                                    <Keyboard className="w-3 h-3 inline mr-1" />
                                    {isListening
                                        ? "Press your desired key combination..."
                                        : "Click 'Listen for Keys' or manually edit the shortcut"}
                                </>
                            ) : (
                                <>
                                    Press{" "}
                                    <kbd className="px-1 py-0.5 bg-purple-500/20 rounded text-purple-300">
                                        {getShortcut("show-shortcuts")}
                                    </kbd>{" "}
                                    anytime to show this dialog • Click any shortcut key to customize it
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {filteredSections.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-purple-300">
                            No shortcuts found for "{searchQuery}"
                        </p>
                        <p className="text-purple-400 text-sm mt-2">
                            Try a different search term
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredSections.map((section, sectionIndex) => (
                            <div key={sectionIndex} className="space-y-3">
                                <h3 className="text-lg font-medium text-purple-200 border-b border-purple-500/20 pb-2">
                                    {section.title}
                                </h3>
                                <div className="space-y-2">
                                    {section.shortcuts.map((shortcut) => (
                                        <div
                                            key={shortcut.id}
                                            className="flex items-center justify-between group"
                                        >
                                            <span className="text-purple-300 text-sm flex-1">
                                                {shortcut.action}
                                                {shortcut.isCustomized && (
                                                    <span className="ml-2 text-xs text-blue-300 bg-blue-600/20 px-1 rounded">
                                                        Custom
                                                    </span>
                                                )}
                                                {!shortcut.isEditable &&
                                                    shortcut.warningMessage && (
                                                        <div className="text-xs text-orange-300 mt-1 italic">
                                                            ⚠️{" "}
                                                            {
                                                                shortcut.warningMessage
                                                            }
                                                        </div>
                                                    )}
                                            </span>

                                            <div className="flex items-center gap-1">
                                                {editingShortcutId ===
                                                shortcut.id ? (
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) =>
                                                                    setEditValue(
                                                                        e.target
                                                                            .value
                                                                    )
                                                                }
                                                                onKeyDown={
                                                                    handleKeyDown
                                                                }
                                                                className="w-32 px-2 py-1 bg-purple-500/20 border border-purple-500/50 rounded text-xs text-purple-100 font-mono text-center focus:outline-none focus:border-purple-400"
                                                                placeholder="e.g. Ctrl + K"
                                                                disabled={isListening}
                                                            />
                                                            <button
                                                                onClick={() =>
                                                                    setIsListening(
                                                                        !isListening
                                                                    )
                                                                }
                                                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                                    isListening
                                                                        ? "bg-green-500/20 text-green-300 border border-green-500/50"
                                                                        : "bg-blue-500/20 text-blue-300 border border-blue-500/50 hover:bg-blue-500/30"
                                                                }`}
                                                                title={
                                                                    isListening
                                                                        ? "Listening for keystrokes..."
                                                                        : "Click to detect keys"
                                                                }
                                                            >
                                                                <Keyboard className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() =>
                                                                    void handleSaveShortcut()
                                                                }
                                                                disabled={isListening}
                                                                className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs hover:bg-green-500/30 disabled:opacity-50"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={
                                                                    handleCancelEdit
                                                                }
                                                                className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs hover:bg-gray-500/30"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                        {validationError && (
                                                            <div className="text-xs text-red-300 max-w-40 text-center">
                                                                {validationError}
                                                            </div>
                                                        )}
                                                        {!validationError && isListening &&
                                                            detectedKeys.size >
                                                                0 && (
                                                                <div className="text-xs text-green-300 max-w-40 text-center">
                                                                    Detected:{" "}
                                                                    {Array.from(
                                                                        detectedKeys
                                                                    )[0]}
                                                                </div>
                                                            )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <kbd
                                                            className={`px-2 py-1 border rounded text-xs font-mono whitespace-nowrap cursor-pointer transition-colors ${
                                                                shortcut.isEditable
                                                                    ? "bg-purple-500/20 border-purple-500/30 text-purple-100 hover:bg-purple-500/30 hover:border-purple-400"
                                                                    : "bg-gray-600/20 border-gray-500/30 text-gray-300 cursor-not-allowed"
                                                            }`}
                                                            onClick={() =>
                                                                shortcut.isEditable &&
                                                                handleEditShortcut(
                                                                    shortcut.id,
                                                                    shortcut.key
                                                                )
                                                            }
                                                            title={
                                                                shortcut.isEditable
                                                                    ? "Click to customize"
                                                                    : "Cannot be customized"
                                                            }
                                                        >
                                                            {shortcut.key}
                                                        </kbd>

                                                        {shortcut.isEditable && (
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() =>
                                                                        handleEditShortcut(
                                                                            shortcut.id,
                                                                            shortcut.key
                                                                        )
                                                                    }
                                                                    className="p-1 rounded text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                                                                    title="Edit shortcut"
                                                                >
                                                                    <Edit2 className="w-3 h-3" />
                                                                </button>
                                                                {shortcut.isCustomized && (
                                                                    <button
                                                                        onClick={() =>
                                                                            void handleResetShortcut(
                                                                                shortcut.id
                                                                            )
                                                                        }
                                                                        className="p-1 rounded text-orange-400 hover:text-orange-300 hover:bg-orange-500/20"
                                                                        title="Reset to default"
                                                                    >
                                                                        <RotateCcw className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
