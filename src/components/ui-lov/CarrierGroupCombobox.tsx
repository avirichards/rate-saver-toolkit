import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CarrierGroup {
  name: string;
  count: number;
}

interface CarrierGroupComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CarrierGroupCombobox({ 
  value, 
  onValueChange, 
  placeholder = "Select group...",
  disabled = false 
}: CarrierGroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<CarrierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('carrier_configs')
        .select('account_group')
        .not('account_group', 'is', null);

      if (error) {
        console.error('Error loading carrier groups:', error);
        toast.error('Failed to load carrier groups');
        return;
      }

      // Group by account_group and count
      const groupCounts = (data || []).reduce((acc, config) => {
        const group = config.account_group;
        if (group) {
          acc[group] = (acc[group] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const groupList = Object.entries(groupCounts).map(([name, count]) => ({
        name,
        count
      }));

      setGroups(groupList);
    } catch (error) {
      console.error('Error loading carrier groups:', error);
      toast.error('Failed to load carrier groups');
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (groupName: string) => {
    try {
      // This would need to be implemented in the API
      toast.info('Group deletion will be available soon');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  const createNewGroup = async (groupName: string) => {
    if (!searchValue.trim()) return;
    onValueChange(groupName.trim());
    setSearchValue('');
    setOpen(false);
    await loadGroups();
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showCreateOption = searchValue.trim() && 
    !filteredGroups.some(group => 
      group.name.toLowerCase() === searchValue.toLowerCase()
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput 
            placeholder="Search or create group..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading groups...' : 'No groups found.'}
            </CommandEmpty>
            
            {!loading && (
              <>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => {
                      onValueChange('');
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    No group assigned
                  </CommandItem>
                  
                  {filteredGroups.map((group) => (
                    <CommandItem
                      key={group.name}
                      value={group.name}
                      className="flex items-center justify-between"
                    >
                      <div 
                        className="flex items-center flex-1 cursor-pointer"
                        onClick={() => {
                          onValueChange(group.name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === group.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex-1">{group.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({group.count} account{group.count !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {showCreateOption && (
                  <CommandGroup>
                    <CommandItem onSelect={() => createNewGroup(searchValue)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create group "{searchValue}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}