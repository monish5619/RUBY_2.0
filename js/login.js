/* ============================================================
   RUBY — login.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");

  document.querySelectorAll(".demo-login").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("login-email").value = btn.dataset.email;
      document.getElementById("login-password").value = btn.dataset.pass;
      form.querySelector('button[type="submit"]').focus();
      RubyUI.toast("info", `Filled ${btn.dataset.email}`);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    Validator.clearAllErrors(form);
    const errors = Validator.validateForm(form, {
      email: ["email", "Enter a valid email."],
      password: (v) => (!v ? "Password is required." : false)
    });
    Validator.showFormSummary(form, errors);
    if (Object.keys(errors).length) return;

    const btn = form.querySelector('button[type="submit"]');
    RubyUI.setLoading(btn, true, "Signing in…");
    try {
      const session = await Auth.login(document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
      RubyUI.toast("success", `Welcome back, ${session.name}`);
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") ? next : Auth.dashboardUrl();
    } catch (err) {
      RubyUI.setLoading(btn, false);
      RubyUI.toast("error", err.message || "Sign in failed.");
    }
  });
});