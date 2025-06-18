import { Id } from "../../convex/_generated/dataModel";

// Preferences interface (keep this in localStorage for simplicity)
interface LocalPreferences {
    _id?: Id<"preferences">;
    userId?: Id<"users">;
    defaultModel: string;
    theme: "light" | "dark" | "system";
    localFirst: boolean;
    apiKeys: {
        openai?: string;
        anthropic?: string;
        gemini?: string;
        deepseek?: string;
        openrouter?: string;
    };
    apiKeyPreferences: {
        openai: boolean;
        anthropic: boolean;
        gemini: boolean;
        deepseek: boolean;
        openrouter: boolean;
    };
    voiceSettings: {
        autoPlay: boolean;
        voice: string;
        speed: number;
        buzzWord: string;
    };
}

const STORAGE_KEYS = {
    PREFERENCES: 'local_preferences',
    LOCAL_FIRST_MODE: 'local_first_mode'
} as const;

class LocalStorageService {
    // Check if we're in local-first mode
    isLocalFirstMode(): boolean {
        return localStorage.getItem(STORAGE_KEYS.LOCAL_FIRST_MODE) === 'true';
    }

    // Set local-first mode
    setLocalFirstMode(enabled: boolean): void {
        localStorage.setItem(STORAGE_KEYS.LOCAL_FIRST_MODE, enabled.toString());
    }

    // Preferences operations (keep in localStorage for simplicity)
    getPreferences(): LocalPreferences {
        const preferences = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
        return preferences ? JSON.parse(preferences) : {
            defaultModel: "gpt-4o-mini",
            theme: "dark",
            localFirst: false,
            apiKeys: {},
            apiKeyPreferences: {
                openai: true,
                anthropic: true,
                gemini: true,
                deepseek: true,
                openrouter: true,
            },
            voiceSettings: {
                autoPlay: false,
                voice: "alloy",
                speed: 1.0,
                buzzWord: "",
            },
        };
    }

    savePreferences(preferences: LocalPreferences): void {
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    }

    updatePreferences(updates: Partial<LocalPreferences>): void {
        const preferences = this.getPreferences();
        const updatedPreferences = { ...preferences, ...updates };
        this.savePreferences(updatedPreferences);
    }

    clearPreferences(): void {
        localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    }

    // Migration helper for moving from localStorage to IndexedDB
    getMigrationData() {
        // Check if old data exists in localStorage
        const oldChats = localStorage.getItem('local_chats');
        const oldMessages = localStorage.getItem('local_messages');
        const oldProjects = localStorage.getItem('local_projects');

        if (!oldChats && !oldMessages && !oldProjects) {
            return null; // No migration needed
        }

        return {
            chats: oldChats ? JSON.parse(oldChats) : [],
            messages: oldMessages ? JSON.parse(oldMessages) : [],
            projects: oldProjects ? JSON.parse(oldProjects) : [],
        };
    }

    // Clear old localStorage data after migration
    clearMigrationData(): void {
        localStorage.removeItem('local_chats');
        localStorage.removeItem('local_messages');
        localStorage.removeItem('local_projects');
    }
}

export const localStorageService = new LocalStorageService();
export type { LocalPreferences };
