import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_SHORTCUTS, parseKeyboardShortcut } from "../lib/shortcutsConfig";

export function useCustomShortcuts() {
    const preferences = useQuery(api.preferences.getUserPreferences);
    
    // Build effective shortcuts (custom or default)
    const effectiveShortcuts = useMemo(() => {
        const customShortcuts = preferences?.customShortcuts || {};
        
        const shortcuts: Record<string, string> = {};
        DEFAULT_SHORTCUTS.forEach(shortcut => {
            shortcuts[shortcut.id] = customShortcuts[shortcut.id] || shortcut.defaultKey;
        });
        
        return shortcuts;
    }, [preferences?.customShortcuts]);

    // Helper function to check if a keyboard event matches a shortcut
    const checkShortcutMatch = (e: KeyboardEvent, shortcutId: string): boolean => {
        const shortcutKey = effectiveShortcuts[shortcutId];
        if (!shortcutKey) return false;

        const parsed = parseKeyboardShortcut(shortcutKey);
        
        // Check modifiers
        const hasCtrl = e.ctrlKey || e.metaKey;
        const hasShift = e.shiftKey;
        const hasAlt = e.altKey;
        
        // Check if modifiers match
        if ((parsed.ctrl || parsed.meta) && !hasCtrl) return false;
        if (parsed.shift && !hasShift) return false;
        if (parsed.alt && !hasAlt) return false;
        
        // Check if extra modifiers are pressed
        if (!parsed.ctrl && !parsed.meta && hasCtrl) return false;
        if (!parsed.shift && hasShift) return false;
        if (!parsed.alt && hasAlt) return false;
        
        // Check key (case insensitive for letters)
        const eventKey = e.key.toLowerCase();
        const shortcutKeyLower = parsed.key.toLowerCase();
        
        // Handle special keys
        if (shortcutKeyLower === "enter" && eventKey === "enter") return true;
        if (shortcutKeyLower === "escape" && eventKey === "escape") return true;
        if (shortcutKeyLower === "space" && eventKey === " ") return true;
        if (shortcutKeyLower === "\\" && eventKey === "\\") return true;
        
        // Handle regular keys
        return eventKey === shortcutKeyLower;
    };

    // Get specific shortcut key
    const getShortcut = (shortcutId: string): string => {
        return effectiveShortcuts[shortcutId] || "";
    };

    return {
        shortcuts: effectiveShortcuts,
        getShortcut,
        checkShortcutMatch,
        isLoading: preferences === undefined
    };
}