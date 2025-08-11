import React, { useState } from "react";
import { format, startOfDay, endOfDay, subDays, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Switch } from "./ui/switch";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface CustomDatePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  showComparison?: boolean;
  onComparisonChange?: (enabled: boolean) => void;
  comparisonRange?: DateRange;
  onComparisonRangeChange?: (range: DateRange) => void;
}

const PRESET_RANGES = [
  {
    label: "Last 7 days",
    getValue: () => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  {
    label: "Last 30 days",
    getValue: () => ({
      from: subDays(new Date(), 29),
      to: new Date(),
    }),
  },
  {
    label: "Last 90 days",
    getValue: () => ({
      from: subDays(new Date(), 89),
      to: new Date(),
    }),
  },
  {
    label: "Last 6 months",
    getValue: () => ({
      from: subMonths(new Date(), 6),
      to: new Date(),
    }),
  },
  {
    label: "Last year",
    getValue: () => ({
      from: subDays(new Date(), 365),
      to: new Date(),
    }),
  },
];

export function CustomDatePicker({
  value,
  onChange,
  showComparison = false,
  onComparisonChange,
  comparisonRange,
  onComparisonRangeChange,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);

  const formatRange = (range?: DateRange) => {
    if (!range) return "Select date range";
    return `${format(range.from, "MMM dd, yyyy")} - ${format(range.to, "MMM dd, yyyy")}`;
  };

  const handlePresetSelect = (preset: any) => {
    const range = preset.getValue();
    onChange(range);
    
    // Auto-set comparison period to previous equivalent period
    if (comparisonEnabled && onComparisonRangeChange) {
      const daysDiff = Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24));
      const comparisonTo = subDays(range.from, 1);
      const comparisonFrom = subDays(comparisonTo, daysDiff);
      onComparisonRangeChange({ from: comparisonFrom, to: comparisonTo });
    }
  };

  const handleComparisonToggle = (enabled: boolean) => {
    setComparisonEnabled(enabled);
    onComparisonChange?.(enabled);
    
    if (enabled && value && onComparisonRangeChange) {
      // Auto-set comparison to previous period
      const daysDiff = Math.ceil((value.to.getTime() - value.from.getTime()) / (1000 * 60 * 60 * 24));
      const comparisonTo = subDays(value.from, 1);
      const comparisonFrom = subDays(comparisonTo, daysDiff);
      onComparisonRangeChange({ from: comparisonFrom, to: comparisonTo });
    }
  };

  return (
    <div className="space-y-3">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-purple-500/10 border-purple-500/30 text-purple-100 hover:bg-purple-500/20",
              !value && "text-purple-400"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatRange(value)}
            <ChevronDown className="ml-auto h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 bg-purple-600/10 backdrop-blur-lg border border-purple-600/30" 
          align="start"
        >
          <div className="flex">
            {/* Presets */}
            <div className="border-r border-purple-600/20 p-3">
              <h4 className="text-sm font-medium text-purple-100 mb-3">Quick Select</h4>
              <div className="space-y-1">
                {PRESET_RANGES.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                    className="w-full justify-start text-purple-200 hover:text-purple-100 hover:bg-purple-500/20"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Calendar */}
            <div className="p-3">
              <Calendar
                mode="range"
                selected={value ? { from: value.from, to: value.to } : undefined}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    onChange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                  }
                }}
                numberOfMonths={2}
                className="text-purple-100"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Period Comparison Toggle */}
      {showComparison && (
        <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
          <div>
            <label className="text-sm font-medium text-purple-100">Compare Periods</label>
            <p className="text-xs text-purple-300">
              Compare with previous period for trend analysis
            </p>
          </div>
          <Switch
            checked={comparisonEnabled}
            onCheckedChange={handleComparisonToggle}
          />
        </div>
      )}

      {/* Comparison Range Display */}
      {comparisonEnabled && comparisonRange && (
        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
          <label className="text-xs font-medium text-blue-200 uppercase tracking-wide">
            Comparison Period
          </label>
          <p className="text-sm text-blue-100 mt-1">
            {formatRange(comparisonRange)}
          </p>
        </div>
      )}
    </div>
  );
}