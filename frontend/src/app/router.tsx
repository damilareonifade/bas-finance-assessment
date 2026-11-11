import { createBrowserRouter, Navigate, useParams, type RouteObject } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';
import { homePathFor, RequireAuth, RequireRole, useCurrentUser } from '@/features/auth';
import { PortalLayout } from '@/features/portal/components/PortalLayout';
import { RequirePortalAuth } from '@/features/portal/components/RequirePortalAuth';
import { AppLayout } from './AppLayout';

function lazyPage(loadPage: () => Promise<{ default: React.ComponentType }>): RouteObject['lazy'] {
  return async () => {
    const { default: Component } = await loadPage();
    return { Component };
  };
}

/** "/" sends admins to the dashboard and officers to their collections list. */
function HomeRedirect() {
  return <Navigate to={homePathFor(useCurrentUser().role)} replace />;
}

/** Old /invoices/:id/settle links now land on the invoice page, where settlement lives. */
function LegacySettleRedirect() {
  const { invoiceId = '' } = useParams();
  return <Navigate to={`/invoices/${invoiceId}`} replace />;
}

/**
 * Resources follow one shape (Filament-style):
 *   /<resource>            list    — "New …" in the header, rows open the record
 *   /<resource>/create     create  — Create · Create & create another · Cancel
 *   /<resource>/:id        view    — header actions; related records link onward
 *   /<resource>/:id/edit   edit    — where the API allows changes
 */
export const routes: RouteObject[] = [
  { path: 'login', lazy: lazyPage(() => import('@/features/auth/pages/LoginPage')) },
  { path: 'accept-invite', lazy: lazyPage(() => import('@/features/auth/pages/AcceptInvitePage')) },

  /* Customer self-service portal — its own sign-in, session and layout; no staff navigation. */
  { path: 'portal/login', lazy: lazyPage(() => import('@/features/portal/pages/PortalLoginPage')) },
  { path: 'portal/accept-invite', lazy: lazyPage(() => import('@/features/portal/pages/PortalAcceptInvitePage')) },
  {
    path: 'portal',
    element: <RequirePortalAuth />,
    hydrateFallbackElement: <Skeleton className="m-8 h-40" />,
    children: [
      {
        element: <PortalLayout />,
        children: [
          { index: true, lazy: lazyPage(() => import('@/features/portal/pages/PortalHomePage')) },
          { path: 'loans', lazy: lazyPage(() => import('@/features/portal/pages/PortalLoansPage')) },
          { path: 'loans/:loanId', lazy: lazyPage(() => import('@/features/portal/pages/PortalLoanPage')) },
          { path: 'invoices', lazy: lazyPage(() => import('@/features/portal/pages/PortalInvoicesPage')) },
          { path: 'invoices/:invoiceId', lazy: lazyPage(() => import('@/features/portal/pages/PortalInvoicePage')) },
          { path: 'applications', lazy: lazyPage(() => import('@/features/portal/pages/PortalApplicationsPage')) },
          { path: 'apply', lazy: lazyPage(() => import('@/features/portal/pages/PortalApplyPage')) },
          { path: 'documents', lazy: lazyPage(() => import('@/features/portal/pages/PortalDocumentsPage')) },
          { path: '*', element: <p className="text-ink-muted">Page not found.</p> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    hydrateFallbackElement: <Skeleton className="m-8 h-40" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'settings', lazy: lazyPage(() => import('@/features/settings/pages/SettingsPage')) },
          { path: 'collections', lazy: lazyPage(() => import('@/features/collections/pages/CollectionsPage')) },

          { path: 'customers', lazy: lazyPage(() => import('@/features/customers/pages/CustomersListPage')) },
          { path: 'customers/create', lazy: lazyPage(() => import('@/features/customers/pages/CustomerCreatePage')) },
          { path: 'customers/:customerId', lazy: lazyPage(() => import('@/features/customers/pages/CustomerDetailPage')) },

          { path: 'applications', lazy: lazyPage(() => import('@/features/applications/pages/ApplicationsListPage')) },
          { path: 'applications/create', lazy: lazyPage(() => import('@/features/applications/pages/ApplicationCreatePage')) },
          { path: 'applications/:applicationId', lazy: lazyPage(() => import('@/features/applications/pages/ApplicationDetailPage')) },

          { path: 'loans', lazy: lazyPage(() => import('@/features/term-loans/pages/LoansListPage')) },
          { path: 'loans/create', lazy: lazyPage(() => import('@/features/term-loans/pages/LoanCreatePage')) },
          { path: 'loans/new', element: <Navigate to="/loans/create" replace /> },
          { path: 'loans/:loanId', lazy: lazyPage(() => import('@/features/repayments/pages/LoanDetailPage')) },
          { path: 'loans/:loanId/statement', lazy: lazyPage(() => import('@/features/statements/pages/StatementPage')) },

          { path: 'invoices', lazy: lazyPage(() => import('@/features/invoice-financing/pages/InvoicesListPage')) },
          { path: 'invoices/create', lazy: lazyPage(() => import('@/features/invoice-financing/pages/InvoiceCreatePage')) },
          { path: 'invoices/new', element: <Navigate to="/invoices/create" replace /> },
          { path: 'invoices/:invoiceId', lazy: lazyPage(() => import('@/features/invoice-financing/pages/InvoiceDetailPage')) },
          { path: 'invoices/:invoiceId/settle', element: <LegacySettleRedirect /> },

          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { path: 'admin', lazy: lazyPage(() => import('@/features/admin-dashboard/pages/AdminDashboardPage')) },
              { path: 'ledger', lazy: lazyPage(() => import('@/features/ledger/pages/LedgerPage')) },
              { path: 'products', lazy: lazyPage(() => import('@/features/loan-products/pages/LoanProductsPage')) },
              { path: 'products/create', lazy: lazyPage(() => import('@/features/loan-products/pages/LoanProductCreatePage')) },
              { path: 'products/:productId', lazy: lazyPage(() => import('@/features/loan-products/pages/LoanProductDetailPage')) },
              { path: 'products/:productId/edit', lazy: lazyPage(() => import('@/features/loan-products/pages/LoanProductEditPage')) },
              { path: 'team', lazy: lazyPage(() => import('@/features/team/pages/TeamPage')) },
              { path: 'team/invite', lazy: lazyPage(() => import('@/features/team/pages/TeamInvitePage')) },
            ],
          },
          { path: '*', element: <p className="text-ink-muted">Page not found.</p> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
