import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { localStorageService, LocalChat, LocalMessage, LocalPreferences } from "../lib/localStorageService";

export interface UseLocalFirstReturn {
    // Data
    chats: { starred: LocalChat[]; regular: LocalChat[] };
    messages: LocalMessage[];
    preferences: LocalPreferences;

    // Loading states
    isLoading: boolean;
    isLocalFirst: boolean;

    // Chat operations
    createChat: (title: string, model: string) => Promise<Id<"chats">>;
    updateChatTitle: (chatId: Id<"chats">, title: string) => Promise<void>;
    deleteChat: (chatId: Id<"chats">) => Promise<void>;
    toggleChatStar: (chatId: Id<"chats">) => Promise<void>;

    // Message operations
    sendMessage: (
        chatId: Id<"chats">,
        content: string,
        role: "user" | "assistant",
        model?: string,
        attachments?: any[],
        metadata?: any
    ) => Promise<Id<"messages">>;
    updateMessage: (messageId: Id<"messages">, content: string) => Promise<void>;
    deleteMessage: (messageId: Id<"messages">) => Promise<void>;

    // Preferences operations
    updatePreferences: (updates: Partial<LocalPreferences>) => Promise<void>;

    // Utility functions
    getChatMessages: (chatId: Id<"chats">) => LocalMessage[];
    getChat: (chatId: Id<"chats">) => LocalChat | undefined;
}

