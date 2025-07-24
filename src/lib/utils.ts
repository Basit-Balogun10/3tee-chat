import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return "< 1m";
}

export function generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Sound notification utilities for AI message replies - Phase 2
export class NotificationSounds {
    private static audioContext: AudioContext | null = null;
    private static sounds: Map<string, AudioBuffer> = new Map();

    // Initialize audio context
    private static getAudioContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext ||
                (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    // Generate simple notification sounds programmatically
    private static async generateSound(type: string): Promise<AudioBuffer> {
        const audioContext = this.getAudioContext();
        const duration = 0.3; // 300ms
        const sampleRate = audioContext.sampleRate;
        const frameCount = duration * sampleRate;
        const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);

        switch (type) {
            case "subtle":
                // Soft ascending tone
                for (let i = 0; i < frameCount; i++) {
                    const t = i / sampleRate;
                    const frequency = 800 + t * 200; // 800-1000Hz sweep
                    const envelope = Math.exp(-t * 3); // Decay envelope
                    channelData[i] =
                        Math.sin(2 * Math.PI * frequency * t) * envelope * 0.1;
                }
                break;

            case "chime":
                // Pleasant chime sound
                for (let i = 0; i < frameCount; i++) {
                    const t = i / sampleRate;
                    const envelope = Math.exp(-t * 4);
                    channelData[i] =
                        (Math.sin(2 * Math.PI * 880 * t) * 0.6 +
                            Math.sin(2 * Math.PI * 1320 * t) * 0.3 +
                            Math.sin(2 * Math.PI * 660 * t) * 0.1) *
                        envelope *
                        0.15;
                }
                break;

            case "ping":
                // Quick ping sound
                for (let i = 0; i < frameCount; i++) {
                    const t = i / sampleRate;
                    const envelope = Math.exp(-t * 8);
                    channelData[i] =
                        Math.sin(2 * Math.PI * 1200 * t) * envelope * 0.12;
                }
                break;

            default:
                return this.generateSound("subtle");
        }

        return buffer;
    }

    // Load or generate a sound
    private static async getSound(type: string): Promise<AudioBuffer> {
        if (this.sounds.has(type)) {
            return this.sounds.get(type)!;
        }

        const buffer = await this.generateSound(type);
        this.sounds.set(type, buffer);
        return buffer;
    }

    // Play notification sound
    static async playNotification(
        soundType: string = "subtle",
        volume: number = 0.5,
        onlyWhenUnfocused: boolean = true
    ): Promise<void> {
        try {
            // Check if we should only play when tab is unfocused
            if (onlyWhenUnfocused && document.hasFocus()) {
                return;
            }

            const audioContext = this.getAudioContext();

            // Resume context if suspended (required for some browsers)
            if (audioContext.state === "suspended") {
                await audioContext.resume();
            }

            const buffer = await this.getSound(soundType);
            const source = audioContext.createBufferSource();
            const gainNode = audioContext.createGain();

            source.buffer = buffer;
            gainNode.gain.value = Math.max(0, Math.min(1, volume));

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            source.start();
        } catch (error) {
            console.warn("Failed to play notification sound:", error);
        }
    }

    // Test sound playback (always plays regardless of focus)
    static async testSound(
        soundType: string = "subtle",
        volume: number = 0.5
    ): Promise<void> {
        return this.playNotification(soundType, volume, false);
    }

    // Get available sound types
    static getSoundTypes(): string[] {
        return ["subtle", "chime", "ping"];
    }
}

// Hook for using notification sounds with user preferences
export function useNotificationSounds() {
    const preferences = useQuery(api.preferences.getUserPreferences);

    const playAIReplySound = useCallback(async () => {
        const settings = preferences?.notificationSettings;
        if (!settings?.soundEnabled) return;

        await NotificationSounds.playNotification(
            settings.soundType || "subtle",
            settings.soundVolume || 0.5,
            settings.soundOnlyWhenUnfocused ?? true
        );
    }, [preferences?.notificationSettings]);

    const testSound = useCallback(async (soundType: string, volume: number) => {
        await NotificationSounds.testSound(soundType, volume);
    }, []);

    return {
        playAIReplySound,
        testSound,
        availableSounds: NotificationSounds.getSoundTypes(),
        settings: preferences?.notificationSettings,
    };
}

// Device info collection utility
export function getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // Extract browser information
    let browser = "Unknown Browser";
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
        browser = "Chrome";
    } else if (userAgent.includes("Firefox")) {
        browser = "Firefox";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
        browser = "Safari";
    } else if (userAgent.includes("Edg")) {
        browser = "Edge";
    } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
        browser = "Opera";
    }

    // Extract OS information
    let os = "Unknown OS";
    if (platform.includes("Win")) {
        os = "Windows";
    } else if (platform.includes("Mac")) {
        os = "macOS";
    } else if (platform.includes("Linux")) {
        os = "Linux";
    } else if (userAgent.includes("Android")) {
        os = "Android";
    } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
        os = "iOS";
    }

    // Generate device type
    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            userAgent
        );
    const deviceType = isMobile ? "Mobile" : "Desktop";

    return `${browser} on ${os} (${deviceType})`;
}

export function generateDeviceId(): string {
    // Generate a semi-persistent device ID based on browser characteristics
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx!.textBaseline = "top";
    ctx!.font = "14px Arial";
    ctx!.fillText("Device fingerprint", 2, 2);

    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
    ].join("|");

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
}
