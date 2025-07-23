import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Key,
    Shield,
    X,
    AlertTriangle,
} from "lucide-react";

interface PasswordProtectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chatId: Id<"chats">;
    mode: "set" | "verify" | "remove";
    onPasswordVerified?: () => void;
}

export function PasswordProtectionModal({
    open,
    onOpenChange,
    chatId,
    mode,
    onPasswordVerified,
}: PasswordProtectionModalProps) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [hint, setHint] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Get password status for the chat
    const passwordStatus = useQuery(api.chats.checkPasswordStatus, { chatId });
    
    // Mutations
    const setPasswordProtection = useMutation(api.chats.setPasswordProtection);
    const verifyPasswordProtection = useMutation(api.chats.verifyPasswordProtection);
    const removePasswordProtection = useMutation(api.chats.removePasswordProtection);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            toast.error("Password is required");
            return;
        }

        setIsLoading(true);

        try {
            if (mode === "set") {
                if (password !== confirmPassword) {
                    toast.error("Passwords don't match");
                    setIsLoading(false);
                    return;
                }

                if (password.length < 6) {
                    toast.error("Password must be at least 6 characters");
                    setIsLoading(false);
                    return;
                }

                await setPasswordProtection({
                    chatId,
                    password,
                    hint: hint.trim() || undefined,
                });

                toast.success("🔒 Chat is now password protected!");
                
            } else if (mode === "verify") {
                const result = await verifyPasswordProtection({
                    chatId,
                    password,
                });

                if (result.verified) {
                    toast.success("✅ Password verified!");
                    onPasswordVerified?.();
                } else {
                    toast.error("❌ Incorrect password");
                    setIsLoading(false);
                    return;
                }
                
            } else if (mode === "remove") {
                await removePasswordProtection({
                    chatId,
                    currentPassword: password,
                });

                toast.success("🔓 Password protection removed");
            }

            // Reset form and close modal
            setPassword("");
            setConfirmPassword("");
            setHint("");
            setShowPassword(false);
            setShowConfirmPassword(false);
            onOpenChange(false);
            
        } catch (error: any) {
            console.error("Password operation failed:", error);
            if (error.message === "Invalid password") {
                toast.error("❌ Incorrect password");
            } else {
                toast.error("Failed to update password protection");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const getModalContent = () => {
        switch (mode) {
            case "set":
                return {
                    title: "🔒 Set Password Protection",
                    description: "Protect this chat with a password. Only you will be able to access it.",
                    icon: <Shield className="w-5 h-5 text-green-400" />,
                    color: "green"
                };
            case "verify":
                return {
                    title: "🔐 Enter Password",
                    description: "This chat is password protected. Enter the password to access it.",
                    icon: <Key className="w-5 h-5 text-blue-400" />,
                    color: "blue"
                };
            case "remove":
                return {
                    title: "🔓 Remove Password Protection",
                    description: "Enter your current password to remove protection from this chat.",
                    icon: <Unlock className="w-5 h-5 text-orange-400" />,
                    color: "orange"
                };
            default:
                return {
                    title: "Password Protection",
                    description: "",
                    icon: <Lock className="w-5 h-5 text-purple-400" />,
                    color: "purple"
                };
        }
    };

    const modalContent = getModalContent();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900/95 backdrop-blur-lg border border-purple-500/30 text-purple-100 max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {modalContent.icon}
                            <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                {modalContent.title}
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
                        {modalContent.description}
                    </p>

                    {/* Password hint display for verify mode */}
                    {mode === "verify" && passwordStatus?.passwordHint && (
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                            <div className="flex items-center gap-2 mb-1">
                                <Key className="w-4 h-4 text-blue-400" />
                                <span className="text-blue-200 text-sm font-medium">Password Hint</span>
                            </div>
                            <p className="text-blue-300 text-sm italic">
                                "{passwordStatus.passwordHint}"
                            </p>
                        </div>
                    )}

                    {/* Password Input */}
                    <div className="space-y-2">
                        <label className="text-purple-200 text-sm font-medium">
                            {mode === "remove" ? "Current Password" : "Password"}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={mode === "set" ? "Enter a secure password..." : "Enter password..."}
                                className="w-full px-3 py-2 pr-10 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                required
                                minLength={mode === "set" ? 6 : 1}
                                autoFocus
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {mode === "set" && (
                            <p className="text-xs text-purple-400">
                                Minimum 6 characters. Use a strong, unique password.
                            </p>
                        )}
                    </div>

                    {/* Confirm Password for set mode */}
                    {mode === "set" && (
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
                    )}

                    {/* Password Hint for set mode */}
                    {mode === "set" && (
                        <div className="space-y-2">
                            <label className="text-purple-200 text-sm font-medium">
                                Password Hint (Optional)
                            </label>
                            <input
                                type="text"
                                value={hint}
                                onChange={(e) => setHint(e.target.value)}
                                placeholder="A hint to help you remember..."
                                className="w-full px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                disabled={isLoading}
                                maxLength={100}
                            />
                            <p className="text-xs text-purple-400">
                                Optional hint to help you remember your password. Don't make it too obvious!
                            </p>
                        </div>
                    )}

                    {/* Warning for remove mode */}
                    {mode === "remove" && (
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-400" />
                                <span className="text-orange-200 text-sm font-medium">Warning</span>
                            </div>
                            <p className="text-orange-300 text-sm mt-1">
                                Removing password protection will make this chat accessible without a password.
                            </p>
                        </div>
                    )}

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
                            className={`${
                                modalContent.color === "green" 
                                    ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                    : modalContent.color === "blue"
                                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                                    : modalContent.color === "orange"
                                    ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                                    : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                            } text-white`}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : mode === "set" ? (
                                "Set Password"
                            ) : mode === "verify" ? (
                                "Unlock Chat"
                            ) : (
                                "Remove Protection"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}