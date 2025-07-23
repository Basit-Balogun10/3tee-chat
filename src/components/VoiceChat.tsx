import {
    useState,
    useRef,
    useEffect,
    useCallback,
    Dispatch,
    SetStateAction,
} from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GoogleGenAI, Modality } from "@google/genai";
import {
    GeminiAudioProcessor,
    GeminiAudioPlayer,
} from "../lib/geminiAudioProcessor";

import { Button } from "./ui/button";
import {
    Phone,
    PhoneOff,
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    Video,
    VideoOff,
    Monitor,
    MonitorOff,
    Type,
    Send,
    Loader2,
    AlertCircle,
    Paperclip,
} from "lucide-react";
import { toast } from "sonner";

interface VoiceChatProps {
    isConnected: boolean;
    setIsConnected: Dispatch<SetStateAction<boolean>>;
    onTranscription?: (transcript: string) => void;
    provider?: "openai" | "gemini";
    className?: string;
    disabled?: boolean;
}

// Audio configuration constants
const AUDIO_CONFIG = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    bufferSize: 4096,
    receiveSampleRate: 24000,
};

// Video configuration
const VIDEO_CONFIG = {
    width: 640,
    height: 480,
    frameRate: 1, // 1 FPS as per Python example
};

export function VoiceChat({
    isConnected,
    setIsConnected,
    onTranscription,
    provider = "openai",
    className = "",
    disabled = false,
}: VoiceChatProps) {
    const preferences = useQuery(api.preferences.getUserPreferences);
    // Connection states
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<
        "idle" | "connecting" | "connected" | "error"
    >("idle");
    const [connectionError, setConnectionError] = useState<string>("");

    // Media states
    const [isMuted, setIsMuted] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isScreenShare, setIsScreenShare] = useState(false);
    const [videoMode, setVideoMode] = useState<"none" | "camera" | "screen">(
        "none"
    );

    // Chat states
    const [messages, setMessages] = useState<
        Array<{
            type: "user" | "assistant";
            content: string;
            timestamp: number;
        }>
    >([]);
    const [textInput, setTextInput] = useState("");
    const [isSendingText, setIsSendingText] = useState(false);

    // Refs for media and connection
    const ephemeralKeyRef = useRef<string | null>(null);
    const sessionRef = useRef<any>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const videoStreamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioProcessorRef = useRef<GeminiAudioProcessor | null>(null);
    const audioPlayerRef = useRef<GeminiAudioPlayer | null>(null);
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachedMedia, setAttachedMedia] = useState<
        Array<{ type: "image" | "video"; file: File; preview: string }>
    >([]);

    const token = useAuthToken();

    // Cleanup function
    const cleanup = useCallback(() => {
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionStatus("idle");
        setConnectionError("");

        // Clear intervals
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }

        // Stop media streams
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }

        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach((track) => track.stop());
            videoStreamRef.current = null;
        }

        // Close audio processor
        if (audioProcessorRef.current) {
            audioProcessorRef.current.destroy();
            audioProcessorRef.current = null;
        }

        if (audioPlayerRef.current) {
            audioPlayerRef.current.destroy();
            audioPlayerRef.current = null;
        }

        // Close session
        if (sessionRef.current) {
            sessionRef.current = null;
        }

        // Clear ephemeral key
        ephemeralKeyRef.current = null;

        // Reset states
        setVideoMode("none");
        setIsVideoEnabled(false);
        setIsScreenShare(false);
        setMessages([]);
    }, []);

    const playAudioResponse = async (audioData: ArrayBuffer) => {
        if (!audioPlayerRef.current || isAudioMuted) return;

        try {
            await audioPlayerRef.current.playAudio(audioData);
        } catch (error) {
            console.error("Failed to play audio:", error);
        }
    };

    // Get ephemeral key and connect to Gemini Live
    const connectToGeminiLive = useCallback(async () => {
        try {
            setIsConnecting(true);
            setConnectionStatus("connecting");
            setConnectionError("");

            // Step 1: Get ephemeral key from our backend
            // const convexUrl = import.meta.env.VITE_CONVEX_ACTIONS_URL;
            // const keyEndpoint = `${convexUrl}/api/gemini-live-key`;

            // console.log(
            //     "🔑 Fetching Gemini Live ephemeral key from:",
            //     keyEndpoint
            // );

            // const keyResponse = await fetch(keyEndpoint, {
            //     method: "GET",
            //     headers: {
            //         Authorization: `Bearer ${token}`,
            //         "Content-Type": "application/json",
            //     },
            // });

            // if (!keyResponse.ok) {
            //     const errorText = await keyResponse.text();
            //     throw new Error(
            //         `Failed to get ephemeral key: ${keyResponse.status} - ${errorText}`
            //     );
            // }

            // const keyData = await keyResponse.json();
            // if (keyData.error || !keyData.ephemeral_key) {
            //     throw new Error(keyData.error || "No ephemeral key received");
            // }

            // ephemeralKeyRef.current = keyData.ephemeral_key;
            // console.log(
            //     "✅ Ephemeral key received, connecting to Gemini Live: ",
            //     ephemeralKeyRef?.current
            // );

            // Step 2: Initialize Gemini client with ephemeral key
            const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const genAI = new GoogleGenAI({
                apiKey: preferences?.apiKeys?.gemini || geminiApiKey,
            });

            // Step 3: Connect to Live API using ai.live.connect()
            const model = "models/gemini-2.0-flash-exp";
            const userVoice = preferences?.voiceSettings?.voice || "aoede";
            const userLanguage =
                preferences?.voiceSettings?.language || "en-US";
            const capitalizedVoice =
                userVoice.charAt(0).toUpperCase() +
                userVoice.slice(1).toLowerCase();
            const config = {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    languageCode: userLanguage,
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: capitalizedVoice,
                        },
                    },
                },
                tools: [{ googleSearch: {} }],
            };

            console.log("🌐 Starting Gemini Live session...");

            const liveSession = await genAI.live.connect({
                model: model,
                config: config,
                callbacks: {
                    onopen: () => {
                        console.log("✅ Gemini Live session opened");
                        setIsConnected(true);
                        setIsConnecting(false);
                        setConnectionStatus("connected");
                        toast.success("🎤 Connected to Gemini Live!");

                        // Setup audio and video after successful connection
                        setupAudioProcessing().catch(console.error);
                        if (videoMode !== "none") {
                            setupVideoCapture().catch(console.error);
                        }
                    },
                    onmessage: (message) => {
                        console.log("📨 Received message:", message);

                        // Handle different types of responses from Gemini Live
                        if (message.serverContent?.modelTurn?.parts) {
                            const parts = message.serverContent.modelTurn.parts;

                            for (const part of parts) {
                                if (part.text) {
                                    // Handle text response
                                    console.log("Gemini text:", part.text);
                                    setMessages((prev) => [
                                        ...prev,
                                        {
                                            type: "assistant",
                                            content: part.text as string,
                                            timestamp: Date.now(),
                                        },
                                    ]);

                                    // Pass transcription to parent component
                                    if (onTranscription) {
                                        onTranscription(part.text);
                                    }
                                }

                                if (
                                    part.inlineData?.data &&
                                    part.inlineData?.mimeType === "audio/pcm"
                                ) {
                                    // Handle audio response - convert base64 to ArrayBuffer
                                    try {
                                        const audioData = atob(
                                            part.inlineData.data
                                        );
                                        const audioBuffer = new ArrayBuffer(
                                            audioData.length
                                        );
                                        const audioView = new Uint8Array(
                                            audioBuffer
                                        );
                                        for (
                                            let i = 0;
                                            i < audioData.length;
                                            i++
                                        ) {
                                            audioView[i] =
                                                audioData.charCodeAt(i);
                                        }
                                        playAudioResponse(audioBuffer);
                                    } catch (error) {
                                        console.error(
                                            "Failed to decode audio data:",
                                            error
                                        );
                                    }
                                }
                            }
                        }

                        // Fallback for direct data/text properties (older format)
                        if (message.data) {
                            if (typeof message.data === "string") {
                                // Convert base64 string to ArrayBuffer
                                try {
                                    const audioData = atob(message.data);
                                    const audioBuffer = new ArrayBuffer(
                                        audioData.length
                                    );
                                    const audioView = new Uint8Array(
                                        audioBuffer
                                    );
                                    for (let i = 0; i < audioData.length; i++) {
                                        audioView[i] = audioData.charCodeAt(i);
                                    }
                                    playAudioResponse(audioBuffer);
                                } catch (error) {
                                    console.error(
                                        "Failed to decode audio data:",
                                        error
                                    );
                                }
                            } else if (message.data instanceof ArrayBuffer) {
                                playAudioResponse(message.data);
                            }
                        }

                        if (message.text) {
                            // Handle direct text response
                            console.log("Gemini:", message.text);
                            setMessages((prev) => [
                                ...prev,
                                {
                                    type: "assistant",
                                    content: message.text as string,
                                    timestamp: Date.now(),
                                },
                            ]);

                            // Pass transcription to parent component
                            if (onTranscription) {
                                onTranscription(message.text);
                            }
                        }
                    },
                    onerror: (error) => {
                        console.error("❌ Gemini Live error:", error);
                        setConnectionStatus("error");

                        // Extract more meaningful error information
                        let errorMessage = "Connection error";
                        if (error instanceof Event) {
                            if (error.target && "readyState" in error.target) {
                                const ws = error.target as WebSocket;
                                errorMessage = `WebSocket connection failed (state: ${ws.readyState})`;
                            }
                        } else if (error instanceof Error) {
                            errorMessage = error.message;
                        } else if (typeof error === "string") {
                            errorMessage = error;
                        }

                        setConnectionError(errorMessage);
                        toast.error(`Live chat error: ${errorMessage}`);
                        cleanup();
                    },
                    onclose: (event) => {
                        console.log("🔒 Gemini Live session closed:", event);
                        setIsConnected(false);
                        setConnectionStatus("idle");
                    },
                },
            });

            sessionRef.current = liveSession;

            // Step 4: Setup audio processing
            // await setupAudioProcessing();

            // Step 5: Setup video if enabled
            if (videoMode !== "none") {
                // await setupVideoCapture();
                frameIntervalRef.current = setInterval(
                    captureAndSendFrame,
                    1000
                ); // 1 FPS
            }
        } catch (error) {
            console.error("Failed to connect to Gemini Live:", error);
            setConnectionStatus("error");
            setConnectionError(
                error instanceof Error ? error.message : "Unknown error"
            );
            toast.error(
                `Gemini Live connection failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            cleanup();
        }
    }, [
        provider,
        token,
        videoMode,
        cleanup,
        onTranscription,
        playAudioResponse,
        preferences?.voiceSettings?.voice,
    ]);

    // Setup audio processing pipeline
    const setupAudioProcessing = async () => {
        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: AUDIO_CONFIG.sampleRate,
                    channelCount: AUDIO_CONFIG.channels,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            micStreamRef.current = stream;

            // Initialize audio processor
            audioProcessorRef.current = new GeminiAudioProcessor(
                AUDIO_CONFIG.sampleRate,
                AUDIO_CONFIG.bufferSize,
                AUDIO_CONFIG.channels
            );

            // Initialize audio player
            audioPlayerRef.current = new GeminiAudioPlayer(
                AUDIO_CONFIG.receiveSampleRate
            );
            await audioPlayerRef.current.initialize();

            // Setup processor with callback to send to Gemini Live
            await audioProcessorRef.current.initialize(stream, (audioData) => {
                if (sessionRef.current && !isMuted) {
                    // Convert audioData to base64 string if it's not already
                    let base64Data;
                    if (audioData instanceof ArrayBuffer) {
                        const uint8Array = new Uint8Array(audioData);
                        base64Data = btoa(String.fromCharCode(...uint8Array));
                    } else if (typeof audioData === "string") {
                        base64Data = audioData;
                    } else {
                        console.warn(
                            "Unexpected audio data type:",
                            typeof audioData
                        );
                        return;
                    }

                    try {
                        sessionRef.current.sendRealtimeInput({
                            audio: {
                                data: base64Data,
                                mimeType: "audio/pcm",
                            },
                        });
                    } catch (error) {
                        console.error("Failed to send audio data:", error);
                    }
                }
            });

            console.log("✅ Audio processing setup complete");
        } catch (error) {
            console.error("Failed to setup audio processing:", error);
            throw new Error("Failed to access microphone");
        }
    };

    // Setup video capture (camera or screen)
    const setupVideoCapture = async () => {
        try {
            let stream: MediaStream;

            if (videoMode === "camera") {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: VIDEO_CONFIG.width,
                        height: VIDEO_CONFIG.height,
                        frameRate: VIDEO_CONFIG.frameRate,
                    },
                });
            } else if (videoMode === "screen") {
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: VIDEO_CONFIG.width,
                        height: VIDEO_CONFIG.height,
                        frameRate: VIDEO_CONFIG.frameRate,
                    },
                });
            } else {
                return;
            }

            videoStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            console.log(`✅ ${videoMode} capture setup complete`);
        } catch (error) {
            console.error(`Failed to setup ${videoMode} capture:`, error);
            toast.error(`Failed to access ${videoMode}`);
            setVideoMode("none");
        }
    };

    // Capture and send video frames
    const captureAndSendFrame = useCallback(async () => {
        if (!videoRef.current || !sessionRef.current || videoMode === "none")
            return;

        try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            canvas.width = VIDEO_CONFIG.width;
            canvas.height = VIDEO_CONFIG.height;

            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            // Convert to JPEG and base64
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            const base64Data = dataUrl.split(",")[1];

            // Send frame to Gemini Live
            await sessionRef.current.sendRealtimeInput({
                video: {
                    data: base64Data,
                    mimeType: "image/jpeg",
                },
            });
        } catch (error) {
            console.error("Failed to capture frame:", error);
        }
    }, [videoMode]);

    // Send text message
    const sendTextMessage = async () => {
        if (!textInput.trim() || !sessionRef.current || isSendingText) return;

        setIsSendingText(true);
        const message = textInput.trim();
        setTextInput("");

        try {
            // Handle attachments if present
            if (attachedMedia && attachedMedia.length > 0) {
                for (const attachment of attachedMedia) {
                    try {
                        // Convert file to base64 and send
                        const base64 = await new Promise<string>(
                            (resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const result = reader.result as string;
                                    resolve(result.split(",")[1]);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(attachment.file);
                            }
                        );

                        // Both images and videos are sent via the 'video' field
                        // This is because Gemini Live treats them both as visual input
                        await sessionRef.current.sendRealtimeInput({
                            video: {
                                data: base64,
                                mimeType: attachment.file.type, // Use the actual file MIME type
                            },
                        });

                        console.log(
                            `✅ ${attachment.type} attachment sent:`,
                            attachment.file.type
                        );
                    } catch (error) {
                        console.error(
                            `❌ Failed to send ${attachment.type} attachment:`,
                            error
                        );
                        toast.error(`Failed to send ${attachment.type}`);
                    }
                }

                // Clear attachments after sending
                setAttachedMedia([]);
            }

            // Add message to UI immediately
            const userMessage = {
                type: "user" as const,
                content: message,
                timestamp: Date.now(),
                attachments: attachedMedia,
            };
            setMessages((prev) => [...prev, userMessage]);

            // Send text message to Gemini Live session
            await sessionRef.current.sendRealtimeInput({
                text: message,
            });

            console.log("✅ Text message sent to Gemini Live");
        } catch (error) {
            console.error("❌ Failed to send text message:", error);
            toast.error("Failed to send message");
        } finally {
            setIsSendingText(false);
        }
    };

    // Control functions
    const startVoiceChat = async () => {
        await connectToGeminiLive();
    };

    const endVoiceChat = () => {
        cleanup();
        toast.success("Gemini Live session ended");
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);

        // Use the audio processor's mute function
        if (audioProcessorRef.current) {
            audioProcessorRef.current.setMuted(!isMuted);
        }

        toast.success(isMuted ? "Microphone unmuted" : "Microphone muted");
    };

    const toggleAudioMute = () => {
        setIsAudioMuted(!isAudioMuted);
        toast.success(isAudioMuted ? "Audio enabled" : "Audio muted");
    };

    const toggleVideo = async (targetMode: "camera" | "screen") => {
        // If clicking the same mode that's already active, turn it off
        if (videoMode === targetMode) {
            // Turn off current video mode
            await stopCurrentVideo();
            setVideoMode("none");
            toast.success(
                `${targetMode === "camera" ? "Camera" : "Screen share"} turned off`
            );
        } else {
            // Stop current video first if any
            if (videoMode !== "none") {
                await stopCurrentVideo();
            }

            // Start new video mode
            const previousMode = videoMode;
            setVideoMode(targetMode);

            if (isConnected) {
                try {
                    await setupVideoCapture();
                    if (frameIntervalRef.current) {
                        clearInterval(frameIntervalRef.current);
                    }
                    frameIntervalRef.current = setInterval(
                        captureAndSendFrame,
                        1000
                    );
                    toast.success(
                        `${targetMode === "camera" ? "Camera" : "Screen share"} activated`
                    );
                } catch (error) {
                    setVideoMode(previousMode); // Revert on error
                    toast.error(`Failed to activate ${targetMode}`);
                }
            }
        }
    };

    const stopCurrentVideo = async () => {
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach((track) => track.stop());
            videoStreamRef.current = null;
        }

        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
    };

    // Handle media file upload
    const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        Array.from(files).forEach((file) => {
            if (
                file.type.startsWith("image/") ||
                file.type.startsWith("video/")
            ) {
                const preview = URL.createObjectURL(file);
                setAttachedMedia((prev) => [
                    ...prev,
                    {
                        type: file.type.startsWith("image/")
                            ? "image"
                            : "video",
                        file,
                        preview,
                    },
                ]);
            }
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Handle paste for images/videos
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!isConnected) return;

            const items = Array.from(e.clipboardData?.items || []);

            for (const item of items) {
                if (
                    item.type.startsWith("image/") ||
                    item.type.startsWith("video/")
                ) {
                    const file = item.getAsFile();
                    if (file) {
                        const preview = URL.createObjectURL(file);
                        setAttachedMedia((prev) => [
                            ...prev,
                            {
                                type: file.type.startsWith("image/")
                                    ? "image"
                                    : "video",
                                file,
                                preview,
                            },
                        ]);
                    }
                }
            }
        };

        document.addEventListener("paste", handlePaste);
        return () => document.removeEventListener("paste", handlePaste);
    }, [isConnected]);

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    // Status display helpers
    const getStatusColor = () => {
        switch (connectionStatus) {
            case "connected":
                return "text-purple-400";
            case "connecting":
                return "text-yellow-400";
            case "error":
                return "text-red-400";
            default:
                return "text-purple-400";
        }
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case "connected":
                return "Connected to Gemini Live";
            case "connecting":
                return "Connecting to Gemini Live...";
            case "error":
                return connectionError || "Connection failed";
            default:
                return "Ready to connect";
        }
    };

    if (disabled) {
        return (
            <div
                className={`flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-purple-600/10 to-indigo-600/10 rounded-xl border border-purple-600/20 ${className}`}
            >
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-purple-100 mb-2">
                        Gemini Live Chat
                    </h3>
                    <p className="text-sm text-orange-300">
                        📝 Please configure your Gemini API key in settings to
                        use live chat
                    </p>
                </div>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div
                className={`flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-purple-600/10 to-indigo-600/10 rounded-xl border border-purple-600/20 ${className}`}
            >
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-purple-100 mb-2">
                        Gemini Live Chat
                    </h3>
                    <p className={`text-sm ${getStatusColor()}`}>
                        {getStatusText()}
                    </p>
                </div>

                {/* Video Mode Selection */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-purple-300">
                        Video Mode:
                    </label>
                    <div className="flex gap-1">
                        {["none", "camera", "screen"].map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setVideoMode(mode as any)}
                                disabled={isConnecting}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${
                                    videoMode === mode
                                        ? "bg-purple-500/30 text-purple-100 border border-purple-500/50"
                                        : "bg-gray-800/50 text-purple-300 hover:bg-purple-500/20 border border-purple-600/30"
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Connection Controls */}
                <div className="flex items-center gap-3">
                    <Button
                        onClick={startVoiceChat}
                        disabled={isConnecting}
                        size="lg"
                        className="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]"
                    >
                        {isConnecting ? (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                            <Phone className="w-5 h-5 mr-2" />
                        )}
                        {isConnecting ? "Connecting..." : "Start Live Chat"}
                    </Button>
                </div>

                {connectionStatus === "error" && (
                    <div className="p-3 bg-red-600/10 rounded-lg border border-red-600/20 text-center max-w-md">
                        <div className="flex items-center gap-2 justify-center mb-2">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-medium text-red-300">
                                Connection Error
                            </span>
                        </div>
                        <p className="text-xs text-red-400">
                            {connectionError}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Connected state - Live chat interface
    return (
        <div
            className={`flex flex-col gap-4 p-4 bg-gradient-to-b from-purple-600/10 to-indigo-600/10 rounded-xl border border-purple-600/20 ${className}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <h3 className="text-lg font-semibold text-purple-100">
                        Gemini Live Chat
                    </h3>
                </div>
                <Button
                    onClick={endVoiceChat}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                >
                    <PhoneOff className="w-4 h-4 mr-2" />
                    End Chat
                </Button>
            </div>
            {/* Video Display */}
            {videoMode !== "none" && (
                <div className="relative bg-black/20 rounded-lg overflow-hidden aspect-video border border-purple-600/20">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
                        {videoMode === "camera" ? "Camera" : "Screen Share"}
                    </div>
                </div>
            )}
            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
                <Button
                    onClick={toggleMute}
                    variant="outline"
                    size="sm"
                    className={`border-purple-600/30 ${isMuted ? "bg-red-600/20 text-red-400" : "text-purple-300"}`}
                    title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                    {isMuted ? (
                        <MicOff className="w-4 h-4" />
                    ) : (
                        <Mic className="w-4 h-4" />
                    )}
                </Button>

                <Button
                    onClick={toggleAudioMute}
                    variant="outline"
                    size="sm"
                    className={`border-purple-600/30 ${isAudioMuted ? "bg-red-600/20 text-red-400" : "text-purple-300"}`}
                    title={isAudioMuted ? "Enable audio" : "Mute audio"}
                >
                    {isAudioMuted ? (
                        <VolumeX className="w-4 h-4" />
                    ) : (
                        <Volume2 className="w-4 h-4" />
                    )}
                </Button>

                <Button
                    onClick={() => toggleVideo("camera")}
                    variant="outline"
                    size="sm"
                    className={`border-purple-600/30 ${videoMode === "camera" ? "bg-green-600/20 text-green-400" : "text-purple-300"}`}
                    title={
                        isVideoEnabled ? "Turn off camera" : "Turn on camera"
                    }
                >
                    {videoMode === "camera" ? (
                        <Video className="w-4 h-4" />
                    ) : (
                        <VideoOff className="w-4 h-4" />
                    )}
                </Button>

                <Button
                    onClick={() => toggleVideo("screen")}
                    variant="outline"
                    size="sm"
                    className={`border-purple-600/30 ${videoMode === "screen" ? "bg-green-600/20 text-green-400" : "text-purple-300"}`}
                    title={isScreenShare ? "Stop screen share" : "Share screen"}
                >
                    {videoMode === "screen" ? (
                        <Monitor className="w-4 h-4" />
                    ) : (
                        <MonitorOff className="w-4 h-4" />
                    )}
                </Button>
            </div>
            {/* Chat Messages */}
            <div className="bg-black/20 rounded-lg border border-purple-600/20 p-3 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                    {messages.length === 0 ? (
                        <p className="text-sm text-purple-400 text-center">
                            Start talking or type a message...
                        </p>
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`px-3 py-1.5 rounded-lg text-sm max-w-[80%] ${
                                        msg.type === "user"
                                            ? "bg-purple-600/30 text-purple-100"
                                            : "bg-gray-800/50 text-purple-200"
                                    }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {attachedMedia.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {attachedMedia.map((media, idx) => (
                        <div key={idx} className="relative group">
                            {media.type === "image" ? (
                                <img
                                    src={media.preview}
                                    alt="Preview"
                                    className="w-16 h-16 object-cover rounded-lg"
                                />
                            ) : (
                                <video
                                    src={media.preview}
                                    className="w-16 h-16 object-cover rounded-lg"
                                />
                            )}
                            <button
                                onClick={() =>
                                    setAttachedMedia((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                    )
                                }
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Text Input */}
            <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                sendTextMessage();
                            }
                        }}
                        placeholder="Type a message..."
                        disabled={isSendingText}
                        className="w-full px-3 py-2 bg-black/20 border border-purple-600/30 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:border-purple-500/50 text-sm"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleMediaUpload}
                        className="hidden"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        size="sm"
                        variant="outline"
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 text-purple-400 hover:bg-purple-600/30"
                        title="Attach image or video"
                    >
                        <Paperclip className="w-4 h-4" />
                    </Button>
                </div>
                <Button
                    onClick={sendTextMessage}
                    disabled={!textInput.trim() || isSendingText}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                    {isSendingText ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}
