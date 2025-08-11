"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

// Helper function to get user API keys using AI SDK compatible format
export async function getUserApiKeys(
    ctx: any
): Promise<Record<string, string | undefined>> {
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
    const extension = fileName.toLowerCase().split(".").pop();

    switch (attachmentType) {
        case "image":
            switch (extension) {
                case "jpg":
                case "jpeg":
                    return "image/jpeg";
                case "png":
                    return "image/png";
                case "gif":
                    return "image/gif";
                case "webp":
                    return "image/webp";
                default:
                    return "image/jpeg";
            }
        case "pdf":
            return "application/pdf";
        case "file":
            switch (extension) {
                case "txt":
                    return "text/plain";
                case "md":
                    return "text/markdown";
                case "js":
                    return "text/javascript";
                case "ts":
                    return "text/typescript";
                case "json":
                    return "application/json";
                case "csv":
                    return "text/csv";
                case "xml":
                    return "application/xml";
                case "html":
                    return "text/html";
                case "css":
                    return "text/css";
                default:
                    return "text/plain";
            }
        case "audio":
            switch (extension) {
                case "mp3":
                    return "audio/mpeg";
                case "wav":
                    return "audio/wav";
                case "ogg":
                    return "audio/ogg";
                case "m4a":
                    return "audio/mp4";
                default:
                    return "audio/mpeg";
            }
        case "video":
            switch (extension) {
                case "mp4":
                    return "video/mp4";
                case "webm":
                    return "video/webm";
                case "ogg":
                    return "video/ogg";
                case "avi":
                    return "video/x-msvideo";
                default:
                    return "video/mp4";
            }
        default:
            return "application/octet-stream";
    }
}

