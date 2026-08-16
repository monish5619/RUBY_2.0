/* ============================================================
   RUBY — client-side validation helpers.
   ============================================================ */
const Validator = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RUPID_RE = /^RBY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/i;
  const IND_PHONE_RE = /^(\+91)?[6-9]\d{9}$/;

  const isIndianMobile = (v) => IND_PHONE_RE.test(String(v).replace(/[\s-]/g, ""));

  const rules = {
    required: (v) => (v === undefined || v === null || String(v).trim() === ""),
    email: (v) => !EMAIL_RE.test(String(v).trim()),
    phone: (v) => !isIndianMobile(v),
    rupid: (v) => !RUPID_RE.test(String(v).trim()),
    minAmount: (v, min = 100) => Number(v) < min,
    maxAmount: (v, max = 5000000) => Number(v) > max,
    age: (v) => Number(v) < 1 || Number(v) > 120,
    minLen: (v, n = 20) => String(v || "").trim().length < n,
    minLen5: (v) => String(v || "").trim().length < 5,
    futureDate: (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) || d <= new Date(); },
    fileType: (file) => { const ok = ["application/pdf", "image/jpeg", "image/png"].includes(file.type); return !ok; },
    fileSize: (file, maxMB = 5) => file.size > maxMB * 1024 * 1024,
    consent: (v) => !v
  };

  /* Validate a form against a field map.
     fields: { fieldName: [validators..., errorMessage] }  OR
             { fieldName: { test: fn, message: string, value?: string } }
  */
  function validateForm(form, fieldDefs) {
    const errors = {};
    Object.keys(fieldDefs).forEach((name) => {
      const spec = fieldDefs[name];
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      let value = input.value;
      let valid = true;
      const pushError = (msg) => {
        valid = false;
        errors[name] = msg;
        setInputError(input, msg);
      };
      if (Array.isArray(spec)) {
        const [vn, msg] = spec;
        // vn can be a key or a function
        if (typeof vn === "function") {
          if (vn(value)) pushError(msg);
        } else if (rules[vn] && rules[vn](value)) {
          pushError(msg);
        } else if (vn === "fileType" || vn === "fileSize") {
          const file = input.files && input.files[0];
          if (file) { if (rules.fileType(file)) pushError(msg); }
        }
      } else if (typeof spec === 'object' && spec.test) {
        if (spec.test(value, input)) pushError(spec.message);
      } else if (typeof spec === "function") {
        const res = spec(value, input);
        if (res) pushError(res);
      }
      if (valid) clearInputError(input);
    });
    return errors;
  }

  function setInputError(input, message) {
    input.classList.add("input-error");
    const parent = input.closest(".field, .form-group") || input.parentElement;
    let msgEl = parent && parent.querySelector && parent.querySelector(".form-error-msg");
    if (!msgEl) return;
    msgEl.textContent = message;
    msgEl.classList.add("visible");
    input.setAttribute("aria-invalid", "true");
    if (!parent.querySelector('[aria-live="assertive"]')) parent.setAttribute("aria-live", "assertive");
  }

  function clearInputError(input) {
    input.classList.remove("input-error");
    input.removeAttribute("aria-invalid");
    const parent = input.closest(".field, .form-group") || input.parentElement;
    if (parent) {
      const msgEl = parent.querySelector(".form-error-msg");
      if (msgEl) msgEl.classList.remove("visible");
    }
  }

  function clearAllErrors(form) {
    form.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
    form.querySelectorAll(".form-error-msg.visible").forEach((el) => el.classList.remove("visible"));
  }

  function showFormSummary(form, errors) {
    const box = form.querySelector("[data-errors-summary]");
    if (!box) return;
    const messages = Object.values(errors);
    if (messages.length === 0) {
      box.classList.add("hidden");
      box.innerHTML = "";
    } else {
      box.classList.remove("hidden");
      box.innerHTML = `<div class="flex items-start gap-2 text-error"><span class="material-symbols-outlined text-[18px]">error_outline</span><div><strong>Please review the following:</strong><ul class="list-disc ml-5 mt-1 text-sm">${messages.map((m) => `<li>${m}</li>`).join("")}</ul></div></div>`;
      box.setAttribute("tabindex", "-1");
      box.focus();
    }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  return { rules, validateForm, setInputError, clearInputError, clearAllErrors, showFormSummary, escapeHtml };
})();