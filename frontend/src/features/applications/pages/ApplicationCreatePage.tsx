import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import type { SubmitIntent } from '@/components/layout/submitIntent';
import { useToast } from '@/components/ui/Toast';
import { useCustomerDirectory } from '@/features/customers';
import { useLoanProductsQuery } from '@/features/loan-products';
import { formatKobo } from '@/lib/money';
import { useSubmitApplicationMutation } from '../api/applicationsApi';
import { ApplicationForm } from '../components/ApplicationForm';
import type { ApplicationRequest } from '../schemas/application';

export default function ApplicationCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') ?? '';
  const customerDirectory = useCustomerDirectory();
  const productsQuery = useLoanProductsQuery('ACTIVE');
  const productOptions = useMemo(
    () => (productsQuery.data ?? []).filter(({ product }) => product.type === 'TERM_LOAN').map(({ product }) => ({ value: product.productId, label: product.name })),
    [productsQuery.data],
  );
  const submitMutation = useSubmitApplicationMutation();
  const customerName = customerDirectory.nameOf(preselectedCustomerId || null);
  const backTo = preselectedCustomerId ? `/customers/${preselectedCustomerId}?tab=applications` : '/applications';

  const handleSubmit = (request: ApplicationRequest, intent: SubmitIntent, resetForm: () => void) =>
    submitMutation.mutate(request, {
      onSuccess: (application) => {
        toast.success('Application submitted', `${application.customer.fullName}, ${formatKobo(application.principalKobo)}`);
        if (intent === 'create-another') resetForm();
        else navigate(`/applications/${application.applicationId}`);
      },
    });

  return (
    <>
      <PageHeader
        title="New loan application"
        breadcrumbs={
          customerName
            ? [{ label: 'Customers', to: '/customers' }, { label: customerName, to: backTo }, { label: 'New application' }]
            : [{ label: 'Applications', to: '/applications' }, { label: 'Create' }]
        }
      />
      <ApplicationForm
        customerOptions={customerDirectory.options}
        productOptions={productOptions}
        defaultCustomerId={preselectedCustomerId}
        isSubmitting={submitMutation.isPending}
        serverError={submitMutation.error}
        cancelTo={backTo}
        onSubmit={handleSubmit}
      />
    </>
  );
}
