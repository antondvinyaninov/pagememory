/**
 * Возвращает правильный API URL в зависимости от контекста выполнения
 * - На сервере (SSR): полный URL к localhost backend
 * - На клиенте (браузер): относительный URL через nginx
 */
export function getApiBaseUrl(): string {
  // В Astro import.meta.env доступен и на сервере, и на клиенте
  // Но на сервере относительные URL не работают с fetch
  
  // Проверяем контекст выполнения
  if (import.meta.env.SSR) {
    // SSR - используем внутренний URL
    return 'http://127.0.0.1:4000/api';
  }
  
  // Клиент - используем относительный URL через nginx
  return import.meta.env.PUBLIC_API_BASE_URL ?? '/api';
}

