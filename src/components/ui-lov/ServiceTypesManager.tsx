import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Save, RotateCcw, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UniversalServiceCategory, UNIVERSAL_SERVICES } from '@/utils/universalServiceCategories';
import { CarrierType, getUniversalCategoryFromCarrierCode, CARRIER_MAPPINGS } from '@/utils/carrierServiceRegistry';

interface CarrierConfig {
  id: string;
  carrier_type: string;
  account_name: string;
  enabled_services: any; // JSON type from Supabase
  is_active: boolean;
  account_group?: string;
}

interface CarrierService {
  id: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  description?: string;
  is_active: boolean;
}

interface CustomService {
  id?: string;
  user_id?: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  universal_category: string;
  is_available: boolean;
  is_active: boolean;
}

interface ServiceMapping {
  service_code: string;
  service_name: string;
  universal_category: string;
  is_enabled: boolean;
  is_custom: boolean;
  is_system: boolean;
  carrier_type: string;
}

export const ServiceTypesManager = () => {
  const [carrierConfigs, setCarrierConfigs] = useState<CarrierConfig[]>([]);
  const [systemServices, setSystemServices] = useState<CarrierService[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [editedMappings, setEditedMappings] = useState<Record<string, Partial<ServiceMapping>>>({});
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isManagingUniversal, setIsManagingUniversal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [universalTypes, setUniversalTypes] = useState<Record<string, any>>({...UNIVERSAL_SERVICES});
  const [editedUniversalTypes, setEditedUniversalTypes] = useState<Record<string, any>>({});
  const [isAddingUniversal, setIsAddingUniversal] = useState(false);
  const [newUniversalType, setNewUniversalType] = useState({
    key: '',
    displayName: '',
    description: '',
    isInternational: false,
    typicalTransitDays: ''
  });

  const [newCustomService, setNewCustomService] = useState({
    service_code: '',
    service_name: '',
    universal_category: UniversalServiceCategory.GROUND
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCarrier) {
      buildServiceMappings();
    }
  }, [selectedCarrier, systemServices, customServices, carrierConfigs]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load carrier configs
      const { data: configs, error: configsError } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (configsError) throw configsError;

      // Load system services
      const { data: services, error: servicesError } = await supabase
        .from('carrier_services')
        .select('*')
        .eq('is_active', true);

      if (servicesError) throw servicesError;

      // Load custom services
      const { data: custom, error: customError } = await supabase
        .from('custom_carrier_service_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (customError) throw customError;

      setCarrierConfigs((configs || []).map(config => ({
        ...config,
        enabled_services: Array.isArray(config.enabled_services) 
          ? config.enabled_services 
          : typeof config.enabled_services === 'string' 
            ? JSON.parse(config.enabled_services || '[]')
            : []
      })));
      setSystemServices(services || []);
      setCustomServices(custom || []);

      // Auto-select first carrier if available
      if (configs && configs.length > 0 && !selectedCarrier) {
        setSelectedCarrier(configs[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load service types data');
    } finally {
      setLoading(false);
    }
  };

  const buildServiceMappings = () => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) {
      setServiceMappings([]);
      return;
    }

    const carrierType = selectedConfig.carrier_type.toUpperCase() as CarrierType;
    const mappings: ServiceMapping[] = [];
    const enabledServices = selectedConfig.enabled_services as string[] || [];

    // Get carrier-specific service mappings from the registry
    const carrierServiceMappings = CARRIER_MAPPINGS[carrierType] || [];

    // Create mappings for enabled services
    enabledServices.forEach(serviceCode => {
      // Find the service mapping from carrier registry
      const registryMapping = carrierServiceMappings.find(m => m.carrierCode === serviceCode);
      
      // Try to find in system services as fallback
      const systemService = systemServices.find(s => 
        s.service_code === serviceCode && s.carrier_type.toUpperCase() === carrierType
      );

      // Use registry service name if available, otherwise fallback to system service or code
      const serviceName = registryMapping?.carrierServiceName || 
                         systemService?.service_name || 
                         serviceCode;

      const universalCategory = registryMapping?.universalCategory || 
                               getUniversalCategoryFromCarrierCode(carrierType, serviceCode) ||
                               UniversalServiceCategory.GROUND;

      mappings.push({
        service_code: serviceCode,
        service_name: serviceName,
        universal_category: universalCategory,
        is_enabled: true,
        is_custom: !registryMapping && !systemService,
        is_system: !!systemService,
        carrier_type: carrierType
      });
    });

    setServiceMappings(mappings.sort((a, b) => a.service_name.localeCompare(b.service_name)));
    setEditedMappings({});
    setHasUnsavedChanges(false);
  };

  const toggleServiceEnabled = async (serviceCode: string, enabled: boolean) => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) return;

    try {
      const currentServices = selectedConfig.enabled_services as string[];
      const updatedServices = enabled
        ? [...currentServices, serviceCode]
        : currentServices.filter(code => code !== serviceCode);

      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: updatedServices })
        .eq('id', selectedCarrier);

      if (error) throw error;

      // Update local state
      setCarrierConfigs(prev =>
        prev.map(config =>
          config.id === selectedCarrier
            ? { ...config, enabled_services: updatedServices }
            : config
        )
      );

      toast.success(`Service ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Failed to update service');
    }
  };

  const updateServiceMapping = (serviceCode: string, field: keyof ServiceMapping, value: string) => {
    setEditedMappings(prev => ({
      ...prev,
      [serviceCode]: {
        ...prev[serviceCode],
        [field]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  const saveAllChanges = async () => {
    if (Object.keys(editedMappings).length === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
      if (!selectedConfig) return;

      for (const [serviceCode, changes] of Object.entries(editedMappings)) {
        const originalMapping = serviceMappings.find(m => m.service_code === serviceCode);
        if (!originalMapping) continue;

        if (originalMapping.is_custom) {
          // Update existing custom service
          const updateData: any = {};
          if (changes.service_name !== undefined) updateData.service_name = changes.service_name;
          if (changes.universal_category !== undefined) updateData.universal_category = changes.universal_category;

          const { error } = await supabase
            .from('custom_carrier_service_codes')
            .update(updateData)
            .eq('service_code', serviceCode)
            .eq('carrier_type', selectedConfig.carrier_type.toUpperCase())
            .eq('user_id', user.id);

          if (error) throw error;
        } else {
          // Create custom override for system service
          const { error } = await supabase
            .from('custom_carrier_service_codes')
            .insert({
              user_id: user.id,
              carrier_type: selectedConfig.carrier_type.toUpperCase(),
              service_code: serviceCode,
              service_name: changes.service_name || originalMapping.service_name,
              universal_category: changes.universal_category || originalMapping.universal_category,
              is_available: true,
              is_active: true
            });

          if (error) throw error;
        }
      }

      await loadData();
      toast.success('All changes saved successfully');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    }
  };

  const addCustomService = async () => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) return;

    if (!newCustomService.service_code || !newCustomService.service_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('custom_carrier_service_codes')
        .insert({
          user_id: user.id,
          carrier_type: selectedConfig.carrier_type.toUpperCase(),
          service_code: newCustomService.service_code,
          service_name: newCustomService.service_name,
          universal_category: newCustomService.universal_category,
          is_available: true,
          is_active: true
        });

      if (error) throw error;

      setNewCustomService({
        service_code: '',
        service_name: '',
        universal_category: UniversalServiceCategory.GROUND
      });
      setIsAddingCustom(false);
      loadData();
      toast.success('Custom service added');
    } catch (error: any) {
      console.error('Error adding custom service:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('A service with this code already exists');
      } else {
        toast.error('Failed to add custom service');
      }
    }
  };

  const deleteCustomService = async (serviceCode: string) => {
    if (!confirm('Are you sure you want to delete this custom service?')) return;

    try {
      const { error } = await supabase
        .from('custom_carrier_service_codes')
        .delete()
        .eq('service_code', serviceCode)
        .eq('carrier_type', carrierConfigs.find(c => c.id === selectedCarrier)?.carrier_type.toUpperCase());

      if (error) throw error;

      loadData();
      toast.success('Custom service deleted');
    } catch (error) {
      console.error('Error deleting custom service:', error);
      toast.error('Failed to delete custom service');
    }
  };

  const resetToDefaults = async () => {
    const selectedConfig = carrierConfigs.find(c => c.id === selectedCarrier);
    if (!selectedConfig) return;

    if (!confirm('Reset all services to system defaults? This will disable all custom services.')) return;

    try {
      const carrierType = selectedConfig.carrier_type.toUpperCase() as CarrierType;
      const defaultServices = systemServices
        .filter(s => s.carrier_type.toUpperCase() === carrierType)
        .map(s => s.service_code);

      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: defaultServices })
        .eq('id', selectedCarrier);

      if (error) throw error;

      loadData();
      toast.success('Services reset to defaults');
    } catch (error) {
      console.error('Error resetting services:', error);
      toast.error('Failed to reset services');
    }
  };

  const enableAllServices = async () => {
    const allServiceCodes = serviceMappings.map(m => m.service_code);
    
    try {
      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: allServiceCodes })
        .eq('id', selectedCarrier);

      if (error) throw error;

      loadData();
      toast.success('All services enabled');
    } catch (error) {
      console.error('Error enabling all services:', error);
      toast.error('Failed to enable all services');
    }
  };

  const disableAllServices = async () => {
    try {
      const { error } = await supabase
        .from('carrier_configs')
        .update({ enabled_services: [] })
        .eq('id', selectedCarrier);

      if (error) throw error;

      loadData();
      toast.success('All services disabled');
    } catch (error) {
      console.error('Error disabling all services:', error);
      toast.error('Failed to disable all services');
    }
  };

  const updateUniversalType = (key: string, field: string, value: any) => {
    setEditedUniversalTypes(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const getCurrentUniversalValue = (key: string, field: string) => {
    const edited = editedUniversalTypes[key];
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    return universalTypes[key] ? universalTypes[key][field] : '';
  };

  const saveUniversalTypes = () => {
    // Apply edits to universal types
    const updatedTypes = { ...universalTypes };
    Object.keys(editedUniversalTypes).forEach(key => {
      if (updatedTypes[key]) {
        updatedTypes[key] = { ...updatedTypes[key], ...editedUniversalTypes[key] };
      }
    });

    // Add new universal type if being added
    if (isAddingUniversal && newUniversalType.key && newUniversalType.displayName) {
      updatedTypes[newUniversalType.key] = {
        category: newUniversalType.key,
        displayName: newUniversalType.displayName,
        description: newUniversalType.description,
        isInternational: newUniversalType.isInternational,
        typicalTransitDays: newUniversalType.typicalTransitDays
      };
    }

    setUniversalTypes(updatedTypes);
    setEditedUniversalTypes({});
    setIsAddingUniversal(false);
    setNewUniversalType({
      key: '',
      displayName: '',
      description: '',
      isInternational: false,
      typicalTransitDays: ''
    });
    toast.success('Universal service types updated');
  };

  const deleteUniversalType = (key: string) => {
    const updatedTypes = { ...universalTypes };
    delete updatedTypes[key];
    setUniversalTypes(updatedTypes);
    toast.success('Universal service type deleted');
  };

  const getCurrentValue = (serviceCode: string, field: keyof ServiceMapping) => {
    const edited = editedMappings[serviceCode];
    const original = serviceMappings.find(m => m.service_code === serviceCode);
    
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    
    return original ? original[field] : '';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Service Types Management</CardTitle>
          <div className="text-sm text-muted-foreground">
            Manage carrier service types and their universal category mappings
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Carrier Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select Carrier Account</label>
            <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
              <SelectTrigger>
                <SelectValue placeholder="Select a carrier account" />
              </SelectTrigger>
              <SelectContent>
                {carrierConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.account_name} ({config.carrier_type.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCarrier && (
            <>
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={enableAllServices}
                  iconLeft={<Save className="h-4 w-4" />}
                >
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disableAllServices}
                >
                  Disable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  iconLeft={<RotateCcw className="h-4 w-4" />}
                >
                  Reset to Defaults
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveAllChanges}
                  disabled={!hasUnsavedChanges}
                  iconLeft={<Save className="h-4 w-4" />}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManagingUniversal(true)}
                  iconLeft={<Edit2 className="h-4 w-4" />}
                >
                  Manage Universal Types
                </Button>
                <Dialog open={isAddingCustom} onOpenChange={setIsAddingCustom}>
                  <DialogTrigger asChild>
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={<Plus className="h-4 w-4" />}
                    >
                      Add Custom Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Service</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="service-code">Service Code</Label>
                        <Input
                          id="service-code"
                          value={newCustomService.service_code}
                          onChange={(e) => setNewCustomService(prev => ({
                            ...prev,
                            service_code: e.target.value.toUpperCase()
                          }))}
                          placeholder="e.g., CUSTOM_EXPRESS"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="service-name">Service Name</Label>
                        <Input
                          id="service-name"
                          value={newCustomService.service_name}
                          onChange={(e) => setNewCustomService(prev => ({
                            ...prev,
                            service_name: e.target.value
                          }))}
                          placeholder="e.g., Custom Express Service"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="universal-category">Universal Category</Label>
                        <Select
                          value={newCustomService.universal_category}
                          onValueChange={(value) => setNewCustomService(prev => ({
                            ...prev,
                            universal_category: value as UniversalServiceCategory
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(UNIVERSAL_SERVICES).map(([key, info]) => (
                              <SelectItem key={key} value={key}>
                                {info.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsAddingCustom(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          onClick={addCustomService}
                        >
                          Add Service
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Services Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Service Mappings ({serviceMappings.length} services)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enabled</TableHead>
                        <TableHead>Carrier Type</TableHead>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Service Code</TableHead>
                        <TableHead>Universal Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceMappings.map(mapping => (
                        <TableRow key={mapping.service_code}>
                          <TableCell>
                            <Switch
                              checked={mapping.is_enabled}
                              onCheckedChange={(checked) =>
                                toggleServiceEnabled(mapping.service_code, checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {mapping.carrier_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getCurrentValue(mapping.service_code, 'service_name') as string}
                              onChange={(e) =>
                                updateServiceMapping(mapping.service_code, 'service_name', e.target.value)
                              }
                              className="min-w-0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getCurrentValue(mapping.service_code, 'service_code') as string}
                              onChange={(e) =>
                                updateServiceMapping(mapping.service_code, 'service_code', e.target.value)
                              }
                              className="min-w-0 font-mono text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={getCurrentValue(mapping.service_code, 'universal_category') as string}
                              onValueChange={(value) =>
                                updateServiceMapping(mapping.service_code, 'universal_category', value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(UNIVERSAL_SERVICES).map(([key, info]) => (
                                  <SelectItem key={key} value={key}>
                                    {info.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {serviceMappings.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No services available for the selected carrier
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Manage Universal Types Dialog */}
              <Dialog open={isManagingUniversal} onOpenChange={setIsManagingUniversal}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Manage Universal Service Categories</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Edit existing universal service types or add new ones for your organization.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsAddingUniversal(true)}
                        iconLeft={<Plus className="h-4 w-4" />}
                      >
                        Add Universal Type
                      </Button>
                    </div>

                    {/* Add New Universal Type Form */}
                    {isAddingUniversal && (
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <h3 className="font-medium mb-4">Add New Universal Service Type</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-key">Category Key</Label>
                            <Input
                              id="new-key"
                              value={newUniversalType.key}
                              onChange={(e) => setNewUniversalType(prev => ({ ...prev, key: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '') }))}
                              placeholder="CUSTOM_SERVICE_TYPE"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-name">Display Name</Label>
                            <Input
                              id="new-name"
                              value={newUniversalType.displayName}
                              onChange={(e) => setNewUniversalType(prev => ({ ...prev, displayName: e.target.value }))}
                              placeholder="Custom Service"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="new-description">Description</Label>
                            <Input
                              id="new-description"
                              value={newUniversalType.description}
                              onChange={(e) => setNewUniversalType(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Description of the custom service type"
                            />
                          </div>
                          <div>
                            <Label htmlFor="new-transit">Transit Days</Label>
                            <Input
                              id="new-transit"
                              value={newUniversalType.typicalTransitDays}
                              onChange={(e) => setNewUniversalType(prev => ({ ...prev, typicalTransitDays: e.target.value }))}
                              placeholder="1-3"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={newUniversalType.isInternational}
                              onCheckedChange={(checked) => setNewUniversalType(prev => ({ ...prev, isInternational: checked }))}
                            />
                            <Label>International Service</Label>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={saveUniversalTypes}
                            disabled={!newUniversalType.key || !newUniversalType.displayName}
                          >
                            Add Type
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddingUniversal(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Universal Types Table */}
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category Key</TableHead>
                            <TableHead>Display Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Transit Days</TableHead>
                            <TableHead>International</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(universalTypes).map(([key, info]) => (
                            <TableRow key={key}>
                              <TableCell>
                                <code className="text-sm bg-muted px-2 py-1 rounded">
                                  {key}
                                </code>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={getCurrentUniversalValue(key, 'displayName')}
                                  onChange={(e) => updateUniversalType(key, 'displayName', e.target.value)}
                                  className="min-w-[150px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={getCurrentUniversalValue(key, 'description')}
                                  onChange={(e) => updateUniversalType(key, 'description', e.target.value)}
                                  className="min-w-[200px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={getCurrentUniversalValue(key, 'typicalTransitDays')}
                                  onChange={(e) => updateUniversalType(key, 'typicalTransitDays', e.target.value)}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={getCurrentUniversalValue(key, 'isInternational') || false}
                                  onCheckedChange={(checked) => updateUniversalType(key, 'isInternational', checked)}
                                />
                              </TableCell>
                              <TableCell>
                                {!Object.values(UniversalServiceCategory).includes(key as UniversalServiceCategory) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteUniversalType(key)}
                                    iconLeft={<Trash2 className="h-4 w-4" />}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-between pt-4">
                      <div className="text-sm text-muted-foreground">
                        System universal types cannot be deleted but can be edited.
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          onClick={saveUniversalTypes}
                          disabled={Object.keys(editedUniversalTypes).length === 0 && !isAddingUniversal}
                        >
                          Save Changes
                        </Button>
                        <Button onClick={() => setIsManagingUniversal(false)}>
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {carrierConfigs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No carrier accounts found. Please add a carrier account first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};