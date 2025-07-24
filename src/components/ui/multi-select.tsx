import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
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
  options,
  values,
  onValuesChange,
  placeholder = "Select items...",
  className,
  maxDisplayItems = 3
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (optionValue: string) => {
    const newValues = values.includes(optionValue)
      ? values.filter(v => v !== optionValue)
      : [...values, optionValue];
    onValuesChange(newValues);
  };

  const handleRemove = (valueToRemove: string) => {
    onValuesChange(values.filter(v => v !== valueToRemove));
  };

  const displayedValues = values.slice(0, maxDisplayItems);
  const remainingCount = values.length - maxDisplayItems;

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
            {values.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {displayedValues.map((value) => {
                  const option = options.find(opt => opt.value === value);
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
        <Command className="bg-popover">
          <CommandInput placeholder="Search..." className="h-9" />
          <CommandEmpty>No items found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-y-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
                className="cursor-pointer hover:bg-accent"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    values.includes(option.value) ? "opacity-100" : "opacity-0"
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
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}