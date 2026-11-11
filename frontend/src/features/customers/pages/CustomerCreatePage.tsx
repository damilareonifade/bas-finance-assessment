import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import type { SubmitIntent } from '@/components/layout/submitIntent';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/features/auth';
import { useCreateCustomerMutation } from '../api/customerApi';
import { CustomerForm } from '../components/CustomerForm';
import { useOfficerOptions } from '../hooks/useOfficerOptions';
import type { CustomerRequest } from '../schemas/customer';

export default function CustomerCreatePage() {
  const isAdmin = useCurrentUser().role === 'ADMIN';
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreateCustomerMutation();
  const officerOptions = useOfficerOptions(isAdmin);

  const handleSubmit = (request: CustomerRequest, intent: SubmitIntent, resetForm: () => void) =>
    createMutation.mutate(request, {
      onSuccess: ({ customer }) => {
        toast.success('Customer created', customer.fullName);
        if (intent === 'create-another') resetForm();
        else navigate(`/customers/${customer.customerId}`);
      },
    });

  return (
    <>
      <PageHeader
        title="New customer"
        breadcrumbs={[{ label: 'Customers', to: '/customers' }, { label: 'Create' }]}
        description={isAdmin ? undefined : 'New customers are assigned to you.'}
      />
      <CustomerForm
        isSubmitting={createMutation.isPending}
        serverError={createMutation.error}
        officerOptions={isAdmin ? officerOptions : undefined}
        cancelTo="/customers"
        onSubmit={handleSubmit}
      />
    </>
  );
}
