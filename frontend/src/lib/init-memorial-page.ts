export function initMemorialPage(): void {
    const root = document.getElementById("memorial-tabs-root");
    if (!(root instanceof HTMLElement)) return;
    if (root.dataset.memorialPageInitialized === "1") return;
    root.dataset.memorialPageInitialized = "1";

    const apiBaseUrl = root?.dataset.apiBaseUrl || "/api";
    const memorialId = root?.dataset.memorialId || "";
    const tabs = ["memories", "about", "burial", "media", "people"];
    let burialMapInitialized = false;
    let currentMe = null;
    let meLoaded = false;

    const fetchMe = async () => {
      if (meLoaded) return currentMe;
      meLoaded = true;
      try {
        // Используем обычный fetch - перехват уже настроен в MainLayout
        const meRes = await fetch(`${apiBaseUrl}/auth/me`, {
          method: "GET",
          credentials: "include",
        });
        if (!meRes.ok) {
          currentMe = null;
          return null;
        }
        currentMe = await meRes.json().catch(() => null);
        return currentMe;
      } catch (error) {
        currentMe = null;
        return null;
      }
    };

    const ensureScript = (id, src) =>
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

    const initBurialMap = async () => {
      if (burialMapInitialized) return;
      const mapContainer = document.getElementById("burial-map-view");
      if (!(mapContainer instanceof HTMLElement)) return;

      const latitude = Number(mapContainer.dataset.latitude || "");
      const longitude = Number(mapContainer.dataset.longitude || "");
      const mapKey = String(mapContainer.dataset.mapKey || "").trim();

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !mapKey) {
        return;
      }

      if (!window.ymaps) {
        const src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(mapKey)}&lang=ru_RU`;
        await ensureScript("yandex-maps-view-api", src);
      }
      if (!window.ymaps) return;

      await new Promise((resolve) => window.ymaps.ready(resolve));

      const burialMap = new window.ymaps.Map("burial-map-view", {
        center: [latitude, longitude],
        zoom: 16,
        controls: ["zoomControl", "fullscreenControl"],
      });

      const fullName = document
        .querySelector("h1")
        ?.textContent?.trim() || "Страница памяти";

      const placemark = new window.ymaps.Placemark(
        [latitude, longitude],
        {
          iconCaption: fullName,
          balloonContent: `<strong>${fullName}</strong>`,
        },
        { preset: "islands#redDotIconWithCaption" },
      );

      burialMap.geoObjects.add(placemark);
      burialMapInitialized = true;
    };

    const initMemoryCreate = async () => {
      const guestBlock = document.getElementById("memory-create-guest");
      const form = document.getElementById("memory-create-form");
      const statusEl = document.getElementById("memory-create-status");
      const submitBtn = document.getElementById("memory-submit-btn");
      const textarea = document.getElementById("memory-content");
      const mediaInput = document.getElementById("memory-media-input");
      const mediaPreview = document.getElementById("memory-media-preview");
      const relationshipContainer = document.getElementById("memory-relationship-container");
      const relationshipTypeSelect = document.getElementById("memory-relationship-type") as HTMLSelectElement | null;
      const relationshipCustomContainer = document.getElementById("memory-relationship-custom-container");
      const relationshipCustomInput = document.getElementById("memory-relationship-custom") as HTMLInputElement | null;
      const memoryForm = document.getElementById("memory-create-form") as HTMLFormElement | null;

      if (!(form instanceof HTMLFormElement)) return;
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      if (!(mediaInput instanceof HTMLInputElement)) return;

      const checkUserRelationship = async (): Promise<boolean> => {
        try {
          const res = await fetch(`${apiBaseUrl}/memorials/${memorialId}/relationship`, {
            method: "GET",
            credentials: "include",
          });
          if (!res.ok) return false;
          const data = await res.json().catch(() => null);
          return data?.hasRelationship === true;
        } catch {
          return false;
        }
      };

      const me = await fetchMe();
      const isAuthed = Boolean(me?.id);

      if (isAuthed) {
        form.classList.remove("hidden");
        guestBlock?.classList.add("hidden");
        
        // Проверяем, есть ли у пользователя связь с мемориалом
        const hasRelationship = await checkUserRelationship();
        if (hasRelationship && relationshipContainer) {
          // Если связь уже есть - скрываем поле выбора связи
          relationshipContainer.classList.add("hidden");
          if (relationshipTypeSelect) {
            relationshipTypeSelect.required = false;
            relationshipTypeSelect.value = "";
            relationshipTypeSelect.removeAttribute("form");
          }
          if (relationshipCustomInput) {
            relationshipCustomInput.value = "";
            relationshipCustomInput.required = false;
          }
          if (relationshipCustomContainer) {
            relationshipCustomContainer.classList.add("hidden");
          }
        } else if (!hasRelationship && relationshipContainer && relationshipTypeSelect && memoryForm) {
          // Если связи нет - показываем поле выбора связи в заголовке
          relationshipContainer.classList.remove("hidden");
          relationshipTypeSelect.required = true;
          relationshipTypeSelect.setAttribute("form", memoryForm.id);
        }
      } else {
        form.classList.add("hidden");
        guestBlock?.classList.remove("hidden");
      }

      // Показываем поле "Другое" когда выбрано "other"
      if (relationshipTypeSelect && relationshipCustomContainer) {
        relationshipTypeSelect.addEventListener("change", () => {
          if (relationshipTypeSelect.value === "other") {
            relationshipCustomContainer.classList.remove("hidden");
            if (relationshipCustomInput) relationshipCustomInput.required = true;
          } else {
            relationshipCustomContainer.classList.add("hidden");
            if (relationshipCustomInput) {
              relationshipCustomInput.required = false;
              relationshipCustomInput.value = "";
            }
          }
        });
      }

      // Превью выбранных файлов
      const updateMediaPreview = () => {
        if (!mediaPreview || !mediaInput.files) return;
        const files = Array.from(mediaInput.files);
        if (files.length === 0) {
          mediaPreview.classList.add("hidden");
          mediaPreview.innerHTML = "";
          return;
        }

        mediaPreview.classList.remove("hidden");
        const previewHtml = files
          .map((file) => {
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");
            if (!isImage && !isVideo) return "";

            const url = URL.createObjectURL(file);
            if (isImage) {
              return `
                <div class="relative inline-block rounded-lg overflow-hidden border border-gray-300">
                  <img src="${url}" alt="Preview" class="w-20 h-20 object-cover" />
                </div>
              `;
            } else {
              return `
                <div class="relative inline-block rounded-lg overflow-hidden border border-gray-300 bg-gray-900">
                  <video src="${url}" class="w-20 h-20 object-cover" muted></video>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              `;
            }
          })
          .filter(Boolean)
          .join("");

        mediaPreview.innerHTML = `
          <div class="flex flex-wrap gap-2">
            ${previewHtml}
          </div>
        `;
      };

      mediaInput.addEventListener("change", updateMediaPreview);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const content = textarea.value.trim();
        const files = mediaInput.files;
        const hasMedia = files && files.length > 0;

        // Если нет медиа, текст обязателен (минимум 10 символов)
        if (!hasMedia && content.length < 10) {
          if (statusEl) statusEl.textContent = "Минимум 10 символов или добавьте медиа";
          return;
        }

        if (submitBtn instanceof HTMLButtonElement) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Публикуем...";
        }
        if (statusEl) statusEl.textContent = hasMedia ? "Загружаем медиа файлы..." : "";

        try {
          const formData = new FormData();
          formData.append("content", content);

          if (files) {
            for (let i = 0; i < files.length; i++) {
              formData.append("media", files[i]);
            }
          }

          // Добавляем связь, если она указана
          if (relationshipTypeSelect && relationshipTypeSelect.value) {
            formData.append("relationship_type", relationshipTypeSelect.value);
            if (relationshipTypeSelect.value === "other" && relationshipCustomInput && relationshipCustomInput.value.trim()) {
              formData.append("relationship_custom", relationshipCustomInput.value.trim());
            }
          }

          const res = await fetch(`${apiBaseUrl}/memorials/${memorialId}/memories`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            const message = payload?.message || "Не удалось добавить воспоминание";
            if (statusEl) statusEl.textContent = message;
            console.error("Failed to create memory:", payload);
            return;
          }

          const result = await res.json().catch(() => null);
          if (result?.success) {
            // После успешного создания воспоминания скрываем поле связи (если оно было заполнено)
            if (relationshipTypeSelect && relationshipTypeSelect.value) {
              if (relationshipContainer) {
                relationshipContainer.classList.add("hidden");
              }
              if (relationshipTypeSelect) {
                relationshipTypeSelect.required = false;
                relationshipTypeSelect.value = "";
              }
              if (relationshipCustomInput) {
                relationshipCustomInput.value = "";
                relationshipCustomInput.required = false;
              }
              if (relationshipCustomContainer) {
                relationshipCustomContainer.classList.add("hidden");
              }
            }
            window.location.reload();
          } else {
            if (statusEl) statusEl.textContent = "Воспоминание создано, но произошла ошибка";
            console.error("Unexpected response:", result);
          }
        } catch (error) {
          console.error("Error creating memory:", error);
          if (statusEl) {
            statusEl.textContent = error instanceof Error ? error.message : "Ошибка связи с сервером";
          }
        } finally {
          if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Опубликовать";
          }
        }
      });

      const escapeHtml = (value) =>
        String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const resolveAvatarUrl = (path, name) => {
        const rawPath = String(path || "").trim();
        if (rawPath) {
          if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) return rawPath;
          return `https://s3.firstvds.ru/memory/${rawPath.replace(/^\//, "")}`;
        }
        const fallbackName = String(name || "User").trim() || "User";
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&size=128&background=e3f2fd&color=1976d2&bold=true`;
      };

      const formatDate = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString("ru-RU");
      };

      const createCommentNode = (comment) => {
        const wrapper = document.createElement("div");
        wrapper.className = "flex gap-3";
        wrapper.setAttribute("data-comment-id", String(comment?.id || ""));
        const profileHref = comment?.author_id ? `/user/id${comment.author_id}` : "#";
        const avatar = resolveAvatarUrl(comment?.author_avatar, comment?.author_name);
        const authorName = escapeHtml(comment?.author_name || "Пользователь");
        const content = escapeHtml(comment?.content || "");
        const likes = Number(comment?.likes || 0);
        const createdAt = formatDate(comment?.created_at || "");
        const isLiked = comment?.user_liked === true;

        wrapper.innerHTML = `
          <a href="${profileHref}" class="flex-shrink-0">
            <img src="${avatar}" alt="${authorName}" class="w-12 h-12 rounded-md object-cover hover:opacity-80 transition-opacity" />
          </a>
          <div class="flex-1 min-w-0">
            <div class="bg-white rounded-lg px-3 py-2 border border-gray-200">
              <h5 class="font-semibold text-slate-700 text-sm mb-1">${authorName}</h5>
              <p class="text-slate-600 text-xs leading-relaxed">${content}</p>
            </div>
            <div class="flex items-center gap-3 mt-1 px-2">
              <button
                type="button"
                data-comment-like-btn
                data-comment-id="${comment?.id || ""}"
                data-comment-liked="${String(isLiked)}"
                class="flex items-center gap-1 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-600'} transition-colors text-xs"
              >
                ${isLiked ? (
                  `<svg class="w-3 h-3" fill="#ef4444" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                  </svg>`
                ) : (
                  `<svg class="w-3 h-3" fill="none" stroke="#9ca3af" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                  </svg>`
                )}
                <span data-comment-likes-count>${likes}</span>
              </button>
              <span class="text-gray-400 text-xs">${escapeHtml(createdAt)}</span>
            </div>
          </div>
        `;

        return wrapper;
      };

      const initMemoryComments = () => {
        document.querySelectorAll("[data-memory-card]").forEach((card) => {
          const memoryId = card.getAttribute("data-memory-id");
          if (!memoryId) return;

          const toggle = card.querySelector("[data-memory-comments-toggle]");
          const container = card.querySelector("[data-memory-comments-container]");
          const list = card.querySelector("[data-memory-comments-list]");
          const countEl = card.querySelector("[data-memory-comments-count]");
          const form = card.querySelector("[data-memory-comment-form]");
          const guest = card.querySelector("[data-memory-comment-form-guest]");
          const input = card.querySelector("[data-memory-comment-input]");
          const avatar = card.querySelector("[data-memory-comment-form-avatar]");
          const emptyState = card.querySelector("[data-memory-comments-empty]");

          if (toggle && container) {
            toggle.addEventListener("click", () => {
              container.classList.toggle("hidden");
            });
          }

          if (form instanceof HTMLFormElement && input instanceof HTMLInputElement && list) {
            if (isAuthed) {
              form.classList.remove("hidden");
              guest?.classList.add("hidden");
              if (avatar instanceof HTMLImageElement) {
                avatar.src = resolveAvatarUrl(me?.avatar, me?.name);
              }
            } else {
              form.classList.add("hidden");
              guest?.classList.remove("hidden");
            }

            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              if (!isAuthed) {
                window.location.href = "/login";
                return;
              }

              const content = input.value.trim();
              if (!content) return;

              const submitBtn = form.querySelector("button[type='submit']");
              if (submitBtn instanceof HTMLButtonElement) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Отправка...";
              }

              try {
                const res = await fetch(`${apiBaseUrl}/memorials/memories/${memoryId}/comments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ content }),
                });

                if (!res.ok) {
                  const payload = await res.json().catch(() => null);
                  alert(payload?.message || "Не удалось добавить комментарий");
                  return;
                }

                const payload = await res.json().catch(() => null);
                const comment = payload?.comment;
                if (!comment) return;

                // Убеждаемся, что новый комментарий имеет user_liked: false
                const commentWithLiked = { ...comment, user_liked: false };
                const commentNode = createCommentNode(commentWithLiked);
                if (emptyState) emptyState.remove();
                list.appendChild(commentNode);
                input.value = "";

                // Обработчик лайков для нового комментария уже работает через делегирование событий

                if (countEl) {
                  const current = Number(countEl.textContent || "0");
                  countEl.textContent = String(Number.isFinite(current) ? current + 1 : 1);
                }
              } catch {
                alert("Ошибка связи с сервером");
              } finally {
                if (submitBtn instanceof HTMLButtonElement) {
                  submitBtn.disabled = false;
                  submitBtn.textContent = "Отправить";
                }
              }
            });
          }
        });
      };

      initMemoryComments();
    };

    const initMemoryLikes = () => {

      document.querySelectorAll("[data-memory-like-btn]").forEach((btn) => {
        const memoryId = btn.getAttribute("data-memory-id");
        if (!memoryId) return;

        btn.addEventListener("click", async () => {
          const me = await fetchMe();
          if (!me?.id) {
            window.location.href = "/login";
            return;
          }

          const svg = btn.querySelector("svg");
          const path = svg?.querySelector("path");
          const countEl = btn.querySelector("[data-memory-likes-count]");
          const isLiked = btn.getAttribute("data-memory-liked") === "true";

          if (!svg || !path || !countEl) return;

          try {
            const res = await fetch(`${apiBaseUrl}/memorials/memories/${memoryId}/like`, {
              method: "POST",
              credentials: "include",
            });

            if (!res.ok) {
              const payload = await res.json().catch(() => null);
              alert(payload?.message || "Не удалось поставить лайк");
              return;
            }

            const data = await res.json();
            if (data.success) {
              countEl.textContent = String(data.likes || 0);

              if (data.liked) {
                // Лайк поставлен - акцентный красный
                svg.setAttribute("fill", "#ef4444");
                svg.removeAttribute("stroke");
                path.removeAttribute("stroke-linecap");
                path.removeAttribute("stroke-linejoin");
                path.removeAttribute("stroke-width");
                btn.classList.remove("text-gray-500");
                btn.classList.add("text-red-500");
                btn.setAttribute("data-memory-liked", "true");
              } else {
                // Лайк убран - делаем контур серым
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "#6b7280");
                path.setAttribute("stroke-linecap", "round");
                path.setAttribute("stroke-linejoin", "round");
                path.setAttribute("stroke-width", "2");
                btn.classList.remove("text-red-500");
                btn.classList.add("text-gray-500");
                btn.setAttribute("data-memory-liked", "false");
              }
            }
          } catch (error) {
            console.error("Error liking memory:", error);
            alert("Ошибка связи с сервером");
          }
        });
      });
    };

    initMemoryLikes();

    const initCommentLikes = () => {
      // Используем делегирование событий для обработки лайков комментариев
      // Это работает для всех комментариев, включая динамически добавленные
      root.addEventListener("click", async (event) => {
        const target = event.target as HTMLElement;
        const btn = target.closest("[data-comment-like-btn]") as HTMLElement | null;
        if (!btn) return;

        event.preventDefault();
        event.stopPropagation();

        const commentId = btn.getAttribute("data-comment-id");
        if (!commentId) {
          console.warn("[CommentLikes] No comment ID found");
          return;
        }

        console.log("[CommentLikes] Like button clicked for comment:", commentId);

        const me = await fetchMe();
        if (!me?.id) {
          console.log("[CommentLikes] User not authenticated, redirecting to login");
          window.location.href = "/login";
          return;
        }

        const svg = btn.querySelector("svg");
        const path = svg?.querySelector("path");
        const countEl = btn.querySelector("[data-comment-likes-count]");

        if (!svg || !countEl) {
          console.warn("[CommentLikes] SVG or count element not found", { svg: !!svg, countEl: !!countEl });
          return;
        }

        console.log("[CommentLikes] Sending like request for comment:", commentId);

        try {
          const res = await fetch(`${apiBaseUrl}/memorials/memories/comments/${commentId}/like`, {
            method: "POST",
            credentials: "include",
          });

          console.log("[CommentLikes] Response status:", res.status);

          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            console.error("[CommentLikes] Error response:", payload);
            alert(payload?.message || "Не удалось поставить лайк");
            return;
          }

          const data = await res.json();
          console.log("[CommentLikes] Success response:", data);

          if (data.success) {
            countEl.textContent = String(data.likes || 0);

            if (data.liked) {
              // Лайк поставлен - акцентный красный
              svg.setAttribute("fill", "#ef4444");
              svg.removeAttribute("stroke");
              if (path) {
                path.removeAttribute("stroke-linecap");
                path.removeAttribute("stroke-linejoin");
                path.removeAttribute("stroke-width");
              }
              btn.classList.remove("text-gray-400");
              btn.classList.add("text-red-500");
              btn.setAttribute("data-comment-liked", "true");
              console.log("[CommentLikes] Like added successfully");
            } else {
              // Лайк убран - делаем контур серым
              svg.setAttribute("fill", "none");
              svg.setAttribute("stroke", "#9ca3af");
              if (path) {
                path.setAttribute("stroke-linecap", "round");
                path.setAttribute("stroke-linejoin", "round");
                path.setAttribute("stroke-width", "2");
              }
              btn.classList.remove("text-red-500");
              btn.classList.add("text-gray-400");
              btn.setAttribute("data-comment-liked", "false");
              console.log("[CommentLikes] Like removed successfully");
            }
          }
        } catch (error) {
          console.error("[CommentLikes] Error liking comment:", error);
          alert("Ошибка связи с сервером");
        }
      });
      
      console.log("[CommentLikes] Event listener initialized");
    };

    initCommentLikes();

    const initMemoryMenu = () => {
      // Закрытие всех меню при клике вне их
      document.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (!target.closest("[data-memory-menu-btn]") && !target.closest("[data-memory-menu]")) {
          document.querySelectorAll("[data-memory-menu]").forEach((menu) => {
            menu.classList.add("hidden");
          });
        }
      });

      // Обработка клика на кнопку меню
      document.querySelectorAll("[data-memory-menu-btn]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const memoryId = btn.getAttribute("data-memory-id");
          if (!memoryId) return;

          // Закрываем все другие меню
          document.querySelectorAll("[data-memory-menu]").forEach((menu) => {
            if (menu.getAttribute("data-memory-id") !== memoryId) {
              menu.classList.add("hidden");
            }
          });

          // Переключаем текущее меню
          const menu = document.querySelector(
            `[data-memory-menu][data-memory-id="${memoryId}"]`
          ) as HTMLElement | null;
          if (menu) {
            menu.classList.toggle("hidden");
          }
        });
      });

      // Обработка удаления воспоминания
      document.querySelectorAll("[data-memory-delete-btn]").forEach((btn) => {
        btn.addEventListener("click", async (event) => {
          event.stopPropagation();
          const memoryId = btn.getAttribute("data-memory-id");
          if (!memoryId) return;

          if (!confirm("Вы уверены, что хотите удалить это воспоминание? Это действие нельзя отменить.")) {
            return;
          }

          const memoryCard = document.querySelector(
            `[data-memory-card][data-memory-id="${memoryId}"]`
          ) as HTMLElement | null;
          if (!memoryCard) return;

          // Показываем состояние загрузки
          memoryCard.style.opacity = "0.5";
          memoryCard.style.pointerEvents = "none";

          try {
            const res = await fetch(`${apiBaseUrl}/memorials/memories/${memoryId}`, {
              method: "DELETE",
              credentials: "include",
            });

            if (!res.ok) {
              const payload = await res.json().catch(() => null);
              const errorMessage = payload?.message || payload?.error || `Ошибка ${res.status}: ${res.statusText}`;
              console.error("Failed to delete memory:", { status: res.status, payload });
              alert(errorMessage);
              memoryCard.style.opacity = "1";
              memoryCard.style.pointerEvents = "auto";
              return;
            }

            // Удаляем карточку воспоминания
            memoryCard.style.transition = "opacity 0.3s ease-out";
            memoryCard.style.opacity = "0";
            setTimeout(() => {
              memoryCard.remove();
              
              // Проверяем, остались ли воспоминания
              const memoriesContainer = document.querySelector(".space-y-4");
              if (memoriesContainer && memoriesContainer.children.length === 0) {
                // Перезагружаем страницу, чтобы показать пустое состояние
                window.location.reload();
              }
            }, 300);
          } catch (error) {
            console.error("Error deleting memory:", error);
            alert("Ошибка связи с сервером");
            memoryCard.style.opacity = "1";
            memoryCard.style.pointerEvents = "auto";
          }
        });
      });
    };

    initMemoryMenu();

    // Отслеживание просмотров воспоминаний (как в соцсетях - при видимости 50%+)
    const initMemoryViews = () => {
      const viewedMemories = new Set<string>();
      
      const memoryObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
              const memoryCard = entry.target as HTMLElement;
              const memoryId = memoryCard.getAttribute("data-memory-id");
              
              if (!memoryId || viewedMemories.has(memoryId)) {
                return;
              }
              
              // Помечаем как просмотренное
              viewedMemories.add(memoryId);
              
              // Отправляем запрос на увеличение счетчика
              fetch(`${apiBaseUrl}/memorials/memories/${memoryId}/view`, {
                method: "POST",
                credentials: "include",
              })
                .then((res) => {
                  if (!res.ok) {
                    console.warn(`[MemoryViews] Failed to track view for memory ${memoryId}:`, res.status);
                    return;
                  }
                  return res.json();
                })
                .then((data) => {
                  if (data?.success && typeof data.views === "number") {
                    // Обновляем счетчик просмотров в UI
                    const viewsEl = memoryCard.querySelector("[data-memory-views-count]");
                    if (viewsEl) {
                      const toCount = (n: number | string) => {
                        const num = typeof n === "string" ? Number(n) : n;
                        if (!Number.isFinite(num) || num < 0) return "0";
                        if (num < 1000) return String(num);
                        if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
                        return `${(num / 1000000).toFixed(1)}M`;
                      };
                      viewsEl.textContent = toCount(data.views);
                    }
                  }
                })
                .catch((error) => {
                  console.error(`[MemoryViews] Error tracking view for memory ${memoryId}:`, error);
                });
            }
          });
        },
        {
          threshold: 0.5, // Считаем просмотром, когда 50% воспоминания видно
        }
      );

      // Наблюдаем за всеми воспоминаниями
      document.querySelectorAll("[data-memory-card]").forEach((card) => {
        memoryObserver.observe(card);
      });

      // Также наблюдаем за динамически добавленными воспоминаниями
      const observer = new MutationObserver(() => {
        document.querySelectorAll("[data-memory-card]").forEach((card) => {
          if (!viewedMemories.has(card.getAttribute("data-memory-id") || "")) {
            memoryObserver.observe(card);
          }
        });
      });

      const memoriesContainer = document.querySelector(".space-y-4");
      if (memoriesContainer) {
        observer.observe(memoriesContainer, {
          childList: true,
          subtree: true,
        });
      }
    };

    initMemoryViews();

    const loadPeopleTab = async () => {
      const container = document.getElementById("people-list-container");
      if (!container || !memorialId) {
        if (container && !memorialId) {
          container.innerHTML = `<p class="text-sm text-slate-600">ID мемориала не указан</p>`;
        }
        return;
      }

      try {
        const url = `${apiBaseUrl}/memorials/${memorialId}/people`;
        const res = await fetch(url, {
          credentials: "include",
        });

        if (!res.ok) {
          let errorMessage = `Ошибка ${res.status}`;
          try {
            const errorText = await res.text();
            if (errorText) {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData?.message || errorData?.error || errorMessage;
            }
          } catch {
            // Игнорируем ошибки парсинга
          }
          container.innerHTML = `<p class="text-sm text-red-600">Ошибка загрузки данных: ${errorMessage}</p>`;
          return;
        }

        const data = await res.json();
        const people = data.people || [];

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
            const s3BaseUrl = "https://s3.firstvds.ru/memory";
            return `${s3BaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
          }
          const fallbackName = (name || "User").trim() || "User";
          return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&size=128&background=e3f2fd&color=1976d2&bold=true`;
        };

        const escapeHtml = (text: string) => {
          const div = document.createElement("div");
          div.textContent = text;
          return div.innerHTML;
        };

        if (people.length === 0) {
          container.innerHTML = `
            <p class="text-sm text-slate-600">
              Пока нет данных о близких людях, оставивших воспоминания.
            </p>
          `;
          return;
        }

        const peopleHtml = people
          .map((person: any) => {
            const relationshipLabel =
              person.relationship_type === "other"
                ? person.custom_relationship || "Другое"
                : relationshipLabels[person.relationship_type || ""] || person.relationship_type || "Участник воспоминаний";
            const avatarUrl = resolveAvatarUrl(person.user_avatar, person.user_name);

            return `
              <a
                href="/user/id${person.user_id}"
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 transition-colors"
              >
                <img
                  src="${avatarUrl}"
                  alt="${escapeHtml(person.user_name)}"
                  class="h-12 w-12 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <p class="text-sm font-semibold text-slate-800">${escapeHtml(person.user_name)}</p>
                  <p class="text-xs text-slate-500">${escapeHtml(relationshipLabel)}</p>
                </div>
              </a>
            `;
          })
          .join("");

        container.innerHTML = `
          <div class="space-y-3">
            <p class="text-sm text-slate-600">
              Люди, оставившие воспоминания об этом человеке.
            </p>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              ${peopleHtml}
            </div>
          </div>
        `;
      } catch (error) {
        console.error("Error loading people:", error);
        container.innerHTML = `<p class="text-sm text-red-600">Ошибка загрузки данных</p>`;
      }
    };

    function setActive(tab) {
      tabs.forEach((name) => {
        const btns = document.querySelectorAll(`[data-tab-btn="${name}"]`);
        const section = document.querySelector(`[data-tab-section="${name}"]`);

        if (!section) return;

        const activeClasses = [
          "bg-slate-700",
          "text-white",
          "border-slate-700",
          "shadow-sm",
        ];
        const inactiveClasses = [
          "text-slate-700",
          "border-transparent",
          "hover:bg-slate-100",
        ];

        if (name === tab) {
          btns.forEach((btn) => {
            btn.classList.add(...activeClasses);
            btn.classList.remove(...inactiveClasses);
          });
          section.classList.remove("hidden");
        } else {
          btns.forEach((btn) => {
            btn.classList.remove(...activeClasses);
            btn.classList.add(...inactiveClasses);
          });
          section.classList.add("hidden");
        }
      });

        if (tab === "burial") {
          initBurialMap().catch(() => undefined);
        }
        if (tab === "people") {
          loadPeopleTab().catch(() => undefined);
        }
      }

    document
      .querySelectorAll("[data-tab-btn]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.getAttribute("data-tab-btn");
          if (tab) {
            setActive(tab);
          }
        });
      });

    setActive("memories");
    initMemoryCreate().catch(() => undefined);
}
