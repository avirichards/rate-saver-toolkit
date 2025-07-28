import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Search, TestTube, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UniversalServiceCategory, UNIVERSAL_SERVICES } from '@/utils/universalServiceCategories';
import { CarrierType } from '@/utils/carrierServiceRegistry';
import { mapServiceToServiceCode } from '@/utils/serviceMapping';

interface CustomServiceMapping {
  id: string;
  service_name: string;
  normalized_service_name: string;
  universal_category: string;
  confidence: number;
  is_active: boolean;
}

interface CustomCarrierServiceCode {
  id: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  universal_category: string;
  is_available: boolean;
  is_active: boolean;
}

interface ExistingCarrierConfig {
  id: string;
  carrier_type: string;
  account_name: string;
  is_active: boolean;
  account_group: string;
}

interface ExistingServiceCode {
  id: string;
  carrier_type: string;
  service_code: string;
  service_name: string;
  description: string;
  is_active: boolean;
}

export const ServiceMappingManager = () => {
  const [customMappings, setCustomMappings] = useState<CustomServiceMapping[]>([]);
  const [customCodes, setCustomCodes] = useState<CustomCarrierServiceCode[]>([]);
  const [existingCarriers, setExistingCarriers] = useState<ExistingCarrierConfig[]>([]);
  const [existingServiceCodes, setExistingServiceCodes] = useState<ExistingServiceCode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [testServiceName, setTestServiceName] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isAddMappingOpen, setIsAddMappingOpen] = useState(false);
  const [isAddCodeOpen, setIsAddCodeOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CustomServiceMapping | null>(null);
  const [editingCode, setEditingCode] = useState<CustomCarrierServiceCode | null>(null);
  const { toast } = useToast();

  // Form states
  const [mappingForm, setMappingForm] = useState({
    service_name: '',
    normalized_service_name: '',
    universal_category: '',
    confidence: 0.9
  });

  const [codeForm, setCodeForm] = useState({
    carrier_type: '',
    service_code: '',
    service_name: '',
    universal_category: '',
    is_available: true
  });

  useEffect(() => {
    loadCustomMappings();
    loadCustomCodes();
    loadExistingCarriers();
    loadExistingServiceCodes();
  }, []);

  const loadCustomMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_service_mappings' as any)
        .select('*')
        .order('service_name');

      if (error) throw error;
      setCustomMappings((data as unknown as CustomServiceMapping[]) || []);
    } catch (error) {
      console.error('Error loading custom mappings:', error);
      toast({
        title: "Error",
        description: "Failed to load custom service mappings",
        variant: "destructive"
      });
    }
  };

  const loadCustomCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_carrier_service_codes' as any)
        .select('*')
        .order('carrier_type, service_name');

      if (error) throw error;
      setCustomCodes((data as unknown as CustomCarrierServiceCode[]) || []);
    } catch (error) {
      console.error('Error loading custom codes:', error);
      toast({
        title: "Error",
        description: "Failed to load custom carrier service codes",
        variant: "destructive"
      });
    }
  };

  const loadExistingCarriers = async () => {
    try {
      const { data, error } = await supabase
        .from('carrier_configs')
        .select('id, carrier_type, account_name, is_active, account_group')
        .eq('is_active', true)
        .order('account_group, account_name');

      if (error) throw error;
      setExistingCarriers(data || []);
    } catch (error) {
      console.error('Error loading existing carriers:', error);
    }
  };

  const loadExistingServiceCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('carrier_services')
        .select('id, carrier_type, service_code, service_name, description, is_active')
        .eq('is_active', true)
        .order('carrier_type, service_name');

      if (error) throw error;
      setExistingServiceCodes(data || []);
    } catch (error) {
      console.error('Error loading existing service codes:', error);
    }
  };

  const saveCustomMapping = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const mappingData = {
        ...mappingForm,
        user_id: user.id,
        is_active: true
      };

      if (editingMapping) {
        const { error } = await supabase
          .from('custom_service_mappings' as any)
          .update(mappingData)
          .eq('id', editingMapping.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_service_mappings' as any)
          .insert([mappingData]);
        if (error) throw error;
      }

      await loadCustomMappings();
      resetMappingForm();
      setIsAddMappingOpen(false);
      setEditingMapping(null);
      toast({
        title: "Success",
        description: `Service mapping ${editingMapping ? 'updated' : 'created'} successfully`
      });
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast({
        title: "Error",
        description: "Failed to save service mapping",
        variant: "destructive"
      });
    }
  };

  const saveCustomCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const codeData = {
        ...codeForm,
        user_id: user.id,
        is_active: true
      };

      if (editingCode) {
        const { error } = await supabase
          .from('custom_carrier_service_codes' as any)
          .update(codeData)
          .eq('id', editingCode.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_carrier_service_codes' as any)
          .insert([codeData]);
        if (error) throw error;
      }

      await loadCustomCodes();
      resetCodeForm();
      setIsAddCodeOpen(false);
      setEditingCode(null);
      toast({
        title: "Success",
        description: `Carrier service code ${editingCode ? 'updated' : 'created'} successfully`
      });
    } catch (error) {
      console.error('Error saving code:', error);
      toast({
        title: "Error",
        description: "Failed to save carrier service code",
        variant: "destructive"
      });
    }
  };

  const deleteMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_service_mappings' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCustomMappings();
      toast({
        title: "Success",
        description: "Service mapping deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast({
        title: "Error",
        description: "Failed to delete service mapping",
        variant: "destructive"
      });
    }
  };

  const deleteCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_carrier_service_codes' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCustomCodes();
      toast({
        title: "Success",
        description: "Carrier service code deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        title: "Error",
        description: "Failed to delete carrier service code",
        variant: "destructive"
      });
    }
  };

  const testServiceMapping = () => {
    if (!testServiceName.trim()) return;
    
    const result = mapServiceToServiceCode(testServiceName);
    setTestResult(result);
  };

  const resetMappingForm = () => {
    setMappingForm({
      service_name: '',
      normalized_service_name: '',
      universal_category: '',
      confidence: 0.9
    });
  };

  const resetCodeForm = () => {
    setCodeForm({
      carrier_type: '',
      service_code: '',
      service_name: '',
      universal_category: '',
      is_available: true
    });
  };

  const startEditMapping = (mapping: CustomServiceMapping) => {
    setEditingMapping(mapping);
    setMappingForm({
      service_name: mapping.service_name,
      normalized_service_name: mapping.normalized_service_name,
      universal_category: mapping.universal_category,
      confidence: mapping.confidence
    });
    setIsAddMappingOpen(true);
  };

  const startEditCode = (code: CustomCarrierServiceCode) => {
    setEditingCode(code);
    setCodeForm({
      carrier_type: code.carrier_type,
      service_code: code.service_code,
      service_name: code.service_name,
      universal_category: code.universal_category,
      is_available: code.is_available
    });
    setIsAddCodeOpen(true);
  };

  const filteredMappings = customMappings.filter(mapping =>
    mapping.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mapping.universal_category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCodes = customCodes.filter(code =>
    code.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    code.carrier_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    code.service_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExistingCodes = existingServiceCodes.filter(code =>
    code.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    code.carrier_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    code.service_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Service Name Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Service Mapping
          </CardTitle>
          <CardDescription>
            Test how a service name maps to universal categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter service name to test..."
              value={testServiceName}
              onChange={(e) => setTestServiceName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={testServiceMapping} variant="outline">
              Test
            </Button>
          </div>
          
          {testResult && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <div><strong>Service Name:</strong> {testServiceName}</div>
                <div><strong>Mapped Category:</strong> <Badge>{testResult.standardizedService}</Badge></div>
                <div><strong>Display Name:</strong> {testResult.serviceName}</div>
                <div><strong>Confidence:</strong> {Math.round(testResult.confidence * 100)}%</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="mappings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mappings">Service Mappings</TabsTrigger>
          <TabsTrigger value="codes">Carrier Service Codes</TabsTrigger>
          <TabsTrigger value="carriers">Existing Carriers</TabsTrigger>
        </TabsList>

        {/* Custom Service Mappings Tab */}
        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Custom Service Mappings</CardTitle>
                  <CardDescription>
                    Define how service names map to universal categories
                  </CardDescription>
                </div>
                <Dialog open={isAddMappingOpen} onOpenChange={setIsAddMappingOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        resetMappingForm();
                        setEditingMapping(null);
                      }}
                      iconLeft={<Plus className="h-4 w-4" />}
                    >
                      Add Mapping
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingMapping ? 'Edit' : 'Add'} Service Mapping
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="service_name">Service Name</Label>
                        <Input
                          id="service_name"
                          value={mappingForm.service_name}
                          onChange={(e) => setMappingForm(prev => ({ ...prev, service_name: e.target.value }))}
                          placeholder="e.g., FedEx Priority Overnight"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="normalized_service_name">Normalized Name</Label>
                        <Input
                          id="normalized_service_name"
                          value={mappingForm.normalized_service_name}
                          onChange={(e) => setMappingForm(prev => ({ ...prev, normalized_service_name: e.target.value }))}
                          placeholder="e.g., Priority Overnight"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="universal_category">Universal Category</Label>
                        <Select
                          value={mappingForm.universal_category}
                          onValueChange={(value) => setMappingForm(prev => ({ ...prev, universal_category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(UNIVERSAL_SERVICES).map(([key, service]) => (
                              <SelectItem key={key} value={key}>
                                {service.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confidence">Confidence (0.0 - 1.0)</Label>
                        <Input
                          id="confidence"
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={mappingForm.confidence}
                          onChange={(e) => setMappingForm(prev => ({ ...prev, confidence: parseFloat(e.target.value) }))}
                        />
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddMappingOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveCustomMapping}>
                          {editingMapping ? 'Update' : 'Create'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search mappings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                
                <div className="border rounded-lg">
                  <div className="grid grid-cols-5 gap-4 p-4 font-medium border-b bg-muted/50">
                    <div>Service Name</div>
                    <div>Normalized Name</div>
                    <div>Universal Category</div>
                    <div>Confidence</div>
                    <div>Actions</div>
                  </div>
                  {filteredMappings.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No custom service mappings found
                    </div>
                  ) : (
                    filteredMappings.map((mapping) => (
                      <div key={mapping.id} className="grid grid-cols-5 gap-4 p-4 border-b last:border-b-0">
                        <div className="font-medium">{mapping.service_name}</div>
                        <div>{mapping.normalized_service_name}</div>
                        <div>
                          <Badge variant="secondary">
                            {UNIVERSAL_SERVICES[mapping.universal_category as UniversalServiceCategory]?.displayName || mapping.universal_category}
                          </Badge>
                        </div>
                        <div>{Math.round(mapping.confidence * 100)}%</div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditMapping(mapping)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMapping(mapping.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Carrier Service Codes Tab */}
        <TabsContent value="codes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Service Code Mappings</CardTitle>
                  <CardDescription>
                    View existing service codes and create custom universal category mappings
                  </CardDescription>
                </div>
                <Dialog open={isAddCodeOpen} onOpenChange={setIsAddCodeOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        resetCodeForm();
                        setEditingCode(null);
                      }}
                      iconLeft={<Plus className="h-4 w-4" />}
                    >
                      Add Service Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingCode ? 'Edit' : 'Add'} Carrier Service Code
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="carrier_type">Carrier Type</Label>
                        <Select
                          value={codeForm.carrier_type}
                          onValueChange={(value) => setCodeForm(prev => ({ ...prev, carrier_type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select carrier" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(CarrierType).map((carrier) => (
                              <SelectItem key={carrier} value={carrier}>
                                {carrier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="service_code">Service Code</Label>
                        <Input
                          id="service_code"
                          value={codeForm.service_code}
                          onChange={(e) => setCodeForm(prev => ({ ...prev, service_code: e.target.value }))}
                          placeholder="e.g., 01, PRIORITY_OVERNIGHT"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="service_name">Service Name</Label>
                        <Input
                          id="service_name"
                          value={codeForm.service_name}
                          onChange={(e) => setCodeForm(prev => ({ ...prev, service_name: e.target.value }))}
                          placeholder="e.g., UPS Next Day Air"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="universal_category">Universal Category</Label>
                        <Select
                          value={codeForm.universal_category}
                          onValueChange={(value) => setCodeForm(prev => ({ ...prev, universal_category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(UNIVERSAL_SERVICES).map(([key, service]) => (
                              <SelectItem key={key} value={key}>
                                {service.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddCodeOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveCustomCode}>
                          {editingCode ? 'Update' : 'Create'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search service codes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                
                <Tabs defaultValue="existing" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="existing">Existing Service Codes</TabsTrigger>
                    <TabsTrigger value="custom">Custom Mappings ({filteredCodes.length})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="existing">
                    <div className="border rounded-lg">
                      <div className="grid grid-cols-5 gap-4 p-4 font-medium border-b bg-muted/50">
                        <div>Carrier</div>
                        <div>Service Code</div>
                        <div>Service Name</div>
                        <div>Description</div>
                        <div>Actions</div>
                      </div>
                      {filteredExistingCodes.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          No existing service codes found
                        </div>
                      ) : (
                        filteredExistingCodes.map((code) => (
                          <div key={code.id} className="grid grid-cols-5 gap-4 p-4 border-b last:border-b-0">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              {code.carrier_type.toUpperCase()}
                            </div>
                            <div className="font-mono">{code.service_code}</div>
                            <div>{code.service_name}</div>
                            <div className="text-sm text-muted-foreground">{code.description}</div>
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCodeForm({
                                    carrier_type: code.carrier_type.toUpperCase(),
                                    service_code: code.service_code,
                                    service_name: code.service_name,
                                    universal_category: '',
                                    is_available: true
                                  });
                                  setIsAddCodeOpen(true);
                                }}
                              >
                                Map to Universal
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="custom">
                    <div className="border rounded-lg">
                      <div className="grid grid-cols-6 gap-4 p-4 font-medium border-b bg-muted/50">
                        <div>Carrier</div>
                        <div>Service Code</div>
                        <div>Service Name</div>
                        <div>Universal Category</div>
                        <div>Available</div>
                        <div>Actions</div>
                      </div>
                      {filteredCodes.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          No custom carrier service codes found
                        </div>
                      ) : (
                        filteredCodes.map((code) => (
                          <div key={code.id} className="grid grid-cols-6 gap-4 p-4 border-b last:border-b-0">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              {code.carrier_type}
                            </div>
                            <div className="font-mono">{code.service_code}</div>
                            <div>{code.service_name}</div>
                            <div>
                              <Badge variant="secondary">
                                {UNIVERSAL_SERVICES[code.universal_category as UniversalServiceCategory]?.displayName || code.universal_category}
                              </Badge>
                            </div>
                            <div>
                              <Badge variant={code.is_available ? "default" : "secondary"}>
                                {code.is_available ? "Yes" : "No"}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditCode(code)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteCode(code.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Existing Carriers Tab */}
        <TabsContent value="carriers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Existing Carriers</CardTitle>
              <CardDescription>
                View your configured carrier accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <div className="grid grid-cols-4 gap-4 p-4 font-medium border-b bg-muted/50">
                  <div>Carrier Type</div>
                  <div>Account Name</div>
                  <div>Account Group</div>
                  <div>Status</div>
                </div>
                {existingCarriers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No carrier accounts found
                  </div>
                ) : (
                  existingCarriers.map((carrier) => (
                    <div key={carrier.id} className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        {carrier.carrier_type.toUpperCase()}
                      </div>
                      <div className="font-medium">{carrier.account_name}</div>
                      <div>{carrier.account_group || 'No Group'}</div>
                      <div>
                        <Badge variant={carrier.is_active ? "default" : "secondary"}>
                          {carrier.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};