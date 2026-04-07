import React, { useRef } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AdvancedSearchFilterOptions,
  AdvancedSearchFilters,
  AdvancedSearchState,
} from "@/types/advancedSearch";

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

const EMPTY_FILTER_OPTIONS: AdvancedSearchFilterOptions = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  isDimension: [true, false],
  fullType: [],
  abstract: [true, false],
  nillable: [true, false],
  substitutionGroup: [],
  referenceSources: [],
};

interface AdvancedSearchTabProps {
  state?: AdvancedSearchState;
  filterOptions?: AdvancedSearchFilterOptions;
  referenceParagraphsBySource?: Record<string, string[]>;
  onQueryChange: (query: string) => void;
  onFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunSearch: (nextOffset?: number) => void;
  onResetSearch: () => void;
  onNavigateToSearchNode?: (qname: string, network?: string) => void;
  networkLabels?: Record<string, string>;
  resultNetworks?: Record<string, string[]>;
  year?: string | null;
}

const FACET_CHIP_PALETTE = [
  "bg-sky-100 border-sky-300 text-sky-800",
  "bg-violet-100 border-violet-300 text-violet-800",
  "bg-emerald-100 border-emerald-300 text-emerald-800",
  "bg-amber-100 border-amber-300 text-amber-800",
  "bg-rose-100 border-rose-300 text-rose-800",
  "bg-cyan-100 border-cyan-300 text-cyan-800",
] as const;

const FieldLabelWithHelp: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <div className="flex items-center gap-1">
    <span className="text-sm font-medium">{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-gray-400 hover:text-gray-600">
          <Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs text-xs bg-white text-gray-900 border-gray-300 opacity-100">
        {help}
      </TooltipContent>
    </Tooltip>
  </div>
);

