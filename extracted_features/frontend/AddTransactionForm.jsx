// frontend/AddTransactionForm.jsx — Live transaction insertion form.
import React, { useState } from "react";
import { PlusCircle, Loader2 } from "lucide-react";

export default function AddTransactionForm({ onTransactionAdded }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    narration: "",
    amount: "",
    type: "debit",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });
      const data = await res.json();
      setMsg("Transaction recorded! Live loop refreshed.");
      setFormData({
        date: new Date().toISOString().split("T")[0],
        narration: "",
        amount: "",
        type: "debit",
      });
      if (onTransactionAdded) onTransactionAdded(data);
    } catch (err) {
      setMsg("Failed to add transaction");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <PlusCircle size={18} className="text-slate-800" />
        <h3 className="text-sm font-bold text-slate-800">Add Live Transaction</h3>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-slate-500 font-medium mb-1">Date</label>
          <input
            required
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-medium mb-1">Narration / Merchant</label>
          <input
            required
            type="text"
            placeholder="e.g. Netflix, Cult.fit, House Rent"
            value={formData.narration}
            onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-medium mb-1">Amount (₹)</label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-medium mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="debit">Debit (Expense)</option>
            <option value="credit">Credit (Income)</option>
          </select>
        </div>
        <div className="sm:col-span-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Post Transaction"}
          </button>
          {msg && <p className="text-[11px] text-emerald-600 font-semibold mt-1 text-center">{msg}</p>}
        </div>
      </form>
    </div>
  );
}
