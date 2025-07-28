import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Save, Search, Globe, MapPin, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Import the existing service utilities
import { UNIVERSAL_SERVICES, UniversalServiceCategory } from '@/utils/universalServiceCategories';
import { 
  getCarrierServiceCode,
  getCarrierServiceName,
  getAvailableServiceCodes,
  CarrierType
} from '@/utils/carrierServiceRegistry';
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

const ServiceMappingManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');
  const [testServiceName, setTestServiceName] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  
  // Custom service mappings state
  const [customServiceMappings, setCustomServiceMappings] = useState<CustomServiceMapping[]>([]);
  const [customCarrierCodes, setCustomCarrierCodes] = useState<CustomCarrierServiceCode[]>([]);
  const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false);
  const [isAddCarrierCodeDialogOpen, setIsAddCarrierCodeDialogOpen] = useState(false);
  const [editingServiceMapping, setEditingServiceMapping] = useState<CustomServiceMapping | null>(null);
  const [editingCarrierCode, setEditingCarrierCode] = useState<CustomCarrierServiceCode | null>(null);
  
  // Form state for adding/editing
  const [newServiceForm, setNewServiceForm] = useState({
    service_name: '',
    universal_category: '',
    confidence: 0.9
  });
  
  const [newCarrierCodeForm, setNewCarrierCodeForm] = useState({
    carrier_type: '',
    service_code: '',
    service_name: '',
    universal_category: '',
    is_available: true
  });

  // Load custom mappings on component mount
  useEffect(() => {
    loadCustomServiceMappings();
    loadCustomCarrierCodes();
  }, []);

  const loadCustomServiceMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_service_mappings')
        .select('*')
        .eq('is_active', true)
        .order('service_name');

      if (error) throw error;
      setCustomServiceMappings(data || []);
    } catch (error) {
      console.error('Error loading custom service mappings:', error);
      toast.error('Failed to load custom service mappings');
    }
  };

  const loadCustomCarrierCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_carrier_service_codes')
        .select('*')
        .eq('is_active', true)
        .order('carrier_type, service_code');

      if (error) throw error;
      setCustomCarrierCodes(data || []);
    } catch (error) {
      console.error('Error loading custom carrier codes:', error);
      toast.error('Failed to load custom carrier codes');
    }
  };

  const normalizeServiceName = (serviceName: string): string => {
    return serviceName?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
  };

  const saveCustomServiceMapping = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to save custom mappings');
        return;
      }

      const normalizedName = normalizeServiceName(newServiceForm.service_name);
      
      if (!newServiceForm.service_name.trim() || !newServiceForm.universal_category) {
        toast.error('Please fill in all required fields');
        return;
      }

      const mappingData = {
        user_id: user.id,
        service_name: newServiceForm.service_name.trim(),
        normalized_service_name: normalizedName,
        universal_category: newServiceForm.universal_category,
        confidence: newServiceForm.confidence,
        is_active: true
      };

      let result;
      if (editingServiceMapping) {
        const { data, error } = await supabase
          .from('custom_service_mappings')
          .update(mappingData)
          .eq('id', editingServiceMapping.id)
          .select()
          .single();
        result = { data, error };
      } else {
        const { data, error } = await supabase
          .from('custom_service_mappings')
          .insert(mappingData)
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) throw result.error;

      toast.success(editingServiceMapping ? 'Service mapping updated!' : 'Service mapping added!');
      setIsAddServiceDialogOpen(false);
      setEditingServiceMapping(null);
      setNewServiceForm({ service_name: '', universal_category: '', confidence: 0.9 });
      loadCustomServiceMappings();
    } catch (error: any) {
      console.error('Error saving service mapping:', error);
      if (error.code === '23505') {
        toast.error('A mapping for this service name already exists');
      } else {
        toast.error('Failed to save service mapping');
      }
    }
  };

  const saveCustomCarrierCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to save custom mappings');
        return;
      }

      if (!newCarrierCodeForm.carrier_type || !newCarrierCodeForm.service_code || 
          !newCarrierCodeForm.service_name || !newCarrierCodeForm.universal_category) {
        toast.error('Please fill in all required fields');
        return;
      }

      const codeData = {
        user_id: user.id,
        carrier_type: newCarrierCodeForm.carrier_type,
        service_code: newCarrierCodeForm.service_code.trim(),
        service_name: newCarrierCodeForm.service_name.trim(),
        universal_category: newCarrierCodeForm.universal_category,
        is_available: newCarrierCodeForm.is_available,
        is_active: true
      };

      let result;
      if (editingCarrierCode) {
        const { data, error } = await supabase
          .from('custom_carrier_service_codes')
          .update(codeData)
          .eq('id', editingCarrierCode.id)
          .select()
          .single();
        result = { data, error };
      } else {
        const { data, error } = await supabase
          .from('custom_carrier_service_codes')
          .insert(codeData)
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) throw result.error;

      toast.success(editingCarrierCode ? 'Carrier code updated!' : 'Carrier code added!');
      setIsAddCarrierCodeDialogOpen(false);
      setEditingCarrierCode(null);
      setNewCarrierCodeForm({
        carrier_type: '',
        service_code: '',
        service_name: '',
        universal_category: '',
        is_available: true
      });
      loadCustomCarrierCodes();
    } catch (error: any) {
      console.error('Error saving carrier code:', error);
      if (error.code === '23505') {
        toast.error('A code for this carrier and service already exists');
      } else {
        toast.error('Failed to save carrier code');
      }
    }
  };

  const deleteCustomServiceMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_service_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Service mapping deleted!');
      loadCustomServiceMappings();
    } catch (error) {
      console.error('Error deleting service mapping:', error);
      toast.error('Failed to delete service mapping');
    }
  };

  const deleteCustomCarrierCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_carrier_service_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Carrier code deleted!');
      loadCustomCarrierCodes();
    } catch (error) {
      console.error('Error deleting carrier code:', error);
      toast.error('Failed to delete carrier code');
    }
  };

  const startEditServiceMapping = (mapping: CustomServiceMapping) => {
    setEditingServiceMapping(mapping);
    setNewServiceForm({
      service_name: mapping.service_name,
      universal_category: mapping.universal_category,
      confidence: mapping.confidence
    });
    setIsAddServiceDialogOpen(true);
  };

  const startEditCarrierCode = (code: CustomCarrierServiceCode) => {
    setEditingCarrierCode(code);
    setNewCarrierCodeForm({
      carrier_type: code.carrier_type,
      service_code: code.service_code,
      service_name: code.service_name,
      universal_category: code.universal_category,
      is_available: code.is_available
    });
    setIsAddCarrierCodeDialogOpen(true);
  };

  // Filter universal services based on search
  const filteredUniversalServices = Object.entries(UNIVERSAL_SERVICES).filter(([key, service]) =>
    service.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Generate carrier mappings dynamically using available functions
  const generateCarrierMappings = () => {
    const carriers = [
      { type: CarrierType.UPS, name: 'UPS' },
      { type: CarrierType.FEDEX, name: 'FEDEX' },
      { type: CarrierType.DHL, name: 'DHL' },
      { type: CarrierType.AMAZON, name: 'AMAZON' }
    ];

    const mappings: any[] = [];

    carriers.forEach(carrier => {
      const availableCodes = getAvailableServiceCodes(carrier.type);
      
      // For each universal service category, check if this carrier supports it
      Object.keys(UNIVERSAL_SERVICES).forEach(categoryKey => {
        const category = categoryKey as UniversalServiceCategory;
        const serviceCode = getCarrierServiceCode(carrier.type, category);
        const serviceName = getCarrierServiceName(carrier.type, category);
        
        if (serviceCode && serviceName) {
          mappings.push({
            carrierType: carrier.name,
            serviceCode,
            serviceName,
            universalCategory: category,
            isAvailable: availableCodes.includes(serviceCode)
          });
        }
      });
    });

    return mappings;
  };

  // Filter carrier mappings
  const allCarrierMappings = generateCarrierMappings();
  const filteredCarrierMappings = allCarrierMappings
    .filter(mapping => selectedCarrier === 'all' || mapping.carrierType === selectedCarrier.toUpperCase())
    .filter(mapping =>
      mapping.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mapping.serviceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mapping.universalCategory.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Test service name mapping
  const handleTestServiceMapping = () => {
    if (!testServiceName.trim()) {
      toast.error('Please enter a service name to test');
      return;
    }

    const result = mapServiceToServiceCode(testServiceName);
    setTestResult(result);
    
    // Also show carrier-specific codes
    const carrierCodes = {
      UPS: getCarrierServiceCode(CarrierType.UPS, result.standardizedService),
      FEDEX: getCarrierServiceCode(CarrierType.FEDEX, result.standardizedService),
      DHL: getCarrierServiceCode(CarrierType.DHL, result.standardizedService),
      AMAZON: getCarrierServiceCode(CarrierType.AMAZON, result.standardizedService)
    };

    setTestResult({ ...result, carrierCodes });
  };

  const getServiceBadgeColor = (category: string) => {
    const service = UNIVERSAL_SERVICES[category as UniversalServiceCategory];
    if (service?.isInternational) return 'bg-blue-500/10 text-blue-600 border-blue-200';
    if (category.includes('OVERNIGHT')) return 'bg-red-500/10 text-red-600 border-red-200';
    if (category.includes('TWO_DAY')) return 'bg-orange-500/10 text-orange-600 border-orange-200';
    if (category.includes('GROUND')) return 'bg-green-500/10 text-green-600 border-green-200';
    return 'bg-gray-500/10 text-gray-600 border-gray-200';
  };

  const getCarrierBadgeColor = (carrier: string) => {
    switch (carrier) {
      case 'UPS': return 'bg-amber-500/10 text-amber-700 border-amber-200';
      case 'FEDEX': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      case 'DHL': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'AMAZON': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Mapping Manager
          </CardTitle>
          <CardDescription>
            View and manage universal service categories and carrier-specific service mappings.
            This system maps service names from your CSV files to standardized categories.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Services</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by service name, code, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="carrier-filter">Filter by Carrier</Label>
              <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                <SelectTrigger id="carrier-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Carriers</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FEDEX">FedEx</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="AMAZON">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Service Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Test Service Name Mapping
          </CardTitle>
          <CardDescription>
            Test how a service name from your CSV would be mapped to universal categories and carrier codes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Enter service name (e.g., 'UPS Ground', 'FedEx 2Day', 'Next Day Air')"
                value={testServiceName}
                onChange={(e) => setTestServiceName(e.target.value)}
              />
            </div>
            <Button onClick={handleTestServiceMapping} variant="outline">
              Test Mapping
            </Button>
          </div>
          
          {testResult && (
            <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">Original Service:</span>
                <Badge variant="outline">{testServiceName}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Universal Category:</span>
                <Badge className={getServiceBadgeColor(testResult.standardizedService)}>
                  {testResult.standardizedService}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  (Confidence: {Math.round(testResult.confidence * 100)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Standardized Name:</span>
                <span className="text-sm">{testResult.serviceName}</span>
              </div>
              
              {testResult.carrierCodes && (
                <div className="space-y-2">
                  <span className="font-medium">Carrier-Specific Codes:</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(testResult.carrierCodes).map(([carrier, code]) => (
                      <div key={carrier} className="flex items-center justify-between p-2 bg-background rounded border">
                        <Badge className={getCarrierBadgeColor(carrier)} variant="outline">
                          {carrier}
                        </Badge>
                        <span className="text-sm font-mono">{String(code || 'N/A')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="universal" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="universal" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Universal Services
          </TabsTrigger>
          <TabsTrigger value="carriers" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Carrier Mappings
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Custom Mappings
          </TabsTrigger>
        </TabsList>

        {/* Universal Services Tab */}
        <TabsContent value="universal">
          <Card>
            <CardHeader>
              <CardTitle>Universal Service Categories</CardTitle>
              <CardDescription>
                Standard service categories used across all carriers for consistent mapping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Transit Days</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUniversalServices.map(([key, service]) => (
                      <TableRow key={key}>
                        <TableCell>
                          <Badge className={getServiceBadgeColor(key)} variant="outline">
                            {key}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{service.displayName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {service.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {service.typicalTransitDays} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {service.isInternational ? (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-200" variant="outline">
                              International
                            </Badge>
                          ) : (
                            <Badge variant="outline">Domestic</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carrier Mappings Tab */}
        <TabsContent value="carriers">
          <Card>
            <CardHeader>
              <CardTitle>Carrier Service Mappings</CardTitle>
              <CardDescription>
                How universal service categories map to specific carrier service codes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Service Code</TableHead>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Universal Category</TableHead>
                      <TableHead>Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCarrierMappings.map((mapping, index) => (
                      <TableRow key={`${mapping.carrierType}-${mapping.serviceCode}-${index}`}>
                        <TableCell>
                          <Badge className={getCarrierBadgeColor(mapping.carrierType)} variant="outline">
                            {mapping.carrierType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {mapping.serviceCode}
                          </code>
                        </TableCell>
                        <TableCell className="font-medium">{mapping.serviceName}</TableCell>
                        <TableCell>
                          <Badge className={getServiceBadgeColor(mapping.universalCategory)} variant="outline">
                            {mapping.universalCategory}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mapping.isAvailable ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-200" variant="outline">
                              Available
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-600 border-red-200" variant="outline">
                              Unavailable
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Mappings Tab */}
        <TabsContent value="custom">
          <div className="space-y-6">
            {/* Custom Service Mappings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Custom Service Mappings
                  <Dialog open={isAddServiceDialogOpen} onOpenChange={setIsAddServiceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingServiceMapping(null);
                          setNewServiceForm({ service_name: '', universal_category: '', confidence: 0.9 });
                        }}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Service Mapping
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {editingServiceMapping ? 'Edit Service Mapping' : 'Add Service Mapping'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="service_name">Service Name</Label>
                          <Input
                            id="service_name"
                            placeholder="e.g., 'Custom Express', 'Special Ground'"
                            value={newServiceForm.service_name}
                            onChange={(e) => setNewServiceForm(prev => ({ 
                              ...prev, 
                              service_name: e.target.value 
                            }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="universal_category">Universal Category</Label>
                          <Select 
                            value={newServiceForm.universal_category}
                            onValueChange={(value) => setNewServiceForm(prev => ({ 
                              ...prev, 
                              universal_category: value 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              {Object.keys(UNIVERSAL_SERVICES).map(category => (
                                <SelectItem key={category} value={category}>
                                  {UNIVERSAL_SERVICES[category as UniversalServiceCategory].displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="confidence">Confidence (0.0 - 1.0)</Label>
                          <Input
                            id="confidence"
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={newServiceForm.confidence}
                            onChange={(e) => setNewServiceForm(prev => ({ 
                              ...prev, 
                              confidence: parseFloat(e.target.value) 
                            }))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveCustomServiceMapping} className="flex-1">
                            <Save className="h-4 w-4 mr-2" />
                            {editingServiceMapping ? 'Update' : 'Save'}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsAddServiceDialogOpen(false);
                              setEditingServiceMapping(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
                <CardDescription>
                  Create custom mappings for service names that aren't automatically recognized.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Universal Category</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customServiceMappings
                        .filter(mapping => 
                          mapping.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          mapping.universal_category.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(mapping => (
                        <TableRow key={mapping.id}>
                          <TableCell className="font-medium">{mapping.service_name}</TableCell>
                          <TableCell>
                            <Badge className={getServiceBadgeColor(mapping.universal_category)} variant="outline">
                              {mapping.universal_category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {Math.round(mapping.confidence * 100)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditServiceMapping(mapping)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteCustomServiceMapping(mapping.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {customServiceMappings.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No custom service mappings yet. Add one to get started!
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Custom Carrier Service Codes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Custom Carrier Service Codes
                  <Dialog open={isAddCarrierCodeDialogOpen} onOpenChange={setIsAddCarrierCodeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingCarrierCode(null);
                          setNewCarrierCodeForm({
                            carrier_type: '',
                            service_code: '',
                            service_name: '',
                            universal_category: '',
                            is_available: true
                          });
                        }}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Carrier Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {editingCarrierCode ? 'Edit Carrier Service Code' : 'Add Carrier Service Code'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="carrier_type">Carrier Type</Label>
                          <Select 
                            value={newCarrierCodeForm.carrier_type}
                            onValueChange={(value) => setNewCarrierCodeForm(prev => ({ 
                              ...prev, 
                              carrier_type: value 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select carrier" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="UPS">UPS</SelectItem>
                              <SelectItem value="FEDEX">FedEx</SelectItem>
                              <SelectItem value="DHL">DHL</SelectItem>
                              <SelectItem value="AMAZON">Amazon</SelectItem>
                              <SelectItem value="USPS">USPS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="service_code">Service Code</Label>
                          <Input
                            id="service_code"
                            placeholder="e.g., '99', 'CUSTOM_GROUND'"
                            value={newCarrierCodeForm.service_code}
                            onChange={(e) => setNewCarrierCodeForm(prev => ({ 
                              ...prev, 
                              service_code: e.target.value 
                            }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="service_name">Service Name</Label>
                          <Input
                            id="service_name"
                            placeholder="e.g., 'Custom Service'"
                            value={newCarrierCodeForm.service_name}
                            onChange={(e) => setNewCarrierCodeForm(prev => ({ 
                              ...prev, 
                              service_name: e.target.value 
                            }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="universal_category">Universal Category</Label>
                          <Select 
                            value={newCarrierCodeForm.universal_category}
                            onValueChange={(value) => setNewCarrierCodeForm(prev => ({ 
                              ...prev, 
                              universal_category: value 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              {Object.keys(UNIVERSAL_SERVICES).map(category => (
                                <SelectItem key={category} value={category}>
                                  {UNIVERSAL_SERVICES[category as UniversalServiceCategory].displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveCustomCarrierCode} className="flex-1">
                            <Save className="h-4 w-4 mr-2" />
                            {editingCarrierCode ? 'Update' : 'Save'}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsAddCarrierCodeDialogOpen(false);
                              setEditingCarrierCode(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
                <CardDescription>
                  Add custom carrier-specific service codes and map them to universal categories.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Service Code</TableHead>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Universal Category</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customCarrierCodes
                        .filter(code => 
                          selectedCarrier === 'all' || code.carrier_type === selectedCarrier.toUpperCase()
                        )
                        .filter(code =>
                          code.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          code.service_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          code.universal_category.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(code => (
                        <TableRow key={code.id}>
                          <TableCell>
                            <Badge className={getCarrierBadgeColor(code.carrier_type)} variant="outline">
                              {code.carrier_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-sm">
                              {code.service_code}
                            </code>
                          </TableCell>
                          <TableCell className="font-medium">{code.service_name}</TableCell>
                          <TableCell>
                            <Badge className={getServiceBadgeColor(code.universal_category)} variant="outline">
                              {code.universal_category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditCarrierCode(code)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteCustomCarrierCode(code.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {customCarrierCodes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No custom carrier codes yet. Add one to get started!
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServiceMappingManager;