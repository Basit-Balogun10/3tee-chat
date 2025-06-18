import { auth } from "./auth";
import router from "./router";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = router;

auth.addHttpRoutes(http);

// Generate temporary token for AssemblyAI real-time transcription
http.route({
    path: "/api/assemblyai-token",
    method: "GET",
    handler: httpAction(async (ctx) => {
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
    handler: httpAction(async (ctx) => {
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

export default http;
