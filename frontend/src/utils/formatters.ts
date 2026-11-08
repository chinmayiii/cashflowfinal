/**
 * Formatting and Display Utilities
 */

export function formatCurrency(amount: number, compact = false): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  if (compact) {
    if (absAmount >= 10_000_000) {
      return `${isNegative ? '-' : ''}₹${(absAmount / 10_000_000).toFixed(2)} Cr`;
    }
    if (absAmount >= 100_000) {
      return `${isNegative ? '-' : ''}₹${(absAmount / 100_000).toFixed(1)} L`;
    }
    if (absAmount >= 1_000) {
      return `${isNegative ? '-' : ''}₹${(absAmount / 1_000).toFixed(1)} k`;
    }
    return `${isNegative ? '-' : ''}₹${Math.round(absAmount)}`;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatFullDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  } catch {
    return dateStr;
  }
}

export function getRiskBadgeColor(risk: string): { bg: string; text: string; border: string; iconColor: string } {
  switch (risk) {
    case 'Stable':
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-500/30',
        iconColor: '#10b981',
      };
    case 'Moderate Risk':
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-500/20',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-500/30',
        iconColor: '#f59e0b',
      };
    case 'High Risk':
    case 'Critical':
      return {
        bg: 'bg-rose-500/10 dark:bg-rose-500/20',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/30',
        iconColor: '#f43f5e',
      };
    default:
      return {
        bg: 'bg-slate-500/10 dark:bg-slate-500/20',
        text: 'text-slate-700 dark:text-slate-400',
        border: 'border-slate-500/30',
        iconColor: '#94a3b8',
      };
  }
}
