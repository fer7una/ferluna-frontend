import { useEffect, useState } from "react";

export function useWebGLAvailable() {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    setAvailable(Boolean(context));

    return () => {
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return available;
}
