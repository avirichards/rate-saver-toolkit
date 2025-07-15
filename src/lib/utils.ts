import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Number formatting utilities
export function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const formattedAmount = `$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return amount < 0 ? `-${formattedAmount}` : formattedAmount;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getSavingsColor(amount: number): string {
  if (amount > 0) return "text-green-600";
  if (amount < 0) return "text-red-600";
  return "text-muted-foreground";
}
