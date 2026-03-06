import { useEffect } from "react";
import { initLoginPage } from "../../lib/init-login-page";

type Props = {
  apiBaseUrl: string;
};

export default function LoginPageIsland({ apiBaseUrl }: Props) {
  useEffect(() => {
    initLoginPage(apiBaseUrl);
  }, [apiBaseUrl]);

  return null;
}
