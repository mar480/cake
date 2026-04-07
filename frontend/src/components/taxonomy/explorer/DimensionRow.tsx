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
  };
  language: "en" | "cy";
}

const DimensionRow: React.FC<DimensionRowProps> = ({ dimension, language }) => {
  return (
    <tr className="transition-colors">
      <td className="px-3 py-2 align-top text-sm text-slate-700 leading-snug break-words">
        {dimension.definition}
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