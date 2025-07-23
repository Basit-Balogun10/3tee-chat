import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PasswordProtectionModal } from "./PasswordProtectionModal";
import { toast } from "sonner";

interface PasswordGatewayProps {
    chatId: Id<"chats">;
    children: React.ReactNode;
    onPasswordVerified?: () => void;
}

export function PasswordGateway({ chatId, children, onPasswordVerified }: PasswordGatewayProps) {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [lastVerifiedChat, setLastVerifiedChat] = useState<string | null>(null);

    // Get password status for the chat
    const passwordStatus = useQuery(api.chats.checkPasswordStatus, { chatId });
    
    // Check if password verification is needed
    useEffect(() => {
        if (passwordStatus) {
            const needsVerification = passwordStatus.needsVerification;
            const chatChanged = lastVerifiedChat !== chatId;
            
            if (needsVerification || chatChanged) {
                if (passwordStatus.isPasswordProtected) {
                    setIsVerified(false);
                    setShowPasswordModal(true);
                } else {
                    setIsVerified(true);
                    setLastVerifiedChat(chatId);
                }
            } else {
                setIsVerified(true);
            }
        }
    }, [passwordStatus, chatId, lastVerifiedChat]);

    const handlePasswordVerified = () => {
        setIsVerified(true);
        setLastVerifiedChat(chatId);
        setShowPasswordModal(false);
        onPasswordVerified?.();
        toast.success("🔓 Chat unlocked successfully!");
    };

    // Show password modal if verification is needed
    if (passwordStatus?.isPasswordProtected && !isVerified) {
        return (
            <>
                <div className="h-full flex items-center justify-center">
                    <div className="text-center p-8 bg-purple-500/10 rounded-xl border border-purple-500/30">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-purple-200 mb-2">Protected Chat</h3>
                        <p className="text-purple-300 text-sm mb-4">This chat is password protected. Please enter the password to continue.</p>
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg transition-all"
                        >
                            🔐 Unlock Chat
                        </button>
                    </div>
                </div>

                <PasswordProtectionModal
                    open={showPasswordModal}
                    onOpenChange={setShowPasswordModal}
                    chatId={chatId}
                    mode="verify"
                    onPasswordVerified={handlePasswordVerified}
                />
            </>
        );
    }

    // Show children if verified or not protected
    return (
        <>
            {children}
            <PasswordProtectionModal
                open={showPasswordModal}
                onOpenChange={setShowPasswordModal}
                chatId={chatId}
                mode="verify"
                onPasswordVerified={handlePasswordVerified}
            />
        </>
    );
}