// Central keyboard shortcuts configuration
export interface ShortcutConfig {
    id: string;
    defaultKey: string;
    action: string;
    category: string;
    isEditable: boolean;
    description?: string;
    warningMessage?: string;
}

// Default keyboard shortcuts configuration
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
    // General
    {
        id: "show-shortcuts",
        defaultKey: "Cmd/Ctrl + K",
        action: "Show keyboard shortcuts",
        category: "General",
        isEditable: true,
    },
    {
        id: "open-settings",
        defaultKey: "Cmd/Ctrl + ,",
        action: "Open settings",
        category: "General",
        isEditable: true,
    },

    // Chat Management
    {
        id: "new-chat",
        defaultKey: "Cmd/Ctrl + Alt + N",
        action: "New chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "toggle-sidebar",
        defaultKey: "Cmd/Ctrl + Shift + B",
        action: "Toggle sidebar",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "toggle-right-sidebar",
        defaultKey: "Cmd/Ctrl + \\",
        action: "Toggle right sidebar",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "toggle-project-view",
        defaultKey: "Cmd/Ctrl + Alt + P",
        action: "Toggle project/chat view",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "focus-search",
        defaultKey: "Cmd/Ctrl + Shift + F",
        action: "Focus search",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "rename-chat",
        defaultKey: "Cmd/Ctrl + Alt + T",
        action: "Rename current chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "star-chat",
        defaultKey: "Cmd/Ctrl + Alt + S",
        action: "Star/unstar current chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "delete-chat",
        defaultKey: "Cmd/Ctrl + Alt + D",
        action: "Delete current chat",
        category: "Chat Management",
        isEditable: true,
    },

    // Navigation (non-editable)
    {
        id: "navigate-chats",
        defaultKey: "↑/↓",
        action: "Navigate between chats",
        category: "Navigation",
        isEditable: false,
        warningMessage: "Navigation shortcuts cannot be customized",
    },
    {
        id: "focus-input",
        defaultKey: "Cmd/Ctrl + Alt + I",
        action: "Focus message input",
        category: "Navigation",
        isEditable: true,
    },

    // Message Input
    {
        id: "navigate-history",
        defaultKey: "↑/↓",
        action: "Navigate message history",
        category: "Message Input",
        isEditable: false,
        warningMessage: "History navigation cannot be customized",
    },
    {
        id: "send-message",
        defaultKey: "Cmd/Ctrl + Enter",
        action: "Send message",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "clear-input",
        defaultKey: "Cmd/Ctrl + L",
        action: "Clear input",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "open-model-selector",
        defaultKey: "Cmd/Ctrl + M",
        action: "Open model selector",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "voice-recording",
        defaultKey: "Ctrl + Alt + V",
        action: "Start/stop voice recording",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "show-commands",
        defaultKey: "/",
        action: "Show available commands",
        category: "Message Input",
        isEditable: false,
        warningMessage: "Command shortcuts cannot be customized",
    },
    {
        id: "reference-artifacts",
        defaultKey: "@",
        action: "Reference artifacts",
        category: "Message Input",
        isEditable: false,
        warningMessage: "Command shortcuts cannot be customized",
    },

    // Message Actions (non-editable - contextual)
    {
        id: "copy-message",
        defaultKey: "C",
        action: "Copy message content",
        category: "Message Actions (When Hovering)",
        isEditable: false,
        warningMessage:
            "Message actions are contextual and cannot be customized",
    },
    {
        id: "edit-message",
        defaultKey: "E",
        action: "Edit message (user messages)",
        category: "Message Actions (When Hovering)",
        isEditable: false,
        warningMessage:
            "Message actions are contextual and cannot be customized",
    },
    {
        id: "delete-message",
        defaultKey: "Delete",
        action: "Delete message (user messages)",
        category: "Message Actions (When Hovering)",
        isEditable: false,
        warningMessage:
            "Message actions are contextual and cannot be customized",
    },
    {
        id: "retry-response",
        defaultKey: "R",
        action: "Retry AI response",
        category: "Message Actions (When Hovering)",
        isEditable: false,
        warningMessage:
            "Message actions are contextual and cannot be customized",
    },
    {
        id: "fork-conversation",
        defaultKey: "F",
        action: "Fork conversation from message",
        category: "Message Actions (When Hovering)",
        isEditable: false,
        warningMessage:
            "Message actions are contextual and cannot be customized",
    },
    {
        id: "navigate-branches",
        defaultKey: "←/→",
        action: "Navigate message branches",
        category: "Message Actions (When Hovering)",
        isEditable: false,
        warningMessage: "Navigation shortcuts cannot be customized",
    },

    // Export & Share
    {
        id: "export-markdown",
        defaultKey: "Cmd/Ctrl + Shift + E",
        action: "Export as Markdown",
        category: "Export & Share",
        isEditable: true,
    },
    {
        id: "export-json",
        defaultKey: "Cmd/Ctrl + Shift + J",
        action: "Export as JSON",
        category: "Export & Share",
        isEditable: true,
    },
    {
        id: "share-chat",
        defaultKey: "Cmd/Ctrl + Shift + S",
        action: "Share chat",
        category: "Export & Share",
        isEditable: true,
    },
    {
        id: "share-collaboration",
        defaultKey: "Cmd/Ctrl + Alt + C",
        action: "Share chat (collaboration mode)",
        category: "Export & Share",
        isEditable: true,
    },

    // Theme & UI
    {
        id: "toggle-theme",
        defaultKey: "Cmd/Ctrl + Shift + D",
        action: "Toggle dark/light mode",
        category: "Theme & UI",
        isEditable: true,
    },
    {
        id: "toggle-message-input",
        defaultKey: "Cmd/Ctrl + Alt + M",
        action: "Toggle message input visibility",
        category: "Theme & UI",
        isEditable: true,
    },
    {
        id: "toggle-header",
        defaultKey: "Cmd/Ctrl + Alt + H",
        action: "Toggle chat header visibility",
        category: "Theme & UI",
        isEditable: true,
    },
    {
        id: "toggle-zen-mode",
        defaultKey: "Cmd/Ctrl + Alt + Z",
        action: "Toggle zen mode (toggles sidebar, header & input)",
        category: "Theme & UI",
        isEditable: true,
    },
];

