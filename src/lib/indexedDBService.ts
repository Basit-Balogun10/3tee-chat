import Dexie, { Table } from 'dexie';
import { Id } from "../../convex/_generated/dataModel";

// Types (same as before but for IndexedDB)
export interface LocalChat {
    _id: Id<"chats">;
    title: string;
    model: string;
    updatedAt: number;
    _creationTime: number;
    isStarred?: boolean;
    userId?: Id<"users">;
}

export interface LocalMessage {
    _id: Id<"messages">;
    chatId: Id<"chats">;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    model?: string;
    isStreaming?: boolean;
    attachments?: Array<{
        type: "image" | "pdf" | "file" | "audio";
        storageId: Id<"_storage">;
        name: string;
        size: number;
    }>;
    metadata?: {
        searchResults?: Array<{
            title: string;
            url: string;
            snippet: string;
            source?: string;
        }>;
        imagePrompt?: string;
        generatedImageUrl?: string;
        audioTranscription?: string;
        videoPrompt?: string;
        generatedVideoUrl?: string;
        videoThumbnailUrl?: string;
        videoDuration?: string;
        videoResolution?: string;
    };
}

export interface LocalProject {
    _id: Id<"projects">;
    name: string;
    description?: string;
    userId: Id<"users">;
    _creationTime: number;
    updatedAt: number;
    chatIds: Id<"chats">[];
}

// IndexedDB Database using Dexie
export class LocalFirstDatabase extends Dexie {
    chats!: Table<LocalChat>;
    messages!: Table<LocalMessage>;
    projects!: Table<LocalProject>;

    constructor() {
        super('LocalFirstDB');
        
        this.version(1).stores({
            chats: '&_id, title, model, updatedAt, _creationTime, isStarred, userId',
            messages: '&_id, chatId, role, timestamp, model, isStreaming',
            projects: '&_id, name, userId, _creationTime, updatedAt, *chatIds'
        });
    }
}

// Create database instance
const db = new LocalFirstDatabase();

// IndexedDB Service Class
class IndexedDBService {
    private db = db;

    // ==================== CHAT OPERATIONS ====================

    async getChats(): Promise<LocalChat[]> {
        try {
            return await this.db.chats.orderBy('updatedAt').reverse().toArray();
        } catch (error) {
            console.error('Failed to get chats:', error);
            return [];
        }
    }

    async addChat(chat: LocalChat): Promise<void> {
        try {
            await this.db.chats.add(chat);
        } catch (error) {
            console.error('Failed to add chat:', error);
            throw error;
        }
    }

    async updateChat(chatId: Id<"chats">, updates: Partial<LocalChat>): Promise<void> {
        try {
            await this.db.chats.update(chatId, updates);
        } catch (error) {
            console.error('Failed to update chat:', error);
            throw error;
        }
    }

    async deleteChat(chatId: Id<"chats">): Promise<void> {
        try {
            // Delete the chat and all its messages in a transaction
            await this.db.transaction('rw', this.db.chats, this.db.messages, async () => {
                await this.db.chats.delete(chatId);
                await this.db.messages.where('chatId').equals(chatId).delete();
            });
        } catch (error) {
            console.error('Failed to delete chat:', error);
            throw error;
        }
    }

    async getChat(chatId: Id<"chats">): Promise<LocalChat | undefined> {
        try {
            return await this.db.chats.get(chatId);
        } catch (error) {
            console.error('Failed to get chat:', error);
            return undefined;
        }
    }

    async clearAllChats(): Promise<void> {
        try {
            await this.db.transaction('rw', this.db.chats, this.db.messages, async () => {
                await this.db.chats.clear();
                await this.db.messages.clear();
            });
        } catch (error) {
            console.error('Failed to clear chats:', error);
            throw error;
        }
    }

    // ==================== MESSAGE OPERATIONS ====================

    async getMessages(): Promise<LocalMessage[]> {
        try {
            return await this.db.messages.orderBy('timestamp').toArray();
        } catch (error) {
            console.error('Failed to get messages:', error);
            return [];
        }
    }

    async getChatMessages(chatId: Id<"chats">): Promise<LocalMessage[]> {
        try {
            return await this.db.messages
                .where('chatId')
                .equals(chatId)
                .sortBy('timestamp');
        } catch (error) {
            console.error('Failed to get chat messages:', error);
            return [];
        }
    }

    async addMessage(message: LocalMessage): Promise<void> {
        try {
            await this.db.messages.add(message);
        } catch (error) {
            console.error('Failed to add message:', error);
            throw error;
        }
    }

    async updateMessage(messageId: Id<"messages">, updates: Partial<LocalMessage>): Promise<void> {
        try {
            await this.db.messages.update(messageId, updates);
        } catch (error) {
            console.error('Failed to update message:', error);
            throw error;
        }
    }

    async deleteMessage(messageId: Id<"messages">): Promise<void> {
        try {
            await this.db.messages.delete(messageId);
        } catch (error) {
            console.error('Failed to delete message:', error);
            throw error;
        }
    }

