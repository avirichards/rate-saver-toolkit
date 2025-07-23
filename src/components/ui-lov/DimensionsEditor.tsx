import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DimensionsEditorProps {
  length: string | number;
  width: string | number;
  height: string | number;
  onSave: (length: string, width: string, height: string) => void;
  className?: string;
}

export function DimensionsEditor({
  length,
  width,
  height,
  onSave,
  className
}: DimensionsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Format the display value
  const displayValue = `${length || 12}×${width || 12}×${height || 6}`;

  useEffect(() => {
    if (isEditing) {
      setEditValue(displayValue);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing, displayValue]);

  const handleSave = () => {
    // Parse the input value (expect format like "12×12×6" or "12x12x6")
    const parts = editValue.split(/[×x]/);
    if (parts.length === 3) {
      const [l, w, h] = parts.map(p => p.trim());
      onSave(l, w, h);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(displayValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="L×W×H"
        className={cn(
          "h-6 text-xs border-0 bg-transparent p-1",
          "focus:ring-2 focus:ring-primary/20 focus:bg-muted/10 rounded-md",
          "placeholder:text-muted-foreground/50",
          className
        )}
        style={{ 
          fontSize: 'inherit',
          fontWeight: 'inherit',
          color: 'inherit',
          width: '100%'
        }}
      />
    );
  }

  return (
    <span 
      className={cn(
        "text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5",
        className
      )}
      onClick={() => setIsEditing(true)}
    >
      {displayValue}
    </span>
  );
}