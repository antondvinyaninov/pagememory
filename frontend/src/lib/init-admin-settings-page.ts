export function initAdminSettingsPage(apiBaseUrl: string): void {
  const form = document.getElementById("settings-form");
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.adminSettingsPageInitialized === "1") return;
  form.dataset.adminSettingsPageInitialized = "1";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body = {
      general: {
        site_name: String(data.get("site_name") || "").trim(),
        site_tagline: String(data.get("site_tagline") || "").trim(),
      },
      access: {
        allow_registration: data.has("allow_registration"),
        enable_memorial_creation: data.has("enable_memorial_creation"),
        enable_memories: data.has("enable_memories"),
        enable_comments: data.has("enable_comments"),
      },
    };

    const res = await fetch(`${apiBaseUrl}/admin/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      alert(`Ошибка сохранения настроек: ${text}`);
      return;
    }
    alert("Настройки сохранены");
  });
}
