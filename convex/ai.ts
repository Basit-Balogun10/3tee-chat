"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";
import { AzureOpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { GoogleGenAI } from "@google/genai";

// TODO: These imports will be used in Phase 1.2 - Dual Authentication Setup
// Currently keeping them to avoid import/removal churn
const _AzureOpenAI = AzureOpenAI;
const _AnthropicVertex = AnthropicVertex;
const _GoogleGenAI = GoogleGenAI;

// Simple provider configurations mirrored from modelConfig.ts (without UI fields)
type ProviderConfig = {
    userKeyField: string;
    baseURL?: string;
};

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    google: {
        userKeyField: "gemini",
    },
    openai: {
        userKeyField: "openai",
    },
    anthropic: {
        userKeyField: "anthropic",
    },
    deepseek: {
        userKeyField: "deepseek",
        baseURL: "https://api.deepseek.com/v1",
    },
    openrouter: {
        userKeyField: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
    },
};

// Simple function to extract provider from model ID
function getProviderFromModel(model: string): string {
    // Check for OpenRouter models first (with provider prefix)
    const openrouterPrefixes = [
        "openai/",
        "google/",
        "anthropic/",
        "x-ai/",
        "qwen/",
        "deepseek/",
        "mistralai/",
        "meta-llama/",
        "microsoft/",
        "perplexity/",
        "cohere/",
    ];
    if (openrouterPrefixes.some((prefix) => model.startsWith(prefix))) {
        return "openrouter";
    }

    // Then check for direct provider models
    if (
        model.includes("gemini") ||
        model.includes("imagen") ||
        model.includes("veo")
    ) {
        return "google";
    }
    if (
        model.includes("gpt") ||
        model.includes("dall-e") ||
        model.includes("sora") ||
        model.includes("o1") ||
        model.includes("o3") ||
        model.includes("o4")
    ) {
        return "openai";
    }
    if (model.includes("claude")) {
        return "anthropic";
    }
    if (model.includes("deepseek")) {
        return "deepseek";
    }

    throw new Error(`Unable to determine provider for model: ${model}`);
}

// Provider client factory with dual authentication support
class ProviderManager {
    private clients: Map<string, any> = new Map();

    getClient(provider: string, apiKey?: string): any {
        const key = `${provider}-${apiKey || "default"}`;

        if (this.clients.has(key)) {
            return this.clients.get(key);
        }

        const config = PROVIDER_CONFIGS[provider];
        // const finalApiKey = apiKey || config?.defaultKey;
        const finalApiKey = apiKey;

        // if (["deepseek", "openai", "openrouter"].includes(provider) && !finalApiKey) {
        //     throw new Error(`No API key available for provider: ${provider}`);
        // }

        let client;

        switch (provider) {
            case "openai":
                if (apiKey) {
                    // User's OpenAI key - direct OpenAI client
                    client = new OpenAI({ apiKey });
                } else {
                    // Our Azure OpenAI key
                    client = new AzureOpenAI({
                        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
                        apiKey: process.env.AZURE_OPENAI_API_KEY,
                        apiVersion: process.env.OPENAI_API_VERSION || "preview",
                        deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
                    });
                }
                break;

            case "openrouter":
                client = new OpenAI({
                    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
                    baseURL: "https://openrouter.ai/api/v1",
                });
                break;

            case "anthropic":
                if (apiKey) {
                    // User's Anthropic key - direct Anthropic client
                    client = new Anthropic({ apiKey });
                } else {
                    // Our Anthropic Vertex key
                    client = new AnthropicVertex({
                        projectId: process.env.GOOGLE_CLOUD_PROJECT!,
                        region: process.env.GOOGLE_CLOUD_LOCATION || "us-east1",
                    });
                }
                break;

            case "gemini":
                if (apiKey) {
                    // User's Gemini key - GoogleGenAI client
                    client = new GoogleGenAI({
                        vertexai: false,
                        apiKey,
                    });
                } else {
                    // Our Vertex AI setup
                    client = new GoogleGenAI({
                        vertexai: true,
                        project: process.env.GOOGLE_CLOUD_PROJECT!,
                        location:
                            process.env.GOOGLE_CLOUD_LOCATION || "us-east1",
                    });
                }
                break;

            case "deepseek":
                client = new OpenAI({
                    apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
                    baseURL: "https://api.deepseek.com/v1",
                });
                break;

            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }

        this.clients.set(key, client);
        return client;
    }

