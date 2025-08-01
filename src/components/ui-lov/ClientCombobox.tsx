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
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

interface Client {
  id: string;
  company_name: string;
}

interface ClientComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ClientCombobox({ 
  value, 
  onValueChange, 
  placeholder = "Select client...",
  disabled = false 
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await apiClient.getClients();
      if (error) throw error;
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const createNewClient = async (companyName: string) => {
    try {
      const { data, error } = await apiClient.createClient({
        company_name: companyName.trim()
      });

      if (error) throw error;
      
      await loadClients();
      toast.success(`Client "${companyName}" created successfully`);
      
      return data;
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Failed to create client');
      return null;
    }
  };

  const handleCreateNewClient = async () => {
    if (!searchValue.trim()) return;
    
    const newClient = await createNewClient(searchValue);
    if (newClient && (newClient as any).id) {
      onValueChange((newClient as any).id);
      setSearchValue('');
      setOpen(false);
    }
  };

  const deleteClient = async (clientId: string, clientName: string) => {
    try {
      const { error } = await apiClient.request(`/clients/${clientId}`, {
        method: 'DELETE'
      });

      if (error) throw error;
      
      if (value === clientId) {
        onValueChange('');
      }
      
      await loadClients();
      toast.success(`Client "${clientName}" deleted`);
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete client');
    }
  };

  const selectedClient = clients.find(client => client.id === value);
  const filteredClients = clients.filter(client =>
    client.company_name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showCreateOption = searchValue.trim() && 
    !filteredClients.some(client => 
      client.company_name.toLowerCase() === searchValue.toLowerCase()
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
          {selectedClient?.company_name || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput 
            placeholder="Search or create client..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading clients...' : 'No clients found.'}
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
                    No client assigned
                  </CommandItem>
                  
                  {filteredClients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.id}
                      className="flex items-center justify-between"
                    >
                      <div 
                        className="flex items-center flex-1 cursor-pointer"
                        onClick={() => {
                          onValueChange(client.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === client.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {client.company_name}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteClient(client.id, client.company_name);
                        }}
                        title="Delete client"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {showCreateOption && (
                  <CommandGroup>
                    <CommandItem onSelect={handleCreateNewClient}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create "{searchValue}"
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