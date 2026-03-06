import { useEffect } from "react";
import { initAdminMemorialsPage } from "../../lib/init-admin-memorials-page";

type Props = {
  apiBaseUrl: string;
};

export default function AdminMemorialsPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initAdminMemorialsPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