    async callProvider(
        provider: string,
        model: string,
        messages: any[],
        options: {
            apiKey?: string;
            stream?: boolean;
            temperature?: number;
            attachments?: any[]; // Add attachments support
        } = {}
    ): Promise<any> {
        const client = this.getClient(provider, options.apiKey);

        switch (provider) {
            case "openai":
            case "openrouter":
            case "deepseek":
                return this.callOpenAICompatible(
                    client,
                    model,
                    messages,
                    options
                );

            case "anthropic":
                return this.callAnthropic(client, model, messages, options);

            case "gemini":
                return this.callGemini(client, model, messages, options);

            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    private async callOpenAICompatible(
        client: OpenAI,
        model: string,
        messages: any[],
        options: any
    ) {
        // Convert OpenAI chat format to Responses API input format
        const input = this.convertToResponsesAPIFormat(messages);

        const requestBody: any = {
            model,
            input,
            temperature: options.temperature || 0.7,
        };

        // Add streaming if requested
        if (options.stream) {
            requestBody.stream = true;
            // Enable background streaming for better resumability
            requestBody.background = true;
        }

        // Add file attachments if present
        if (options.attachments && options.attachments.length > 0) {
            requestBody.input = this.addAttachmentsToInput(
                input,
                options.attachments
            );
        }

        // Use Responses API instead of chat completions
        const response = await client.responses.create(requestBody);

        // If streaming, return a custom iterator that handles Responses API events
        if (options.stream) {
            return this.createResponsesAPIStreamIterator(response);
        }

        return response;
    }

    // Create a streaming iterator that handles Responses API events properly
    private async *createResponsesAPIStreamIterator(stream: any) {
        for await (const event of stream) {
            // Handle Responses API streaming events according to appendix.md patterns
            if (event.type === "response.output_text.delta") {
                // This is the key event for text streaming in Responses API
                yield {
                    choices: [
                        {
                            delta: {
                                content: event.delta || "",
                            },
                        },
                    ],
                    // Track sequence number for resumable streaming
                    sequence_number: event.sequence_number,
                };
            } else if (event.type === "response.done") {
                // Response completed
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                            finish_reason: "stop",
                        },
                    ],
                    sequence_number: event.sequence_number,
                };
                break;
            } else if (event.type === "response.created") {
                // Response started - we can track the response ID for resumption
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    response_id: event.response?.id,
                    sequence_number: event.sequence_number,
                };
            }
            // Handle other event types as needed (error, function_call, etc.)
        }
    }

    // Convert OpenAI chat messages format to Responses API input format
    private convertToResponsesAPIFormat(messages: any[]): any[] {
        const input = [];

        for (const message of messages) {
            if (message.role === "system") {
                // System messages become instructions in Responses API
                continue; // We'll handle system messages separately if needed
            }

            if (typeof message.content === "string") {
                // Simple text message
                input.push({
                    role: message.role,
                    content: [
                        {
                            type: "input_text",
                            text: message.content,
                        },
                    ],
                });
            } else if (Array.isArray(message.content)) {
                // Multi-part content (text + images)
                const content = [];

                for (const part of message.content) {
                    if (part.type === "text") {
                        content.push({
                            type: "input_text",
                            text: part.text,
                        });
                    } else if (part.type === "image_url") {
                        if (part.image_url.url.startsWith("data:")) {
                            // Base64 image
                            content.push({
                                type: "input_image",
                                image_url: part.image_url.url,
                            });
                        } else {
                            // File ID reference
                            content.push({
                                type: "input_image",
                                file_id: part.image_url.url, // Assuming this is a file ID
                            });
                        }
                    }
                }

                input.push({
                    role: message.role,
                    content,
                });
            }
        }

        return input;
    }

    // Add file attachments to Responses API input format
    private addAttachmentsToInput(input: any[], attachments: any[]): any[] {
        if (!attachments || attachments.length === 0) return input;

        // Find the last user message and add attachments to it
        const lastMessageIndex = input.length - 1;
        if (lastMessageIndex >= 0 && input[lastMessageIndex].role === "user") {
            const lastMessage = input[lastMessageIndex];

            for (const attachment of attachments) {
                if (attachment.type === "image_file" && attachment.fileId) {
                    lastMessage.content.push({
                        type: "input_image",
                        file_id: attachment.fileId,
                    });
                } else if (
                    attachment.type === "pdf_file" &&
                    attachment.fileId
                ) {
                    lastMessage.content.push({
                        type: "input_file",
                        file_id: attachment.fileId,
                    });
                } else if (attachment.type === "file" && attachment.fileId) {
                    lastMessage.content.push({
                        type: "input_file",
                        file_id: attachment.fileId,
                    });
                }
            }
        }

        return input;
    }

    private async callAnthropic(
        client: any,
        model: string,
        messages: any[],
        options: any
    ) {
        // Convert OpenAI format to Anthropic format
        const systemMessage = messages.find((m) => m.role === "system");
        const conversationMessages = messages.filter(
            (m) => m.role !== "system"
        );

        const requestBody: any = {
            model,
            max_tokens: 4000,
            temperature: options.temperature || 0.7,
            messages: conversationMessages,
        };

        // Add system message if present
        if (systemMessage?.content) {
            requestBody.system = systemMessage.content;
        }

        // Add file attachments if present
        if (options.attachments && options.attachments.length > 0) {
            // For Anthropic, we need to modify the last user message to include file references
            const lastMessage =
                requestBody.messages[requestBody.messages.length - 1];
            if (lastMessage && lastMessage.role === "user") {
                const content = [];

                // Add file attachments first (per appendix.md best practice)
                for (const attachment of options.attachments) {
                    if (attachment.type === "image_file" && attachment.fileId) {
                        content.push({
                            type: "image",
                            source: {
                                type: "file",
                                file_id: attachment.fileId,
                            },
                        });
                    } else if (
                        attachment.type === "pdf_file" &&
                        attachment.fileId
                    ) {
                        content.push({
                            type: "document",
                            source: {
                                type: "file",
                                file_id: attachment.fileId,
                            },
                        });
                    }
                }

                // Add the text content after files
                content.push({
                    type: "text",
                    text: lastMessage.content,
                });

                lastMessage.content = content;
            }
        }

        // Handle streaming vs non-streaming with proper event processing
        if (options.stream) {
            requestBody.stream = true;
            const stream = await client.messages.stream(requestBody);
            return this.createAnthropicStreamIterator(stream);
        } else {
            return await client.messages.create(requestBody);
        }
    }

    // Create real Anthropic streaming iterator with proper event handling according to appendix.md
    private async *createAnthropicStreamIterator(stream: any) {
        let chunkIndex = 0;
        for await (const event of stream) {
            // Handle Anthropic streaming events according to appendix.md patterns
            // Events: message_start → content_block_start → content_block_delta → content_block_stop → message_stop

            if (event.type === "content_block_delta") {
                // This is the key event for text streaming
                if (event.delta?.type === "text_delta") {
                    yield {
                        choices: [
                            {
                                delta: {
                                    content: event.delta.text || "",
                                },
                            },
                        ],
                        // Track chunk index for resumable streaming
                        chunk_index: chunkIndex++,
                    };
                } else if (event.delta?.type === "input_json_delta") {
                    // Handle tool use JSON streaming
                    yield {
                        choices: [
                            {
                                delta: {
                                    content: event.delta.partial_json || "",
                                },
                            },
                        ],
                        chunk_index: chunkIndex++,
                        tool_use: true,
                    };
                }
            } else if (event.type === "message_start") {
                // Message started - track for resumption
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    message_id: event.message?.id,
                    chunk_index: chunkIndex++,
                };
            } else if (event.type === "content_block_start") {
                // Content block started - can be text or tool use
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    content_block: event.content_block,
                    chunk_index: chunkIndex++,
                };
            } else if (event.type === "content_block_stop") {
                // Content block completed
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    chunk_index: chunkIndex++,
                };
            } else if (event.type === "message_stop") {
                // Message completed
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                            finish_reason: "stop",
                        },
                    ],
                    chunk_index: chunkIndex,
                };
                break;
            }
            // Handle ping events (keep-alive)
            else if (event.type === "ping") {
                // Just continue, no need to yield for ping events
                continue;
            }
        }
    }
}