function toggleString(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function toggleBoolean(values: boolean[], value: boolean): boolean[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

type FilterChip = {
  key: string;
  label: string;
  remove: () => void;
};

function normalizeReferenceSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeReferenceParagraph(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

const StringCheckboxGroup: React.FC<{
  label: string;
  help: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}> = ({ label, help, options, selected, onChange }) => (
  <div className="space-y-1">
    <FieldLabelWithHelp label={label} help={help} />
    <div className="border rounded p-2 max-h-40 overflow-auto space-y-1">
      {options.length === 0 ? (
        <div className="text-xs text-gray-500">No options available.</div>
      ) : (
        options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={() => onChange(toggleString(selected, opt))}
            />
            <span>{opt}</span>
          </label>
        ))
      )}
    </div>
  </div>
);

const BooleanCheckboxGroup: React.FC<{
  label: string;
  help: string;
  selected: boolean[];
  onChange: (next: boolean[]) => void;
}> = ({ label, help, selected, onChange }) => (
  <div className="space-y-1">
    <FieldLabelWithHelp label={label} help={help} />
    <div className="border rounded p-2 grid grid-cols-2 gap-2">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={selected.includes(true)}
          onCheckedChange={() => onChange(toggleBoolean(selected, true))}
        />
        <span>true</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={selected.includes(false)}
          onCheckedChange={() => onChange(toggleBoolean(selected, false))}
        />
        <span>false</span>
      </label>
    </div>
  </div>
);

const AdvancedSearchTab: React.FC<AdvancedSearchTabProps> = ({
  state,
  filterOptions,
  referenceParagraphsBySource,
  onQueryChange,
  onFiltersChange,
  onRunSearch,
  onResetSearch,
  onNavigateToSearchNode,
  networkLabels,
  resultNetworks,
  year,
}) => {

    const normalizedFilters: AdvancedSearchFilters = {
    ...EMPTY_FILTERS,
    ...(state?.filters ?? {}),
    referenceSource: normalizeReferenceSource(state?.filters?.referenceSource),
    referenceParagraph: normalizeReferenceParagraph(state?.filters?.referenceParagraph),
  };

  const safeState: AdvancedSearchState = {
    query: state?.query ?? "",
    filters: normalizedFilters,
    results: state?.results ?? [],
    loading: state?.loading ?? false,
    error: state?.error ?? null,
    pagination: state?.pagination ?? { limit: 25, offset: 0, total: 0 },
    lastRunAt: state?.lastRunAt ?? null,
  };

  const safeFilterOptions = filterOptions ?? EMPTY_FILTER_OPTIONS;
  const safeReferenceParagraphsBySource = referenceParagraphsBySource ?? {};

  const { query, filters, results, loading, error, lastRunAt, pagination } = safeState;
  const { limit, offset, total } = pagination;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const from = total === 0 ? 0 : offset + 1;
  const to = total === 0 ? 0 : Math.min(offset + limit, total);

  const paragraphOptions =
    filters.referenceSource
      ? safeReferenceParagraphsBySource[filters.referenceSource] || []
      : [];

  const isLloydsTaxonomySelected = year === "lloyds-2025";
  const balanceHelpText = isLloydsTaxonomySelected
    ? "The concepts in the Lloyd’s taxonomy do not rely on the debit and credit types functionality from the standard taxonomy."
    : "Accounting balance type.";

  const chips: FilterChip[] = [
    ...filters.balance.map((value) => ({
      key: `balance:${value}`,
      label: `Balance: ${value}`,
      remove: () => onFiltersChange({ ...filters, balance: filters.balance.filter((v) => v !== value) }),
    })),
    ...filters.periodType.map((value) => ({
      key: `periodType:${value}`,
      label: `Period type: ${value}`,
      remove: () => onFiltersChange({ ...filters, periodType: filters.periodType.filter((v) => v !== value) }),
    })),
    ...filters.xbrlType.map((value) => ({
      key: `xbrlType:${value}`,
      label: `XBRL type: ${value}`,
      remove: () => onFiltersChange({ ...filters, xbrlType: filters.xbrlType.filter((v) => v !== value) }),
    })),
    ...filters.isDimension.map((value) => ({
      key: `isDimension:${String(value)}`,
      label: value ? "Dimension: yes" : "Dimension: no",
      remove: () =>
        onFiltersChange({ ...filters, isDimension: filters.isDimension.filter((v) => v !== value) }),
    })),
    ...filters.fullType.map((value) => ({
      key: `fullType:${value}`,
      label: `Full type: ${value}`,
      remove: () => onFiltersChange({ ...filters, fullType: filters.fullType.filter((v) => v !== value) }),
    })),
    ...filters.namespace.map((value) => ({
      key: `namespace:${value}`,
      label: `Namespace: ${value}`,
      remove: () => onFiltersChange({ ...filters, namespace: filters.namespace.filter((v) => v !== value) }),
    })),
    ...filters.substitutionGroup.map((value) => ({
      key: `substitutionGroup:${value}`,
      label: `Substitution group: ${value}`,
      remove: () =>
        onFiltersChange({
          ...filters,
          substitutionGroup: filters.substitutionGroup.filter((v) => v !== value),
        }),
    })),
    ...filters.abstract.map((value) => ({
      key: `abstract:${String(value)}`,
      label: `Abstract: ${String(value)}`,
      remove: () => onFiltersChange({ ...filters, abstract: filters.abstract.filter((v) => v !== value) }),
    })),
    ...filters.nillable.map((value) => ({
      key: `nillable:${String(value)}`,
      label: `Nillable: ${String(value)}`,
      remove: () => onFiltersChange({ ...filters, nillable: filters.nillable.filter((v) => v !== value) }),
    })),
    ...(filters.referenceSource
      ? [
          {
            key: `referenceSource:${filters.referenceSource}`,
            label: `Source: ${filters.referenceSource}`,
            remove: () => onFiltersChange({ ...filters, referenceSource: null, referenceParagraph: [] }),
          },
        ]
      : []),
    ...filters.referenceParagraph.map((value) => ({
      key: `referenceParagraph:${value}`,
      label: `Paragraph: ${value}`,
      remove: () =>
        onFiltersChange({
          ...filters,
          referenceParagraph: filters.referenceParagraph.filter((v) => v !== value),
        }),
    })),
  ];

  const facetColorMapRef = useRef(new Map<string, string>());
  chips.forEach((chip) => {
    if (!facetColorMapRef.current.has(chip.key)) {
      const nextClass =
        FACET_CHIP_PALETTE[facetColorMapRef.current.size % FACET_CHIP_PALETTE.length];
      facetColorMapRef.current.set(chip.key, nextClass);
    }
  });

  const removeChipAndSearch = (chip: FilterChip) => {
    chip.remove();
    onRunSearch(0);
  };

  const clearAllFilters = () => {
    onFiltersChange(EMPTY_FILTERS);
    onRunSearch(0);
  };


  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4 space-y-4">
        <div className="flex items-end gap-2">
          <div className="space-y-1 flex-1">
            <FieldLabelWithHelp
              label="Keyword"
              help="Free-text search term. Use this with filters below."
            />
            <input
              type="text"
              className="border rounded p-2 text-sm w-full max-w-2xl"
              placeholder="e.g. turnover, revenue, core:TurnoverRevenue"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRunSearch(0);
                }
              }}
            />
          </div>
          <div className="flex gap-2 pb-[1px]">
            <button
              className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
              onClick={() => onRunSearch(0)}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
            <button className="bg-gray-200 text-sm px-3 py-1 rounded" onClick={onResetSearch}>
              Reset
            </button>
          </div>
        </div>
        
        
               <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Active facet filters</div>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border bg-white disabled:opacity-50"
              onClick={clearAllFilters}
              disabled={chips.length === 0}
            >
              Clear all filters
            </button>
          </div>
          {chips.length === 0 ? (
            <div className="text-xs text-gray-500">No facet filters selected.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`text-xs px-2 py-1 rounded-full border hover:brightness-95 ${facetColorMapRef.current.get(chip.key) ?? "bg-gray-100 border-gray-300 text-gray-800"}`}
                  onClick={() => removeChipAndSearch(chip)}
                  title="Remove filter and search again"
                >
                  {chip.label} ×
                </button>
              ))}
            </div>
          )}
        </div>

        <Accordion type="multiple" defaultValue={["search-filters", "references"]} className="w-full space-y-3">
          <AccordionItem value="search-filters" className="border rounded-md overflow-hidden">
            <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-blue-100 rounded">
              Search filters
            </AccordionTrigger>
            <AccordionContent className="pt-3 space-y-3">
                <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 items-start">
                  <StringCheckboxGroup
                    label="Balance"
                    help={balanceHelpText}
                    options={safeFilterOptions.balance}
                    selected={filters.balance}
                    onChange={(next) => onFiltersChange({ ...filters, balance: next })}
                  />
                  <StringCheckboxGroup
                    label="Period type"
                    help="Duration or instant."
                    options={safeFilterOptions.periodType}
                    selected={filters.periodType}
                    onChange={(next) => onFiltersChange({ ...filters, periodType: next })}
                  />
                </div>
                <StringCheckboxGroup
                  label="XBRL type"
                  help="Base XBRL type."
                  options={safeFilterOptions.xbrlType}
                  selected={filters.xbrlType}
                  onChange={(next) => onFiltersChange({ ...filters, xbrlType: next })}
                />
                <BooleanCheckboxGroup
                  label="Dimension"
                  help="Filter concepts by substitution group xbrldt:dimensionItem."
                  selected={filters.isDimension}
                  onChange={(next) => onFiltersChange({ ...filters, isDimension: next })}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="references" className="border rounded-md overflow-hidden">
            <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-blue-100 rounded">
              References
            </AccordionTrigger>
            <AccordionContent className="pt-3 space-y-3">
  <div className="p-3">
                <div className="grid grid-cols-2 gap-3 items-start">
                  <div className="space-y-2">
                    <FieldLabelWithHelp
                      label="Source"
                      help="Reference source, e.g. FRS 102."
                    />
                    <select
                      className="border rounded p-2 text-sm w-full bg-white"
                      value={filters.referenceSource || ""}
                      onChange={(e) =>
                        onFiltersChange({
                          ...filters,
                          referenceSource: e.target.value || null,
                          referenceParagraph: [],
                        })
                      }
                    >
                      <option value="">Any source</option>
                      {safeFilterOptions.referenceSources.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <FieldLabelWithHelp
                      label="Paragraph"
                      help="Paragraph list filtered by selected source."
                    />
                    <select
                      multiple
                      size={Math.min(10, Math.max(4, paragraphOptions.length))}
                      className="border rounded p-2 text-sm w-full bg-white"
                      value={filters.referenceParagraph}
                      disabled={!filters.referenceSource}
                      onChange={(e) =>
                        onFiltersChange({
                          ...filters,
                          referenceParagraph: Array.from(e.target.selectedOptions)
                            .map((option) => option.value)
                            .filter((value) => value.trim().length > 0),
                        })
                      }
                    >
                      {paragraphOptions.map((paragraph) => (
                        <option key={paragraph} value={paragraph}>
                          {paragraph}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-500">
                      Hold Ctrl/Cmd to select multiple paragraphs.
                    </div>
                  </div>
                </div>
              </div>
</AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced-xbrl" className="border rounded-md overflow-hidden">
            <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-blue-100 rounded">
              Advanced XBRL filters
            </AccordionTrigger>
            <AccordionContent className="pt-3 space-y-3">
              <div className="p-3 space-y-3">
              <StringCheckboxGroup
                label="Full type"
                help="Qualified type QName."
                options={safeFilterOptions.fullType}
                selected={filters.fullType}
                onChange={(next) => onFiltersChange({ ...filters, fullType: next })}
              />
              <BooleanCheckboxGroup
                label="Abstract"
                help="Whether concept is abstract."
                selected={filters.abstract}
                onChange={(next) => onFiltersChange({ ...filters, abstract: next })}
              />
              <BooleanCheckboxGroup
                label="Nillable"
                help="Whether concept is nillable."
                selected={filters.nillable}
                onChange={(next) => onFiltersChange({ ...filters, nillable: next })}
              />
              <StringCheckboxGroup
                label="Namespace"
                help="Concept namespace URI."
                options={safeFilterOptions.namespace}
                selected={filters.namespace}
                onChange={(next) => onFiltersChange({ ...filters, namespace: next })}
              />
              <StringCheckboxGroup
                label="Substitution group"
                help="Substitution group QName."
                options={safeFilterOptions.substitutionGroup}
                selected={filters.substitutionGroup}
                onChange={(next) => onFiltersChange({ ...filters, substitutionGroup: next })}
              />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="border rounded">
          <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-600">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-base text-gray-700">Search results</div>
                <div className="mt-1">
                  {lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleString()}` : "No search run yet"}
                </div>
              </div>
              <button
                type="button"
                className="px-2 py-1 rounded border bg-white text-xs hover:bg-gray-100"
                onClick={() => {
                  onQueryChange("");
                  onResetSearch();
                }}
              >
                Clear results
              </button>
            </div>
          </div>
          {results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No results.</div>
          ) : (
            <ul className="divide-y">
              {results.map((result) => {
                const associatedNetworks = resultNetworks?.[result.qname] ?? [];
                const goToNodeLabel = networkLabels?.presentation ?? "Presentation";
                const matchingFacetKey = result.xbrlType ? `xbrlType:${result.xbrlType}` : "";
                const matchingFacetClass = matchingFacetKey
                  ? facetColorMapRef.current.get(matchingFacetKey)
                  : undefined;

                return (
                  <li key={result.id} className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-sm break-words">{result.label || result.qname}</div>
                      <div className="text-xs text-gray-500 break-all">{result.qname}</div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {result.balance && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-white">Balance: {result.balance}</span>
                        )}
                        {result.periodType && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-white">Period: {result.periodType}</span>
                        )}
                        {result.xbrlType && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              matchingFacetClass ?? "bg-gray-100 border-gray-300 text-gray-700"
                            }`}
                          >
                            XBRL: {result.xbrlType}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-white">
                          Dimension: {result.isDimension ? "yes" : "no"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-r-none"
                        onClick={() => onNavigateToSearchNode?.(result.qname, "presentation")}
                      >
                        Go to node
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="secondary" size="sm" className="rounded-l-none px-2">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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



        {error && <div className="text-sm text-red-600">{error}</div>}

        
      </div>
    </TooltipProvider>
  );
};

export default AdvancedSearchTab;