    // ==================== PROJECT OPERATIONS ====================

    async getProjects(): Promise<LocalProject[]> {
        try {
            return await this.db.projects.orderBy('updatedAt').reverse().toArray();
        } catch (error) {
            console.error('Failed to get projects:', error);
            return [];
        }
    }

    async addProject(project: LocalProject): Promise<void> {
        try {
            await this.db.projects.add(project);
        } catch (error) {
            console.error('Failed to add project:', error);
            throw error;
        }
    }

    async updateProject(projectId: Id<"projects">, updates: Partial<LocalProject>): Promise<void> {
        try {
            await this.db.projects.update(projectId, updates);
        } catch (error) {
            console.error('Failed to update project:', error);
            throw error;
        }
    }

    async deleteProject(projectId: Id<"projects">): Promise<void> {
        try {
            await this.db.projects.delete(projectId);
        } catch (error) {
            console.error('Failed to delete project:', error);
            throw error;
        }
    }

    async getProject(projectId: Id<"projects">): Promise<LocalProject | undefined> {
        try {
            return await this.db.projects.get(projectId);
        } catch (error) {
            console.error('Failed to get project:', error);
            return undefined;
        }
    }

    async clearAllProjects(): Promise<void> {
        try {
            await this.db.projects.clear();
        } catch (error) {
            console.error('Failed to clear projects:', error);
            throw error;
        }
    }

    // ==================== UTILITY OPERATIONS ====================

    async exportAllData() {
        try {
            const [chats, messages, projects] = await Promise.all([
                this.getChats(),
                this.getMessages(),
                this.getProjects()
            ]);

            return {
                chats,
                messages,
                projects,
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };
        } catch (error) {
            console.error('Failed to export data:', error);
            throw error;
        }
    }

    async importAllData(data: { 
        chats: LocalChat[], 
        messages: LocalMessage[], 
        projects: LocalProject[] 
    }): Promise<void> {
        try {
            await this.db.transaction('rw', this.db.chats, this.db.messages, this.db.projects, async () => {
                // Clear existing data
                await this.db.chats.clear();
                await this.db.messages.clear();
                await this.db.projects.clear();

                // Import new data
                if (data.chats?.length) await this.db.chats.bulkAdd(data.chats);
                if (data.messages?.length) await this.db.messages.bulkAdd(data.messages);
                if (data.projects?.length) await this.db.projects.bulkAdd(data.projects);
            });
        } catch (error) {
            console.error('Failed to import data:', error);
            throw error;
        }
    }

    async clearAllData(): Promise<void> {
        try {
            await this.db.transaction('rw', this.db.chats, this.db.messages, this.db.projects, async () => {
                await this.db.chats.clear();
                await this.db.messages.clear();
                await this.db.projects.clear();
            });
        } catch (error) {
            console.error('Failed to clear all data:', error);
            throw error;
        }
    }

    async getStorageInfo() {
        try {
            const [chats, messages, projects] = await Promise.all([
                this.db.chats.count(),
                this.db.messages.count(),
                this.db.projects.count()
            ]);

            // Estimate storage usage (rough calculation)
            const estimatedSize = await navigator.storage?.estimate?.();

            return {
                totalChats: chats,
                totalMessages: messages,
                totalProjects: projects,
                estimatedSize: estimatedSize?.usage || 0,
                quota: estimatedSize?.quota || 0
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return {
                totalChats: 0,
                totalMessages: 0,
                totalProjects: 0,
                estimatedSize: 0,
                quota: 0
            };
        }
    }

    // ==================== SEARCH OPERATIONS ====================

    async searchChats(query: string): Promise<LocalChat[]> {
        try {
            const searchTerm = query.toLowerCase();
            return await this.db.chats
                .filter(chat => chat.title.toLowerCase().includes(searchTerm))
                .sortBy('updatedAt');
        } catch (error) {
            console.error('Failed to search chats:', error);
            return [];
        }
    }

    async searchMessages(query: string, chatId?: Id<"chats">): Promise<LocalMessage[]> {
        try {
            const searchTerm = query.toLowerCase();
            let collection = this.db.messages.filter(message => 
                message.content.toLowerCase().includes(searchTerm)
            );

            if (chatId) {
                collection = collection.and(message => message.chatId === chatId);
            }

            return await collection.sortBy('timestamp');
        } catch (error) {
            console.error('Failed to search messages:', error);
            return [];
        }
    }

    async searchProjects(query: string): Promise<LocalProject[]> {
        try {
            const searchTerm = query.toLowerCase();
            return await this.db.projects
                .filter(project => 
                    project.name.toLowerCase().includes(searchTerm) ||
                    project.description?.toLowerCase().includes(searchTerm)
                )
                .sortBy('updatedAt');
        } catch (error) {
            console.error('Failed to search projects:', error);
            return [];
        }
    }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
export { LocalFirstDatabase };