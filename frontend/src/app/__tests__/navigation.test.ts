import { describe, expect, it } from 'vitest';
import { isItemActive, navigationFor, NAV_GROUPS } from '../navigation';

const loansItem = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.to === '/loans');

describe('navigationFor', () => {
  it('gives administrators the dashboard and the Administration group', () => {
    const { topLevel, groups } = navigationFor('ADMIN');
    expect(topLevel.map((item) => item.label)).toEqual(['Dashboard']);
    expect(groups.map((group) => group.label)).toEqual(['Customers', 'Lending', 'Accounting', 'Administration']);
  });

  it('hides admin-only destinations from loan officers, and drops groups that end up empty', () => {
    const { topLevel, groups } = navigationFor('LOAN_OFFICER');
    expect(topLevel).toEqual([]);
    expect(groups.map((group) => group.label)).toEqual(['Customers', 'Lending']);
    expect(groups.flatMap((group) => group.items).map((item) => item.to)).not.toContain('/team');
    expect(groups.flatMap((group) => group.items).map((item) => item.to)).not.toContain('/products');
    expect(groups.flatMap((group) => group.items).map((item) => item.to)).not.toContain('/ledger');
  });
});

describe('isItemActive', () => {
  it('keeps Loans highlighted on every loan page — list, create, record and statement', () => {
    for (const path of ['/loans', '/loans/create', '/loans/LN-000001', '/loans/LN-000001/statement']) {
      expect(loansItem && isItemActive(loansItem, path)).toBe(true);
    }
  });

  it('lists resources only — "New …" lives on each list page, not in the sidebar', () => {
    const destinations = navigationFor('ADMIN').groups.flatMap((group) => group.items).map((item) => item.to);
    expect(destinations).toEqual(['/customers', '/collections', '/applications', '/loans', '/invoices', '/ledger', '/products', '/team']);
  });

  it('does not match a path that only shares a prefix', () => {
    expect(loansItem && isItemActive(loansItem, '/loansfoo')).toBe(false);
  });
});
