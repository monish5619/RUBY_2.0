/* ============================================================
   RUBY — API client.
   Every call attempts the Express backend (same-origin /api/...).
   When the backend (or network) is unavailable, the app gracefully
   degrades to a local simulated store so the demo still works.
   ============================================================ */

const REQUEST_TIMEOUT_MS = 8000;
const MODE_PING_MS = 3000;

async function request(method, path, body, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || REQUEST_TIMEOUT_MS);
  const options = { method, headers: { "Content-Type": "application/json" }, signal: controller.signal };
  if (body !== undefined) options.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(path, options);
  } catch (err) {
    err.offline = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error((json && json.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = json || null;
    throw err;
  }
  return json && json.data !== undefined ? json.data : json;
}

const API = (() => {
  let mode = "unknown"; // "online" | "demo"
  let modePromise = null;

  /* Detect connectivity: ping /api/health with a short timeout.
     Returns "online" | "demo" (never throws). */
  async function detectMode() {
    if (mode !== "unknown") return mode;
    if (modePromise) return modePromise;
    modePromise = (async () => {
      try {
        await request("GET", "/api/health", undefined, { timeout: MODE_PING_MS });
        mode = "online";
      } catch {
        mode = "demo";
      }
      return mode;
    })();
    return modePromise;
  }

  /* ------------------------- Auth ------------------------- */
  async function login(email, password) {
    try {
      return await request("POST", "/api/auth/login", { email, password });
    } catch { return localLogin(email, password); }
  }

  /* ----------------------- Patients ----------------------- */
  async function registerPatient(payload) {
    try {
      return await request("POST", "/api/patients/register", payload);
    } catch { return localRegisterPatient(payload); }
  }
  async function getPatients() {
    try {
      return await request("GET", "/api/patients");
    } catch { return Storage.collection("patients"); }
  }
  async function getPatient(id) {
    try {
      return await request("GET", `/api/patients/${encodeURIComponent(id)}`);
    } catch { return Storage.find("patients", id); }
  }
  async function getRupids() {
    try {
      return await request("GET", "/api/rupids");
    } catch { return Storage.collection("patients").map((p) => ({ rupId: p.rupId, patientId: p.id, name: p.name, email: p.email, verificationStatus: p.verificationStatus })); }
  }
  async function generateRupid(payload) {
    try {
      return await request("POST", "/api/patients/rupid/generate", payload);
    } catch { return localRegisterPatient(payload); }
  }

  /* ------------------------ Cases ------------------------- */
  async function getCases() {
    try {
      return await request("GET", "/api/cases");
    } catch { return Storage.collection("appeals"); }
  }
  async function getAppeals() {
    try {
      return await request("GET", "/api/appeals");
    } catch {
      return Storage.collection("appeals").slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }
  async function getCase(id) {
    try {
      return await request("GET", `/api/cases/${encodeURIComponent(id)}`);
    } catch { return Storage.find("appeals", id); }
  }
  async function getAppeal(id) {
    try {
      return await request("GET", `/api/appeals/${encodeURIComponent(id)}`);
    } catch { return Storage.find("appeals", id); }
  }
  async function createAppeal(payload) {
    try {
      return await request("POST", "/api/appeals", payload);
    } catch { return localCreateAppeal(payload); }
  }
  async function submitAppeal(id) {
    try {
      return await request("POST", `/api/appeals/${encodeURIComponent(id)}/submit`, {});
    } catch {
      const appeal = Storage.find("appeals", id);
      if (!appeal) return { ok: true };
      const result = analyzeCase(appeal);
      Storage.update("appeals", id, {
        verificationScore: result.verificationScore,
        verificationStatus: "AI_VERIFIED",
        status: "PENDING_VERIFICATION",
        verificationSummary: result.summary
      });
      return { verification: result, appeal: Storage.find("appeals", id) };
    }
  }
  async function setAppealStatus(id, status, note) {
    try {
      return await request("PATCH", `/api/appeals/${encodeURIComponent(id)}/status`, { status, note });
    } catch {
      return Storage.update("appeals", id, { status, ...(status === "APPROVED" ? { approvedAt: new Date().toISOString() } : {}) });
    }
  }

  /* --------------------- Verification --------------------- */
  async function analyze(payload) {
    try {
      return await request("POST", "/api/verification/analyze", payload);
    } catch { return localAnalyze(payload); }
  }
  async function getVerifications(caseId) {
    const path = caseId ? `/api/verifications/${encodeURIComponent(caseId)}` : "/api/verifications";
    try {
      return await request("GET", path);
    } catch { return Storage.collection("verifications").filter((v) => !caseId || v.caseId === caseId); }
  }
  async function verifyHospital(id, action, note) {
    try {
      return await request("POST", `/api/hospitals/${encodeURIComponent(id)}/verify`, { action, note });
    } catch {
      if (action === "VERIFY") {
        return Storage.update("appeals", id, { verificationStatus: "HOSPITAL_VERIFIED", hospitalVerifiedAt: new Date().toISOString() });
      }
      if (action === "REJECT") {
        return Storage.update("appeals", id, { verificationStatus: "REJECTED", status: "REJECTED", rejectionNote: note });
      }
      return Storage.update("appeals", id, { verificationStatus: "MORE_INFO_REQUESTED", infoRequestNote: note });
    }
  }

  /* ---------------------- Hospitals ----------------------- */
  async function getHospitals() {
    try {
      return await request("GET", "/api/hospitals");
    } catch { return Storage.collection("hospitals"); }
  }
  async function getHospital(id) {
    try {
      return await request("GET", `/api/hospitals/${encodeURIComponent(id)}`);
    } catch { return Storage.find("hospitals", id); }
  }
  async function hospitalRegister(payload) {
    try {
      return await request("POST", "/api/hospitals/register", payload);
    } catch { return localHospitalRegister(payload); }
  }
  async function setHospitalStatus(id, status) {
    try {
      return await request("PATCH", `/api/hospitals/${encodeURIComponent(id)}/status`, { status });
    } catch {
      return Storage.update("hospitals", id, { verificationStatus: status, partnerStatus: status === "PARTNER_APPROVED" ? "active" : "pending" });
    }
  }

  /* ---------------------- Donations ----------------------- */
  async function getDonations() {
    try {
      return await request("GET", "/api/donations");
    } catch { return Storage.collection("donations"); }
  }
  async function getTransactions() {
    try {
      return await request("GET", "/api/transactions");
    } catch { return buildLedger(); }
  }
  async function getTransaction(id) {
    try {
      return await request("GET", `/api/transactions/${encodeURIComponent(id)}`);
    } catch {
      return buildLedger().find((r) => r.transactionId === id || r.id === id) || null;
    }
  }
  async function donate(payload) {
    try {
      return await request("POST", "/api/donations", payload);
    } catch { return localDonate(payload); }
  }

  /* --------------------- Payments ------------------------- */
  async function createPayment(payload) {
    try {
      return await request("POST", "/api/payments/create", payload);
    } catch { return localCreatePayment(payload); }
  }
  async function confirmPayment(payload) {
    try {
      return await request("POST", "/api/payments/confirm", payload);
    } catch { return localConfirmPayment(payload); }
  }

  /* -------------------- Disbursements --------------------- */
  async function getDisbursements() {
    try {
      return await request("GET", "/api/disbursements");
    } catch { return buildDisbursements(); }
  }
  async function disburse(id, payload) {
    try {
      return await request("PATCH", `/api/disbursements/${encodeURIComponent(id)}`, payload);
    } catch {
      const appeal = Storage.find("appeals", id);
      if (!appeal) return null;
      const milestone = payload.milestone || "Milestone completed";
      const amount = Number(payload.amount) || 0;
      const disbursement = { id: `DISB-RBY-${Math.floor(100 + Math.random() * 899)}`, amount, ...(typeof milestone === "string" ? { milestone } : { milestone }) , status: "DISBURSED", timestamp: new Date().toISOString(), hash: mockHash() };
      const disbursements = appeal.disbursements || [];
      disbursements.push(disbursement);
      const update = { disbursements };
      const milestones = appeal.milestones || [];
      const mIdx = milestones.findIndex((m) => m.status === "ESCROW" || m.status === "PENDING");
      if (mIdx >= 0) {
        milestones[mIdx] = { ...milestones[mIdx], status: "DISBURSED" };
        update.milestones = milestones;
      }
      const raisedFromMilestones = disbursements.reduce((s, d) => s + Number(d.amount || 0), 0);
      if (raisedFromMilestones >= appeal.targetAmount) update.status = "DISBURSED";
      return Storage.update("appeals", id, update);
    }
  }

  /* =========================================================
     LOCAL / OFFLINE SIMULATIONS (used when backend is down)
     ========================================================= */
  function localLogin(email, password) {
    const demoUsers = {
      "patient@ruby.demo": { role: "patient", password: "demo123", name: "Priya Sharma", rupId: "RBY-8842-991A-CX", patientId: "PT-1001" },
      "donor@ruby.demo": { role: "donor", password: "demo123", name: "Aarav Donor", donorId: "DN-1001" },
      "hospital@ruby.demo": { role: "hospital", password: "demo123", name: "Meera Multispeciality Hospital", hospitalId: "HSP-RBY-001" },
      "admin@ruby.demo": { role: "admin", password: "admin123", name: "RUBY Admin" }
    };
    const key = String(email || "").trim().toLowerCase();
    const user = demoUsers[key];
    if (!user || user.password !== password) throw new Error("Invalid email or password.");
    const session = { role: user.role, name: user.name, email: key };
    if (user.rupId) session.rupId = user.rupId;
    if (user.patientId) session.patientId = user.patientId;
    if (user.hospitalId) session.hospitalId = user.hospitalId;
    return session;
  }

  function makeId(prefix, len) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return `${prefix}${out}`;
  }

  function makeRupid() {
    return `RBY-${Math.floor(1000 + Math.random() * 8999)}-${makeId("", 4)}-${makeId("", 2)}`;
  }

  function localRegisterPatient(payload) {
    const existing = Storage.collection("patients").find((p) => p.email === payload.email);
    if (existing) return { patient: existing, rupId: existing.rupId, duplicate: true };
    const rupId = makeRupid();
    const patient = {
      id: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
      rupId,
      name: payload.fullName,
      email: payload.email,
      phone: payload.mobile,
      age: payload.age,
      verificationStatus: "VERIFIED",
      verificationScore: 96,
      createdAt: new Date().toISOString()
    };
    Storage.add("patients", patient);
    Storage.setRupid(rupId);
    return { patient, rupId, duplicate: false };
  }

  function localCreateAppeal(payload) {
    const existing = Storage.collection("appeals").filter((a) =>
      a.patientEmail === payload.patientEmail || a.rupId === payload.rupId
    );
    if (payload.rupId && existing.length) {
      return Object.assign({}, existing[0], { duplicate: true });
    }
    const c = Math.floor(1000 + Math.random() * 8999);
    const appeal = {
      id: `CASE-RBY-${c}`,
      rupId: payload.rupId,
      patientId: payload.patientId,
      patientName: payload.patientName,
      age: payload.age,
      patientEmail: payload.patientEmail,
      hospitalId: payload.hospitalId,
      hospitalName: payload.hospitalName,
      department: payload.department,
      doctor: payload.doctor,
      caseNumber: payload.caseNumber,
      diagnosis: payload.diagnosis,
      treatment: payload.treatment,
      procedure: payload.procedure,
      estimatedTreatmentCost: Number(payload.estimatedTreatmentCost),
      treatmentDuration: payload.treatmentDuration,
      targetAmount: Number(payload.targetAmount),
      amountAlreadyAvailable: Number(payload.amountAlreadyAvailable),
      insuranceCoverage: Number(payload.insuranceCoverage),
      amountRequired: Number(payload.amountRequired),
      story: payload.story,
      fundingUsage: payload.fundingUsage || payload.story,
      deadline: payload.deadline,
      urgency: payload.urgency || "MEDIUM",
      status: "VERIFICATION_PENDING",
      verificationStatus: "SUBMITTED",
      verificationScore: 0,
      raisedAmount: 0,
      location: payload.location || "",
      createdAt: new Date().toISOString(),
      hospitalVerifiedAt: null,
      approvedAt: null,
      documents: payload.documents || [],
      milestones: [],
      disbursements: []
    };
    Storage.add("appeals", appeal);
    return { appeal, appealId: appeal.id };
  }

  function localAnalyze(payload) {
    return analyzeCase(payload);
  }

  function localHospitalRegister(payload) {
    const id = `HSP-RBY-${String(Math.floor(100 + Math.random() * 899))}`;
    const hospital = {
      id,
      name: payload.hospitalName || payload.name,
      registrationNumber: payload.registrationNumber,
      type: payload.hospitalType || "Hospital",
      address: payload.address || "",
      city: payload.city || "",
      contactEmail: payload.contactEmail || payload.email,
      contactPhone: payload.contactPhone || payload.phone,
      adminName: payload.adminName,
      adminEmail: payload.adminEmail,
      license: payload.license || "",
      documentationStatus: "SUBMITTED",
      verificationStatus: "UNDER_REVIEW",
      partnerStatus: "pending",
      bankLast4: payload.bankLast4 || "____",
      createdAt: new Date().toISOString()
    };
    Storage.add("hospitals", hospital);
    return { hospital, hospitalId: id };
  }

  function localDonate(payload) {
    const donation = {
      id: `DON-RBY-2026-${String(100 + Storage.collection("donations").length).padStart(3, "0")}`,
      transactionId: makeTransactionId(),
      caseId: payload.caseId,
      donorLabel: payload.donorLabel || "Anonymous Donor",
      amount: Number(payload.amount),
      method: payload.method || "UPI",
      status: "ESCROW",
      timestamp: new Date().toISOString(),
      blockHash: mockHash()
    };
    Storage.add("donations", donation);
    const appeal = Storage.find("appeals", payload.caseId);
    if (appeal) {
      Storage.update("appeals", appeal.id, { raisedAmount: Math.min(appeal.targetAmount, Number(appeal.raisedAmount) + donation.amount) });
    }
    return donation;
  }

  function localCreatePayment(payload) {
    return {
      paymentId: `PAY-RBY-${Math.floor(100000 + Math.random() * 899999)}`,
      amount: Number(payload.amount),
      status: "CREATED",
      createdAt: new Date().toISOString(),
      testMode: true
    };
  }

  function localConfirmPayment(payload) {
    const donation = localDonate(payload.donation || payload);
    return {
      successful: true,
      donation,
      receipt: {
        transactionId: donation.transactionId,
        caseId: donation.caseId,
        amount: donation.amount,
        timestamp: donation.timestamp,
        status: "ESCROW",
        method: donation.method,
        blockHash: donation.blockHash
      }
    };
  }

  return {
    get mode() { return mode; },
    detectMode, getHealth: () => request("GET", "/api/health"),
    getStats: () => request("GET", "/api/stats"),
    login, registerPatient, getPatients, getPatient, generateRupid, getRupids,
    getCases, getAppeals, getCase, getAppeal, createAppeal, submitAppeal, setAppealStatus,
    analyze, getVerifications, verifyHospital,
    getHospitals, getHospital, hospitalRegister, setHospitalStatus,
    getDonations, getTransactions, getTransaction, donate,
    createPayment, confirmPayment, getDisbursements, disburse
  };
})();

/* ============================================================
   Shared deterministic helpers (used by frontend fallback).
   ============================================================ */
function analyzeCase(payload) {
  const flags = [];
  let score = 92;

  const required = ["patientName", "rupId", "hospitalId", "diagnosis", "treatment", "targetAmount"];
  missingCheck:
  for (const key of required) {
    const v = payload[key];
    if (v === undefined || v === null || String(v).trim() === "") {
      flags.push(`Missing information: ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`);
      score -= 8;
      break missingCheck;
    }
  }

  const target = Number(payload.targetAmount) || 0;
  const est = Number(payload.estimatedTreatmentCost) || 0;
  const requiredAmt = Number(payload.amountRequired) || 0;
  const avail = Number(payload.amountAlreadyAvailable) || 0;
  const insur = Number(payload.insuranceCoverage) || 0;

  if (est > 0 && target > 0 && est * 0.2 > target) {
    flags.push("Unusual funding request: target far below estimated treatment cost.");
    score -= 6;
  }
  if (requiredAmt > 0 && target > 0 && requiredAmt > target + 0.01) {
    flags.push("Contradictory information: required amount exceeds target amount.");
    score -= 10;
  }
  if (avail > 0 && requiredAmt > 0 && avail + requiredAmt > target * 1.2) {
    flags.push("Funding calculation inconsistent with target amount.");
    score -= 5;
  }
  const story = String(payload.story || "").trim().length;
  if (story > 0 && story < 40) {
    flags.push("Very short or incomplete treatment story.");
    score -= 5;
  }
  if (!payload.hospitalId) {
    flags.push("Incomplete hospital details.");
    score -= 8;
  }

  score = Math.max(30, score);
  let status = "LOW_RISK";
  if (score < 60) status = "HIGH_RISK";
  else if (score < 80) status = "MEDIUM_RISK";

  return {
    riskScore: 100 - score,
    verificationScore: score,
    status,
    flags,
    summary: "AI-assisted prototype analysis — submitted information appears internally consistent. This is not a medical or legal decision.",
    recommendation: status === "LOW_RISK" ? "Proceed to hospital verification." : "Additional manual review required before hospital verification.",
    disclaimer: "AI-assisted prototype analysis — not a medical or legal decision."
  };
}

function makeTransactionId() {
  const n = 100000 + Math.floor(Math.random() * 900000);
  return `TXN-RBY-2026-${n}`;
}

function mockHash() {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 64; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

/* Build a prototype transparency ledger from donations + disbursements */
function buildLedger() {
  const donations = Storage.collection("donations");
  const entries = donations.map((d) => {
    const appeal = Storage.find("appeals", d.caseId);
    return {
      id: d.transactionId || d.id,
      transactionId: d.transactionId,
      caseId: d.caseId,
      amount: d.amount,
      donor: d.donorLabel,
      status: d.status,
      timestamp: d.timestamp,
      method: d.method,
      recipient: appeal ? appeal.hospitalName : "—",
      disbursementStatus: d.status === "SETTLED" ? "DISBURSED" : "ESCROW / PENDING",
      blockHash: d.blockHash || mockHash()
    };
  });
  return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/* Build a prototype disbursement list from appeals (offline fallback) */
function buildDisbursements() {
  return Storage.collection("appeals")
    .filter((a) => Array.isArray(a.disbursements) && a.disbursements.length)
    .flatMap((a) => (a.disbursements || []).map((d) => ({
      id: d.id,
      caseId: a.id,
      patientName: a.patientName,
      hospitalName: a.hospitalName,
      amount: Number(d.amount),
      milestone: d.milestone,
      status: d.status,
      timestamp: d.timestamp,
      hash: d.hash
    })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}