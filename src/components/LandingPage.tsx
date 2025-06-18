import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    forwardRef,
    Ref,
} from "react";
import {
    ArrowRight,
    Github,
    Brain,
    MessageSquare,
    Zap,
    Sparkles,
    Mic,
    Image as ImageIcon,
    Search,
    Users,
    Code,
    Layers,
    Wind,
    Database,
    Share2,
    Laptop,
    Smartphone,
    Rocket,
    CheckCircle,
    BarChartBig,
    FileText,
    Link as LinkIcon,
    HeartHandshake,
    Lightbulb,
    UserCheck,
    KeyRound,
    CloudCog,
    FolderKanban,
    MicVocal,
    Palette,
    UsersRound,
    Atom,
    Cpu,
    ShieldCheck,
    Milestone,
    ThumbsUp,
    GitFork,
    Crown,
    Hourglass,
    PlayCircle,
    Eye,
    DownloadCloud,
    ArrowUpRight,
    Server,
    Shuffle,
    Paintbrush,
} from "lucide-react";

interface LandingPageProps {
    onGetStarted: () => void;
}

interface FeatureItem {
    icon: React.ReactNode;
    title: string;
    description: string;
    category:
        | "Core Staples"
        | "Power-Packed Features"
        | "Community Insights Powered";
}

const FeatherIcon = Sparkles;

// Custom CSS animations for LandingPage
const landingPageStyles = `
      body {
        scroll-behavior: smooth;
      }
        
      @keyframes float {
        0% { transform: translateY(0px) rotate(-1deg); }
        50% { transform: translateY(-15px) rotate(1deg) scale(1.02); }
        100% { transform: translateY(0px) rotate(-1deg); }
      }
      .animate-hero-float {
        animation: float 6s ease-in-out infinite;
      }
      @keyframes subtle-pulse-glow {
        0%, 100% { opacity: 0.6; transform: scale(1); filter: blur(1px); }
        50% { opacity: 0.8; transform: scale(1.05); filter: blur(0px); }
      }
      .animate-subtle-pulse-glow {
        animation: subtle-pulse-glow 8s ease-in-out infinite;
      }
      @keyframes gradient-bg-fast {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .animated-gradient-text-fast {
        background-size: 250% 250%;
        animation: gradient-bg-fast 3s ease infinite;
      }
      .card-hover-effect {
        transition: transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.3s ease;
      }
      .card-hover-effect:hover {
        transform: translateY(-10px) scale(1.05);
        box-shadow: 0 18px 35px rgba(0,0,0,0.2), 0 0 20px rgba(79, 70, 229, 0.5); /* Maintained for cards */
      }
      
      .scroll-animate-base {
        transition-property: opacity, transform;
        transition-duration: 0.7s;
        transition-timing-function: ease-out;
      }
      .scroll-animate-hidden {
        opacity: 0;
        transform: translateY(40px);
      }
      .scroll-animate-visible {
        opacity: 1;
        transform: translateY(0);
      }
      
      .scroll-animate-left-hidden {
        opacity: 0;
        transform: translateX(-60px) rotate(-5deg);
      }
      .scroll-animate-left-visible {
        opacity: 1;
        transform: translateX(0) rotate(0deg);
      }

      .scroll-animate-right-hidden {
        opacity: 0;
        transform: translateX(60px) rotate(5deg);
      }
      .scroll-animate-right-visible {
        opacity: 1;
        transform: translateX(0) rotate(0deg);
      }
      .scroll-animate-scale-hidden {
        opacity: 0;
        transform: scale(0.85);
      }
      .scroll-animate-scale-visible {
        opacity: 1;
        transform: scale(1);
      }
    
      .bg-grid-pattern-darker {
        background-image: linear-gradient(rgba(100, 116, 139, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(100, 116, 139, 0.08) 1px, transparent 1px);
        background-size: 25px 25px;
      }
`;

