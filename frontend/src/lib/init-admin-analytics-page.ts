export function initAdminAnalyticsPage(apiBaseUrl: string): void {
  const form = document.getElementById("analytics-form");
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.adminAnalyticsPageInitialized === "1") return;
  form.dataset.adminAnalyticsPageInitialized = "1";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body = {
      gtm_id: String(data.get("gtm_id") || "").trim(),
    };

    const res = await fetch(`${apiBaseUrl}/admin/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      alert(`Ошибка сохранения: ${text}`);
      return;
    }

    alert("Настройки аналитики сохранены");
  });
}
