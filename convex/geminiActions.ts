import { v } from "convex/values";
import { internalQuery, httpAction } from "./_generated/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { internal } from "./_generated/api";
import { ai } from "./ai/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export const generateGeminiLiveKey = internalQuery({
    args: {
        userId: v.string(),
    },
    handler: async (ctx, { userId }) => {
        try {
            const preferences = (await ctx.runQuery(
                internal.preferences.getUserPreferencesInternal,
                { userId: userId as any }
            )) as any;

            const apiKey = preferences?.apiKeys?.gemini as string;
            const isGeminiEnabled = preferences?.apiKeyPreferences?.gemini;

            // Check if user has provided their Gemini API key and enabled it
            if (!apiKey) {
                throw new Error(
                    "Gemini API key is required for Live Chat. Please add your API key in settings."
                );
            }

            if (!isGeminiEnabled) {
                throw new Error(
                    "Gemini API key is disabled. Please enable it in API key preferences."
                );
            }

            console.log("Using user Gemini API key for Live Chat");

            // Use user's Google/Gemini key - GoogleGenAI client
            const client = new (GoogleGenAI as any)({
                vertexai: false,
                apiKey,
            });

            const expireTime = new Date(
                Date.now() + 30 * 60 * 1000
            ).toISOString();

            console.log("Creating Gemini Live auth token with config:", {
                expireTime,
                model: "models/gemini-2.0-flash-exp",
            });

            const token = await client.authTokens.create({
                config: {
                    uses: 1, // The default
                    expireTime: expireTime,
                    liveConnectConstraints: {
                        model: "models/gemini-2.0-flash-exp",
                        config: {
                            sessionResumption: {},
                            temperature: 0.7,
                            responseModalities: [Modality.AUDIO],
                        },
                    },
                    httpOptions: {
                        apiVersion: "v1alpha",
                    },
                },
            });

            console.log("Successfully created Gemini Live token:", token.name);

            return {
                ephemeral_key: token.name,
                webrtc_endpoint: `https://generativelanguage.googleapis.com/v1alpha/models/models/gemini-2.0-flash-exp:generateContent`,
                expires_at: Date.now() + 30 * 60 * 1000, // 30 minutes
                provider: "gemini",
            };
        } catch (error) {
            console.error("Gemini Live key generation error:", error);
            throw new Error(
                error instanceof Error
                    ? error.message
                    : "Failed to get Gemini Live credentials"
            );
        }
    },
}) as any;

export const generateGeminiResponse = httpAction(async (ctx, request) => {
    try {
        const { chatId, userMessage } = await request.json();

        if (!chatId || !userMessage) {
            return new Response("Missing required parameters", { status: 400 });
        }

        console.log("🔮 GEMINI ACTION: Starting generation", {
            chatId,
            userMessage: userMessage.substring(0, 100) + "...",
            timestamp: new Date().toISOString(),
        });

        // Add user message first
        const userMessageId = await ctx.runMutation(
            internal.messages.addMessage,
            {
                chatId,
                role: "user" as const,
                content: userMessage,
            }
        );

        // Create placeholder assistant message
        const assistantMessageId = await ctx.runMutation(
            internal.messages.addMessage,
            {
                chatId,
                role: "assistant" as const,
                content: "",
                isStreaming: true,
            }
        );

        // Get chat history for context
        const history: Array<{ role: "user" | "assistant"; content: string }> =
            await ctx.runQuery(internal.aiHelpers.getChatHistory, {
                chatId,
                excludeMessageId: assistantMessageId,
            });

        // Stream the response
        const result = await streamText({
            model: ai.languageModel,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful AI assistant.",
                },
                ...history,
                {
                    role: "user",
                    content: userMessage,
                },
            ],
            onFinish: async (result) => {
                // Update the message with final content
                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: assistantMessageId,
                    content: result.text,
                    isStreaming: false,
                });
            },
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error("❌ GEMINI ACTION ERROR:", error);
        return new Response("Internal server error", { status: 500 });
    }
});

export const generateStreamingResponse = httpAction(async (ctx, request) => {
    try {
        const { chatId, messageId, userMessage, modelSettings } =
            await request.json();

        console.log("🌊 STREAMING ACTION: Starting generation", {
            chatId,
            messageId,
            userMessage: userMessage?.substring(0, 100) + "...",
            modelSettings,
            timestamp: new Date().toISOString(),
        });

        // Get message if provided
        let targetMessageId = messageId;
        if (!targetMessageId) {
            // Create new assistant message
            targetMessageId = await ctx.runMutation(
                internal.messages.addMessage,
                {
                    chatId,
                    role: "assistant" as const,
                    content: "",
                    isStreaming: true,
                }
            );
        }

        // Get chat history
        const history: Array<{ role: "user" | "assistant"; content: string }> =
            await ctx.runQuery(internal.aiHelpers.getChatHistory, {
                chatId,
                excludeMessageId: targetMessageId,
            });

        // Determine the model to use
        let model;
        if (modelSettings?.provider === "anthropic") {
            const anthropic = createAnthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
            model = anthropic(
                modelSettings.model || "claude-3-5-sonnet-20241022"
            );
        } else if (modelSettings?.provider === "openai") {
            const openai = createOpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
            model = openai(modelSettings.model || "gpt-4o");
        } else {
            // Default to AI config
            model = ai.languageModel;
        }

        const messages = [...history];
        if (userMessage) {
            messages.push({ role: "user", content: userMessage });
        }

        const result = await streamText({
            model,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful AI assistant.",
                },
                ...messages,
            ],
            onFinish: async (result) => {
                await ctx.runMutation(internal.aiHelpers.updateMessageContent, {
                    messageId: targetMessageId,
                    content: result.text,
                    isStreaming: false,
                });
            },
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error("❌ STREAMING ACTION ERROR:", error);
        return new Response("Internal server error", { status: 500 });
    }
});
