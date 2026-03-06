export function initAdminNewsletterPage(apiBaseUrl: string): void {
  const root = document.documentElement;
  if (root.dataset.adminNewsletterPageInitialized === "1") return;
  root.dataset.adminNewsletterPageInitialized = "1";

  const renderAudiences = (audiences: unknown) => {
    const select = document.getElementById("audience");
    if (!(select instanceof HTMLSelectElement)) return;
    const options = Array.isArray(audiences) ? audiences : [];
    if (options.length === 0) return;

    select.innerHTML = "";
    options.forEach((audience) => {
      const option = document.createElement("option");
      option.value = String((audience as { key?: string })?.key || "");
      option.textContent = `${String((audience as { label?: string })?.label || "")} (${Number((audience as { count?: number })?.count || 0)})`;
      select.appendChild(option);
    });
  };

  const renderMailStatus = (mailStatus: unknown) => {
    if (!mailStatus || typeof mailStatus !== "object") return;
    const configured = Boolean((mailStatus as { is_configured?: boolean }).is_configured);
    const mailerEl = document.getElementById("mail-status-mailer");
    const hostEl = document.getElementById("mail-status-host");
    const fromNameEl = document.getElementById("mail-status-from-name");
    const fromAddressEl = document.getElementById("mail-status-from-address");
    if (!(mailerEl instanceof HTMLElement)) return;
    if (!(hostEl instanceof HTMLElement)) return;
    if (!(fromNameEl instanceof HTMLElement)) return;
    if (!(fromAddressEl instanceof HTMLElement)) return;

    mailerEl.textContent = String((mailStatus as { mailer?: string }).mailer || "-");
    hostEl.textContent = `${String((mailStatus as { host?: string }).host || "-")} : ${String((mailStatus as { port?: string }).port || "-")}`;
    fromNameEl.textContent = String((mailStatus as { from_name?: string }).from_name || "-");
    fromAddressEl.textContent = String((mailStatus as { from_address?: string }).from_address || "-");

    const stateBox = document.getElementById("mail-status-state-box");
    const state = document.getElementById("mail-status-state");
    if (!(stateBox instanceof HTMLElement) || !(state instanceof HTMLElement)) return;

    stateBox.className = configured
      ? "border border-green-200 bg-green-50 rounded-lg p-4"
      : "border border-amber-200 bg-amber-50 rounded-lg p-4";
    state.className = configured
      ? "text-sm font-semibold mt-1 text-green-800"
      : "text-sm font-semibold mt-1 text-amber-800";
    state.textContent = configured ? "Настроено" : "Проверьте MAIL_FROM_ADDRESS в .env";
  };

  const renderTemplates = (templates: unknown) => {
    const container = document.getElementById("system-templates");
    if (!(container instanceof HTMLElement)) return;
    container.innerHTML = "";
    const entries = Object.entries((templates as Record<string, string>) || {});
    if (entries.length === 0) {
      container.innerHTML = `
          <div class="border border-gray-200 rounded-lg p-3">
            <p class="text-sm text-gray-500">Шаблоны не найдены</p>
          </div>
        `;
      return;
    }

    entries.forEach(([key, label]) => {
      const card = document.createElement("div");
      card.className = "border border-gray-200 rounded-lg p-3";
      card.innerHTML = `
          <p class="text-sm font-medium text-slate-800">${String(label || "")}</p>
          <p class="text-xs text-gray-500 mt-1">Ключ: ${key}</p>
        `;
      container.appendChild(card);
    });
  };

  (async () => {
    const res = await fetch(`${apiBaseUrl}/admin/newsletter`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return;
    const payload = await res.json().catch(() => ({}));
    renderAudiences(payload?.audiences);
    renderMailStatus(payload?.mailStatus);
    renderTemplates(payload?.systemTemplates);
  })().catch(() => undefined);

  const testForm = document.getElementById("newsletter-test");
  if (testForm instanceof HTMLFormElement) {
    testForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(testForm);
      const body = {
        test_email: String(data.get("test_email") || "").trim(),
        subject: String(data.get("subject") || "").trim(),
        content: String(data.get("content") || "").trim(),
      };

      const res = await fetch(`${apiBaseUrl}/admin/newsletter/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      alert(payload?.message || (res.ok ? "Запрос отправлен" : "Ошибка"));
    });
  }

  const campaignForm = document.getElementById("newsletter-campaign");
  if (campaignForm instanceof HTMLFormElement) {
    campaignForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(campaignForm);
      const body = {
        audience: String(data.get("audience") || "").trim(),
        subject: String(data.get("subject") || "").trim(),
        content: String(data.get("content") || "").trim(),
      };

      const res = await fetch(`${apiBaseUrl}/admin/newsletter/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      alert(payload?.message || (res.ok ? "Запрос отправлен" : "Ошибка"));
    });
  }
}
