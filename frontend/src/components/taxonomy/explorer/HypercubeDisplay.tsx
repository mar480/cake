import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import DimensionRow from "./DimensionRow";
import PopOutButton from "./PopOutButton";
import RelationshipPrimaryItemsTree from "./RelationshipPrimaryItemsTree";
import { DimensionalRelationshipHypercube, RelationshipDomainMember } from "./apiTypes";

interface HypercubeDisplayProps {
  hypercube: DimensionalRelationshipHypercube;
  language: "en" | "cy";
  standalone?: boolean;
  sourceQName?: string;
  selectionType?: string;
}

export type DomainMember = RelationshipDomainMember;

const HypercubeDisplay: React.FC<HypercubeDisplayProps> = ({
  hypercube,
  language,
  standalone = false,
  sourceQName,
  selectionType = "concept",
}) => {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [showAllDimensions, setShowAllDimensions] = useState(false);
  const showPrimaryItemsFirst = selectionType !== "concept";

  const getDimensionCode = (d: { definition: string; dimensionName: string }) => {
    const source = d.definition || d.dimensionName || "";
    const match = source.match(/^(\d+)/);
    return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
  };

  const sortedDimensions = useMemo(
    () =>
      [...hypercube.dimensions].sort(
        (a, b) => getDimensionCode(a) - getDimensionCode(b)
      ),
    [hypercube.dimensions]
  );

  const visibleDimensions = showAllDimensions ? sortedDimensions : sortedDimensions.slice(0, 4);
  const hiddenDimensionCount = Math.max(sortedDimensions.length - visibleDimensions.length, 0);

  useEffect(() => {
    setOpenSections(
      showPrimaryItemsFirst ? ["primary-items", "dimensions"] : ["dimensions"]
    );
    setShowAllDimensions(false);
  }, [hypercube.hypercubeName, selectionType, showPrimaryItemsFirst]);

  return (
    <div
      className={`rounded-md border border-slate-200 shadow-sm ${
        standalone ? "bg-white min-w-[600px] p-4" : "bg-white/95 p-3"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-blue-700 leading-tight">
            {hypercube.definition}
          </h3>
          <p className="text-sm text-slate-500">{hypercube.hypercubeName}</p>
        </div>
        {!standalone ? (
          <PopOutButton hypercube={hypercube} language={language} sourceQName={sourceQName} />
        ) : null}
      </div>

      {(hypercube.isSelectedHypercube || hypercube.containsSelectedDimension) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {hypercube.isSelectedHypercube ? (
            <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
              Selected hypercube
            </span>
          ) : null}
          {hypercube.containsSelectedDimension ? (
            <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              Contains selected dimension/member
            </span>
          ) : null}
        </div>
      )}

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={(value) => setOpenSections(Array.isArray(value) ? value : [])}
        className="mb-4 w-full"
      >
        {showPrimaryItemsFirst ? (
          <>
            <AccordionItem value="primary-items" className="border rounded-md overflow-hidden">
              <AccordionTrigger className="px-3 py-2 text-sm font-semibold bg-slate-50">
                Primary items
              </AccordionTrigger>
              <AccordionContent className="px-2 py-3">
                {openSections.includes("primary-items") ? (
                  <RelationshipPrimaryItemsTree
                    nodes={hypercube.primaryItemsTree ?? []}
                    language={language}
                  />
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="dimensions" className="border rounded-md overflow-hidden mt-3">
              <AccordionTrigger className="px-3 py-2 text-sm font-semibold bg-slate-50">
                Dimensions
              </AccordionTrigger>
              <AccordionContent className="pt-3">
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
                    {visibleDimensions.map((dim, idx) => (
                      <DimensionRow key={idx} dimension={dim} language={language} />
                    ))}
                  </tbody>
                </table>
                {sortedDimensions.length > 4 ? (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowAllDimensions((current) => !current)}
                    >
                      {showAllDimensions
                        ? "Show fewer dimensions"
                        : `Show ${hiddenDimensionCount} more dimension${hiddenDimensionCount === 1 ? "" : "s"}`}
                    </button>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </>
        ) : (
          <>
            <AccordionItem value="dimensions" className="border rounded-md overflow-hidden">
              <AccordionTrigger className="px-3 py-2 text-sm font-semibold bg-slate-50">
                Dimensions
              </AccordionTrigger>
              <AccordionContent className="pt-3">
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
                    {visibleDimensions.map((dim, idx) => (
                      <DimensionRow key={idx} dimension={dim} language={language} />
                    ))}
                  </tbody>
                </table>
                {sortedDimensions.length > 4 ? (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowAllDimensions((current) => !current)}
                    >
                      {showAllDimensions
                        ? "Show fewer dimensions"
                        : `Show ${hiddenDimensionCount} more dimension${hiddenDimensionCount === 1 ? "" : "s"}`}
                    </button>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="primary-items" className="border rounded-md overflow-hidden mt-3">
              <AccordionTrigger className="px-3 py-2 text-sm font-semibold bg-slate-50">
                Primary items
              </AccordionTrigger>
              <AccordionContent className="px-2 py-3">
                {openSections.includes("primary-items") ? (
                  <RelationshipPrimaryItemsTree
                    nodes={hypercube.primaryItemsTree ?? []}
                    language={language}
                  />
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </>
        )}
      </Accordion>
    </div>
  );
};

export default HypercubeDisplay;
