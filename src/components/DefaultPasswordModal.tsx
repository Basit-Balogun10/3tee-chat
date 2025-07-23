import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
    Eye,
    EyeOff,
    Key,
    Shield,
    X,
    AlertTriangle,
} from "lucide-react";
import bcrypt from "bcryptjs";

interface DefaultPasswordModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DefaultPasswordModal({
    open,
    onOpenChange,
}: DefaultPasswordModalProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const preferences = useQuery(api.preferences.getUserPreferences);
    const updatePreferences = useMutation(api.preferences.updatePreferences);

    const hasDefaultPassword = Boolean(preferences?.passwordSettings?.defaultPasswordHash);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation for setting/changing password
        if (!newPassword.trim()) {
            toast.error("Password is required");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        // For changing password, verify current password
        if (hasDefaultPassword && !currentPassword.trim()) {
            toast.error("Current password is required");
            return;
        }

        setIsLoading(true);

        try {
            if (hasDefaultPassword) {
                // Verify current password first
                const currentSettings = preferences?.passwordSettings;
                const isValidCurrent = await bcrypt.compare(currentPassword, currentSettings.defaultPasswordHash);
                if (!isValidCurrent) {
                    toast.error("❌ Incorrect current password");
                    return;
                }
            }
            
            // Generate salt and hash for new password
            const salt = await bcrypt.genSalt(12);
            const hash = await bcrypt.hash(newPassword, salt);
            
            await updatePreferences({
                passwordSettings: {
                    ...preferences?.passwordSettings,
                    defaultPasswordHash: hash,
                    defaultPasswordSalt: salt,
                    useDefaultPassword: true,
                    sessionTimeoutEnabled: true,
                    autoLockTimeout: 30,
                }
            });
            
            toast.success(hasDefaultPassword ? "🔄 Default password changed successfully!" : "🔒 Default password set successfully!");

            // Reset form and close modal
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowCurrentPassword(false);
            setShowNewPassword(false);
            setShowConfirmPassword(false);
            onOpenChange(false);
            
        } catch (error: any) {
            console.error("Default password operation failed:", error);
            toast.error(`Failed to ${hasDefaultPassword ? 'change' : 'set'} default password`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900/95 backdrop-blur-lg border border-purple-500/30 text-purple-100 max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-blue-400" />
                            <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                {hasDefaultPassword ? "🔄 Change Default Password" : "🔒 Set Default Password"}
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Description */}
                    <p className="text-purple-300 text-sm">
                        {hasDefaultPassword 
                            ? "Update your default password. This won't affect existing protected chats with custom passwords."
                            : "Set a default password to quickly protect new chats without entering a password each time."
                        }
                    </p>

                    {/* Status indicator */}
                    <div className={`p-3 rounded-lg border ${
                        hasDefaultPassword 
                            ? "bg-green-500/10 border-green-500/30" 
                            : "bg-gray-500/10 border-gray-500/30"
                    }`}>
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium text-green-200">
                                Default Password Status
                            </span>
                        </div>
                        <p className="text-sm mt-1 text-green-300">
                            {hasDefaultPassword 
                                ? "✅ Default password is currently set" 
                                : "❌ No default password is set"
                            }
                        </p>
                    </div>

                    {/* Current Password (only show if password exists) */}
                    {hasDefaultPassword && (
                        <div className="space-y-2">
                            <label className="text-purple-200 text-sm font-medium">
                                Current Default Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password..."
                                    className="w-full px-3 py-2 pr-10 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                    required
                                    autoFocus
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                                    tabIndex={-1}
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* New Password */}
                    <div className="space-y-2">
                        <label className="text-purple-200 text-sm font-medium">
                            {hasDefaultPassword ? "New Default Password" : "Default Password"}
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter a secure password..."
                                className="w-full px-3 py-2 pr-10 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                required
                                minLength={6}
                                autoFocus={!hasDefaultPassword}
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                                tabIndex={-1}
                            >
                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-purple-400">
                            Minimum 6 characters. Use a strong, unique password.
                        </p>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label className="text-purple-200 text-sm font-medium">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password..."
                                className="w-full px-3 py-2 pr-10 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                required
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                                tabIndex={-1}
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="text-purple-300 border-purple-500/30 hover:bg-purple-500/20"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                hasDefaultPassword ? "Change Password" : "Set Password"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}