export function initAdminUsersPage(apiBaseUrl: string): void {
  const root = document.documentElement;
  if (root.dataset.adminUsersPageInitialized === "1") return;
  root.dataset.adminUsersPageInitialized = "1";

  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-delete-user");
      if (!id) return;
      if (!confirm("Удалить пользователя?")) return;
      const res = await fetch(`${apiBaseUrl}/admin/users/${id}`, {
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
