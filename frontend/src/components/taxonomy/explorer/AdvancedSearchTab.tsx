import React from "react";
import { Info } from "lucide-react";
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
  AdvancedSearchFilterOptions,
  AdvancedSearchFilters,
  AdvancedSearchState,
} from "@/types/advancedSearch";

const EMPTY_FILTERS: AdvancedSearchFilters = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  conceptType: [],
  fullType: [],
  abstract: [],
  nillable: [],
  substitutionGroup: [],
  referenceSource: null,
  referenceParagraph: [],
  excludeNotInPresentationTree: false,
};

const EMPTY_FILTER_OPTIONS: AdvancedSearchFilterOptions = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  conceptType: [],
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
  onOpenResultsTab?: () => void;
  onResetSearch: () => void;
  year?: string | null;
}

const FieldLabelWithHelp: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <div className="flex items-center gap-1">
    <span className="text-sm font-medium">{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-gray-400 hover:text-gray-600">
          <Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs border-gray-300 bg-white text-xs text-gray-900 opacity-100">
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
  listClassName?: string;
}> = ({ label, help, options, selected, onChange, listClassName }) => (
  <div className="space-y-1">
    <FieldLabelWithHelp label={label} help={help} />
    <div className={`max-h-40 space-y-1 overflow-auto rounded border p-2 ${listClassName ?? ""}`}>
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded border px-3 py-2">
      <label className="flex items-center gap-2 whitespace-nowrap text-sm">
        <Checkbox
          checked={selected.includes(true)}
          onCheckedChange={() => onChange(toggleBoolean(selected, true))}
        />
        <span>true</span>
      </label>
      <label className="flex items-center gap-2 whitespace-nowrap text-sm">
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
  onOpenResultsTab,
  onResetSearch,
  year,
}) => {
  const searchFiltersCardRef = React.useRef<HTMLDivElement | null>(null);
  const [matchedTopRowHeight, setMatchedTopRowHeight] = React.useState<number | null>(null);

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
    allResults: state?.allResults ?? [],
    hasRun: state?.hasRun ?? false,
    loading: state?.loading ?? false,
    exportLoading: state?.exportLoading ?? false,
    error: state?.error ?? null,
    exportError: state?.exportError ?? null,
    pagination: state?.pagination ?? { limit: 25, offset: 0, total: 0 },
    lastRunAt: state?.lastRunAt ?? null,
  };

  const safeFilterOptions = filterOptions ?? EMPTY_FILTER_OPTIONS;
  const safeReferenceParagraphsBySource = referenceParagraphsBySource ?? {};

  const { query, filters, loading, error } = safeState;

  const paragraphOptions =
    filters.referenceSource
      ? safeReferenceParagraphsBySource[filters.referenceSource] || []
      : [];

  const isLloydsTaxonomySelected = year === "lloyds-2025";
  const balanceHelpText = isLloydsTaxonomySelected
    ? "The concepts in the Lloyd’s taxonomy do not rely on the debit and credit types functionality from the standard taxonomy."
    : "Accounting balance type.";

  React.useLayoutEffect(() => {
    const target = searchFiltersCardRef.current;
    if (!target || typeof window === "undefined") {
      return;
    }

    const syncHeight = () => {
      if (window.innerWidth < 1024) {
        setMatchedTopRowHeight(null);
        return;
      }

      setMatchedTopRowHeight(Math.ceil(target.getBoundingClientRect().height));
    };

    syncHeight();

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncHeight()) : null;

    observer?.observe(target);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Advanced Search
              </div>
              <FieldLabelWithHelp
                label="Keyword"
                help="Free-text search term. Use this with filters below."
              />
              <input
                type="text"
                className="w-full rounded border border-slate-300 bg-white p-2 text-sm shadow-sm"
                placeholder="e.g. turnover, revenue, core:TurnoverRevenue"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onRunSearch(0);
                    onOpenResultsTab?.();
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                type="button"
                className="min-w-[120px] bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  onRunSearch(0);
                  onOpenResultsTab?.();
                }}
                disabled={loading}
              >
                {loading ? "Searching..." : "Search"}
              </Button>
              <Button type="button" variant="outline" onClick={onResetSearch}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 pt-0">
          <Accordion
            type="multiple"
            defaultValue={["search-filters", "references", "advanced-xbrl"]}
            className="grid w-full gap-4 lg:grid-cols-2 lg:items-start"
          >
            <AccordionItem
              ref={searchFiltersCardRef}
              value="search-filters"
              className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
            >
              <AccordionTrigger className="rounded bg-blue-100 px-3 py-2 text-sm font-semibold">
                Search filters
              </AccordionTrigger>
              <AccordionContent className="pt-3">
                <div className="grid gap-3 p-3 xl:grid-cols-2 xl:items-start">
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
                  <StringCheckboxGroup
                    label="XBRL type"
                    help="Base XBRL type."
                    options={safeFilterOptions.xbrlType}
                    selected={filters.xbrlType}
                    onChange={(next) => onFiltersChange({ ...filters, xbrlType: next })}
                  />
                  <StringCheckboxGroup
                    label="Concept type"
                    help="Filter concepts as concept, dimension member, dimension, or hypercube."
                    options={safeFilterOptions.conceptType}
                    selected={filters.conceptType}
                    onChange={(next) => onFiltersChange({ ...filters, conceptType: next })}
                  />
                  <div className="rounded border p-2 xl:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={filters.excludeNotInPresentationTree}
                        onCheckedChange={(checked) =>
                          onFiltersChange({
                            ...filters,
                            excludeNotInPresentationTree: checked === true,
                          })
                        }
                      />
                      <span>Exclude concepts not in entrypoint Presentation tree</span>
                    </label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="references"
              className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm lg:flex lg:flex-col"
              style={matchedTopRowHeight ? { height: `${matchedTopRowHeight}px` } : undefined}
            >
              <AccordionTrigger className="rounded bg-blue-100 px-3 py-2 text-sm font-semibold">
                References
              </AccordionTrigger>
              <AccordionContent className="pt-3 lg:flex-1">
                <div className="grid gap-2 p-3 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <FieldLabelWithHelp
                      label="Source"
                      help="Reference source, e.g. FRS 102."
                    />
                    <select
                      className="w-full rounded border bg-white p-2 text-sm"
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
                  <div className="flex min-h-0 flex-col space-y-1">
                    <FieldLabelWithHelp
                      label="Paragraph"
                      help="Paragraph list filtered by selected source."
                    />
                    <select
                      multiple
                      size={12}
                      className="min-h-[190px] w-full flex-1 rounded border bg-white p-2 text-sm lg:min-h-0"
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
                    <div className="pt-1 text-xs text-gray-500">
                      Hold Ctrl/Cmd to select multiple paragraphs.
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="advanced-xbrl"
              className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm lg:col-span-2"
            >
              <AccordionTrigger className="rounded bg-blue-100 px-3 py-2 text-sm font-semibold">
                Advanced XBRL filters
              </AccordionTrigger>
              <AccordionContent className="pt-3">
                <div className="grid gap-3 p-3 xl:grid-cols-3 xl:items-start">
                  <StringCheckboxGroup
                    label="Namespace"
                    help="Concept namespace URI."
                    options={safeFilterOptions.namespace}
                    selected={filters.namespace}
                    listClassName="h-40"
                    onChange={(next) => onFiltersChange({ ...filters, namespace: next })}
                  />
                  <StringCheckboxGroup
                    label="Full type"
                    help="Qualified type QName."
                    options={safeFilterOptions.fullType}
                    selected={filters.fullType}
                    listClassName="h-40"
                    onChange={(next) => onFiltersChange({ ...filters, fullType: next })}
                  />
                  <StringCheckboxGroup
                    label="Substitution group"
                    help="Substitution group QName."
                    options={safeFilterOptions.substitutionGroup}
                    selected={filters.substitutionGroup}
                    listClassName="h-40"
                    onChange={(next) => onFiltersChange({ ...filters, substitutionGroup: next })}
                  />
                  <div className="grid gap-3 xl:col-span-3 xl:grid-cols-2">
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
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {error && <div className="pt-4 text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AdvancedSearchTab;
