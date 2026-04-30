import React, { useMemo } from "react";
import DimensionRow from "./DimensionRow";
import PopOutButton from "./PopOutButton";

interface HypercubeDisplayProps {
  hypercube: {
    hypercubeName: string;
    hypercubeELR: string;
    definition: string;
    dimensions: {
      dimensionName: string;
      dimensionELR: string;
      definition: string;
      elr_id: number | null;
      defaultMember: string | null;
      domainMembers: DomainMember[];
    }[];
  };
  language: "en" | "cy";
  standalone?: boolean;
  sourceQName?: string;
}

export interface DomainMember {
  name: string;
  label: string;
  label_cy: string;
  children: DomainMember[];
}

const HypercubeDisplay: React.FC<HypercubeDisplayProps> = ({
  hypercube,
  language,
  standalone = false,
  sourceQName,
}) => {
  const getDimensionCode = (d: { definition: string; dimensionName: string }) => {
    const source = d.definition || d.dimensionName || "";
    const match = source.match(/^(\d+)/);
    return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
  };

  const sortedDimensions = useMemo(
    () =>
      [...hypercube.dimensions].sort(
        (a, b) => getDimensionCode(b) - getDimensionCode(a)
      ),
    [hypercube.dimensions]
  );

  return (
    <div
      className={`rounded-md border border-slate-200 shadow-sm ${
        standalone ? "bg-white min-w-[600px] p-4" : "bg-white/95 p-3"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-blue-700 leading-tight">
          {hypercube.definition}
        </h3>
        <PopOutButton hypercube={hypercube} language={language} sourceQName={sourceQName}/>
      </div>

      <table className="w-full text-left text-sm border-y border-slate-200 table-fixed">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="w-[45%] px-3 py-1.5 font-semibold text-slate-700 border-b border-slate-200">
              Dimension
            </th>
            <th className="w-[55%] px-3 py-1.5 font-semibold text-slate-700 border-b border-slate-200">
              Members
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 [&_tr:hover]:bg-blue-50/40 transition-colors">
          {sortedDimensions.map((dim, idx) => (
            <DimensionRow key={idx} dimension={dim} language={language} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HypercubeDisplay;