// src/api.js — owned by Member 1, matches api/main.py exactly.
// Every function returns a Promise resolving to already-parsed JSON.
//
// URL layout
//   R1 routes: FastAPI registers them as  GET /api/summary  etc.
//              → call with R1_BASE (origin + /api)
//   R2 routes: FastAPI registers them as  POST /simulate  etc. (no /api prefix)
//              → call with R2_BASE (bare origin)
//
// In dev (vite dev server on :5173) we point at the local backend on :8005.
// In production the Render deployment serves everything from one origin so
// both bases resolve to the same host.

const _DEV  = import.meta.env.DEV;
const _PROD_ORIGIN = "https://spendshield-tj9v.onrender.com";
const _DEV_ORIGIN  = "http://127.0.0.1:8000";

const ORIGIN  = _DEV ? _DEV_ORIGIN : _PROD_ORIGIN;
const R1_BASE = `${ORIGIN}/api`;   // R1: /api/summary, /api/forecast, …
const R2_BASE = ORIGIN;            // R2: /simulate, /twin/benchmark, …

async function getJSON(base, path, sessionId) {
  const res = await fetch(`${base}${path}`, {
    headers: sessionId ? { "X-Session-ID": sessionId } : {},
  });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function postJSON(base, path, body, sessionId) {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sid ? { "X-Session-ID": sid } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function uploadStatement(file, sessionId) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${R1_BASE}/upload`, {
    method: "POST",
    headers: { "X-Session-ID": sessionId },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function addLiveTransaction(transaction, sessionId) {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  const res = await fetch(`${R1_BASE}/transactions?session_id=${encodeURIComponent(sid)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-ID": sid },
    body: JSON.stringify(transaction),
  });
  if (!res.ok) throw new Error(`Live add failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export function downloadStatementTemplate() {
  window.open(`${R1_BASE}/template`, "_blank", "noopener,noreferrer");
}

export async function deleteUserData(sessionId) {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  const res = await fetch(`${R1_BASE}/user-data?session_id=${encodeURIComponent(sid)}`, {
    method: "DELETE",
    headers: sid ? { "X-Session-ID": sid } : {},
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getShockCapacity(sessionId, limit = 0.1) {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  const res = await fetch(`${R1_BASE}/shock-capacity?limit=${limit}&session_id=${encodeURIComponent(sid)}`, {
    headers: sid ? { "X-Session-ID": sid } : {},
  });
  if (!res.ok) throw new Error(`Shock Capacity request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function compareSimulationPaths(scenarios, sessionId) {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  const res = await fetch(`${R1_BASE}/simulate?session_id=${encodeURIComponent(sid)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sid ? { "X-Session-ID": sid } : {}),
    },
    body: JSON.stringify(scenarios),
  });
  if (!res.ok) throw new Error(`Simulation request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export const simulate = compareSimulationPaths;
export const simulateDecision = compareSimulationPaths;

export const getPriorityList = (sessionId) => getJSON(R1_BASE, "/priority", sessionId);
export const getCalendar = (sessionId) => getJSON(R1_BASE, "/calendar", sessionId);

export async function lockPath(path, sessionId) {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  const res = await fetch(`${R1_BASE}/lock?session_id=${encodeURIComponent(sid)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sid,
    },
    body: JSON.stringify(path),
  });
  if (!res.ok) throw new Error(`Lock request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getLockedPath(lockId, sessionId) {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  const res = await fetch(`${R1_BASE}/lock/${encodeURIComponent(lockId)}?session_id=${encodeURIComponent(sid)}`, {
    headers: { "X-Session-ID": sid },
  });
  if (!res.ok) throw new Error(`Get locked path failed: ${res.status} ${res.statusText}`);
  return res.json();
}


// -- Round 1 exports (R1_BASE → /api/…) --
export const getSummary      = (sessionId)     => getJSON(R1_BASE, "/summary", sessionId);
export const getTrends       = ()              => getJSON(R1_BASE, "/trends");
export const getRecurring    = (sessionId)     => getJSON(R1_BASE, "/recurring", sessionId);
export const getForecast     = (days = 30, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "");
  return getJSON(R1_BASE, `/forecast?horizon_days=${days}&forecast_days=${days}`, sid);
};
export const getTransactions = (limit = 50, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R1_BASE, `/transactions?limit=${limit}&session_id=${encodeURIComponent(sid)}`, sid);
};

// -- Round 2 exports (R2_BASE → /simulate, /twin/…, …) --
export const fetchSimulatePresets = (sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R2_BASE, `/simulate/presets?session_id=${encodeURIComponent(sid)}`, sid);
};
export const runSimulation = (payload, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return postJSON(R2_BASE, `/simulate?session_id=${encodeURIComponent(sid)}`, payload, sid);
};
export const fetchTwinBenchmark = (sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R2_BASE, `/twin/benchmark?session_id=${encodeURIComponent(sid)}`, sid);
};
export const runOptimizer = (payload, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return postJSON(R2_BASE, `/optimize?session_id=${encodeURIComponent(sid)}`, payload, sid);
};
export const fetchReviewQueue = (sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R2_BASE, `/categoriser/review-queue?session_id=${encodeURIComponent(sid)}`, sid);
};
export const submitCategoryCorrection = (payload, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return postJSON(R2_BASE, `/categoriser/correct?session_id=${encodeURIComponent(sid)}`, payload, sid);
};
export const submitTransaction = (payload, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return postJSON(R2_BASE, `/transactions?session_id=${encodeURIComponent(sid)}`, payload, sid);
};
export const sendAgentChat = (payload, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return postJSON(R2_BASE, `/agent/chat?session_id=${encodeURIComponent(sid)}`, payload, sid);
};
export const fetchCalibration = (sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R2_BASE, `/calibration?session_id=${encodeURIComponent(sid)}`, sid);
};

export const fetchForecastReport = (sessionId, horizonWeeks = 8, view = "weekly") => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R1_BASE, `/forecast-report?session_id=${encodeURIComponent(sid)}&horizon_weeks=${horizonWeeks}&view=${encodeURIComponent(view)}`, sid);
};

export const fetchPlan = (reserve = 0, goal = 0, view = "weekly", sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R1_BASE, `/plan?reserve=${encodeURIComponent(reserve)}&goal=${encodeURIComponent(goal)}&view=${encodeURIComponent(view)}&session_id=${encodeURIComponent(sid)}`, sid);
};

export const submitPlan = (payload, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return postJSON(R1_BASE, `/plan?session_id=${encodeURIComponent(sid)}`, payload, sid);
};

export const submitReplan = (payload, sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return postJSON(R1_BASE, `/replan?session_id=${encodeURIComponent(sid)}`, payload, sid);
};

export const fetchEvidencePack = (sessionId) => {
  const sid = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  return getJSON(R1_BASE, `/evidence-pack?session_id=${encodeURIComponent(sid)}`, sid);
};


