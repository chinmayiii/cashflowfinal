import React from 'react';
import { useCashflowStore } from '../store/useCashflowStore';
import { KpiCard } from '../components/ui/KpiCard';
import { CashflowChart } from '../components/charts/CashflowChart';
import { TransactionTable } from '../components/table/TransactionTable';
import { formatCurrency } from '../utils/formatters';
import { IndianRupee, Flame, Clock, TrendingUp, Calendar, Landmark, Upload } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    baselineForecastResult,
    forecastResult: legacyForecastResult,
    transactions,
    dateRange,
    setDateRange,
    selectedAccount,
    setSelectedAccount,
    setActiveTab,
  } = useCashflowStore();

  // Dashboard consumes pristine baseline forecast result
  const forecastResult = baselineForecastResult || legacyForecastResult;

  const hasData = Boolean(forecastResult);
  const currentBalance = hasData ? formatCurrency(forecastResult!.current_balance) : '--';
  const burnRate30d = hasData && forecastResult!.historical_burn_rate_30d > 0 ? formatCurrency(forecastResult!.historical_burn_rate_30d) : '--';
  const runwayDays = hasData && forecastResult!.runway_days > 0 ? `${forecastResult!.runway_days} Days` : '--';
  const nextDayCashflow = hasData ? `${forecastResult!.next_day_cashflow >= 0 ? '+' : ''}${formatCurrency(forecastResult!.next_day_cashflow)}` : '--';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-100">
            Cashflow & Liquidity Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time financial position, 30-day burn rate, and AI liquidity monitoring
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Account Filter */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Landmark className="w-4 h-4 text-teal-400" />
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="all" className="bg-slate-900">All Accounts (Consolidated)</option>
              <option value="checking" className="bg-slate-900">Current A/c - HDFC (*4910)</option>
              <option value="payroll" className="bg-slate-900">Salary / Tax A/c - SBI (*1088)</option>
              <option value="credit" className="bg-slate-900">Working Capital / CC (*9921)</option>
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            {(['7d', '30d', '90d', 'ytd'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 font-semibold rounded-lg uppercase transition-all ${
                  dateRange === r ? 'bg-teal-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Quick Upload Button */}
          <button
            onClick={() => setActiveTab('upload')}
            className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" /> Upload Statement
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          title="Current Cash Balance"
          value={currentBalance}
          subtitle="Total available liquid funds"
          change={hasData ? +4.2 : undefined}
          icon={IndianRupee}
          iconBgColor="bg-emerald-500/15"
          iconTextColor="text-emerald-400"
          badgeText={hasData ? 'Healthy' : 'No Data'}
          badgeType={hasData ? 'success' : 'neutral'}
        />

        <KpiCard
          title="30-Day Cash Burn Rate"
          value={burnRate30d}
          subtitle="Operating expenses burn"
          change={hasData ? -2.1 : undefined}
          changeLabel={hasData ? 'vs previous 30d' : undefined}
          icon={Flame}
          iconBgColor="bg-rose-500/15"
          iconTextColor="text-rose-400"
          badgeText={hasData ? 'Normal' : 'No Data'}
          badgeType="neutral"
        />

        <KpiCard
          title="Estimated Runway"
          value={runwayDays}
          subtitle="Days of operation remaining"
          change={hasData ? +6 : undefined}
          changeLabel={hasData ? '+6 days buffer' : undefined}
          icon={Clock}
          iconBgColor="bg-teal-500/15"
          iconTextColor="text-teal-400"
          badgeText={hasData ? 'Low Risk' : 'No Data'}
          badgeType={hasData ? 'success' : 'neutral'}
        />

        <KpiCard
          title="Next-Day Forecast Net"
          value={nextDayCashflow}
          subtitle="AI model next-day net"
          change={hasData ? +12.4 : undefined}
          icon={TrendingUp}
          iconBgColor="bg-teal-500/15"
          iconTextColor="text-teal-400"
          badgeText={hasData ? forecastResult?.risk || 'Stable' : 'No Data'}
          badgeType={hasData ? (forecastResult?.risk === 'Stable' ? 'success' : 'warning') : 'neutral'}
        />
      </div>

      {/* Time-Series Chart */}
      <div className="w-full">
        {hasData ? (
          <CashflowChart points={forecastResult?.points || []} />
        ) : (
          <div className="glass-panel rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200">No Cashflow Data Available</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Upload a bank statement CSV to begin analysis and generate cashflow forecasts.
            </p>
            <button
              onClick={() => setActiveTab('upload')}
              className="mt-4 px-4 py-2 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl transition-all"
            >
              Upload Bank Statement
            </button>
          </div>
        )}
      </div>

      {/* Recent Transactions Table */}
      <div className="w-full">
        <TransactionTable transactions={transactions} />
      </div>
    </div>
  );
};
