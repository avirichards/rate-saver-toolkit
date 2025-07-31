
import React, { useState, useRef } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { cn } from '@/lib/utils';

export interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in MB
  onFileSelect?: (file: File) => void;
  onUpload?: (file: File) => void;
  onError?: (error: string) => void;
  acceptedFileTypes?: string[];
  maxFileSizeMB?: number;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = '.csv',
  maxSize = 100, // Default 100MB
  onFileSelect,
  onUpload,
  onError,
  acceptedFileTypes,
  maxFileSizeMB,
  className,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the appropriate prop based on what was passed
  const effectiveMaxSize = maxFileSizeMB || maxSize;
  const effectiveAccept = acceptedFileTypes?.join(',') || accept;
  
  // Use appropriate handler
  const handleFileCallback = (file: File) => {
    if (onFileSelect) onFileSelect(file);
    if (onUpload) onUpload(file);
  };
  
  const handleErrorCallback = (errorMsg: string) => {
    if (onError) onError(errorMsg);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): boolean => {
    // Check file type
    if (effectiveAccept && !file.name.endsWith('.csv')) {
      const errorMsg = `Only ${effectiveAccept} files are accepted`;
      setError(errorMsg);
      handleErrorCallback(errorMsg);
      return false;
    }
    
    // Check file size
    if (file.size > effectiveMaxSize * 1024 * 1024) {
      const errorMsg = `File size exceeds ${effectiveMaxSize}MB limit`;
      setError(errorMsg);
      handleErrorCallback(errorMsg);
      return false;
    }
    
    setError(null);
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        handleFileCallback(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        handleFileCallback(file);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {!selectedFile ? (
        <Card
          className={cn(
            'border-2 border-dashed border-gray-300 transition-all duration-300',
            dragActive ? 'border-app-blue-400 bg-app-blue-50' : 'hover:border-gray-400',
            error && 'border-red-300 bg-red-50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className={cn(
              'w-16 h-16 mb-4 rounded-full flex items-center justify-center',
              dragActive ? 'bg-app-blue-100 text-app-blue-500' : 'bg-gray-100 text-gray-500'
            )}>
              <Upload
                className={cn(
                  'h-8 w-8 transition-transform',
                  dragActive && 'scale-110'
                )}
              />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {dragActive ? 'Drop your file here' : 'Upload Shipping Data'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Drag & drop your CSV file or click to browse
            </p>
            <Button
              onClick={triggerFileInput}
              variant="primary"
              className="mb-2"
            >
              Select File
            </Button>
            <p className="text-xs text-muted-foreground">
              Accepts {effectiveAccept} files up to {effectiveMaxSize}MB
            </p>
            {error && (
              <div className="mt-4 text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border animate-fade-in">
          <CardContent className="py-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-app-blue-100 rounded-full flex items-center justify-center text-app-blue-500 mr-3">
                <File className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex items-center ml-2">
                <CheckCircle className="h-5 w-5 text-app-green-500 mr-2" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  className="h-8 w-8 rounded-full text-gray-500 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={effectiveAccept}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
};
