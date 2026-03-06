import { initCityAutocomplete } from "./dadata-autocomplete";

export function initMemorialEditor(): void {
      const root = document.querySelector("[data-memorial-editor]");
      if (!root) return;
      if (root.dataset.editorInitialized === "1") return;
      root.dataset.editorInitialized = "1";

      const tabs = ["basic", "biography", "burial", "media", "people", "settings", "qrcode"];
      const mode = root.dataset.mode || "create";
      const memorialId = root.dataset.memorialId || "";
      const apiBaseUrl = root.dataset.apiBaseUrl || "/api";
      const s3BaseUrl = root.dataset.s3BaseUrl || "https://s3.firstvds.ru/memory";
      const yandexMapsApiKey = root.dataset.yandexMapsApiKey || "";
      const appBaseUrl = root.dataset.appBaseUrl || "";
      const currentPhoto = root.dataset.currentPhoto || "";

      let activeTab = "basic";

      const setActive = (tab) => {
        activeTab = tab;
        tabs.forEach((name) => {
          root.querySelectorAll(`[data-tab-btn=\"${name}\"]`).forEach((btn) => {
            btn.classList.toggle("bg-red-50", name === tab);
            btn.classList.toggle("text-red-600", name === tab);
            btn.classList.toggle("text-gray-700", name !== tab);
          });

          const panel = root.querySelector(`[data-tab-panel=\"${name}\"]`);
          if (panel) panel.classList.toggle("hidden", name !== tab);
        });

        if (tab === "qrcode") {
          renderQRCode();
        }
        if (tab === "people" && mode === "edit" && memorialId) {
          loadPeopleTab();
        }
      };

      const loadPeopleTab = async () => {
        if (!memorialId) return;
        const relationshipSelect = root.querySelector("#creator_relationship") as HTMLSelectElement | null;
        const relationshipCustomContainer = root.querySelector("#creator_relationship_custom_container") as HTMLElement | null;
        const relationshipCustomInput = root.querySelector("#creator_relationship_custom") as HTMLInputElement | null;
        const peopleList = root.querySelector("#people-list") as HTMLElement | null;
        const peopleCount = root.querySelector("#people-count") as HTMLElement | null;

        try {
          // Загружаем текущую связь пользователя
          const relationshipRes = await fetch(`${apiBaseUrl}/memorials/${memorialId}/relationship`, {
            credentials: "include",
          });
          if (relationshipRes.ok) {
            const relationshipData = await relationshipRes.json();
            if (relationshipData.relationship && relationshipSelect) {
              relationshipSelect.value = relationshipData.relationship.relationship_type || "";
              if (relationshipData.relationship.relationship_type === "other" && relationshipCustomInput) {
                relationshipCustomInput.value = relationshipData.relationship.custom_relationship || "";
                if (relationshipCustomContainer) {
                  relationshipCustomContainer.classList.remove("hidden");
                }
              }
            }
          }

          // Загружаем список близких людей (включая текущего пользователя)
          const peopleRes = await fetch(`${apiBaseUrl}/memorials/${memorialId}/people`, {
            credentials: "include",
          });
          if (peopleRes.ok && peopleList && peopleCount) {
            const peopleData = await peopleRes.json();
            const people = peopleData.people || [];
            // Исключаем текущего пользователя из подсчета для отображения
            const otherPeople = people.filter((p: any) => !p.is_current_user);
            peopleCount.textContent = String(otherPeople.length);

            // Показываем текущего пользователя отдельно, если у него есть связь
            const currentUserPerson = people.find((p: any) => p.is_current_user);
            
            let html = "";
            
            // Показываем текущего пользователя первым, если у него есть связь
            if (currentUserPerson) {
              const relationshipLabels: Record<string, string> = {
                husband: "Муж",
                wife: "Жена",
                father: "Отец",
                mother: "Мать",
                son: "Сын",
                daughter: "Дочь",
                brother: "Брат",
                sister: "Сестра",
                grandfather: "Дедушка",
                grandmother: "Бабушка",
                grandson: "Внук",
                granddaughter: "Внучка",
                uncle: "Дядя",
                aunt: "Тетя",
                nephew: "Племянник",
                niece: "Племянница",
                relative: "Родственник",
                friend_male: "Друг",
                friend_female: "Подруга",
                colleague: "Коллега",
                neighbor: "Сосед",
                classmate: "Одноклассник",
                coursemate: "Однокурсник",
              };
              
              const relationshipLabel =
                currentUserPerson.relationship_type === "other"
                  ? currentUserPerson.custom_relationship || "Другое"
                  : relationshipLabels[currentUserPerson.relationship_type || ""] || currentUserPerson.relationship_type || "Не указано";
              
              const resolveAvatarUrl = (path: string | null, name: string) => {
                if (path) {
                  if (path.startsWith("http://") || path.startsWith("https://")) return path;
                  return `${s3BaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
                }
                const fallbackName = (name || "User").trim() || "User";
                return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&size=128&background=e3f2fd&color=1976d2&bold=true`;
              };
              
              const avatarUrl = resolveAvatarUrl(currentUserPerson.user_avatar, currentUserPerson.user_name);
              
              html += `
                <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p class="text-xs text-blue-600 mb-2 font-medium">Ваша связь</p>
                  <div class="flex items-center gap-3">
                    <img 
                      src="${avatarUrl}" 
                      alt="${escapeHtml(currentUserPerson.user_name)}"
                      class="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <h4 class="font-semibold text-slate-700">${escapeHtml(currentUserPerson.user_name)}</h4>
                      <p class="text-sm text-gray-600">${escapeHtml(relationshipLabel)}</p>
                    </div>
                  </div>
                </div>
              `;
            }
            
            if (otherPeople.length === 0) {
              html += `
                <div class="text-center py-8 text-gray-400">
                  <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <p class="text-sm">Пока нет других близких людей</p>
                  <p class="text-xs mt-2">Люди могут добавить свою связь оставив воспоминание</p>
                </div>
              `;
            } else {
              const relationshipLabels: Record<string, string> = {
                husband: "Муж",
                wife: "Жена",
                father: "Отец",
                mother: "Мать",
                son: "Сын",
                daughter: "Дочь",
                brother: "Брат",
                sister: "Сестра",
                grandfather: "Дедушка",
                grandmother: "Бабушка",
                grandson: "Внук",
                granddaughter: "Внучка",
                uncle: "Дядя",
                aunt: "Тетя",
                nephew: "Племянник",
                niece: "Племянница",
                relative: "Родственник",
                friend_male: "Друг",
                friend_female: "Подруга",
                colleague: "Коллега",
                neighbor: "Сосед",
                classmate: "Одноклассник",
                coursemate: "Однокурсник",
              };

              const resolveAvatarUrl = (path: string | null, name: string) => {
                if (path) {
                  if (path.startsWith("http://") || path.startsWith("https://")) return path;
                  return `${s3BaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
                }
                const fallbackName = (name || "User").trim() || "User";
                return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&size=128&background=e3f2fd&color=1976d2&bold=true`;
              };

              html += otherPeople
                .map((person: any) => {
                  const relationshipLabel =
                    person.relationship_type === "other"
                      ? person.custom_relationship || "Другое"
                      : relationshipLabels[person.relationship_type || ""] || person.relationship_type || "Не указано";
                  const avatarUrl = resolveAvatarUrl(person.user_avatar, person.user_name);
                  const confirmedClass = person.confirmed
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700";
                  const confirmedText = person.confirmed ? "Подтверждено" : "Ожидает подтверждения";

                  return `
                    <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div class="flex items-center gap-3">
                        <a href="${appBaseUrl}/user/id${person.user_id}">
                          <img 
                            src="${avatarUrl}" 
                            alt="${person.user_name}"
                            class="w-12 h-12 rounded-lg object-cover hover:opacity-80 transition-opacity"
                          />
                        </a>
                        <div>
                          <a href="${appBaseUrl}/user/id${person.user_id}" class="hover:underline">
                            <h4 class="font-semibold text-slate-700">${escapeHtml(person.user_name)}</h4>
                          </a>
                          <p class="text-sm text-gray-600">${escapeHtml(relationshipLabel)}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs px-2 py-1 rounded ${confirmedClass}">
                          ${confirmedText}
                        </span>
                      </div>
                    </div>
                  `;
                })
                .join("");
            }
            
            peopleList.innerHTML = html;
          }
        } catch (error) {
          console.error("Error loading people tab:", error);
          if (peopleList) {
            peopleList.innerHTML = `
              <div class="text-center py-8 text-red-400">
                <p class="text-sm">Ошибка загрузки данных</p>
              </div>
            `;
          }
        }
      };

      const escapeHtml = (text: string) => {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      };

      // Обработка изменения типа связи
      const relationshipSelect = root.querySelector("#creator_relationship") as HTMLSelectElement | null;
      const relationshipCustomContainer = root.querySelector("#creator_relationship_custom_container") as HTMLElement | null;
      const relationshipCustomInput = root.querySelector("#creator_relationship_custom") as HTMLInputElement | null;

      if (relationshipSelect && relationshipCustomContainer && relationshipCustomInput) {
        relationshipSelect.addEventListener("change", () => {
          if (relationshipSelect.value === "other") {
            relationshipCustomContainer.classList.remove("hidden");
            relationshipCustomInput.required = true;
          } else {
            relationshipCustomContainer.classList.add("hidden");
            relationshipCustomInput.required = false;
            relationshipCustomInput.value = "";
          }
        });
      }

      root.querySelectorAll("[data-tab-btn]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.getAttribute("data-tab-btn");
          if (tab && tabs.includes(tab)) setActive(tab);
        });
      });

      const photoInput = root.querySelector("#photo");
      const photoPreview = root.querySelector("#photo-preview");
      const photoPlaceholder = root.querySelector("#photo-placeholder");

      if (photoInput && photoPreview && photoPlaceholder) {
        photoInput.addEventListener("change", (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            photoPreview.src = String(reader.result || "");
            photoPreview.classList.remove("hidden");
            photoPlaceholder.classList.add("hidden");
          };
          reader.readAsDataURL(file);
        });
      }

      const form = root.querySelector("#memorial-form");
      const draftBtn = root.querySelector("#memorial-draft");
      const publishBtn = root.querySelector("#memorial-publish");
      const actionInput = root.querySelector("#memorial-action");
      const formMessage = root.querySelector("#memorial-form-message");
      const formMessageTitle = root.querySelector("#memorial-form-message-title");
      const formMessageList = root.querySelector("#memorial-form-message-list");

      const fieldConfig = {
        action: { tab: "basic", selector: "#memorial-draft", label: "Способ сохранения" },
        last_name: { tab: "basic", selector: "#last_name", label: "Фамилия" },
        first_name: { tab: "basic", selector: "#first_name", label: "Имя" },
        birth_date: { tab: "basic", selector: "#birth_date", label: "Дата рождения" },
        death_date: { tab: "basic", selector: "#death_date", label: "Дата смерти" },
        privacy: { tab: "settings", selector: "input[name='privacy']", label: "Приватность" },
        confirm_responsibility: {
          tab: "settings",
          selector: "input[name='confirm_responsibility']",
          label: "Подтверждение достоверности",
        },
      };

      const labelToField = {
        Фамилия: "last_name",
        Имя: "first_name",
        "Дата рождения": "birth_date",
        "Дата смерти": "death_date",
        Приватность: "privacy",
      };

      const resolveS3Url = (path) => {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return `${s3BaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
      };

      if (photoInput && photoPreview && photoPlaceholder && currentPhoto) {
        photoPreview.src = resolveS3Url(currentPhoto);
        photoPreview.classList.remove("hidden");
        photoPlaceholder.classList.add("hidden");
      }

      const setAction = (value) => {
        if (!(actionInput instanceof HTMLInputElement)) return "draft";
        const normalized = value === "publish" ? "publish" : "draft";
        actionInput.value = normalized;
        return normalized;
      };

      let createIdempotencyKey = "";
      const generateIdempotencyKey = () => {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          return crypto.randomUUID();
        }
        return `memorial-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      };

      const resetCreateIdempotencyKey = () => {
        createIdempotencyKey = "";
      };

      const isSubmitting = () => root.dataset.formSubmitting === "1";

      const setSubmitting = (value) => {
        root.dataset.formSubmitting = value ? "1" : "0";
      };

      const clearFormMessage = () => {
        if (!(formMessage instanceof HTMLElement)) return;
        formMessage.classList.add("hidden");
        formMessage.classList.remove("border-red-300", "bg-red-50", "text-red-700");
        if (formMessageTitle instanceof HTMLElement) {
          formMessageTitle.textContent = "";
        }
        if (formMessageList instanceof HTMLElement) {
          formMessageList.innerHTML = "";
        }
      };

      const showFormMessage = (titleText, items = []) => {
        if (!(formMessage instanceof HTMLElement)) return;
        formMessage.classList.remove("hidden");
        formMessage.classList.add("border-red-300", "bg-red-50", "text-red-700");
        if (formMessageTitle instanceof HTMLElement) {
          formMessageTitle.textContent = titleText;
        }
        if (formMessageList instanceof HTMLElement) {
          formMessageList.innerHTML = "";
          for (const item of items) {
            const text = String(item || "").trim();
            if (!text) continue;
            const li = document.createElement("li");
            li.textContent = text;
            formMessageList.appendChild(li);
          }
        }
      };

      const clearFieldErrors = () => {
        root.querySelectorAll("[data-field-invalid='1']").forEach((element) => {
          element.removeAttribute("data-field-invalid");
          element.removeAttribute("aria-invalid");
          element.classList.remove("border-red-500", "ring-2", "ring-red-100", "bg-red-50");
        });
        root.querySelectorAll("[data-field-invalid-label='1']").forEach((element) => {
          element.removeAttribute("data-field-invalid-label");
          element.classList.remove("border-red-300", "bg-red-50");
        });
      };

      const markFieldError = (fieldName) => {
        const config = fieldConfig[fieldName];
        if (!config) return;
        const targets = root.querySelectorAll(config.selector);
        targets.forEach((target) => {
          target.setAttribute("data-field-invalid", "1");
          target.setAttribute("aria-invalid", "true");
          target.classList.add("border-red-500", "ring-2", "ring-red-100");
          if (target instanceof HTMLInputElement && (target.type === "radio" || target.type === "checkbox")) {
            const label = target.closest("label");
            if (label) {
              label.setAttribute("data-field-invalid-label", "1");
              label.classList.add("border-red-300", "bg-red-50");
            }
          }
        });
      };

      const setSavingState = (isSaving, action) => {
        if (draftBtn instanceof HTMLButtonElement) {
          if (isSaving && !draftBtn.dataset.originalLabel) {
            draftBtn.dataset.originalLabel = draftBtn.textContent || "Сохранить";
          }
          draftBtn.disabled = isSaving;
          draftBtn.textContent = isSaving && action === "draft"
            ? "Сохраняем..."
            : (draftBtn.dataset.originalLabel || draftBtn.textContent || "Сохранить");
        }
        if (publishBtn instanceof HTMLButtonElement) {
          if (isSaving && !publishBtn.dataset.originalLabel) {
            publishBtn.dataset.originalLabel = publishBtn.textContent || "Опубликовать";
          }
          publishBtn.disabled = isSaving;
          publishBtn.textContent = isSaving && action === "publish"
            ? "Публикуем..."
            : (publishBtn.dataset.originalLabel || publishBtn.textContent || "Опубликовать");
        }
      };

      const collectValidationErrors = (formData, action) => {
        const errors = [];
        const validAction = action === "publish" || action === "draft";
        if (!validAction) {
          errors.push({
            field: "action",
            message: "Не выбрано действие сохранения. Нажмите «Сохранить» или «Опубликовать».",
          });
        }

        const lastName = String(formData.get("last_name") || "").trim();
        const firstName = String(formData.get("first_name") || "").trim();
        const birthDate = String(formData.get("birth_date") || "").trim();
        const deathDate = String(formData.get("death_date") || "").trim();

        if (!lastName) {
          errors.push({ field: "last_name", message: "Заполните поле «Фамилия»." });
        }
        if (!firstName) {
          errors.push({ field: "first_name", message: "Заполните поле «Имя»." });
        }
        if (!birthDate) {
          errors.push({ field: "birth_date", message: "Укажите дату рождения." });
        }
        if (!deathDate) {
          errors.push({ field: "death_date", message: "Укажите дату смерти." });
        }

        const birthTimestamp = birthDate ? new Date(`${birthDate}T00:00:00`).getTime() : Number.NaN;
        const deathTimestamp = deathDate ? new Date(`${deathDate}T00:00:00`).getTime() : Number.NaN;
        if (birthDate && Number.isNaN(birthTimestamp)) {
          errors.push({ field: "birth_date", message: "Дата рождения указана некорректно." });
        }
        if (deathDate && Number.isNaN(deathTimestamp)) {
          errors.push({ field: "death_date", message: "Дата смерти указана некорректно." });
        }
        if (!Number.isNaN(birthTimestamp) && !Number.isNaN(deathTimestamp) && deathTimestamp < birthTimestamp) {
          errors.push({
            field: "death_date",
            message: "Дата смерти не может быть раньше даты рождения.",
          });
        }

        const privacy = String(formData.get("privacy") || "").trim();
        if (!["public", "family", "private"].includes(privacy)) {
          errors.push({ field: "privacy", message: "Выберите приватность мемориала." });
        }

        if (mode === "create" && !formData.has("confirm_responsibility")) {
          errors.push({
            field: "confirm_responsibility",
            message: "Подтвердите, что информация о человеке достоверна.",
          });
        }

        return errors;
      };

      const renderValidationErrors = (errors) => {
        clearFieldErrors();
        clearFormMessage();
        if (!Array.isArray(errors) || errors.length === 0) {
          return false;
        }

        const uniqueMessages = [];
        const seenMessages = new Set();
        errors.forEach((error) => {
          const message = String(error?.message || "").trim();
          if (message && !seenMessages.has(message)) {
            seenMessages.add(message);
            uniqueMessages.push(message);
          }
          if (error?.field) {
            markFieldError(error.field);
          }
        });

        showFormMessage("Не удалось сохранить мемориал. Исправьте ошибки:", uniqueMessages);
        const firstWithTab = errors.find((error) => fieldConfig[error?.field]?.tab);
        if (firstWithTab) {
          setActive(fieldConfig[firstWithTab.field].tab);
        }
        formMessage?.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      };

      const parseErrorPayload = async (response) => {
        let data = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        const payloadMessage = Array.isArray(data?.message)
          ? data.message.filter((item) => typeof item === "string").join("; ")
          : typeof data?.message === "string"
            ? data.message
            : "";
        let message = payloadMessage.trim();

        if (!message) {
          if (response.status === 401) {
            message = "Сессия истекла. Войдите в аккаунт снова.";
          } else if (response.status === 403) {
            message = "Недостаточно прав для сохранения этого мемориала.";
          } else if (response.status === 404) {
            message = "Мемориал не найден.";
          } else {
            message = `Не удалось сохранить мемориал (код ${response.status}).`;
          }
        }

        const errors = [];
        if (message.includes("Не заполнены обязательные поля:")) {
          const list = message.split(":")[1] || "";
          list
            .split(",")
            .map((item) => item.trim().replace(/\.$/, ""))
            .forEach((label) => {
              const fieldName = labelToField[label];
              if (fieldName) {
                errors.push({
                  field: fieldName,
                  message: `Заполните поле «${label}».`,
                });
              }
            });
        } else if (message.includes("Заполните обязательные поля мемориала")) {
          const currentAction = actionInput instanceof HTMLInputElement ? actionInput.value : "draft";
          errors.push(...collectValidationErrors(new FormData(form), currentAction));
        } else if (message.includes("Дата смерти не может быть раньше даты рождения")) {
          errors.push({
            field: "death_date",
            message: "Дата смерти не может быть раньше даты рождения.",
          });
        } else if (message.includes("Некорректная дата")) {
          errors.push({
            field: "birth_date",
            message: "Проверьте формат дат рождения и смерти.",
          });
        } else if (message.includes("приват")) {
          errors.push({
            field: "privacy",
            message: "Выберите приватность мемориала.",
          });
        } else if (message.includes("действие сохранения")) {
          errors.push({
            field: "action",
            message: message,
          });
        } else {
          errors.push({ field: null, message });
        }

        return { message, errors };
      };

      if (publishBtn) {
        publishBtn.addEventListener("click", () => {
          if (isSubmitting()) return;
          setAction("publish");
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        });
      }

      if (draftBtn) {
        draftBtn.addEventListener("click", () => {
          setAction("draft");
        });
      }

      if (mode === "create" && form instanceof HTMLFormElement) {
        const onInputChanged = () => {
          if (!isSubmitting()) {
            resetCreateIdempotencyKey();
          }
        };
        form.addEventListener("input", onInputChanged);
        form.addEventListener("change", onInputChanged);
      }

      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!(form instanceof HTMLFormElement)) return;
          if (isSubmitting()) return;

          clearFormMessage();
          clearFieldErrors();

          const formData = new FormData(form);
          formData.set("moderate_memories", formData.has("moderate_memories") ? "1" : "0");
          formData.set("allow_comments", formData.has("allow_comments") ? "1" : "0");
          const rawAction = String(formData.get("action") || "").trim();
          const action = rawAction === "publish" ? "publish" : rawAction === "draft" ? "draft" : "";
          formData.set("action", action || "draft");

          const localErrors = collectValidationErrors(formData, action || rawAction);
          if (renderValidationErrors(localErrors)) {
            setAction("draft");
            return;
          }

          const url = mode === "edit" && memorialId ? `${apiBaseUrl}/memorials/${memorialId}` : `${apiBaseUrl}/memorials`;
          const method = mode === "edit" && memorialId ? "PUT" : "POST";
          setSubmitting(true);
          setSavingState(true, action || "draft");
          const headers = {};

          if (mode === "create") {
            if (!createIdempotencyKey) {
              createIdempotencyKey = generateIdempotencyKey();
            }
            headers["Idempotency-Key"] = createIdempotencyKey;
          }

          try {
            const res = await fetch(url, {
              method,
              credentials: "include",
              headers,
              body: formData,
            });

            if (!res.ok) {
              const parsed = await parseErrorPayload(res);
              renderValidationErrors(parsed.errors);
              if (mode === "create" && res.status !== 409) {
                resetCreateIdempotencyKey();
              }
              return;
            }

            const data = await res.json();
            if (mode === "create") {
              resetCreateIdempotencyKey();
            }
            const newId = Number(data?.memorial?.id || memorialId || 0);
            const targetId = newId > 0 ? newId : Number(memorialId);
            
            // Сохраняем связь, если она указана (ПЕРЕД редиректом)
            if (targetId > 0) {
              const relationshipSelect = root.querySelector("#creator_relationship") as HTMLSelectElement | null;
              const relationshipCustomInput = root.querySelector("#creator_relationship_custom") as HTMLInputElement | null;
              
              if (relationshipSelect && relationshipSelect.value) {
                try {
                  const relationshipData = {
                    relationship_type: relationshipSelect.value,
                    relationship_custom: relationshipSelect.value === "other" && relationshipCustomInput ? relationshipCustomInput.value.trim() : null,
                  };
                  
                  await fetch(`${apiBaseUrl}/memorials/${targetId}/relationship`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(relationshipData),
                  });
                } catch (error) {
                  console.error("Failed to save relationship:", error);
                  // Не блокируем редирект, если сохранение связи не удалось
                }
              }
            }
            
            if (newId > 0) {
              window.location.href = `/memorial/id${newId}`;
              return;
            }

            window.location.href = "/";
          } catch {
            renderValidationErrors([
              {
                field: null,
                message: "Ошибка связи с сервером. Проверьте интернет и попробуйте снова.",
              },
            ]);
          } finally {
            setSubmitting(false);
            setSavingState(false, action || "draft");
            setAction("draft");
          }
        });
      }

      const ensureExternalScript = (id, src) =>
        new Promise((resolve, reject) => {
          const existing = document.getElementById(id);
          if (existing) {
            if (existing.dataset.loaded === "true") {
              resolve();
              return;
            }
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error(`Не удалось загрузить ${src}`)), {
              once: true,
            });
            return;
          }

          const script = document.createElement("script");
          script.id = id;
          script.src = src;
          script.async = true;
          script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
          };
          script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
          document.head.appendChild(script);
        });

      const parseCoordinate = (raw, fallback) => {
        if (typeof raw !== "string") return fallback;
        const normalized = raw.trim().replace(",", ".");
        if (!normalized) return fallback;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      const mapToggle = root.querySelector("#burial-map-toggle");
      const mapBlock = root.querySelector("#burial-map-block");
      const mapShowBtn = root.querySelector("#burial-map-show");
      const mapHideBtn = root.querySelector("#burial-map-hide");
      const mapSaveBtn = root.querySelector("#burial-map-save");
      const mapSavedBadge = root.querySelector("#burial-map-saved");
      const burialCityInput = root.querySelector("#burial_city_input");
      const burialPlaceInput = root.querySelector("#burial_place");
      const burialLocationInput = root.querySelector("#burial_location");
      const burialLatInput = root.querySelector("#burial_latitude");
      const burialLngInput = root.querySelector("#burial_longitude");

      let mapInstance = null;
      let mapPlacemark = null;
      let mapInitialized = false;
      let hasManualCoordinates = false;
      let burialLatitude = parseCoordinate(burialLatInput?.value || "", 55.751244);
      let burialLongitude = parseCoordinate(burialLngInput?.value || "", 37.618423);

      if ((burialLatInput?.value || "").trim() && (burialLngInput?.value || "").trim()) {
        hasManualCoordinates = true;
      }

      const setBurialCoordinates = (latitude, longitude) => {
        burialLatitude = latitude;
        burialLongitude = longitude;
        if (burialLatInput) burialLatInput.value = String(latitude);
        if (burialLngInput) burialLngInput.value = String(longitude);
      };

      const buildPlacemarkCaption = () => {
        const lastName = root.querySelector("#last_name")?.value || "";
        const firstName = root.querySelector("#first_name")?.value || "";
        const middleName = root.querySelector("#middle_name")?.value || "";
        const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim();
        const burialPlace = burialPlaceInput?.value?.trim() || "";
        const burialLocation = burialLocationInput?.value?.trim() || "";
        return [fullName, burialPlace, burialLocation].filter(Boolean).join("\n");
      };

      const updatePlacemarkCaption = () => {
        if (!mapPlacemark || !window.ymaps) return;
        const caption = buildPlacemarkCaption();
        mapPlacemark.properties.set("iconCaption", caption);
        mapPlacemark.properties.set("balloonContent", caption.replaceAll("\n", "<br>"));
      };

      const createPlacemark = (coords) => {
        if (!window.ymaps) return null;
        const caption = buildPlacemarkCaption();
        const placemark = new window.ymaps.Placemark(
          coords,
          {
            iconCaption: caption,
            balloonContent: caption.replaceAll("\n", "<br>"),
          },
          {
            preset: "islands#violetDotIconWithCaption",
            draggable: true,
          },
        );

        placemark.events.add("dragend", (event) => {
          const nextCoords = event.get("target").geometry.getCoordinates();
          setBurialCoordinates(nextCoords[0], nextCoords[1]);
          hasManualCoordinates = true;
        });

        return placemark;
      };

      const centerMapByCity = () => {
        if (!mapInstance || !window.ymaps || !(burialCityInput instanceof HTMLInputElement)) {
          return;
        }
        const burialCity = burialCityInput.value.trim();
        if (!burialCity) return;

        window.ymaps
          .geocode(burialCity, { results: 1 })
          .then((result) => {
            const firstGeoObject = result.geoObjects.get(0);
            if (!firstGeoObject) return;
            const coords = firstGeoObject.geometry.getCoordinates();
            mapInstance.setCenter(coords, 12);
          })
          .catch(() => undefined);
      };

      const ensureYandexMapsReady = async () => {
        if (window.ymaps) {
          await new Promise((resolve) => window.ymaps.ready(resolve));
          return window.ymaps;
        }

        if (!yandexMapsApiKey) {
          throw new Error("YANDEX_MAPS_API_KEY не задан");
        }

        const mapsSrc = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
          yandexMapsApiKey,
        )}&lang=ru_RU`;
        await ensureExternalScript("yandex-maps-api", mapsSrc);
        if (!window.ymaps) {
          throw new Error("Yandex Maps API не инициализирован");
        }
        await new Promise((resolve) => window.ymaps.ready(resolve));
        return window.ymaps;
      };

      const initBurialMap = async () => {
        if (mapInitialized) return;

        const mapTarget = root.querySelector("#burial-map");
        if (!(mapTarget instanceof HTMLDivElement)) return;

        const ymaps = await ensureYandexMapsReady();
        mapInstance = new ymaps.Map("burial-map", {
          center: [burialLatitude, burialLongitude],
          zoom: 12,
          controls: ["zoomControl", "searchControl", "typeSelector", "fullscreenControl"],
        });

        mapInitialized = true;

        if (hasManualCoordinates) {
          mapPlacemark = createPlacemark([burialLatitude, burialLongitude]);
          if (mapPlacemark) mapInstance.geoObjects.add(mapPlacemark);
        } else {
          centerMapByCity();
        }

        mapInstance.events.add("click", (event) => {
          const coords = event.get("coords");
          setBurialCoordinates(coords[0], coords[1]);
          hasManualCoordinates = true;

          if (mapPlacemark) {
            mapPlacemark.geometry.setCoordinates(coords);
          } else {
            mapPlacemark = createPlacemark(coords);
            if (mapPlacemark) mapInstance.geoObjects.add(mapPlacemark);
          }
        });
      };

      const showBurialMapSaved = () => {
        if (!(mapSavedBadge instanceof HTMLElement)) return;
        mapSavedBadge.classList.remove("hidden");
        setTimeout(() => {
          mapSavedBadge.classList.add("hidden");
        }, 3000);
      };

      const showBurialMap = async () => {
        if (mapBlock instanceof HTMLElement) mapBlock.classList.remove("hidden");
        if (mapToggle instanceof HTMLElement) mapToggle.classList.add("hidden");

        try {
          await initBurialMap();
          if (mapInstance) {
            mapInstance.container.fitToViewport();
            if (!hasManualCoordinates) {
              centerMapByCity();
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось загрузить карту";
          alert(message);
          if (mapBlock instanceof HTMLElement) mapBlock.classList.add("hidden");
          if (mapToggle instanceof HTMLElement) mapToggle.classList.remove("hidden");
        }
      };

      if (mapShowBtn) {
        mapShowBtn.addEventListener("click", showBurialMap);
      }

      if (mapHideBtn) {
        mapHideBtn.addEventListener("click", () => {
          if (mapBlock instanceof HTMLElement) mapBlock.classList.add("hidden");
          if (mapToggle instanceof HTMLElement) mapToggle.classList.remove("hidden");
        });
      }

      if (mapSaveBtn) {
        mapSaveBtn.addEventListener("click", () => {
          setBurialCoordinates(burialLatitude, burialLongitude);
          hasManualCoordinates = true;
          showBurialMapSaved();
        });
      }

      if (burialCityInput instanceof HTMLInputElement) {
        burialCityInput.addEventListener("change", () => {
          if (!hasManualCoordinates && mapInitialized) {
            centerMapByCity();
          }
        });
      }

      [burialPlaceInput, burialLocationInput, root.querySelector("#last_name"), root.querySelector("#first_name"), root.querySelector("#middle_name")].forEach((input) => {
        if (input instanceof HTMLInputElement) {
          input.addEventListener("input", updatePlacemarkCaption);
        }
      });

      const qrcodeContainer = root.querySelector("#qrcode");
      const qrHost = root.querySelector("#qr-host");
      const qrDownloadPngBtn = root.querySelector("#qr-download-png");
      const qrDownloadSvgBtn = root.querySelector("#qr-download-svg");
      const qrPrintBtn = root.querySelector("#qr-print");
      const qrSize = 256;

      const memorialUrl = memorialId
        ? `${(appBaseUrl || window.location.origin).replace(/\/$/, "")}/memorial/id${memorialId}`
        : "";

      if (qrHost instanceof HTMLElement && memorialUrl) {
        try {
          qrHost.textContent = new URL(memorialUrl).host;
        } catch {
          qrHost.textContent = memorialUrl;
        }
      }

      const ensureQRCodeReady = async () => {
        if (window.QRCode) return;
        await ensureExternalScript(
          "qrcodejs-lib",
          "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js",
        );
        if (!window.QRCode) {
          throw new Error("QR library не инициализирована");
        }
      };

      const renderQRCode = async () => {
        if (!memorialId) {
          if (qrcodeContainer instanceof HTMLElement) {
            qrcodeContainer.innerHTML = "<p class='text-gray-500 text-center py-8'>Сначала сохраните мемориал</p>";
          }
          return;
        }

        if (!(qrcodeContainer instanceof HTMLElement)) {
          return;
        }

        // Проверяем, что вкладка QR-кода видна
        const qrcodePanel = root.querySelector(`[data-tab-panel="qrcode"]`);
        if (qrcodePanel && qrcodePanel.classList.contains("hidden")) {
          return;
        }

        if (!memorialUrl) {
          qrcodeContainer.innerHTML = "<p class='text-gray-500 text-center py-8'>Не удалось определить URL мемориала</p>";
          return;
        }

        try {
          await ensureQRCodeReady();
          qrcodeContainer.innerHTML = "";
          // eslint-disable-next-line no-new
          new window.QRCode(qrcodeContainer, {
            text: memorialUrl,
            width: qrSize,
            height: qrSize,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: window.QRCode.CorrectLevel.H,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось сгенерировать QR";
          if (qrcodeContainer instanceof HTMLElement) {
            qrcodeContainer.innerHTML = `<p class='text-red-500 text-center py-8'>${message}</p>`;
          } else {
            alert(message);
          }
        }
      };

      const getQrcodeCanvas = () => {
        if (!(qrcodeContainer instanceof HTMLElement)) return null;
        const canvas = qrcodeContainer.querySelector("canvas");
        return canvas instanceof HTMLCanvasElement ? canvas : null;
      };

      const drawRoundedRect = (ctx, x, y, width, height, radius) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      };

      const downloadQrPng = () => {
        const sourceCanvas = getQrcodeCanvas();
        if (!sourceCanvas) {
          alert("Сначала сгенерируйте QR-код");
          return;
        }

        const finalCanvas = document.createElement("canvas");
        const context = finalCanvas.getContext("2d");
        if (!context) return;

        const padding = 50;
        const headerHeight = 60;
        const footerHeight = 150;
        const totalWidth = qrSize + padding * 2;
        const totalHeight = qrSize + headerHeight + footerHeight + padding * 2;

        finalCanvas.width = totalWidth;
        finalCanvas.height = totalHeight;

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, totalWidth, totalHeight);

        context.fillStyle = "#334155";
        context.font = "bold 32px Arial, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("Страница памяти", totalWidth / 2, padding + 30);

        context.drawImage(sourceCanvas, padding, padding + headerHeight, qrSize, qrSize);

        const buttonY = padding + headerHeight + qrSize + 25;
        const buttonWidth = totalWidth - padding * 2;
        const buttonHeight = 50;
        context.fillStyle = "#ef4444";
        drawRoundedRect(context, padding, buttonY, buttonWidth, buttonHeight, 10);
        context.fill();

        context.fillStyle = "#ffffff";
        context.font = "bold 20px Arial, sans-serif";
        context.fillText("Отсканируйте QR-код", totalWidth / 2, buttonY + 25);

        context.fillStyle = "#475569";
        context.font = "16px Arial, sans-serif";
        context.fillText("чтобы оставить воспоминание", totalWidth / 2, buttonY + 70);
        context.fillText("об этом человеке", totalWidth / 2, buttonY + 92);

        context.fillStyle = "#cbd5e1";
        context.font = "13px monospace";
        const host = qrHost instanceof HTMLElement ? qrHost.textContent || "" : "";
        context.fillText(host, totalWidth / 2, buttonY + 118);

        const link = document.createElement("a");
        link.download = "memorial-qr-code.png";
        link.href = finalCanvas.toDataURL("image/png", 1.0);
        link.click();
      };

      const downloadQrSvg = () => {
        alert("SVG скачивание временно недоступно. Используйте PNG формат.");
      };

      const printQr = () => {
        const sourceCanvas = getQrcodeCanvas();
        if (!sourceCanvas) {
          alert("Сначала сгенерируйте QR-код");
          return;
        }

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const imageData = sourceCanvas.toDataURL();
        printWindow.document.write("<html><head><title>QR-код мемориала</title>");
        printWindow.document.write("<style>");
        printWindow.document.write("body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:Arial,sans-serif; }");
        printWindow.document.write(".qr-container { text-align:center; padding:40px; border:2px solid #e5e7eb; border-radius:12px; max-width:400px; }");
        printWindow.document.write(".title { font-size:18px; font-weight:bold; color:#334155; margin-bottom:20px; }");
        printWindow.document.write("img { max-width:100%; height:auto; margin:20px 0; }");
        printWindow.document.write(".main-text { font-size:14px; font-weight:600; color:#334155; margin:8px 0; }");
        printWindow.document.write(".sub-text { font-size:12px; color:#6b7280; margin:8px 0; }");
        printWindow.document.write(".url { font-size:10px; color:#9ca3af; margin-top:16px; padding-top:16px; border-top:1px solid #e5e7eb; word-break:break-all; }");
        printWindow.document.write("</style></head><body>");
        printWindow.document.write("<div class='qr-container'>");
        printWindow.document.write("<div class='title'>Страница памяти</div>");
        printWindow.document.write(`<img src='${imageData}' alt='QR code' />`);
        printWindow.document.write("<p class='main-text'>Отсканируйте QR-код</p>");
        printWindow.document.write("<p class='sub-text'>чтобы оставить воспоминание<br>об этом человеке</p>");
        printWindow.document.write(`<p class='url'>${memorialUrl}</p>`);
        printWindow.document.write("</div></body></html>");
        printWindow.document.close();

        setTimeout(() => {
          printWindow.print();
        }, 250);
      };

      if (qrDownloadPngBtn) {
        qrDownloadPngBtn.addEventListener("click", downloadQrPng);
      }
      if (qrDownloadSvgBtn) {
        qrDownloadSvgBtn.addEventListener("click", downloadQrSvg);
      }
      if (qrPrintBtn) {
        qrPrintBtn.addEventListener("click", printQr);
      }

      // Если вкладка QR-кода уже активна при загрузке, генерируем QR-код
      if (activeTab === "qrcode" && memorialId) {
        renderQRCode();
      }

      // Инициализируем автокомплит для места рождения
      initCityAutocomplete("birth_place", apiBaseUrl, {
        onSelect: (data) => {
          // birth_place сохраняется как полный адрес (город, регион)
          const birthPlaceInput = root.querySelector("#birth_place") as HTMLInputElement | null;
          if (birthPlaceInput) {
            birthPlaceInput.value = data.display;
          }
        },
      });

      // Инициализируем автокомплит для города захоронения
      initCityAutocomplete("burial_city_input", apiBaseUrl, {
        onSelect: (data) => {
          const burialCityInput = root.querySelector("#burial_city_input") as HTMLInputElement | null;
          if (burialCityInput) {
            burialCityInput.value = data.display;
          }
        },
      });

      setActive("basic");
}
