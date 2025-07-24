"use node";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// Provider-specific web search using AI SDK
export async function performProviderWebSearch(
    query: string,
    provider: string,
    client: any, // Not used with AI SDK, kept for compatibility
    userApiKeys: Record<string, string | undefined>
): Promise<{ response: string; citations: any[] }> {
    console.log(`🔍 PERFORMING WEB SEARCH WITH AI SDK:`, {
        query: query.substring(0, 100),
        provider,
        timestamp: new Date().toISOString(),
    });

    try {
        // Use Google Gemini with search capabilities for web search
        const searchProvider = google({
            apiKey: userApiKeys.googleApiKey || process.env.GOOGLE_AI_API_KEY,
        });

        const model = searchProvider("gemini-2.0-flash-exp");

        // Perform web search using Gemini's grounding capabilities
        const result = await generateText({
            model,
            messages: [
                {
                    role: "user",
                    content: `Search the web and provide a comprehensive response to: ${query}

Please include relevant citations and sources in your response.`,
                },
            ],
            tools: {
                search: {
                    description: "Search the web for current information",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query",
                            },
                        },
                        required: ["query"],
                    },
                },
            },
            temperature: 0.3,
            maxTokens: 2000,
        });

        // Extract citations from the response (this would be enhanced with actual search results)
        const citations = extractCitationsFromResponse(result.text);

        console.log(`✅ WEB SEARCH COMPLETE:`, {
            responseLength: result.text.length,
            citationCount: citations.length,
            provider,
            timestamp: new Date().toISOString(),
        });

        return {
            response: result.text,
            citations: citations,
        };
    } catch (error) {
        console.error(`❌ WEB SEARCH FAILED:`, {
            query: query.substring(0, 100),
            provider,
            error: error.message,
            timestamp: new Date().toISOString(),
        });

        // Fallback to a regular AI response without web search
        try {
            const fallbackProvider = google({
                apiKey: userApiKeys.googleApiKey || process.env.GOOGLE_AI_API_KEY,
            });

            const fallbackModel = fallbackProvider("gemini-1.5-flash");

            const fallbackResult = await generateText({
                model: fallbackModel,
                messages: [
                    {
                        role: "user",
                        content: `Please provide a helpful response to: ${query}

Note: I cannot access current web information, so my response is based on my training data.`,
                    },
                ],
                temperature: 0.7,
                maxTokens: 1500,
            });

            return {
                response:
                    fallbackResult.text +
                    "\n\n*Note: This response is based on training data and may not include the most recent information.*",
                citations: [],
            };
        } catch (fallbackError) {
            console.error(`❌ FALLBACK SEARCH ALSO FAILED:`, fallbackError);

            return {
                response:
                    "I apologize, but I'm unable to perform a web search at the moment. Please try again later or rephrase your question.",
                citations: [],
            };
        }
    }
}

// Helper function to extract citations from AI response
function extractCitationsFromResponse(response: string): any[] {
    const citations: any[] = [];

    // Look for common citation patterns in AI responses
    const citationPatterns = [
        /\[(\d+)\]\s*([^[\n]+)/g, // [1] Title or description
        /Source:\s*([^\n]+)/gi, // Source: URL or title
        /https?:\/\/[^\s\n]+/g, // Direct URLs
    ];

    let citationNumber = 1;

    citationPatterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(response)) !== null) {
            if (pattern.source.includes("http")) {
                // Direct URL
                citations.push({
                    number: citationNumber++,
                    url: match[0],
                    title: extractTitleFromURL(match[0]),
                    citedText: `Information from ${match[0]}`,
                });
            } else if (pattern.source.includes("Source")) {
                // Source pattern
                citations.push({
                    number: citationNumber++,
                    url: match[1],
                    title: match[1],
                    citedText: `Source: ${match[1]}`,
                });
            } else {
                // Numbered citation
                citations.push({
                    number: parseInt(match[1]) || citationNumber++,
                    title: match[2]?.trim() || "Web Source",
                    citedText: match[2]?.trim() || "",
                    url: extractURLFromText(match[2]) || "#",
                });
            }
        }
    });

    // Remove duplicates based on URL or title
    const uniqueCitations = citations.filter(
        (citation, index, self) =>
            index ===
            self.findIndex((c) => c.url === citation.url || c.title === citation.title)
    );

    return uniqueCitations.slice(0, 10); // Limit to 10 citations
}

// Helper to extract title from URL
function extractTitleFromURL(url: string): string {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace("www.", "");
        const path = urlObj.pathname.split("/").filter((p) => p).pop() || "";

        // Convert path to readable title
        const title = path
            .replace(/[-_]/g, " ")
            .replace(/\.(html|php|aspx?)$/i, "")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        return title || domain;
    } catch {
        return url;
    }
}

// Helper to extract URL from text
function extractURLFromText(text: string): string | null {
    const urlMatch = text.match(/https?:\/\/[^\s\n]+/);
    return urlMatch ? urlMatch[0] : null;
}

// Enhanced web search with specific provider support (future expansion)
export async function performEnhancedWebSearch(
    query: string,
    provider: string,
    options: {
        userApiKeys: Record<string, string | undefined>;
        maxResults?: number;
        includeImages?: boolean;
        timeframe?: "day" | "week" | "month" | "year" | "all";
        region?: string;
    }
): Promise<{
    response: string;
    citations: any[];
    images?: string[];
    relatedQueries?: string[];
}> {
    console.log(`🔍 ENHANCED WEB SEARCH:`, {
        query: query.substring(0, 100),
        provider,
        maxResults: options.maxResults || 10,
        includeImages: options.includeImages || false,
        timestamp: new Date().toISOString(),
    });

    // For now, use the basic search and enhance the response
    const basicResult = await performProviderWebSearch(
        query,
        provider,
        null,
        options.userApiKeys
    );

    // Enhance with additional metadata
    const relatedQueries = generateRelatedQueries(query);

    return {
        ...basicResult,
        relatedQueries,
        images: options.includeImages ? [] : undefined, // Placeholder for future image search
    };
}

// Helper to generate related queries
function generateRelatedQueries(originalQuery: string): string[] {
    const words = originalQuery.toLowerCase().split(" ");
    const relatedQueries: string[] = [];

    // Generate some basic related queries
    if (words.length > 1) {
        relatedQueries.push(`${originalQuery} tutorial`);
        relatedQueries.push(`${originalQuery} examples`);
        relatedQueries.push(`${originalQuery} best practices`);
        relatedQueries.push(`how to ${originalQuery}`);
        relatedQueries.push(`${originalQuery} 2024`);
    }

    return relatedQueries.slice(0, 5);
}

// Provider-specific search implementations (future expansion)
export const searchProviders = {
    google: performProviderWebSearch,
    bing: performProviderWebSearch, // Placeholder
    duckduckgo: performProviderWebSearch, // Placeholder
} as const;
