import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusCircleIcon } from '@/components/ui/icons';
import { QueryError } from '@/components/ui/QueryState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useLoanProductsQuery } from '../api/loanProductApi';
import { LoanProductsTable } from '../components/LoanProductsTable';

export default function LoanProductsPage() {
  const navigate = useNavigate();
  const productsQuery = useLoanProductsQuery();
  const newProductButton = (
    <ButtonLink to="/products/create">
      <PlusCircleIcon size={18} />
      New loan product
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="Loan products" breadcrumbs={[{ label: 'Loan products' }]} description="What can be lent, and within which limits." actions={newProductButton} />
      <section className="rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
        {productsQuery.isPending ? <TableSkeleton columnCount={8} rowCount={3} /> : null}
        {productsQuery.isError ? <QueryError error={productsQuery.error} onRetry={() => void productsQuery.refetch()} /> : null}
        {productsQuery.isSuccess ? (
          <LoanProductsTable
            products={productsQuery.data}
            onOpen={({ product }) => navigate(`/products/${product.productId}`)}
            emptyState={<EmptyState title="No loan products yet" description="Create a product so officers can write loans within its limits." action={newProductButton} />}
          />
        ) : null}
      </section>
    </>
  );
}
