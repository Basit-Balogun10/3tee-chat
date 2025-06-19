import { useState, useEffect } from "react";
import { Image, Video, Palette } from "lucide-react";

interface LoadingPlaceholderProps {
    type: "image" | "video" | "canvas";
    prompt?: string;
    className?: string;
}

export function LoadingPlaceholder({ type, prompt, className = "" }: LoadingPlaceholderProps) {
    const [dots, setDots] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? "" : prev + ".");
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const getContent = () => {
        switch (type) {
            case "image":
                return {
                    icon: <Image className="w-8 h-8 text-purple-400" />,
                    title: "Generating Image",
                    subtitle: "Creating your image with AI",
                    gradient: "from-purple-600/20 to-pink-600/20",
                    border: "border-purple-600/30",
                };
            case "video":
                return {
                    icon: <Video className="w-8 h-8 text-blue-400" />,
                    title: "Generating Video",
                    subtitle: "This may take 2-5 minutes",
                    gradient: "from-blue-600/20 to-indigo-600/20",
                    border: "border-blue-600/30",
                };
            case "canvas":
                return {
                    icon: <Palette className="w-8 h-8 text-green-400" />,
                    title: "Creating Artifacts",
                    subtitle: "Generating structured content",
                    gradient: "from-green-600/20 to-emerald-600/20",
                    border: "border-green-600/30",
                };
        }
    };

    const content = getContent();

    return (
        <div className={`relative max-w-md mx-auto ${className}`}>
            <div className={`bg-gradient-to-br ${content.gradient} border ${content.border} rounded-lg p-6 backdrop-blur-sm`}>
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse rounded-lg" />
                
                {/* Content */}
                <div className="relative flex flex-col items-center text-center space-y-4">
                    {/* Icon with pulse animation */}
                    <div className="relative">
                        {content.icon}
                        <div className="absolute inset-0 animate-ping opacity-20">
                            {content.icon}
                        </div>
                    </div>
                    
                    {/* Title and subtitle */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-100 mb-1">
                            {content.title}{dots}
                        </h3>
                        <p className="text-sm text-gray-400">
                            {content.subtitle}
                        </p>
                    </div>
                    
                    {/* Prompt display */}
                    {prompt && (
                        <div className="w-full p-3 bg-black/20 rounded border border-white/10">
                            <p className="text-xs text-gray-300 italic">
                                "{prompt}"
                            </p>
                        </div>
                    )}
                    
                    {/* Progress bar animation */}
                    <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse" 
                             style={{ width: type === "video" ? "30%" : "60%" }} />
                    </div>
                </div>
            </div>
        </div>
    );
}