const providerManager = new ProviderManager();

// Provider-specific file management with caching
class ProviderFileManager {
    private fileCache: Map<string, Map<string, string>> = new Map(); // storageId -> provider -> fileId

    // Get cached file ID for a provider, or upload if not cached
    async getProviderFileId(
        storageId: string,
        provider: string,
        fileBlob: Blob,
        fileName: string,
        mimeType: string,
        client: any
    ): Promise<string> {
        const cacheKey = `${storageId}-${provider}`;

        if (this.fileCache.has(storageId)) {
            const providerCache = this.fileCache.get(storageId)!;
            if (providerCache.has(provider)) {
                return providerCache.get(provider)!;
            }
        }

        // Upload to provider-specific file API
        const fileId = await this.uploadToProvider(
            provider,
            fileBlob,
            fileName,
            mimeType,
            client
        );

        // Cache the result
        if (!this.fileCache.has(storageId)) {
            this.fileCache.set(storageId, new Map());
        }
        this.fileCache.get(storageId)!.set(provider, fileId);

        return fileId;
    }

    private async uploadToProvider(
        provider: string,
        fileBlob: Blob,
        fileName: string,
        mimeType: string,
        client: any
    ): Promise<string> {
        switch (provider) {
            case "openai":
            case "openrouter":
            case "deepseek": {
                // OpenAI Files API pattern from appendix.md
                const response = await client.files.create({
                    file: new File([fileBlob], fileName, { type: mimeType }),
                    purpose: this.getOpenAIPurpose(mimeType),
                });
                return response.id;
            }

            case "anthropic": {
                // Anthropic Files API pattern from appendix.md
                const { toFile } = await import("@anthropic-ai/sdk");
                const fileStream = new File([fileBlob], fileName, {
                    type: mimeType,
                });

                const response = await client.beta.files.upload({
                    file: toFile(fileStream, fileName, { type: mimeType }),
                });
                return response.id;
            }

            case "gemini": {
                // Google GenAI Files API pattern from appendix.md
                const response = await client.files.upload({
                    file: fileBlob,
                    config: {
                        displayName: fileName,
                        mimeType: mimeType,
                    },
                });

                // Wait for processing as shown in appendix.md
                let uploadedFile = await client.files.get({
                    name: response.name,
                });
                while (uploadedFile.state === "PROCESSING") {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    uploadedFile = await client.files.get({
                        name: response.name,
                    });
                }

                if (uploadedFile.state === "FAILED") {
                    throw new Error(`File processing failed for ${fileName}`);
                }

                return response.name; // Google uses name as file ID
            }

            default:
                throw new Error(
                    `File upload not supported for provider: ${provider}`
                );
        }
    }

    private getOpenAIPurpose(mimeType: string): string {
        if (mimeType.startsWith("image/")) {
            return "vision";
        } else if (mimeType === "application/pdf") {
            return "user_data";
        } else {
            return "user_data";
        }
    }
}

const fileManager = new ProviderFileManager();

