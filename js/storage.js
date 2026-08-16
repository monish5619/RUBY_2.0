/* ============================================================
   RUBY — localStorage demo database + persistence helpers.
   All prototype data lives under the `ruby:` key prefix so the
   app keeps working after refreshing / when the API is offline.
   ============================================================ */
const Storage = (() => {
  const DB_KEY = "ruby:db:v1";
  const SESSION_KEY = "ruby:session";
  const RUPID_KEY = "ruby:rupid";
  const DRAFT_APPEAL_KEY = "ruby:draftAppeal";
  const SELECTED_CASE_KEY = "ruby:selectedCase";
  const LAST_DONATION_KEY = "ruby:lastDonation";

  /* ---------------------------------------------------------
     Canonical demo dataset (mirrors backend/data/demo-data.json)
     All names, records and figures are fictional.
     --------------------------------------------------------- */
  const DEMO_DATA = {
    patients: [
      { id: "PT-1001", rupId: "RBY-8842-991A-CX", name: "Priya Sharma", email: "patient@ruby.demo", phone: "+91 98220 12345", age: 34, verificationStatus: "VERIFIED", verificationScore: 96, createdAt: "2026-04-12T10:12:00Z" },
      { id: "PT-1002", rupId: "RBY-2021-553B-KT", name: "Anita Deshpande", email: "anita.d@fictional.in", phone: "+91 98900 77123", age: 54, verificationStatus: "VERIFIED", verificationScore: 94, createdAt: "2026-03-02T09:40:00Z" },
      { id: "PT-1003", rupId: "RBY-7765-1102-RA", name: "Vikram Nair", email: "vikram.n@fictional.in", phone: "+91 91674 00452", age: 41, verificationStatus: "VERIFIED", verificationScore: 91, createdAt: "2026-03-18T15:22:00Z" },
      { id: "PT-1004", rupId: "RBY-3380-904D-PV", name: "Sunita Kulkarni", email: "sunita.k@fictional.in", phone: "+91 90909 88332", age: 47, verificationStatus: "VERIFIED", verificationScore: 89, createdAt: "2026-05-01T11:05:00Z" },
      { id: "PT-1005", rupId: "RBY-1120-77BM-KA", name: "Rohan Patil", email: "rohan.p@fictional.in", phone: "+91 98765 11002", age: 6, verificationStatus: "VERIFIED", verificationScore: 93, createdAt: "2026-05-20T08:30:00Z" }
    ],
    hospitals: [
      {
        id: "HSP-RBY-001",
        name: "Meera Multispeciality Hospital",
        registrationNumber: "HSP-MH-2021-0042",
        type: "Multispeciality Hospital",
        address: "14, Marine Drive, Churchgate",
        city: "Mumbai, Maharashtra",
        contactEmail: "partners@meerademo.example",
        contactPhone: "+91 22 4000 8821",
        adminName: "Dr. Kavita Rao",
        adminEmail: "hospital@ruby.demo",
        license: "LIC-MH-7741",
        documentationStatus: "VERIFIED",
        verificationStatus: "PARTNER_APPROVED",
        partnerStatus: "active",
        bankLast4: "0432",
        createdAt: "2025-11-02T10:00:00Z"
      },
      {
        id: "HSP-RBY-002",
        name: "Samarth Medical Institute",
        registrationNumber: "HSP-MH-2019-0811",
        type: "Super-speciality Hospital",
        address: "22, FC Road, Shivajinagar",
        city: "Pune, Maharashtra",
        contactEmail: "partners@samarth.example",
        contactPhone: "+91 20 2500 7719",
        adminName: "Dr. Arjun Malhotra",
        adminEmail: "samarth@fictional.in",
        license: "LIC-MH-3190",
        documentationStatus: "VERIFIED",
        verificationStatus: "PARTNER_APPROVED",
        partnerStatus: "active",
        bankLast4: "8817",
        createdAt: "2025-12-19T14:20:00Z"
      },
      {
        id: "HSP-RBY-003",
        name: "Anahita Children's Hospital",
        registrationNumber: "HSP-KA-2022-1044",
        type: "Paediatric Hospital",
        address: "5, Indiranagar 2nd Stage",
        city: "Bengaluru, Karnataka",
        contactEmail: "partners@anahita.example",
        contactPhone: "+91 80 4112 0090",
        adminName: "Dr. Neha Iyer",
        adminEmail: "anahita@fictional.in",
        license: "LIC-KA-2044",
        documentationStatus: "VERIFIED",
        verificationStatus: "PARTNER_APPROVED",
        partnerStatus: "active",
        bankLast4: "2030",
        createdAt: "2026-01-28T09:45:00Z"
      }
    ],
    appeals: [
      {
        id: "CASE-RBY-1001", rupId: "RBY-2021-553B-KT", patientId: "PT-1002", patientName: "Anita Deshpande", age: 54,
        hospitalId: "HSP-RBY-001", hospitalName: "Meera Multispeciality Hospital",
        department: "Cardiac Surgery", doctor: "Dr. Sameer Kulkarni", caseNumber: "HSP-1001-CS",
        diagnosis: "Severe multi-vessel coronary artery disease", treatment: "Coronary Artery Bypass Grafting (CABG)",
        procedure: "Off-pump triple bypass surgery", estimatedTreatmentCost: 840000, treatmentDuration: "8 weeks",
        targetAmount: 800000, amountAlreadyAvailable: 40000, insuranceCoverage: 0, amountRequired: 760000,
        story: "Anita was diagnosed with severe blockages in three major coronary arteries after a sudden episode of angina. The surgeon has advised an urgent off-pump triple bypass. Half of the family income goes towards her regular medicines, and they cannot afford the surgical hospitalisation in full.",
        fundingUsage: "Hospitalisation charges, surgeon fees, ICU stay, post-operative cardiac rehabilitation and 8-week follow-up care.",
        deadline: "2026-09-30", urgency: "CRITICAL", status: "FUNDRAISING", verificationStatus: "HOSPITAL_VERIFIED",
        verificationScore: 94, verificationSummary: "Documents cross-checked by the hospital. Funding target is consistent with the treatment estimate.",
        raisedAmount: 620000, location: "Mumbai, Maharashtra",
        createdAt: "2026-05-14T09:30:00Z", hospitalVerifiedAt: "2026-05-15T14:00:00Z", approvedAt: "2026-05-16T11:00:00Z",
        documents: [{ name: "medical_report.pdf", type: "Medical Report" }, { name: "cost_estimate.pdf", type: "Cost Estimate" }],
        milestones: [{ label: "Admission & pre-op workup", amount: 120000, status: "DISBURSED" }, { label: "Surgery completed", amount: 340000, status: "DISBURSED" }, { label: "ICU & recovery phase", amount: 220000, status: "ESCROW" }],
        disbursements: [
          { id: "DISB-RBY-101", amount: 120000, milestone: "Admission & pre-op workup", status: "DISBURSED", timestamp: "2026-06-10T09:00:00Z", hash: "0x8f4a33e29bc09711419e22f0a1c8d4e5b6f7a8091b2c3d4e5f60718293a4b5c6d" },
          { id: "DISB-RBY-102", amount: 340000, milestone: "Surgery completed", status: "PENDING", timestamp: "2026-08-05T12:00:00Z", hash: null }
        ]
      },
      {
        id: "CASE-RBY-1002", rupId: "RBY-8842-991A-CX", patientId: "PT-1001", patientName: "Priya Sharma", age: 34,
        hospitalId: "HSP-RBY-002", hospitalName: "Samarth Medical Institute",
        department: "Medical Oncology", doctor: "Dr. Farida Khan", caseNumber: "HSP-1002-ONC",
        diagnosis: "Stage II triple-negative breast carcinoma", treatment: "Oncology treatment (chemotherapy + targeted therapy)",
        procedure: "6 cycles of neoadjuvant chemotherapy followed by targeted therapy", estimatedTreatmentCost: 1580000, treatmentDuration: "6 months",
        targetAmount: 1500000, amountAlreadyAvailable: 80000, insuranceCoverage: 0, amountRequired: 1420000,
        story: "Priya, a school teacher and mother of two, was diagnosed with stage II triple-negative breast carcinoma during a routine screening. Her treatment plan requires six cycles of chemotherapy and subsequent targeted therapy. She has already spent her savings on diagnostics and needs help for the hospitalisation and medicines.",
        fundingUsage: "Chemotherapy cycles, targeted therapy medicines, hospital day-care, scans and palliative-side nursing support.",
        deadline: "2026-11-15", urgency: "HIGH", status: "FUNDRAISING", verificationStatus: "HOSPITAL_VERIFIED",
        verificationScore: 91, verificationSummary: "Hospital records confirm diagnosis and treatment plan. Cost estimate reviewed by oncology department.",
        raisedAmount: 340000, location: "Pune, Maharashtra",
        createdAt: "2026-06-02T10:15:00Z", hospitalVerifiedAt: "2026-06-03T16:20:00Z", approvedAt: "2026-06-04T10:00:00Z",
        documents: [{ name: "biopsy_report.pdf", type: "Medical Report" }, { name: "chemo_plan.pdf", type: "Treatment Plan" }],
        milestones: [{ label: "Cycle 1-2 chemotherapy", amount: 300000, status: "ESCROW" }, { label: "Cycle 3-6 chemotherapy", amount: 450000, status: "PENDING" }],
        disbursements: []
      },
      {
        id: "CASE-RBY-1003", rupId: "RBY-7765-1102-RA", patientId: "PT-1003", patientName: "Vikram Nair", age: 41,
        hospitalId: "HSP-RBY-001", hospitalName: "Meera Multispeciality Hospital",
        department: "Trauma & Emergency", doctor: "Dr. Rajesh Menon", caseNumber: "HSP-1003-TR",
        diagnosis: "Polytrauma with femur and pelvic fractures following road-traffic accident", treatment: "Emergency trauma surgery",
        procedure: "Multiple reconstructive orthopaedic surgeries and ICU stabilisation", estimatedTreatmentCost: 610000, treatmentDuration: "6 weeks",
        targetAmount: 500000, amountAlreadyAvailable: 50000, insuranceCoverage: 100000, amountRequired: 350000,
        story: "Vikram met with a serious road accident while returning home from work. He has multiple fractures and internal injuries requiring staged emergency surgeries and prolonged ICU care. Part of the bill is covered by a group insurance policy, and his family is raising the balance.",
        fundingUsage: "Emergency trauma surgeries, ICU stay, orthopaedic implants, physiotherapy and 6-week rehabilitation.",
        deadline: "2026-08-25", urgency: "CRITICAL", status: "FUNDRAISING", verificationStatus: "HOSPITAL_VERIFIED",
        verificationScore: 96, verificationSummary: "Emergency admission corroborated by the trauma unit. Insurance cover verified; funding target is net of insurance.",
        raisedAmount: 485000, location: "Mumbai, Maharashtra",
        createdAt: "2026-07-10T13:40:00Z", hospitalVerifiedAt: "2026-07-10T18:10:00Z", approvedAt: "2026-07-11T09:30:00Z",
        documents: [{ name: "icu_discharge_note.pdf", type: "Medical Report" }, { name: "fir_copy.pdf", type: "Legal Document" }],
        milestones: [{ label: "Emergency surgery & ICU", amount: 300000, status: "ESCROW" }, { label: "Reconstructive surgery", amount: 200000, status: "PENDING" }],
        disbursements: []
      },
      {
        id: "CASE-RBY-1004", rupId: "RBY-3380-904D-PV", patientId: "PT-1004", patientName: "Sunita Kulkarni", age: 47,
        hospitalId: "HSP-RBY-002", hospitalName: "Samarth Medical Institute",
        department: "Nephrology", doctor: "Dr. Vishal Chitre", caseNumber: "HSP-1004-NEPH",
        diagnosis: "End-stage kidney disease with bilateral renal failure", treatment: "Kidney treatment (dialysis bridge + transplant evaluation)",
        procedure: "Twice-weekly haemodialysis while awaiting a kidney donor workup", estimatedTreatmentCost: 720000, treatmentDuration: "12 months",
        targetAmount: 700000, amountAlreadyAvailable: 60000, insuranceCoverage: 0, amountRequired: 640000,
        story: "Sunita, a daily-wage cook, has been on emergency dialysis since her kidneys failed. She needs sustained dialysis support and a full transplant workup. Without continuous dialysis she cannot survive, and her family cannot sustain the weekly costs.",
        fundingUsage: "Dialysis sessions, donor workup, transplant evaluation tests, immunosuppressants and follow-up.",
        deadline: "2026-10-10", urgency: "MEDIUM", status: "FUNDRAISING", verificationStatus: "HOSPITAL_VERIFIED",
        verificationScore: 89, verificationSummary: "Renal unit confirms dialysis schedule and transplant workup. Regular dialysis records submitted.",
        raisedAmount: 120000, location: "Pune, Maharashtra",
        createdAt: "2026-06-20T11:00:00Z", hospitalVerifiedAt: "2026-06-21T12:40:00Z", approvedAt: "2026-06-22T09:00:00Z",
        documents: [{ name: "renal_dialysis_log.pdf", type: "Medical Report" }],
        milestones: [{ label: "3-month dialysis support", amount: 180000, status: "ESCROW" }, { label: "Transplant workup", amount: 200000, status: "PENDING" }],
        disbursements: []
      },
      {
        id: "CASE-RBY-1005", rupId: "RBY-1120-77BM-KA", patientId: "PT-1005", patientName: "Rohan Patil", age: 6,
        hospitalId: "HSP-RBY-003", hospitalName: "Anahita Children's Hospital",
        department: "Paediatric Surgery", doctor: "Dr. Meenakshi Verma", caseNumber: "HSP-1005-PED",
        diagnosis: "Congenital ventricular septal defect (VSD)", treatment: "Paediatric open-heart surgery",
        procedure: "Ventricular septal defect closure with cardiopulmonary bypass", estimatedTreatmentCost: 450000, treatmentDuration: "4 weeks",
        targetAmount: 400000, amountAlreadyAvailable: 50000, insuranceCoverage: 0, amountRequired: 350000,
        story: "Little Rohan was born with a hole in his heart. Doctors have advised closure surgery before he starts school. His parents run a small tea stall and have borrowed from relatives to begin the treatment.",
        fundingUsage: "Paediatric cardiac surgery, ICU, medicines, pre-operative evaluation and post-surgery care.",
        deadline: "2026-09-20", urgency: "HIGH", status: "FUNDRAISING", verificationStatus: "HOSPITAL_VERIFIED",
        verificationScore: 93, verificationSummary: "Paediatric cardiology records confirm VSD. Surgical estimate approved by the hospital.",
        raisedAmount: 210000, location: "Bengaluru, Karnataka",
        createdAt: "2026-07-01T09:20:00Z", hospitalVerifiedAt: "2026-07-02T10:30:00Z", approvedAt: "2026-07-03T10:00:00Z",
        documents: [{ name: "echo_report.pdf", type: "Medical Report" }, { name: "surgery_estimate.pdf", type: "Cost Estimate" }],
        milestones: [{ label: "Surgery & ICU", amount: 280000, status: "ESCROW" }, { label: "Recovery & follow-up", amount: 120000, status: "PENDING" }],
        disbursements: []
      },
      {
        id: "CASE-RBY-1006", rupId: "RBY-DEMO-77BM-XG", patientId: "PT-DEMO", patientName: "Rahul Demo", age: 29,
        hospitalId: "HSP-RBY-001", hospitalName: "Meera Multispeciality Hospital",
        department: "General Surgery", doctor: "Dr. Kavita Rao", caseNumber: "HSP-1006-GS",
        diagnosis: "Laparoscopic cholecystectomy (symptomatic gallstones)", treatment: "Keyhole gallbladder removal surgery",
        procedure: "Laparoscopic cholecystectomy with day-care recovery", estimatedTreatmentCost: 250000, treatmentDuration: "2 weeks",
        targetAmount: 220000, amountAlreadyAvailable: 20000, insuranceCoverage: 0, amountRequired: 200000,
        story: "Rahul has repeated episodes of acute gallbladder pain and needs a scheduled keyhole surgery. This newly-submitted appeal is used to demonstrate the full RUBY verification workflow.",
        fundingUsage: "Laparoscopic surgery, hospitalisation, medicines and follow-up consultation.",
        deadline: "2026-12-01", urgency: "MEDIUM", status: "PENDING_VERIFICATION", verificationStatus: "AI_VERIFIED",
        verificationScore: 92, verificationSummary: "AI-assisted prototype analysis — information internally consistent.",
        raisedAmount: 0, location: "Mumbai, Maharashtra",
        createdAt: "2026-08-12T09:00:00Z", hospitalVerifiedAt: null, approvedAt: null,
        documents: [{ name: "ultrasound_report.pdf", type: "Medical Report" }, { name: "surgery_estimate.pdf", type: "Cost Estimate" }],
        milestones: [{ label: "Surgery & day-care", amount: 200000, status: "PENDING" }],
        disbursements: []
      }
    ],
    donations: [
      { id: "DON-RBY-2026-001", transactionId: "TXN-RBY-2026-000121", caseId: "CASE-RBY-1001", donorLabel: "Anonymous • 98g8", amount: 50000, method: "UPI", status: "SETTLED", timestamp: "2026-05-20T10:12:00Z", blockHash: "0x8f4a33e29bc09711" },
      { id: "DON-RBY-2026-002", transactionId: "TXN-RBY-2026-000122", caseId: "CASE-RBY-1001", donorLabel: "Anonymous • 21kk", amount: 25000, method: "Card", status: "SETTLED", timestamp: "2026-05-22T14:03:00Z", blockHash: "0x1c9e77d14acbf102" },
      { id: "DON-RBY-2026-003", transactionId: "TXN-RBY-2026-000123", caseId: "CASE-RBY-1001", donorLabel: "Anonymous • 55mz", amount: 100000, method: "Net Banking", status: "SETTLED", timestamp: "2026-05-28T09:44:00Z", blockHash: "0xbb41520f8e90012a" },
      { id: "DON-RBY-2026-004", transactionId: "TXN-RBY-2026-000124", caseId: "CASE-RBY-1002", donorLabel: "Anonymous • 77qw", amount: 75000, method: "UPI", status: "SETTLED", timestamp: "2026-06-10T11:30:00Z", blockHash: "0xd0a8c33b91e4f021" },
      { id: "DON-RBY-2026-005", transactionId: "TXN-RBY-2026-000125", caseId: "CASE-RBY-1002", donorLabel: "Anonymous • 31jd", amount: 15000, method: "UPI", status: "ESCROW", timestamp: "2026-06-15T18:21:00Z", blockHash: "0x55bc9210a1e44d0c" },
      { id: "DON-RBY-2026-006", transactionId: "TXN-RBY-2026-000126", caseId: "CASE-RBY-1003", donorLabel: "Anonymous • 09pl", amount: 150000, method: "Card", status: "SETTLED", timestamp: "2026-07-12T08:15:00Z", blockHash: "0xe4f02911c3bb0745" },
      { id: "DON-RBY-2026-007", transactionId: "TXN-RBY-2026-000127", caseId: "CASE-RBY-1003", donorLabel: "Anonymous • 44yx", amount: 85000, method: "UPI", status: "ESCROW", timestamp: "2026-07-14T16:05:00Z", blockHash: "0x8a9b6c55d0f1e233" },
      { id: "DON-RBY-2026-008", transactionId: "TXN-RBY-2026-000128", caseId: "CASE-RBY-1004", donorLabel: "Anonymous • 18hc", amount: 40000, method: "Net Banking", status: "SETTLED", timestamp: "2026-06-25T12:40:00Z", blockHash: "0x71d2fe89a0b33411" },
      { id: "DON-RBY-2026-009", transactionId: "TXN-RBY-2026-000129", caseId: "CASE-RBY-1005", donorLabel: "Anonymous • 66nb", amount: 90000, method: "UPI", status: "SETTLED", timestamp: "2026-07-05T10:55:00Z", blockHash: "0x03aa22b77c91d0e8" },
      { id: "DON-RBY-2026-010", transactionId: "TXN-RBY-2026-000130", caseId: "CASE-RBY-1005", donorLabel: "Anonymous • 82gf", amount: 45000, method: "Card", status: "ESCROW", timestamp: "2026-07-08T13:22:00Z", blockHash: "0x9f1c3e04ab2d77c9" }
    ],
    verifications: [
      { id: "VER-1001", caseId: "CASE-RBY-1001", type: "AI", score: 94, status: "LOW_RISK", flags: [], summary: "Submitted information appears internally consistent.", recommendation: "Proceed to hospital verification.", timestamp: "2026-05-14T09:35:00Z" },
      { id: "VER-1002", caseId: "CASE-RBY-1001", type: "HOSPITAL", score: 100, status: "VERIFIED", flags: [], summary: "Hospital confirmed diagnosis, treatment plan and cost estimate.", recommendation: "Eligible for approval by RUBY admin.", timestamp: "2026-05-15T14:00:00Z" },
      { id: "VER-1003", caseId: "CASE-RBY-1002", type: "AI", score: 91, status: "LOW_RISK", flags: [], summary: "Submitted information appears internally consistent.", recommendation: "Proceed to hospital verification.", timestamp: "2026-06-02T10:20:00Z" },
      { id: "VER-1004", caseId: "CASE-RBY-1002", type: "HOSPITAL", score: 100, status: "VERIFIED", flags: [], summary: "Oncology department confirmed treatment plan.", recommendation: "Eligible for approval by RUBY admin.", timestamp: "2026-06-03T16:20:00Z" },
      { id: "VER-1005", caseId: "CASE-RBY-1003", type: "AI", score: 96, status: "LOW_RISK", flags: [], summary: "Emergency admission corroborated; insurance cover verified.", recommendation: "Proceed to hospital verification.", timestamp: "2026-07-10T13:45:00Z" },
      { id: "VER-1006", caseId: "CASE-RBY-1003", type: "HOSPITAL", score: 100, status: "VERIFIED", flags: [], summary: "Trauma unit confirmed emergency procedures.", recommendation: "Eligible for approval by RUBY admin.", timestamp: "2026-07-10T18:10:00Z" },
      { id: "VER-1007", caseId: "CASE-RBY-1005", type: "AI", score: 93, status: "LOW_RISK", flags: [], summary: "Paediatric records internally consistent.", recommendation: "Proceed to hospital verification.", timestamp: "2026-07-01T09:25:00Z" },
      { id: "VER-1008", caseId: "CASE-RBY-1005", type: "HOSPITAL", score: 100, status: "VERIFIED", flags: [], summary: "Cardiology records confirm VSD.", recommendation: "Eligible for approval by RUBY admin.", timestamp: "2026-07-02T10:30:00Z" }
    ]
  };

  return {
    DB_KEY, SESSION_KEY, RUPID_KEY, DRAFT_APPEAL_KEY, SELECTED_CASE_KEY, LAST_DONATION_KEY,

    getAll() { return structuredClone(this.getDB()); },
    getDB() {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        try { return JSON.parse(raw); } catch { /* ignore and reseed */ }
      }
      const fresh = structuredClone(DEMO_DATA);
      localStorage.setItem(DB_KEY, JSON.stringify(fresh));
      return fresh;
    },
    saveDB(db) {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    },

    collection(name) {
      const db = this.getDB();
      if (!db[name]) db[name] = [];
      return db[name];
    },

    add(name, item) {
      const db = this.getDB();
      if (!db[name]) db[name] = [];
      db[name].push(item);
      this.saveDB(db);
      return item;
    },
    update(name, id, patch) {
      const db = this.getDB();
      const list = db[name] || [];
      const idx = list.findIndex((x) => x.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch };
      this.saveDB(db);
      return list[idx];
    },
    find(name, id) {
      const db = this.getDB();
      return (db[name] || []).find((x) => x.id === id) || null;
    },

    getSession() {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    setSession(s) {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    },
    getRupid() { return localStorage.getItem(RUPID_KEY); },
    setRupid(v) { localStorage.setItem(RUPID_KEY, v); },
    getDraftAppeal() { try { return JSON.parse(localStorage.getItem(DRAFT_APPEAL_KEY)); } catch { return null; } },
    setDraftAppeal(v) { localStorage.setItem(DRAFT_APPEAL_KEY, JSON.stringify(v)); },
    clearDraftAppeal() { localStorage.removeItem(DRAFT_APPEAL_KEY); },
    getSelectedCaseId() { return localStorage.getItem(SELECTED_CASE_KEY); },
    setSelectedCaseId(v) { localStorage.setItem(SELECTED_CASE_KEY, v); },
    getLastDonation() { try { return JSON.parse(localStorage.getItem(LAST_DONATION_KEY)); } catch { return null; } },
    setLastDonation(v) { localStorage.setItem(LAST_DONATION_KEY, JSON.stringify(v)); },

    resetDemo() {
      localStorage.removeItem(DB_KEY);
      return this.getDB();
    }
  };
})();

/* ---------- Money & formatting helpers (INR) ---------- */
function inr(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
}
function inrCompact(n) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function initials(name, n = 2) {
  if (!name) return "??";
  return name.split(/\s+/).filter(Boolean).slice(0, n).map((p) => p[0].toUpperCase()).join("");
}