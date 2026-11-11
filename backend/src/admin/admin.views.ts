import { Kobo } from '../common/money';

export interface OfficerRef {
  userId: string;
  fullName: string;
}

export interface CustomerSummaryView {
  customerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  assignedOfficer: OfficerRef | null;
  createdAt: string;
  loanCount: number;
  invoiceCount: number;
  outstandingPrincipalKobo: Kobo;
  overdueKobo: Kobo;
  overdueInvoiceCount: number;
}

export interface CustomerLoanLine {
  loanId: string;
  productName: string | null;
  principalKobo: Kobo;
  outstandingPrincipalKobo: Kobo;
  overdueKobo: Kobo;
  disbursedOn: string;
}

export interface CustomerInvoiceLine {
  invoiceId: string;
  productName: string | null;
  faceValueKobo: Kobo;
  advanceKobo: Kobo;
  dueDate: string;
  status: 'ADVANCED' | 'SETTLED';
  isOverdue: boolean;
}

export interface CustomerDetailView {
  customer: CustomerSummaryView;
  loans: CustomerLoanLine[];
  invoices: CustomerInvoiceLine[];
}

export interface CollectionRowView extends CustomerSummaryView {
  needsFollowUp: boolean;
  overdueInstalments: number;
  oldestOverdueDays: number;
  nextDueDate: string | null;
}

export interface CollectionsView {
  asOf: string;
  officer: OfficerRef | null;
  totals: { customers: number; customersToChase: number; overdueKobo: Kobo; outstandingPrincipalKobo: Kobo };
  customers: CollectionRowView[];
}

export interface ProductCustomerView {
  customerId: string;
  fullName: string;
  assignedOfficer: OfficerRef | null;
  facilityCount: number;
  outstandingKobo: Kobo;
}

export interface LoanProductDetailView {
  product: import('../loan-products/loan-products.repository').StoredLoanProduct;
  stats: { customerCount: number; facilityCount: number; outstandingKobo: Kobo };
}

export interface PeriodComparison<TValue extends number = number> {
  /** Month to date. */
  current: TValue;
  /** The same number of days at the start of last month, so early in the month is not compared with a whole month. */
  previous: TValue;
  /** null when there is nothing to compare with. */
  changePercent: number | null;
}

export interface DashboardTrends {
  /** Last 30 days ending today, oldest first. All arrays are the same length as `days`. */
  days: string[];
  disbursedKobo: Kobo[];
  collectedKobo: Kobo[];
  invoiceAdvancesKobo: Kobo[];
  newCustomers: number[];
}

export interface MonthToDate {
  disbursed: PeriodComparison<Kobo>;
  collected: PeriodComparison<Kobo>;
  invoiceAdvances: PeriodComparison<Kobo>;
  newCustomers: PeriodComparison;
}
