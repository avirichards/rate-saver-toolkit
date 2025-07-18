import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountInfo } from '@/hooks/useAccountAssignments';

interface AccountSelectorProps {
  accounts: AccountInfo[];
  selectedAccount?: AccountInfo;
  onAccountSelect: (account: AccountInfo) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  selectedAccount,
  onAccountSelect,
  placeholder = "Select account...",
  disabled = false,
  size = 'default'
}) => {
  const handleValueChange = (value: string) => {
    const [carrierType, accountName] = value.split('|');
    const account = accounts.find(a => 
      a.carrierType === carrierType && a.accountName === accountName
    );
    if (account) {
      onAccountSelect(account);
    }
  };

  const currentValue = selectedAccount ? 
    `${selectedAccount.carrierType}|${selectedAccount.accountName}` : '';

  return (
    <Select value={currentValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger className={size === 'sm' ? 'h-8 text-xs' : ''}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => {
          const value = `${account.carrierType}|${account.accountName}`;
          return (
            <SelectItem key={value} value={value}>
              <div className="flex flex-col">
                <span className="font-medium">{account.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {account.carrierType}
                </span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};