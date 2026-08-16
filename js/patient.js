/* ============================================================
   RUBY — RUPID registration wizard.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const panels = document.querySelectorAll(".step-panel");
  let currentStep = 1;
  let uploadFile = null;
  let generatedRupid = null;
  let generatedPatient = null;

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
    document.querySelector("#stepper").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const collectStep1 = () => ({
    fullName: document.getElementById("fullName").value.trim(),
    dob: document.getElementById("dob").value,
    age: Number(document.getElementById("age").value) || 0,
    mobile: document.getElementById("mobile").value.trim(),
    email: document.getElementById("email").value.trim(),
    address: document.getElementById("address").value.trim(),
    communityId: document.getElementById("communityId").value.trim()
  });

  const validateStep1 = () => {
    const f1 = document.getElementById("step-1");
    const errors = Validator.validateForm(f1, {
      fullName: ["required", "Full name is required."],
      dob: ["required", "Date of birth is required."],
      age: ["required", "Age is required."],
      mobile: (v) => !/^(\+91)?[6-9]\d{9}$/.test(String(v).replace(/[\s-]/g, "")) && "Enter a valid Indian mobile number (e.g. +91 98XXXXXX00).",
      email: ["email", "Enter a valid email address."],
      address: ["minLen5", "Enter a valid address."]
    });
    Validator.showFormSummary(f1, errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const f2 = document.getElementById("step-2");
    const errors = Validator.validateForm(f2, {
      idType: ["required", "Select an identity document type."],
      idNumber: ["minLen5", "Enter a valid document number (min 5 characters)."],
      consent: ["consent", "Please consent to prototype verification."]
    });
    if (!uploadFile) {
      errors.upload = "Please upload a document (PDF, JPG or PNG, max 5 MB).";
      Validator.setInputError(document.getElementById("idUpload"), errors.upload);
    } else {
      Validator.clearInputError(document.getElementById("idUpload"));
    }
    Validator.showFormSummary(f2, errors);
    return Object.keys(errors).length === 0;
  };

  const collectIdentity = () => ({
    idType: document.getElementById("idType").value,
    idNumber: document.getElementById("idNumber").value.trim(),
    document: uploadFile ? { name: uploadFile.name, type: uploadFile.type, size: uploadFile.size } : null
  });

  /* ---- file upload ----
  */
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("idUpload");
  const uploadHint = document.getElementById("upload-hint");
  const uploadError = document.getElementById("upload-error");

  const setUploadError = (msg) => {
    if (msg) {
      uploadError.textContent = msg;
      uploadError.classList.add("visible");
      dropArea.classList.add("border-error");
    } else {
      uploadError.classList.remove("visible");
      dropArea.classList.remove("border-error");
    }
  };

  const acceptFile = (file) => {
    const okTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (file && okTypes.includes(file.type) && file.size <= 5 * 1024 * 1024) {
      uploadFile = file;
      uploadHint.textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
      setUploadError("");
    } else {
      uploadFile = null;
      uploadHint.textContent = "PDF, JPG, PNG · Max 5 MB";
      setUploadError("Unsupported file type or file larger than 5 MB.");
    }
  };

  if (dropArea && fileInput) {
    ["dragenter", "dragover"].forEach((ev) => dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add("border-secondary"); }));
    ["dragleave", "drop"].forEach((ev) => dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.remove("border-secondary"); }));
    dropArea.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length) acceptFile(e.dataTransfer.files[0]);
    });
    dropArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => { if (fileInput.files.length) acceptFile(fileInput.files[0]); });
  }

  /* ---- OTP ----
  */
  const otpInputs = Array.from(document.querySelectorAll("[data-otp]"));
  otpInputs.forEach((input, idx) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 1);
      if (input.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) otpInputs[idx - 1].focus();
    });
  });

  const fillOtp = document.querySelector("[data-fill-otp]");
  if (fillOtp) {
    fillOtp.addEventListener("click", () => {
      "123456".split("").forEach((d, i) => { otpInputs[i].value = d; });
      RubyUI.toast("info", "Demo OTP filled: 123456");
    });
  }

  const getOtp = () => otpInputs.map((i) => i.value).join("");

  /* ---- Wizard navigation ----
  */
  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const from = Number(btn.dataset.next);
      if (from === 1 && !validateStep1()) return;
      if (from === 2 && !validateStep2()) return;
      showStep(from + 1);
    });
  });
  document.querySelectorAll("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => showStep(Number(btn.dataset.prev) - 1));
  });

  /* ---- OTP submit ----
  */
  document.querySelector("[data-otp-submit]").addEventListener("click", async (btn) => {
    const otp = getOtp();
    if (otp.length !== 6) {
      RubyUI.toast("error", "Please enter the 6-digit OTP.");
      return;
    }
    if (otp !== "123456") {
      RubyUI.toast("error", "Incorrect OTP. In demo mode use 123456.");
      otpInputs.forEach((i) => { i.value = ""; });
      otpInputs[0].focus();
      return;
    }
    RubyUI.toast("success", "OTP verified ✓");
    showStep(4);
    runVerification(btn);
  });

  /* ---- Simulated verification timeline ----
  */
  async function runVerification() {
    const steps = document.querySelectorAll("[data-ver]");
    steps.forEach((s) => s.querySelector(".tl-dot").classList.remove("done", "active"));

    const marks = ["Identity Submitted", "Document Checked", "Information Matched", "Verification Complete"];
    for (let i = 0; i < steps.length; i++) {
      steps[i].querySelector(".tl-dot").classList.add("active");
      await wait(700 + i * 250);
      steps[i].querySelector(".tl-dot").classList.remove("active");
      steps[i].querySelector(".tl-dot").classList.add("done");
      if (i < marks.length) RubyUI.toast("info", marks[i]);
    }
    // Run registration (backend-first, local fallback)
    const data = collectStep1();
    const identity = collectIdentity();
    const payload = { ...data, ...identity };
    try {
      const res = await API.registerPatient({ fullName: data.fullName, email: data.email, mobile: data.mobile, age: data.age });
      generatedRupid = res.rupId || Storage.getRupid();
      generatedPatient = res.patient || null;
    } catch (e) {
      generatedRupid = Storage.getRupid() || `RBY-${Math.floor(1000 + Math.random() * 8999)}-${rand4()}-${rand2()}`;
      RubyUI.toast("info", "Backend unavailable — generated RUPID locally.");
    }

    // Create/refresh a patient session so the dashboard works
    const patient = generatedPatient || {
      id: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
      rupId: generatedRupid,
      name: data.fullName,
      email: data.email,
      phone: data.mobile,
      age: data.age,
      verificationStatus: "VERIFIED",
      verificationScore: 96,
      createdAt: new Date().toISOString()
    };
    if (!Storage.find("patients", patient.id)) {
      Storage.add("patients", patient);
    }
    Storage.setRupid(generatedRupid);
    Storage.setSession({ role: "patient", name: data.fullName, email: data.email, rupId: generatedRupid, patientId: patient.id });

    // Render step 5
    document.getElementById("gen-rup-id").textContent = generatedRupid;
    document.getElementById("gen-score").textContent = "96 / 100";
    document.getElementById("gen-created").textContent = fmtDate(new Date().toISOString());
    document.getElementById("gen-validity").textContent = "12 months";
    showStep(5);
    RubyUI.toast("success", `RUPID ${generatedRupid} generated ✓`);
  }

  function rand4() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 4 }).map(() => c[Math.floor(Math.random() * c.length)]).join(""); }
  function rand2() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 2 }).map(() => c[Math.floor(Math.random() * c.length)]).join(""); }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Auto-compute age from DOB
  const dobEl = document.getElementById("dob");
  if (dobEl) {
    dobEl.addEventListener("change", () => {
      const d = new Date(dobEl.value);
      if (!Number.isNaN(d.getTime())) {
        const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
        if (age >= 1 && age <= 120) document.getElementById("age").value = age;
      }
    });
  }
});