import React, { useEffect, useState } from "react";
import HypercubeDisplay from "./HypercubeDisplay";

import { PopOutPayload } from "./apiTypes";


const HypercubePopOut = () => {
  const [payload, setPayload] = useState<PopOutPayload | null>(null);

  useEffect(() => {
      if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "HYPERCUBE_POPOUT_READY" }, window.location.origin);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === "SET_HYPERCUBE") {
        setPayload(event.data.payload);
      }
    };
    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!payload) {
    return <p className="p-4 text-gray-600">Waiting for data…</p>;
  }

  return (
    <div className="p-4 text-gray-700">
      {payload.sourceQName && (
        <p className="mb-2 text-sm text-gray-500">
          Showing relationships for <strong>{payload.sourceQName}</strong>
        </p>
      )}
      <HypercubeDisplay
        hypercube={payload.hypercube}
        language={payload.language}
        sourceQName={payload.sourceQName}
      />
    </div>
  );
};

export default HypercubePopOut;
