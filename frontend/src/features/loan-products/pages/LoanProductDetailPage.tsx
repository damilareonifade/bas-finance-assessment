import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { useLoanProductQuery, useProductCustomersQuery, useSetProductStatusMutation } from '../api/loanProductApi';
import { describePrincipalRange, describeRateRange, describeTermRange, PRODUCT_TYPE_LABELS, type ProductCustomer } from '../schemas/loanProduct';

const customerColumns: ReadonlyArray<DataTableColumn<ProductCustomer>> = [
  { key: 'name', header: 'Customer', render: (row) => <Link className="font-medium text-brand hover:underline" to={`/customers/${row.customerId}`}>{row.fullName}</Link> },
  { key: 'officer', header: 'Loan officer', render: (row) => row.assignedOfficer?.fullName ?? <Badge tone="warning">Unassigned</Badge> },
  { key: 'facilities', header: 'Facilities', align: 'right', render: (row) => row.facilityCount },
  { key: 'outstanding', header: 'Outstanding', align: 'right', render: (row) => <MoneyText kobo={row.outstandingKobo} /> },
];

export default function LoanProductDetailPage() {
  const { productId = '' } = useParams();
  const productQuery = useLoanProductQuery(productId);
  const customersQuery = useProductCustomersQuery(productId);
  const statusMutation = useSetProductStatusMutation();
  const navigate = useNavigate();
  const toast = useToast();

  const product = productQuery.data?.product;

  return (
    <>
      <PageHeader
        title={product?.name ?? 'Loan product'}
        breadcrumbs={[{ label: 'Loan products', to: '/products' }, { label: product?.name ?? productId }]}
        description={product ? `${PRODUCT_TYPE_LABELS[product.type]}${product.description ? ` · ${product.description}` : ''}` : undefined}
        actions={
          product ? (
            <>
              <Button
                variant="secondary"
                isLoading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate(
                    { productId, status: product.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' },
                    { onSuccess: ({ product: saved }) => toast.success(saved.status === 'ACTIVE' ? 'Product re-activated' : 'Product archived', saved.name) },
                  )
                }
              >
                {product.status === 'ACTIVE' ? 'Archive' : 'Re-activate'}
              </Button>
              <ButtonLink to={`/products/${productId}/edit`}>Edit</ButtonLink>
            </>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        {statusMutation.error ? <Alert tone="danger">{statusMutation.error.message}</Alert> : null}
        {productQuery.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {productQuery.isError ? <QueryError error={productQuery.error} onRetry={() => void productQuery.refetch()} /> : null}
        {productQuery.isSuccess ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-4">
              <StatCard label="Customers" value={productQuery.data.stats.customerCount} />
              <StatCard label="Facilities" value={productQuery.data.stats.facilityCount} />
              <StatCard label="Outstanding" value={<MoneyText kobo={productQuery.data.stats.outstandingKobo} />} />
              <StatCard label="Status" value={productQuery.data.product.status === 'ACTIVE' ? 'Active' : 'Archived'} tone={productQuery.data.product.status === 'ACTIVE' ? 'success' : 'neutral'} />
            </dl>
            <Card>
              <CardHeader title="Limits" />
              <dl className="grid gap-4 sm:grid-cols-3 text-sm">
                <div><dt className="text-xs text-ink-muted">Amount</dt><dd>{describePrincipalRange(productQuery.data.product)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Annual rate</dt><dd>{describeRateRange(productQuery.data.product)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Term</dt><dd>{describeTermRange(productQuery.data.product)}</dd></div>
              </dl>
            </Card>
          </>
        ) : null}
        <Card>
          <CardHeader title="Customers on this product" description="Everyone holding a loan or invoice facility written under it." />
          {customersQuery.isPending ? <TableSkeleton columnCount={4} rowCount={3} /> : null}
          {customersQuery.isError ? <QueryError error={customersQuery.error} onRetry={() => void customersQuery.refetch()} /> : null}
          {customersQuery.isSuccess ? (
            <DataTable
              caption="Customers on this product"
              columns={customerColumns}
              rows={customersQuery.data}
              getRowKey={(row) => row.customerId}
              onRowClick={(row) => navigate(`/customers/${row.customerId}`)}
              emptyMessage="No customer holds this product yet."
            />
          ) : null}
        </Card>
      </div>
    </>
  );
}
