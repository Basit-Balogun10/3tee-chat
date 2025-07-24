"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

// Helper function to get user API keys using AI SDK compatible format
export async function getUserApiKeys(ctx: any): Promise<Record<string, string | undefined>> {
    try {
        const userId = await getAuthUserId(ctx);
        if (!userId) return {};

        const userPreferences = await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal,
            { userId }
        );
        
        return {
            openaiApiKey: userPreferences?.apiKeys?.openaiApiKey,
            anthropicApiKey: userPreferences?.apiKeys?.anthropicApiKey,
            googleApiKey: userPreferences?.apiKeys?.googleApiKey,
            deepseekApiKey: userPreferences?.apiKeys?.deepseekApiKey,
            openrouterApiKey: userPreferences?.apiKeys?.openrouterApiKey,
            togetherApiKey: userPreferences?.apiKeys?.togetherApiKey,
        };
    } catch (error) {
        console.error("Failed to get user API keys:", error);
        return {};
    }
}

// Helper to determine MIME type for file attachments (AI SDK compatible)
export function getMimeType(fileName: string, attachmentType: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (attachmentType) {
        case 'image':
            switch (extension) {
                case 'jpg':
                case 'jpeg':
                    return 'image/jpeg';
                case 'png':
                    return 'image/png';
                case 'gif':
                    return 'image/gif';
                case 'webp':
                    return 'image/webp';
                default:
                    return 'image/jpeg';
            }
        case 'pdf':
            return 'application/pdf';
        case 'file':
            switch (extension) {
                case 'txt':
                    return 'text/plain';
                case 'md':
                    return 'text/markdown';
                case 'js':
                    return 'text/javascript';
                case 'ts':
                    return 'text/typescript';
                case 'json':
                    return 'application/json';
                case 'csv':
                    return 'text/csv';
                case 'xml':
                    return 'application/xml';
                case 'html':
                    return 'text/html';
                case 'css':
                    return 'text/css';
                default:
                    return 'text/plain';
            }
        case 'audio':
            switch (extension) {
                case 'mp3':
                    return 'audio/mpeg';
                case 'wav':
                    return 'audio/wav';
                case 'ogg':
                    return 'audio/ogg';
                case 'm4a':
                    return 'audio/mp4';
                default:
                    return 'audio/mpeg';
            }
        case 'video':
            switch (extension) {
                case 'mp4':
                    return 'video/mp4';
                case 'webm':
                    return 'video/webm';
                case 'ogg':
                    return 'video/ogg';
                case 'avi':
                    return 'video/x-msvideo';
                default:
                    return 'video/mp4';
            }
        default:
            return 'application/octet-stream';
    }
}

// Helper to convert attachments to AI SDK multimodal format
export async function processAttachmentForAISDK(
    attachment: any,
    ctx: any
): Promise<{ type: 'image' | 'file'; content: any }> {
    // FIXED: Handle both library-based and legacy attachments
    let fileBlob;
    let attachmentData;

    if (attachment.type === "attachment" && attachment.libraryId) {
        // NEW: Library-based attachment - get from attachmentLibrary
        const libraryItem = await ctx.db.get(attachment.libraryId);
        if (!libraryItem) {
            throw new Error(`Library attachment not found: ${attachment.libraryId}`);
        }
        
        fileBlob = await ctx.storage.get(libraryItem.storageId);
        attachmentData = {
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.mimeType || libraryItem.mimeType,
            type: libraryItem.type,
        };
    } else if (attachment.storageId) {
        // LEGACY: Direct storage attachment (backwards compatibility)
        fileBlob = await ctx.storage.get(attachment.storageId);
        attachmentData = {
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.mimeType,
            type: attachment.type,
        };
    } else {
        throw new Error(`Invalid attachment format: ${JSON.stringify(attachment)}`);
    }

    if (!fileBlob) {
        throw new Error(`File not found for attachment: ${attachmentData.name}`);
    }

    // Convert to format expected by AI SDK
    const arrayBuffer = await fileBlob.arrayBuffer();
    const mimeType = attachmentData.mimeType || getMimeType(attachmentData.name, attachmentData.type);

    if (attachmentData.type === "image" || mimeType.startsWith("image/")) {
        // Handle images
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        return {
            type: 'image',
            content: {
                image: dataUrl,
                mimeType,
            },
        };
    } else {
        // Handle other files (PDF, documents, etc.)
        let text = "";
        
        try {
            if (mimeType === "application/pdf") {
                // For PDFs, extract text content (simplified)
                text = `[PDF File: ${attachmentData.name}, Size: ${Math.round(attachmentData.size / 1024)}KB]`;
            } else if (mimeType.startsWith("text/") || 
                       mimeType === "application/json" ||
                       attachmentData.name.endsWith('.md') ||
                       attachmentData.name.endsWith('.txt')) {
                // For text files, decode content
                text = new TextDecoder().decode(arrayBuffer);
            } else {
                // For other file types, provide metadata
                text = `[File: ${attachmentData.name}, Type: ${mimeType}, Size: ${Math.round(attachmentData.size / 1024)}KB]`;
            }
        } catch (error) {
            text = `[File: ${attachmentData.name} - Unable to process content]`;
        }

        return {
            type: 'file',
            content: {
                name: attachmentData.name,
                mimeType,
                data: text,
            },
        };
    }
}

