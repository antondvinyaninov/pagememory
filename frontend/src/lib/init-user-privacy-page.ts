export function initUserPrivacyPage(apiBaseUrl: string): void {
  const form = document.getElementById("privacy-form");
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.userPrivacyPageInitialized === "1") return;
  form.dataset.userPrivacyPageInitialized = "1";

  const hydrate = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include" });
      if (!res.ok) return;
      const me = await res.json();

      const type = me?.profile_type === "private" ? "private" : "public";
      const typeInput = document.querySelector(`input[name="profile_type"][value="${type}"]`);
      if (typeInput instanceof HTMLInputElement) typeInput.checked = true;

      const showEmail = document.querySelector('input[name="show_email"]');
      if (showEmail instanceof HTMLInputElement && typeof me?.show_email === "boolean") {
        showEmail.checked = me.show_email;
      }

      const showMemorials = document.querySelector('input[name="show_memorials"]');
      if (showMemorials instanceof HTMLInputElement && typeof me?.show_memorials === "boolean") {
        showMemorials.checked = me.show_memorials;
      }
    } catch {
      // ignore
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body = {
      profile_type: String(data.get("profile_type") || "public"),
      show_email: data.has("show_email"),
      show_memorials: data.has("show_memorials"),
    };

    try {
      const res = await fetch(`${apiBaseUrl}/users/me/privacy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        alert(`Ошибка сохранения настроек: ${text}`);
        return;
      }

      alert("Настройки приватности сохранены");
    } catch {
      alert("Ошибка связи с сервером");
    }
  });

  void hydrate();
}
