import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../lib/utils";
import { Copy, Check, WrapText } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface MarkdownRendererProps {
    content: string;
    className?: string;
    isStreaming?: boolean;
}

export function MarkdownRenderer({
    content,
    className,
    isStreaming = false,
}: MarkdownRendererProps) {
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [wrappedCode, setWrappedCode] = useState<Set<string>>(new Set());

    // Process content for streaming - handle incomplete markdown gracefully
    const processedContent = useMemo(() => {
        if (!isStreaming) return content;

        let processed = content;

        // Handle incomplete code blocks during streaming
        const openCodeBlocks = (processed.match(/```/g) || []).length;
        if (openCodeBlocks % 2 !== 0) {
            // We have an incomplete code block, close it temporarily with a streaming indicator
            processed += "\n\n*[...streaming]*\n```";
        }

        // Handle incomplete tables during streaming
        const lines = processed.split("\n");
        let inTable = false;
        let lastTableRow = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes("|") && line.length > 1) {
                if (!inTable) {
                    inTable = true;
                }
                lastTableRow = i;
            } else if (inTable && line === "") {
                inTable = false;
            }
        }

        // If we're in a table and the last line doesn't end properly, add a completion indicator
        if (inTable && lastTableRow === lines.length - 1) {
            const lastLine = lines[lastTableRow];
            if (!lastLine.endsWith("|")) {
                processed += " *[...streaming]* |";
            }
        }

        // Handle incomplete lists during streaming
        const lastLine = lines[lines.length - 1];
        if (
            lastLine &&
            (lastLine.match(/^\s*[-*+]\s*$/) || lastLine.match(/^\s*\d+\.\s*$/))
        ) {
            processed += " *[...streaming]*";
        }

        return processed;
    }, [content, isStreaming]);

    const handleCopyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            toast.success("Code copied to clipboard!");
            setTimeout(() => setCopiedCode(null), 2000);
        } catch {
            toast.error("Failed to copy code");
        }
    };

    const toggleCodeWrap = (codeString: string) => {
        const newWrapped = new Set(wrappedCode);
        if (newWrapped.has(codeString)) {
            newWrapped.delete(codeString);
        } else {
            newWrapped.add(codeString);
        }
        setWrappedCode(newWrapped);
    };

    return (
        <div
            className={cn(
                "prose prose-invert [&>*:last-child]:mb-0",
                className
            )}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code: ({
                        node: _node,
                        className,
                        children,
                        ...props
                    }: any) => {
                        const inline = !className;
                        const match = /language-(\w+)/.exec(className || "");
                        const language = match ? match[1] : "";
                        const codeString = String(children).replace(/\n$/, "");
                        const isWrapped = wrappedCode.has(codeString);

                        return !inline && match ? (
                            <div className="relative group my-4">
                                {/* Sticky Controls Bar */}
                                <div className="sticky top-4 z-10 flex items-center justify-between bg-gray-800/95 backdrop-blur-sm px-4 py-2 rounded-t-lg border-b border-gray-700">
                                    <span className="text-sm text-gray-300 font-medium">
                                        {language}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                toggleCodeWrap(codeString)
                                            }
                                            className="h-6 w-6 p-0"
                                            title={
                                                isWrapped
                                                    ? "Disable text wrapping"
                                                    : "Enable text wrapping"
                                            }
                                        >
                                            <WrapText
                                                className={`w-3 h-3 ${isWrapped ? "text-purple-400" : "text-gray-400"}`}
                                            />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                void handleCopyCode(codeString)
                                            }
                                            className="h-6 w-6 p-0"
                                            title="Copy code"
                                        >
                                            {copiedCode === codeString ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                            ) : (
                                                <Copy className="w-3 h-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Code Block Container with Line Numbers */}
                                <div className="overflow-x-auto relative">
                                    <div className="flex">
                                        {/* Line Numbers Column */}
                                        <div className="select-none min-w-[3rem] bg-gray-900/50 backdrop-blur-sm border-r border-purple-500/20 text-purple-400/60 text-sm font-mono leading-6 px-3 py-3">
                                            {codeString
                                                .split("\n")
                                                .map((_, index) => (
                                                    <div
                                                        key={index}
                                                        className="text-right"
                                                    >
                                                        {index + 1}
                                                    </div>
                                                ))}
                                        </div>

                                        {/* Code Content */}
                                        <div className="flex-1 min-w-0">
                                            <SyntaxHighlighter
                                                style={oneDark}
                                                language={language}
                                                PreTag="div"
                                                className="!mt-0 !rounded-t-none !rounded-l-none !border-l-0"
                                                customStyle={{
                                                    margin: 0,
                                                    borderTopLeftRadius: 0,
                                                    borderTopRightRadius: 0,
                                                    borderBottomLeftRadius: 6,
                                                    borderLeft: "none",
                                                    paddingLeft: "1rem",
                                                    whiteSpace: isWrapped
                                                        ? "pre-wrap"
                                                        : "pre",
                                                    wordBreak: isWrapped
                                                        ? "break-word"
                                                        : "normal",
                                                }}
                                                wrapLines={isWrapped}
                                                wrapLongLines={isWrapped}
                                                showLineNumbers={false} // Disable built-in line numbers since we have custom ones
                                            >
                                                {codeString}
                                            </SyntaxHighlighter>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : inline ? (
                            <code
                                className="bg-purple-500/20 px-1.5 py-0.5 rounded text-purple-200 text-sm font-mono"
                                {...props}
                            >
                                {children}
                            </code>
                        ) : (
                            // Fallback for code blocks without language
                            <code
                                className="block bg-gray-800 p-3 rounded font-mono text-sm text-gray-200 overflow-x-auto"
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => <>{children}</>,
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-purple-100 mb-4 border-b border-purple-500/30 pb-2 last:mb-0">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-purple-100 mb-3 border-b border-purple-500/20 pb-1 last:mb-0">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-medium text-purple-100 mb-2 last:mb-0">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => (
                        <p className="text-purple-200 mb-3 leading-relaxed last:mb-0">
                            {children}
                        </p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside text-purple-200 mb-3 space-y-1 ml-4 last:mb-0">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside text-purple-200 mb-3 space-y-1 ml-4 last:mb-0">
                            {children}
                        </ol>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-purple-500 pl-4 italic text-purple-300 mb-3 bg-purple-500/10 py-2 rounded-r last:mb-0">
                            {children}
                        </blockquote>
                    ),
                    a: ({ children, href }) => (
                        <a
                            href={href}
                            className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {children}
                        </a>
                    ),
                    table: ({ children }) => (
                        <div className="overflow-x-auto mb-3 rounded-lg border border-purple-500/30 last:mb-0">
                            <table className="min-w-full">{children}</table>
                        </div>
                    ),
                    th: ({ children }) => (
                        <th className="border-b border-purple-500/30 px-4 py-3 bg-purple-500/20 text-purple-100 font-semibold text-left">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border-b border-purple-500/20 px-4 py-3 text-purple-200">
                            {children}
                        </td>
                    ),
                    hr: () => (
                        <hr className="border-purple-500/30 my-6 last:mb-0" />
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-purple-100">
                            {children}
                        </strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-purple-200">{children}</em>
                    ),
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}
