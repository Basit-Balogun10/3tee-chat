import OpenAI, { AzureOpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { GoogleGenAI } from "@google/genai";
import { PROVIDER_CONFIGS } from "./config";

// Provider client factory with dual authentication support
class ProviderManager {
    private clients: Map<string, any> = new Map();

    getClient(provider: string, apiKey?: string): any {
        const key = `${provider}-${apiKey || "default"}`;

        if (this.clients.has(key)) {
            return this.clients.get(key);
        }

        const config = PROVIDER_CONFIGS[provider];
        const finalApiKey = apiKey;

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
                        apiVersion:
                            process.env.OPENAI_API_VERSION ||
                            "2024-07-01-preview",
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

            case "google":
                if (apiKey) {
                    // User's Google/Gemini key - GoogleGenAI client
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

            case "google":
                return this.callGoogle(client, model, messages, options);

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
            // Handle ALL Responses API streaming events according to appendix.md patterns
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
                };
                break;
            } else if (event.type === "response.created") {
                // Response started - track response ID for resumption
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    response_id: event.response?.id,
                };
            } else if (event.type === "response.output_text.done") {
                // Text output completed
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    output_text_done: true,
                };
            } else if (event.type === "response.function_call.arguments.delta") {
                // Function call arguments streaming
                yield {
                    choices: [
                        {
                            delta: {
                                function_call: {
                                    arguments: event.delta || "",
                                },
                            },
                        },
                    ],
                };
            } else if (event.type === "response.function_call.arguments.done") {
                // Function call arguments complete
                yield {
                    choices: [
                        {
                            delta: {
                                function_call: {
                                    name: event.name,
                                    arguments: event.arguments,
                                },
                            },
                        },
                    ],
                    function_call_done: true,
                };
            } else if (event.type === "response.image_generation_call.partial_image") {
                // Partial image generation (for progressive image loading)
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    partial_image: {
                        index: event.partial_image_index,
                        data: event.partial_image_b64,
                    },
                };
            } else if (event.type === "response.image_generation_call.completed") {
                // Image generation completed
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    image_generation_complete: {
                        result: event.result,
                    },
                };
            } else if (event.type === "error") {
                // Error handling
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                            finish_reason: "error",
                        },
                    ],
                    error: event.error,
                };
                break;
            }
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
                        tool_use: true,
                    };
                }
            } else if (event.type === "message_start") {
                // Message started
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
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

    private async callGoogle(
        client: any,
        model: string,
        messages: any[],
        options: any
    ) {
        // Convert OpenAI format to Google Gemini format
        const contents = this.convertToGoogleContentsFormat(messages);

        const requestBody: any = {
            model,
            contents,
            config: {
                temperature: options.temperature || 0.7,
            },
        };

        // Add Google-specific features like search grounding
        if (options.enableSearch) {
            requestBody.config.tools = [
                { googleSearch: {} },
                { urlContext: {} }, // Always enable URL context per appendix.md
            ];
        }

        // Add file attachments if present
        if (options.attachments && options.attachments.length > 0) {
            const lastContent = contents[contents.length - 1];
            if (lastContent && typeof lastContent === "object") {
                for (const attachment of options.attachments) {
                    if (attachment.fileId) {
                        lastContent.parts = lastContent.parts || [];
                        lastContent.parts.push({
                            fileData: {
                                fileUri: attachment.fileId,
                                mimeType: attachment.mimeType,
                            },
                        });
                    }
                }
            }
        }

        // Handle streaming vs non-streaming
        if (options.stream) {
            const stream = await client.models.generateContentStream(requestBody);
            return this.createGoogleStreamIterator(stream);
        } else {
            return await client.models.generateContent(requestBody);
        }
    }

    // Google streaming iterator with complete event handling
    private async *createGoogleStreamIterator(stream: any) {
        for await (const chunk of stream) {
            // Handle Google Gemini streaming events according to appendix.md patterns
            if (chunk.text) {
                yield {
                    choices: [
                        {
                            delta: {
                                content: chunk.text,
                            },
                        },
                    ],
                };
            }

            // Handle function calls and grounding metadata
            if (chunk.functionCall) {
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    function_call: chunk.functionCall,
                };
            }

            // Handle grounding metadata for citations
            if (chunk.groundingMetadata) {
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    grounding_metadata: chunk.groundingMetadata,
                };
            }

            // Handle finish reason
            if (chunk.finishReason) {
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                            finish_reason: "stop",
                        },
                    ],
                    finish_reason: chunk.finishReason,
                };
                break;
            }

            // Handle safety ratings
            if (chunk.safetyRatings) {
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    safety_ratings: chunk.safetyRatings,
                };
            }

            // Handle usage metadata
            if (chunk.usageMetadata) {
                yield {
                    choices: [
                        {
                            delta: {
                                content: "",
                            },
                        },
                    ],
                    usage_metadata: chunk.usageMetadata,
                };
            }

            // Handle candidates array for multiple responses
            if (chunk.candidates && chunk.candidates.length > 0) {
                for (const candidate of chunk.candidates) {
                    if (candidate.content && candidate.content.parts) {
                        for (const part of candidate.content.parts) {
                            if (part.text) {
                                yield {
                                    choices: [
                                        {
                                            delta: {
                                                content: part.text,
                                            },
                                        },
                                    ],
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    // Convert OpenAI format to Google Gemini contents format
    private convertToGoogleContentsFormat(messages: any[]): any[] {
        const contents = [];

        for (const message of messages) {
            if (message.role === "system") {
                // Skip system messages for Google format or handle separately
                continue;
            }

            if (typeof message.content === "string") {
                contents.push({
                    role: message.role === "assistant" ? "model" : "user",
                    parts: [{ text: message.content }],
                });
            } else if (Array.isArray(message.content)) {
                const parts = [];
                for (const part of message.content) {
                    if (part.type === "text") {
                        parts.push({ text: part.text });
                    } else if (part.type === "image_url") {
                        if (part.image_url.url.startsWith("data:")) {
                            parts.push({
                                inlineData: {
                                    mimeType: "image/jpeg", // or determine from data URL
                                    data: part.image_url.url.split(",")[1], // Remove data:image/jpeg;base64, prefix
                                },
                            });
                        } else {
                            parts.push({
                                fileData: {
                                    fileUri: part.image_url.url,
                                    mimeType: "image/jpeg",
                                },
                            });
                        }
                    }
                }
                contents.push({
                    role: message.role === "assistant" ? "model" : "user",
                    parts,
                });
            }
        }

        return contents;
    }
}

export const providerManager = new ProviderManager();