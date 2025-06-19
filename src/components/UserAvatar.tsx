import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { AuthComponent } from "./AuthComponent";

interface UserAvatarProps {
    onOpenSettings?: () => void;
}

export function UserAvatar({ onOpenSettings }: UserAvatarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const user = useQuery(api.users.getCurrentUser);
    const menuRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { signOut } = useAuthActions();

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
        }, 100); // 0.3 second delay
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

    const handleToggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleSignOut = async () => {
        await signOut();
        setShowAuth(true);
        setIsOpen(false);
    };

    const handleLoginClick = async () => {
        // Sign out any existing anonymous session before showing auth
        await signOut();
        setShowAuth(true);
    };

    // Show auth component if requested
    if (showAuth) {
        return <AuthComponent />;
    }

    if (!user) return null;

    // Check if this is an anonymous user (no email or name set)
    const isAnonymous =
        !user.email && (!user.name || user.name === "Anonymous");

    if (isAnonymous) {
        return (
            <div className="p-2">
                <button
                    onClick={handleLoginClick}
                    className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-pink-500/60 to-purple-500/60 text-white font-medium hover:from-pink-500/50 hover:to-purple-500/50 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                    Login
                </button>
            </div>
        );
    }

    const initials = user.name
        ? user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
        : user.email?.[0]?.toUpperCase() || "?";

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={handleToggleDropdown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="flex items-center space-x-4 w-full p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
            >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-600/60 to-purple-600/60 flex items-center justify-center text-white font-medium">
                    {user.image ? (
                        <img
                            src={user.image}
                            alt={user.name || user.email}
                            className="w-full h-full rounded-full object-cover"
                        />
                    ) : (
                        initials
                    )}
                </div>
                <div className="min-w-0 text-left">
                    <div className="text-sm font-medium text-purple-100 truncate">
                        {user.name || "Anonymous"}
                    </div>
                    <div className="text-xs text-purple-300 truncate">
                        {user.email}
                    </div>
                </div>
            </button>

            {isOpen && (
                <div
                    className="absolute left-0 bottom-full mb-1 w-full bg-gray-900/90 backdrop-blur-md border border-purple-600/30 rounded-lg shadow-xl z-50 overflow-hidden"
                    onMouseEnter={handleDropdownMouseEnter}
                    onMouseLeave={handleDropdownMouseLeave}
                >
                    <div className="p-1 space-y-0.5">
                        {onOpenSettings && (
                            <button
                                onClick={() => {
                                    onOpenSettings();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-purple-100 hover:bg-purple-600/20 rounded-lg transition-colors"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                Settings
                            </button>
                        )}

                        <div className="border-t border-purple-600/20 my-1"></div>
                        <div className="p-2">
                            <button
                                onClick={handleSignOut}
                                className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500/60 to-purple-500/60 text-white font-medium hover:from-pink-500/50 hover:to-purple-500/50 transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
