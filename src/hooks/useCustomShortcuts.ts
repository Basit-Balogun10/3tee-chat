import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_SHORTCUTS } from "../lib/shortcutsConfig";

export function useCustomShortcuts() {
    const preferences = useQuery(api.preferences.getUserPreferences);

    // Get effective shortcut value with hierarchy: custom > default
    const getShortcut = (shortcutId: string): string => {
        // Check new enhanced structure first
        const enhancedShortcut =
            preferences?.customShortcuts?.shortcuts?.[shortcutId];
        if (enhancedShortcut?.value) {
            return enhancedShortcut.value;
        }

        // Fall back to default
        const defaultShortcut = DEFAULT_SHORTCUTS.find(
            (s) => s.id === shortcutId
        );
        return defaultShortcut?.defaultKey || "";
    };

    // Check if shortcut is effectively disabled (global > category > individual)
    const isShortcutDisabled = (shortcutId: string): boolean => {
        // Global disable takes precedence
        if (preferences?.customShortcuts?.isGloballyDisabled) {
            return true;
        }

        // Get shortcut category
        const defaultShortcut = DEFAULT_SHORTCUTS.find(
            (s) => s.id === shortcutId
        );
        const category = defaultShortcut?.category;

        // Check if category is disabled
        if (
            category &&
            preferences?.customShortcuts?.disabledCategories?.includes(category)
        ) {
            return true;
        }

        // Check individual shortcut disable
        const enhancedShortcut =
            preferences?.customShortcuts?.shortcuts?.[shortcutId];
        if (enhancedShortcut?.isDisabled) {
            return true;
        }

        return false;
    };

    // Check if a key combination matches a shortcut (with disable check)
    const checkShortcutMatch = (
        event: KeyboardEvent,
        shortcutId: string
    ): boolean => {
        // Skip if shortcuts are disabled
        if (isShortcutDisabled(shortcutId)) {
            return false;
        }

        const shortcutKey = getShortcut(shortcutId);
        if (!shortcutKey) return false;

        // Parse the shortcut key
        const parts = shortcutKey.split(" + ").map((part) => part.trim());

        let requiredCtrl = false;
        let requiredShift = false;
        let requiredAlt = false;
        let requiredKey = "";

        for (const part of parts) {
            if (part === "Cmd/Ctrl") {
                requiredCtrl = true;
            } else if (part === "Shift") {
                requiredShift = true;
            } else if (part === "Alt") {
                requiredAlt = true;
            } else {
                requiredKey = part;
            }
        }

        // Check modifiers
        const ctrlPressed = event.ctrlKey || event.metaKey;
        if (ctrlPressed !== requiredCtrl) return false;
        if (event.shiftKey !== requiredShift) return false;
        if (event.altKey !== requiredAlt) return false;

        // Check main key
        let eventKey = event.key;
        if (eventKey === " ") eventKey = "Space";
        if (eventKey.length === 1) eventKey = eventKey.toUpperCase();
        if (eventKey.startsWith("Arrow"))
            eventKey = eventKey.replace("Arrow", "");

        return eventKey === requiredKey;
    };

    // Get all shortcut categories and their disable status
    const getCategoryStatus = () => {
        const categories = [
            ...new Set(DEFAULT_SHORTCUTS.map((s) => s.category)),
        ];
        return categories.map((category) => ({
            name: category,
            isDisabled:
                preferences?.customShortcuts?.disabledCategories?.includes(
                    category
                ) ?? false,
        }));
    };

    // Check if global shortcuts are disabled
    const areShortcutsGloballyDisabled = (): boolean => {
        return preferences?.customShortcuts?.isGloballyDisabled ?? false;
    };

    return {
        getShortcut,
        checkShortcutMatch,
        isShortcutDisabled,
        getCategoryStatus,
        areShortcutsGloballyDisabled,
        preferences,
    };
}
