import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    Monitor,
    Smartphone,
    Tablet,
    Globe,
    LogOut,
    AlertTriangle,
    Trash2,
    Shield,
    Clock,
    MapPin,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function SessionManagement() {
    const [isLoading, setIsLoading] = useState(false);

    const sessions = useQuery(api.sessions.getUserSessions);
    const signOutSession = useMutation(api.sessions.signOutSession);
    const signOutAllOtherSessions = useMutation(
        api.sessions.signOutAllOtherSessions
    );
    const signOutAllSessions = useMutation(api.sessions.signOutAllSessions);
    const updateSessionActivity = useMutation(
        api.sessions.updateSessionActivity
    );

    // Update current session activity periodically
    useEffect(() => {
        const interval = setInterval(() => {
            void updateSessionActivity();
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [updateSessionActivity]);

    // Store session metadata on component mount
    useEffect(() => {
        const storeMetadata = async () => {
            try {
                const deviceInfo = navigator.userAgent;
                const deviceName = getDeviceName(deviceInfo);

                // Try to get IP address (fallback to client-side detection)
                let ipAddress;
                try {
                    const response = await fetch(
                        "https://api.ipify.org?format=json"
                    );
                    const data = await response.json();
                    ipAddress = data.ip;
                } catch {
                    ipAddress = "Unknown";
                }

                await fetch("/api/store-session-metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        deviceInfo,
                        deviceName,
                        ipAddress,
                    }),
                });
            } catch (error) {
                console.error("Failed to store session metadata:", error);
            }
        };

        void storeMetadata();
    }, []);

    const getDeviceName = (userAgent: string): string => {
        if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
            if (/iPhone/.test(userAgent)) return "iPhone";
            if (/iPad/.test(userAgent)) return "iPad";
            if (/Android/.test(userAgent)) return "Android Device";
            return "Mobile Device";
        }

        if (/Tablet/.test(userAgent)) return "Tablet";

        // Desktop browsers
        if (/Chrome/.test(userAgent)) return "Chrome Browser";
        if (/Firefox/.test(userAgent)) return "Firefox Browser";
        if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent))
            return "Safari Browser";
        if (/Edge/.test(userAgent)) return "Edge Browser";

        return "Desktop Computer";
    };

    const getDeviceIcon = (deviceInfo: string) => {
        if (/Mobile|Android|iPhone/.test(deviceInfo)) {
            return <Smartphone className="w-5 h-5" />;
        }
        if (/iPad|Tablet/.test(deviceInfo)) {
            return <Tablet className="w-5 h-5" />;
        }
        return <Monitor className="w-5 h-5" />;
    };

    const formatLastActivity = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    const handleSignOutSession = async (sessionId: string) => {
        setIsLoading(true);
        try {
            await signOutSession({ sessionId });
            toast.success("Device signed out successfully");
        } catch (error) {
            console.error("Failed to sign out session:", error);
            toast.error("Failed to sign out device");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOutAllOtherSessions = async () => {
        setIsLoading(true);
        try {
            const result = await signOutAllOtherSessions();
            toast.success(
                `Signed out from ${result.signedOutSessions} other devices`
            );
        } catch (error) {
            console.error("Failed to sign out other sessions:", error);
            toast.error("Failed to sign out other devices");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOutAllSessions = async () => {
        setIsLoading(true);
        try {
            await signOutAllSessions();
            // This will sign out the current session too, so the user will be redirected
            toast.success("Signed out from all devices");
        } catch (error) {
            console.error("Failed to sign out all sessions:", error);
            toast.error("Failed to sign out all devices");
        } finally {
            setIsLoading(false);
        }
    };

    if (!sessions) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-purple-200">
                        Active Sessions
                    </h3>
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                </div>
                <div className="text-center py-8 text-purple-400">
                    Loading sessions...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-purple-200">
                    Active Sessions
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-400">
                        {sessions.length} active{" "}
                        {sessions.length === 1 ? "session" : "sessions"}
                    </span>
                    <Shield className="w-4 h-4 text-green-400" />
                </div>
            </div>

            {/* Current Session */}
            {sessions.map((session) => (
                <div
                    key={session.sessionId}
                    className={`p-4 rounded-lg border transition-colors ${
                        session.isCurrentSession
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-gray-700/30 border-gray-600/30"
                    }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                            <div
                                className={`p-2 rounded-lg ${
                                    session.isCurrentSession
                                        ? "bg-green-500/20"
                                        : "bg-gray-600/20"
                                }`}
                            >
                                {getDeviceIcon(session.deviceInfo)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-purple-100 font-medium truncate">
                                        {session.deviceName || "Unknown Device"}
                                    </h4>
                                    {session.isCurrentSession && (
                                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                                            Current
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1 text-sm text-purple-300">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                            Last active:{" "}
                                            {formatLastActivity(
                                                session.lastActivity
                                            )}
                                        </span>
                                    </div>

                                    {session.ipAddress &&
                                        session.ipAddress !== "Unknown" && (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3 h-3" />
                                                <span>
                                                    IP: {session.ipAddress}
                                                </span>
                                            </div>
                                        )}

                                    <div className="flex items-center gap-2">
                                        <Globe className="w-3 h-3" />
                                        <span className="truncate text-xs text-purple-400">
                                            {session.deviceInfo}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!session.isCurrentSession && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    handleSignOutSession(session.sessionId)
                                }
                                disabled={isLoading}
                                className="ml-3 flex items-center gap-2 text-red-300 border-red-500/30 hover:bg-red-500/20"
                            >
                                <LogOut className="w-3 h-3" />
                                Sign Out
                            </Button>
                        )}
                    </div>
                </div>
            ))}

            {/* Action Buttons */}
            {sessions.length > 1 && (
                <div className="space-y-3 pt-4 border-t border-purple-600/20">
                    <div className="flex items-center gap-2 text-orange-300">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">Security Actions</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="outline"
                            onClick={handleSignOutAllOtherSessions}
                            disabled={isLoading}
                            className="flex items-center gap-2 text-orange-300 border-orange-500/30 hover:bg-orange-500/20"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out Other Devices
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleSignOutAllSessions}
                            disabled={isLoading}
                            className="flex items-center gap-2 text-red-300 border-red-500/30 hover:bg-red-500/20"
                        >
                            <Trash2 className="w-4 h-4" />
                            Sign Out All Devices
                        </Button>
                    </div>

                    <p className="text-xs text-purple-400">
                        "Sign Out All Devices" will sign you out from this
                        device too and require you to log in again.
                    </p>
                </div>
            )}

            {/* Security Information */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-300 mt-0.5" />
                    <div>
                        <h4 className="text-blue-200 font-medium mb-1">
                            Session Security
                        </h4>
                        <p className="text-sm text-blue-300">
                            Monitor and manage your active sessions across
                            different devices. If you see any unfamiliar
                            activity, sign out from those devices immediately.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
