import React from "react";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  onOpenResultsTab,
  onResetSearch,
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

  const { query, filters, loading, error } = safeState;

  const paragraphOptions =
    filters.referenceSource
      ? safeReferenceParagraphsBySource[filters.referenceSource] || []
      : [];

  const isLloydsTaxonomySelected = year === "lloyds-2025";
  const balanceHelpText = isLloydsTaxonomySelected
    ? "The concepts in the Lloyd’s taxonomy do not rely on the debit and credit types functionality from the standard taxonomy."
    : "Accounting balance type.";

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
                  onOpenResultsTab?.();
                }
              }}
            />
          </div>
          <div className="flex gap-2 pb-[1px]">
            <button
              className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
              onClick={() => {
                onRunSearch(0);
                onOpenResultsTab?.();
              }}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
            <button className="bg-gray-200 text-sm px-3 py-1 rounded" onClick={onResetSearch}>
              Reset
            </button>
          </div>
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

        {error && <div className="text-sm text-red-600">{error}</div>}

        
      </div>
    </TooltipProvider>
  );
};

export default AdvancedSearchTab;
