import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApplicationsQuery } from '@/features/applications';
import { useCollectionsQuery } from '@/features/collections';
import { useCustomerDirectory } from '@/features/customers';
import { useInvoicesQuery } from '@/features/invoice-financing';
import { useLoanProductsQuery } from '@/features/loan-products';
import { useTermLoansQuery } from '@/features/term-loans';
import { todayCalendarDate } from '@/lib/dates/calendarDate';
import { useDashboardQuery } from '../api/dashboardApi';
import { KpiCards, LedgerSummary, OfficerWorkload, TrendChartCard } from '../components/DashboardSections';
import { PortfolioCard, RecentActivityCard, RecentLoansCard, RiskMonitoringCard } from '../components/DashboardWidgets';
import { portfolioByProduct, recentActivity } from '../dashboardDerivations';

const widgetSkeleton = <Skeleton className="h-80 rounded-xl" />;

/** Every request is made here; the widgets below only receive data. */
export default function AdminDashboardPage() {
  const today = todayCalendarDate();
  const dashboardQuery = useDashboardQuery();
  const loansQuery = useTermLoansQuery();
  const invoicesQuery = useInvoicesQuery();
  const productsQuery = useLoanProductsQuery();
  const collectionsQuery = useCollectionsQuery();
  const customerDirectory = useCustomerDirectory();
  const openApplicationsQuery = useApplicationsQuery({ status: 'OPEN' });

  const activity = useMemo(
    () => (loansQuery.data && invoicesQuery.data ? recentActivity(loansQuery.data, invoicesQuery.data, customerDirectory.nameOf) : null),
    [loansQuery.data, invoicesQuery.data, customerDirectory],
  );
  const portfolio = useMemo(() => {
    if (!loansQuery.data || !invoicesQuery.data || !productsQuery.data) return null;
    const names = new Map(productsQuery.data.map(({ product }) => [product.productId, product.name]));
    return portfolioByProduct(loansQuery.data, invoicesQuery.data, (productId) => (productId ? (names.get(productId) ?? 'Other') : 'No product'));
  }, [loansQuery.data, invoicesQuery.data, productsQuery.data]);

  const dashboard = dashboardQuery.data;

  return (
    <>
      <PageHeader title="Dashboard" description={dashboard ? `Portfolio overview as of ${dashboard.asOf}` : 'Portfolio overview'} />
      {dashboardQuery.isError ? <QueryError error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} /> : null}
      <div className="flex flex-col gap-5">
        {dashboard ? (
          <KpiCards dashboard={dashboard} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">{loansQuery.data ? <RecentLoansCard loans={loansQuery.data} nameOf={customerDirectory.nameOf} today={today} /> : widgetSkeleton}</div>
          {activity ? <RecentActivityCard items={activity} /> : widgetSkeleton}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {dashboard ? <TrendChartCard dashboard={dashboard} /> : widgetSkeleton}
          {portfolio ? <PortfolioCard slices={portfolio} /> : widgetSkeleton}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {dashboard && collectionsQuery.data ? <RiskMonitoringCard overdueAccounts={collectionsQuery.data.customers} dashboard={dashboard} openApplicationCount={openApplicationsQuery.data?.length ?? 0} /> : widgetSkeleton}
          {dashboard ? <OfficerWorkload dashboard={dashboard} /> : widgetSkeleton}
        </div>

        {dashboard ? <LedgerSummary dashboard={dashboard} /> : null}
      </div>
    </>
  );
}
