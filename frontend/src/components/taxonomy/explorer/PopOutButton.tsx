import React from "react";
import { DimensionalRelationshipHypercube } from "./apiTypes";

interface PopOutButtonProps {
  hypercube: DimensionalRelationshipHypercube;
  language: "en" | "cy";
  sourceQName?: string;
}

const PopOutButton: React.FC<PopOutButtonProps> = ({
  hypercube,
  language,
  sourceQName,
}) => 
  
  {  const openPopoutWindow = () => {
    const popout = window.open(
      "/hypercube-popout",
      "_blank",
      "width=900,height=700,resizable,scrollbars"
    );

    // Poll until the window is ready and then send the hypercube
    if (!popout) {
      return;
    }

      const sendData = (event: MessageEvent) => {
      const fromPopout = event.source === popout;
      const ready = event.data?.type === "HYPERCUBE_POPOUT_READY";

      if (fromPopout && ready) {
        popout.postMessage(
          {
            type: "SET_HYPERCUBE",
            payload: {
              hypercube,
              language,
              sourceQName,
            },
          },
          window.location.origin
        );
        window.removeEventListener("message", sendData);
        window.clearTimeout(cleanupTimeout);
      }
    };

    window.addEventListener("message", sendData);
    const cleanupTimeout = window.setTimeout(() => {
      window.removeEventListener("message", sendData);
    }, 10000);
  };

  return (
    <button
      onClick={openPopoutWindow}
      className="text-sm text-blue-600 hover:underline"
      title="Pop out"
    >
      Open in new window
    </button>
  );
};

export default PopOutButton;