export function useLocalFirst(): UseLocalFirstReturn {
    const [isLocalFirst] = useState(() => localStorageService.isLocalFirstMode());
    const [localChats, setLocalChats] = useState<LocalChat[]>([]);
    const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
    const [localPreferences, setLocalPreferences] = useState<LocalPreferences>(() => 
        localStorageService.getPreferences()
    );
    const [isLoading, setIsLoading] = useState(true);

    // Server queries (only used when NOT in local-first mode)
    const serverChats = useQuery(api.chats.listChats, isLocalFirst ? "skip" : undefined);
    const serverPreferences = useQuery(api.preferences.getUserPreferences, isLocalFirst ? "skip" : undefined);
    
    // Server mutations (only used when NOT in local-first mode)
    const createServerChat = useMutation(api.chats.createChat);
    const updateServerChatTitle = useMutation(api.chats.updateChatTitle);
    const deleteServerChat = useMutation(api.chats.deleteChat);
    const toggleServerChatStar = useMutation(api.chats.toggleChatStar);
    const sendServerMessage = useMutation(api.messages.sendMessage);
    const updateServerMessage = useMutation(api.messages.updateMessage);
    const deleteServerMessage = useMutation(api.messages.deleteMessage);
    const updateServerPreferences = useMutation(api.preferences.updatePreferences);

    // Load local data
    const loadLocalData = useCallback(() => {
        if (isLocalFirst) {
            const chats = localStorageService.getChats();
            const messages = localStorageService.getMessages();
            const preferences = localStorageService.getPreferences();
            setLocalChats(chats);
            setLocalMessages(messages);
            setLocalPreferences(preferences);
        }
        setIsLoading(false);
    }, [isLocalFirst]);

    // Initialize data loading
    useEffect(() => {
        loadLocalData();
    }, [loadLocalData]);

    // Convert server data to local format when not in local-first mode
    useEffect(() => {
        if (!isLocalFirst && serverChats) {
            const allServerChats = [...serverChats.starred, ...serverChats.regular];
            setLocalChats(allServerChats);
            setIsLoading(false);
        }
    }, [isLocalFirst, serverChats]);

    // Handle server preferences when not in local-first mode
    useEffect(() => {
        if (!isLocalFirst && serverPreferences) {
            setLocalPreferences(serverPreferences as LocalPreferences);
        }
    }, [isLocalFirst, serverPreferences]);

    // Generate unique IDs for local storage
    const generateId = (): Id<"chats"> | Id<"messages"> => {
        return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any;
    };

    // ==================== CHAT OPERATIONS ====================

    const createChat = useCallback(async (title: string, model: string): Promise<Id<"chats">> => {
        if (isLocalFirst) {
            // Create in local storage
            const chatId = generateId() as Id<"chats">;
            const newChat: LocalChat = {
                _id: chatId,
                title,
                model,
                updatedAt: Date.now(),
                _creationTime: Date.now(),
                isStarred: false,
            };
            localStorageService.addChat(newChat);
            loadLocalData();
            return chatId;
        } else {
            // Create on server
            return await createServerChat({ title, model });
        }
    }, [isLocalFirst, createServerChat, loadLocalData]);

    const updateChatTitle = useCallback(async (chatId: Id<"chats">, title: string): Promise<void> => {
        if (isLocalFirst) {
            // Update in local storage
            localStorageService.updateChat(chatId, { title, updatedAt: Date.now() });
            loadLocalData();
        } else {
            // Update on server
            await updateServerChatTitle({ chatId, title });
        }
    }, [isLocalFirst, updateServerChatTitle, loadLocalData]);

    const deleteChat = useCallback(async (chatId: Id<"chats">): Promise<void> => {
        if (isLocalFirst) {
            // Delete from local storage
            localStorageService.deleteChat(chatId);
            loadLocalData();
        } else {
            // Delete from server
            await deleteServerChat({ chatId });
        }
    }, [isLocalFirst, deleteServerChat, loadLocalData]);

    const toggleChatStar = useCallback(async (chatId: Id<"chats">): Promise<void> => {
        if (isLocalFirst) {
            // Toggle in local storage
            const chat = localStorageService.getChats().find(c => c._id === chatId);
            if (chat) {
                localStorageService.updateChat(chatId, { 
                    isStarred: !chat.isStarred,
                    updatedAt: Date.now()
                });
                loadLocalData();
            }
        } else {
            // Toggle on server
            await toggleServerChatStar({ chatId });
        }
    }, [isLocalFirst, toggleServerChatStar, loadLocalData]);

    // ==================== MESSAGE OPERATIONS ====================

    const sendMessage = useCallback(async (
        chatId: Id<"chats">,
        content: string,
        role: "user" | "assistant",
        model?: string,
        attachments?: any[],
        metadata?: any
    ): Promise<Id<"messages">> => {
        if (isLocalFirst) {
            // Create in local storage
            const messageId = generateId() as Id<"messages">;
            const newMessage: LocalMessage = {
                _id: messageId,
                chatId,
                role,
                content,
                timestamp: Date.now(),
                model,
                attachments,
                metadata,
            };
            localStorageService.addMessage(newMessage);
            
            // Update chat's updatedAt timestamp
            localStorageService.updateChat(chatId, { updatedAt: Date.now() });
            
            loadLocalData();
            return messageId;
        } else {
            // Send to server
            return await sendServerMessage({
                chatId,
                content,
                role,
                model,
                attachments,
                metadata,
            });
        }
    }, [isLocalFirst, sendServerMessage, loadLocalData]);

    const updateMessage = useCallback(async (messageId: Id<"messages">, content: string): Promise<void> => {
        if (isLocalFirst) {
            // Update in local storage
            localStorageService.updateMessage(messageId, { content });
            loadLocalData();
        } else {
            // Update on server
            await updateServerMessage({ messageId, content });
        }
    }, [isLocalFirst, updateServerMessage, loadLocalData]);

    const deleteMessage = useCallback(async (messageId: Id<"messages">): Promise<void> => {
        if (isLocalFirst) {
            // Delete from local storage
            localStorageService.deleteMessage(messageId);
            loadLocalData();
        } else {
            // Delete from server
            await deleteServerMessage({ messageId });
        }
    }, [isLocalFirst, deleteServerMessage, loadLocalData]);

    // ==================== PREFERENCES OPERATIONS ====================

    const updatePreferences = useCallback(async (updates: Partial<LocalPreferences>): Promise<void> => {
        if (isLocalFirst) {
            // Update in local storage
            localStorageService.updatePreferences(updates);
            setLocalPreferences(localStorageService.getPreferences());
        } else {
            // Update on server
            await updateServerPreferences(updates);
        }
    }, [isLocalFirst, updateServerPreferences]);

    // ==================== UTILITY FUNCTIONS ====================

    const getChatMessages = useCallback((chatId: Id<"chats">): LocalMessage[] => {
        if (isLocalFirst) {
            return localStorageService.getChatMessages(chatId);
        } else {
            return localMessages.filter(m => m.chatId === chatId);
        }
    }, [isLocalFirst, localMessages]);

    const getChat = useCallback((chatId: Id<"chats">): LocalChat | undefined => {
        return localChats.find(chat => chat._id === chatId);
    }, [localChats]);

    // Categorize chats
    const chats = {
        starred: localChats.filter(chat => chat.isStarred),
        regular: localChats.filter(chat => !chat.isStarred),
    };

    return {
        // Data
        chats,
        messages: localMessages,
        preferences: localPreferences,

        // Loading states
        isLoading,
        isLocalFirst,

        // Chat operations
        createChat,
        updateChatTitle,
        deleteChat,
        toggleChatStar,

        // Message operations
        sendMessage,
        updateMessage,
        deleteMessage,

        // Preferences operations
        updatePreferences,

        // Utility functions
        getChatMessages,
        getChat,
    };
}
