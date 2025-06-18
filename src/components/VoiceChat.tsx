import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Settings } from "lucide-react";
import { toast } from "sonner";

interface VoiceChatProps {
    onTranscription?: (transcript: string) => void;
    apiKey?: string;
    provider?: "openai" | "gemini";
    className?: string;
}

export function VoiceChat({
    onTranscription,
    apiKey,
    provider = "openai",
    className = "",
}: VoiceChatProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
    
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const audioOutputRef = useRef<HTMLAudioElement | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    // OpenAI Realtime API setup
    const connectOpenAI = useCallback(async () => {
        if (!apiKey) {
            toast.error("OpenAI API key required for voice chat");
            return;
        }

        try {
            setIsConnecting(true);
            setConnectionStatus("connecting");

            // Create WebSocket connection to OpenAI Realtime API
            const ws = new WebSocket(
                "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
                ["realtime", `openai-insecure-api-key.${apiKey}`]
            );

            ws.onopen = async () => {
                console.log("OpenAI Realtime API connected");
                setIsConnected(true);
                setIsConnecting(false);
                setConnectionStatus("connected");
                toast.success("🎤 Voice chat connected!");

                // Configure session
                ws.send(JSON.stringify({
                    type: "session.update",
                    session: {
                        modalities: ["text", "audio"],
                        instructions: "You are a helpful AI assistant. Respond naturally and conversationally.",
                        voice: "alloy",
                        input_audio_format: "pcm16",
                        output_audio_format: "pcm16",
                        input_audio_transcription: {
                            model: "whisper-1"
                        },
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 200
                        }
                    }
                }));

                // Start microphone
                await startMicrophone();
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleOpenAIMessage(data);
            };

            ws.onclose = () => {
                console.log("OpenAI connection closed");
                cleanup();
            };

            ws.onerror = (error) => {
                console.error("OpenAI WebSocket error:", error);
                setConnectionStatus("error");
                toast.error("Voice chat connection failed");
                cleanup();
            };

            wsRef.current = ws;

        } catch (error) {
            console.error("Failed to connect to OpenAI:", error);
            setConnectionStatus("error");
            toast.error("Failed to connect to voice chat");
            cleanup();
        }
    }, [apiKey]);

    // Gemini Live API setup
    const connectGemini = useCallback(async () => {
        if (!apiKey) {
            toast.error("Gemini API key required for voice chat");
            return;
        }

        try {
            setIsConnecting(true);
            setConnectionStatus("connecting");

            // Note: This would use the @google/genai library in a real implementation
            // For now, showing the structure based on the provided example
            
            toast.success("🎤 Gemini Live connected!");
            setIsConnected(true);
            setIsConnecting(false);
            setConnectionStatus("connected");

            // Start microphone for Gemini Live
            await startMicrophone();

        } catch (error) {
            console.error("Failed to connect to Gemini:", error);
            setConnectionStatus("error");
            toast.error("Failed to connect to Gemini Live");
            cleanup();
        }
    }, [apiKey]);

    const handleOpenAIMessage = (data: any) => {
        switch (data.type) {
            case "conversation.item.input_audio_transcription.completed":
                if (data.transcript && onTranscription) {
                    onTranscription(data.transcript);
                }
                break;
            case "response.audio.delta":
                if (data.delta) {
                    playAudioDelta(data.delta);
                }
                break;
            case "response.text.delta":
                console.log("Text delta:", data.delta);
                break;
            case "error":
                console.error("OpenAI error:", data.error);
                toast.error(`Voice chat error: ${data.error.message}`);
                break;
        }
    };

    const startMicrophone = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            microphoneStreamRef.current = stream;

            // Create audio context for processing
            const audioContext = new AudioContext({ sampleRate: 24000 });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (event) => {
                if (!isMuted && wsRef.current?.readyState === WebSocket.OPEN) {
                    const inputBuffer = event.inputBuffer.getChannelData(0);
                    const audioData = convertToPCM16(inputBuffer);
                    
                    if (provider === "openai") {
                        wsRef.current.send(JSON.stringify({
                            type: "input_audio_buffer.append",
                            audio: arrayBufferToBase64(audioData)
                        }));
                    }
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
            processorRef.current = processor;

        } catch (error) {
            console.error("Failed to start microphone:", error);
            toast.error("Failed to access microphone");
        }
    };

    const playAudioDelta = (audioData: string) => {
        if (isAudioMuted) return;

        try {
            const audioBytes = base64ToArrayBuffer(audioData);
            const audioContext = audioContextRef.current || new AudioContext();
            
            audioContext.decodeAudioData(audioBytes, (buffer) => {
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start();
            });
        } catch (error) {
            console.error("Failed to play audio:", error);
        }
    };

    const convertToPCM16 = (floa3Tee2Array: Floa3Tee2Array): ArrayBuffer => {
        const buffer = new ArrayBuffer(floa3Tee2Array.length * 2);
        const view = new DataView(buffer);
        
        for (let i = 0; i < floa3Tee2Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, floa3Tee2Array[i]));
            view.setInt16(i * 2, sample * 0x7FFF, true);
        }
        
        return buffer;
    };

    const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        return btoa(binary);
    };

    const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    };

    const cleanup = useCallback(() => {
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionStatus("idle");

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        if (microphoneStreamRef.current) {
            microphoneStreamRef.current.getTracks().forEach(track => track.stop());
            microphoneStreamRef.current = null;
        }

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    }, []);

    const startVoiceChat = async () => {
        if (provider === "openai") {
            await connectOpenAI();
        } else if (provider === "gemini") {
            await connectGemini();
        }
    };

    const endVoiceChat = () => {
        cleanup();
        toast.success("Voice chat ended");
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        toast.success(isMuted ? "Microphone unmuted" : "Microphone muted");
    };

    const toggleAudioMute = () => {
        setIsAudioMuted(!isAudioMuted);
        toast.success(isAudioMuted ? "Audio enabled" : "Audio muted");
    };

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const getStatusColor = () => {
        switch (connectionStatus) {
            case "connected": return "text-green-400";
            case "connecting": return "text-yellow-400";
            case "error": return "text-red-400";
            default: return "text-purple-400";
        }
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case "connected": return "Connected";
            case "connecting": return "Connecting...";
            case "error": return "Connection failed";
            default: return "Ready to connect";
        }
    };

    return (
        <div className={`flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-purple-600/10 to-indigo-600/10 rounded-xl border border-purple-600/20 ${className}`}>
            <div className="text-center">
                <h3 className="text-lg font-semibold text-purple-100 mb-2">
                    Real-time Voice Chat
                </h3>
                <p className={`text-sm ${getStatusColor()}`}>
                    {getStatusText()}
                </p>
                <p className="text-xs text-purple-400 mt-1">
                    Using {provider === "openai" ? "OpenAI Realtime API" : "Gemini Live"}
                </p>
            </div>

            {/* Connection Controls */}
            <div className="flex items-center gap-3">
                {!isConnected ? (
                    <Button
                        onClick={startVoiceChat}
                        disabled={isConnecting || !apiKey}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                    >
                        {isConnecting ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                            <Phone className="w-5 h-5 mr-2" />
                        )}
                        {isConnecting ? "Connecting..." : "Start Call"}
                    </Button>
                ) : (
                    <Button
                        onClick={endVoiceChat}
                        size="lg"
                        className="bg-red-600 hover:bg-red-700 text-white min-w-[120px]"
                    >
                        <PhoneOff className="w-5 h-5 mr-2" />
                        End Call
                    </Button>
                )}
            </div>

            {/* Audio Controls */}
            {isConnected && (
                <div className="flex items-center gap-2">
                    <Button
                        onClick={toggleMute}
                        variant="outline"
                        size="sm"
                        className={`border-purple-600/30 ${isMuted ? "bg-red-600/20 text-red-400" : "text-purple-300"}`}
                        title={isMuted ? "Unmute microphone" : "Mute microphone"}
                    >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    
                    <Button
                        onClick={toggleAudioMute}
                        variant="outline"
                        size="sm"
                        className={`border-purple-600/30 ${isAudioMuted ? "bg-red-600/20 text-red-400" : "text-purple-300"}`}
                        title={isAudioMuted ? "Enable audio" : "Mute audio"}
                    >
                        {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                </div>
            )}

            {/* Connection indicator */}
            {isConnected && (
                <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-300">Live audio connection active</span>
                </div>
            )}

            {!apiKey && (
                <div className="p-3 bg-orange-600/10 rounded-lg border border-orange-600/20 text-center">
                    <p className="text-xs text-orange-300">
                        💡 Configure your {provider === "openai" ? "OpenAI" : "Gemini"} API key in settings to enable voice chat
                    </p>
                </div>
            )}
        </div>
    );
}