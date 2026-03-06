import { useEffect } from "react";
import { initUserPrivacyPage } from "../../lib/init-user-privacy-page";

type Props = {
  apiBaseUrl: string;
};

export default function UserPrivacyPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initUserPrivacyPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
