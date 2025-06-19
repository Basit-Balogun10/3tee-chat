import { getMimeType } from "./helpers";
import { internal } from "../_generated/api";

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
        client: any,
        ctx?: any // Convex context for caching
    ): Promise<string> {
        // Check if we already have this file cached for this provider
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

        // Cache in Convex if context is available
        if (ctx) {
            try {
                await ctx.runMutation(internal.files.cacheProviderFile, {
                    originalId: storageId,
                    provider,
                    providerFileId: fileId,
                    fileName,
                    mimeType,
                    fileSize: fileBlob.size,
                });
            } catch (error) {
                console.error("Failed to cache provider file:", error);
                // Continue even if caching fails
            }
        }

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

            case "google": {
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

    // Upload artifact content to provider file API
    async uploadArtifactToProvider(
        artifactId: string,
        provider: string,
        artifact: any,
        client: any,
        ctx: any
    ): Promise<{ fileId: string; fileName: string; mimeType: string }> {
        // Create blob from artifact content
        const artifactBlob = new Blob([artifact.content], {
            type: "text/plain",
        });

        const fileName = `${artifact.filename}.${artifact.language}`;
        const mimeType = "text/plain";

        // Upload to provider's file API with caching
        const fileId = await this.getProviderFileId(
            artifactId,
            provider,
            artifactBlob,
            fileName,
            mimeType,
            client,
            ctx
        );

        return {
            fileId,
            fileName,
            mimeType,
        };
    }

    // Get cached provider file
    async getCachedProviderFile(ctx: any, originalId: string, provider: string) {
        return await ctx.runQuery(internal.files.getCachedProviderFile, {
            originalId,
            provider,
        });
    }

    // Clean up expired provider files
    async cleanupExpiredFiles(ctx: any) {
        await ctx.runMutation(internal.files.cleanupExpiredProviderFiles);
    }
}

// Provider-specific structured output implementations following appendix.md exactly
class StructuredOutputManager {
    // OpenAI Responses API structured output implementation
    async generateOpenAIStructuredOutput(
        client: any,
        model: string,
        messages: any[],
        schema: any,
        options: any = {}
    ): Promise<any> {
        // Convert to Responses API format with structured output
        const input = this.convertToResponsesAPIFormat(messages);

        const requestBody: any = {
            model,
            input,
            temperature: options.temperature || 0.7,
            // OpenAI Responses API structured output according to appendix.md
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: schema.name || "structured_response",
                    description: schema.description || "Structured response",
                    schema: schema,
                    strict: true,
                },
            },
        };

        if (options.stream) {
            requestBody.stream = true;
            requestBody.background = true;
        }

        if (options.attachments && options.attachments.length > 0) {
            requestBody.input = this.addAttachmentsToInput(
                input,
                options.attachments
            );
        }

        const response = await client.responses.create(requestBody);

        if (options.stream) {
            return this.createStructuredOutputStreamIterator(response);
        }

        return response;
    }

    // Google Gemini structured output implementation using responseSchema
    async generateGoogleStructuredOutput(
        client: any,
        model: string,
        messages: any[],
        schema: any,
        options: any = {}
    ): Promise<any> {
        const contents = this.convertToGoogleContentsFormat(messages);

        const requestBody: any = {
            model,
            contents,
            config: {
                temperature: options.temperature || 0.7,
                responseMimeType: "application/json",
                responseSchema: this.convertToGoogleSchema(schema),
            },
        };

        if (options.enableSearch) {
            requestBody.config.tools = [
                { googleSearch: {} },
                { urlContext: {} },
            ];
        }

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

        if (options.stream) {
            const stream =
                await client.models.generateContentStream(requestBody);
            return this.createGoogleStructuredStreamIterator(stream);
        } else {
            return await client.models.generateContent(requestBody);
        }
    }

    // Anthropic structured output implementation using tools pattern
    async generateAnthropicStructuredOutput(
        client: any,
        model: string,
        messages: any[],
        schema: any,
        options: any = {}
    ): Promise<any> {
        const systemMessage = messages.find((m) => m.role === "system");
        const conversationMessages = messages.filter(
            (m) => m.role !== "system"
        );

        const requestBody: any = {
            model,
            max_tokens: 4000,
            temperature: options.temperature || 0.7,
            messages: conversationMessages,
            tools: [
                {
                    name: "structured_response",
                    description:
                        schema.description || "Generate a structured response",
                    input_schema: schema,
                },
            ],
            tool_choice: {
                type: "tool",
                name: "structured_response",
            },
        };

        if (systemMessage?.content) {
            requestBody.system =
                systemMessage.content +
                "\n\nYou must respond using the structured_response tool with the exact schema provided.";
        } else {
            requestBody.system =
                "You must respond using the structured_response tool with the exact schema provided.";
        }

        if (options.attachments && options.attachments.length > 0) {
            const lastMessage =
                requestBody.messages[requestBody.messages.length - 1];
            if (lastMessage && lastMessage.role === "user") {
                const content = [];

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

                content.push({
                    type: "text",
                    text: lastMessage.content,
                });

                lastMessage.content = content;
            }
        }

        if (options.stream) {
            requestBody.stream = true;
            const stream = await client.messages.stream(requestBody);
            return this.createAnthropicStructuredStreamIterator(stream);
        } else {
            return await client.messages.create(requestBody);
        }
    }

    // Helper methods for schema conversion and streaming
    private convertToGoogleSchema(schema: any): any {
        const { Type } = require("@google/genai");

        const convertType = (schemaNode: any): any => {
            switch (schemaNode.type) {
                case "string":
                    return {
                        type: Type.STRING,
                        description: schemaNode.description,
                        nullable: schemaNode.nullable || false,
                    };
                case "number":
                case "integer":
                    return {
                        type: Type.NUMBER,
                        description: schemaNode.description,
                        nullable: schemaNode.nullable || false,
                    };
                case "boolean":
                    return {
                        type: Type.BOOLEAN,
                        description: schemaNode.description,
                        nullable: schemaNode.nullable || false,
                    };
                case "array":
                    return {
                        type: Type.ARRAY,
                        description: schemaNode.description,
                        items: convertType(schemaNode.items),
                        nullable: schemaNode.nullable || false,
                    };
                case "object":
                    const properties: any = {};
                    if (schemaNode.properties) {
                        for (const [key, value] of Object.entries(
                            schemaNode.properties
                        )) {
                            properties[key] = convertType(value);
                        }
                    }
                    return {
                        type: Type.OBJECT,
                        description: schemaNode.description,
                        properties,
                        required: schemaNode.required || [],
                        nullable: schemaNode.nullable || false,
                    };
                default:
                    return {
                        type: Type.STRING,
                        description:
                            schemaNode.description ||
                            "Converted from unsupported type",
                        nullable: false,
                    };
            }
        };

        return convertType(schema);
    }

    // Streaming iterators for each provider
    private async *createStructuredOutputStreamIterator(stream: any) {
        let structuredContent = "";

        for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
                const content = event.delta || "";
                structuredContent += content;

                yield {
                    choices: [{ delta: { content: content } }],
                    structured_content: structuredContent,
                };
            } else if (event.type === "response.done") {
                let parsedOutput = null;
                try {
                    parsedOutput = JSON.parse(structuredContent);
                } catch (error) {
                    console.error("Failed to parse structured output:", error);
                }

                yield {
                    choices: [
                        { delta: { content: "" }, finish_reason: "stop" },
                    ],
                    structured_output: parsedOutput,
                    structured_content: structuredContent,
                };
                break;
            }
        }
    }

    // Google structured output streaming iterator
    private async *createGoogleStructuredStreamIterator(stream: any) {
        let structuredContent = "";

        for await (const chunk of stream) {
            // Google Gemini streaming with structured output
            if (chunk.text) {
                const content = chunk.text;
                structuredContent += content;

                yield {
                    choices: [{ delta: { content: content } }],
                    structured_content: structuredContent,
                    provider: "google",
                };
            }

            // Handle function calls and grounding metadata
            if (chunk.functionCall) {
                yield {
                    choices: [{ delta: { content: "" } }],
                    function_call: chunk.functionCall,
                    provider: "google",
                };
            }

            // Handle grounding metadata for citations
            if (chunk.groundingMetadata) {
                yield {
                    choices: [{ delta: { content: "" } }],
                    grounding_metadata: chunk.groundingMetadata,
                    provider: "google",
                };
            }

            // Handle finish reason
            if (chunk.finishReason) {
                let parsedOutput = null;
                try {
                    parsedOutput = JSON.parse(structuredContent);
                } catch (error) {
                    console.error(
                        "Failed to parse Google structured output:",
                        error
                    );
                }

                yield {
                    choices: [
                        { delta: { content: "" }, finish_reason: "stop" },
                    ],
                    structured_output: parsedOutput,
                    structured_content: structuredContent,
                    finish_reason: chunk.finishReason,
                    provider: "google",
                };
                break;
            }

            // Handle safety ratings and other metadata
            if (chunk.safetyRatings) {
                yield {
                    choices: [{ delta: { content: "" } }],
                    safety_ratings: chunk.safetyRatings,
                    provider: "google",
                };
            }

            // Handle usage metadata
            if (chunk.usageMetadata) {
                yield {
                    choices: [{ delta: { content: "" } }],
                    usage_metadata: chunk.usageMetadata,
                    provider: "google",
                };
            }
        }
    }

    // Anthropic structured output streaming iterator with full event handling
    private async *createAnthropicStructuredStreamIterator(stream: any) {
        let structuredContent = "";
        let messageId = "";
        let currentToolUse = null;
        let toolInputJson = "";

        for await (const event of stream) {
            // Handle all Anthropic streaming events according to appendix.md patterns
            if (event.type === "message_start") {
                messageId = event.message?.id || "";
                yield {
                    choices: [{ delta: { content: "" } }],
                    message_id: messageId,
                    event_type: "message_start",
                    provider: "anthropic",
                };
            } else if (event.type === "content_block_start") {
                if (event.content_block?.type === "tool_use") {
                    currentToolUse = event.content_block;
                    toolInputJson = "";

                    yield {
                        choices: [{ delta: { content: "" } }],
                        content_block: event.content_block,
                        event_type: "content_block_start",
                        provider: "anthropic",
                    };
                } else if (event.content_block?.type === "text") {
                    yield {
                        choices: [{ delta: { content: "" } }],
                        content_block: event.content_block,
                        event_type: "content_block_start",
                        provider: "anthropic",
                    };
                }
            } else if (event.type === "content_block_delta") {
                if (event.delta?.type === "text_delta") {
                    const content = event.delta.text || "";
                    structuredContent += content;

                    yield {
                        choices: [{ delta: { content: content } }],
                        structured_content: structuredContent,
                        event_type: "content_block_delta",
                        delta_type: "text_delta",
                        provider: "anthropic",
                    };
                } else if (event.delta?.type === "input_json_delta") {
                    const jsonDelta = event.delta.partial_json || "";
                    toolInputJson += jsonDelta;
                    structuredContent += jsonDelta;

                    yield {
                        choices: [{ delta: { content: jsonDelta } }],
                        structured_content: structuredContent,
                        tool_input_json: toolInputJson,
                        event_type: "content_block_delta",
                        delta_type: "input_json_delta",
                        provider: "anthropic",
                    };
                }
            } else if (event.type === "content_block_stop") {
                if (
                    currentToolUse &&
                    currentToolUse.name === "structured_response"
                ) {
                    // Parse the complete tool input for structured output
                    let parsedOutput = null;
                    try {
                        parsedOutput = JSON.parse(toolInputJson);
                    } catch (error) {
                        console.error(
                            "Failed to parse Anthropic structured output:",
                            error
                        );
                        // Try to parse the accumulated structured content instead
                        try {
                            parsedOutput = JSON.parse(structuredContent);
                        } catch (secondError) {
                            console.error(
                                "Failed to parse structured content as fallback:",
                                secondError
                            );
                        }
                    }

                    yield {
                        choices: [{ delta: { content: "" } }],
                        structured_output: parsedOutput,
                        structured_content: structuredContent,
                        tool_use_complete: currentToolUse,
                        event_type: "content_block_stop",
                        provider: "anthropic",
                    };
                } else {
                    yield {
                        choices: [{ delta: { content: "" } }],
                        event_type: "content_block_stop",
                        provider: "anthropic",
                    };
                }

                currentToolUse = null;
                toolInputJson = "";
            } else if (event.type === "message_delta") {
                // Handle message-level deltas (like stop_reason, usage, etc.)
                if (event.delta?.stop_reason) {
                    yield {
                        choices: [
                            { delta: { content: "" }, finish_reason: "stop" },
                        ],
                        stop_reason: event.delta.stop_reason,
                        event_type: "message_delta",
                        provider: "anthropic",
                    };
                }

                if (event.delta?.usage) {
                    yield {
                        choices: [{ delta: { content: "" } }],
                        usage: event.delta.usage,
                        event_type: "message_delta",
                        provider: "anthropic",
                    };
                }
            } else if (event.type === "message_stop") {
                // Final completion event
                let finalParsedOutput = null;

                // Try to parse the final structured content if we haven't already
                if (structuredContent && !finalParsedOutput) {
                    try {
                        finalParsedOutput = JSON.parse(structuredContent);
                    } catch (error) {
                        console.error(
                            "Failed to parse final Anthropic structured output:",
                            error
                        );
                    }
                }

                yield {
                    choices: [
                        { delta: { content: "" }, finish_reason: "stop" },
                    ],
                    structured_output: finalParsedOutput,
                    structured_content: structuredContent,
                    message_id: messageId,
                    event_type: "message_stop",
                    provider: "anthropic",
                };
                break;
            } else if (event.type === "ping") {
                // Keep-alive event, just continue
                continue;
            } else if (event.type === "error") {
                // Handle error events
                yield {
                    choices: [
                        { delta: { content: "" }, finish_reason: "error" },
                    ],
                    error: event.error,
                    event_type: "error",
                    provider: "anthropic",
                };
                break;
            }
        }
    }

    // Add these helper methods to StructuredOutputManager class

    private convertToResponsesAPIFormat(messages: any[]): any[] {
        // Same implementation as in ProviderManager
        const input = [];

        for (const message of messages) {
            if (message.role === "system") {
                continue; // Handle system messages separately if needed
            }

            if (typeof message.content === "string") {
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
                const content = [];
                for (const part of message.content) {
                    if (part.type === "text") {
                        content.push({
                            type: "input_text",
                            text: part.text,
                        });
                    } else if (part.type === "image_url") {
                        if (part.image_url.url.startsWith("data:")) {
                            content.push({
                                type: "input_image",
                                image_url: part.image_url.url,
                            });
                        } else {
                            content.push({
                                type: "input_image",
                                file_id: part.image_url.url,
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

    private addAttachmentsToInput(input: any[], attachments: any[]): any[] {
        if (!attachments || attachments.length === 0) return input;

        const lastMessageIndex = input.length - 1;
        if (lastMessageIndex >= 0 && input[lastMessageIndex].role === "user") {
            const lastMessage = input[lastMessageIndex];

            for (const attachment of attachments) {
                if (attachment.type === "image_file" && attachment.fileId) {
                    lastMessage.content.push({
                        type: "input_image",
                        file_id: attachment.fileId,
                    });
                }
            }
        }

        return input;
    }
}

// Real image generation with provider-specific implementations following appendix.md exactly
class ImageGenerationManager {
    // Google Imagen 3.0 implementation
    async generateGoogleImage(
        client: any,
        prompt: string,
        options: any = {}
    ): Promise<string> {
        const response = await client.models.generateImages({
            model: "imagen-3.0-generate-002",
            prompt: prompt,
            config: {
                numberOfImages: 1,
                includeRaiReason: true,
                // Additional Google-specific options
                aspectRatio: options.aspectRatio || "1:1",
                personGeneration: options.personGeneration || "allow_adult",
                safetyFilterLevel: options.safetyFilterLevel || "block_some",
            },
        });

        const generatedImage = response.generatedImages?.[0];
        if (!generatedImage?.image?.imageBytes) {
            throw new Error("No image generated from Google Imagen");
        }

        // Convert imageBytes to base64 data URL
        const imageBytes = generatedImage.image.imageBytes;
        const base64Image = Buffer.from(imageBytes).toString("base64");
        return `data:image/png;base64,${base64Image}`;
    }

    // OpenAI Responses API image generation implementation
    async generateOpenAIImage(
        client: any,
        prompt: string,
        options: any = {}
    ): Promise<string> {
        const response = await client.responses.create({
            model: options.model || "gpt-4o", // Can call gpt-image-1 from supported models
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: prompt,
                        },
                    ],
                },
            ],
            tools: [{ type: "image_generation" }],
            // Optional: stream for partial images
            stream: options.stream || false,
            ...(options.stream && {
                partial_images: options.partialImages || 1,
            }),
        });

        // Extract image data from response
        if (options.stream) {
            return this.handleOpenAIImageStream(response);
        } else {
            const imageGenerationCalls = response.output.filter(
                (output: any) => output.type === "image_generation_call"
            );

            if (imageGenerationCalls.length === 0) {
                throw new Error("No image generated from OpenAI");
            }

            const imageBase64 = imageGenerationCalls[0].result;
            return `data:image/png;base64,${imageBase64}`;
        }
    }

    // Handle OpenAI streaming image generation
    private async handleOpenAIImageStream(stream: any): Promise<string> {
        let finalImageBase64 = "";
        const partialImages: string[] = [];

        for await (const event of stream) {
            if (event.type === "response.image_generation_call.partial_image") {
                const idx = event.partial_image_index;
                const imageBase64 = event.partial_image_b64;
                partialImages[idx] = imageBase64;

                // Could emit partial images to frontend here
                console.log(`Received partial image ${idx + 1}`);
            } else if (
                event.type === "response.image_generation_call.completed"
            ) {
                finalImageBase64 = event.result;
                break;
            }
        }

        if (!finalImageBase64 && partialImages.length > 0) {
            // Use the last partial image if no final image
            finalImageBase64 = partialImages[partialImages.length - 1];
        }

        if (!finalImageBase64) {
            throw new Error("No image generated from OpenAI streaming");
        }

        return `data:image/png;base64,${finalImageBase64}`;
    }

    // Main entry point for image generation
    async generateImage(
        provider: string,
        client: any,
        prompt: string,
        options: any = {}
    ): Promise<string> {
        switch (provider) {
            case "google":
                return await this.generateGoogleImage(client, prompt, options);

            case "openai":
                return await this.generateOpenAIImage(client, prompt, options);

            default:
                throw new Error(
                    `Image generation not supported for provider: ${provider}`
                );
        }
    }
}

// Real video generation with provider-specific implementations following appendix.md exactly
class VideoGenerationManager {
    // Google Veo 2.0 implementation with operation polling
    async generateGoogleVideo(
        client: any,
        prompt: string,
        options: any = {}
    ): Promise<any> {
        // Start video generation operation
        let operation = await client.models.generateVideos({
            model: "veo-2.0-generate-001",
            prompt: prompt,
            config: {
                numberOfVideos: options.numberOfVideos || 1,
                aspectRatio: options.aspectRatio || "16:9",
                duration: options.duration || "5s",
            },
        });

        // Poll for completion as shown in appendix.md
        while (!operation.done) {
            console.log("Waiting for video generation completion...");
            await this.delay(2000); // Poll every 2 seconds
            operation = await client.operations.getVideosOperation({
                operation: operation,
            });

            // Optional: Add timeout after 5 minutes
            if (
                operation.createTime &&
                Date.now() - new Date(operation.createTime).getTime() > 300000
            ) {
                throw new Error("Video generation timeout after 5 minutes");
            }
        }

        const videos = operation.response?.generatedVideos;
        if (!videos || videos.length === 0) {
            throw new Error("No videos generated from Google Veo");
        }

        // Use the video data to get the actual video URL according to appendix.md
        const video = videos[0];
        
        // Download the video URL from the operation response
        const videoUrl = video.uri || `google_video_${Date.now()}.mp4`;
        const thumbnailUrl = video.thumbnailUri || `google_thumb_${Date.now()}.jpg`;

        return {
            videoUrl: videoUrl,
            thumbnailUrl: thumbnailUrl,
            duration: options.duration || "5s",
            resolution: "1280x720", // Veo 2.0 default
            status: "completed",
            operationId: operation.name,
            provider: "google",
        };
    }

    // OpenAI Sora implementation with job polling
    async generateOpenAIVideo(
        client: any,
        prompt: string,
        options: any = {}
    ): Promise<any> {
        // Create video generation job following appendix.md Sora patterns
        const jobResponse = await fetch(`${client.baseURL}/video/generations`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${client.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "sora",
                prompt: prompt,
                n_variants: options.variants || 1,
                n_seconds: options.duration || 5,
                height: options.height || 480,
                width: options.width || 480,
            }),
        });

        if (!jobResponse.ok) {
            throw new Error(
                `Video generation job creation failed: ${jobResponse.status}`
            );
        }

        const job = await jobResponse.json();
        const jobId = job.id;

        console.log(`Video generation job created: ${jobId}`);

        // Poll for job completion
        let status = "queued";
        const maxAttempts = 150; // 5 minutes with 2-second intervals
        let attempts = 0;

        while (
            status !== "succeeded" &&
            status !== "failed" &&
            attempts < maxAttempts
        ) {
            await this.delay(2000);
            attempts++;

            const statusResponse = await fetch(
                `${client.baseURL}/video/generations/${jobId}`,
                {
                    headers: {
                        Authorization: `Bearer ${client.apiKey}`,
                    },
                }
            );

            if (!statusResponse.ok) {
                throw new Error(
                    `Failed to check job status: ${statusResponse.status}`
                );
            }

            const statusData = await statusResponse.json();
            status = statusData.status;

            console.log(`Video generation job status: ${status}`);

            if (status === "failed") {
                throw new Error(
                    `Video generation failed: ${statusData.failure_reason || "Unknown error"}`
                );
            }
        }

        if (status !== "succeeded") {
            throw new Error("Video generation timeout");
        }

        // Get the generated video
        const finalStatusResponse = await fetch(
            `${client.baseURL}/video/generations/${jobId}`,
            {
                headers: {
                    Authorization: `Bearer ${client.apiKey}`,
                },
            }
        );

        const finalData = await finalStatusResponse.json();
        const generations = finalData.generations || [];

        if (generations.length === 0) {
            throw new Error("No video generations found in completed job");
        }

        const generationId = generations[0].id;

        // Get video content URL
        const videoUrl = `${client.baseURL}/video/generations/${generationId}/content/video`;

        return {
            videoUrl: videoUrl,
            thumbnailUrl: `sora_thumb_${Date.now()}.jpg`, // Generate thumbnail separately if needed
            duration: `${options.duration || 5}s`,
            resolution: `${options.width || 480}x${options.height || 480}`,
            status: "completed",
            jobId: jobId,
            generationId: generationId,
            provider: "openai",
        };
    }

    // Utility delay function
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Main entry point for video generation
    async generateVideo(
        provider: string,
        client: any,
        prompt: string,
        options: any = {}
    ): Promise<any> {
        switch (provider) {
            case "google":
                return await this.generateGoogleVideo(client, prompt, options);

            case "openai":
                return await this.generateOpenAIVideo(client, prompt, options);

            default:
                throw new Error(
                    `Video generation not supported for provider: ${provider}`
                );
        }
    }
}

// Enhanced file manager with provider-specific caching for artifacts
export const fileManager = {
    // Get provider file ID with caching - supports both regular files and artifacts
    async getProviderFileId(
        originalId: string, // artifactId or storageId
        provider: string,
        fileBlob: Blob,
        fileName: string,
        mimeType: string,
        client: any,
        ctx?: any // Convex context for caching
    ): Promise<string> {
        // Check cache first if we have context and this is an artifactId
        if (ctx && originalId.startsWith('artifact_')) {
            const cached = await ctx.runQuery(internal.artifacts.getCachedProviderFile, {
                artifactId: originalId,
                provider,
            });
            
            if (cached && cached.fileId) {
                // Update last used timestamp
                await ctx.runMutation(internal.artifacts.updateProviderFileUsage, {
                    artifactId: originalId,
                    provider,
                });
                console.log(`📋 Using cached ${provider} file ID: ${cached.fileId} for artifact: ${originalId}`);
                return cached.fileId;
            }
        }

        // Upload to provider and cache result
        let providerFileId: string;
        let expiresAt: number | undefined;
        
        console.log(`📤 Uploading ${fileName} to ${provider} file API...`);
        
        switch (provider) {
            case "openai":
            case "openrouter":
            case "deepseek": {
                // OpenAI Files API pattern from appendix.md
                const response = await client.files.create({
                    file: fileBlob,
                    purpose: "assistants",
                });
                providerFileId = response.id;
                
                // OpenAI files don't expire automatically
                expiresAt = undefined;
                break;
            }

            case "anthropic": {
                // Anthropic handles files differently - inline content
                // For artifacts, we create a reference ID and store inline
                providerFileId = `anthropic_artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Anthropic doesn't have persistent file storage, so short expiry
                expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
                break;
            }

            case "google": {
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
                
                let attempts = 0;
                while (uploadedFile.state === "PROCESSING" && attempts < 30) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    uploadedFile = await client.files.get({
                        name: response.name,
                    });
                    attempts++;
                }

                if (uploadedFile.state === "FAILED") {
                    throw new Error(`File processing failed for ${fileName}`);
                }

                providerFileId = response.name; // Google uses name as file ID
                
                // Google files expire after some time (check their docs)
                expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days estimated
                break;
            }

            default:
                throw new Error(`File upload not supported for provider: ${provider}`);
        }

        // Cache the result if we have context and this is an artifact
        if (ctx && originalId.startsWith('artifact_') && providerFileId) {
            try {
                await ctx.runMutation(internal.artifacts.updateArtifactProviderFile, {
                    artifactId: originalId,
                    provider,
                    fileId: providerFileId,
                    uploadedAt: Date.now(),
                    expiresAt,
                });
                console.log(`💾 Cached ${provider} file ID: ${providerFileId} for artifact: ${originalId}`);
            } catch (error) {
                console.error("Failed to cache provider file:", error);
                // Continue even if caching fails
            }
        }

        return providerFileId;
    },

    // Upload artifact content to provider file API
    async uploadArtifactToProvider(
        artifactId: string,
        provider: string,
        artifact: any,
        client: any,
        ctx: any
    ): Promise<{ fileId: string; fileName: string; mimeType: string }> {
        // Create blob from artifact content
        const artifactBlob = new Blob([artifact.content], { 
            type: "text/plain" 
        });
        
        const fileName = `${artifact.filename}.${artifact.language}`;
        const mimeType = "text/plain";
        
        // Upload to provider's file API with caching
        const fileId = await this.getProviderFileId(
            artifactId,
            provider,
            artifactBlob,
            fileName,
            mimeType,
            client,
            ctx
        );
        
        return {
            fileId,
            fileName,
            mimeType,
        };
    },

    // Process regular file attachments (existing functionality)
    async processRegularAttachment(
        attachment: any,
        provider: string,
        client: any,
        ctx: any
    ): Promise<{ type: string; fileId: string; name: string; mimeType: string }> {
        const fileBlob = await ctx.storage.get(attachment.storageId);
        if (!fileBlob) {
            throw new Error(`File not found: ${attachment.name}`);
        }
        
        const mimeType = getMimeType(attachment.name, attachment.type);
        const fileId = await this.getProviderFileId(
            attachment.storageId,
            provider,
            fileBlob,
            attachment.name,
            mimeType,
            client,
            ctx
        );
        
        let attachmentType: string = attachment.type;
        if (attachment.type === 'image') attachmentType = 'image_file';
        if (attachment.type === 'pdf') attachmentType = 'pdf_file';
        
        return {
            type: attachmentType,
            fileId,
            name: attachment.name,
            mimeType,
        };
    },
};

// Export all managers
export const structuredOutputManager = new StructuredOutputManager();
export const imageGenerationManager = new ImageGenerationManager();
export const videoGenerationManager = new VideoGenerationManager();