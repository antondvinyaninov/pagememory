import { useEffect } from "react";
import { initUserEditPage } from "../../lib/init-user-edit-page";

type Props = {
  apiBaseUrl: string;
  s3BaseUrl: string;
};

export default function UserEditPageIsland({ apiBaseUrl, s3BaseUrl }: Props) {
  useEffect(() => {
    initUserEditPage(apiBaseUrl, s3BaseUrl);
  }, [apiBaseUrl, s3BaseUrl]);

  return null;
}
