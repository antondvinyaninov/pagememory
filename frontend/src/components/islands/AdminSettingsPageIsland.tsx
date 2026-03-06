import { useEffect } from "react";
import { initAdminSettingsPage } from "../../lib/init-admin-settings-page";

type Props = {
  apiBaseUrl: string;
};

export default function AdminSettingsPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initAdminSettingsPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
