import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditableFieldProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  minWidth?: string;
}

export function InlineEditableField({
  value,
  onSave,
  placeholder = 'Click to edit',
  className,
  disabled = false,
  required = false,
  minWidth = '200px'
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (required && !editValue.trim()) {
      return;
    }

    if (editValue.trim() === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder={placeholder}
        disabled={isSaving}
        className={cn(
          "border-0 bg-transparent p-0 text-inherit font-inherit text-size-inherit",
          "focus:ring-2 focus:ring-primary/20 focus:bg-muted/10 rounded-md px-2 py-1",
          "placeholder:text-muted-foreground/50 caret-white",
          className
        )}
        style={{ 
          fontSize: 'inherit',
          fontWeight: 'inherit',
          color: 'inherit',
          background: 'transparent',
          caretColor: 'white',
          width: '100%'
        }}
      />
    );
  }

  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <div 
      className={cn(
        "group flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 min-h-8",
        isEmpty && "text-muted-foreground italic",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={() => !disabled && setIsEditing(true)}
      style={{ minWidth }}
    >
      <span className="truncate">{displayValue}</span>
      {!disabled && (
        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      )}
    </div>
  );
}