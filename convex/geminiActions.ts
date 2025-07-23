import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { internal } from "./_generated/api";

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
