import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({
        top: 0,
        right: 0,
    });
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
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

    // Calculate dropdown position when opening
    const updateDropdownPosition = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 8, // 8px gap below button
                right: window.innerWidth - rect.right, // Distance from right edge
            });
        }
    };

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
        if (!isOpen) {
            updateDropdownPosition();
        }
        setIsOpen(!isOpen);
    };

    const handleMouseEnter = () => {
        clearCloseTimeout(); // Cancel any pending close
        updateDropdownPosition();
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
        setTheme(newTheme);
        setIsOpen(false);
    };

    // Update position on window resize
    useEffect(() => {
        const handleResize = () => {
            if (isOpen) {
                updateDropdownPosition();
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isOpen]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            clearCloseTimeout();
        };
    }, []);

    const dropdownContent = isOpen && (
        <div
            className="fixed min-w-[160px] bg-gray-900/95 backdrop-blur-md border border-purple-600/30 rounded-lg shadow-xl z-[9999]"
            style={{
                top: `${dropdownPosition.top}px`,
                right: `${dropdownPosition.right}px`,
            }}
            onMouseEnter={handleDropdownMouseEnter}
            onMouseLeave={handleDropdownMouseLeave}
        >
            <div className="p-1 space-y-0.5">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleThemeSelect("light");
                        clearCloseTimeout(); // Prevent auto-close
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
                        clearCloseTimeout(); // Prevent auto-close
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
                        clearCloseTimeout(); // Prevent auto-close
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
    );

    return (
        <>
            <div className="relative" ref={menuRef}>
                <Button
                    ref={buttonRef}
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
            </div>

            {/* Render dropdown in a portal to avoid clipping */}
            {dropdownContent && createPortal(dropdownContent, document.body)}
        </>
    );
}
