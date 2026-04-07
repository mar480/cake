import React, { useEffect, useState } from "react";
import HypercubeDisplay from "./HypercubeDisplay";

interface Props {
  qname: string;
  language: "en" | "cy";
}

const HypercubeRelationshipsPanel: React.FC<Props> = ({ qname, language }) => {
  const [response, setResponse] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    console.log("Sending qname to /api/hello:", qname);

    fetch("/api/hello", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qname }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.hypercubes && Array.isArray(data.hypercubes)) {
          setResponse(data.hypercubes);
        } else {
          setResponse([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching from Flask:", err);
        setError("Failed to fetch data from backend.");
        setLoading(false);
      });
  }, [qname]);

  return (
    <div className="p-4 text-gray-700">
      {loading ? (
        <p className="mb-2 text-sm text-gray-500">
          Loading relationships for <strong>{qname}</strong>…
        </p>
      ) : !error ? (
        <p className="mb-2 text-sm text-gray-500">
          Showing relationships for <strong>{qname}</strong>
        </p>
      ) : null}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && response && response.length > 0 && (
        <div className="space-y-6">
          {response.map((hypercube, idx) => (
            <HypercubeDisplay
              key={idx}
              hypercube={hypercube}
              language={language}
              sourceQName={qname}
            />
          ))}
        </div>
      )}

      {!loading && !error && Array.isArray(response) && response.length === 0 && (
        <p className="text-sm text-gray-500">No hypercube relationships found.</p>
      )}
    </div>
  );
};

export default HypercubeRelationshipsPanel;