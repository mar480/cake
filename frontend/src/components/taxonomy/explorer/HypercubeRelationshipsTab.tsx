import React, { useMemo } from "react";

import HypercubeDisplay from "./HypercubeDisplay";
import {
  DimensionalRelationshipHypercube,
  DimensionalRelationshipsResponse,
} from "./apiTypes";

interface Props {
  qname: string;
  language: "en" | "cy";
  data: DimensionalRelationshipsResponse | null;
  loading: boolean;
  error: string | null;
  onNavigateToNode?: (qname: string) => void;
}

const sortHypercubesByElrId = (hypercubes: DimensionalRelationshipHypercube[] = []) =>
  [...hypercubes].sort((a, b) => {
    const left = typeof a.elr_id === "number" ? a.elr_id : Number.POSITIVE_INFINITY;
    const right = typeof b.elr_id === "number" ? b.elr_id : Number.POSITIVE_INFINITY;
    return left - right;
  });

const HypercubeRelationshipsPanel: React.FC<Props> = ({
  qname,
  language,
  data,
  loading,
  error,
  onNavigateToNode,
}) => {
  const response = useMemo<DimensionalRelationshipHypercube[]>(
    () => (Array.isArray(data?.hypercubes) ? sortHypercubesByElrId(data.hypercubes) : []),
    [data]
  );
  const selectionType = data?.selection?.concept_type ?? "";
  const matchedDimensions = data?.selection?.matched_dimensions ?? [];

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
              onNavigateToNode={onNavigateToNode}
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
