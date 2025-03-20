
import React from 'react';
import { Button as ShadcnButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'primary' | 'secondary' | 'text';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xl';
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'default', 
    loading = false, 
    iconLeft, 
    iconRight, 
    fullWidth = false,
    disabled, 
    children, 
    ...props 
  }, ref) => {
    // Map our custom variants to shadcn variants or add custom classes
    const getVariantClasses = () => {
      switch (variant) {
        case 'primary':
          return 'bg-app-blue-500 hover:bg-app-blue-600 text-white';
        case 'secondary':
          return 'bg-app-green-500 hover:bg-app-green-600 text-white';
        case 'text':
          return 'bg-transparent hover:bg-transparent text-foreground hover:text-app-blue-500 hover:underline';
        default:
          return '';
      }
    };
    
    const getCustomSizeClasses = () => {
      switch (size) {
        case 'xl':
          return 'h-14 px-8 text-lg rounded-xl';
        default:
          return '';
      }
    };

    // Add custom props and classes
    const buttonVariant = 
      variant === 'primary' || variant === 'secondary' || variant === 'text' 
        ? 'default' 
        : variant;

    return (
      <ShadcnButton
        ref={ref}
        variant={buttonVariant as any}
        size={size === 'xl' ? 'default' : size}
        disabled={disabled || loading}
        className={cn(
          getVariantClasses(),
          getCustomSizeClasses(),
          loading && 'opacity-80',
          fullWidth && 'w-full',
          'transition-all duration-300 ease-in-out',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!loading && iconLeft && <span className="mr-2">{iconLeft}</span>}
        {children}
        {iconRight && <span className="ml-2">{iconRight}</span>}
      </ShadcnButton>
    );
  }
);

Button.displayName = 'Button';

export { Button };
