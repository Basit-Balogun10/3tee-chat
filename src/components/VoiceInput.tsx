import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface VoiceInputProps {
    onTranscription: (transcript: string) => void;
    isRecording: boolean;
    onRecordingChange: (recording: boolean) => void;
    sendMessage: (transcription?: string) => void;
}

// Extend Window interface for webkit audio context
declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

export function VoiceInput({
    onTranscription,
    isRecording,
    onRecordingChange,
    sendMessage,
}: VoiceInputProps) {
    const [isInitializing, setIsInitializing] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const microphoneRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Get user preferences for buzz word
    const preferences = useQuery(api.preferences.getUserPreferences);
    const buzzWord =
        preferences?.voiceSettings?.buzzWord?.toLowerCase().trim() || "";

    // Create microphone handler based on AssemblyAI example
    const createMicrophone = () => {
        let stream: MediaStream | null = null;
        let audioContext: AudioContext | null = null;
        let audioWorkletNode: AudioWorkletNode | null = null;
        let source: MediaStreamAudioSourceNode | null = null;
        let audioBufferQueue = new Int16Array(0);

        return {
            async requestPermission() {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: 16000,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                    });
                    streamRef.current = stream;

                    return stream;
                } catch (error) {
                    console.error(
                        "❌ Failed to get microphone permission:",
                        error
                    );
                    throw error;
                }
            },

            async startRecording(onAudioCallback: (data: Uint8Array) => void) {
                if (!stream) {
                    stream = await this.requestPermission();
                }

                try {
                    audioContext = new AudioContext({
                        sampleRate: 16000,
                        latencyHint: "interactive",
                    });
                    audioContextRef.current = audioContext;

                    // Resume context if suspended
                    if (audioContext.state === "suspended") {
                        await audioContext.resume();
                    }

                    // Wait for the audio context to be running
                    if (audioContext.state !== "running") {
                        await new Promise((resolve) => {
                            const checkState = () => {
                                if (audioContext!.state === "running") {
                                    resolve(void 0);
                                } else {
                                    setTimeout(checkState, 10);
                                }
                            };
                            checkState();
                        });
                    }

                    source = audioContext.createMediaStreamSource(stream);

                    // Fixed audio processor worklet code
                    const processorCode = `
                        const MAX_16BIT_INT = 32767;
                        
                        class AudioProcessor extends AudioWorkletProcessor {
                            constructor() {
                                super();
                                this.chunkCount = 0;
                            }
                            
                            process(inputs) {
                                try {
                                    const input = inputs[0];
                                    if (!input || input.length === 0) {
                                        return true;
                                    }
                                    
                                    const channelData = input[0];
                                    if (!channelData || channelData.length === 0) {
                                        return true;
                                    }
                                    
                                    // Fixed: Use Float32Array instead of typo "Floa3Tee2Array"
                                    const float32Array = Float32Array.from(channelData);
                                    const int16Array = Int16Array.from(
                                        float32Array.map((n) => Math.max(-1, Math.min(1, n)) * MAX_16BIT_INT)
                                    );
                                    
                                    this.chunkCount++;
                                    
                                    const buffer = int16Array.buffer;
                                    this.port.postMessage({ audio_data: buffer });
                                    
                                    return true;
                                } catch (error) {
                                    console.error('🚨 Audio processing error:', error);
                                    return false;
                                }
                            }
                        }
                        
                        registerProcessor('audio-processor', AudioProcessor);
                    `;

                    const blob = new Blob([processorCode], {
                        type: "application/javascript",
                    });
                    const workletUrl = URL.createObjectURL(blob);

                    try {
                        await audioContext.audioWorklet.addModule(workletUrl);
                        console.log(
                            "✅ Audio worklet module loaded successfully"
                        );

                        // Add a small delay to ensure the module is fully processed
                        await new Promise((resolve) =>
                            setTimeout(resolve, 100)
                        );
                    } catch (error) {
                        console.error(
                            "❌ Failed to add audio worklet module:",
                            error
                        );
                        throw error;
                    } finally {
                        URL.revokeObjectURL(workletUrl);
                    }

                    // Ensure audio context is still running before creating the node
                    if (audioContext.state !== "running") {
                        throw new Error("AudioContext is not in running state");
                    }

                    audioWorkletNode = new AudioWorkletNode(
                        audioContext,
                        "audio-processor"
                    );

                    console.log("✅ AudioWorkletNode created successfully");

                    source.connect(audioWorkletNode);
                    audioWorkletNode.connect(audioContext.destination);

                    audioWorkletNode.port.onmessage = (event) => {
                        try {
                            const currentBuffer = new Int16Array(
                                event.data.audio_data
                            );

                            audioBufferQueue = this.mergeBuffers(
                                audioBufferQueue,
                                currentBuffer
                            );

                            const bufferDuration =
                                (audioBufferQueue.length /
                                    audioContext!.sampleRate) *
                                1000;

                            if (bufferDuration >= 100) {
                                const totalSamples = Math.floor(
                                    audioContext!.sampleRate * 0.1
                                );
                                const finalBuffer = new Uint8Array(
                                    audioBufferQueue.subarray(
                                        0,
                                        totalSamples
                                    ).buffer
                                );
                                audioBufferQueue =
                                    audioBufferQueue.subarray(totalSamples);

                                if (onAudioCallback) {
                                    onAudioCallback(finalBuffer);
                                }
                            }
                        } catch (error) {
                            console.error(
                                "🚨 Error processing audio message:",
                                error
                            );
                        }
                    };

                    audioWorkletNode.port.onmessageerror = (error) => {
                        console.error(
                            "🚨 AudioWorkletNode message error:",
                            error
                        );
                    };
                } catch (error) {
                    console.error("🚨 Error in startRecording:", error);
                    // Clean up on error
                    if (audioWorkletNode) {
                        audioWorkletNode.disconnect();
                        audioWorkletNode = null;
                    }
                    if (source) {
                        source.disconnect();
                        source = null;
                    }
                    if (audioContext) {
                        void audioContext.close();
                        audioContext = null;
                        audioContextRef.current = null;
                    }
                    throw error;
                }
            },

            mergeBuffers(lhs: Int16Array, rhs: Int16Array): Int16Array {
                const merged = new Int16Array(lhs.length + rhs.length);
                merged.set(lhs, 0);
                merged.set(rhs, lhs.length);
                return merged;
            },

            stopRecording() {
                if (audioWorkletNode) {
                    audioWorkletNode.disconnect();
                    audioWorkletNode = null;
                }

                if (source) {
                    source.disconnect();
                    source = null;
                }

                if (stream) {
                    stream.getTracks().forEach((track) => {
                        track.stop();
                    });
                    stream = null;
                    streamRef.current = null;
                }

                if (audioContext) {
                    audioContext
                        .close()
                        .then(() => {
                            console.log("✅ AudioContext closed successfully");
                        })
                        .catch((error) => {
                            console.error(
                                "❌ Error closing AudioContext:",
                                error
                            );
                        });
                    audioContext = null;
                    audioContextRef.current = null;
                }

                audioBufferQueue = new Int16Array(0);
            },
        };
    };

    let finalTranscript = "";

    const checkForBuzzWord = (transcript: string) => {
        if (!buzzWord) return false;

        const lowerTranscript = transcript.toLowerCase();

        // Check if the buzzword appears as a substring in the transcript
        const found = lowerTranscript.includes(buzzWord);

        return found;
    };

    const stopRecording = useCallback(
        (isCleanup: boolean = false) => {
            setIsInitializing(false);
            onRecordingChange(false);

            // Close WebSocket
            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "Terminate" }));
                }
                wsRef.current.close();
                wsRef.current = null;
            }

            // Stop microphone
            if (microphoneRef.current) {
                microphoneRef.current.stopRecording();
                microphoneRef.current = null;
            }

            // Clean up audio context and stream
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }

            if (!isCleanup) {
                toast.success("🎤 Voice recording stopped");
            }
        },
        [onRecordingChange]
    );

    const startRecording = useCallback(async () => {
        try {
            setIsInitializing(true);
            toast.success("🎤 Starting voice recording...");

            // Check browser support
            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {
                throw new Error("getUserMedia not supported in this browser");
            }

            if (!window.AudioContext && !window.webkitAudioContext) {
                throw new Error("Web Audio API not supported in this browser");
            }

            // Create microphone
            const microphone = createMicrophone();
            microphoneRef.current = microphone;

            // Request permission
            await microphone.requestPermission();

            // Get token from our Convex backend
            const convexUrl = import.meta.env.VITE_CONVEX_ACTIONS_URL;
            const tokenUrl = `${convexUrl}/api/assemblyai-token`;

            const tokenResponse = await fetch(tokenUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error("🚨 Token fetch failed:", {
                    status: tokenResponse.status,
                    statusText: tokenResponse.statusText,
                    body: errorText,
                });
                throw new Error(
                    `Failed to get authentication token: ${tokenResponse.status} - ${errorText}`
                );
            }

            const tokenData = await tokenResponse.json();

            if (tokenData.error || !tokenData.token) {
                console.error("🚨 Token response error:", tokenData);
                throw new Error(tokenData.error || "No token received");
            }

            // Connect to AssemblyAI WebSocket
            const endpoint = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&formatted_finals=true&token=${tokenData.token}`;

            const ws = new WebSocket(endpoint);
            wsRef.current = ws;

            const turns: Record<number, string> = {};

            ws.onopen = () => {
                console.log(
                    "🌐 WebSocket connected to AssemblyAI successfully!"
                );
                const buzzMessage = buzzWord
                    ? `🎤 Listening... Say "${buzzWord}" to send automatically!`
                    : "🎤 Listening... Speak now!";
                toast.success(buzzMessage);

                onRecordingChange(true);
                setIsInitializing(false);

                // Start recording and sending audio
                microphone.startRecording((audioChunk: Uint8Array) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(audioChunk);
                    } else {
                        console.warn(
                            "⚠️ WebSocket not open, cannot send audio. State:",
                            ws.readyState
                        );
                    }
                });
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.type === "Turn") {
                        const { turn_order, transcript } = msg;
                        if (transcript && transcript.trim()) {
                            turns[turn_order] = transcript;

                            // Combine all turns in order for real-time streaming display
                            const currentTranscript = Object.keys(turns)
                                .sort((a, b) => Number(a) - Number(b))
                                .map((k) => turns[Number(k)])
                                .join(" ");

                            console.log(
                                "📝 Current full transcript:",
                                currentTranscript
                            );

                            // Send real-time updates to message input for streaming effect
                            if (currentTranscript.trim()) {
                                onTranscription(currentTranscript);
                            }

                            // Check for buzz word to auto-send
                            if (
                                buzzWord &&
                                checkForBuzzWord(currentTranscript)
                            ) {
                                console.log(
                                    `🎯 Buzz word "${buzzWord}" detected! Auto-sending message...`
                                );
                                toast.success(
                                    `🎯 "${buzzWord}" detected! Sending message...`
                                );

                                // Remove the buzz word from the transcript before sending
                                const cleanTranscript = currentTranscript
                                    .toLowerCase()
                                    .split(/\s+/)
                                    .filter((word) => word !== buzzWord)
                                    .join(" ")
                                    .trim();

                                console.log(
                                    "🧹 Clean transcript (without buzz word):",
                                    cleanTranscript
                                );

                                // Update the final transcript and stop recording
                                onTranscription(cleanTranscript);
                                setTimeout(() => {
                                    stopRecording();

                                    console.log('sending message: ', cleanTranscript)
                                    sendMessage(cleanTranscript);
                                }, 1000); // Small delay to ensure transcript is updated
                                return;
                            }

                            // Store for final cleanup
                            finalTranscript = currentTranscript;
                        }
                    }
                } catch (parseError) {
                    console.error(
                        "🚨 Failed to parse WebSocket message:",
                        parseError
                    );
                }

                // Store the websocket's final transcript reference
                (ws as any).finalTranscript = finalTranscript;
            };

            ws.onerror = (error) => {
                console.error("🚨 WebSocket error:", error);
                console.error("🚨 WebSocket details:", {
                    readyState: ws.readyState,
                    url: ws.url,
                    protocol: ws.protocol,
                });
                toast.error("🚨 Voice recognition error");
                stopRecording();
            };

            ws.onclose = (event) => {
                console.log("🔌 WebSocket connection closed:", {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean,
                });
                if (event.code !== 1000) {
                    // 1000 is normal closure
                    console.warn("⚠️ WebSocket closed abnormally");
                    toast.error("🔌 Voice connection lost");
                }
                stopRecording();
            };
        } catch (error) {
            console.error("🚨 Voice recording setup error:", error);
            toast.error(
                `🚨 Voice recording failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            stopRecording();
        }
    }, [stopRecording, onRecordingChange, onTranscription, buzzWord]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            stopRecording(true);
        };
    }, [stopRecording]);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            void startRecording();
        }
    }, [isRecording, stopRecording]);

    useEffect(() => {
        document.addEventListener("toggleVoiceRecording", toggleRecording);

        return () => {
            document.removeEventListener(
                "toggleVoiceRecording",
                toggleRecording
            );
        };
    }, [toggleRecording]);

    const getButtonIcon = () => {
        if (isInitializing) {
            return (
                <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
            );
        }
        if (isRecording) {
            return <Square className="w-4 h-4" />;
        }
        return <Mic className="w-4 h-4" />;
    };

    const getButtonTitle = () => {
        if (isInitializing) return "Setting up voice recording...";
        if (isRecording) return "Stop voice recording";
        const buzzMessage = buzzWord ? ` (say "${buzzWord}" to auto-send)` : "";
        return `Start voice recording${buzzMessage}`;
    };

    return (
        <Button
            type="button"
            onClick={toggleRecording}
            disabled={isInitializing}
            size="sm"
            variant="ghost"
            className={`h-8 ${isInitializing ? "w-auto px-3 gap-1" : "w-8 p-0"} ${
                isRecording
                    ? "text-red-400 bg-red-600/20 hover:bg-red-600/30"
                    : "text-purple-400 bg-purple-600/20 hover:bg-purple-600/30"
            } ${isInitializing ? "opacity-50 cursor-not-allowed" : ""}`}
            title={getButtonTitle()}
        >
            {getButtonIcon()}
            {isInitializing && (
                <span className="ml-2 text-xs font-medium">
                    Initializing...
                </span>
            )}
        </Button>
    );
}
