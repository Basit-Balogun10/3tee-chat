// Central keyboard shortcuts configuration
export interface ShortcutConfig {
    id: string;
    defaultKey: string;
    action: string;
    category: string;
    isEditable: boolean;
    warningMessage?: string;
}

// Default keyboard shortcuts configuration
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
    // General
    {
        id: "showShortcuts",
        defaultKey: "Cmd/Ctrl + K",
        action: "Show keyboard shortcuts",
        category: "General",
        isEditable: true,
    },
    {
        id: "openSettings",
        defaultKey: "Cmd/Ctrl + ,",
        action: "Open settings",
        category: "General",
        isEditable: true,
    },

    // Chat Management
    {
        id: "newChat",
        defaultKey: "Cmd/Ctrl + Alt + N",
        action: "New chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "toggleSidebar",
        defaultKey: "Cmd/Ctrl + Shift + B",
        action: "Toggle sidebar",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "toggleRightSidebar",
        defaultKey: "Cmd/Ctrl + \\",
        action: "Toggle right sidebar",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "toggleProjectView",
        defaultKey: "Cmd/Ctrl + Alt + P",
        action: "Toggle project/chat view",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "focusSearch",
        defaultKey: "Cmd/Ctrl + Shift + F",
        action: "Focus search",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "renameChat",
        defaultKey: "Cmd/Ctrl + Alt + T",
        action: "Rename current chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "starChat",
        defaultKey: "Cmd/Ctrl + Alt + S",
        action: "Star/unstar current chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "deleteChat",
        defaultKey: "Cmd/Ctrl + Alt + D",
        action: "Delete current chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "new-chat",
        defaultKey: "Ctrl + N",
        action: "Create new chat",
        category: "Chat Management",
        isEditable: true,
    },
    {
        id: "new-temporary-chat",
        defaultKey: "Ctrl + Shift + N",
        action: "Create new temporary chat",
        category: "Chat Management",
        isEditable: true,
    },

    // Navigation
    {
        id: "navigate-chats",
        defaultKey: "Alt + ↑/↓",
        action: "Navigate between chats",
        category: "Navigation",
        isEditable: true,
    },
    {
        id: "focusInput",
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
        isEditable: true,
    },
    {
        id: "sendMessage",
        defaultKey: "Cmd/Ctrl + Enter",
        action: "Send message",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "clearInput",
        defaultKey: "Cmd/Ctrl + L",
        action: "Clear input",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "openModelSelector",
        defaultKey: "Cmd/Ctrl + M",
        action: "Open model selector",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "voiceRecording",
        defaultKey: "Ctrl + Alt + V",
        action: "Start/stop voice recording",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "openLiveChatModal",
        defaultKey: "Ctrl + Alt + L",
        action: "Open live chat modal",
        category: "Message Input",
        isEditable: true,
    },
    {
        id: "show-commands",
        defaultKey: "/",
        action: "Show available commands",
        category: "Message Input",
        isEditable: false,
        warningMessage:
            "Command shortcuts are contextual and cannot be customized",
    },
    {
        id: "reference-artifacts",
        defaultKey: "@",
        action: "Reference artifacts",
        category: "Message Input",
        isEditable: false,
        warningMessage:
            "Command shortcuts are contextual and cannot be customized",
    },

    // Sharing
    {
        id: "shareChat",
        defaultKey: "Cmd/Ctrl + Shift + S",
        action: "Share current chat (read-only)",
        category: "Sharing",
        isEditable: true,
    },
    {
        id: "shareCollaboration",
        defaultKey: "Cmd/Ctrl + Alt + C",
        action: "Share for collaboration",
        category: "Sharing",
        isEditable: true,
    },
    {
        id: "exportMarkdown",
        defaultKey: "Cmd/Ctrl + Shift + E",
        action: "Export chat as Markdown",
        category: "Sharing",
        isEditable: true,
    },
    {
        id: "exportJson",
        defaultKey: "Cmd/Ctrl + Shift + J",
        action: "Export chat as JSON",
        category: "Sharing",
        isEditable: true,
    },

    // Theme & UI
    {
        id: "toggleTheme",
        defaultKey: "Cmd/Ctrl + Shift + T",
        action: "Toggle theme",
        category: "Theme & UI",
        isEditable: true,
    },
    {
        id: "toggleMessageInput",
        defaultKey: "Cmd/Ctrl + Shift + I",
        action: "Toggle message input",
        category: "Theme & UI",
        isEditable: true,
    },
    {
        id: "toggleHeader",
        defaultKey: "Cmd/Ctrl + Shift + H",
        action: "Toggle header",
        category: "Theme & UI",
        isEditable: true,
    },
    {
        id: "toggleZenMode",
        defaultKey: "Cmd/Ctrl + Shift + Z",
        action: "Toggle zen mode",
        category: "Theme & UI",
        isEditable: true,
    },

    // Message Actions (When Hovering)
    {
        id: "navigate-versions-branches",
        defaultKey: "Ctrl + ←/→",
        action: "Navigate message versions/branches",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "collapse-message",
        defaultKey: "Ctrl + ↑",
        action: "Collapse message (when hovering)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "expand-message",
        defaultKey: "Ctrl + ↓",
        action: "Expand message (when hovering)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "scroll-to-message-end",
        defaultKey: "Ctrl + End",
        action: "Scroll to end of message (when hovering)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "copy-message",
        defaultKey: "C",
        action: "Copy message content (when hovering)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "edit-message",
        defaultKey: "E",
        action: "Edit message (when hovering over user messages)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "retry-message",
        defaultKey: "R",
        action: "Retry AI response (when hovering over AI messages)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "retry-different-model",
        defaultKey: "Shift + R",
        action: "Retry with different model (when hovering over AI messages)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "delete-message",
        defaultKey: "Delete/Backspace",
        action: "Delete message (when hovering over user messages)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "fork-conversation",
        defaultKey: "F",
        action: "Fork conversation from message (when hovering over AI messages)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "copyDirectMessageLink",
        defaultKey: "L",
        action: "Copy direct link to message",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "createSharedMessageLink",
        defaultKey: "Shift + L",
        action: "Create shared link to message",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },

    // Attachment Management (When Hovering over Attachments)
    {
        id: "removeAttachment",
        defaultKey: "R",
        action: "Remove attachment (when hovering over attachments)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "replaceAttachment",
        defaultKey: "Shift + R",
        action: "Replace attachment (when hovering over attachments)",
        category: "Message Actions (When Hovering)",
        isEditable: true,
    },

    // Multi-AI Response Actions (When Hovering over Multi-AI Cards)
    {
        id: "pickPrimaryResponse",
        defaultKey: "P",
        action: "Pick as primary response (when hovering over Multi-AI cards)",
        category: "Multi-AI Response Actions (When Hovering)",
        isEditable: true,
    },
    {
        id: "deleteMultiAIResponse",
        defaultKey: "Delete/Backspace",
        action: "Delete Multi-AI response (when hovering over Multi-AI cards)",
        category: "Multi-AI Response Actions (When Hovering)",
        isEditable: true,
    },

    // Phase 3 & 4 shortcuts
    {
        id: "advancedSearch",
        defaultKey: "Ctrl + Shift + F",
        action: "Open advanced search modal",
        category: "Search",
        isEditable: true,
    },
    {
        id: "enhancePrompt",
        defaultKey: "Ctrl + Shift + E",
        action: "Enhance current prompt with AI (1-click)",
        category: "AI",
        isEditable: true,
    },
    {
        id: "openChatAISettings",
        defaultKey: "Ctrl + Shift + A",
        action: "Open per-chat AI settings modal",
        category: "AI",
        isEditable: true,
    },

    // Phase 2 notification shortcuts
    {
        id: "toggleNotifications",
        defaultKey: "Ctrl + Shift + N",
        action: "Toggle sound notifications on/off",
        category: "Notifications",
        isEditable: true,
    },
    {
        id: "adjustNotificationVolume",
        defaultKey: "Ctrl + Shift + V",
        action: "Adjust notification sound volume",
        category: "Notifications",
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