// Helper to format messages for AI SDK with attachments
export function formatMessagesForAISDK(
    messages: any[],
    processedAttachments: any[] = []
): any[] {
    const formattedMessages = messages.map(message => {
        if (typeof message.content === 'string') {
            return {
                role: message.role,
                content: message.content
            };
        }
        return message;
    });

    // Add attachments to the last user message if any
    if (processedAttachments.length > 0 && formattedMessages.length > 0) {
        const lastUserMessageIndex = formattedMessages.map((m, i) => ({ ...m, index: i }))
            .filter(m => m.role === 'user')
            .pop()?.index;

        if (lastUserMessageIndex !== undefined) {
            const lastMessage = formattedMessages[lastUserMessageIndex];
            const imageAttachments = processedAttachments.filter(a => a.type === 'image');
            
            if (imageAttachments.length > 0) {
                // Create multimodal content with text and images
                formattedMessages[lastUserMessageIndex] = {
                    ...lastMessage,
                    content: [
                        { type: 'text', text: lastMessage.content },
                        ...imageAttachments.map(img => ({
                            type: 'image',
                            image: img.content,
                        }))
                    ]
                };
            }
        }
    }

    return formattedMessages;
}

// Helper to validate AI SDK model compatibility
export function validateModelForProvider(provider: string, model: string): boolean {
    const providerModels = {
        openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        google: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
        openrouter: [], // OpenRouter supports many models
        together: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
    };

    if (provider === 'openrouter') return true; // OpenRouter is flexible
    
    const supportedModels = providerModels[provider] || [];
    return supportedModels.some(supportedModel => 
        model.includes(supportedModel) || supportedModel.includes(model)
    );
}

// Helper to handle AI SDK errors gracefully
export function handleAISDKError(error: any): string {
    if (error?.name === 'AI_InvalidModelError') {
        return `The model is not supported or unavailable. Please try a different model.`;
    }
    
    if (error?.name === 'AI_APIKeyMissingError') {
        return `API key is missing or invalid. Please check your API key settings.`;
    }
    
    if (error?.name === 'AI_RateLimitError') {
        return `Rate limit exceeded. Please wait a moment and try again.`;
    }
    
    if (error?.name === 'AI_TokenLimitError') {
        return `The request is too long. Please try with a shorter conversation or message.`;
    }
    
    if (error?.message?.includes('quota')) {
        return `API quota exceeded. Please check your account limits or try a different model.`;
    }
    
    if (error?.message?.includes('authentication')) {
        return `Authentication failed. Please check your API key settings.`;
    }
    
    if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        return `Network error occurred. Please check your connection and try again.`;
    }
    
    // Generic error fallback
    return error?.message || 'An unexpected error occurred while generating the response.';
}