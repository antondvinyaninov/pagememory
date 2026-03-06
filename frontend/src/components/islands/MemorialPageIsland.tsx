import { useEffect } from "react";
import { initMemorialPage } from "../../lib/init-memorial-page";

export default function MemorialPageIsland() {
  useEffect(() => {
    initMemorialPage();
  }, []);

  return null;
}
