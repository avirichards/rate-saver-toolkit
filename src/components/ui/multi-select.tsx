import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  maxDisplayItems?: number;
}

export function MultiSelect({
  options = [],
  values = [],
  onValuesChange,
  placeholder = "Select items...",
  className,
  maxDisplayItems = 3
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  // Safety check to ensure values is always an array
  const safeValues = Array.isArray(values) ? values : [];
  const safeOptions = Array.isArray(options) ? options.filter(opt => opt && typeof opt.value === 'string' && typeof opt.label === 'string') : [];

  const handleSelect = (optionValue: string) => {
    if (!optionValue) return;
    const newValues = safeValues.includes(optionValue)
      ? safeValues.filter(v => v !== optionValue)
      : [...safeValues, optionValue];
    onValuesChange(newValues);
  };

  const handleRemove = (valueToRemove: string) => {
    if (!valueToRemove) return;
    onValuesChange(safeValues.filter(v => v !== valueToRemove));
  };

  const displayedValues = safeValues.slice(0, maxDisplayItems);
  const remainingCount = safeValues.length - maxDisplayItems;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between min-h-9", className)}
        >
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {safeValues.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {displayedValues.map((value) => {
                  const option = safeOptions.find(opt => opt.value === value);
                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="text-xs px-1 py-0 h-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(value);
                      }}
                    >
                      {option?.label || value}
                      <X className="ml-1 h-3 w-3 hover:bg-muted-foreground/20 rounded-sm" />
                    </Badge>
                  );
                })}
                {remainingCount > 0 && (
                  <Badge variant="outline" className="text-xs px-1 py-0 h-5">
                    +{remainingCount} more
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-popover border border-border" align="start">
        <div className="max-h-64 overflow-y-auto bg-popover">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              onChange={(e) => {
                // Simple search - you can implement this later if needed
              }}
            />
          </div>
          <div className="p-1">
            {safeOptions && safeOptions.length > 0 ? (
              safeOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      safeValues.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <div className="text-xs text-muted-foreground ml-4">
                        {option.count} shipments
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No items found.
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}