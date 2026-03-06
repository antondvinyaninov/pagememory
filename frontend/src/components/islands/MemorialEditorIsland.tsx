import { useEffect } from "react";
import { initMemorialEditor } from "../../lib/init-memorial-editor";

export default function MemorialEditorIsland() {
  useEffect(() => {
    initMemorialEditor();
  }, []);

  return null;
}
