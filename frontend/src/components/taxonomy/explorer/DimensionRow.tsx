import React from "react";
import MemberDropdown from "./MemberDropdown";
import { DomainMember } from "./HypercubeDisplay";

interface DimensionRowProps {
  dimension: {
    dimensionName: string;
    definition: string;
    elr_id: number | null;
    defaultMember: string | null;
    domainMembers: DomainMember[];
    isSelectedDimension?: boolean;
    containsSelectedMember?: boolean;
  };
  language: "en" | "cy";
}

const DimensionRow: React.FC<DimensionRowProps> = ({ dimension, language }) => {
  return (
    <tr className="transition-colors">
      <td className="px-3 py-2 align-top text-sm text-slate-700 leading-snug break-words">
        <div className="space-y-1">
          <div>{dimension.definition}</div>
          <div className="text-xs text-slate-500 break-all">{dimension.dimensionName}</div>
          {(dimension.isSelectedDimension || dimension.containsSelectedMember) && (
            <div className="flex flex-wrap gap-1">
              {dimension.isSelectedDimension ? (
                <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  Selected dimension
                </span>
              ) : null}
              {dimension.containsSelectedMember ? (
                <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                  Contains selected member
                </span>
              ) : null}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <MemberDropdown
          members={dimension.domainMembers}
          defaultSelection={dimension.defaultMember}
          level={0}
          language={language}
        />
      </td>
    </tr>
  );
};

export default DimensionRow;
