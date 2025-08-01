// Frontend CSV processing utility
export interface CSVProcessingResult {
  headers: string[];
  data: Record<string, any>[];
  rowCount: number;
  fileName: string;
}

export function parseCSVFile(file: File): Promise<CSVProcessingResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        if (!csvText) {
          throw new Error('Failed to read file contents');
        }
        
        const result = parseCSVText(csvText, file.name);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

export function parseCSVText(csvText: string, fileName: string = 'data.csv'): CSVProcessingResult {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Parse headers from first line
  const headers = parseCSVLine(lines[0]);
  
  if (headers.length === 0) {
    throw new Error('No headers found in CSV file');
  }
  
  // Parse data rows
  const data: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Skip empty rows
    if (values.length === 0 || values.every(val => !val.trim())) {
      continue;
    }
    
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return {
    headers,
    data,
    rowCount: data.length,
    fileName
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add the last field
  result.push(currentField.trim());
  
  return result;
}