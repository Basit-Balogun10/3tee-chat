import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { X } from "lucide-react";

interface KeyboardShortcutsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({
    open,
    onOpenChange,
}: KeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K to show shortcuts
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                onOpenChange(true);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onOpenChange]);

    const shortcutSections = [
        {
            title: "General",
            shortcuts: [
                { key: "Cmd/Ctrl + K", action: "Show keyboard shortcuts" },
                { key: "Cmd/Ctrl + ,", action: "Open settings" },
                { key: "Escape", action: "Close modals/cancel actions" },
            ],
        },
        {
            title: "Chat Management",
            shortcuts: [
                { key: "Cmd/Ctrl + Alt + N", action: "New chat" },
                { key: "Cmd/Ctrl + Shift + B", action: "Toggle sidebar" },
                { key: "Cmd/Ctrl + Shift + F", action: "Focus search" },
                { key: "Cmd/Ctrl + Alt + T", action: "Rename current chat" },
                {
                    key: "Cmd/Ctrl + Alt + S",
                    action: "Star/unstar current chat",
                },
                { key: "Cmd/Ctrl + Alt + D", action: "Delete current chat" },
            ],
        },
        {
            title: "Navigation",
            shortcuts: [
                { key: "↑/↓", action: "Navigate between chats" },
                { key: "Cmd/Ctrl + Alt + I", action: "Focus message input" },
            ],
        },
        {
            title: "Message Input",
            shortcuts: [
                { key: "↑/↓", action: "Navigate message history" },
                { key: "Cmd/Ctrl + Enter", action: "Send message" },
                { key: "Cmd/Ctrl + L", action: "Clear input" },
                { key: "Cmd/Ctrl + M", action: "Open model selector" },
                { key: "Ctrl + Alt + V", action: "Start/stop voice recording" },
                { key: "/", action: "Show available commands" },
            ],
        },
        {
            title: "Message Actions (When Hovering)",
            shortcuts: [
                { key: "C", action: "Copy message content" },
                { key: "E", action: "Edit message (user messages)" },
                { key: "Delete", action: "Delete message (user messages)" },
                { key: "R", action: "Retry AI response" },
                { key: "F", action: "Fork conversation from message" },
                { key: "←/→", action: "Navigate message branches" },
            ],
        },
        {
            title: "Message Editing",
            shortcuts: [
                { key: "Ctrl/Cmd + E", action: "Save edit & create branch" },
                { key: "Shift + Enter", action: "New line while editing" },
                { key: "Escape", action: "Cancel edit" },
            ],
        },
        {
            title: "Export & Share",
            shortcuts: [
                { key: "Cmd/Ctrl + Shift + E", action: "Export as Markdown" },
                { key: "Cmd/Ctrl + Shift + J", action: "Export as JSON" },
                { key: "Cmd/Ctrl + Shift + S", action: "Share chat" },
            ],
        },
        {
            title: "Theme & UI",
            shortcuts: [
                {
                    key: "Cmd/Ctrl + Shift + D",
                    action: "Toggle dark/light mode",
                },
                {
                    key: "Cmd/Ctrl + Alt + M",
                    action: "Toggle message input visibility",
                },
                {
                    key: "Cmd/Ctrl + Alt + H",
                    action: "Toggle chat header visibility",
                },
                {
                    key: "Cmd/Ctrl + Alt + Z",
                    action: "Toggle zen mode (toggles sidebar, header & input)",
                },
            ],
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900/95 backdrop-blur-sm border border-purple-600/30 text-purple-100 max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between mb-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {shortcutSections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="space-y-3">
                            <h3 className="text-lg font-medium text-purple-200 border-b border-purple-500/20 pb-2">
                                {section.title}
                            </h3>
                            <div className="space-y-2">
                                {section.shortcuts.map((shortcut, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between"
                                    >
                                        <span className="text-purple-300 text-sm">
                                            {shortcut.action}
                                        </span>
                                        <kbd className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-100 font-mono whitespace-nowrap">
                                            {shortcut.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-4 border-t border-purple-500/20">
                    <div className="bg-purple-600/10 rounded-lg p-4 border border-purple-500/20">
                        <h4 className="text-sm font-medium text-purple-200 mb-2">
                            💡 Pro Tips
                        </h4>
                        <ul className="text-xs text-purple-400 space-y-1">
                            <li>
                                • Hover over messages to see action buttons and
                                use keyboard shortcuts
                            </li>
                            <li>
                                • Branch navigation arrows appear when messages
                                have edit history
                            </li>
                            <li>
                                • Fork conversations from AI responses to
                                explore different paths
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <p className="text-xs text-purple-400">
                        Press{" "}
                        <kbd className="px-1 py-0.5 bg-purple-500/20 rounded text-purple-300">
                            Cmd/Ctrl + K
                        </kbd>{" "}
                        anytime to show this dialog
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
