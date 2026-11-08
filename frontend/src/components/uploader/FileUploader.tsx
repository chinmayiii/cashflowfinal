import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  X,
  Sparkles,
  Play,
  Camera,
  Image as ImageIcon,
  Scan,
  ArrowRight,
} from 'lucide-react';
import { parseBankStatementCSV, generateSampleCSVString, CSVParseResult } from '../../utils/csvParser';
import { useUploadStatement, useUploadStatementImage } from '../../api/useCashflowQuery';
import { useCashflowStore } from '../../store/useCashflowStore';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { TransactionItem } from '../../api/types';

export const FileUploader: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'csv' | 'ocr'>('csv');

  // CSV Mode States
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo OCR Mode States
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ocrSuccessData, setOcrSuccessData] = useState<{
    transactions: TransactionItem[];
    inflowTotal?: number;
    outflowTotal?: number;
    snippet?: string;
  } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Store & Mutations
  const uploadMutation = useUploadStatement();
  const ocrMutation = useUploadStatementImage();
  const { setTransactions, setLastUploadedFilename, setActiveTab } = useCashflowStore();

  // ─────────────────────────────────────────────────────────────
  // CSV Handlers
  // ─────────────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseResult({
        valid: false,
        transactions: [],
        errors: ['Invalid file type. Only CSV files (.csv) are accepted.'],
        totalRows: 0,
        columnsFound: [],
      });
      setSelectedFile(file);
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);

    try {
      const result = await parseBankStatementCSV(file);
      setParseResult(result);
    } catch (err: any) {
      setParseResult({
        valid: false,
        transactions: [],
        errors: [`Failed to parse CSV file: ${err.message}`],
        totalRows: 0,
        columnsFound: [],
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDropCSV = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmCSVUpload = () => {
    if (!selectedFile || !parseResult?.valid) return;

    uploadMutation.mutate(selectedFile, {
      onSuccess: () => {
        setTransactions(parseResult.transactions);
        setLastUploadedFilename(selectedFile.name);
        setActiveTab('forecast');
      },
    });
  };

  const handleLoadDemoDataset = () => {
    const demoCSV = generateSampleCSVString();
    const demoFile = new File([demoCSV], 'q3_bank_statement_demo.csv', { type: 'text/csv' });
    handleFileSelect(demoFile);
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = generateSampleCSVString();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_bank_statement.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─────────────────────────────────────────────────────────────
  // OCR Photo Handlers
  // ─────────────────────────────────────────────────────────────
  const handlePhotoSelect = (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|bmp)$/i)) {
      alert('Please select a valid image format (PNG, JPEG, WEBP, or BMP).');
      return;
    }

    setPhotoFile(file);
    setOcrSuccessData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDropPhoto = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoSelect(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteOCR = () => {
    if (!photoFile) return;

    ocrMutation.mutate(photoFile, {
      onSuccess: (data) => {
        setOcrSuccessData({
          transactions: data.ocrTransactions || [],
          inflowTotal: data.inflowTotal,
          outflowTotal: data.outflowTotal,
          snippet: data.rawTextSnippet,
        });
        setLastUploadedFilename(`[Photo OCR] ${photoFile.name}`);
      },
    });
  };

  const handleLoadDemoPhoto = () => {
    // Generate synthetic statement image via Canvas API
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text formatting
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('STATE BANK OF INDIA - MSME CURRENT ACCOUNT', 30, 45);

    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#334155';
    ctx.fillText('DATE        DESCRIPTION            AMOUNT(INR) TYPE     BALANCE(INR)', 30, 90);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#1e293b';
    const rows = [
      '2026-03-01  CLIENT PAYMENT - NEFT  55000.00    CREDIT   155000.00',
      '2026-03-02  OFFICE STATIONERY      3500.00     DEBIT    151500.00',
      '2026-03-03  CLOUD SERVER HOSTING   1200.00     DEBIT    150300.00',
      '2026-03-04  CONSULTING SERVICES    24000.00    CREDIT   174300.00',
      '2026-03-05  WAREHOUSE RENT PAID    18000.00    DEBIT    156300.00',
      '2026-03-06  ELECTRICITY & UTILITY  2100.00     DEBIT    154200.00',
      '2026-03-07  RAZORPAY SETTLEMENT    32500.00    CREDIT   186700.00',
    ];

    rows.forEach((r, idx) => {
      ctx.fillText(r, 30, 135 + idx * 38);
    });

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'sample_passbook_snapshot.png', { type: 'image/png' });
        handlePhotoSelect(file);
      }
    }, 'image/png');
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="flex rounded-2xl bg-slate-900/80 p-1.5 border border-slate-800 max-w-md mx-auto shadow-inner">
        <button
          type="button"
          onClick={() => setActiveMode('csv')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeMode === 'csv'
              ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Bank Statement CSV
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('ocr')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeMode === 'ocr'
              ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          Mobile Camera & Photo OCR
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODE 1: CSV UPLOAD
      ────────────────────────────────────────────────────────────── */}
      {activeMode === 'csv' && (
        <div className="space-y-6 animate-fade-in">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDropCSV}
            onClick={() => fileInputRef.current?.click()}
            tabIndex={0}
            role="button"
            aria-label="Upload Bank Statement CSV File"
            className={`glass-panel rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${
              dragOver
                ? 'border-teal-400 bg-teal-500/10 scale-[1.01]'
                : 'border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-900/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />

            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-100">Upload Bank Statement CSV</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Drag and drop your transaction CSV here, or <span className="text-teal-400 underline font-semibold">browse files</span>
            </p>
            <p className="text-xs text-slate-500 mt-2">Supports CSV statements from SBI, HDFC, ICICI, Axis, Kotak, PNB, Razorpay & Paytm Business</p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadDemoDataset();
                }}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                Load Sample Demo Statement
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSampleCSV();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-800 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                Download CSV Template
              </button>
            </div>
          </div>

          {/* Parsing State */}
          {isParsing && (
            <div className="glass-panel p-6 rounded-2xl flex items-center justify-center gap-3">
              <RefreshCw className="w-5 h-5 text-teal-400 animate-spin" />
              <span className="text-sm text-slate-300 font-medium">Validating CSV format & extracting cashflow transactions...</span>
            </div>
          )}

          {/* CSV Result Preview */}
          {selectedFile && parseResult && !isParsing && (
            <div className="glass-panel rounded-2xl p-6 space-y-6 animate-slide-up">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-slate-800 text-teal-400 border border-slate-700">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">{selectedFile.name}</h4>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {parseResult.totalRows} Rows Parsed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setParseResult(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>

                  {parseResult.valid && (
                    <button
                      onClick={handleConfirmCSVUpload}
                      disabled={uploadMutation.isPending}
                      className="px-5 py-2 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Running ML Inference...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-slate-950" />
                          Execute Upload & Forecast
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!parseResult.valid && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    CSV Validation Failed
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {parseResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parseResult.valid && parseResult.transactions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Data Preview (First 5 Transactions)
                    </h5>
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Schema Validated & Ready for ML Inference
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Description</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Account</th>
                          <th className="px-4 py-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {parseResult.transactions.slice(0, 5).map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-2 text-slate-300 font-medium">{formatDate(tx.date)}</td>
                            <td className="px-4 py-2 text-slate-200">{tx.description}</td>
                            <td className="px-4 py-2 text-slate-400">
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px]">
                                {tx.category}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-400">{tx.account}</td>
                            <td
                              className={`px-4 py-2 text-right font-bold ${
                                tx.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {tx.type === 'inflow' ? '+' : ''}
                              {formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 2: MOBILE CAMERA & PHOTO OCR
      ────────────────────────────────────────────────────────────── */}
      {activeMode === 'ocr' && (
        <div className="space-y-6 animate-fade-in">
          {/* Hidden File Inputs */}
          {/* Mobile Camera Input (Direct native camera invocation) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePhotoSelect(e.target.files[0])}
          />
          {/* Gallery Input */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePhotoSelect(e.target.files[0])}
          />

          {/* Photo Dropzone & Actions */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDropPhoto}
            className={`glass-panel rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 border-2 border-dashed ${
              dragOver
                ? 'border-teal-400 bg-teal-500/10 scale-[1.01]'
                : 'border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-900/60'
            }`}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Camera className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-100">Capture or Upload Statement Photo</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Take a photo from your phone or upload an image of a bank statement, passbook, or receipt.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Optical Character Recognition (OCR) extracts dates, amounts, and flows automatically.
            </p>

            {/* Quick Action Trigger Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2"
              >
                <Camera className="w-4 h-4 fill-slate-950" />
                Take Photo (Mobile Camera)
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4 text-teal-400" />
                Choose from Gallery
              </button>

              <button
                type="button"
                onClick={handleLoadDemoPhoto}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900/90 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-teal-400" />
                Load Sample Statement Photo
              </button>
            </div>
          </div>

          {/* Photo Preview & OCR Execution Card */}
          {photoFile && photoPreview && (
            <div className="glass-panel rounded-2xl p-6 space-y-6 animate-slide-up">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                  <img
                    src={photoPreview}
                    alt="Statement preview"
                    className="w-16 h-16 object-cover rounded-xl border border-slate-700 shadow-md"
                  />
                  <div>
                    <h4 className="font-bold text-slate-100">{photoFile.name}</h4>
                    <p className="text-xs text-slate-400">
                      {(photoFile.size / 1024).toFixed(1)} KB • Image Loaded & Ready for OCR
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      setOcrSuccessData(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>

                  <button
                    onClick={handleExecuteOCR}
                    disabled={ocrMutation.isPending}
                    className="px-5 py-2 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {ocrMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running Tesseract OCR & ML...
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        Extract via OCR & Run AI Forecast
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* OCR Scanning Progress Animation */}
              {ocrMutation.isPending && (
                <div className="p-6 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-center space-y-3">
                  <div className="flex items-center justify-center gap-3 text-teal-400 font-semibold text-sm">
                    <Scan className="w-5 h-5 animate-pulse" />
                    Pre-processing Image & Running Optical Character Recognition...
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    OpenCV is enhancing document contrast, correcting skew, and extracting financial date/amount coordinates.
                  </p>
                </div>
              )}

              {/* OCR Success Extraction Panel */}
              {ocrSuccessData && !ocrMutation.isPending && (
                <div className="space-y-6">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase">Recognized Transactions</div>
                      <div className="text-xl font-bold text-teal-400">
                        {ocrSuccessData.transactions.length} items
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase">Total Cash Inflow</div>
                      <div className="text-xl font-bold text-emerald-400">
                        +{formatCurrency(ocrSuccessData.inflowTotal || 0)}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase">Total Cash Outflow</div>
                      <div className="text-xl font-bold text-rose-400">
                        -{formatCurrency(ocrSuccessData.outflowTotal || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Navigation CTA Button */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      OCR Ingestion Complete: Predictions and Liquidity Assessment are live!
                    </div>
                    <button
                      onClick={() => setActiveTab('forecast')}
                      className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      View 14-Day ML Forecast <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Extracted Transactions Table */}
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Extracted Financial Records ({ocrSuccessData.transactions.length})
                    </h5>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-72">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5">Date</th>
                            <th className="px-4 py-2.5">Description</th>
                            <th className="px-4 py-2.5">Category</th>
                            <th className="px-4 py-2.5">Type</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                            <th className="px-4 py-2.5 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {ocrSuccessData.transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-2 text-slate-300 font-medium">{formatDate(tx.date)}</td>
                              <td className="px-4 py-2 text-slate-200">{tx.description}</td>
                              <td className="px-4 py-2 text-slate-400">
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px]">
                                  {tx.category}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    tx.type === 'inflow'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  {tx.type === 'inflow' ? 'Credit' : 'Debit'}
                                </span>
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-bold ${
                                  tx.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {tx.type === 'inflow' ? '+' : '-'}
                                {formatCurrency(tx.amount)}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-300 font-medium">
                                {formatCurrency(tx.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