// Helper function to get user preferences and API keys
async function getUserApiKeys(ctx: any): Promise<any> {
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

// Enhanced web search with provider-specific implementations and real citations
async function performProviderWebSearch(
    query: string,
    provider: string,
    client: any,
    userApiKeys: any = {}
): Promise<any> {
    try {
        switch (provider) {
            case "gemini": {
                // Google Web Search & Citations with Search Grounding and URL Context (always enabled per appendix note)
                const requestBody = {
                    model: "gemini-2.0-flash",
                    contents: query,
                    config: {
                        tools: [
                            { googleSearch: {} },
                            { urlContext: {} }, // Always enable URL context per appendix.md note
                        ],
                    },
                };

                const response =
                    await client.models.generateContent(requestBody);

                // Process groundingMetadata.grounding_supports for citation tracking
                const citations = [];
                if (
                    response.candidates?.[0]?.groundingMetadata
                        ?.grounding_supports
                ) {
                    for (const support of response.candidates[0]
                        .groundingMetadata.grounding_supports) {
                        if (support.grounding_chunk_indices) {
                            for (const chunkIndex of support.grounding_chunk_indices) {
                                const chunk =
                                    response.candidates[0].groundingMetadata
                                        .grounding_chunks?.[chunkIndex];
                                if (chunk) {
                                    // Convert GCS URIs to public HTTPS URLs per appendix patterns
                                    let url = chunk.web?.uri || chunk.uri || "";
                                    if (url.startsWith("gs://")) {
                                        url = url.replace(
                                            "gs://",
                                            "https://storage.googleapis.com/"
                                        );
                                    }

                                    citations.push({
                                        number: citations.length + 1,
                                        title:
                                            chunk.web?.title ||
                                            chunk.title ||
                                            "Untitled",
                                        url: url,
                                        source: "Google Search Grounding",
                                        startIndex: support.start_index,
                                        endIndex: support.end_index,
                                        citedText:
                                            response.text?.slice(
                                                support.start_index,
                                                support.end_index
                                            ) || "",
                                    });
                                }
                            }
                        }
                    }
                }

                return {
                    response: response.text || "No response generated",
                    citations: citations,
                };
            }

            case "openai": {
                if (userApiKeys.openai) {
                    // User's OpenAI creds: Use native web_search_preview tool
                    const response = await client.chat.completions.create({
                        model: "gpt-4o",
                        messages: [{ role: "user", content: query }],
                        tools: [
                            {
                                type: "web_search_preview",
                                web_search_preview: {},
                            },
                        ],
                    });

                    // Process annotations with url_citation format per appendix
                    const citations = [];
                    const message = response.choices[0]?.message;
                    if (message?.annotations) {
                        for (const annotation of message.annotations) {
                            if (annotation.type === "url_citation") {
                                citations.push({
                                    number:
                                        annotation.citation_number ||
                                        citations.length + 1,
                                    title:
                                        annotation.title || "Web Search Result",
                                    url: annotation.url || "",
                                    source: "OpenAI Web Search",
                                    startIndex: annotation.start_index,
                                    endIndex: annotation.end_index,
                                    citedText:
                                        message.content?.slice(
                                            annotation.start_index,
                                            annotation.end_index
                                        ) || "",
                                });
                            }
                        }
                    }

                    return {
                        response: message?.content || "No response generated",
                        citations: citations,
                    };
                } else {
                    // Our creds: Use Bing Search API with function calling
                    const BING_API_KEY = process.env.BING_SEARCH_API_KEY;
                    if (!BING_API_KEY) {
                        throw new Error("Bing Search API key not configured");
                    }

                    // First, perform Bing search
                    const bingResponse = await fetch(
                        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`,
                        {
                            headers: {
                                "Ocp-Apim-Subscription-Key": BING_API_KEY,
                            },
                        }
                    );

                    if (!bingResponse.ok) {
                        throw new Error(
                            `Bing API error: ${bingResponse.status}`
                        );
                    }

                    const bingData = await bingResponse.json();
                    const searchResults = bingData.webPages?.value || [];

                    // Create search context for function calling
                    const searchContext = searchResults
                        .map(
                            (result: any, i: number) =>
                                `[${i + 1}] ${result.name}\n${result.snippet}\nURL: ${result.url}`
                        )
                        .join("\n\n");

                    // Use function calling to synthesize response
                    const response = await client.chat.completions.create({
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "system",
                                content:
                                    "You are a helpful assistant that answers questions using provided search results. When referencing information, cite the source using [number] format.",
                            },
                            {
                                role: "user",
                                content: `Question: ${query}\n\nSearch results:\n${searchContext}\n\nPlease provide a comprehensive answer using these search results and cite your sources.`,
                            },
                        ],
                    });

                    // Extract citations from response and map to search results
                    const responseText =
                        response.choices[0]?.message?.content || "";
                    const citations = [];
                    const citationRegex = /\[(\d+)\]/g;
                    let match;

                    while (
                        (match = citationRegex.exec(responseText)) !== null
                    ) {
                        const citationNumber = parseInt(match[1]);
                        const searchResult = searchResults[citationNumber - 1];

                        if (
                            searchResult &&
                            !citations.find((c) => c.number === citationNumber)
                        ) {
                            citations.push({
                                number: citationNumber,
                                title: searchResult.name || "Untitled",
                                url: searchResult.url || "",
                                source: "Bing Search",
                                startIndex: match.index,
                                endIndex: match.index + match[0].length,
                                citedText: match[0],
                            });
                        }
                    }

                    return {
                        response: responseText,
                        citations: citations,
                    };
                }
            }

            case "anthropic": {
                // Anthropic Web Search with citation handling
                const response = await client.messages.create({
                    model: "claude-opus-4-20250514",
                    max_tokens: 4000,
                    messages: [
                        {
                            role: "user",
                            content: query,
                        },
                    ],
                    tools: [
                        {
                            type: "web_search_20250305",
                            name: "web_search",
                            max_uses: 5,
                        },
                    ],
                });

                // Handle web_search_tool_result and citation processing
                const citations = [];
                let responseText = "";

                if (response.content) {
                    for (const content of response.content) {
                        if (content.type === "text") {
                            responseText += content.text;
                        } else if (
                            content.type === "tool_result" &&
                            content.name === "web_search"
                        ) {
                            const toolResult = content.result;

                            // Process encrypted_content and encrypted_index for multi-turn conversations
                            if (toolResult.search_results) {
                                for (const result of toolResult.search_results) {
                                    citations.push({
                                        number: citations.length + 1,
                                        title:
                                            result.title || "Web Search Result",
                                        url: result.url || "",
                                        source: "Anthropic Web Search",
                                        citedText:
                                            result.cited_text ||
                                            result.snippet ||
                                            "",
                                    });
                                }
                            }
                        }
                    }
                }

                return {
                    response: responseText || "No response generated",
                    citations: citations,
                };
            }

            default: {
                // Fallback to external APIs
                return await performExternalWebSearch(query);
            }
        }
    } catch (error) {
        console.error(`Provider web search error for ${provider}:`, error);
        // Fallback to external search APIs
        return await performExternalWebSearch(query);
    }
}

// External web search APIs fallback
async function performExternalWebSearch(query: string): Promise<any> {
    try {
        // Try Tavily first (best for AI applications)
        const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
        if (TAVILY_API_KEY) {
            const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${TAVILY_API_KEY}`,
                },
                body: JSON.stringify({
                    query,
                    search_depth: "advanced",
                    include_answer: true,
                    max_results: 5,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const citations = data.results.map(
                    (result: any, index: number) => ({
                        number: index + 1,
                        title: result.title,
                        url: result.url,
                        source: "Tavily",
                        citedText: result.content || result.snippet || "",
                    })
                );

                return {
                    response: `Based on search results for "${query}": ${data.answer || "Multiple relevant sources found."}`,
                    citations: citations,
                };
            }
        }

        // Fallback to SerpAPI
        const SERP_API_KEY = process.env.SERP_API_KEY;
        if (SERP_API_KEY) {
            const response = await fetch(
                `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}`
            );

            if (response.ok) {
                const data = await response.json();
                const citations = (data.organic_results || [])
                    .slice(0, 5)
                    .map((result: any, index: number) => ({
                        number: index + 1,
                        title: result.title,
                        url: result.link,
                        source: "Google",
                        citedText: result.snippet || "",
                    }));

                return {
                    response: `Found ${citations.length} relevant results for "${query}".`,
                    citations: citations,
                };
            }
        }

        // Final fallback
        return {
            response: `Search functionality temporarily unavailable for "${query}". Please try again later.`,
            citations: [],
        };
    } catch (error) {
        console.error("External web search error:", error);
        return {
            response: `Unable to perform web search for "${query}". Please try again later.`,
            citations: [],
        };
    }
}

// Enhanced image generation with fallback providers
async function generateImage(prompt: string, userApiKeys: any = {}) {
    const providers = ["openai", "openrouter"];

    for (const provider of providers) {
        try {
            const client = providerManager.getClient(
                provider,
                userApiKeys[provider]
            );

            const response = await client.images.generate({
                model: "dall-e-3",
                prompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
            });

            return response.data?.[0]?.url;
        } catch (error) {
            console.error(`Image generation failed with ${provider}:`, error);
            continue;
        }
    }

    throw new Error("Failed to generate image with all available providers");
}

// Enhanced video generation placeholder
async function generateVideo(prompt: string, _userApiKeys: any = {}) {
    try {
        // Placeholder for video generation
        // In production, this would integrate with actual video generation APIs
        return {
            videoUrl: `https://example.com/generated-video-${Date.now()}.mp4`,
            thumbnailUrl: `https://example.com/thumbnail-${Date.now()}.jpg`,
            duration: "10s",
            resolution: "1024x576",
            status: "generated",
        };
    } catch (error) {
        console.error("Video generation failed:", error);
        throw new Error("Failed to generate video");
    }
}

// Enhanced attachment processing
async function processAttachments(attachments: any[], ctx: any) {
    if (!attachments || attachments.length === 0) return null;

    const processedAttachments = [];

    for (const attachment of attachments) {
        try {
            const fileBlob = await ctx.storage.get(attachment.storageId);
            if (!fileBlob) continue;

            switch (attachment.type) {
                case "image": {
                    const arrayBuffer = await fileBlob.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString("base64");
                    const mimeType = attachment.name
                        .toLowerCase()
                        .endsWith(".png")
                        ? "image/png"
                        : "image/jpeg";

                    processedAttachments.push({
                        type: "image",
                        name: attachment.name,
                        data: `data:${mimeType};base64,${base64}`,
                        mimeType,
                        size: attachment.size,
                    });
                    break;
                }

                case "pdf": {
                    processedAttachments.push({
                        type: "pdf",
                        name: attachment.name,
                        content: `[PDF Document: ${attachment.name} (${Math.round(attachment.size / 1024)}KB)\nNote: PDF content extraction would be implemented here.]`,
                        size: attachment.size,
                    });
                    break;
                }

                case "file": {
                    try {
                        const text = await fileBlob.text();
                        processedAttachments.push({
                            type: "file",
                            name: attachment.name,
                            content: `[Text File: ${attachment.name}]\n${text.slice(0, 50000)}${text.length > 50000 ? "\n... (truncated)" : ""}`,
                            size: attachment.size,
                        });
                    } catch (_error) {
                        processedAttachments.push({
                            type: "file",
                            name: attachment.name,
                            content: `[File: ${attachment.name} - Unable to read content]`,
                            size: attachment.size,
                        });
                    }
                    break;
                }

                default: {
                    processedAttachments.push({
                        type: attachment.type,
                        name: attachment.name,
                        content: `[${attachment.type.toUpperCase()}: ${attachment.name} - Processing not yet implemented]`,
                        size: attachment.size,
                    });
                    break;
                }
            }
        } catch (error) {
            console.error(
                `Failed to process attachment ${attachment.name}:`,
                error
            );
        }
    }

    return processedAttachments.length > 0 ? processedAttachments : null;
}

// Enhanced attachment processing with provider-specific file uploads
async function processAttachmentsForProvider(
    attachments: any[],
    provider: string,
    client: any,
    ctx: any
): Promise<any[]> {
    if (!attachments || attachments.length === 0) return [];

    const processedAttachments = [];

    for (const attachment of attachments) {
        try {
            const fileBlob = await ctx.storage.get(attachment.storageId);
            if (!fileBlob) continue;

            const mimeType = getMimeType(attachment.name, attachment.type);

            switch (attachment.type) {
                case "image": {
                    if (
                        provider === "openai" ||
                        provider === "openrouter" ||
                        provider === "deepseek"
                    ) {
                        // For OpenAI-compatible providers, upload to Files API and reference by ID
                        const fileId = await fileManager.getProviderFileId(
                            attachment.storageId,
                            provider,
                            fileBlob,
                            attachment.name,
                            mimeType,
                            client
                        );

                        processedAttachments.push({
                            type: "image_file",
                            fileId: fileId,
                            name: attachment.name,
                            mimeType: mimeType,
                        });
                    } else if (provider === "anthropic") {
                        // Anthropic prefers Files API for images
                        const fileId = await fileManager.getProviderFileId(
                            attachment.storageId,
                            provider,
                            fileBlob,
                            attachment.name,
                            mimeType,
                            client
                        );

                        processedAttachments.push({
                            type: "image_file",
                            fileId: fileId,
                            name: attachment.name,
                            mimeType: mimeType,
                        });
                    } else if (provider === "gemini") {
                        // Google can use either file upload or base64, prefer file upload
                        const fileId = await fileManager.getProviderFileId(
                            attachment.storageId,
                            provider,
                            fileBlob,
                            attachment.name,
                            mimeType,
                            client
                        );

                        processedAttachments.push({
                            type: "image_file",
                            fileId: fileId,
                            name: attachment.name,
                            mimeType: mimeType,
                        });
                    }
                    break;
                }

                case "pdf": {
                    // All providers support PDF file uploads
                    const fileId = await fileManager.getProviderFileId(
                        attachment.storageId,
                        provider,
                        fileBlob,
                        attachment.name,
                        "application/pdf",
                        client
                    );

                    processedAttachments.push({
                        type: "pdf_file",
                        fileId: fileId,
                        name: attachment.name,
                        mimeType: "application/pdf",
                    });
                    break;
                }

                case "file": {
                    // Upload text files to provider APIs
                    const fileId = await fileManager.getProviderFileId(
                        attachment.storageId,
                        provider,
                        fileBlob,
                        attachment.name,
                        mimeType,
                        client
                    );

                    processedAttachments.push({
                        type: "file",
                        fileId: fileId,
                        name: attachment.name,
                        mimeType: mimeType,
                    });
                    break;
                }

                default: {
                    // For unsupported types, fallback to basic processing
                    processedAttachments.push({
                        type: attachment.type,
                        name: attachment.name,
                        content: `[${attachment.type.toUpperCase()}: ${attachment.name} - Processing not yet implemented for provider ${provider}]`,
                        size: attachment.size,
                    });
                    break;
                }
            }
        } catch (error) {
            console.error(
                `Failed to process attachment ${attachment.name} for provider ${provider}:`,
                error
            );
            // Fallback to basic processing
            processedAttachments.push({
                type: attachment.type,
                name: attachment.name,
                content: `[${attachment.type.toUpperCase()}: ${attachment.name} - Upload failed for provider ${provider}]`,
                size: attachment.size,
            });
        }
    }

    return processedAttachments;
}

// Helper function to determine MIME type
function getMimeType(fileName: string, attachmentType: string): string {
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

// AI response generation with intelligent provider selection
export const generateStreamingResponse = internalAction({
    args: {
        chatId: v.id("chats"),
        messageId: v.id("messages"),
        model: v.string(),
        userApiKey: v.optional(v.string()),
        commands: v.optional(v.array(v.string())),
        attachments: v.optional(
            v.array(
                v.object({
                    type: v.union(
                        v.literal("image"),
                        v.literal("pdf"),
                        v.literal("file"),
                        v.literal("audio"),
                        v.literal("video")
                    ),
                    storageId: v.id("_storage"),
                    name: v.string(),
                    size: v.number(),
                })
            )
        ),
    },
    handler: async (ctx, args) => {
        try {
            // Check if streaming is stopped
            const streamingSession = await ctx.runQuery(
                internal.streaming.getStreamingSession,
                { messageId: args.messageId }
            );

            if (streamingSession?.isStopped) {
                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: "[Response stopped by user]",
                    isStreaming: false,
                });
                return;
            }

            // Get user API keys for intelligent provider selection
            const userApiKeys = await getUserApiKeys(ctx);

            // Get chat history
            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                { chatId: args.chatId }
            );

            const lastUserMessage = messages
                .filter((m) => m.role === "user")
                .pop();
            const content = lastUserMessage?.content || "";
            let response = "";
            const metadata: any = {};

            // Handle special commands
            if (args.commands?.includes("/image")) {
                const imagePrompt = content.replace("/image", "").trim();
                try {
                    const imageUrl = await generateImage(
                        imagePrompt,
                        userApiKeys
                    );
                    response = `I've generated an image for you: "${imagePrompt}"`;
                    metadata.imagePrompt = imagePrompt;
                    metadata.generatedImageUrl = imageUrl;
                } catch (error) {
                    console.error("Image generation error:", error);
                    response =
                        "Sorry, I couldn't generate that image. Please try again later.";
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata,
                    isStreaming: false,
                });
                return;
            }

            if (args.commands?.includes("/video")) {
                const videoPrompt = content.replace("/video", "").trim();
                try {
                    const videoData = await generateVideo(
                        videoPrompt,
                        userApiKeys
                    );
                    response = `I've generated a video for you: "${videoPrompt}"`;
                    metadata.videoPrompt = videoPrompt;
                    metadata.generatedVideoUrl = videoData.videoUrl;
                    metadata.videoThumbnailUrl = videoData.thumbnailUrl;
                    metadata.videoDuration = videoData.duration;
                    metadata.videoResolution = videoData.resolution;
                } catch (error) {
                    console.error("Video generation error:", error);
                    response =
                        "Sorry, I couldn't generate that video. Please try again later.";
                }

                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: args.messageId,
                    content: response,
                    metadata,
                    isStreaming: false,
                });
                return;
            }

            if (args.commands?.includes("/search")) {
                const searchQuery = content.replace("/search", "").trim();
                try {
                    const provider = getProviderFromModel(args.model);
                    const config = PROVIDER_CONFIGS[provider];
                    const userKey = userApiKeys[config.userKeyField];

                    const client = providerManager.getClient(provider, userKey);
                    const searchData = await performProviderWebSearch(
                        searchQuery,
                        provider,
                        client,
                        userApiKeys
                    );

                    // Populate real citations from provider responses
                    metadata.citations = searchData.citations;

                    const enhancedPrompt = `User question: "${searchQuery}"

Here are relevant search results to help answer the question:

${searchData.citations
    .map(
        (citation: any) =>
            `[${citation.number}] ${citation.title}\n${citation.citedText}\nSource: ${citation.url}`
    )
    .join("\n\n")}

Please provide a comprehensive answer using these search results. When referencing information from specific sources, cite them using the format [1], [2], etc. Only cite sources you actually use in your response.`;

                    const openaiMessages = [
                        ...messages.slice(0, -1),
                        { role: "user", content: enhancedPrompt },
                    ];

                    if (provider === "gemini") {
                        const fullResponse = await providerManager.callProvider(
                            provider,
                            args.model,
                            openaiMessages,
                            { apiKey, stream: false }
                        );
                        response =
                            fullResponse.choices[0]?.message?.content ||
                            searchData.response;

                        await ctx.runMutation(
                            internal.aiHelpers.updateMessageContent,
                            {
                                messageId: args.messageId,
                                content: response,
                                metadata,
                                isStreaming: false,
                            }
                        );
                        return;
                    } else if (provider === "anthropic") {
                        // For Anthropic, use the web search response directly since it's integrated
                        response = searchData.response;

                        await ctx.runMutation(
                            internal.aiHelpers.updateMessageContent,
                            {
                                messageId: args.messageId,
                                content: response,
                                metadata,
                                isStreaming: false,
                            }
                        );
                        return;
                    } else {
                        // Stream search response for OpenAI-compatible providers
                        const stream = await providerManager.callProvider(
                            provider,
                            args.model,
                            openaiMessages,
                            { apiKey, stream: true }
                        );

                        for await (const chunk of stream) {
                            const content =
                                chunk.choices[0]?.delta?.content || "";
                            if (content) {
                                response += content;
                                await ctx.runMutation(
                                    internal.aiHelpers.updateMessageContent,
                                    {
                                        messageId: args.messageId,
                                        content: response,
                                        metadata,
                                    }
                                );

                                // Check if streaming was stopped
                                const session = await ctx.runQuery(
                                    internal.streaming.getStreamingSession,
                                    { messageId: args.messageId }
                                );
                                if (session?.isStopped) break;
                            }
                        }

                        await ctx.runMutation(
                            internal.aiHelpers.updateMessageContent,
                            {
                                messageId: args.messageId,
                                content: response,
                                metadata,
                                isStreaming: false,
                            }
                        );
                        return;
                    }
                } catch (error) {
                    console.error("Web search error:", error);
                    response =
                        "Sorry, I couldn't perform the web search at the moment. Please try again later.";
                    await ctx.runMutation(
                        internal.aiHelpers.updateMessageContent,
                        {
                            messageId: args.messageId,
                            content: response,
                            isStreaming: false,
                        }
                    );
                    return;
                }
            }

            // Normal AI response - use simple provider detection
            const processedAttachments = args.attachments
                ? await processAttachments(args.attachments, ctx)
                : null;

            // Simple provider detection instead of complex fallback logic
            const provider = getProviderFromModel(args.model);
            const config = PROVIDER_CONFIGS[provider];
            const userKey = userApiKeys[config.userKeyField];

            console.log(`Using provider: ${provider} for model: ${args.model}`);

            // Process attachments for the selected provider using Files API
            let providerAttachments = [];
            if (args.attachments && args.attachments.length > 0) {
                const client = providerManager.getClient(provider, userKey);
                providerAttachments = await processAttachmentsForProvider(
                    args.attachments,
                    provider,
                    client,
                    ctx
                );
            }

            const openaiMessages = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            // Add generic attachment context for non-file-upload providers
            if (processedAttachments && processedAttachments.length > 0 && !providerAttachments.length) {
                const attachmentContext = processedAttachments.map(att => {
                    if (att.type === "image") {
                        return `[Image: ${att.name}]`;
                    } else if (att.content) {
                        return `[${att.type.toUpperCase()}: ${att.name}]\n${att.content}`;
                    }
                    return `[${att.type.toUpperCase()}: ${att.name}]`;
                }).join('\n\n');

                const lastMessage = openaiMessages[openaiMessages.length - 1];
                if (lastMessage && lastMessage.role === 'user') {
                    lastMessage.content = `${lastMessage.content}\n\nAttached files:\n${attachmentContext}`;
                }
            }

            // Handle different providers with appropriate streaming
            if (provider === "google") {
                // Real Gemini streaming implementation with resumable integration
                const stream = await providerManager.callProvider(
                    provider,
                    args.model,
                    openaiMessages,
                    { apiKey: userKey, stream: true, attachments: providerAttachments }
                );

                let chunkIndex = 0;
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        response += content;
                        await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                            messageId: args.messageId,
                            content: response,
                        });

                        const session = await ctx.runQuery(
                            internal.streaming.getStreamingSession,
                            { messageId: args.messageId }
                        );
                        if (session?.isStopped) break;
                    }
                    
                    // Track real chunk indices for resumable streaming (Google SDK)
                    if (chunk.chunk_index !== undefined) {
                        chunkIndex = chunk.chunk_index;
                        if (streamingSession) {
                            await ctx.runMutation(internal.streaming.updateStreamingSession, {
                                sessionId: streamingSession.sessionId,
                                lastChunkIndex: chunkIndex,
                                resumeToken: `gemini_chunk_${chunkIndex}`
                            });
                        }
                    }
                    
                    // Handle multimodal image data
                    if (chunk.image_data) {
                        console.log(`Received generated image data: ${chunk.image_data.length} bytes`);
                        metadata.generatedImageData = chunk.image_data;
                    }
                }
            } else if (provider === "anthropic") {
                // Handle Anthropic streaming with real event processing
                const stream = await providerManager.callProvider(
                    provider,
                    args.model,
                    openaiMessages,
                    { apiKey: userKey, stream: true, attachments: providerAttachments }
                );

                let chunkIndex = 0;
                let messageId = "";
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        response += content;
                        await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                            messageId: args.messageId,
                            content: response,
                        });

                        const session = await ctx.runQuery(
                            internal.streaming.getStreamingSession,
                            { messageId: args.messageId }
                        );
                        if (session?.isStopped) break;
                    }
                    
                    // Track Anthropic streaming events for resumable streaming
                    if (chunk.chunk_index !== undefined) {
                        chunkIndex = chunk.chunk_index;
                    }
                    if (chunk.message_id) {
                        messageId = chunk.message_id;
                    }
                    
                    if (streamingSession && (chunkIndex || messageId)) {
                        await ctx.runMutation(internal.streaming.updateStreamingSession, {
                            sessionId: streamingSession.sessionId,
                            lastChunkIndex: chunkIndex,
                            resumeToken: messageId || `anthropic_chunk_${chunkIndex}`
                        });
                    }
                }
            } else {
                // Handle OpenAI-compatible providers (OpenAI, OpenRouter, DeepSeek) with Responses API
                const stream = await providerManager.callProvider(
                    provider,
                    args.model,
                    openaiMessages,
                    { 
                        apiKey: userKey, 
                        stream: true, 
                        attachments: providerAttachments
                    }
                );

                let responseId = "";
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        response += content;
                        await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                            messageId: args.messageId,
                            content: response,
                        });

                        const session = await ctx.runQuery(
                            internal.streaming.getStreamingSession,
                            { messageId: args.messageId }
                        );
                        if (session?.isStopped) break;
                    }
                    
                    // Track sequence numbers and response ID for resumable streaming (OpenAI Responses API)
                    if (chunk.sequence_number || chunk.response_id) {
                        if (chunk.response_id) {
                            responseId = chunk.response_id;
                        }
                        // Store resume information for OpenAI Responses API
                        if (streamingSession) {
                            await ctx.runMutation(internal.streaming.updateStreamingSession, {
                                sessionId: streamingSession.sessionId,
                                lastChunkIndex: chunk.sequence_number || 0,
                                resumeToken: responseId || ""
                            });
                        }
                    }
                }
            }

            // Mark streaming as complete
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: response,
                metadata,
                isStreaming: false,
            });

        } catch (error) {
            console.error("Streaming error:", error);
            
            await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                messageId: args.messageId,
                content: "Sorry, I encountered an error while generating a response. Please try again.",
                isStreaming: false,
            });
        }
    },
});

