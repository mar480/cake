import React, { useEffect, useState } from "react";
import TreeLocationsTab from "./TreeLocationsTab";
import { TreeLocationsPopOutPayload } from "./apiTypes";

const TreeLocationsPopOut: React.FC = () => {
  const [payload, setPayload] = useState<TreeLocationsPopOutPayload | null>(null);

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "TREE_LOCATIONS_POPOUT_READY" },
        window.location.origin
      );
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === "SET_TREE_LOCATIONS") {
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
      <TreeLocationsTab
        qname={payload.qname}
        locations={payload.locations}
        onNavigateToLocation={() => {}}
        showPopOutButton={false}
      />
    </div>
  );
};

export default TreeLocationsPopOut;
