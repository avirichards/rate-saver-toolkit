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
import { supabase } from '@/lib/apiClient';
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('carrier_configs')
        .select('account_group')
        .eq('user_id', user.id)
        .not('account_group', 'is', null);

      if (error) throw error;
      
      // Count occurrences of each group
      const groupCounts: Record<string, number> = {};
      data.forEach(item => {
        if (item.account_group) {
          groupCounts[item.account_group] = (groupCounts[item.account_group] || 0) + 1;
        }
      });
      
      // Convert to array of group objects
      const groupArray: CarrierGroup[] = Object.keys(groupCounts)
        .filter(name => name) // Filter out empty strings
        .map(name => ({
          name,
          count: groupCounts[name]
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setGroups(groupArray);
    } catch (error) {
      console.error('Error loading carrier groups:', error);
      toast.error('Failed to load carrier groups');
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (groupName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update all configs in this group to remove the group
      const { error } = await supabase
        .from('carrier_configs')
        .update({ account_group: null })
        .eq('user_id', user.id)
        .eq('account_group', groupName);

      if (error) throw error;
      
      // If the deleted group was selected, clear the selection
      if (value === groupName) {
        onValueChange('');
      }
      
      // Refresh the groups list
      await loadGroups();
      toast.success(`Group "${groupName}" removed`);
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
    await loadGroups(); // Refresh groups list
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteGroup(group.name);
                        }}
                        title="Delete group"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
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