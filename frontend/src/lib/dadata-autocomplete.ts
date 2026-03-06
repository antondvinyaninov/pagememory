/**
 * Универсальная функция для автокомплита городов через DaData API
 */
export function initCityAutocomplete(
  inputId: string,
  apiBaseUrl: string,
  options?: {
    onSelect?: (data: { city: string; region: string; country: string; display: string }) => void;
    hiddenInputs?: {
      country?: string;
      region?: string;
      city?: string;
    };
  }
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) {
    return;
  }

  let suggestionsContainer: HTMLElement | null = null;
  let suggestions: Array<{ value: string; data: any }> = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Создаем контейнер для подсказок
  const createSuggestionsContainer = (): HTMLElement => {
    if (suggestionsContainer) return suggestionsContainer;

    suggestionsContainer = document.createElement("div");
    suggestionsContainer.className = "absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto";
    suggestionsContainer.id = `${inputId}-suggestions`;
    suggestionsContainer.style.position = "absolute";
    suggestionsContainer.style.top = "100%";
    suggestionsContainer.style.left = "0";
    suggestionsContainer.style.right = "0";
    suggestionsContainer.style.display = "none"; // Используем display вместо класса hidden

    // Вставляем контейнер в родительский элемент input
    const parent = input.parentElement;
    if (parent) {
      // Убеждаемся, что родитель имеет position: relative
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.position === "static") {
        parent.style.position = "relative";
      }
      parent.appendChild(suggestionsContainer);
    }

    return suggestionsContainer;
  };

  // Функция для расширения сокращений в названиях регионов
  const expandRegionAbbreviations = (text: string): string => {
    if (!text) return text;

    const replacements: Record<string, string> = {
      " Респ": " Республика",
      " обл": " область",
      " край": " край",
      " АО": " автономный округ",
      " Аобл": " автономная область",
      " г": " город",
    };

    let result = text;
    for (const [abbr, full] of Object.entries(replacements)) {
      result = result.replace(new RegExp(abbr + "(?![а-яА-Я])", "g"), full);
    }

    return result;
  };

  // Получение полного названия региона
  const getFullRegion = (suggestion: { data: any }): string => {
    const data = suggestion.data;
    let regionName = "";

    if (data.region_type_full && data.region) {
      if (data.region_type_full === "Республика") {
        regionName = data.region + " " + data.region_type_full;
      } else {
        regionName = data.region + " " + data.region_type_full;
      }
    } else if (data.region_with_type) {
      regionName = data.region_with_type;
    }

    return expandRegionAbbreviations(regionName);
  };

  // Поиск городов
  const searchCities = async (query: string) => {
    if (query.length < 2) {
      suggestions = [];
      if (suggestionsContainer) {
        suggestionsContainer.style.display = "none";
      }
      return;
    }

    try {
      const url = `${apiBaseUrl}/utils/dadata/cities?query=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      suggestions = data.suggestions || [];
      renderSuggestions();
    } catch (error) {
      // Игнорируем ошибки
    }
  };

  // Отображение подсказок
  const renderSuggestions = () => {
    const container = createSuggestionsContainer();
    if (suggestions.length === 0) {
      container.style.display = "none";
      return;
    }
    
    // Экранируем HTML в значениях для безопасности
    const escapeHtml = (text: string) => {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

    container.innerHTML = suggestions
      .map(
        (suggestion) => `
      <div 
        class="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
        data-suggestion-value="${escapeHtml(suggestion.value)}"
      >
        <div class="font-medium text-gray-900">${escapeHtml(suggestion.value)}</div>
        <div class="text-sm text-gray-500">${escapeHtml(getFullRegion(suggestion))}</div>
      </div>
    `
      )
      .join("");

    // Добавляем обработчики кликов
    container.querySelectorAll("[data-suggestion-value]").forEach((el) => {
      el.addEventListener("click", () => {
        const value = el.getAttribute("data-suggestion-value");
        const suggestion = suggestions.find((s) => s.value === value);
        if (suggestion) {
          selectCity(suggestion);
        }
      });
    });

    container.style.display = "block";
  };

  // Выбор города
  const selectCity = (suggestion: { value: string; data: any }) => {
    const data = suggestion.data;

    // Сохраняем страну
    const country = data.country || "";

    // Формируем полное название региона
    let regionName = "";
    if (data.region_type_full && data.region) {
      if (data.region_type_full === "Республика") {
        regionName = data.region + " " + data.region_type_full;
      } else {
        regionName = data.region + " " + data.region_type_full;
      }
    } else if (data.region_with_type) {
      regionName = data.region_with_type;
    }
    regionName = expandRegionAbbreviations(regionName);

    // Сохраняем город с типом
    const city = data.city_with_type || data.settlement_with_type || "";

    // Показываем: город, регион (без страны)
    const displayParts: string[] = [];
    if (city) displayParts.push(city);
    if (regionName) displayParts.push(regionName);

    const display = displayParts.join(", ");

    // Устанавливаем значения в скрытые поля
    if (options?.hiddenInputs) {
      if (options.hiddenInputs.country) {
        const countryInput = document.getElementById(options.hiddenInputs.country) as HTMLInputElement | null;
        if (countryInput) {
          countryInput.value = country;
        }
      }
      if (options.hiddenInputs.region) {
        const regionInput = document.getElementById(options.hiddenInputs.region) as HTMLInputElement | null;
        if (regionInput) {
          regionInput.value = regionName;
        }
      }
      if (options.hiddenInputs.city) {
        const cityInput = document.getElementById(options.hiddenInputs.city) as HTMLInputElement | null;
        if (cityInput) {
          cityInput.value = city;
        }
      }
    }

    // Устанавливаем отображаемое значение в видимое поле
    input.value = display;

    // Скрываем подсказки
    if (suggestionsContainer) {
      suggestionsContainer.style.display = "none";
    }

    // Вызываем callback, если есть
    if (options?.onSelect) {
      options.onSelect({ city, region: regionName, country, display });
    }
  };

  // Обработчик ввода
  input.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value;
    
    // Если пользователь вручную изменил значение после выбора из автокомплита,
    // очищаем скрытое поле city_hidden, чтобы при сохранении использовалось видимое значение
    if (options?.hiddenInputs?.city) {
      const cityHiddenInput = document.getElementById(options.hiddenInputs.city) as HTMLInputElement | null;
      if (cityHiddenInput && cityHiddenInput.value) {
        // Проверяем, совпадает ли текущее значение с отображаемым
        // Если не совпадает, значит пользователь изменил вручную
        const displayParts = query.split(", ");
        const hiddenCity = cityHiddenInput.value;
        if (!query.includes(hiddenCity)) {
          // Пользователь изменил значение вручную, очищаем скрытое поле
          cityHiddenInput.value = "";
        }
      }
    }
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      searchCities(query);
    }, 300);
  });

  // Обработчик фокуса
  input.addEventListener("focus", () => {
    if (suggestions.length > 0 && suggestionsContainer) {
      suggestionsContainer.style.display = "block";
    }
  });

  // Закрытие при клике вне
  document.addEventListener("click", (e) => {
    if (suggestionsContainer && !suggestionsContainer.contains(e.target as Node) && e.target !== input) {
      suggestionsContainer.style.display = "none";
    }
  });
}
