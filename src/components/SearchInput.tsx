import { Search } from "lucide-react";
import { forwardRef } from "react";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
    value,
    onChange,
    placeholder,
    autoFocus,
}, ref) => {
    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
            <input
                ref={ref}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Search..."}
                autoFocus={autoFocus}
                className="w-full pl-10 pr-4 py-2 bg-purple-600/10 border border-purple-600/30 rounded-lg text-purple-100 placeholder-purple-400/80 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
        </div>
    );
});

SearchInput.displayName = "SearchInput";