const featuresList: FeatureItem[] = [
    {
        icon: <MessageSquare className="w-7 h-7 text-sky-400" />,
        title: "Chat with Diverse LLMs",
        description:
            "Seamlessly switch between a universe of AI models. Your chat, your choice!",
        category: "Core Staples",
    },
    {
        icon: <UsersRound className="w-7 h-7 text-green-400" />,
        title: "Rock-Solid Auth & Cloud Sync",
        description:
            "Secure user accounts with your chat history flawlessly synced across every device you own. Never lose a thought!",
        category: "Core Staples",
    },
    {
        icon: <UserCheck className="w-7 h-7 text-teal-400" />,
        title: "Instant Access: Guest Mode!",
        description:
            "No barriers! Jump right in and experience the magic anonymously. Zero friction, 100% awesome.",
        category: "Core Staples",
    },
    {
        icon: <Cpu className="w-7 h-7 text-red-400" />,
        title: "Truly Cross-Platform Native Power",
        description:
            "Experience peak performance on Android, iOS, Windows, MacOS, Linux, AND Web. One codebase, universal brilliance!",
        category: "Core Staples",
    },
    {
        icon: <Zap className="w-7 h-7 text-yellow-400" />,
        title: "Blazing Fast Performance",
        description:
            "Feel the THRILL of speed! My hyper-optimized engine delivers instant responses and a buttery-smooth experience.",
        category: "Core Staples",
    },

    {
        icon: <KeyRound className="w-7 h-7 text-indigo-400" />,
        title: "BYOK: Your Keys, Your AI",
        description:
            "Total control! Plug in your own API keys for OpenAI, Google, Anthropic, and more. Ultimate flexibility!",
        category: "Power-Packed Features",
    },
    {
        icon: <CloudCog className="w-7 h-7 text-purple-400" />,
        title: "Data Your Way: Local or Cloud",
        description:
            "Privacy first or sync everywhere? You decide! Keep chats local or beam them to our secure cloud.",
        category: "Power-Packed Features",
    },
    {
        icon: <MicVocal className="w-7 h-7 text-pink-400" />,
        title: "Immersive Voice Interactions",
        description:
            "Go hands-free! Dictate messages or engage in real-time, low-latency voice chats with AI. The future is talking!",
        category: "Power-Packed Features",
    },
    {
        icon: <Code className="w-7 h-7 text-orange-400" />,
        title: "Stunning Syntax Highlighting",
        description:
            "Code like a pro! Crystal-clear formatting for every snippet makes technical chats a breeze.",
        category: "Power-Packed Features",
    },
    {
        icon: <Rocket className="w-7 h-7 text-lime-400" />,
        title: "Unstoppable Resumable Streams",
        description:
            "Never miss a beat! Continue text generation right where you left off, even after a refresh. Pure magic!",
        category: "Power-Packed Features",
    },
    {
        icon: <Share2 className="w-7 h-7 text-cyan-400" />,
        title: "Instant Chat Sharing",
        description:
            "Spread the wisdom! Generate unique public links to share entire conversations in a click.",
        category: "Power-Packed Features",
    },
    {
        icon: <GitFork className="w-7 h-7 text-blue-400" />,
        title: "Creative Chat Branching",
        description:
            "Explore every 'what if'! Fork conversations by editing past messages to navigate different dialogue paths.",
        category: "Power-Packed Features",
    },
    {
        icon: <ImageIcon className="w-7 h-7 text-rose-400" />,
        title: "Rich Media Attachments",
        description:
            "Words + Pictures = Awesome! Upload images and PDFs directly into your chats for richer context.",
        category: "Power-Packed Features",
    },

    {
        icon: <Search className="w-7 h-7 text-amber-400" />,
        title: "Real-Time Web Search",
        description:
            "Stay current! Integrate live web search for up-to-the-minute info on any topic.",
        category: "Community Insights Powered",
    },
    {
        icon: <LinkIcon className="w-7 h-7 text-violet-400" />,
        title: "Transparent Source Citing",
        description:
            "Trust but verify! AI responses can cite their sources, showing you the 'why' behind the 'what'.",
        category: "Community Insights Powered",
    },
    {
        icon: <ShieldCheck className="w-7 h-7 text-emerald-400" />,
        title: "Flawless Error Handling",
        description:
            "Smooth sailing, always! User-friendly alerts for API key issues or network hiccups. No more cryptic errors!",
        category: "Community Insights Powered",
    },
    {
        icon: <Laptop className="w-7 h-7 text-gray-400" />,
        title: "Keyboard Power-Navigation",
        description:
            "Become a speed demon! Full app control with intuitive keyboard shortcuts for ultimate efficiency.",
        category: "Community Insights Powered",
    },
    {
        icon: <FolderKanban className="w-7 h-7 text-fuchsia-400" />,
        title: "Project-Based Organization",
        description:
            "Master your chats! Neatly organize conversations into projects for clarity and focus. Chaos, conquered!",
        category: "Community Insights Powered",
    },
];

const techStack = [
    { name: "Vite", icon: <Zap className="w-10 h-10 text-yellow-400" /> },
    { name: "React", icon: <Layers className="w-10 h-10 text-sky-400" /> },
    { name: "TypeScript", icon: <Code className="w-10 h-10 text-blue-400" /> },
    {
        name: "Tailwind CSS",
        icon: <Wind className="w-10 h-10 text-teal-400" />,
    },
    {
        name: "Convex",
        icon: <Database className="w-10 h-10 text-purple-400" />,
    },
    {
        name: "Tauri v2",
        icon: <Rocket className="w-10 h-10 text-orange-500" />,
    },
];

