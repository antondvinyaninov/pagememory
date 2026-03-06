export function initUserSecurityPage(apiBaseUrl: string): void {
  const form = document.getElementById("security-form");
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.userSecurityPageInitialized === "1") return;
  form.dataset.userSecurityPageInitialized = "1";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body = {
      current_password: String(data.get("current_password") || ""),
      password: String(data.get("password") || ""),
      password_confirmation: String(data.get("password_confirmation") || ""),
    };

    if (body.password !== body.password_confirmation) {
      alert("Пароли не совпадают");
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/users/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        alert(`Ошибка изменения пароля: ${text}`);
        return;
      }

      form.reset();
      alert("Пароль успешно обновлен");
    } catch {
      alert("Ошибка связи с сервером");
    }
  });
}
