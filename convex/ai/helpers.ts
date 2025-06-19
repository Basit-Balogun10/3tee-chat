"use node";

import { internal } from "../_generated/api";

// Helper function to get user preferences and API keys
export async function getUserApiKeys(ctx: any): Promise<any> {
    try {
        const preferences = await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal
        );
        return preferences?.apiKeys || {};
    } catch (error) {
        console.error("Failed to get user API keys:", error);
        return {};
    }
}

// Helper function to determine MIME type
export function getMimeType(fileName: string, attachmentType: string): string {
    const extension = fileName.toLowerCase().split(".").pop();

    switch (attachmentType) {
        case "image":
            if (extension === "png") return "image/png";
            if (extension === "jpg" || extension === "jpeg")
                return "image/jpeg";
            if (extension === "gif") return "image/gif";
            if (extension === "webp") return "image/webp";
            return "image/jpeg"; // default
        case "pdf":
            return "application/pdf";
        case "file":
            if (extension === "txt") return "text/plain";
            if (extension === "md") return "text/markdown";
            if (extension === "json") return "application/json";
            if (extension === "csv") return "text/csv";
            if (extension === "doc") return "application/msword";
            if (extension === "docx")
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            return "application/octet-stream"; // default
        default:
            return "application/octet-stream";
    }
}