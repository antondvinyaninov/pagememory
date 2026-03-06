import { useEffect } from "react";
import { initAdminUsersPage } from "../../lib/init-admin-users-page";

type Props = {
  apiBaseUrl: string;
};

export default function AdminUsersPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initAdminUsersPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
