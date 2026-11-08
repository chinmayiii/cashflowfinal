import React from 'react';
import { FileUploader } from '../components/uploader/FileUploader';
import { useCashflowStore } from '../store/useCashflowStore';
import { FileCheck, Sparkles, ArrowRight } from 'lucide-react';

export const UploadView: React.FC = () => {
  const { lastUploadedFilename, setActiveTab } = useCashflowStore();

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-100">
          Statement Ingestion & Mobile Photo OCR
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload bank transaction CSV files or snap a photo of a passbook, statement, or receipt using your mobile camera
        </p>
      </div>

      {lastUploadedFilename && (
        <div className="glass-card rounded-2xl p-5 border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Statement Parsed</div>
              <div className="text-sm font-bold text-slate-100">{lastUploadedFilename}</div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('forecast')}
            className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            Inspect Active ML Forecast <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Drag Drop Component */}
      <FileUploader />

      {/* Process Architecture Summary Card */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400" /> Automated Track A Data Processing Pipeline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="font-bold text-teal-400">1. Data Preprocessing</div>
            <p className="text-slate-400">Normalizes timestamps, aggregates daily transaction totals, and calculates signed net flow.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="font-bold text-teal-400">2. Feature Engineering</div>
            <p className="text-slate-400">Computes 1-day/7-day lags, 7-day rolling mean, rolling std dev, and cash-in/cash-out ratios.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="font-bold text-teal-400">3. XGBoost & Liquidity AI</div>
            <p className="text-slate-400">Generates next-day cashflow point predictions, 95% confidence intervals, and risk scores.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
