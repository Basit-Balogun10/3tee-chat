import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Mic, MicOff, Square } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface VoiceInputProps {
    onTranscription: (transcript: string) => void;
    isRecording: boolean;
    onRecordingChange: (recording: boolean) => void;
}

export function VoiceInput({
    onTranscription,
    isRecording,
    onRecordingChange,
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
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                streamRef.current = stream;
                return stream;
            },

            async startRecording(onAudioCallback: (data: Uint8Array) => void) {
                if (!stream) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                    });
                    streamRef.current = stream;
                }

                audioContext = new AudioContext({
                    sampleRate: 16000,
                    latencyHint: "balanced",
                });
                audioContextRef.current = audioContext;

                source = audioContext.createMediaStreamSource(stream);

                // Create audio processor worklet inline (since we can't add external files easily)
                const processorCode = `
                    const MAX_16BIT_INT = 32767;
                    
                    class AudioProcessor extends AudioWorkletProcessor {
                        process(inputs) {
                            try {
                                const input = inputs[0];
                                if (!input) return true;
                                
                                const channelData = input[0];
                                if (!channelData) return true;
                                
                                const floa3Tee2Array = Floa3Tee2Array.from(channelData);
                                const int16Array = Int16Array.from(
                                    floa3Tee2Array.map((n) => n * MAX_16BIT_INT)
                                );
                                const buffer = int16Array.buffer;
                                this.port.postMessage({ audio_data: buffer });
                                
                                return true;
                            } catch (error) {
                                console.error('🎤 Audio processing error:', error);
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

                await audioContext.audioWorklet.addModule(workletUrl);
                URL.revokeObjectURL(workletUrl);

                audioWorkletNode = new AudioWorkletNode(
                    audioContext,
                    "audio-processor"
                );
                source.connect(audioWorkletNode);
                audioWorkletNode.connect(audioContext.destination);

                audioWorkletNode.port.onmessage = (event) => {
                    const currentBuffer = new Int16Array(event.data.audio_data);
                    audioBufferQueue = this.mergeBuffers(
                        audioBufferQueue,
                        currentBuffer
                    );

                    const bufferDuration =
                        (audioBufferQueue.length / audioContext!.sampleRate) *
                        1000;

                    if (bufferDuration >= 100) {
                        const totalSamples = Math.floor(
                            audioContext!.sampleRate * 0.1
                        );
                        const finalBuffer = new Uint8Array(
                            audioBufferQueue.subarray(0, totalSamples).buffer
                        );
                        audioBufferQueue =
                            audioBufferQueue.subarray(totalSamples);

                        if (onAudioCallback) onAudioCallback(finalBuffer);
                    }
                };
            },

            mergeBuffers(lhs: Int16Array, rhs: Int16Array): Int16Array {
                const merged = new Int16Array(lhs.length + rhs.length);
                merged.set(lhs, 0);
                merged.set(rhs, lhs.length);
                return merged;
            },

            stopRecording() {
                if (stream) {
                    stream.getTracks().forEach((track) => track.stop());
                    stream = null;
                    streamRef.current = null;
                }
                if (audioContext) {
                    audioContext.close();
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
        const words = lowerTranscript.split(/\s+/);

        // Check if buzz word appears as a complete word (not part of another word)
        return words.includes(buzzWord);
    };

    const startRecording = async () => {
        try {
            setIsInitializing(true);
            toast.success("🎤 Starting voice recording...");

            // Create microphone
            const microphone = createMicrophone();
            microphoneRef.current = microphone;

            // Request permission
            await microphone.requestPermission();

            // Get token from our Convex backend
            const convexUrl = import.meta.env.VITE_CONVEX_ACTIONS_URL;
            const tokenUrl = `${convexUrl}/api/assemblyai-token`;

            console.log("🔑 Fetching token from:", tokenUrl);

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
                console.log("🌐 WebSocket connected to AssemblyAI!");
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
                    }
                });
            };

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);

                if (msg.type === "Turn") {
                    const { turn_order, transcript } = msg;

                    if (transcript && transcript.trim()) {
                        turns[turn_order] = transcript;

                        // Combine all turns in order for real-time streaming display
                        const currentTranscript = Object.keys(turns)
                            .sort((a, b) => Number(a) - Number(b))
                            .map((k) => turns[k])
                            .join(" ");

                        console.log("📝 Transcription:", transcript);

                        // Send real-time updates to message input for streaming effect
                        if (currentTranscript.trim()) {
                            onTranscription(currentTranscript);
                        }

                        // Check for buzz word to auto-send
                        if (buzzWord && checkForBuzzWord(currentTranscript)) {
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

                            // Update the final transcript and stop recording
                            onTranscription(cleanTranscript);
                            setTimeout(() => {
                                stopRecording();
                                // Trigger send message event
                                const sendEvent = new CustomEvent(
                                    "autoSendMessage"
                                );
                                document.dispatchEvent(sendEvent);
                            }, 500); // Small delay to ensure transcript is updated
                            return;
                        }

                        // Store for final cleanup
                        finalTranscript = currentTranscript;
                    }
                }

                // Store the websocket's final transcript reference
                (ws as any).finalTranscript = finalTranscript;
            };

            ws.onerror = (error) => {
                console.error("🚨 WebSocket error:", error);
                toast.error("🚨 Voice recognition error");
                stopRecording();
            };

            ws.onclose = (event) => {
                console.log(
                    "🔌 WebSocket connection closed:",
                    event.code,
                    event.reason
                );
                if (event.code !== 1000) {
                    // 1000 is normal closure
                    toast.error("🔌 Voice connection lost");
                }
                stopRecording();
            };
        } catch (error) {
            console.error("🚨 Voice recording error:", error);
            toast.error(
                `🚨 Voice recording failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            stopRecording();
        }
    };

    const stopRecording = (isCleanup: boolean = false) => {
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
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (!isCleanup) {
            toast.success("🎤 Voice recording stopped");
        }
    };

    const handleToggleRecording = async () => {
        if (isRecording || isInitializing) {
            stopRecording();
        } else {
            await startRecording();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecording(true);
        };
    }, []);

    useEffect(() => {
        document.addEventListener(
            "toggleVoiceRecording",
            handleToggleRecording
        );
        return () =>
            document.removeEventListener(
                "toggleVoiceRecording",
                handleToggleRecording
            );
    }, []);

    const getButtonState = () => {
        if (isInitializing) {
            return {
                icon: (
                    <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                ),
                className:
                    "bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300",
                title: "Initializing voice recording...",
            };
        }

        if (isRecording) {
            return {
                icon: <Square className="w-4 h-4" />,
                className:
                    "bg-red-600/20 hover:bg-red-600/30 text-red-300 animate-pulse",
                title: "Stop recording (voice is active)",
            };
        }

        return {
            icon: <Mic className="w-4 h-4" />,
            className: "text-purple-400 hover:bg-purple-600/20",
            title: "Start voice recording",
        };
    };

    const buttonState = getButtonState();

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleRecording}
            disabled={isInitializing}
            className={`h-8 w-8 p-0 transition-all duration-200 ${buttonState.className}`}
            title={buttonState.title}
        >
            {buttonState.icon}
        </Button>
    );
}
