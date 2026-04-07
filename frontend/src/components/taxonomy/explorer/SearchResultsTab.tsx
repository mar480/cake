import React, { useMemo, useRef } from "react";
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
  active: boolean;
  toggle: (active: boolean) => void;
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

  const chips: FilterChip[] = useMemo(() => {
    const withString = (
      field: keyof AdvancedSearchFilters,
      values: string[],
      labelPrefix: string
    ) =>
      values.map((value) => ({
        key: `${String(field)}:${value}`,
        label: `${labelPrefix}: ${value}`,
        active: true,
        toggle: (active: boolean) => {
          const nextValues = active ? [...values, value] : values.filter((v) => v !== value);
          onFiltersChange({ ...filters, [field]: nextValues } as AdvancedSearchFilters);
          onRunSearch(0);
        },
      }));

    return [
      ...withString("balance", filters.balance, "Balance"),
      ...withString("periodType", filters.periodType, "Period type"),
      ...withString("xbrlType", filters.xbrlType, "XBRL type"),
      ...filters.isDimension.map((value) => ({
        key: `isDimension:${String(value)}`,
        label: value ? "Dimension: yes" : "Dimension: no",
        active: true,
        toggle: (active: boolean) => {
          const nextValues = active
            ? [...filters.isDimension, value]
            : filters.isDimension.filter((v) => v !== value);
          onFiltersChange({ ...filters, isDimension: nextValues });
          onRunSearch(0);
        },
      })),
    ];
  }, [filters, onFiltersChange, onRunSearch]);

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

  return (
    <div className="p-4 space-y-4">
      <div className="border rounded">
        <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-600">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-base text-gray-700">Search results</div>
              <div className="mt-1">
                {lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleString()}` : "No search run yet"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded border bg-white text-xs hover:bg-gray-100"
                onClick={clearAllFilters}
                disabled={chips.length === 0}
              >
                Clear filters
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border bg-white text-xs hover:bg-gray-100"
                onClick={onResetSearch}
              >
                Clear results
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 border-b bg-white">
          <div className="text-sm font-medium mb-2">Active facet filters (toggle)</div>
          {chips.length === 0 ? (
            <div className="text-xs text-gray-500">No facet filters selected.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`text-xs px-2 py-1 rounded-full border ${facetColorMapRef.current.get(chip.key)}`}
                  onClick={() => chip.toggle(false)}
                  title="Toggle filter off and refresh results"
                >
                  {chip.label} ×
                </button>
              ))}
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No results.</div>
        ) : (
          <ul className="divide-y">
            {results.map((result) => {
              const associatedNetworks = resultNetworks?.[result.qname] ?? [];
              const goToNodeLabel = networkLabels?.presentation ?? "Presentation";

              return (
                <li key={result.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium text-sm break-words">{result.label || result.qname}</div>
                    <div className="text-xs text-gray-500 break-all">{result.qname}</div>
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
                        className={`text-xs px-2 py-0.5 rounded-full border ${metadataChipClass(`isDimension:${String(Boolean(result.isDimension))}`)}`}
                      >
                        Dimension: {result.isDimension ? "yes" : "no"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-r-none border-r-0"
                      onClick={() => onNavigateToSearchNode?.(result.qname, "presentation")}
                    >
                      Go to node
                    </Button>
                    <div className="h-8 border-y border-l border-gray-300 flex items-center px-2 text-gray-400">|</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="rounded-l-none px-2">
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
          <span>
            Showing {from}-{to} of {total}
          </span>
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

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onReturnToSearch}>
          Return to search query
        </Button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
};

export default SearchResultsTab;
