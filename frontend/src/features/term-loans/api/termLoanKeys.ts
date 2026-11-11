/** Query-key factory. Every term-loan query key is built here — never inline. */
export const termLoanKeys = {
  all: ['term-loans'] as const,
  list: (filters: object = {}) => [...termLoanKeys.all, 'list', filters] as const,
  detail: (loanId: string) => [...termLoanKeys.all, 'detail', loanId] as const,
};
