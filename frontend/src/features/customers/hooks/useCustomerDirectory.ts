import { useMemo } from 'react';
import type { SelectOption } from '@/components/ui/SelectField';
import { useCustomersQuery } from '../api/customerApi';

/** Customers the current user may see, as a name lookup and as select options (for list columns and form pickers). */
export function useCustomerDirectory() {
  const customersQuery = useCustomersQuery();
  return useMemo(() => {
    const customers = customersQuery.data ?? [];
    return {
      nameOf: (customerId: string | null): string | null => (customerId ? (customers.find((customer) => customer.customerId === customerId)?.fullName ?? null) : null),
      options: customers.map((customer): SelectOption => ({ value: customer.customerId, label: customer.fullName })),
    };
  }, [customersQuery.data]);
}
