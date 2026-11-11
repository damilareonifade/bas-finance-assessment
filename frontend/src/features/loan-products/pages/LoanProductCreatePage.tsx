import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import type { SubmitIntent } from '@/components/layout/submitIntent';
import { useToast } from '@/components/ui/Toast';
import { useCreateLoanProductMutation } from '../api/loanProductApi';
import { LoanProductForm } from '../components/LoanProductForm';
import type { LoanProductRequest } from '../schemas/loanProduct';

export default function LoanProductCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreateLoanProductMutation();

  const handleSubmit = (request: LoanProductRequest, intent: SubmitIntent, resetForm: () => void) =>
    createMutation.mutate(request, {
      onSuccess: ({ product }) => {
        toast.success('Loan product created', product.name);
        if (intent === 'create-another') resetForm();
        else navigate(`/products/${product.productId}`);
      },
    });

  return (
    <>
      <PageHeader title="New loan product" breadcrumbs={[{ label: 'Loan products', to: '/products' }, { label: 'Create' }]} />
      <LoanProductForm mode="create" isSubmitting={createMutation.isPending} serverError={createMutation.error} cancelTo="/products" onSubmit={handleSubmit} />
    </>
  );
}
