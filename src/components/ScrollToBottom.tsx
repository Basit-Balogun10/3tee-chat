import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./ui/button";

interface ScrollToBottomProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    threshold?: number;
}

export function ScrollToBottom({
    containerRef,
    threshold = 150,
}: ScrollToBottomProps) {
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom =
                scrollHeight - scrollTop - clientHeight < threshold;
            setShowButton(!isNearBottom && scrollHeight > clientHeight);
        };

        // Initial check
        handleScroll();

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [containerRef, threshold]);

    const scrollToBottom = () => {
        containerRef.current?.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: "smooth",
        });
    };

    if (!showButton) return null;

    return (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50">
            <Button
                onClick={scrollToBottom}
                size="icon"
                className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600/90 hover:to-pink-600/90 backdrop-blur-sm border border-purple-500/30 text-white transition-all duration-200 hover:scale-105"
                title="Jump to bottom"
            >
                <ChevronDown className="w-5 h-5" />
            </Button>
        </div>
    );
}
