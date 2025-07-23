import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { SearchInput } from "./SearchInput";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { 
    Search, 
    Filter, 
    Star, 
    Archive, 
    Users, 
    MessageSquare, 
    Calendar,
    X,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

interface AdvancedSearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectChat: (chatId: Id<"chats">) => void;
}

interface SearchFilters {
    includeContent: boolean;
    includeAttachments: boolean;
    includeArchived: boolean;
    includeStarred: boolean;
    includeShared: boolean;
    includeTemporary: boolean;
    modelFilter: string;
    dateRange: string;
    minMessages: number;
    maxMessages: number;
}

const defaultFilters: SearchFilters = {
    includeContent: true,
    includeAttachments: false,
    includeArchived: false,
    includeStarred: true,
    includeShared: true,
    includeTemporary: true,
    modelFilter: "all",
    dateRange: "all",
    minMessages: 0,
    maxMessages: 1000,
};

export function AdvancedSearchModal({ open, onOpenChange, onSelectChat }: AdvancedSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Queries for different data types
    const allChats = useQuery(api.chats.listChats);
    const sharedContent = useQuery(api.sharing.getUserSharedContent);
    
    // Advanced search query - will need to implement in backend
    const searchResults = useQuery(
        api.chats.advancedSearch,
        searchQuery.trim() ? {
            query: searchQuery.trim(),
            filters: filters,
            tab: activeTab
        } : "skip"
    );

    // Filter available models for dropdown
    const availableModels = useMemo(() => {
        if (!allChats) return [];
        const models = new Set<string>();
        [...allChats.regular, ...allChats.starred, ...allChats.archived].forEach(chat => {
            if (chat.model) models.add(chat.model);
        });
        return Array.from(models).sort();
    }, [allChats]);

    // Reset filters when modal closes
    useEffect(() => {
        if (!open) {
            setSearchQuery("");
            setActiveTab("all");
            setFilters(defaultFilters);
            setShowAdvancedFilters(false);
        }
    }, [open]);

    const updateFilter = (key: keyof SearchFilters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters(defaultFilters);
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (!filters.includeArchived) count++;
        if (!filters.includeStarred) count++;
        if (!filters.includeShared) count++;
        if (!filters.includeTemporary) count++;
        if (filters.modelFilter !== "all") count++;
        if (filters.dateRange !== "all") count++;
        if (filters.minMessages > 0 || filters.maxMessages < 1000) count++;
        if (filters.includeContent || filters.includeAttachments) count++;
        return count;
    };

    const handleSelectChat = (chatId: Id<"chats">) => {
        onSelectChat(chatId);
        onOpenChange(false);
    };

    const renderSearchResults = (results: any[] = []) => {
        if (!searchQuery.trim()) {
            return (
                <div className="text-center py-12 text-purple-300">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Start typing to search your chats...</p>
                </div>
            );
        }

        if (results.length === 0) {
            return (
                <div className="text-center py-12 text-purple-300">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No results found</p>
                    <p className="text-sm text-purple-400 mt-2">Try adjusting your filters or search terms</p>
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {results.map((result: any) => (
                    <div
                        key={result._id}
                        onClick={() => handleSelectChat(result._id)}
                        className="p-4 rounded-lg bg-purple-600/10 border border-purple-600/20 hover:bg-purple-600/20 cursor-pointer transition-colors group"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium text-purple-100 truncate">
                                        {result.title}
                                    </h3>
                                    <div className="flex items-center gap-1">
                                        {result.isStarred && <Star className="w-3 h-3 text-yellow-400 fill-current" />}
                                        {result.isArchived && <Archive className="w-3 h-3 text-blue-400" />}
                                        {result.isShared && <Users className="w-3 h-3 text-green-400" />}
                                        {result.isTemporary && (
                                            <Badge variant="outline" className="text-xs py-0 px-1 border-orange-500/30 text-orange-300">
                                                Temp
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-purple-400">
                                    <span>{result.model}</span>
                                    <span>•</span>
                                    <span>{new Date(result.updatedAt).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{result.messageCount} messages</span>
                                </div>
                                {result.matchedContent && (
                                    <p className="text-sm text-purple-300 mt-2 line-clamp-2">
                                        ...{result.matchedContent}...
                                    </p>
                                )}
                                {result.matchedAttachments && result.matchedAttachments.length > 0 && (
                                    <div className="flex items-center gap-1 mt-2">
                                        <Badge variant="outline" className="text-xs">
                                            📎 {result.matchedAttachments.length} attachment{result.matchedAttachments.length > 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-transparent backdrop-blur-lg border border-purple-600/30 text-purple-100 max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-purple-400" />
                            <span>Advanced Search</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {getActiveFilterCount() > 0 && (
                                <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                                    {getActiveFilterCount()} filter{getActiveFilterCount() > 1 ? 's' : ''}
                                </Badge>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className="text-purple-300 hover:text-purple-100"
                            >
                                <Filter className="w-4 h-4 mr-1" />
                                Filters
                                {showAdvancedFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="space-y-3">
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search chats, messages, attachments..."
                            autoFocus
                        />

                        {/* Advanced Filters */}
                        {showAdvancedFilters && (
                            <div className="p-4 bg-purple-600/10 rounded-lg border border-purple-600/20 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-purple-200">Search Options</h4>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetFilters}
                                        className="text-purple-400 hover:text-purple-200"
                                    >
                                        Reset
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="space-y-3">
                                        <Label className="text-purple-200">Include in Search</Label>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-purple-300">Message content</span>
                                                <Switch
                                                    checked={filters.includeContent}
                                                    onCheckedChange={(checked) => updateFilter("includeContent", checked)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-purple-300">Attachments</span>
                                                <Switch
                                                    checked={filters.includeAttachments}
                                                    onCheckedChange={(checked) => updateFilter("includeAttachments", checked)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-purple-200">Chat Types</Label>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-purple-300">Starred</span>
                                                <Switch
                                                    checked={filters.includeStarred}
                                                    onCheckedChange={(checked) => updateFilter("includeStarred", checked)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-purple-300">Archived</span>
                                                <Switch
                                                    checked={filters.includeArchived}
                                                    onCheckedChange={(checked) => updateFilter("includeArchived", checked)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-purple-300">Shared</span>
                                                <Switch
                                                    checked={filters.includeShared}
                                                    onCheckedChange={(checked) => updateFilter("includeShared", checked)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-purple-300">Temporary</span>
                                                <Switch
                                                    checked={filters.includeTemporary}
                                                    onCheckedChange={(checked) => updateFilter("includeTemporary", checked)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-purple-200">Filters</Label>
                                        <div className="space-y-2">
                                            <Select
                                                value={filters.modelFilter}
                                                onValueChange={(value) => updateFilter("modelFilter", value)}
                                            >
                                                <SelectTrigger className="bg-purple-800/30 border-purple-600/30">
                                                    <SelectValue placeholder="Any model" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-gray-800 border-purple-600/30">
                                                    <SelectItem value="all">Any model</SelectItem>
                                                    {availableModels.map(model => (
                                                        <SelectItem key={model} value={model}>
                                                            {model}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={filters.dateRange}
                                                onValueChange={(value) => updateFilter("dateRange", value)}
                                            >
                                                <SelectTrigger className="bg-purple-800/30 border-purple-600/30">
                                                    <SelectValue placeholder="Any time" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-gray-800 border-purple-600/30">
                                                    <SelectItem value="all">Any time</SelectItem>
                                                    <SelectItem value="today">Today</SelectItem>
                                                    <SelectItem value="week">This week</SelectItem>
                                                    <SelectItem value="month">This month</SelectItem>
                                                    <SelectItem value="year">This year</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-6 bg-purple-600/20">
                            <TabsTrigger value="all" className="text-purple-200">
                                All
                            </TabsTrigger>
                            <TabsTrigger value="starred" className="text-purple-200">
                                <Star className="w-4 h-4 mr-1" />
                                Starred
                            </TabsTrigger>
                            <TabsTrigger value="regular" className="text-purple-200">
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Regular
                            </TabsTrigger>
                            <TabsTrigger value="archived" className="text-purple-200">
                                <Archive className="w-4 h-4 mr-1" />
                                Archived
                            </TabsTrigger>
                            <TabsTrigger value="shared" className="text-purple-200">
                                <Users className="w-4 h-4 mr-1" />
                                Shared
                            </TabsTrigger>
                            <TabsTrigger value="temporary" className="text-purple-200">
                                <Calendar className="w-4 h-4 mr-1" />
                                Temp
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto mt-4">
                            <TabsContent value="all" className="mt-0">
                                {renderSearchResults(searchResults)}
                            </TabsContent>
                            <TabsContent value="starred" className="mt-0">
                                {renderSearchResults(searchResults?.filter((r: any) => r.isStarred))}
                            </TabsContent>
                            <TabsContent value="regular" className="mt-0">
                                {renderSearchResults(searchResults?.filter((r: any) => !r.isStarred && !r.isArchived && !r.isShared && !r.isTemporary))}
                            </TabsContent>
                            <TabsContent value="archived" className="mt-0">
                                {renderSearchResults(searchResults?.filter((r: any) => r.isArchived))}
                            </TabsContent>
                            <TabsContent value="shared" className="mt-0">
                                {renderSearchResults(searchResults?.filter((r: any) => r.isShared))}
                            </TabsContent>
                            <TabsContent value="temporary" className="mt-0">
                                {renderSearchResults(searchResults?.filter((r: any) => r.isTemporary))}
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}