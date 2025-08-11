import { auth } from "./auth";
import router from "./router";
import { httpAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// =============================================================================
// AI SDK MIGRATION - PHASE 3: SSE API Endpoints
// =============================================================================

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import {
    buildModelMessages,
    getChatMessagesForAI,
    convertUIMessageToRawParts,
} from "./aiSdkHelpers";

const http = router;

auth.addHttpRoutes(http);

// Generate temporary token for AssemblyAI real-time transcription
http.route({
    path: "/api/assemblyai-token",
    method: "GET",
    handler: httpAction(async (_ctx) => {
        const apiKey = process.env.ASSEMBLYAI_API_KEY;

        // CORS headers for all responses
        const corsHeaders = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (!apiKey) {
            return new Response(
                JSON.stringify({
                    error: "AssemblyAI API key not configured",
                }),
                {
                    status: 500,
                    headers: corsHeaders,
                }
            );
        }

        try {
            // Generate temporary token with 5 minutes expiry
            const response = await fetch(
                "https://streaming.assemblyai.com/v3/token?expires_in_seconds=300",
                {
                    method: "GET",
                    headers: {
                        Authorization: apiKey,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`AssemblyAI API error: ${response.status}`);
            }

            const data = await response.json();

            return new Response(
                JSON.stringify({
                    token: data.token,
                    expires_in: 300,
                }),
                {
                    status: 200,
                    headers: corsHeaders,
                }
            );
        } catch (error) {
            console.error("❌ Failed to generate AssemblyAI token:", error);

            return new Response(
                JSON.stringify({
                    error: "Failed to generate temporary token",
                    details:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                }),
                {
                    status: 500,
                    headers: corsHeaders,
                }
            );
        }
    }),
});

// Handle CORS preflight requests
http.route({
    path: "/api/assemblyai-token",
    method: "OPTIONS",
    handler: httpAction(async (_ctx) => {
        return new Response(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }),
});

// OpenAI Realtime API ephemeral key generation (per appendix.md)
export const openaiRealtimeEphemeralKey = httpAction(async (ctx, request) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
        return new Response("Not authenticated", { status: 401 });
    }

    try {
        const identity = await ctx.auth.getUserIdentity();

        if (!identity) {
            return new Response("Invalid token", { status: 401 });
        }

        //   const userId = identity.subject;
        const preferences = (await ctx.runQuery(
            internal.preferences.getUserPreferencesInternal,
            { userId: userId as any }
        )) as any;

        const userOpenAIKey = preferences?.apiKeys?.openai;
        const useOurKeys = !userOpenAIKey;

        let ephemeralKey;
        let endpoint;

        if (useOurKeys) {
            // Use our Azure OpenAI for ephemeral key generation
            const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
            const azureApiKey = process.env.AZURE_OPENAI_API_KEY;

            if (!azureEndpoint || !azureApiKey) {
                throw new Error("Azure OpenAI credentials not configured");
            }

            // Generate ephemeral key using Azure OpenAI sessions endpoint per appendix.md
            const sessionsUrl = `${azureEndpoint}/openai/realtimeapi/sessions?api-version=2025-04-01-preview`;

            const response = await fetch(sessionsUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": azureApiKey,
                },
                body: JSON.stringify({
                    model: "gpt-4o-realtime-preview", // or deployment name
                    modalities: ["text", "audio"],
                    instructions:
                        "You are a helpful AI assistant responding in natural, engaging language.",
                    voice: "aoede",
                    input_audio_format: "pcm16",
                    output_audio_format: "pcm16",
                    turn_detection: {
                        type: "server_vad",
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 200,
                        create_response: true,
                        interrupt_response: true,
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Azure OpenAI sessions error:", {
                    status: response.status,
                    body: errorText,
                });
                throw new Error(`Failed to create session: ${response.status}`);
            }

            const sessionData = await response.json();
            ephemeralKey = sessionData.client_secret?.value;

            // Determine region-specific WebRTC endpoint per appendix.md
            const azureRegion = process.env.AZURE_OPENAI_REGION || "eastus2";
            endpoint = `https://${azureRegion}.realtimeapi-preview.ai.azure.com/v1/realtimertc`;
        } else {
            // Use user's OpenAI API key to generate ephemeral key
            const openaiResponse = await fetch(
                "https://api.openai.com/v1/realtime/sessions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${userOpenAIKey}`,
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-realtime-preview-2024-10-01",
                        modalities: ["text", "audio"],
                        instructions:
                            "You are a helpful AI assistant responding in natural, engaging language.",
                        voice: "aoede",
                        input_audio_format: "pcm16",
                        output_audio_format: "pcm16",
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 200,
                            create_response: true,
                            interrupt_response: true,
                        },
                    }),
                }
            );

            if (!openaiResponse.ok) {
                const errorText = await openaiResponse.text();
                console.error("OpenAI sessions error:", {
                    status: openaiResponse.status,
                    body: errorText,
                });
                throw new Error(
                    `Failed to create OpenAI session: ${openaiResponse.status}`
                );
            }

            const sessionData = await openaiResponse.json();
            ephemeralKey = sessionData.client_secret?.value;
            endpoint = "https://api.openai.com/v1/realtimertc"; // OpenAI WebRTC endpoint
        }

        if (!ephemeralKey) {
            throw new Error("No ephemeral key received from provider");
        }

        // Return ephemeral key and WebRTC endpoint per appendix.md
        return new Response(
            JSON.stringify({
                ephemeral_key: ephemeralKey,
                webrtc_endpoint: endpoint,
                expires_at: Date.now() + 60000, // 1 minute expiry
                provider: useOurKeys ? "azure" : "openai",
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers":
                        "Content-Type, Authorization",
                },
            }
        );
    } catch (error) {
        console.error("Ephemeral key generation error:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to generate ephemeral key",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
});