const supportedModels = [
    {
        provider: "OpenAI",
        icon: <Paintbrush className="w-6 h-6 mr-2 text-green-400" />,
        color: "bg-green-500/20 border-green-500",
        models: [
            {
                id: "gpt-4o-mini",
                name: "GPT-4o Mini",
                description: "Blazing fast & hyper-efficient for most tasks.",
                icon: <Zap className="w-5 h-5 text-green-400" />,
            },
            {
                id: "gpt-4",
                name: "GPT-4",
                description:
                    "The titan of complex reasoning and deep understanding.",
                icon: <Brain className="w-5 h-5 text-green-300" />,
            },
            {
                id: "gpt-4-turbo",
                name: "GPT-4 Turbo",
                description:
                    "The latest GPT-4, supercharged for peak performance.",
                icon: <Brain className="w-5 h-5 text-green-200" />,
            },
        ],
    },
    {
        provider: "Google",
        icon: <Atom className="w-6 h-6 mr-2 text-sky-400" />,
        color: "bg-sky-500/20 border-sky-500",
        models: [
            {
                id: "gemini-2.5-flash-preview-04-17",
                name: "Gemini 2.5 Flash",
                description:
                    "Google's speedster for efficient, high-quality AI.",
                icon: <Sparkles className="w-5 h-5 text-sky-400" />,
            },
            {
                id: "gemini-2.5-pro-preview-06-05",
                name: "Gemini 2.5 Pro Preview",
                description: "Advanced reasoning & next-gen multimodal power.",
                icon: <Atom className="w-5 h-5 text-sky-300" />,
            },
            {
                id: "gemma-3n-e4b-it",
                name: "Gemma 3N E4B IT",
                description:
                    "Specialized instruction-following model by Google.",
                icon: <Lightbulb className="w-5 h-5 text-sky-200" />,
            },
        ],
    },
    {
        provider: "Anthropic",
        icon: <Shuffle className="w-6 h-6 mr-2 text-purple-400" />,
        color: "bg-purple-500/20 border-purple-500",
        models: [
            {
                id: "claude-3-sonnet",
                name: "Claude 3 Sonnet",
                description:
                    "Harmonizing performance, intelligence, and safety.",
                icon: <Palette className="w-5 h-5 text-purple-400" />,
            },
            {
                id: "claude-3-haiku",
                name: "Claude 3 Haiku",
                description:
                    "Lightning-fast, cost-effective, and remarkably capable.",
                icon: <FeatherIcon className="w-5 h-5 text-purple-300" />,
            },
        ],
    },
];

const AnimatedBackground: React.FC = () => (
    <div className="absolute inset-0 overflow-hidden -z-10 opacity-70">
        <div className="absolute -top-1/4 -left-1/4 w-[50vw] h-[50vw] max-w-2xl max-h-2xl bg-purple-700/30 rounded-full filter blur-3xl animate-subtle-pulse-glow animation-delay-0"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-[50vw] h-[50vw] max-w-2xl max-h-2xl bg-sky-700/30 rounded-full filter blur-3xl animate-subtle-pulse-glow animation-delay-2s"></div>
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 w-[40vw] h-[40vw] max-w-xl max-h-xl bg-pink-700/20 rounded-full filter blur-3xl animate-subtle-pulse-glow animation-delay-4s"></div>
    </div>
);

interface SectionProps {
    id: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
    titleClassName?: string;
    containerClassName?: string;
}

const useIntersectionObserver = (
    options?: IntersectionObserverInit & { once?: boolean }
) => {
    const [target, setTarget] = useState<HTMLElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const { once = true, ...restOptions } = options || {};

    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        if (target) {
            observerRef.current = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                        if (once && observerRef.current) {
                            observerRef.current.unobserve(entry.target);
                        }
                    } else if (!once) {
                        setIsVisible(false);
                    }
                },
                { threshold: 0.1, ...restOptions }
            ); // Default threshold if not in restOptions

            observerRef.current.observe(target);
        }
        return () => observerRef.current?.disconnect();
    }, [target, once, restOptions]);

    const stableSetTarget = useCallback((node: HTMLElement | null) => {
        setTarget(node);
    }, []);

    return { setTarget: stableSetTarget, isVisible };
};

const Section = forwardRef<HTMLElement, SectionProps>(
    (
        {
            id,
            children,
            className = "",
            title,
            titleClassName = "",
            containerClassName = "container mx-auto px-4 relative z-10",
        },
        ref
    ) => {
        const { setTarget, isVisible } = useIntersectionObserver({
            threshold: 0.1,
            once: true,
        });

        const combinedRef = useCallback(
            (node: HTMLElement | null) => {
                setTarget(node);
                if (typeof ref === "function") ref(node);
                else if (ref) ref.current = node;
            },
            [setTarget, ref]
        );

        return (
            <section
                id={id}
                ref={combinedRef}
                className={`py-24 md:py-32 relative overflow-hidden ${className}`}
            >
                {title && (
                    <ScrollAnimatedItem
                        as="h2"
                        animationClasses={{
                            base: "scroll-animate-base",
                            hidden: "scroll-animate-hidden",
                            visible: "scroll-animate-visible",
                        }}
                        className={`text-5xl md:text-6xl lg:text-7xl font-bold text-center mb-20 md:mb-24 bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-pink-400 to-purple-500 animated-gradient-text-fast ${titleClassName}`}
                    >
                        {title}
                    </ScrollAnimatedItem>
                )}
                <div className={`${containerClassName}`}>{children}</div>
            </section>
        );
    }
);
Section.displayName = "Section";

interface ScrollAnimatedItemProps {
    children: React.ReactNode;
    as?: keyof HTMLElementTagNameMap;
    className?: string;
    animationClasses: {
        base: string;
        hidden: string;
        visible: string;
    };
    delay?: number;
    threshold?: number;
    once?: boolean;
    observerOptions?: IntersectionObserverInit;
}

