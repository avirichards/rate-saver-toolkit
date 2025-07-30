// Web Worker for CSV processing
import { validateShipmentData } from '../utils/addressValidation';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
  carrier?: string;
  weight?: string;
  weightUnit?: string;
  currentRate?: string;
  originZip?: string;
  destZip?: string;
  length?: string;
  width?: string;
  height?: string;
  shipperName?: string;
  shipperAddress?: string;
  shipperCity?: string;
  shipperState?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientCity?: string;
  recipientState?: string;
  zone?: string;
}

interface WorkerMessage {
  type: 'PROCESS_BATCH' | 'VALIDATE_BATCH';
  data: {
    rows: any[];
    mappings: Record<string, string>;
    startIndex: number;
    originZipOverride?: string;
  };
}

interface WorkerResponse {
  type: 'BATCH_COMPLETE' | 'VALIDATION_COMPLETE' | 'ERROR';
  data: any;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
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
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    } as WorkerResponse);
  }
};

async function processBatch(data: {
  rows: any[];
  mappings: Record<string, string>;
  startIndex: number;
  originZipOverride?: string;
}) {
  const { rows, mappings, startIndex, originZipOverride } = data;
  const processedShipments: ProcessedShipment[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const shipment: ProcessedShipment = { id: startIndex + i + 1 };

    Object.entries(mappings).forEach(([fieldName, csvHeader]) => {
      if (csvHeader && csvHeader !== "__NONE__" && row[csvHeader] !== undefined) {
        let value = row[csvHeader];
        if (typeof value === 'string') {
          value = value.trim();
        }
        (shipment as any)[fieldName] = value;
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
  } as WorkerResponse);
}

async function validateBatch(data: {
  rows: ProcessedShipment[];
  startIndex: number;
}) {
  const { rows, startIndex } = data;
  const validationResults: Record<number, any> = {};

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
  } as WorkerResponse);
}