// Helper to convert attachments to AI SDK multimodal format
export async function processAttachmentForAISDK(
    attachment: any,
    ctx: any
): Promise<{ type: "image" | "file"; content: any }> {
    // FIXED: Handle library-based and direct attachments
    let fileBlob;
    let attachmentData;

    if (attachment.type === "attachment" && attachment.libraryId) {
        // NEW: Library-based attachment - get from attachmentLibrary
        const libraryItem = await ctx.db.get(attachment.libraryId);
        if (!libraryItem) {
            throw new Error(
                `Library attachment not found: ${attachment.libraryId}`
            );
        }

        fileBlob = await ctx.storage.get(libraryItem.storageId);
        attachmentData = {
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.mimeType || libraryItem.mimeType,
            type: libraryItem.type,
        };
    } else if (attachment.storageId) {
        // Direct storage attachment
        fileBlob = await ctx.storage.get(attachment.storageId);
        attachmentData = {
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.mimeType,
            type: attachment.type,
        };
    } else {
        throw new Error(
            `Invalid attachment format: ${JSON.stringify(attachment)}`
        );
    }

    if (!fileBlob) {
        throw new Error(
            `File not found for attachment: ${attachmentData.name}`
        );
    }

    // Convert to format expected by AI SDK
    const arrayBuffer = await fileBlob.arrayBuffer();
    const mimeType =
        attachmentData.mimeType ||
        getMimeType(attachmentData.name, attachmentData.type);

    if (attachmentData.type === "image" || mimeType.startsWith("image/")) {
        // Handle images
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64}`;

        return {
            type: "image",
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
            } else if (
                mimeType.startsWith("text/") ||
                mimeType === "application/json" ||
                attachmentData.name.endsWith(".md") ||
                attachmentData.name.endsWith(".txt")
            ) {
                // For text files, decode content
                text = new TextDecoder().decode(arrayBuffer);
            } else {
                // For other file types, provide metadata
                text = `[File: ${attachmentData.name}, Type: ${mimeType}, Size: ${Math.round(attachmentData.size / 1024)}KB]`;
            }
        } catch {
            text = `[File: ${attachmentData.name} - Unable to process content]`;
        }

        return {
            type: "file",
            content: {
                name: attachmentData.name,
                mimeType,
                data: text,
            },
        };
    }
}

// PHASE 2: Structured message formatting utilities
// -------------------------------------------------
// These utilities supersede `formatMessagesForAISDK` by producing a canonical
// structured parts representation aligned with the new `rawParts` schema fields.
// They will be gradually adopted across streaming, multi-AI, and structured output paths.

// Canonical structured part types
export type TextPartCanonical = { type: "text"; text: string };
export type ImagePartCanonical = { type: "image"; image: { url?: string; base64?: string; mimeType?: string; alt?: string } };
export type FilePartCanonical = { type: "file"; file: { name: string; mimeType?: string; data?: string; size?: number } };
export type ArtifactRefPartCanonical = { type: "artifact-ref"; artifactId: string; filename?: string };
export type ReferencePartCanonical = { type: "reference"; refType: string; id: string; name?: string; meta?: any };
export type ModelVariantPartCanonical = { type: "model-variant"; model: string; primary?: boolean };

export type CanonicalPart =
    | TextPartCanonical
    | ImagePartCanonical
    | FilePartCanonical
    | ArtifactRefPartCanonical
    | ReferencePartCanonical
    | ModelVariantPartCanonical;

export interface StoredMessageDocLike {
    _id: string;
    role: "user" | "assistant" | "system";
    content: string;
    rawParts?: CanonicalPart[];
    renderedText?: string;
    metadata?: any;
    model?: string;
    timestamp?: number;
}

export interface BuildModelMessagesOptions {
    includeSystem?: boolean; // include system messages (default true)
    mergeConsecutiveText?: boolean; // collapse adjacent text parts
    attachArtifactsAsRefs?: boolean; // map metadata.artifacts to artifact-ref parts
    userAttachmentParts?: CanonicalPart[]; // preprocessed attachment parts to append to last user message
}

export interface UIMessageShape {
    id: string;
    role: "user" | "assistant" | "system";
    content: string; // flattened for simple rendering / search
    parts: CanonicalPart[]; // structured parts
    model?: string;
    timestamp?: number;
    metadata?: any;
}

// Normalize existing message (string `content` or new `rawParts`) into parts
export function normalizeMessageToParts(msg: StoredMessageDocLike): CanonicalPart[] {
    if (msg.rawParts && Array.isArray(msg.rawParts) && msg.rawParts.length > 0) {
        return msg.rawParts;
    }
    // Fallback: single text part from string content
    return [{ type: "text", text: msg.content }];
}

// Merge consecutive text parts for cleanliness
function mergeConsecutiveTextParts(parts: CanonicalPart[]): CanonicalPart[] {
    const merged: CanonicalPart[] = [];
    for (const part of parts) {
        if (part.type === "text" && merged.length > 0) {
            const last = merged[merged.length - 1];
            if (last.type === "text") {
                merged[merged.length - 1] = { type: "text", text: last.text + part.text };
                continue;
            }
        }
        merged.push(part);
    }
    return merged;
}

// Build model-ready messages for AI SDK (array of {role, content})
export function buildModelMessages(
    messages: StoredMessageDocLike[],
    options: BuildModelMessagesOptions = {}
): any[] {
    const {
        includeSystem = true,
        mergeConsecutiveText = true,
        attachArtifactsAsRefs = true,
        userAttachmentParts = [],
    } = options;

    const modelMessages: any[] = [];

    for (const msg of messages) {
        if (!includeSystem && msg.role === "system") continue;
        let parts = normalizeMessageToParts(msg);

        // Optionally append artifact refs based on metadata
        if (
            attachArtifactsAsRefs &&
            msg.metadata?.artifacts &&
            Array.isArray(msg.metadata.artifacts)
        ) {
            const artifactParts: ArtifactRefPartCanonical[] = msg.metadata.artifacts.map(
                (artifactId: string) => ({ type: "artifact-ref", artifactId })
            );
            parts = [...parts, ...artifactParts];
        }

        if (mergeConsecutiveText) parts = mergeConsecutiveTextParts(parts);

        // Transform canonical parts into AI SDK part format
        const aiParts = parts.map((p) => {
            switch (p.type) {
                case "text":
                    return { type: "text", text: p.text };
                case "image":
                    return { type: "image", image: p.image.base64 || p.image.url, mimeType: p.image.mimeType };
                case "file":
                    return { type: "text", text: p.file.data ?? `[File: ${p.file.name}]` }; // fallback textual representation
                case "artifact-ref":
                    return { type: "text", text: `[Artifact ${p.artifactId}]` };
                case "reference":
                    return { type: "text", text: `[Ref ${p.refType}:${p.id}${p.name ? ` ${p.name}` : ""}]` };
                case "model-variant":
                    return { type: "text", text: `[Model Variant: ${p.model}${p.primary ? " (primary)" : ""}]` };
                default:
                    return { type: "text", text: "" };
            }
        });

        // Collapsing to string if only single text part
        if (aiParts.length === 1 && aiParts[0].type === "text") {
            modelMessages.push({ role: msg.role, content: aiParts[0].text });
        } else {
            modelMessages.push({ role: msg.role, content: aiParts });
        }
    }

    // Attach any prepared attachment parts to the last user message
    if (userAttachmentParts.length > 0) {
        for (let i = modelMessages.length - 1; i >= 0; i--) {
            if (modelMessages[i].role === "user") {
                const current = modelMessages[i];
                const baseParts: any[] = Array.isArray(current.content)
                    ? current.content
                    : [{ type: "text", text: current.content }];
                const attachmentTextParts = userAttachmentParts.map((p) => {
                    if (p.type === "image") {
                        return { type: "image", image: p.image.base64 || p.image.url, mimeType: p.image.mimeType };
                    }
                    if (p.type === "file") {
                        return { type: "text", text: p.file.data ?? `[File: ${p.file.name}]` };
                    }
                    if (p.type === "artifact-ref") {
                        return { type: "text", text: `[Artifact ${p.artifactId}]` };
                    }
                    if (p.type === "reference") {
                        return { type: "text", text: `[Ref ${p.refType}:${p.id}]` };
                    }
                    if (p.type === "text") return { type: "text", text: p.text };
                    return { type: "text", text: "" };
                });
                modelMessages[i] = {
                    role: current.role,
                    content: [...baseParts, ...attachmentTextParts],
                };
                break;
            }
        }
    }

    return modelMessages;
}

// Convert stored docs into UI messages (flatten parts + keep structure)
export function convertStoredMessagesToUI(
    messages: StoredMessageDocLike[],
    opts: { mergeConsecutiveText?: boolean } = {}
): UIMessageShape[] {
    const { mergeConsecutiveText = true } = opts;
    return messages.map((m) => {
        let parts = normalizeMessageToParts(m);
        if (mergeConsecutiveText) parts = mergeConsecutiveTextParts(parts);
        const flattened = parts
            .filter((p) => p.type === "text")
            .map((p: any) => p.text)
            .join("");
        return {
            id: m._id,
            role: m.role,
            content: m.renderedText || flattened || m.content,
            parts,
            model: m.model,
            timestamp: m.timestamp,
            metadata: m.metadata,
        };
    });
}

// Utility to create attachment parts from processed attachment objects
export function attachmentObjectsToCanonicalParts(processed: any[]): CanonicalPart[] {
    return processed.map((item) => {
        if (item.type === "image") {
            return {
                type: "image",
                image: {
                    base64: item.content?.image?.startsWith("data:") ? item.content.image : undefined,
                    url: item.content?.image?.startsWith("data:") ? undefined : item.content?.image,
                    mimeType: item.content?.mimeType,
                },
            } as ImagePartCanonical;
        }
        if (item.type === "file") {
            return {
                type: "file",
                file: {
                    name: item.content?.name || "attachment",
                    mimeType: item.content?.mimeType,
                    data: item.content?.data,
                },
            } as FilePartCanonical;
        }
        return { type: "text", text: "" } as TextPartCanonical; // fallback
    });
}

// Helper to format messages for AI SDK with attachments
export function validateModelForProvider(
    provider: string,
    model: string
): boolean {
    const providerModels: Record<string, string[]> = {
        openai: [
            "gpt-4o",
            "gpt-4o-mini",
            "o1",
            "o1-mini",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
        ],
        anthropic: [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
        ],
        google: [
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-1.0-pro",
        ],
        deepseek: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
        openrouter: [], // OpenRouter supports many models
        together: [
            "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        ],
    };

    if (provider === "openrouter") return true; // OpenRouter is flexible

    const supportedModels = providerModels[provider] || [];
    return supportedModels.some(
        (supportedModel: string) =>
            model.includes(supportedModel) || supportedModel.includes(model)
    );
}

// Helper to handle AI SDK errors gracefully
export function handleAISDKError(error: any): string {
    if (error?.name === "AI_InvalidModelError") {
        return `The model is not supported or unavailable. Please try a different model.`;
    }

    if (error?.name === "AI_APIKeyMissingError") {
        return `API key is missing or invalid. Please check your API key settings.`;
    }

    if (error?.name === "AI_RateLimitError") {
        return `Rate limit exceeded. Please wait a moment and try again.`;
    }

    if (error?.name === "AI_TokenLimitError") {
        return `The request is too long. Please try with a shorter conversation or message.`;
    }

    if (error?.message?.includes("quota")) {
        return `API quota exceeded. Please check your account limits or try a different model.`;
    }

    if (error?.message?.includes("authentication")) {
        return `Authentication failed. Please check your API key settings.`;
    }

    if (
        error?.message?.includes("network") ||
        error?.message?.includes("fetch")
    ) {
        return `Network error occurred. Please check your connection and try again.`;
    }

    // Generic error fallback
    return (
        error?.message ||
        "An unexpected error occurred while generating the response."
    );
}

// Helper to get attachment from library
export async function getAttachmentLibraryItem(
    ctx: any,
    attachmentId: string
): Promise<any> {
    try {
        return await ctx.runQuery("library:getAttachmentLibraryItem", {
            attachmentId,
        });
    } catch (error) {
        console.error(
            `Failed to get attachment library item ${attachmentId}:`,
            error
        );
        return null;
    }
}

// Helper to get media from library
export async function getMediaLibraryItem(
    ctx: any,
    mediaId: string
): Promise<any> {
    try {
        return await ctx.runQuery("library:getMediaLibraryItem", {
            mediaId,
        });
    } catch (error) {
        console.error(`Failed to get media library item ${mediaId}:`, error);
        return null;
    }
}

// Helper to get artifact by ID
export async function getArtifactItem(
    ctx: any,
    artifactId: string
): Promise<any> {
    try {
        return await ctx.runQuery(internal.artifacts.getArtifactInternal, {
            artifactId,
        });
    } catch (error) {
        console.error(`Failed to get artifact ${artifactId}:`, error);
        return null;
    }
}

// UNIFIED: Helper to process library items for AI SDK
export async function processLibraryItemForAISDK(
    libraryItem: {
        type: "attachment" | "artifact" | "media";
        id: string;
        name: string;
        size?: number;
        mimeType?: string;
    },
    ctx: any
): Promise<{ type: "image" | "file"; content: any }> {
    if (libraryItem.type === "artifact") {
        // Handle artifacts
        const artifact = await getArtifactItem(ctx, libraryItem.id);

        if (!artifact) {
            throw new Error(`Artifact not found: ${libraryItem.id}`);
        }

        return {
            type: "file",
            content: {
                name: artifact.filename,
                mimeType: "text/plain",
                data: artifact.content,
            },
        };
    } else if (libraryItem.type === "attachment") {
        // Handle attachment library items
        const attachmentData = await getAttachmentLibraryItem(
            ctx,
            libraryItem.id
        );
        if (!attachmentData) {
            throw new Error(`Attachment not found: ${libraryItem.id}`);
        }

        return await processAttachmentForAISDK(
            {
                type: attachmentData.type,
                storageId: attachmentData.storageId,
                name: attachmentData.originalName || attachmentData.displayName,
                size: attachmentData.size,
                mimeType: attachmentData.mimeType,
            },
            ctx
        );
    } else if (libraryItem.type === "media") {
        // Handle media library items
        const mediaData = await getMediaLibraryItem(ctx, libraryItem.id);
        if (!mediaData || !mediaData.storageId) {
            throw new Error(`Media not found or no storage: ${libraryItem.id}`);
        }

        return await processAttachmentForAISDK(
            {
                type:
                    mediaData.type === "image"
                        ? "image"
                        : mediaData.type === "video"
                          ? "video"
                          : "file",
                storageId: mediaData.storageId,
                name: mediaData.title,
                size: 0, // Media items might not track size
                mimeType:
                    mediaData.type === "image"
                        ? "image/jpeg"
                        : mediaData.type === "video"
                          ? "video/mp4"
                          : "application/octet-stream",
            },
            ctx
        );
    } else {
        // This should never happen due to TypeScript unions, but just in case
        throw new Error(`Unsupported library item type`);
    }
}
