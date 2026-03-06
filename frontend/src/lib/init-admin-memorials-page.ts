export function initAdminMemorialsPage(apiBaseUrl: string): void {
  const root = document.documentElement;
  if (root.dataset.adminMemorialsPageInitialized === "1") return;
  root.dataset.adminMemorialsPageInitialized = "1";

  document.querySelectorAll("[data-delete-memorial]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-delete-memorial");
      if (!id) return;
      if (!confirm("Удалить мемориал?")) return;
      const res = await fetch(`${apiBaseUrl}/admin/memorials/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`Ошибка удаления: ${text}`);
        return;
      }
      window.location.reload();
    });
  });
}
