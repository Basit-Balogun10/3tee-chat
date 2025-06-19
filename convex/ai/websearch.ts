// Enhanced web search with provider-specific implementations and real citations
export async function performProviderWebSearch(
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
