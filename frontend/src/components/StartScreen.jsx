import { useState } from "react";
import {
  Upload,
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Repeat,
  Loader2,
} from "lucide-react";
import { downloadStatementTemplate, uploadStatement } from "../api";

export default function StartScreen({ onSelectDemo, onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError("");
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV or JSON statement file first.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const newSessionId = crypto.randomUUID();
      window.localStorage.setItem("spendshield-session-id", newSessionId);
      const res = await uploadStatement(file, newSessionId);
      if (res && res.accepted && res.accepted.length > 0) {
        onUploadComplete(newSessionId, res);
      } else if (res && res.rejected && res.rejected.length > 0) {
        setError(`Upload had validation errors in ${res.rejected.length} rows. Please check file format.`);
      } else {
        onUploadComplete(newSessionId, res);
      }
    } catch (err) {
      setError(err.message || "Failed to upload statement. Please ensure backend is running.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen app-bg flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Header */}
      <div className="max-w-4xl w-full text-center mb-10">
        <div className="inline-flex items-center justify-center gap-3 mb-4">
          <img src="/logo-icon.png" alt="SpendShield" className="w-14 h-14 object-contain drop-shadow" />
          <span className="text-3xl font-display font-black tracking-tight">
            <span className="text-navy">Spend</span>
            <span className="bg-gradient-to-r from-[#1D604C] to-[#3FA873] bg-clip-text text-transparent">
              Shield
            </span>
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy tracking-tight">
          Welcome to your Financial Health Copilot
        </h1>
        <p className="mt-3 text-slate-600 text-base max-w-xl mx-auto leading-relaxed">
          Simulate decisions before committing. Choose how you want to start: explore the pre-configured
          interactive demo, or upload your own bank statement.
        </p>
      </div>

      {/* Two Choice Cards */}
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* OPTION 1: Interactive Demo */}
        <div className="relative rounded-3xl border border-emerald-300/80 bg-white/90 backdrop-blur-md p-8 shadow-xl shadow-emerald-950/5 flex flex-col justify-between hover:border-emerald-500 transition-all">
          <div className="absolute top-5 right-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">
              <Sparkles size={13} className="text-emerald-600" />
              Recommended for First Look
            </span>
          </div>

          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#14503F] to-[#1D7A5F] flex items-center justify-center text-white mb-5 shadow-md shadow-emerald-900/20">
              <TrendingUp size={24} />
            </div>

            <h2 className="text-2xl font-bold text-navy">Interactive Demo</h2>
            <p className="text-xs font-medium text-emerald-700 mt-0.5">
              Persona A · Synthetic data calibrated to RBI statistics
            </p>

            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Explore the entire platform immediately with pre-loaded, realistic Indian personal finance data.
              No upload required.
            </p>

            <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span>6 months of categorised salary, rent, and discretionary transactions</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span>Detected recurring payments with Silent Creep detection (₹4.5k/mo drift)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span>Forward cashflow forecast with P10/P50/P90 uncertainty bands</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <span>Decision Simulator (F5) with 8 presets & ₹54,000 Shock Capacity</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onSelectDemo}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#14503F] to-[#1D7A5F] hover:from-[#0E2E28] hover:to-[#14503F] text-white py-3.5 px-6 font-bold text-sm shadow-md shadow-emerald-900/20 transition-all hover:scale-[1.01]"
            >
              <span>Explore Demo Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* OPTION 2: Upload Your Statement */}
        <div className="relative rounded-3xl border border-cardborder bg-white/90 backdrop-blur-md p-8 shadow-xl shadow-slate-900/5 flex flex-col justify-between hover:border-slate-400 transition-all">
          <div className="absolute top-5 right-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              <ShieldCheck size={13} className="text-slate-500" />
              Private & Session-Scoped
            </span>
          </div>

          <div>
            <div className="w-12 h-12 rounded-2xl bg-navy flex items-center justify-center text-white mb-5 shadow-md shadow-navy/20">
              <Upload size={24} />
            </div>

            <h2 className="text-2xl font-bold text-navy">Upload Your Statement</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Supports CSV & JSON bank statements
            </p>

            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Upload your own financial transactions to test real cash-gap risks, debt-pressure, and
              custom scenario simulations.
            </p>

            {/* Drag & Drop Zone */}
            <form onSubmit={handleUploadSubmit} className="mt-6 space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-emerald-500 bg-emerald-50/50"
                    : file
                    ? "border-emerald-400 bg-emerald-50/30"
                    : "border-slate-300 hover:border-emerald-400 bg-slate-50/50"
                }`}
              >
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {file ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-800">
                    <FileText size={20} className="text-emerald-600" />
                    <span className="text-xs font-bold truncate max-w-xs">{file.name}</span>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-700">
                      Drop statement here or <span className="text-accent underline">browse</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">CSV or JSON file format</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={downloadStatementTemplate}
                  className="inline-flex items-center gap-1.5 text-accent hover:underline font-semibold"
                >
                  <Download size={14} /> Download Sample CSV Template
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-risk">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!file || uploading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-navy hover:bg-slate-800 text-white py-3.5 px-6 font-bold text-sm shadow-md shadow-navy/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing & Validating Statement…</span>
                  </>
                ) : (
                  <>
                    <span>Upload & Analyze My Data</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Zero raw transactions sent to external LLMs • DPDP ready
          </div>
        </div>
      </div>
    </div>
  );
}
