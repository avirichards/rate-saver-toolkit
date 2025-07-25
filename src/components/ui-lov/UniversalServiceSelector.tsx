/**
 * Universal service selector component for carrier-agnostic service selection
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UNIVERSAL_SERVICES, UniversalServiceCategory } from "@/utils/universalServiceCategories";

interface UniversalServiceSelectorProps {
  value: UniversalServiceCategory | string;
  onValueChange: (value: UniversalServiceCategory) => void;
  placeholder?: string;
  className?: string;
}

export function UniversalServiceSelector(props: UniversalServiceSelectorProps) {
  const selectedService = typeof props.value === 'string' 
    ? Object.values(UNIVERSAL_SERVICES).find(s => s.displayName === props.value || s.category === props.value)
    : UNIVERSAL_SERVICES[props.value];

  return (
    <Select 
      value={props.value as string} 
      onValueChange={(value) => props.onValueChange(value as UniversalServiceCategory)}
    >
      <SelectTrigger className={props.className}>
        <SelectValue placeholder={props.placeholder || "Select service type"}>
          {selectedService && (
            <div className="flex items-center gap-2">
              <span>{selectedService.displayName}</span>
              {selectedService.isInternational && (
                <Badge variant="secondary" className="text-xs">Intl</Badge>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.values(UNIVERSAL_SERVICES).map((service) => (
          <SelectItem key={service.category} value={service.category}>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{service.displayName}</span>
                {service.isInternational && (
                  <Badge variant="secondary" className="text-xs">Intl</Badge>
                )}
                <span className="text-xs text-muted-foreground">({service.typicalTransitDays} days)</span>
              </div>
              <span className="text-xs text-muted-foreground">{service.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}