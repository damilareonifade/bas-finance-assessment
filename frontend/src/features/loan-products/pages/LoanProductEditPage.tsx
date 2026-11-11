import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useLoanProductQuery, useUpdateLoanProductMutation } from '../api/loanProductApi';
import { LoanProductForm } from '../components/LoanProductForm';
import { toLoanProductFormInput, toLoanProductUpdate, type LoanProductRequest } from '../schemas/loanProduct';

export default function LoanProductEditPage() {
  const { productId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const productQuery = useLoanProductQuery(productId);
  const updateMutation = useUpdateLoanProductMutation();
  const product = productQuery.data?.product;
  const detailPath = `/products/${productId}`;

  const handleSubmit = (request: LoanProductRequest) =>
    updateMutation.mutate(
      { productId, changes: toLoanProductUpdate(request) },
      {
        onSuccess: ({ product: saved }) => {
          toast.success('Changes saved', saved.name);
          navigate(detailPath);
        },
      },
    );

  return (
    <>
      <PageHeader
        title={product ? `Edit ${product.name}` : 'Edit loan product'}
        breadcrumbs={[{ label: 'Loan products', to: '/products' }, { label: product?.name ?? productId, to: detailPath }, { label: 'Edit' }]}
      />
      {productQuery.isPending ? <Skeleton className="h-96 w-full rounded-xl" /> : null}
      {productQuery.isError ? <QueryError error={productQuery.error} onRetry={() => void productQuery.refetch()} /> : null}
      {product ? (
        <LoanProductForm
          key={product.productId}
          mode="edit"
          defaultValues={toLoanProductFormInput(product)}
          isSubmitting={updateMutation.isPending}
          serverError={updateMutation.error}
          cancelTo={detailPath}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}
