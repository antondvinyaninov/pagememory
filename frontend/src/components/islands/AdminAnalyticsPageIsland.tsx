import { useEffect } from "react";
import { initAdminAnalyticsPage } from "../../lib/init-admin-analytics-page";

type Props = {
  apiBaseUrl: string;
};

export default function AdminAnalyticsPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initAdminAnalyticsPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
