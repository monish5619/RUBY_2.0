/* ============================================================
   RUBY — donor flow (donor → payment → success).
   ============================================================ */
const DonorFlow = (() => {
  const FEE_RATE = 0.03;
  const INTENT_KEY = "ruby:donationIntent";

  function getIntent() { try { return JSON.parse(localStorage.getItem(INTENT_KEY)); } catch { return null; } }
  function setIntent(v) { localStorage.setItem(INTENT_KEY, JSON.stringify(v)); }
  function clearIntent() { localStorage.removeItem(INTENT_KEY); }

  function donorLabel() {
    const s = Auth.session();
    const rnd = Math.random().toString(36).slice(2, 6);
    return s && s.role === "donor" ? `Donor • ${rnd}` : `Anonymous • ${rnd}`;
  }

  return { FEE_RATE, getIntent, setIntent, clearIntent, donorLabel };
})();

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  /* ===================== DONOR PAGE ===================== */
  if (page === "donor") initDonor();

  async function initDonor() {
    const params = new URLSearchParams(window.location.search);
    let caseId = params.get("case");
    let current = null;
    const amountInput = document.getElementById("donor-amount");
    const reviewBox = document.getElementById("donor-review");

    const caseBox = document.getElementById("donor-case");
    const loadCase = async (id) => {
      caseBox.innerHTML = RubyUI.skeleton(4);
      let c = null;
      try { c = await API.getCase(id); } catch { /* not found */ }
      if (!c) {
        caseBox.innerHTML = `<p class="text-error text-[14px]">Case not found. <a class="underline" href="/pages/cases.html">Browse cases</a></p>`;
        return null;
      }
      current = c;
      const pct = RubyUI.progressPct(c.raisedAmount, c.targetAmount);
      caseBox.innerHTML = `
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center font-bold">${initials(c.patientName)}</div>
          <div class="flex-1 min-w-0">
            <p class="font-headline-md text-[16px]">${RubyUI.esc(c.patientName)} · ${c.age} yrs</p>
            <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(c.id)}</p>
            <p class="font-body-sm text-[13px] text-on-surface-variant mt-1">${RubyUI.esc(c.treatment)}</p>
            <p class="font-body-sm text-[13px] text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">local_hospital</span>${RubyUI.esc(c.hospitalName)}</p>
          </div>
          <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">verified</span>Verified</span>
        </div>
        <div class="mt-4">
          ${RubyUI.progressBar(c.raisedAmount, c.targetAmount)}
          <div class="flex justify-between text-[12px] text-on-surface-variant mt-1"><span class="font-data-mono font-bold text-on-surface">${inr(c.raisedAmount)}</span><span>of ${inr(c.targetAmount)}</span></div>
        </div>`;
      renderReview();
      return c;
    };

    if (caseId) await loadCase(caseId);
    else {
      caseBox.innerHTML = `<p class="text-on-surface-variant text-[14px]">No case selected yet. <a class="text-secondary font-semibold" href="/pages/cases.html">Browse verified cases</a>.</p>`;
    }

    document.getElementById("donor-case-load").addEventListener("click", async () => {
      const v = document.getElementById("donor-case-input").value.trim();
      if (!v) { RubyUI.toast("error", "Enter a case ID."); return; }
      caseId = v;
      const c = await loadCase(v);
      if (c) RubyUI.toast("success", `Case ${c.id} loaded`);
    });

    /* amount presets */
    let selectedAmount = 1000;
    const setAmount = (val) => {
      selectedAmount = val;
      amountInput.value = val;
      amountInput.classList.remove("input-error");
      document.querySelectorAll(".amount-btn").forEach((b) => {
        const active = Number(b.dataset.amount) === val;
        b.className = `amount-btn ${active ? "border-2 border-primary bg-primary/5 font-bold text-primary" : "border border-outline-variant hover:bg-secondary/10 hover:border-secondary"} rounded-xl py-3 font-data-mono text-data-mono transition-all`;
      });
      renderReview();
    };
    document.querySelectorAll(".amount-btn").forEach((b) => b.addEventListener("click", () => setAmount(Number(b.dataset.amount))));
    amountInput.addEventListener("input", () => {
      const v = Number(amountInput.value);
      if (v >= 100) setAmount(v);
      else renderReview();
    });

    /* review */
    function renderReview() {
      const amount = Math.max(0, Number(amountInput.value) || 0);
      const fee = Math.round(amount * DonorFlow.FEE_RATE);
      reviewBox.innerHTML = `
        <div class="flex justify-between"><dt class="text-on-surface-variant">Donation amount</dt><dd class="font-data-mono font-bold">${inr(amount)}</dd></div>
        <div class="flex justify-between"><dt class="text-on-surface-variant">Platform fee (3%)</dt><dd class="font-data-mono text-on-surface-variant">${inr(fee)}</dd></div>
        <div class="flex justify-between border-t border-outline-variant/40 pt-3"><dt class="font-semibold">Total to pay</dt><dd class="font-data-mono font-bold text-primary">${inr(amount)}</dd></div>
        <div class="flex justify-between"><dt class="text-on-surface-variant">Recipient case</dt><dd class="font-data-mono">${current ? RubyUI.esc(current.id) : "—"}</dd></div>
        <div class="flex justify-between"><dt class="text-on-surface-variant">Hospital</dt><dd class="text-right">${current ? RubyUI.esc(current.hospitalName) : "—"}</dd></div>
        <p class="text-[12px] text-on-surface-variant">Funds are held in prototype escrow until a verified medical milestone is completed. Donor identity is kept anonymous.</p>`;
    }

    document.getElementById("donor-continue").addEventListener("click", () => {
      const amount = Number(amountInput.value);
      if (!current) { RubyUI.toast("error", "Please select a case first."); return; }
      if (!(amount >= 100)) {
        RubyUI.toast("error", "Minimum donation is ₹100.");
        amountInput.classList.add("input-error");
        return;
      }
      if (amount > 5000000) { RubyUI.toast("error", "Amount exceeds the ₹50,00,000 limit."); return; }
      DonorFlow.setIntent({ caseId: current.id, amount, donorLabel: DonorFlow.donorLabel() });
      RubyUI.toast("success", "Donation details saved — proceeding to payment.");
      window.location.href = "/pages/payment.html";
    });

    /* ledger ticker */
    const ticker = document.getElementById("ledger-ticker");
    try {
      const txs = await API.getTransactions();
      ticker.innerHTML = txs.slice(0, 4).map((t) => `
        <div class="flex items-center justify-between text-[13px] border-b border-white/10 pb-2">
          <div><p class="font-data-mono text-secondary-fixed-dim">${inr(t.amount)}</p><p class="text-[11px] text-surface/60">settled to ${RubyUI.esc(t.recipient)} · ${RubyUI.esc(t.caseId)}</p></div>
          <span class="text-[11px] status-badge disbursed">${t.disbursementStatus.includes("DISBURSED") ? "Settled" : "Escrow"}</span>
        </div>`).join("");
    } catch {
      ticker.innerHTML = `<p class="text-[13px] text-surface/60">Ledger unavailable.</p>`;
    }
  }

  /* ===================== PAYMENT PAGE ===================== */
  if (page === "payment") initPayment();

  async function initPayment() {
    const intent = DonorFlow.getIntent();
    if (!intent) {
      document.querySelector("#payment-panel").innerHTML = `<p class="text-center text-on-surface-variant py-16">No donation in progress. <a class="text-secondary" href="/pages/cases.html">Find a case to support</a>.</p>`;
      return;
    }

    let current = null;
    try { current = await API.getCase(intent.caseId); } catch { /* ignore */ }

    document.getElementById("pay-amount").textContent = inr(intent.amount);
    document.getElementById("pay-case").textContent = current ? current.id : intent.caseId;
    document.getElementById("pay-hospital").textContent = current ? current.hospitalName : "—";
    document.getElementById("pay-fee").textContent = inr(Math.round(intent.amount * DonorFlow.FEE_RATE));
    document.getElementById("pay-submit-amount").textContent = inr(intent.amount);

    /* method tabs */
    let method = "UPI";
    document.querySelectorAll(".pay-method").forEach((btn) => {
      btn.addEventListener("click", () => {
        method = btn.dataset.method;
        document.querySelectorAll(".pay-method").forEach((b) => {
          const on = b === btn;
          b.className = `pay-method ${on ? "border-2 border-primary bg-primary/5" : "border border-outline-variant hover:border-secondary/50"} rounded-xl py-4 flex flex-col items-center gap-1 transition-all`;
        });
        document.querySelectorAll(".method-panel").forEach((p) => p.classList.add("hidden"));
        const panel = document.getElementById(`method-${method.replace(/\s+/g, "-")}`);
        if (panel) panel.classList.remove("hidden");
      });
    });

    /* card formatting */
    const cardNum = document.getElementById("card-number");
    if (cardNum) cardNum.addEventListener("input", () => {
      cardNum.value = cardNum.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
    });
    const expiry = document.getElementById("card-expiry");
    if (expiry) expiry.addEventListener("input", () => {
      let v = expiry.value.replace(/\D/g, "").slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
      expiry.value = v;
    });

    /* submit */
    document.getElementById("payment-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      Validator.clearAllErrors(form);
      const errors = {};
      if (method === "UPI") {
        const upi = document.getElementById("upi-id").value.trim();
        if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
          errors.upiId = "Enter a valid UPI ID (e.g. name@bank).";
          Validator.setInputError(document.getElementById("upi-id"), errors.upiId);
        }
      } else if (method === "Card") {
        const cn = document.getElementById("card-number").value.replace(/\s/g, "");
        if (!/^\d{16}$/.test(cn)) { errors.cardNumber = "Enter the 16-digit card number."; Validator.setInputError(document.getElementById("card-number"), errors.cardNumber); }
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(document.getElementById("card-expiry").value)) { errors.cardExpiry = "Use MM/YY format."; Validator.setInputError(document.getElementById("card-expiry"), errors.cardExpiry); }
        if (!/^\d{3,4}$/.test(document.getElementById("card-cvv").value)) { errors.cardCvv = "Enter the 3-4 digit CVV."; Validator.setInputError(document.getElementById("card-cvv"), errors.cardCvv); }
        if (!document.getElementById("card-name").value.trim()) { errors.cardName = "Enter the name on card."; Validator.setInputError(document.getElementById("card-name"), errors.cardName); }
      } else {
        if (!document.getElementById("bank").value) { errors.bank = "Select a bank."; Validator.setInputError(document.getElementById("bank"), errors.bank); }
      }
      if (Object.keys(errors).length) {
        RubyUI.toast("error", "Please correct the highlighted fields.");
        return;
      }

      document.getElementById("payment-panel").classList.add("hidden");
      document.getElementById("processing-panel").classList.remove("hidden");
      document.querySelector("#processing-panel").scrollIntoView({ behavior: "smooth" });

      // animate steps
      const dots = document.querySelectorAll("#processing-steps .tl-dot");
      const stepPromise = (async () => {
        for (let i = 0; i < dots.length; i++) {
          dots[i].classList.add("done");
          await new Promise((r) => setTimeout(r, 900));
        }
      })();

      let result = null;
      try {
        const payment = await API.createPayment({ amount: intent.amount, method, caseId: intent.caseId });
        result = await API.confirmPayment({ paymentId: payment.paymentId, caseId: intent.caseId, amount: intent.amount, method, donorLabel: intent.donorLabel });
      } catch (e) {
        document.getElementById("processing-panel").classList.add("hidden");
        document.getElementById("payment-panel").classList.remove("hidden");
        RubyUI.toast("error", e.message || "Payment failed — please try again.");
        return;
      }

      await stepPromise;
      const receipt = result.receipt || {};
      Storage.setLastDonation({
        transactionId: receipt.transactionId || result.transactionId || "—",
        caseId: intent.caseId,
        amount: intent.amount,
        method,
        timestamp: receipt.timestamp || new Date().toISOString(),
        status: "ESCROW",
        blockHash: receipt.blockHash || "0x",
        donorLabel: intent.donorLabel,
        hospitalName: current ? current.hospitalName : "—",
        platformFee: Math.round(intent.amount * DonorFlow.FEE_RATE)
      });
      DonorFlow.clearIntent();
      RubyUI.toast("success", "Payment successful ✓");
      window.location.href = "/pages/success.html";
    });
  }

  /* ===================== SUCCESS PAGE ===================== */
  if (page === "success") initSuccess();

  function initSuccess() {
    const last = Storage.getLastDonation();
    const box = document.getElementById("receipt");
    if (!last || !last.transactionId) {
      box.innerHTML = `<p class="text-center text-on-surface-variant py-10">No recent donation found.</p>`;
      return;
    }
    const shortHash = last.blockHash && last.blockHash.length > 12 ? last.blockHash.slice(0, 10) + "…" : last.blockHash;
    box.innerHTML = `
      <div class="flex items-center justify-between mb-6 pb-5 border-b border-outline-variant/40">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center"><span class="material-symbols-outlined">receipt_long</span></div>
          <div><h2 class="font-headline-md text-headline-md">Donation Receipt</h2><p class="font-body-sm text-[12px] text-on-surface-variant">RUBY · Test environment</p></div>
        </div>
        <span class="status-badge escrow"><span class="material-symbols-outlined text-[13px]">lock</span>Escrow</span>
      </div>
      <dl class="space-y-3 text-[14px]">
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Transaction ID</dt><dd class="font-data-mono font-bold text-right break-all">${RubyUI.esc(last.transactionId)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Case ID</dt><dd class="font-data-mono text-right">${RubyUI.esc(last.caseId)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Recipient hospital</dt><dd class="text-right">${RubyUI.esc(last.hospitalName || "—")}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Amount</dt><dd class="font-data-mono font-bold text-primary text-[18px]">${inr(last.amount)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Payment method</dt><dd class="text-right">${RubyUI.esc(last.method || "UPI")}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Platform fee</dt><dd class="font-data-mono text-right">${inr(last.platformFee || 0)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Timestamp</dt><dd class="font-data-mono text-right">${fmtDateTime(last.timestamp)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-on-surface-variant">Prototype block</dt><dd class="font-data-mono text-right text-secondary break-all">${RubyUI.esc(shortHash)}</dd></div>
      </dl>
      <div class="mt-6 rounded-xl bg-surface-container p-4 text-[12px] text-on-surface-variant">
        <span class="material-symbols-outlined text-secondary align-middle text-[16px] mr-1">info</span>
        Prototype ledger entry — a simulated block hash, not a real blockchain transaction. Funds sit in demo escrow until the hospital verifies a medical milestone.
      </div>`;

    document.getElementById("back-to-case").href = `/pages/case-details.html?id=${encodeURIComponent(last.caseId)}`;
  }
});