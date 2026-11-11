import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MoneyText } from '@/components/ui/MoneyText';
import { describePrincipalRange, describeRateRange, describeTermRange, PRODUCT_TYPE_LABELS, type LoanProductDetail } from '../schemas/loanProduct';

interface LoanProductsTableProps {
  readonly products: readonly LoanProductDetail[];
  readonly emptyState?: ReactNode;
  readonly onOpen?: (product: LoanProductDetail) => void;
}

const productColumns: ReadonlyArray<DataTableColumn<LoanProductDetail>> = [
  {
    key: 'name',
    header: 'Product',
    render: ({ product }) => (
      <Link className="font-medium text-brand hover:underline" to={`/products/${product.productId}`}>
        {product.name}
      </Link>
    ),
  },
  { key: 'type', header: 'Type', render: ({ product }) => PRODUCT_TYPE_LABELS[product.type] },
  { key: 'amount', header: 'Amount range', render: ({ product }) => describePrincipalRange(product) },
  { key: 'rate', header: 'Rate', render: ({ product }) => describeRateRange(product) },
  { key: 'term', header: 'Term', render: ({ product }) => describeTermRange(product) },
  { key: 'customers', header: 'Customers', align: 'right', render: ({ stats }) => stats.customerCount },
  { key: 'outstanding', header: 'Outstanding', align: 'right', render: ({ stats }) => <MoneyText kobo={stats.outstandingKobo} /> },
  { key: 'status', header: 'Status', render: ({ product }) => <Badge tone={product.status === 'ACTIVE' ? 'success' : 'warning'}>{product.status === 'ACTIVE' ? 'Active' : 'Archived'}</Badge> },
];

export function LoanProductsTable({ products, emptyState, onOpen }: LoanProductsTableProps) {
  return <DataTable caption="Loan products" columns={productColumns} rows={products} getRowKey={({ product }) => product.productId} emptyState={emptyState} onRowClick={onOpen} />;
}
