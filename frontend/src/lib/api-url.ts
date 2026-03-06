/**
 * Возвращает правильный API URL в зависимости от контекста выполнения
 * - На сервере (SSR): полный URL к localhost backend
 * - На клиенте (браузер): относительный URL через nginx
 */
export function getApiUrl(): string {
  // Проверяем, выполняется ли код на сервере
  if (typeof window === 'undefined') {
    // SSR - используем внутренний URL
    return 'http://127.0.0.1:4000/api';
  }
  
  // Клиент - используем относительный URL через nginx
  return '/api';
}

/**
 * Создает полный URL для API запроса
 */
export function apiUrl(path: string): string {
  const base = getApiUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