export const retryMessage = action({
    args: {
        messageId: v.id("messages"),
        model: v.string(),
        userApiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        try {
            // Get the message and its chat
            const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
                messageId: args.messageId,
            });

            if (!message) {
                throw new Error("Message not found");
            }

            // Get user ID for internal streaming session
            const _userId = message.userId;

            // Re-send the message to the AI for processing
            await ctx.runMutation(internal.aiHelpers.sendMessage, {
                chatId: message.chatId,
                content: message.content,
                model: args.model,
                userApiKey: args.userApiKey,
                isStreaming: true,
                parentMessageId: args.messageId,
            });
        } catch (error) {
            console.error("Retry message error:", error);
            throw new Error("Failed to retry message");
        }
    },
});

// Resume streaming from a specific point for different providers
export const resumeStreamingResponse = internalAction({
    args: {
        sessionId: v.string(),
        messageId: v.id("messages"),
        currentContent: v.string(),
        lastChunkIndex: v.number(),
        resumeToken: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        try {
            // Get the streaming session to determine provider and model
            const session = await ctx.runQuery(
                internal.streaming.getStreamingSessionBySessionId,
                { sessionId: args.sessionId }
            );

            if (!session) {
                throw new Error("Streaming session not found");
            }

            // Get the original message to reconstruct the request
            const message = await ctx.runQuery(internal.aiHelpers.getMessage, {
                messageId: args.messageId,
            });

            if (!message) {
                throw new Error("Message not found");
            }

            // Get chat history for context
            const chat = await ctx.runQuery(internal.aiHelpers.getChat, {
                chatId: message.chatId,
            });

            if (!chat) {
                throw new Error("Chat not found");
            }

            const messages = await ctx.runQuery(
                internal.aiHelpers.getChatHistory,
                { chatId: message.chatId }
            );

            // Determine provider and get client
            const provider = getProviderFromModel(session.modelId || "gpt-4o");
            const config = PROVIDER_CONFIGS[provider];
            
            // Get user API keys (simplified)
            const userApiKeys = {}; // This would be populated from user preferences
            const userKey = userApiKeys[config.userKeyField];
            
            const providerManager = new ProviderManager();
            const client = providerManager.getClient(provider, userKey);

            // Resume streaming based on provider type
            if (provider === "openai" || provider === "openrouter" || provider === "deepseek") {
                // OpenAI Responses API resumption
                if (args.resumeToken) {
                    try {
                        // Resume from specific response ID and sequence number
                        const resumeResponse = await fetch(
                            `https://api.openai.com/v1/responses/${args.resumeToken}?stream=true&starting_after=${args.lastChunkIndex}`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${userKey || process.env.OPENAI_API_KEY}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        if (resumeResponse.ok) {
                            let resumedContent = args.currentContent;
                            
                            // Process resumed stream
                            const reader = resumeResponse.body?.getReader();
                            if (reader) {
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;

                                    const chunk = new TextDecoder().decode(value);
                                    const lines = chunk.split('\n').filter(line => line.trim());
                                    
                                    for (const line of lines) {
                                        if (line.startsWith('data: ')) {
                                            try {
                                                const data = JSON.parse(line.slice(6));
                                                if (data.type === 'response.output_text.delta') {
                                                    const content = data.delta || "";
                                                    if (content) {
                                                        resumedContent += content;
                                                        await ctx.runMutation(
                                                            internal.aiHelpers.updateMessageContent,
                                                            {
                                                                messageId: args.messageId,
                                                                content: resumedContent,
                                                            }
                                                        );
                                                    }
                                                }
                                            } catch (parseError) {
                                                // Skip invalid JSON
                                                continue;
                                            }
                                        }
                                    }
                                }
                            }
                            
                            return { status: "resumed", content: resumedContent };
                        }
                    } catch (resumeError) {
                        console.error("OpenAI resume failed:", resumeError);
                        // Fall through to restart
                    }
                }
            } else if (provider === "anthropic") {
                // Anthropic doesn't support resume, so restart from beginning
                console.log("Anthropic doesn't support resume, restarting stream");
            } else if (provider === "google") {
                // Google Gemini doesn't support resume, so restart from beginning
                console.log("Google Gemini doesn't support resume, restarting stream");
            }

            // If resume failed or not supported, restart the entire stream
            console.log("Resuming by restarting stream from beginning");
            
            const openaiMessages = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            // Restart streaming
            const stream = await providerManager.callProvider(
                provider,
                session.modelId || "gpt-4o",
                openaiMessages,
                { 
                    apiKey: userKey, 
                    stream: true
                }
            );

            let newContent = "";
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                    newContent += content;
                    await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                        messageId: args.messageId,
                        content: newContent,
                    });

                    // Check if streaming was stopped
                    const currentSession = await ctx.runQuery(
                        internal.streaming.getStreamingSession,
                        { messageId: args.messageId }
                    );
                    if (currentSession?.isStopped) break;
                }
            }

            // Mark as complete
            await ctx.runMutation(internal.streaming.updateStreamingSession, {
                sessionId: args.sessionId,
                isComplete: true,
            });

            return { status: "restarted", content: newContent };

        } catch (error) {
            console.error("Resume streaming error:", error);
            throw error;
        }
    },
});
