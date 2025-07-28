import React, { useState } from 'react';
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

// Import the existing service utilities
import { UNIVERSAL_SERVICES, UniversalServiceCategory } from '@/utils/universalServiceCategories';
import { 
  getCarrierServiceCode,
  getCarrierServiceName,
  getAvailableServiceCodes,
  CarrierType
} from '@/utils/carrierServiceRegistry';
import { mapServiceToServiceCode } from '@/utils/serviceMapping';

const ServiceMappingManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');
  const [newServiceName, setNewServiceName] = useState('');
  const [testServiceName, setTestServiceName] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="universal" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Universal Services
          </TabsTrigger>
          <TabsTrigger value="carriers" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Carrier Mappings
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
      </Tabs>
    </div>
  );
};

export default ServiceMappingManager;