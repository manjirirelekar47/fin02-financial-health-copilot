import { useState } from "react";
import { AlertCircle, CheckCircle2, Download, Trash2, Upload } from "lucide-react";
import { addLiveTransaction, deleteUserData, downloadStatementTemplate, uploadStatement } from "../api";

const initialTransaction = { date: "", narration: "", amount: "", type: "debit" };

function formatInr(amount) {
  return `Rs ${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function UploadScreen({ sessionId }) {
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [transaction, setTransaction] = useState(initialTransaction);
  const [liveResult, setLiveResult] = useState(null);
  const [liveError, setLiveError] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const accepted = uploadResult?.accepted || [];
  const badRows = uploadResult?.rejected || uploadResult?.bad_rows || [];

  async function handleDeleteData() {
    if (!window.confirm("Are you sure you want to delete all uploaded transactions and locked paths for this session?")) return;
    setDeleting(true);
    setDeleteMsg("");
    try {
      await deleteUserData(sessionId);
      setUploadResult(null);
      setLiveResult(null);
      setDeleteMsg("Session data successfully wiped from database.");
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      setUploadResult(await uploadStatement(file, sessionId));
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleLiveAdd(event) {
    event.preventDefault();
    setAdding(true);
    setLiveError("");
    setLiveResult(null);
    try {
      setLiveResult(await addLiveTransaction({ ...transaction, amount: Number(transaction.amount) }, sessionId));
      setTransaction(initialTransaction);
    } catch (error) {
      setLiveError(error.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-[14px] border border-cardborder shadow-sm p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-navy">Upload a statement</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a CSV or JSON statement. Bad rows are listed and never silently accepted.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={downloadStatementTemplate} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cardborder px-3 py-2 text-sm font-medium text-navy hover:bg-canvas">
              <Download size={16} /> Download Template
            </button>
            <button type="button" onClick={handleDeleteData} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
              <Trash2 size={16} /> {deleting ? "Deleting…" : "Delete My Data"}
            </button>
          </div>
        </div>
        {deleteMsg && <p className="mt-3 text-sm text-emerald-700 font-medium">{deleteMsg}</p>}

        <form onSubmit={handleUpload} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800 hover:file:bg-emerald-100"
          />
          <button disabled={!file || uploading} type="submit" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            <Upload size={16} /> {uploading ? "Uploading…" : "Upload statement"}
          </button>
        </form>
        {uploadError && <p className="mt-3 text-sm text-risk">{uploadError}</p>}
      </section>

      {uploadResult && (
        <section className="bg-white rounded-[14px] border border-cardborder shadow-sm p-6">
          <div className="flex items-center gap-2 text-healthy"><CheckCircle2 size={18} /><h2 className="font-semibold">Accepted transactions ({accepted.length})</h2></div>
          {accepted.length > 0 ? (
            <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-2">Date</th><th className="p-2">Narration</th><th className="p-2 text-right">Amount</th><th className="p-2">Type</th></tr></thead><tbody>{accepted.map((row) => <tr key={row.id} className="border-b border-cardborder"><td className="p-2 text-slate-500">{row.date}</td><td className="p-2 font-medium text-navy">{row.narration}</td><td className="p-2 text-right">{formatInr(row.amount)}</td><td className="p-2 capitalize">{row.type}</td></tr>)}</tbody></table></div>
          ) : <p className="mt-3 text-sm text-slate-500">No valid rows were found.</p>}

          {badRows.length > 0 && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <div className="flex items-center gap-2 font-semibold"><AlertCircle size={18} /> Bad rows ({badRows.length})</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{badRows.map((row, index) => <li key={`${row.row}-${index}`}>Row {row.row}: {(row.reasons || row.errors || []).map((error) => typeof error === "string" ? error : error.message).join(", ")}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="bg-white rounded-[14px] border border-cardborder shadow-sm p-6">
        <h2 className="text-xl font-semibold text-navy">Add a live transaction</h2>
        <p className="mt-1 text-sm text-slate-500">This refreshes the financial picture immediately for this session.</p>
        <form onSubmit={handleLiveAdd} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-600">Date<input required type="date" value={transaction.date} onChange={(event) => setTransaction({ ...transaction, date: event.target.value })} className="mt-1 block w-full rounded-lg border border-cardborder px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-600">Narration<input required value={transaction.narration} onChange={(event) => setTransaction({ ...transaction, narration: event.target.value })} className="mt-1 block w-full rounded-lg border border-cardborder px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-600">Amount<input required min="0.01" step="0.01" type="number" value={transaction.amount} onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })} className="mt-1 block w-full rounded-lg border border-cardborder px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-600">Type<select value={transaction.type} onChange={(event) => setTransaction({ ...transaction, type: event.target.value })} className="mt-1 block w-full rounded-lg border border-cardborder px-3 py-2"><option value="debit">Debit</option><option value="credit">Credit</option></select></label>
          <button type="submit" disabled={adding} className="sm:col-span-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{adding ? "Adding…" : "Add transaction"}</button>
        </form>
        {liveError && <p className="mt-3 text-sm text-risk">{liveError}</p>}
        {liveResult && <p className="mt-3 text-sm text-healthy">Transaction added and the live recommendation refreshed.</p>}
      </section>
    </div>
  );
}

export default UploadScreen;