// Utility functions for shortcut validation
export function parseKeyboardShortcut(shortcut: string): {
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    alt: boolean;
    key: string;
} {
    const parts = shortcut.toLowerCase().split(" + ");
    const result = {
        ctrl: false,
        meta: false,
        shift: false,
        alt: false,
        key: "",
    };

    parts.forEach((part) => {
        const trimmed = part.trim();
        if (
            trimmed === "ctrl" ||
            trimmed === "cmd" ||
            trimmed.includes("ctrl") ||
            trimmed.includes("cmd")
        ) {
            result.ctrl = true;
            result.meta = true;
        } else if (trimmed === "shift") {
            result.shift = true;
        } else if (trimmed === "alt") {
            result.alt = true;
        } else {
            result.key = trimmed;
        }
    });

    return result;
}

export function validateShortcut(shortcut: string): {
    isValid: boolean;
    error?: string;
} {
    if (!shortcut.trim()) {
        return { isValid: false, error: "Shortcut cannot be empty" };
    }

    // Parse the shortcut
    const parsed = parseKeyboardShortcut(shortcut);

    if (!parsed.key) {
        return {
            isValid: false,
            error: "Must specify a key (e.g., 'K', 'Enter', 'Space')",
        };
    }

    // Check for browser conflicts
    const browserShortcuts = [
        "ctrl+n",
        "cmd+n", // New window/tab
        "ctrl+t",
        "cmd+t", // New tab
        "ctrl+w",
        "cmd+w", // Close tab
        "ctrl+r",
        "cmd+r", // Refresh
        "ctrl+f",
        "cmd+f", // Find
        "ctrl+d",
        "cmd+d", // Bookmark
        "ctrl+h",
        "cmd+h", // History
        "ctrl+j",
        "cmd+j", // Downloads
        "ctrl+u",
        "cmd+u", // View source
        "ctrl+shift+i",
        "cmd+shift+i", // Developer tools
        "ctrl+shift+delete",
        "cmd+shift+delete", // Clear data
        "f5",
        "f11",
        "f12", // Function keys
    ];

    const normalizedShortcut = shortcut
        .toLowerCase()
        .replace(/\s/g, "")
        .replace("cmd", "ctrl");
    const isBrowserShortcut = browserShortcuts.some((bs) =>
        normalizedShortcut.includes(bs.replace(/\s/g, ""))
    );

    if (isBrowserShortcut) {
        return {
            isValid: false,
            error: "This shortcut conflicts with browser shortcuts and cannot be overridden",
        };
    }

    return { isValid: true };
}

export function checkShortcutUniqueness(
    newShortcut: string,
    existingShortcuts: Record<string, string>,
    excludeId?: string
): { isUnique: boolean; conflictingAction?: string } {
    const normalizedNew = newShortcut.toLowerCase().replace(/\s/g, "");

    for (const [id, shortcut] of Object.entries(existingShortcuts)) {
        if (excludeId && id === excludeId) continue;

        const normalizedExisting = shortcut.toLowerCase().replace(/\s/g, "");
        if (normalizedNew === normalizedExisting) {
            const config = DEFAULT_SHORTCUTS.find((s) => s.id === id);
            return {
                isUnique: false,
                conflictingAction: config?.action || "Unknown action",
            };
        }
    }

    return { isUnique: true };
}
