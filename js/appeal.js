/* ============================================================
   RUBY — fund appeal wizard (8 steps).
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const panels = document.querySelectorAll(".step-panel");
  let currentStep = 1;
  const docs = {}; // docType -> file

  const showStep = (n) => {
    currentStep = n;
    panels.forEach((p) => p.classList.add("hidden"));
    const target = document.getElementById(`step-${n}`);
    if (target) target.classList.remove("hidden");
    document.querySelectorAll("#stepper .step-dot, #stepper .step-line").forEach((el) => {
      const step = Number(el.dataset.step);
      el.classList.remove("active", "done");
      if (step < n) el.classList.add("done");
      else if (step === n) el.classList.add("active");
    });
    if (n === 8) renderReview();
    document.querySelector("#stepper").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* Prefill from patient session */
  const session = Auth.session();
  if (session && session.role === "patient") {
    if (session.rupId) document.getElementById("a-rupId").value = session.rupId;
    if (session.name) document.getElementById("a-patientName").value = session.name;
    if (session.email) document.getElementById("a-contact").value = session.email;
  }

  /* Populate hospitals */
  const hospitalSelect = document.getElementById("a-hospital");
  try {
    const hospitals = await API.getHospitals();
    hospitals.filter((h) => h.partnerStatus === "active").forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h.id;
      opt.textContent = h.name;
      hospitalSelect.appendChild(opt);
    });
    if (session && session.role === "patient" && session.name && !document.getElementById("a-patientName").value) {
      document.getElementById("a-patientName").value = session.name;
    }
  } catch { /* fallback: static options */ }

  /* Auto-calc required amount */
  const calcRequired = () => {
    const target = Number(document.getElementById("a-target").value) || 0;
    const avail = Number(document.getElementById("a-available").value) || 0;
    const ins = Number(document.getElementById("a-insurance").value) || 0;
    const req = Math.max(0, target - avail - ins);
    document.getElementById("a-required").value = req > 0 ? req : "";
  };
  ["a-target", "a-available", "a-insurance"].forEach((id) => {
    document.getElementById(id).addEventListener("input", calcRequired);
  });

  /* Document slots */
  document.querySelectorAll(".doc-slot").forEach((slot) => {
    const drop = slot.querySelector(".doc-drop");
    const input = slot.querySelector("input[type=file]");
    const type = slot.dataset.docType;
    const required = slot.dataset.required === "1";
    drop.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files[0];
      const ok = file && ["application/pdf", "image/jpeg", "image/png"].includes(file.type) && file.size <= 5 * 1024 * 1024;
      if (!ok) {
        docs[type] = undefined;
        slot.querySelector(".doc-name").textContent = "Invalid file. Use PDF/JPG/PNG ≤ 5 MB.";
        slot.querySelector(".doc-name").style.color = "#ba1a1a";
        return;
      }
      docs[type] = file;
      slot.querySelector(".doc-name").textContent = `✓ ${file.name}`;
      slot.querySelector(".doc-name").style.color = "#0d4f1b";
    });
  });

  /* Validation */
  const vStep1 = () => {
    const f = document.getElementById("step-1");
    const errors = Validator.validateForm(f, {
      rupId: ["rupid", "Enter a valid RUPID (e.g. RBY-XXXX-XXXX-XX)."],
      patientName: ["required", "Full name is required."],
      age: ["age", "Enter a valid age."],
      patientEmail: (v) => !(/\S+@\S+\.\S{2,}/.test(v) || /^(\+91)?[6-9]\d{9}$/.test(String(v).replace(/[\s-]/g, ""))) && "Enter a valid email or Indian mobile number."
    });
    Validator.showFormSummary(f, errors);
    return Object.keys(errors).length === 0;
  };
  const vStep2 = () => {
    const f = document.getElementById("step-2");
    const errors = Validator.validateForm(f, {
      hospitalId: ["required", "Select an attending hospital."],
      department: ["required", "Department is required."],
      doctor: ["required", "Attending doctor is required."],
      caseNumber: ["minLen5", "Enter the hospital case / admission ID."]
    });
    Validator.showFormSummary(f, errors);
    return Object.keys(errors).length === 0;
  };
  const vStep3 = () => {
    const f = document.getElementById("step-3");
    const errors = Validator.validateForm(f, {
      diagnosis: ["required", "Diagnosis is required."],
      treatment: ["required", "Treatment is required."],
      estimatedTreatmentCost: (v) => (!(Number(v) > 0) ? "Enter the estimated treatment cost." : false),
      treatmentDuration: ["required", "Treatment duration is required."]
    });
    Validator.showFormSummary(f, errors);
    return Object.keys(errors).length === 0;
  };
  const vStep4 = () => {
    const f = document.getElementById("step-4");
    const errors = Validator.validateForm(f, {
      targetAmount: (v) => (!(Number(v) > 0) ? "Enter a target amount." : false),
      amountRequired: (v) => (!(Number(v) >= 0) ? "Amount required is invalid." : false),
      deadline: (v) => (!v ? "Select a treatment deadline." : false)
    });
    Validator.showFormSummary(f, errors);
    return Object.keys(errors).length === 0;
  };
  const vStep5 = () => {
    const f = document.getElementById("step-5");
    const errors = Validator.validateForm(f, {
      story: ["minLen", "Please write a fuller medical story (min 20 characters)."],
      fundingUsage: ["minLen5", "Describe how funds will be used."]
    });
    Validator.showFormSummary(f, errors);
    return Object.keys(errors).length === 0;
  };
  const vStep6 = () => {
    const requiredTypes = ["Medical Report", "Cost Estimate"];
    const missing = requiredTypes.filter((t) => !docs[t]);
    if (missing.length) {
      RubyUI.toast("error", `Please upload: ${missing.join(", ")}`);
      return false;
    }
    return true;
  };
  const vStep7 = () => {
    const f = document.getElementById("step-7");
    const errors = Validator.validateForm(f, { consent: ["consent", "Please provide authorization consent."] });
    Validator.showFormSummary(f, errors);
    return Object.keys(errors).length === 0;
  };

  const validators = { 1: vStep1, 2: vStep2, 3: vStep3, 4: vStep4, 5: vStep5, 6: vStep6, 7: vStep7 };

  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const from = Number(btn.dataset.next);
      const fn = validators[from];
      if (fn && !fn()) return;
      showStep(from + 1);
    });
  });
  document.querySelectorAll("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => showStep(Number(btn.dataset.prev) - 1));
  });

  /* Review render */
  function renderReview() {
    const box = document.getElementById("review-summary");
    const val = (id) => document.getElementById(id).value.trim();
    const hospName = hospitalSelect.options[hospitalSelect.selectedIndex]?.text || "—";
    const rows = [
      ["Patient", `${val("a-patientName")} (${val("a-age")} yrs) · ${val("a-rupId")}`],
      ["Contact", val("a-contact")],
      ["Hospital", `${hospName} · ${val("a-department")} · ${val("a-doctor")}`],
      ["Case ID", val("a-caseNumber")],
      ["Diagnosis", val("a-diagnosis")],
      ["Treatment", `${val("a-treatment")}${val("a-procedure") ? " — " + val("a-procedure") : ""}`],
      ["Est. cost", inr(val("a-estCost"))],
      ["Target", inr(val("a-target"))],
      ["Available", inr(val("a-available"))],
      ["Insurance", inr(val("a-insurance"))],
      ["Required", inr(val("a-required"))],
      ["Deadline", fmtDate(val("a-deadline"))],
      ["Urgency", val("a-urgency")],
      ["Story", val("a-story")],
      ["Fund usage", val("a-fundUsage")],
      ["Documents", Object.entries(docs).filter(([, f]) => f).map(([t, f]) => `${t} (${f.name})`).join(", ") || "—"]
    ];
    box.innerHTML = rows.map(([k, v]) => `
      <div class="border-b border-outline-variant/40 pb-3">
        <dt class="font-label-caps text-label-caps text-on-surface-variant">${k}</dt>
        <dd class="font-body-md text-body-md mt-0.5">${RubyUI.esc(v) || "—"}</dd>
      </div>`).join("");
  }

  /* Submit */
  document.getElementById("appeal-submit-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const hospId = document.getElementById("a-hospital").value;
    const hospName = hospitalSelect.options[hospitalSelect.selectedIndex]?.text || "";
    const payload = {
      rupId: document.getElementById("a-rupId").value.trim(),
      patientName: document.getElementById("a-patientName").value.trim(),
      age: Number(document.getElementById("a-age").value),
      patientEmail: document.getElementById("a-contact").value.trim(),
      hospitalId: hospId,
      hospitalName: hospName,
      department: document.getElementById("a-department").value.trim(),
      doctor: document.getElementById("a-doctor").value.trim(),
      caseNumber: document.getElementById("a-caseNumber").value.trim(),
      diagnosis: document.getElementById("a-diagnosis").value.trim(),
      treatment: document.getElementById("a-treatment").value.trim(),
      procedure: document.getElementById("a-procedure").value.trim(),
      estimatedTreatmentCost: Number(document.getElementById("a-estCost").value),
      treatmentDuration: document.getElementById("a-duration").value.trim(),
      targetAmount: Number(document.getElementById("a-target").value),
      amountAlreadyAvailable: Number(document.getElementById("a-available").value) || 0,
      insuranceCoverage: Number(document.getElementById("a-insurance").value) || 0,
      amountRequired: Number(document.getElementById("a-required").value) || 0,
      story: document.getElementById("a-story").value.trim(),
      fundingUsage: document.getElementById("a-fundUsage").value.trim(),
      deadline: document.getElementById("a-deadline").value,
      urgency: document.getElementById("a-urgency").value,
      location: (hospName && hospName.includes(",") ? hospName.split(",").pop().trim() : "India"),
      documents: Object.entries(docs).filter(([, f]) => f).map(([t, f]) => ({ name: f.name, type: t })),
      patientId: session && session.patientId ? session.patientId : null
    };

    RubyUI.setLoading(btn, true, "Submitting…");
    try {
      const created = await API.createAppeal(payload);
      const appealId = created.appealId || (created.appeal && created.appeal.id);
      let aiResult = null;
      try {
        const submitted = await API.submitAppeal(appealId);
        aiResult = submitted.verification || submitted;
      } catch { /* AI step failed gracefully */ }

      // Save draft linkage
      const createdAppeal = created.appeal || Storage.find("appeals", appealId);
      if (createdAppeal) {
        Storage.setDraftAppeal({ caseId: appealId, rupId: payload.rupId, createdAt: new Date().toISOString(), aiResult });
      }

      // Render success panel
      document.getElementById("appeal-form-wrap").classList.add("hidden");
      document.getElementById("appeal-success").classList.remove("hidden");
      document.getElementById("su-case-id").textContent = appealId;
      document.getElementById("su-status").innerHTML = RubyUI.statusBadge("VERIFICATION_PENDING");
      document.getElementById("su-track").href = `/pages/verification.html?case=${encodeURIComponent(appealId)}`;
      document.querySelector("#appeal-success").scrollIntoView({ behavior: "smooth" });

      const aiBox = document.getElementById("su-ai");
      if (aiResult && aiResult.verificationScore !== undefined) {
        const flags = (aiResult.flags || []).length;
        aiBox.innerHTML = `
          <div class="rounded-2xl border ${aiResult.status === "LOW_RISK" ? "border-tertiary-container/30 bg-tertiary-container/5" : "border-error/30 bg-error-container/30"} p-5">
            <div class="flex items-center justify-between mb-3">
              ${RubyUI.aiLabel()}
              ${RubyUI.statusBadge(aiResult.status)}
            </div>
            <div class="flex items-center gap-3 mb-3">
              <div class="w-16 h-16 rounded-full bg-surface-container-lowest border-2 border-secondary flex items-center justify-center"><span class="font-data-mono text-[18px] font-bold text-secondary">${aiResult.verificationScore}</span></div>
              <div class="text-[13px] text-on-surface-variant"><p class="font-semibold text-on-surface">Score / 100</p><p>Risk: ${aiResult.riskScore}</p></div>
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
              <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Identity consistency</span>
              <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Hospital info</span>
              <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Treatment info</span>
              <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Funding calculation</span>
            </div>
            ${flags ? `<p class="text-[13px] text-error mb-2">${aiResult.flags.map((f) => "• " + RubyUI.esc(f)).join("<br/>")}</p>` : ""}
            <p class="text-[13px] text-on-surface-variant">${RubyUI.esc(aiResult.summary || "")}</p>
            <p class="text-[12px] font-semibold text-tertiary-container mt-2">Recommendation: ${RubyUI.esc(aiResult.recommendation || "Proceed to human review.")}</p>
            <p class="text-[11px] text-on-surface-variant mt-3"><span class="material-symbols-outlined text-[14px] align-middle">info</span> AI-assisted prototype analysis — not a medical or legal decision.</p>
          </div>`;
      } else {
        aiBox.innerHTML = `<p class="text-[13px] text-on-surface-variant">AI analysis could not be completed right now — the appeal is queued for manual review. (Backend offline)</p>`;
      }
      RubyUI.toast("success", `Appeal ${appealId} submitted ✓`);
    } catch (e) {
      RubyUI.setLoading(btn, false);
      RubyUI.toast("error", e.message || "Submission failed — please try again.");
    }
  });
});