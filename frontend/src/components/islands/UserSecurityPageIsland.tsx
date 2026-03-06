import { useEffect } from "react";
import { initUserSecurityPage } from "../../lib/init-user-security-page";

type Props = {
  apiBaseUrl: string;
};

export default function UserSecurityPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initUserSecurityPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
