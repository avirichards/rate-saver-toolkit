// Web Worker for CSV processing

// Mock validation function since we can't import from utils in worker
function validateShipmentData(shipment) {
  const errors = {};
  const warnings = {};
  
  // Basic validation
  if (!shipment.originZip || shipment.originZip.length < 5) {
    errors.originZip = ['Invalid origin ZIP code'];
  }
  if (!shipment.destZip || shipment.destZip.length < 5) {
    errors.destZip = ['Invalid destination ZIP code'];
  }
  if (!shipment.weight || isNaN(parseFloat(shipment.weight))) {
    errors.weight = ['Invalid weight'];
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
}

self.onmessage = async (e) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'PROCESS_BATCH':
        await processBatch(data);
        break;
      case 'VALIDATE_BATCH':
        await validateBatch(data);
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { error: error.message || 'Unknown error' }
    });
  }
};

async function processBatch(data) {
  const { rows, mappings, startIndex, originZipOverride } = data;
  const processedShipments = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const shipment = { id: startIndex + i + 1 };

    Object.entries(mappings).forEach(([fieldName, csvHeader]) => {
      if (csvHeader && csvHeader !== "__NONE__" && row[csvHeader] !== undefined) {
        let value = row[csvHeader];
        if (typeof value === 'string') {
          value = value.trim();
        }
        shipment[fieldName] = value;
      }
    });

    // Apply origin ZIP override if provided
    if (originZipOverride && originZipOverride.trim()) {
      shipment.originZip = originZipOverride.trim();
    }

    processedShipments.push(shipment);

    // Yield control periodically
    if (i % 100 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  self.postMessage({
    type: 'BATCH_COMPLETE',
    data: { shipments: processedShipments, startIndex }
  });
}

async function validateBatch(data) {
  const { rows, startIndex } = data;
  const validationResults = {};

  for (let i = 0; i < rows.length; i++) {
    const shipment = rows[i];
    const result = validateShipmentData(shipment);
    validationResults[startIndex + i] = result;

    // Yield control periodically
    if (i % 50 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  self.postMessage({
    type: 'VALIDATION_COMPLETE',
    data: { results: validationResults, startIndex }
  });
}