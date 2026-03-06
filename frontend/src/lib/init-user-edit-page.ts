import { initCityAutocomplete } from "./dadata-autocomplete";

export function initUserEditPage(apiBaseUrl: string, s3BaseUrl: string): void {
  const formEl = document.getElementById("user-edit-form");
  if (!(formEl instanceof HTMLFormElement)) return;
  if (formEl.dataset.userEditPageInitialized === "1") return;
  formEl.dataset.userEditPageInitialized = "1";

  const fallback = document.getElementById("user-avatar-fallback");
  const preview = document.getElementById("user-avatar-preview");
  const avatarInput = document.getElementById("avatar");
  const cancelLink = document.getElementById("user-edit-cancel");

  let currentUserId = 0;

  const resolveS3Url = (path: string | null | undefined): string | null => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${s3BaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  };

  const splitName = (name: string) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return {
      last: parts[0] || "",
      first: parts[1] || "",
      middle: parts.slice(2).join(" "),
    };
  };

  const setInputValue = (id: string, value: string) => {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = value || "";
    }
  };

  const initForm = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include" });
      if (!res.ok) return;
      const me = await res.json();
      currentUserId = Number(me?.id || 0);
      const { last, first, middle } = splitName(me?.name || "");

      setInputValue("last_name", last);
      setInputValue("first_name", first);
      setInputValue("middle_name", middle);
      setInputValue("email", me?.email || "");
      setInputValue("country", me?.country || "");
      setInputValue("region", me?.region || "");
      
      // Если есть сохраненный город, показываем его вместе с регионом (если есть)
      if (me?.city) {
        const cityDisplay = me.region 
          ? `${me.city}, ${me.region}`
          : me.city;
        setInputValue("city", cityDisplay);
        // Сохраняем оригинальное значение города в скрытое поле
        setInputValue("city_hidden", me.city);
      } else {
        setInputValue("city", "");
        setInputValue("city_hidden", "");
      }

      if (me?.avatar && preview instanceof HTMLImageElement && fallback instanceof HTMLElement) {
        const resolved = resolveS3Url(me.avatar);
        if (resolved) {
          preview.src = resolved;
          preview.classList.remove("hidden");
          fallback.classList.add("hidden");
        }
      } else if (fallback instanceof HTMLElement) {
        fallback.textContent = String(me?.name || "U").trim().slice(0, 2).toUpperCase() || "U";
      }

      if (cancelLink instanceof HTMLAnchorElement && currentUserId > 0) {
        cancelLink.href = `/user/id${currentUserId}`;
      }
    } catch {
      // no-op
    }
  };

  // Инициализируем автокомплит для города независимо от загрузки данных
  // Используем несколько попыток, чтобы убедиться, что DOM готов
  const initAutocomplete = () => {
    const cityInput = document.getElementById("city");
    if (!cityInput) {
      // Если поле еще не загружено, пробуем еще раз
      setTimeout(initAutocomplete, 100);
      return;
    }
    
    initCityAutocomplete("city", apiBaseUrl, {
      hiddenInputs: {
        country: "country",
        region: "region",
        city: "city_hidden",
      },
      onSelect: (data) => {
        setInputValue("country", data.country);
        setInputValue("region", data.region);
        // city уже установлен через hiddenInputs
      },
    });
  };
  
  // Пробуем инициализировать сразу и через небольшую задержку
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAutocomplete);
  } else {
    setTimeout(initAutocomplete, 50);
  }

  if (avatarInput instanceof HTMLInputElement) {
    avatarInput.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const file = target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (!(preview instanceof HTMLImageElement) || !(fallback instanceof HTMLElement)) return;
        preview.src = String(reader.result || "");
        preview.classList.remove("hidden");
        fallback.classList.add("hidden");
      };
      reader.readAsDataURL(file);
    });
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(formEl);
    data.set("first_name", String(data.get("first_name") || "").trim());
    data.set("last_name", String(data.get("last_name") || "").trim());
    data.set("middle_name", String(data.get("middle_name") || "").trim());
    data.set("email", String(data.get("email") || "").trim());
    data.set("country", String(data.get("country") || "").trim());
    data.set("region", String(data.get("region") || "").trim());
    // Используем скрытое поле city_hidden, если оно есть, иначе видимое поле city
    const cityHidden = String(data.get("city_hidden") || "").trim();
    const cityVisible = String(data.get("city") || "").trim();
    // Если city_hidden пустой, но cityVisible содержит запятую (город, регион),
    // извлекаем только город (часть до запятой)
    let cityValue = cityHidden;
    if (!cityValue && cityVisible) {
      // Если есть запятая, берем часть до запятой (город)
      cityValue = cityVisible.includes(",") 
        ? cityVisible.split(",")[0].trim()
        : cityVisible;
    }
    data.set("city", cityValue);

    try {
      const res = await fetch(`${apiBaseUrl}/users/me`, {
        method: "PUT",
        credentials: "include",
        body: data,
      });

      if (!res.ok) {
        const text = await res.text();
        alert(`Ошибка обновления профиля: ${text}`);
        return;
      }

      const payload = await res.json().catch(() => null);
      const userId = Number(payload?.user?.id || currentUserId || 0);
      if (userId > 0) {
        window.location.href = `/user/id${userId}`;
        return;
      }
      window.location.href = "/";
    } catch {
      alert("Ошибка связи с сервером");
    }
  });

  void initForm();
}
