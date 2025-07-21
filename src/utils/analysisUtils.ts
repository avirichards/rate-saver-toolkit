
export const calculateSavings = (fileData: any[]) => {
  // Basic analysis calculation - this should match your existing analysis logic
  const processedShipments = fileData.map((row, index) => ({
    id: index,
    trackingId: row.trackingId || row.tracking_id || `shipment-${index}`,
    originZip: row.originZip || row.origin_zip || '',
    destZip: row.destZip || row.dest_zip || '',
    weight: row.weight || 0,
    service: row.service || 'Ground',
    currentRate: row.currentRate || row.current_rate || 0,
    newRate: row.newRate || row.new_rate || 0,
    savings: (row.currentRate || row.current_rate || 0) - (row.newRate || row.new_rate || 0),
    originalData: row
  }));

  const orphanedShipments = fileData.filter(row => 
    !row.trackingId && !row.tracking_id
  ).map((row, index) => ({
    id: index,
    reason: 'Missing tracking ID',
    originalData: row
  }));

  const totalSavings = processedShipments.reduce((sum, shipment) => sum + shipment.savings, 0);
  const totalCost = processedShipments.reduce((sum, shipment) => sum + shipment.currentRate, 0);
  const averageSavings = processedShipments.length > 0 ? totalSavings / processedShipments.length : 0;

  const summary = {
    totalSavings,
    totalCost,
    averageSavings,
    processedCount: processedShipments.length,
    orphanedCount: orphanedShipments.length
  };

  return {
    processedShipments,
    orphanedShipments,
    summary
  };
};
