/**
 * Возвращает правильный API URL в зависимости от контекста выполнения
 * - На сервере (SSR): полный URL к localhost backend
 * - На клиенте (браузер): относительный URL через nginx (production) или полный URL (dev)
 */
export function getApiBaseUrl(): string {
  // В Astro import.meta.env доступен и на сервере, и на клиенте
  // Но на сервере относительные URL не работают с fetch
  
  // Проверяем контекст выполнения
  if (import.meta.env.SSR) {
    // SSR - используем внутренний URL
    return 'http://127.0.0.1:4000/api';
  }
  
  // Клиент - проверяем режим разработки
  const apiUrl = import.meta.env.PUBLIC_API_BASE_URL ?? '/api';
  
  // В dev режиме используем полный URL, в production - относительный через nginx
  if (import.meta.env.DEV) {
    return 'http://localhost:4000/api';
  }
  
  return apiUrl;
}

