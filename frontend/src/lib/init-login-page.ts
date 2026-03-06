export function initLoginPage(apiBaseUrl: string): void {
  const root = document.getElementById("auth-root");
  if (!(root instanceof HTMLElement)) return;
  if (root.dataset.loginPageInitialized === "1") return;
  root.dataset.loginPageInitialized = "1";

  const modeButtons = root.querySelectorAll("[data-auth-mode-btn]");
  const panels = root.querySelectorAll("[data-auth-panel]");

  const setMode = (mode: string) => {
    modeButtons.forEach((btn) => {
      const value = btn.getAttribute("data-auth-mode-btn");
      if (value === mode) {
        btn.classList.add("bg-red-500", "text-white");
        btn.classList.remove("text-slate-600");
      } else {
        btn.classList.remove("bg-red-500", "text-white");
        btn.classList.add("text-slate-600");
      }
    });

    panels.forEach((panel) => {
      const value = panel.getAttribute("data-auth-panel");
      panel.classList.toggle("hidden", value !== mode);
    });
  };

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-auth-mode-btn");
      if (mode === "login" || mode === "register") {
        setMode(mode);
      }
    });
  });

  setMode("login");

  const form = document.getElementById("login-form");
  if (form instanceof HTMLFormElement) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const body = {
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      };

      try {
        const res = await fetch(`${apiBaseUrl}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Login failed", text);
          alert("Неверный логин или пароль");
          return;
        }

        const payload = await res.json().catch(() => null);
        const userId = Number(payload?.user?.id || payload?.id || 0);
        if (userId > 0) {
          window.location.href = `/user/id${userId}`;
          return;
        }
        window.location.href = "/";
      } catch (error) {
        console.error(error);
        alert("Ошибка связи с сервером авторизации");
      }
    });
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm instanceof HTMLFormElement) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(registerForm);
      const body = {
        first_name: String(data.get("first_name") || ""),
        last_name: String(data.get("last_name") || ""),
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
        password_confirmation: String(data.get("password_confirmation") || ""),
      };

      try {
        const res = await fetch(`${apiBaseUrl}/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Register failed", text);
          alert(`Ошибка регистрации: ${text}`);
          return;
        }

        const payload = await res.json().catch(() => null);
        const userId = Number(payload?.user?.id || payload?.id || 0);
        if (userId > 0) {
          window.location.href = `/user/id${userId}`;
          return;
        }
        window.location.href = "/";
      } catch (error) {
        console.error(error);
        alert("Ошибка связи с сервером регистрации");
      }
    });
  }
}
