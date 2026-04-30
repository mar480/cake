import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdvancedSearchFilters, AdvancedSearchState } from "@/types/advancedSearch";

type FilterChip = {
  key: string;
  label: string;
  field: "balance" | "periodType" | "xbrlType" | "isDimension" | "referenceParagraph";
  value: string | boolean;
  source?: string | null;
};

const FACET_CHIP_PALETTE = [
  "bg-sky-100 border-sky-300 text-sky-800",
  "bg-violet-100 border-violet-300 text-violet-800",
  "bg-emerald-100 border-emerald-300 text-emerald-800",
  "bg-amber-100 border-amber-300 text-amber-800",
  "bg-rose-100 border-rose-300 text-rose-800",
  "bg-cyan-100 border-cyan-300 text-cyan-800",
] as const;

const EMPTY_FILTERS: AdvancedSearchFilters = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  isDimension: [],
  fullType: [],
  abstract: [],
  nillable: [],
  substitutionGroup: [],
  referenceSource: null,
  referenceParagraph: [],
};

interface SearchResultsTabProps {
  state?: AdvancedSearchState;
  onFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunSearch: (nextOffset?: number) => void;
  onResetSearch: () => void;
  onNavigateToSearchNode?: (qname: string, network?: string) => void;
  onReturnToSearch?: () => void;
  networkLabels?: Record<string, string>;
  resultNetworks?: Record<string, string[]>;
  resultPresentationElrs?: Record<string, string[]>;
  hypercubeElrDefinitionsByQname?: Record<string, string[]>;
}

