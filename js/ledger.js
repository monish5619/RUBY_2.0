/* ============================================================
   RUBY — transparency ledger.
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const search = document.getElementById("ledger-search");
  const status = document.getElementById("ledger-status");
  const rows = document.getElementById("ledger-rows");
  let txs = [];

  const loadingRow = () => `<tr><td colspan="7" class="p-8">${RubyUI.skeleton(2)}</td></tr>`;
  rows.innerHTML = loadingRow();

  try {
    txs = await API.getTransactions();
    if (!Array.isArray(txs)) txs = [];
  } catch {
    rows.innerHTML = `<tr><td colspan="7">${RubyUI.errorState({ icon: "cloud_off", title: "Could not load the ledger", text: "Check the backend connection and try again." })}</td></tr>`;
    return;
  }

  const total = txs.reduce((s, t) => s + Number(t.amount || 0), 0);
  const escrow = txs.filter((t) => t.status === "ESCROW").reduce((s, t) => s + Number(t.amount), 0);
  const disbursed = txs.filter((t) => t.status === "SETTLED").reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById("ledger-total").textContent = inr(total);
  document.getElementById("ledger-escrow").textContent = inr(escrow);
  document.getElementById("ledger-disbursed").textContent = inr(disbursed);

  function shortHash(h) {
    if (!h) return "—";
    return h.length > 18 ? `${h.slice(0, 9)}…${h.slice(-4)}` : h;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const st = status.value;
    const list = txs.filter((t) => {
      const donor = t.donorName || t.donor || "";
      const hay = `${t.transactionId} ${t.caseId} ${donor} ${t.recipient}`.toLowerCase();
      return (!st || t.status === st) && (!q || hay.includes(q));
    });
    if (!list.length) {
      rows.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-on-surface-variant">No matching ledger entries.</td></tr>`;
      return;
    }
    rows.innerHTML = list.map((t) => `
      <tr class="border-t border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
        <td class="p-4 font-data-mono text-secondary">${RubyUI.esc(t.transactionId)}</td>
        <td class="p-4 font-data-mono">${RubyUI.esc(t.caseId)}</td>
        <td class="p-4">${RubyUI.esc(t.donorName || t.donor)}</td>
        <td class="p-4 text-right font-data-mono font-bold">${inr(t.amount)}</td>
        <td class="p-4">${RubyUI.statusBadge(t.status)}</td>
        <td class="p-4 font-data-mono text-[11px] text-on-surface-variant" title="${RubyUI.esc(t.blockHash || "")}">${shortHash(t.blockHash)}</td>
        <td class="p-4 font-data-mono text-[12px] text-on-surface-variant">${fmtDateTime(t.timestamp)}</td>
      </tr>`).join("");
  }

  search.addEventListener("input", render);
  status.addEventListener("change", render);
  render();
});