const ScrollAnimatedItem: React.FC<ScrollAnimatedItemProps> = ({
    children,
    as: Tag = "div",
    className = "",
    animationClasses,
    delay = 0,
    threshold = 0.1,
    once = true,
    observerOptions,
}) => {
    const { setTarget, isVisible } = useIntersectionObserver(
        observerOptions || { threshold, once }
    );

    return (
        <Tag
            ref={setTarget}
            className={`${className} ${animationClasses.base} ${isVisible ? animationClasses.visible : animationClasses.hidden}`}
            style={{ transitionDelay: isVisible ? `${delay}ms` : "0ms" }}
        >
            {children}
        </Tag>
    );
};

interface CTAButtonProps {
    onClick: () => void;
    text: string;
    className?: string;
    icon?: React.ReactNode;
    style?: React.CSSProperties;
}

const CTAButton = forwardRef<HTMLButtonElement, CTAButtonProps>(
    ({ onClick, text, className = "", icon, style }, ref) => (
        <button
            ref={ref}
            onClick={onClick}
            className={`bg-gradient-to-r from-sky-500 via-purple-600 to-pink-600 hover:from-sky-600 hover:via-purple-700 hover:to-pink-700 text-white font-semibold px-8 py-3.5 text-md md:text-lg rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-sky-500/50 ${className}`}
            style={style}
        >
            {text}{" "}
            {icon ? icon : <ArrowRight className="inline w-5 h-5 ml-2" />}
        </button>
    )
);
CTAButton.displayName = "CTAButton";

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
    icon,
    title,
    description,
}) => {
    return (
        <div
            className={`bg-slate-800/70 backdrop-blur-md p-6 rounded-xl border border-slate-700/80 card-hover-effect h-full`}
        >
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 text-white mb-5 shadow-lg">
                {icon}
            </div>
            <h3 className="text-xl font-semibold text-sky-300 mb-2">{title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
                {description}
            </p>
        </div>
    );
};

interface JourneyStepItem {
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode; // Accommodates string or JSX
    alignment: "left" | "right";
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
    const [detectedOS, setDetectedOS] = useState<string | null>(null);

    useEffect(() => {
        const getOS = (): string => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            if (userAgent.includes("windows nt")) return "Windows";
            if (userAgent.includes("macintosh")) return "MacOS";
            if (userAgent.includes("linux") && !userAgent.includes("android"))
                return "Linux";
            if (userAgent.includes("android")) return "Android";
            if (userAgent.includes("iphone") || userAgent.includes("ipad"))
                return "iOS";
            return "Web";
        };
        setDetectedOS(getOS());
    }, []);

    const journeySteps: JourneyStepItem[] = [
        {
            icon: <Lightbulb className="w-5 h-5" />,
            title: "The Spark: An AI Portfolio",
            description:
                "My journey began with a personal mission: build basit.chat, an AI portfolio to solve the 'stateless resume' challenge, showcase my skills distinctively, and truly stand out in a competitive job market. Deep research into AI chat interfaces was the first step.",
            alignment: "left",
        },
        {
            icon: <Eye className="w-5 h-5" />,
            title: "Theo's Feedback Call & Pivot",
            description: (
                <>
                    Then, I saw Theo's post seeking community feedback on{" "}
                    <a
                        href="https://3Tee.chat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 underline"
                    >
                        3Tee.chat
                    </a>
                    . He mentioned issues with AI tools analyzing replies.
                    Recognizing a real-time problem I could tackle, I pivoted.
                    My focus shifted to scraping and analyzing hundreds of
                    replies to provide clean, categorized insights.
                </>
            ),
            alignment: "right",
        },
        {
            icon: <Crown className="w-5 h-5" />,
            title: "The 3Tee Cloneathon Emerges",
            description:
                "Mid-analysis, the 3Tee Cloneathon was announced – a perfect confluence of my existing work and a new, exciting challenge. It felt like destiny!",
            alignment: "left",
        },
        {
            icon: <ThumbsUp className="w-5 h-5" />,
            title: "Good Faith & The Main Quest",
            description:
                "I completed the feedback analysis anyway and shared it via a GitHub Gist as an act of good faith. With that done, the Cloneathon itself became the main quest: to build the AI chat clone the community was truly asking for, based on those very insights.",
            alignment: "right",
        },
        {
            icon: <Rocket className="w-5 h-5" />,
            title: "10 Days of Hyper-Development",
            description:
                "An insane deadline fueled an adrenaline-driven sprint. Leveraging a reusable engine, Convex for backend, and Tauri for cross-platform magic, the vision rapidly materialized into this 3Tee Chat Clone – a testament to focused effort and modern tooling.",
            alignment: "left",
        },
    ];

    const finalChecklist = [
        {
            text: "Diverse AI Model Support",
            icon: <CheckCircle className="w-5 h-5 mr-2 text-green-400" />,
        },
        {
            text: "Truly Cross-Platform",
            icon: <CheckCircle className="w-5 h-5 mr-2 text-green-400" />,
        },
        {
            text: "Community Insights Powered",
            icon: <CheckCircle className="w-5 h-5 mr-2 text-green-400" />,
        },
        {
            text: "Blazing Fast & Smooth",
            icon: <CheckCircle className="w-5 h-5 mr-2 text-green-400" />,
        },
    ];

    const GENERIC_ANIMATION = {
        base: "scroll-animate-base",
        hidden: "scroll-animate-hidden",
        visible: "scroll-animate-visible",
    };
    const SCALE_ANIMATION = {
        base: "scroll-animate-base",
        hidden: "scroll-animate-scale-hidden",
        visible: "scroll-animate-scale-visible",
    };
    const LEFT_ANIMATION = {
        base: "scroll-animate-base",
        hidden: "scroll-animate-left-hidden",
        visible: "scroll-animate-left-visible",
    };
    const RIGHT_ANIMATION = {
        base: "scroll-animate-base",
        hidden: "scroll-animate-right-hidden",
        visible: "scroll-animate-right-visible",
    };

    const platformDisplay = [
        {
            name: "Android",
            icon: (
                <Smartphone
                    size={18}
                    className="inline mr-1.5 text-green-400"
                />
            ),
            color: "text-green-400",
        },
        {
            name: "iOS",
            icon: (
                <Smartphone
                    size={18}
                    className="inline mr-1.5 text-slate-400"
                />
            ),
            color: "text-slate-400",
        },
        {
            name: "Windows",
            icon: <Laptop size={18} className="inline mr-1.5 text-blue-400" />,
            color: "text-blue-400",
        },
        {
            name: "MacOS",
            icon: <Laptop size={18} className="inline mr-1.5 text-gray-300" />,
            color: "text-gray-300",
        },
        {
            name: "Linux",
            icon: (
                <Server size={18} className="inline mr-1.5 text-orange-400" />
            ),
            color: "text-orange-400",
        },
        {
            name: "Web",
            icon: (
                <Layers size={18} className="inline mr-1.5 text-purple-400" />
            ),
            color: "text-purple-400",
        },
    ];

    return (
        <>
            <style>{landingPageStyles}</style>
            <div className="min-h-screen flex flex-col items-center justify-center text-slate-100 overflow-x-hidden selection:bg-sky-500 selection:text-white">
                <AnimatedBackground />

                <Section
                    id="hero"
                    className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-12 md:pt-0 bg-grid-pattern-darker"
                    containerClassName="container mx-auto px-4 relative z-10 flex flex-col items-center justify-center"
                >
                    <div className="relative z-10">
                        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold mb-6 animate-hero-float">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-pink-400 to-purple-500 animated-gradient-text-fast leading-tight">
                                3Tee Chat Clone
                            </span>
                        </h1>
                        <div className="text-xl md:text-2xl lg:text-3xl text-slate-200 mb-4 max-w-4xl mx-auto font-medium">
                            <ScrollAnimatedItem
                                as="span"
                                animationClasses={GENERIC_ANIMATION}
                                delay={200}
                                className="inline-block mr-2"
                            >
                                An AI Chat Experience,
                            </ScrollAnimatedItem>
                            <ScrollAnimatedItem
                                as="span"
                                animationClasses={GENERIC_ANIMATION}
                                delay={350}
                                className="inline-block mr-2"
                            >
                                <span className="text-sky-400">
                                    Feedback-Forged
                                </span>
                                .
                            </ScrollAnimatedItem>
                            <ScrollAnimatedItem
                                as="span"
                                animationClasses={GENERIC_ANIMATION}
                                delay={500}
                                className="inline-block"
                            >
                                Universally{" "}
                                <span className="text-sky-400">
                                    Cross-Platform
                                </span>
                                .
                            </ScrollAnimatedItem>
                        </div>
                        <ScrollAnimatedItem
                            as="p"
                            animationClasses={GENERIC_ANIMATION}
                            delay={650}
                            className="text-lg md:text-xl text-sky-300 mb-4 max-w-3xl mx-auto"
                        >
                            <p className="text-lg md:text-xl text-sky-400 mb-10 max-w-2xl mx-auto">
                                Runs on Web, Desktop, and Mobile from a{" "}
                                <span className="font-bold">
                                    single, reusable codebase
                                </span>
                                .
                            </p>
                        </ScrollAnimatedItem>
                        <ScrollAnimatedItem
                            animationClasses={GENERIC_ANIMATION}
                            delay={1200}
                            className="flex flex-col sm:flex-row gap-5 justify-center items-center"
                        >
                            <CTAButton
                                onClick={onGetStarted}
                                text="Launch Chat"
                                icon={
                                    <ArrowUpRight className="inline w-5 h-5 ml-1.5" />
                                }
                            />
                            <a
                                href="https://github.com/mabdulbasit/3tee-chat-clone"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border-2 border-sky-500 text-sky-300 hover:bg-sky-500/20 hover:text-sky-200 font-semibold px-8 py-3.5 text-md md:text-lg rounded-xl shadow-lg hover:shadow-md transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 flex items-center"
                            >
                                <Github className="inline w-5 h-5 mr-2" /> View
                                Source
                            </a>
                        </ScrollAnimatedItem>
                    </div>
                </Section>

                <Section
                    id="journey"
                    title="My 10-Day Development Sprint"
                    containerClassName="container mx-auto px-4 relative z-10"
                >
                    <div className="max-w-4xl mx-auto relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-slate-700/50 transform -translate-x-1/2 hidden md:block rounded-full"></div>
                        {journeySteps.map((step, index) => (
                            <div
                                key={step.title}
                                className={`mb-12 md:flex items-stretch w-full ${step.alignment === "left" ? "md:flex-row-reverse" : ""}`}
                            >
                                <div className="md:w-1/2"></div>{" "}
                                {/* Spacer for timeline visual */}
                                <ScrollAnimatedItem
                                    animationClasses={
                                        step.alignment === "left"
                                            ? LEFT_ANIMATION
                                            : RIGHT_ANIMATION
                                    }
                                    delay={index * 150}
                                    className={`md:w-1/2 ${step.alignment === "left" ? "md:pr-10" : "md:pl-10"}`}
                                >
                                    <div className="p-6 md:p-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl card-hover-effect h-full">
                                        <div
                                            className={`flex items-center mb-4 ${step.alignment === "left" ? "md:justify-end" : ""}`}
                                        >
                                            <span
                                                className={`flex items-center justify-center w-12 h-12 rounded-full bg-sky-500 text-white shadow-lg ${step.alignment === "left" ? "md:ml-4 md:order-2" : "mr-4 md:order-1"}`}
                                            >
                                                {step.icon}
                                            </span>
                                            <h3
                                                className={`text-2xl font-semibold text-sky-400 ${step.alignment === "left" ? "md:text-right md:order-1" : "md:text-left md:order-2"}`}
                                            >
                                                {step.title}
                                            </h3>
                                        </div>
                                        <div
                                            className={`text-slate-300 leading-relaxed ${step.alignment === "left" ? "md:text-right" : "md:text-left"}`}
                                        >
                                            {step.description}
                                        </div>
                                    </div>
                                </ScrollAnimatedItem>
                            </div>
                        ))}
                    </div>
                    <ScrollAnimatedItem
                        animationClasses={SCALE_ANIMATION}
                        delay={journeySteps.length * 150}
                        className="text-center mt-16"
                    >
                        <CTAButton
                            onClick={onGetStarted}
                            text="See it in Action"
                            className="text-lg px-10 py-4"
                        />
                    </ScrollAnimatedItem>
                </Section>

                <Section id="models" title="A Universe of AI Models">
                    <ScrollAnimatedItem
                        as="p"
                        animationClasses={GENERIC_ANIMATION}
                        delay={0}
                        className="text-center text-slate-300 text-lg mb-16 max-w-3xl mx-auto"
                    >
                        Unleash the power of choice! Connect to an
                        ever-expanding roster of premier AI models from the
                        world's leading providers. You *can*{" "}
                        <strong className="text-sky-400">
                            Bring Your Own Key (BYOK)
                        </strong>{" "}
                        for ultimate control, or use available models
                        seamlessly.
                    </ScrollAnimatedItem>
                    <div className="space-y-16">
                        {supportedModels.map((providerGroup, groupIndex) => (
                            <ScrollAnimatedItem
                                key={providerGroup.provider}
                                animationClasses={SCALE_ANIMATION}
                                delay={groupIndex * 200}
                            >
                                <h3
                                    className={`text-4xl font-bold text-center mb-10 flex items-center justify-center`}
                                >
                                    {providerGroup.icon}
                                    <span
                                        className={`ml-3 p-3 rounded-lg ${providerGroup.color.replace("/20", "/40")} text-slate-50 shadow-md`}
                                    >
                                        {providerGroup.provider}
                                    </span>
                                </h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {providerGroup.models.map(
                                        (model, modelIndex) => (
                                            <ScrollAnimatedItem
                                                key={model.id}
                                                animationClasses={
                                                    GENERIC_ANIMATION
                                                }
                                                delay={
                                                    groupIndex * 100 +
                                                    modelIndex * 100
                                                }
                                                className={`bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl border-2 ${providerGroup.color} card-hover-effect h-full`}
                                            >
                                                <div className="flex items-center mb-4">
                                                    <span
                                                        className={`p-2.5 rounded-lg mr-4 shadow-sm ${providerGroup.color.replace("/20", "/80")}`}
                                                    >
                                                        {model.icon}
                                                    </span>
                                                    <h4 className="text-xl font-semibold text-slate-100">
                                                        {model.name}
                                                    </h4>
                                                </div>
                                                <p className="text-slate-400 text-sm">
                                                    {model.description}
                                                </p>
                                            </ScrollAnimatedItem>
                                        )
                                    )}
                                </div>
                            </ScrollAnimatedItem>
                        ))}
                    </div>
                    <ScrollAnimatedItem
                        animationClasses={SCALE_ANIMATION}
                        delay={300}
                        className="text-center mt-20"
                    >
                        <CTAButton
                            onClick={onGetStarted}
                            text="Pick Your Model & Start"
                            className="text-lg px-10 py-4"
                        />
                    </ScrollAnimatedItem>
                </Section>

                <Section id="tech" title="Futuristic Architecture">
                    <ScrollAnimatedItem
                        as="p"
                        animationClasses={GENERIC_ANIMATION}
                        delay={0}
                        className="text-center text-slate-300 text-lg mb-12 max-w-3xl mx-auto"
                    >
                        Engineered for excellence on a robust PNPM monorepo,
                        featuring a versatile "engine" of shared components and
                        logic. This isn't just an app; it's a platform I built.
                    </ScrollAnimatedItem>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-16">
                        {techStack.map((tech, index) => (
                            <ScrollAnimatedItem
                                key={tech.name}
                                animationClasses={GENERIC_ANIMATION}
                                delay={index * 100}
                                className="flex flex-col items-center p-6 bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700 card-hover-effect"
                            >
                                {tech.icon}
                                <span className="mt-4 font-semibold text-slate-200 text-lg">
                                    {tech.name}
                                </span>
                            </ScrollAnimatedItem>
                        ))}
                    </div>
                    <ScrollAnimatedItem
                        animationClasses={SCALE_ANIMATION}
                        delay={300}
                        className="text-center mt-12"
                    >
                        <h3 className="text-3xl lg:text-4xl font-semibold text-sky-300 mb-6">
                            ONE Codebase, EVERY Platform!
                        </h3>
                        <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
                            Native desktop apps for{" "}
                            <strong className="text-gray-300">
                                Windows, MacOS, Linux
                            </strong>
                            , blazing-fast mobile apps for{" "}
                            <strong className="text-green-400">
                                Android & iOS
                            </strong>
                            , and a stunning{" "}
                            <strong className="text-purple-400">Web</strong>{" "}
                            experience. All from a single, beautifully
                            engineered codebase I created.
                        </p>
                        <div className="flex justify-center flex-wrap gap-6">
                            {[
                                {
                                    name: "Windows",
                                    icon: (
                                        <Laptop className="w-12 h-12 text-blue-400" />
                                    ),
                                },
                                {
                                    name: "MacOS",
                                    icon: (
                                        <Laptop className="w-12 h-12 text-slate-400" />
                                    ),
                                },
                                {
                                    name: "Linux",
                                    icon: (
                                        <Server className="w-12 h-12 text-orange-400" />
                                    ),
                                },
                                {
                                    name: "Android",
                                    icon: (
                                        <Smartphone className="w-12 h-12 text-green-400" />
                                    ),
                                },
                                {
                                    name: "iOS",
                                    icon: (
                                        <Smartphone className="w-12 h-12 text-red-400" />
                                    ),
                                },
                                {
                                    name: "Web",
                                    icon: (
                                        <Layers className="w-12 h-12 text-purple-400" />
                                    ),
                                },
                            ].map((platform, index) => (
                                <ScrollAnimatedItem
                                    key={platform.name}
                                    animationClasses={GENERIC_ANIMATION}
                                    delay={index * 80}
                                    className="flex flex-col items-center p-4 rounded-lg bg-slate-800/50 border border-slate-700 min-w-[100px] card-hover-effect"
                                >
                                    {platform.icon}
                                    <span className="mt-2 text-slate-300 font-medium">
                                        {platform.name}
                                    </span>
                                </ScrollAnimatedItem>
                            ))}
                        </div>
                    </ScrollAnimatedItem>

                    {detectedOS && (
                        <ScrollAnimatedItem
                            animationClasses={SCALE_ANIMATION}
                            delay={200}
                            className="mt-16 text-center p-6 bg-slate-800/50 rounded-xl border border-slate-700/70"
                        >
                            <h4 className="text-2xl font-semibold text-sky-300 mb-6">
                                Download 3Tee Chat
                            </h4>
                            <CTAButton
                                onClick={() =>
                                    alert(
                                        `Preparing download for ${detectedOS}... (Actual link not implemented yet)`
                                    )
                                }
                                text={`Download for ${detectedOS}`}
                                icon={
                                    <DownloadCloud className="inline w-5 h-5 ml-2" />
                                }
                                className="mb-6 mx-auto"
                            />
                            <p className="text-slate-400 mb-3 text-sm">
                                Or choose another platform:
                            </p>
                            <div className="flex flex-wrap justify-center gap-3">
                                {[
                                    "Windows",
                                    "MacOS",
                                    "Linux",
                                    "Android",
                                    "iOS",
                                    "Web",
                                ].map(
                                    (os) =>
                                        os !== detectedOS && (
                                            <button
                                                key={os}
                                                onClick={() =>
                                                    os === "Web"
                                                        ? window.open(
                                                              "https://3tee-chat-clone.vercel.app/",
                                                              "_blank"
                                                          )
                                                        : alert(
                                                              `Preparing download for ${os}... (Actual link not implemented yet)`
                                                          )
                                                }
                                                className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2.5 px-5 rounded-lg transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 shadow-md hover:shadow-lg text-sm"
                                            >
                                                {os === "Web"
                                                    ? "Open Web App"
                                                    : os}
                                            </button>
                                        )
                                )}
                            </div>
                        </ScrollAnimatedItem>
                    )}
                </Section>

                <Section id="features" title="Experience the Cutting Edge">
                    <div className="container mx-auto px-4">
                        {(
                            [
                                "Core Staples",
                                "Power-Packed Features",
                                "Community Insights Powered",
                            ] as const
                        ).map((category, catIndex) => (
                            <div key={category} className="mb-20">
                                <ScrollAnimatedItem
                                    as="h3"
                                    animationClasses={GENERIC_ANIMATION}
                                    delay={catIndex * 100}
                                    className="text-4xl md:text-5xl font-semibold text-center mb-12 text-sky-400"
                                >
                                    {category}
                                </ScrollAnimatedItem>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
                                    {featuresList
                                        .filter((f) => f.category === category)
                                        .map((feature, index) => (
                                            <ScrollAnimatedItem
                                                key={feature.title}
                                                animationClasses={
                                                    GENERIC_ANIMATION
                                                }
                                                delay={
                                                    catIndex * 100 + index * 100
                                                }
                                                className="h-full" // Ensure ScrollAnimatedItem takes full height for card
                                            >
                                                <FeatureCard
                                                    icon={feature.icon}
                                                    title={feature.title}
                                                    description={
                                                        feature.description
                                                    }
                                                />
                                            </ScrollAnimatedItem>
                                        ))}
                                </div>
                            </div>
                        ))}
                        <ScrollAnimatedItem
                            animationClasses={SCALE_ANIMATION}
                            delay={300}
                            className="text-center mt-12"
                        >
                            <CTAButton
                                onClick={onGetStarted}
                                text="Explore All Features"
                                className="text-lg px-10 py-4"
                            />
                        </ScrollAnimatedItem>
                    </div>
                </Section>

                <Section
                    id="origin"
                    title="Genesis: The AI Portfolio Spark"
                    className="bg-slate-900/50"
                >
                    <div className="container mx-auto px-4 text-center">
                        <ScrollAnimatedItem
                            as="p"
                            animationClasses={GENERIC_ANIMATION}
                            delay={100}
                            className="text-slate-300 text-lg md:text-xl mb-10 max-w-3xl mx-auto"
                        >
                            This whole adventure kicked off with basit.chat – my
                            personal AI-powered portfolio. The goal was to break
                            free from static resumes, create an interactive way
                            to showcase my skills distinctively, and truly stand
                            out. That core engine, built for versatility, is the
                            same one powering this 3Tee Clone. It's proof of how
                            a personal solution can evolve into something much
                            bigger!
                        </ScrollAnimatedItem>
                        <ScrollAnimatedItem
                            animationClasses={GENERIC_ANIMATION}
                            delay={300}
                        >
                            <CTAButton
                                onClick={() =>
                                    window.open("https://basit.chat", "_blank")
                                }
                                text="Chat with My AI Portfolio"
                                icon={
                                    <ArrowRight className="inline w-6 h-6 ml-2" />
                                }
                                className="text-lg" // Removed custom gradient, uses default CTA style
                            />
                        </ScrollAnimatedItem>
                        <ScrollAnimatedItem
                            animationClasses={SCALE_ANIMATION}
                            delay={500}
                            className="mt-16"
                        >
                            <img
                                src="https://placehold.co/800x450/1e293b/94a3b8?text=basit.chat+Showcase"
                                alt="AI Portfolio Mockup showcasing a chat interface"
                                className="rounded-xl shadow-2xl border-4 border-slate-700 mx-auto transform transition-transform duration-500 hover:scale-105 card-hover-effect"
                            />
                        </ScrollAnimatedItem>
                    </div>
                </Section>

                <footer className="w-full py-16 bg-slate-950 border-t border-slate-800/50 mt-10">
                    <div className="container mx-auto px-4 text-center">
                        <ScrollAnimatedItem
                            animationClasses={GENERIC_ANIMATION}
                            delay={0}
                            className="mb-12"
                        >
                            <h3 className="text-3xl font-bold text-sky-300 mb-6">
                                Experience the Difference
                            </h3>
                            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-md text-slate-300">
                                {finalChecklist.map((item) => (
                                    <span
                                        key={item.text}
                                        className="flex items-center"
                                    >
                                        {item.icon} {item.text}
                                    </span>
                                ))}
                            </div>
                        </ScrollAnimatedItem>

                        <ScrollAnimatedItem
                            animationClasses={SCALE_ANIMATION}
                            delay={200}
                        >
                            <CTAButton
                                onClick={onGetStarted}
                                text="Try 3Tee Chat NOW!"
                                icon={
                                    <Rocket className="inline w-6 h-6 ml-2" />
                                }
                                className="text-xl px-12 py-5 mb-10"
                            />
                        </ScrollAnimatedItem>

                        <ScrollAnimatedItem
                            animationClasses={GENERIC_ANIMATION}
                            delay={400}
                            className="text-slate-500"
                        >
                            <p>
                                &copy; {new Date().getFullYear()} 3Tee Chat
                                Clone. A{" "}
                                <strong className="text-sky-400">
                                    10-Day Development Marvel
                                </strong>{" "}
                                for the 3Tee Cloneathon.
                            </p>
                            <p className="text-sm mt-2">
                                This is a demonstration of pure coding passion.
                                Not affiliated with the original 3Tee.chat
                            </p>
                            <div className="mt-6 flex justify-center space-x-6">
                                <a
                                    href="https://github.com/mabdulbasit/3tee-chat-clone"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-sky-400 transition-colors duration-200 flex items-center hover:scale-105 hover:-translate-y-0.5 p-2 rounded-md transform"
                                >
                                    <Github className="w-6 h-6 mr-2" /> View
                                    Source
                                </a>
                                <a
                                    href="https://cloneathon.3Tee.chat/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-sky-400 transition-colors duration-200 flex items-center hover:scale-105 hover:-translate-y-0.5 p-2 rounded-md transform"
                                >
                                    <Lightbulb className="w-6 h-6 mr-2" />{" "}
                                    Cloneathon Info
                                </a>
                            </div>
                        </ScrollAnimatedItem>
                    </div>
                </footer>
            </div>
        </>
    );
}
