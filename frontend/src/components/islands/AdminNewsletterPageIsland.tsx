import { useEffect } from "react";
import { initAdminNewsletterPage } from "../../lib/init-admin-newsletter-page";

type Props = {
  apiBaseUrl: string;
};

export default function AdminNewsletterPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initAdminNewsletterPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
