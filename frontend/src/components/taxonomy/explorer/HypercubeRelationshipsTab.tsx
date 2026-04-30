import React, { useEffect, useState } from "react";

import HypercubeDisplay from "./HypercubeDisplay";
import {
  DimensionalRelationshipHypercube,
  DimensionalRelationshipsResponse,
} from "./apiTypes";

interface Props {
  qname: string;
  language: "en" | "cy";
  year: string;
  href: string;
}

const HypercubeRelationshipsPanel: React.FC<Props> = ({
  qname,
  language,
  year,
  href,
}) => {
  const [response, setResponse] = useState<DimensionalRelationshipHypercube[] | null>(null);
  const [selectionType, setSelectionType] = useState("");
  const [matchedDimensions, setMatchedDimensions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!year || !href) {
      setResponse([]);
      setSelectionType("");
      setMatchedDimensions([]);
      setError("No active taxonomy context.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch("/api/dimensional-relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qname, year, href }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: DimensionalRelationshipsResponse) => {
        const sortedHypercubes = Array.isArray(data.hypercubes)
          ? [...data.hypercubes].sort((a, b) => {
              const left = typeof a.elr_id === "number" ? a.elr_id : Number.POSITIVE_INFINITY;
              const right = typeof b.elr_id === "number" ? b.elr_id : Number.POSITIVE_INFINITY;
              return left - right;
            })
          : [];
        setResponse(sortedHypercubes);
        setSelectionType(data.selection?.concept_type ?? "");
        setMatchedDimensions(data.selection?.matched_dimensions ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching dimensional relationships:", err);
        setError("Failed to fetch data from backend.");
        setLoading(false);
      });
  }, [href, qname, year]);

  const contextLabel =
    selectionType === "hypercube"
      ? "hypercube"
      : selectionType === "dimension"
        ? "dimension"
        : selectionType === "dimension member"
          ? "dimension member"
          : "concept";

  return (
    <div className="p-4 text-gray-700">
      {loading ? (
        <p className="mb-2 text-sm text-gray-500">
          Loading relationships for <strong>{qname}</strong>...
        </p>
      ) : !error ? (
        <div className="mb-3 space-y-1 text-sm text-gray-500">
          <p>
            Showing dimensional relationships for {contextLabel} <strong>{qname}</strong>
          </p>
          {selectionType === "dimension member" && matchedDimensions.length > 0 ? (
            <p>
              Matched dimension{matchedDimensions.length === 1 ? "" : "s"}:{" "}
              {matchedDimensions.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && response && response.length > 0 && (
        <div className="space-y-6">
          {response.map((hypercube) => (
            <HypercubeDisplay
              key={hypercube.hypercubeName}
              hypercube={hypercube}
              language={language}
              sourceQName={qname}
              selectionType={selectionType}
            />
          ))}
        </div>
      )}

      {!loading && !error && Array.isArray(response) && response.length === 0 && (
        <p className="text-sm text-gray-500">No dimensional relationships found.</p>
      )}
    </div>
  );
};

export default HypercubeRelationshipsPanel;
