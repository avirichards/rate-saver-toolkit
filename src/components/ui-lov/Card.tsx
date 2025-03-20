
import React from 'react';
import { Card as ShadcnCard, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'glass';
  hover?: boolean;
  animation?: 'none' | 'fade-in' | 'slide-up' | 'slide-right';
  children: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className, 
    variant = 'default', 
    hover = false, 
    animation = 'none',
    children, 
    ...props 
  }, ref) => {
    // Map our custom variants
    const getVariantClasses = () => {
      switch (variant) {
        case 'outline':
          return 'border-2 shadow-none';
        case 'glass':
          return 'bg-white/70 backdrop-blur-md border border-white/20 shadow-subtle';
        default:
          return '';
      }
    };
    
    // Animation classes
    const getAnimationClasses = () => {
      switch (animation) {
        case 'fade-in':
          return 'animate-fade-in';
        case 'slide-up':
          return 'animate-slide-in-up';
        case 'slide-right':
          return 'animate-slide-in-right';
        default:
          return '';
      }
    };

    return (
      <ShadcnCard
        ref={ref}
        className={cn(
          getVariantClasses(),
          hover && 'card-hover',
          getAnimationClasses(),
          className
        )}
        {...props}
      >
        {children}
      </ShadcnCard>
    );
  }
);

Card.displayName = 'Card';

// Properly typed exports of Card subcomponents
const CardTitleComponent = React.forwardRef<
  HTMLHeadingElement, 
  React.HTMLAttributes<HTMLHeadingElement>
>((props, ref) => (
  <CardTitle ref={ref} {...props} />
));
CardTitleComponent.displayName = 'CardTitle';

const CardDescriptionComponent = React.forwardRef<
  HTMLParagraphElement, 
  React.HTMLAttributes<HTMLParagraphElement>
>((props, ref) => (
  <CardDescription ref={ref} {...props} />
));
CardDescriptionComponent.displayName = 'CardDescription';

export { 
  Card, 
  CardHeader, 
  CardTitleComponent as CardTitle, 
  CardDescriptionComponent as CardDescription, 
  CardContent, 
  CardFooter 
};
