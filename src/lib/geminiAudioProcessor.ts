// Audio processor for real-time Gemini Live chat
// This handles converting audio from the microphone to the format needed by Gemini Live API

export class GeminiAudioProcessor {
    private audioContext: AudioContext | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private onAudioData: ((data: ArrayBuffer) => void) | null = null;

    constructor(
        private sampleRate: number = 16000,
        private bufferSize: number = 4096,
        private channels: number = 1
    ) {}

    async initialize(
        stream: MediaStream,
        onAudioDataCallback: (data: ArrayBuffer) => void
    ): Promise<void> {
        this.onAudioData = onAudioDataCallback;

        // Create audio context with the required sample rate
        this.audioContext = new AudioContext({
            sampleRate: this.sampleRate,
            latencyHint: "interactive",
        });

        // Create source from microphone stream
        this.sourceNode = this.audioContext.createMediaStreamSource(stream);

        // Create script processor for real-time processing
        this.processorNode = this.audioContext.createScriptProcessor(
            this.bufferSize,
            this.channels,
            this.channels
        );

        // Process audio data
        this.processorNode.onaudioprocess = (event) => {
            if (!this.onAudioData) return;

            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);

            // Convert Float32Array to Int16Array (PCM16 format for Gemini Live)
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                // Clamp and convert to 16-bit PCM
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = Math.floor(sample * 32767);
            }

            // Send the PCM data as ArrayBuffer
            this.onAudioData(pcmData.buffer);
        };

        // Connect the audio graph
        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(this.audioContext.destination);

        console.log("✅ Gemini audio processor initialized");
    }

    setMuted(muted: boolean): void {
        if (this.processorNode) {
            // We'll handle muting by not calling the callback rather than disconnecting
            if (muted) {
                this.processorNode.onaudioprocess = null;
            } else {
                this.processorNode.onaudioprocess = (event) => {
                    if (!this.onAudioData) return;

                    const inputBuffer = event.inputBuffer;
                    const inputData = inputBuffer.getChannelData(0);

                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const sample = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = Math.floor(sample * 32767);
                    }

                    this.onAudioData(pcmData.buffer);
                };
            }
        }
    }

    destroy(): void {
        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        if (this.audioContext && this.audioContext.state !== "closed") {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.onAudioData = null;
        console.log("🧹 Gemini audio processor destroyed");
    }
}

// Audio playback utility for Gemini Live responses
export class GeminiAudioPlayer {
    private audioContext: AudioContext | null = null;
    private audioQueue: ArrayBuffer[] = [];
    private isPlaying: boolean = false;

    constructor(private sampleRate: number = 24000) {}

    async initialize(): Promise<void> {
        this.audioContext = new AudioContext({
            sampleRate: this.sampleRate,
            latencyHint: "interactive",
        });

        console.log("✅ Gemini audio player initialized");
    }

    async playAudio(audioData: ArrayBuffer): Promise<void> {
        if (!this.audioContext) {
            console.warn("Audio player not initialized");
            return;
        }

        this.audioQueue.push(audioData);

        if (!this.isPlaying) {
            await this.processQueue();
        }
    }

    private async processQueue(): Promise<void> {
        if (
            this.isPlaying ||
            this.audioQueue.length === 0 ||
            !this.audioContext
        ) {
            return;
        }

        this.isPlaying = true;

        while (this.audioQueue.length > 0) {
            const audioData = this.audioQueue.shift();
            if (audioData) {
                try {
                    await this.playPCMAudioBuffer(audioData);
                } catch (error) {
                    console.error("Failed to play audio chunk:", error);
                }
            }
        }

        this.isPlaying = false;
    }

    private async playPCMAudioBuffer(audioData: ArrayBuffer): Promise<void> {
        if (!this.audioContext) return;

        try {
            // Convert the ArrayBuffer to Int16Array (PCM data from Gemini)
            const pcmData = new Int16Array(audioData);

            // Create an AudioBuffer with the appropriate length
            const frameCount = pcmData.length;
            const audioBuffer = this.audioContext.createBuffer(
                1, // mono
                frameCount,
                this.sampleRate
            );

            // Get the channel data and convert PCM16 to Float32
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < frameCount; i++) {
                // Convert from Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
                channelData[i] = pcmData[i] / 32768.0;
            }

            // Create and play the audio source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);

            return new Promise<void>((resolve) => {
                source.onended = () => resolve();
                source.start();
            });
        } catch (error) {
            console.error("Failed to play PCM audio:", error);
            throw error;
        }
    }

    clearQueue(): void {
        this.audioQueue = [];
    }

    destroy(): void {
        this.clearQueue();

        if (this.audioContext && this.audioContext.state !== "closed") {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isPlaying = false;
        console.log("🧹 Gemini audio player destroyed");
    }
}
