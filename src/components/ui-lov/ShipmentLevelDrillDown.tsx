
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Package, MapPin, TrendingDown, Clock, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ShipmentDetail {
  shipmentIndex: number;
  shipmentData: any;
  rates: {
    accountName: string;
    serviceCode: string;
    serviceName: string;
    rateAmount: number;
    transitDays: number;
    isNegotiated: boolean;
    isBest: boolean;
  }[];
  bestRate: number;
  potentialSavings: number;
}

interface ShipmentLevelDrillDownProps {
  shipments: ShipmentDetail[];
  selectedService?: string;
  onBack: () => void;
}

export const ShipmentLevelDrillDown: React.FC<ShipmentLevelDrillDownProps> = ({ 
  shipments, 
  selectedService,
  onBack 
}) => {
  const [expandedShipment, setExpandedShipment] = useState<number | null>(null);

  const filteredShipments = selectedService 
    ? shipments.filter(shipment => 
        shipment.rates.some(rate => rate.serviceName === selectedService)
      )
    : shipments;

  const totalSavings = filteredShipments.reduce((sum, shipment) => sum + shipment.potentialSavings, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Services
              </Button>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Shipment Details {selectedService && `- ${selectedService}`}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{filteredShipments.length}</div>
              <div className="text-sm text-muted-foreground">Shipments</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSavings)}</div>
              <div className="text-sm text-muted-foreground">Total Savings</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {filteredShipments.length > 0 ? formatCurrency(totalSavings / filteredShipments.length) : '$0'}
              </div>
              <div className="text-sm text-muted-foreground">Avg Savings</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Individual Shipment Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredShipments.map((shipment) => (
              <div key={shipment.shipmentIndex} className="border rounded-lg">
                <div 
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedShipment(
                    expandedShipment === shipment.shipmentIndex ? null : shipment.shipmentIndex
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium">
                          {shipment.shipmentData?.trackingNumber || `Shipment #${shipment.shipmentIndex + 1}`}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm mt-2">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="font-medium">Origin:</span>
                            <span>{shipment.shipmentData?.shipFrom?.zipCode || shipment.shipmentData?.origin || 'N/A'}</span>
                          </div>
                          
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="font-medium">Destination:</span>
                            <span>{shipment.shipmentData?.shipTo?.zipCode || shipment.shipmentData?.destination || 'N/A'}</span>
                          </div>
                          
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Package className="h-3 w-3" />
                            <span className="font-medium">Weight:</span>
                            <span>{shipment.shipmentData?.package?.weight || shipment.shipmentData?.weight || 'N/A'} lbs</span>
                          </div>
                          
                          {(shipment.shipmentData?.package?.dimensions || shipment.shipmentData?.dimensions) && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span>📏</span>
                              <span className="font-medium">Dimensions:</span>
                              <span>
                                {shipment.shipmentData?.package?.dimensions ? 
                                  `${shipment.shipmentData.package.dimensions.length}×${shipment.shipmentData.package.dimensions.width}×${shipment.shipmentData.package.dimensions.height}"` :
                                  shipment.shipmentData?.dimensions || 'N/A'
                                }
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span>🏠</span>
                            <span className="font-medium">Residential:</span>
                            <span>{shipment.shipmentData?.residential === true ? 'Yes' : shipment.shipmentData?.residential === false ? 'No' : 'N/A'}</span>
                          </div>
                          
                          {shipment.shipmentData?.currentService && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span>🚚</span>
                              <span className="font-medium">Current Service:</span>
                              <span>{shipment.shipmentData.currentService}</span>
                            </div>
                          )}
                          
                          {shipment.shipmentData?.shipProsService && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span>⭐</span>
                              <span className="font-medium">Ship Pros Service:</span>
                              <span>{shipment.shipmentData.shipProsService}</span>
                            </div>
                          )}
                          
                          {shipment.shipmentData?.currentRate && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              <span className="font-medium">Current Rate:</span>
                              <span>{formatCurrency(shipment.shipmentData.currentRate)}</span>
                            </div>
                          )}
                          
                          {shipment.shipmentData?.shipProsCost && (
                            <div className="flex items-center gap-1 text-green-600">
                              <TrendingDown className="h-3 w-3" />
                              <span className="font-medium">Ship Pros Cost:</span>
                              <span>{formatCurrency(shipment.shipmentData.shipProsCost)}</span>
                            </div>
                          )}
                          
                          {shipment.shipmentData?.reference && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span>📋</span>
                              <span className="font-medium">Reference:</span>
                              <span>{shipment.shipmentData.reference}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-green-600">
                        {formatCurrency(shipment.potentialSavings)}
                      </div>
                      <div className="text-sm text-muted-foreground">Potential Savings</div>
                    </div>
                  </div>
                </div>

                {expandedShipment === shipment.shipmentIndex && (
                  <div className="border-t bg-muted/20 p-4">
                    <div className="mb-4">
                      <h5 className="font-semibold mb-2">
                        Rate Comparison for {shipment.shipmentData?.trackingNumber || `Shipment #${shipment.shipmentIndex + 1}`}
                      </h5>
                      <div className="text-sm text-muted-foreground mb-3">
                        Best rate saves <span className="font-semibold text-green-600">{formatCurrency(shipment.potentialSavings)}</span> vs current cost
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              Rate
                            </div>
                          </TableHead>
                          <TableHead>Current vs New</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                       {shipment.rates.map((rate, index) => (
                          <TableRow key={index} className={rate.isBest ? 'border-green-600 border-2' : ''}>
                            <TableCell className="font-medium">{rate.accountName}</TableCell>
                            <TableCell>{rate.serviceName || rate.serviceCode}</TableCell>
                            <TableCell className={rate.isBest ? 'text-green-600 font-semibold' : ''}>
                              {formatCurrency(rate.rateAmount)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {shipment.shipmentData?.currentRate && (
                                  <div className="text-muted-foreground">
                                    Was: {formatCurrency(shipment.shipmentData.currentRate)}
                                  </div>
                                )}
                                <div className={rate.isBest ? 'text-green-600 font-semibold' : ''}>
                                  Now: {formatCurrency(rate.rateAmount)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={rate.isNegotiated ? 'default' : 'secondary'}>
                                {rate.isNegotiated ? 'Negotiated' : 'Published'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {rate.isBest && (
                                <Badge variant="default" className="bg-green-600">
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  Best Rate
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