// Google Gemini Live ephemeral key generation
export const geminiLiveEphemeralKey = httpAction(async (ctx, _request) => {
    try {
        const userId = await getAuthUserId(ctx);
        console.log("userId: ", userId);

        if (!userId) {
            return new Response(
                JSON.stringify({
                    error: "Authentication required",
                }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Call the Node.js action to generate the key
        // const result = await ctx.runAction(
        //     internal.geminiActions.generateGeminiLiveKey,
        //     {
        //         userId,
        //     }
        // );
        const result = {};

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    } catch (error) {
        console.error("Gemini Live key generation error:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to get Gemini Live credentials",
                details: error instanceof Error ? error.stack : undefined,
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
});

// OpenAI Realtime API ephemeral key endpoint
http.route({
    path: "/api/openai-realtime-key",
    method: "GET",
    handler: openaiRealtimeEphemeralKey,
});

http.route({
    path: "/api/openai-realtime-key",
    method: "OPTIONS",
    handler: httpAction(async (_ctx) => {
        return new Response(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

// Google Gemini Live key endpoint
http.route({
    path: "/api/gemini-live-key",
    method: "GET",
    handler: geminiLiveEphemeralKey,
});

http.route({
    path: "/api/gemini-live-key",
    method: "OPTIONS",
    handler: httpAction(async (_ctx) => {
        return new Response(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

// Single AI chat endpoint - lightweight entry point
http.route({
    path: "/api/chat",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        try {
            const body = await req.json();
            const {
                chatId,
                model = "gemini-2.0-flash",
                attachments = [],
                commands = [],
                referencedLibraryItems = [],
            } = body;

            const messages = body.messages || [];
            const lastMessage = messages[messages.length - 1];

            if (!lastMessage || lastMessage.role !== "user") {
                throw new Error("Last message must be from user");
            }

            // Add user message first
            await ctx.runMutation(internal.messages.addMessage, {
                chatId,
                role: "user",
                content: lastMessage.content,
                attachments,
                commands,
                referencedLibraryItems,
            });

            // Generate streaming response using existing AI generation workflow
            const result = await ctx.runAction(
                internal.ai.generateStreamingResponse,
                {
                    chatId,
                    model,
                    attachments,
                    commands,
                    referencedLibraryItems,
                }
            );

            return result;
        } catch (error) {
            console.error("Error in chat endpoint:", error);
            return new Response(
                JSON.stringify({ error: "Internal server error" }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

// Multi-AI chat endpoint - lightweight entry point
http.route({
    path: "/api/multi-chat",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        try {
            const body = await req.json();
            const {
                chatId,
                models = ["gemini-2.0-flash", "gpt-4o"],
                attachments = [],
                commands = [],
                referencedLibraryItems = [],
            } = body;

            const messages = body.messages || [];
            const lastMessage = messages[messages.length - 1];

            if (!lastMessage || lastMessage.role !== "user") {
                throw new Error("Last message must be from user");
            }

            // Add user message first
            await ctx.runMutation(internal.messages.addMessage, {
                chatId,
                role: "user",
                content: lastMessage.content,
                attachments,
                commands,
                referencedLibraryItems,
            });

            // Generate multi-AI responses using existing workflow
            const result = await ctx.runAction(
                internal.ai.generateMultiAIResponse,
                {
                    chatId,
                    models,
                    attachments,
                    commands,
                    referencedLibraryItems,
                }
            );

            return result;
        } catch (error) {
            console.error("Error in multi-chat endpoint:", error);
            return new Response(
                JSON.stringify({ error: "Internal server error" }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

// CORS preflight handlers for new endpoints
http.route({
    path: "/api/chat",
    method: "OPTIONS",
    handler: httpAction(async (_ctx) => {
        return new Response(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

http.route({
    path: "/api/multi-chat",
    method: "OPTIONS",
    handler: httpAction(async (_ctx) => {
        return new Response(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

export default http;
