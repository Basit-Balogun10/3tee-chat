import { useState, useRef, useEffect } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Listen for theme toggle event from keyboard shortcuts
    useEffect(() => {
        const handleToggleTheme = () => {
            // Cycle through themes: light -> dark -> system -> light
            if (theme === "light") {
                setTheme("dark");
            } else if (theme === "dark") {
                setTheme("system");
            } else {
                setTheme("light");
            }
        };

        document.addEventListener("toggleTheme", handleToggleTheme);
        return () =>
            document.removeEventListener("toggleTheme", handleToggleTheme);
    }, [setTheme, theme]);

    // Clear any pending close timeout
    const clearCloseTimeout = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    };

    // Schedule dropdown close with delay
    const scheduleClose = () => {
        clearCloseTimeout();
        closeTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 100); // 0.1 second delay
    };

    const handleToggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleMouseEnter = () => {
        clearCloseTimeout(); // Cancel any pending close
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        scheduleClose(); // Schedule close with delay instead of immediate close
    };

    const handleDropdownMouseEnter = () => {
        clearCloseTimeout(); // Cancel close when mouse enters dropdown
    };

    const handleDropdownMouseLeave = () => {
        scheduleClose(); // Schedule close when mouse leaves dropdown
    };

    const handleThemeSelect = (newTheme: "light" | "dark" | "system") => {
        clearCloseTimeout(); // Prevent auto-close during click
        setTheme(newTheme);
        setIsOpen(false);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            clearCloseTimeout();
        };
    }, []);

    return (
        <div ref={menuRef}>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleDropdown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="p-2 rounded-lg hover:bg-purple-500/30 transition-colors text-purple-200"
                title="Toggle theme"
            >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </Button>

            {isOpen && (
                <div
                    className="absolute right-12 top-14 mt-2 min-w-[160px] bg-gray-900/95 backdrop-blur-md border border-purple-600/30 rounded-lg shadow-xl z-[9999]"
                    onMouseEnter={handleDropdownMouseEnter}
                    onMouseLeave={handleDropdownMouseLeave}
                >
                    <div className="p-1 space-y-0.5">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleThemeSelect("light");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left ${
                                theme === "light" ? "bg-purple-600/20" : ""
                            }`}
                        >
                            <Sun className="w-4 h-4" />
                            Light
                        </button>

                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleThemeSelect("dark");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left ${
                                theme === "dark" ? "bg-purple-600/20" : ""
                            }`}
                        >
                            <Moon className="w-4 h-4" />
                            Dark
                        </button>

                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleThemeSelect("system");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors text-left ${
                                theme === "system" ? "bg-purple-600/20" : ""
                            }`}
                        >
                            <Monitor className="w-4 h-4" />
                            System
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