const SearchResultsTab: React.FC<SearchResultsTabProps> = ({
  state,
  onFiltersChange,
  onRunSearch,
  onResetSearch,
  onNavigateToSearchNode,
  onReturnToSearch,
  networkLabels,
  resultNetworks,
  resultPresentationElrs,
  hypercubeElrDefinitionsByQname,
}) => {
  const safeState: AdvancedSearchState = {
    query: state?.query ?? "",
    filters: state?.filters ?? EMPTY_FILTERS,
    results: state?.results ?? [],
    loading: state?.loading ?? false,
    error: state?.error ?? null,
    pagination: state?.pagination ?? { limit: 25, offset: 0, total: 0 },
    lastRunAt: state?.lastRunAt ?? null,
  };

  const { filters, results, loading, error, lastRunAt, pagination } = safeState;
  const { limit, offset, total } = pagination;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const from = total === 0 ? 0 : offset + 1;
  const to = total === 0 ? 0 : Math.min(offset + limit, total);

  const activeChips: FilterChip[] = useMemo(() => {
    const withString = (field: "balance" | "periodType" | "xbrlType", values: string[], labelPrefix: string) =>
      values.map((value) => ({
        key: `${field}:${value}`,
        label: `${labelPrefix}: ${value}`,
        field,
        value,
      }));

    return [
      ...withString("balance", filters.balance, "Balance"),
      ...withString("periodType", filters.periodType, "Period type"),
      ...withString("xbrlType", filters.xbrlType, "XBRL type"),
      ...filters.referenceParagraph.map((value) => ({
        key: `referenceParagraph:${filters.referenceSource ?? ""}:${value}`,
        label: `Reference: ${filters.referenceSource ?? ""}, ${value}`,
        field: "referenceParagraph" as const,
        value,
        source: filters.referenceSource,
      })),
      ...filters.isDimension.map((value) => ({
        key: `isDimension:${String(value)}`,
        label: value ? "Dimension: yes" : "Dimension: no",
        field: "isDimension" as const,
        value,
      })),
    ];
  }, [
    filters.balance,
    filters.isDimension,
    filters.periodType,
    filters.referenceParagraph,
    filters.referenceSource,
    filters.xbrlType,
  ]);

  const chipRegistryRef = useRef(new Map<string, FilterChip>());
  activeChips.forEach((chip) => {
    chipRegistryRef.current.set(chip.key, chip);
  });
  const chips = Array.from(chipRegistryRef.current.values());

  const [resultFilter, setResultFilter] = useState<{
    balance: string[];
    periodType: string[];
    xbrlType: string[];
  }>({ balance: [], periodType: [], xbrlType: [] });

  const resultFilterOptions = useMemo(() => {
    const balance = new Set<string>();
    const periodType = new Set<string>();
    const xbrlType = new Set<string>();
    results.forEach((result) => {
      if (result.balance) balance.add(result.balance);
      if (result.periodType) periodType.add(result.periodType);
      if (result.xbrlType) xbrlType.add(result.xbrlType);
    });
    return {
      balance: Array.from(balance).sort(),
      periodType: Array.from(periodType).sort(),
      xbrlType: Array.from(xbrlType).sort(),
    };
  }, [results]);

  useEffect(() => {
    setResultFilter((prev) => ({
      balance: prev.balance.filter((value) => resultFilterOptions.balance.includes(value)),
      periodType: prev.periodType.filter((value) => resultFilterOptions.periodType.includes(value)),
      xbrlType: prev.xbrlType.filter((value) => resultFilterOptions.xbrlType.includes(value)),
    }));
  }, [resultFilterOptions]);

  const isChipActive = (chip: FilterChip) => {
    if (chip.field === "isDimension") {
      return filters.isDimension.includes(Boolean(chip.value));
    }
    if (chip.field === "referenceParagraph") {
      return (
        filters.referenceParagraph.includes(String(chip.value)) &&
        (!chip.source || filters.referenceSource === chip.source)
      );
    }
    return filters[chip.field].includes(String(chip.value));
  };

  const toggleChip = (chip: FilterChip) => {
    const currentlyActive = isChipActive(chip);
    if (chip.field === "isDimension") {
      const nextValues = currentlyActive
        ? filters.isDimension.filter((value) => value !== Boolean(chip.value))
        : [...filters.isDimension, Boolean(chip.value)];
      onFiltersChange({ ...filters, isDimension: Array.from(new Set(nextValues)) });
      onRunSearch(0);
      return;
    }

    if (chip.field === "referenceParagraph") {
      const typedValue = String(chip.value);
      const nextValues = currentlyActive
        ? filters.referenceParagraph.filter((value) => value !== typedValue)
        : [...filters.referenceParagraph, typedValue];

      onFiltersChange({
        ...filters,
        referenceSource: nextValues.length > 0 ? chip.source ?? filters.referenceSource : null,
        referenceParagraph: Array.from(new Set(nextValues)),
      });
      onRunSearch(0);
      return;
    }

    const currentValues = filters[chip.field];
    const typedValue = String(chip.value);
    const nextValues = currentlyActive
      ? currentValues.filter((value) => value !== typedValue)
      : [...currentValues, typedValue];

    onFiltersChange({ ...filters, [chip.field]: Array.from(new Set(nextValues)) } as AdvancedSearchFilters);
    onRunSearch(0);
  };

  const facetColorMapRef = useRef(new Map<string, string>());
  chips.forEach((chip) => {
    if (!facetColorMapRef.current.has(chip.key)) {
      const nextClass =
        FACET_CHIP_PALETTE[facetColorMapRef.current.size % FACET_CHIP_PALETTE.length];
      facetColorMapRef.current.set(chip.key, nextClass);
    }
  });

  const clearAllFilters = () => {
    onFiltersChange(EMPTY_FILTERS);
    onRunSearch(0);
  };

  const metadataChipClass = (facetKey: string) =>
    facetColorMapRef.current.get(facetKey) ?? "bg-gray-100 border-gray-300 text-gray-700";

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      if (resultFilter.balance.length > 0 && (!result.balance || !resultFilter.balance.includes(result.balance))) {
        return false;
      }
      if (
        resultFilter.periodType.length > 0 &&
        (!result.periodType || !resultFilter.periodType.includes(result.periodType))
      ) {
        return false;
      }
      if (resultFilter.xbrlType.length > 0 && (!result.xbrlType || !resultFilter.xbrlType.includes(result.xbrlType))) {
        return false;
      }
      return true;
    });
  }, [resultFilter.balance, resultFilter.periodType, resultFilter.xbrlType, results]);

  const toggleResultFilterValue = (field: "balance" | "periodType" | "xbrlType", value: string) => {
    setResultFilter((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="border rounded">
        <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-600">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-base text-gray-700">Search results</div>
              <div className="mt-1">
                Showing {from}-{to} of {total}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="
                  min-w-[170px]
                  justify-center
                  border-2 border-slate-400
                  bg-sky-200
                  text-slate-800
                  hover:bg-sky-300
                  focus-visible:ring-1 focus-visible:ring-sky-300
                "
                onClick={onReturnToSearch}
              >
                Return to search query
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="
                  min-w-[170px]
                  justify-center
                  border-2 border-slate-400
                  bg-sky-50
                  text-slate-800
                  hover:bg-sky-100
                  focus-visible:ring-1 focus-visible:ring-sky-300
                "
                onClick={clearAllFilters}
                disabled={chips.length === 0}
              >
                Clear active facet filters
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="
                  min-w-[170px]
                  justify-center
                  border-2 border-slate-400
                  bg-sky-50
                  text-slate-800
                  hover:bg-sky-100
                  focus-visible:ring-1 focus-visible:ring-sky-300
                "
                onClick={onResetSearch}
              >
                Clear results
               </Button>
            </div>
          </div>
        </div>

        <div className="p-3 border-b bg-white">
          <div className="text-sm font-medium mb-2">Active facet filters (toggle on/off)</div>
          {chips.length === 0 ? (
            <div className="text-xs text-gray-500">No facet filters selected.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`text-xs px-2 py-1 rounded-full border ${
                    isChipActive(chip)
                      ? facetColorMapRef.current.get(chip.key)
                      : "bg-gray-100 border-gray-300 text-gray-500 line-through"
                  }`}
                  onClick={() => toggleChip(chip)}
                  title="Toggle filter and refresh results"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-b bg-white space-y-2">
          <div className="text-sm font-medium">Filter these results</div>
          <div className="grid grid-cols-3 gap-3">
            {(["balance", "periodType", "xbrlType"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <div className="text-xs font-medium text-gray-600">
                  {field === "periodType" ? "Period type" : field === "xbrlType" ? "XBRL type" : "Balance"}
                </div>
                <div className="border rounded p-2 max-h-24 overflow-auto space-y-1">
                  {resultFilterOptions[field].length === 0 ? (
                    <div className="text-xs text-gray-400">No options</div>
                  ) : (
                    resultFilterOptions[field].map((value) => (
                      <label key={`${field}-${value}`} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={resultFilter[field].includes(value)}
                          onChange={() => toggleResultFilterValue(field, value)}
                        />
                        <span>{value}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {filteredResults.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No results.</div>
        ) : (
          <ul className="divide-y">
            {filteredResults.map((result) => {
              const associatedNetworks = resultNetworks?.[result.qname] ?? [];
              const presentationElrs = resultPresentationElrs?.[result.qname] ?? [];
              const definitionHypercubeElrs = hypercubeElrDefinitionsByQname?.[result.qname] ?? [];
              const isDimensionMember = associatedNetworks.includes("definition_dommem");
              const goToNodeLabel = networkLabels?.presentation ?? "Presentation";

              return (
                <li key={result.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium text-sm break-words">{result.label || result.qname}</div>
                    <div className="text-xs text-gray-500 break-all">{result.qname}</div>
                    {presentationElrs.length > 0 && (
                      <div className="text-xs text-gray-500 break-words">
                        Presentation ELR: {presentationElrs.join(", ")}
                      </div>
                    )}
                    {definitionHypercubeElrs.length > 0 && (
                      <div className="text-xs text-gray-500 break-words">
                        Definition ELR: {definitionHypercubeElrs.join(", ")}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {result.balance && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${metadataChipClass(`balance:${result.balance}`)}`}>
                          Balance: {result.balance}
                        </span>
                      )}
                      {result.periodType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${metadataChipClass(`periodType:${result.periodType}`)}`}>
                          Period: {result.periodType}
                        </span>
                      )}
                      {result.xbrlType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${metadataChipClass(`xbrlType:${result.xbrlType}`)}`}>
                          XBRL: {result.xbrlType}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          isDimensionMember
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                            : "bg-gray-100 border-gray-300 text-gray-700"
                        }`}
                      >
                        Dimension member: {isDimensionMember ? "yes" : "no"}
                      </span>
                      {(result.referenceDisplays ?? []).map((referenceDisplay) => (
                        <span
                          key={`${result.id}-reference-${referenceDisplay}`}
                          className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 border-amber-300 text-amber-800"
                        >
                          Reference: {referenceDisplay}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="
                        rounded-r-none
                        border-2 border-slate-400
                        border-r border-r-slate-300
                        bg-sky-50
                        text-slate-800
                        hover:bg-sky-100
                        focus-visible:ring-1 focus-visible:ring-sky-300
                      "
                      onClick={() => onNavigateToSearchNode?.(result.qname, "presentation")}
                    >
                      Go to node
                    </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="
                            rounded-l-none
                            -ml-px px-2
                            border-2 border-slate-400
                            border-l border-l-slate-300
                            bg-sky-200
                            text-slate-800
                            hover:bg-sky-300
                            focus-visible:ring-1 focus-visible:ring-sky-300
                          "
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white opacity-100">
                        {associatedNetworks.length === 0 ? (
                          <DropdownMenuItem disabled>No networks available</DropdownMenuItem>
                        ) : (
                          associatedNetworks.map((networkKey) => (
                            <DropdownMenuItem
                              key={`${result.id}-${networkKey}`}
                              onClick={() => onNavigateToSearchNode?.(result.qname, networkKey)}
                            >
                              {networkLabels?.[networkKey] ?? networkKey}
                            </DropdownMenuItem>
                          ))
                        )}
                        {associatedNetworks.length > 0 && !associatedNetworks.includes("presentation") && (
                          <DropdownMenuItem onClick={() => onNavigateToSearchNode?.(result.qname, "presentation")}>
                            {goToNodeLabel}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-600">

          <div className="flex gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded border bg-white disabled:opacity-50"
              disabled={loading || !hasPrev}
              onClick={() => onRunSearch(Math.max(0, offset - limit))}
            >
              Previous
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border bg-white disabled:opacity-50"
              disabled={loading || !hasNext}
              onClick={() => onRunSearch(offset + limit)}
            >
              Next
            </button>
          </div>
        </div>
      </div>



      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
};

export default SearchResultsTab;
