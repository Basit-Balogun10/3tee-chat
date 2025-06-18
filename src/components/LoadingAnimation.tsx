import { useEffect, useState } from "react";

interface LoadingAnimationProps {
    className?: string;
}

export function LoadingAnimation({ className = "" }: LoadingAnimationProps) {
    const [loadingText, setLoadingText] = useState("Initializing");
    const [progress, setProgress] = useState(0);

    const loadingSteps = [
        "Initializing 3Tee Chat...",
        "Connecting to services...",
        "Loading AI models...",
        "Setting up interface...",
        "Almost ready...",
    ];

    useEffect(() => {
        let currentStep = 0;
        const stepDuration = 800; // 800ms per step

        const interval = setInterval(() => {
            if (currentStep < loadingSteps.length) {
                setLoadingText(loadingSteps[currentStep]);
                setProgress(((currentStep + 1) / loadingSteps.length) * 100);
                currentStep++;
            } else {
                clearInterval(interval);
            }
        }, stepDuration);

        return () => clearInterval(interval);
    }, []);

    return (
        <div
            className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${className}`}
        >
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden">
                {Array.from({ length: 50 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full opacity-20"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 2}s`,
                        }}
                    />
                ))}
            </div>

            {/* Main loading content */}
            <div className="relative z-10 flex flex-col items-center space-y-8">
                {/* Logo/Brand area with animated glow */}
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                            <div className="text-2xl font-bold text-white">
                                3Tee
                            </div>
                        </div>
                    </div>
                    {/* Animated rings */}
                    <div className="absolute inset-0 rounded-full border-2 border-purple-400/30 animate-ping"></div>
                    <div
                        className="absolute inset-2 rounded-full border-2 border-blue-400/20 animate-ping"
                        style={{ animationDelay: "0.5s" }}
                    ></div>
                </div>

                {/* App title */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        3Tee Chat
                    </h1>
                    <p className="text-purple-300 text-lg">
                        Next-generation AI conversations
                    </p>
                </div>

                {/* Loading progress */}
                <div className="w-80 space-y-4">
                    {/* Progress bar */}
                    <div className="relative">
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="w-full h-full bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                        <div
                            className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full animate-bounce"
                            style={{ left: `${progress}%` }}
                        ></div>
                    </div>

                    {/* Loading text with typewriter effect */}
                    <div className="text-center">
                        <p className="text-purple-200 text-sm font-medium min-h-[20px]">
                            {loadingText}
                            <span className="animate-pulse">|</span>
                        </p>
                        <p className="text-purple-400 text-xs mt-1">
                            {Math.round(progress)}% complete
                        </p>
                    </div>
                </div>

                {/* Feature highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl">
                    <div className="text-center space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 mx-auto rounded-lg bg-purple-600/20 flex items-center justify-center">
                            <svg
                                className="w-6 h-6 text-purple-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-white text-sm font-medium">
                            Lightning Fast
                        </h3>
                        <p className="text-purple-300 text-xs">
                            Instant AI responses
                        </p>
                    </div>

                    <div className="text-center space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 mx-auto rounded-lg bg-blue-600/20 flex items-center justify-center">
                            <svg
                                className="w-6 h-6 text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-white text-sm font-medium">
                            Voice Ready
                        </h3>
                        <p className="text-purple-300 text-xs">
                            Talk naturally with AI
                        </p>
                    </div>

                    <div className="text-center space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 mx-auto rounded-lg bg-indigo-600/20 flex items-center justify-center">
                            <svg
                                className="w-6 h-6 text-indigo-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-white text-sm font-medium">
                            Secure & Private
                        </h3>
                        <p className="text-purple-300 text-xs">
                            Your data stays safe
                        </p>
                    </div>
                </div>

                {/* Animated dots */}
                <div className="flex space-x-1">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.2}s` }}
                        ></div>
                    ))}
                </div>
            </div>

            {/* CSS for custom animations - Using style tag without jsx attribute */}
            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
        </div>
    );
}
