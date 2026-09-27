// src/api.js — owned by Member 1, matches api/main.py exactly.
// Every function returns a Promise resolving to already-parsed JSON.

const BASE_URL = "http://localhost:8000/api";

async function getJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const getSummary = () => getJSON("/summary");
export const getTrends = () => getJSON("/trends");
export const getRecurring = () => getJSON("/recurring");
export const getForecast = (forecastDays = 30) => getJSON(`/forecast?forecast_days=${forecastDays}`);
export const getTransactions = (limit = 50) => getJSON(`/transactions?limit=${limit}`);
