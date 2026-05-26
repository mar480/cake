import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdvancedSearchFilters, AdvancedSearchState } from "@/types/advancedSearch";
import { fetchPresentationEntrypointLocations } from "./services/explorerApi";

type FilterChip = {
  key: string;
  label: string;
  field: "balance" | "periodType" | "xbrlType" | "conceptType" | "referenceParagraph" | "excludeNotInPresentationTree";
  value: string | boolean;
  source?: string | null;
};

const CONCEPT_TYPE_CHIP_CLASSES: Record<string, string> = {
  concept: "bg-slate-100 border-slate-300 text-slate-800",
  "dimension member": "bg-pink-100 border-pink-300 text-pink-800",
  dimension: "bg-indigo-100 border-indigo-300 text-indigo-800",
  hypercube: "bg-rose-100 border-rose-300 text-rose-800",
};

const XBRL_TYPE_CHIP_CLASSES: Record<string, string> = {
  anyURIItemType: "bg-blue-100 border-blue-300 text-blue-800",
  booleanItemType: "bg-green-100 border-green-300 text-green-800",
  dateItemType: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800",
  decimalItemType: "bg-neutral-100 border-neutral-300 text-neutral-800",
  monetaryItemType: "bg-amber-100 border-amber-300 text-amber-800",
  sharesItemType: "bg-purple-100 border-purple-300 text-purple-800",
  stringItemType: "bg-cyan-100 border-cyan-300 text-cyan-800",
};

const PERIOD_TYPE_CHIP_CLASSES: Record<string, string> = {
  instant: "bg-sky-100 border-sky-300 text-sky-800",
  duration: "bg-cyan-100 border-cyan-300 text-cyan-800",
};

const BALANCE_CHIP_CLASSES: Record<string, string> = {
  debit: "bg-red-100 border-red-300 text-red-800",
  credit: "bg-emerald-100 border-emerald-300 text-emerald-800",
};

const FIELD_CHIP_CLASSES = {
  referenceParagraph: "bg-amber-50 border-amber-300 text-amber-800",
  excludeNotInPresentationTree: "bg-slate-100 border-slate-300 text-slate-700",
} as const;

const getConceptTypeLabel = (conceptType: string) =>
  conceptType === "dimension member"
    ? "Dimension member"
    : conceptType === "dimension"
      ? "Dimension"
      : conceptType === "hypercube"
        ? "Hypercube"
        : "Concept";

const getChipClassForField = (field: FilterChip["field"], value: string | boolean) => {
  if (field === "conceptType") {
    return CONCEPT_TYPE_CHIP_CLASSES[String(value)] ?? CONCEPT_TYPE_CHIP_CLASSES.concept;
  }

  if (field === "xbrlType") {
    return XBRL_TYPE_CHIP_CLASSES[String(value)] ?? "bg-violet-100 border-violet-300 text-violet-800";
  }

  if (field === "periodType") {
    return PERIOD_TYPE_CHIP_CLASSES[String(value)] ?? "bg-cyan-100 border-cyan-300 text-cyan-800";
  }

  if (field === "balance") {
    return BALANCE_CHIP_CLASSES[String(value)] ?? "bg-teal-100 border-teal-300 text-teal-800";
  }

  return FIELD_CHIP_CLASSES[field] ?? "bg-gray-100 border-gray-300 text-gray-700";
};

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

interface SearchResultsTabProps {
  state?: AdvancedSearchState;
  onFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunSearch: (nextOffset?: number) => void;
  onRunExport: (options: {
    format: "csv" | "json";
    fields: string[];
    filters?: AdvancedSearchFilters;
  }) => void;
  onResetSearch: () => void;
  onNavigateToSearchNode?: (
    qname: string,
    network?: string,
    elr?: string,
    entrypoint?: string,
    uuid?: string
  ) => void;
  onReturnToSearch?: () => void;
  networkLabels?: Record<string, string>;
  resultNetworks?: Record<string, string[]>;
  resultPresentationElrs?: Record<string, string[]>;
  hypercubeElrDefinitionsByQname?: Record<string, string[]>;
  year?: string | null;
  currentEntrypoint?: string | null;
}

const SearchResultsTab: React.FC<SearchResultsTabProps> = ({
  state,
  onFiltersChange,
  onRunSearch,
  onRunExport,
  onResetSearch,
  onNavigateToSearchNode,
  onReturnToSearch,
  networkLabels,
  resultNetworks,
  resultPresentationElrs,
  hypercubeElrDefinitionsByQname,
  year,
  currentEntrypoint,
}) => {
  const exportFieldOptions = [
    { id: "qname", label: "QName" },
    { id: "label", label: "Label" },
    { id: "local_name", label: "Local name" },
    { id: "namespace", label: "Namespace" },
    { id: "concept_type", label: "Concept type" },
    { id: "xbrl_type", label: "XBRL type" },
    { id: "full_type", label: "Full type" },
    { id: "period_type", label: "Period type" },
    { id: "balance", label: "Balance" },
    { id: "abstract", label: "Abstract" },
    { id: "nillable", label: "Nillable" },
    { id: "substitution_group", label: "Substitution group" },
    { id: "reference_displays", label: "References" },
    { id: "hypercubes", label: "Hypercubes" },
    { id: "matched_fields", label: "Matched fields" },
    { id: "score", label: "Score" },
  ] as const;
  const allExportFieldIds = exportFieldOptions.map((field) => field.id);
  const safeState: AdvancedSearchState = {
    query: state?.query ?? "",
    filters: state?.filters ?? EMPTY_FILTERS,
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

  const { filters, results, loading, exportLoading, error, exportError, lastRunAt, pagination } = safeState;
  const { limit, offset, total } = pagination;

  const activeChips: FilterChip[] = useMemo(() => {
    const withString = (
      field: "balance" | "periodType" | "xbrlType" | "conceptType",
      values: string[],
      labelPrefix: string
    ) =>
      values.map((value) => ({
        key: `${field}:${value}`,
        label: `${labelPrefix}: ${value}`,
        field,
        value,
      }));

    return [
      {
        key: "excludeNotInPresentationTree:true",
        label: "Presentation: in entrypoint tree only",
        field: "excludeNotInPresentationTree" as const,
        value: true,
      },
      ...withString("conceptType", filters.conceptType, "Concept type"),
      ...withString("xbrlType", filters.xbrlType, "XBRL type"),
      ...withString("periodType", filters.periodType, "Period type"),
      ...withString("balance", filters.balance, "Balance"),
      ...filters.referenceParagraph.map((value) => ({
        key: `referenceParagraph:${filters.referenceSource ?? ""}:${value}`,
        label: `Reference: ${filters.referenceSource ?? ""}, ${value}`,
        field: "referenceParagraph" as const,
        value,
        source: filters.referenceSource,
      })),
    ];
  }, [
    filters.balance,
    filters.conceptType,
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

  const [openMenuResultId, setOpenMenuResultId] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [showResultFilters, setShowResultFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>(allExportFieldIds);

  const resultFilterSource = results;

  const resultFilterOptions = useMemo(() => {
    const balance = new Set<string>();
    const periodType = new Set<string>();
    const xbrlType = new Set<string>();
    const conceptType = new Set<string>();
    resultFilterSource.forEach((result) => {
      if (result.balance) balance.add(result.balance);
      if (result.periodType) periodType.add(result.periodType);
      if (result.xbrlType) xbrlType.add(result.xbrlType);
      if (result.conceptType) conceptType.add(result.conceptType);
    });
    return {
      balance: Array.from(balance).sort(),
      periodType: Array.from(periodType).sort(),
      xbrlType: Array.from(xbrlType).sort(),
      conceptType: ["concept", "dimension member", "dimension", "hypercube"].filter((value) =>
        conceptType.has(value)
      ),
    };
  }, [resultFilterSource]);

  useEffect(() => {
    setPresentationFallbacksByKey({});
    setPresentationFallbackLoadingByKey({});
    setPresentationFallbackErrorByKey({});
  }, [year, currentEntrypoint, state?.lastRunAt]);

  type ResultMenuOccurrence = {
    elr: string;
    entrypoint?: string;
  };

  type ResultMenuGroup = {
    network: string;
    label: string;
    occurrences: ResultMenuOccurrence[];
  };

  type PresentationFallbackMatch = {
    href: string;
    label: string;
    elrs: string[];
  };

  const [presentationFallbacksByKey, setPresentationFallbacksByKey] = useState<
    Record<string, PresentationFallbackMatch[]>
  >({});
  const [presentationFallbackLoadingByKey, setPresentationFallbackLoadingByKey] = useState<
    Record<string, boolean>
  >({});
  const [presentationFallbackErrorByKey, setPresentationFallbackErrorByKey] = useState<
    Record<string, string>
  >({});

  const isChipActive = (chip: FilterChip) => {
    if (chip.field === "referenceParagraph") {
      return (
        filters.referenceParagraph.includes(String(chip.value)) &&
        (!chip.source || filters.referenceSource === chip.source)
      );
    }
    if (chip.field === "excludeNotInPresentationTree") {
      return filters.excludeNotInPresentationTree;
    }
    return filters[chip.field].includes(String(chip.value));
  };

  const toggleChip = (chip: FilterChip) => {
    const currentlyActive = isChipActive(chip);
    if (chip.field === "excludeNotInPresentationTree") {
      onFiltersChange({ ...filters, excludeNotInPresentationTree: !filters.excludeNotInPresentationTree });
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

  const clearAllFilters = () => {
    onFiltersChange(EMPTY_FILTERS);
    onRunSearch(0);
  };

  const toggleExportField = (fieldId: string) => {
    setSelectedExportFields((prev) =>
      prev.includes(fieldId) ? prev.filter((value) => value !== fieldId) : [...prev, fieldId]
    );
  };

  const handleExport = () => {
    if (selectedExportFields.length === 0) {
      return;
    }

    onRunExport({ format: exportFormat, fields: selectedExportFields, filters });
  };

  const hasActiveSharedFacetFilters =
    filters.balance.length > 0 ||
    filters.periodType.length > 0 ||
    filters.xbrlType.length > 0 ||
    filters.conceptType.length > 0 ||
    filters.referenceParagraph.length > 0 ||
    filters.excludeNotInPresentationTree;

  const visibleResults = results;
  const displayedTotal = total;
  const from = displayedTotal === 0 ? 0 : offset + 1;
  const to = displayedTotal === 0 ? 0 : Math.min(offset + limit, displayedTotal);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  const toggleResultFilterValue = (
    field: "balance" | "periodType" | "xbrlType" | "conceptType",
    value: string
  ) => {
    const currentValues = filters[field];
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];

    onFiltersChange({
      ...filters,
      [field]: Array.from(new Set(nextValues)),
    } as AdvancedSearchFilters);
    onRunSearch(0);
  };

  const loadPresentationFallbacks = (qname: string) => {
    if (!year || !qname) return;

    const cacheKey = `${year}::${currentEntrypoint ?? ""}::${qname}`;
    if (presentationFallbacksByKey[cacheKey] || presentationFallbackLoadingByKey[cacheKey]) {
      return;
    }

    setPresentationFallbackLoadingByKey((prev) => ({ ...prev, [cacheKey]: true }));
    setPresentationFallbackErrorByKey((prev) => {
      const next = { ...prev };
      delete next[cacheKey];
      return next;
    });

    fetchPresentationEntrypointLocations(year, qname, currentEntrypoint)
      .then((matches) => {
        setPresentationFallbacksByKey((prev) => ({
          ...prev,
          [cacheKey]: matches.map((match) => ({
            href: match.entrypoint.href,
            label: match.entrypoint.name,
            elrs: match.elrs,
          })),
        }));
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load other entrypoints";
        setPresentationFallbackErrorByKey((prev) => ({ ...prev, [cacheKey]: message }));
      })
      .finally(() => {
        setPresentationFallbackLoadingByKey((prev) => ({ ...prev, [cacheKey]: false }));
      });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="border rounded">
        <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-600">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-base text-gray-700">Search results</div>
              <div className="mt-1">
                Showing {from}-{to} of {displayedTotal}
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
                  bg-emerald-50
                  text-slate-800
                  hover:bg-emerald-100
                  focus-visible:ring-1 focus-visible:ring-emerald-300
                "
                onClick={() => setIsExportDialogOpen(true)}
                disabled={displayedTotal === 0 || exportLoading}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                {exportLoading ? "Exporting..." : "Export results"}
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
                disabled={!hasActiveSharedFacetFilters}
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
          <div className="text-sm font-medium mb-2">Facet filters (toggle on/off)</div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`text-xs px-2 py-1 rounded-full border ${
                  isChipActive(chip)
                    ? getChipClassForField(chip.field, chip.value)
                    : "bg-gray-100 border-gray-300 text-gray-500 line-through"
                }`}
                onClick={() => toggleChip(chip)}
                title="Toggle filter and refresh results"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
            onClick={() => setShowResultFilters((prev) => !prev)}
            aria-expanded={showResultFilters}
          >
            <div>
              <div className="text-sm font-medium text-gray-800">Filter these results</div>
              <div className="text-xs text-gray-500">
                Refine the current backend result set without changing layout flow.
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                showResultFilters ? "rotate-180" : ""
              }`}
            />
          </button>

          {showResultFilters ? (
            <div className="px-3 pb-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(["balance", "periodType", "xbrlType", "conceptType"] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <div className="text-xs font-medium text-gray-600">
                      {field === "periodType"
                        ? "Period type"
                        : field === "xbrlType"
                          ? "XBRL type"
                          : field === "conceptType"
                            ? "Concept type"
                            : "Balance"}
                    </div>
                    <div className="max-h-28 space-y-1 overflow-auto rounded border p-2">
                      {resultFilterOptions[field].length === 0 ? (
                        <div className="text-xs text-gray-400">No options</div>
                      ) : (
                        resultFilterOptions[field].map((value) => (
                          <label key={`${field}-${value}`} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={filters[field].includes(value)}
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
          ) : null}
        </div>

        {visibleResults.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No results.</div>
        ) : (
          <ul className="divide-y">
            {visibleResults.map((result) => {
              const associatedNetworks = resultNetworks?.[result.qname] ?? [];
              const presentationElrs = resultPresentationElrs?.[result.qname] ?? [];
              const definitionHypercubeElrs = hypercubeElrDefinitionsByQname?.[result.qname] ?? [];
              const presentationFallbackCacheKey = `${year ?? ""}::${currentEntrypoint ?? ""}::${result.qname}`;
              const alternatePresentationEntrypoints =
                presentationFallbacksByKey[presentationFallbackCacheKey] ?? [];
              const presentationFallbackLoading =
                presentationFallbackLoadingByKey[presentationFallbackCacheKey] ?? false;
              const presentationFallbackError =
                presentationFallbackErrorByKey[presentationFallbackCacheKey] ?? "";
              const conceptType = result.conceptType ?? "concept";
              const goToNodeLabel = networkLabels?.presentation ?? "Presentation";
              const showDefinitionBeforePresentation =
                presentationElrs.length === 0 && definitionHypercubeElrs.length > 0;

              return (
                <li key={result.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium text-sm break-words">{result.label || result.qname}</div>
                    <div className="text-xs text-gray-500 break-all">{result.qname}</div>
                    {showDefinitionBeforePresentation && (
                      <div className="text-xs text-gray-500 break-words">
                        Definition ELR: {definitionHypercubeElrs.join(", ")}
                      </div>
                    )}
                    <div
                      className={`text-xs break-words rounded py-1 flex items-center ${
                        presentationElrs.length > 0
                          ? "text-gray-500"
                          : "text-red-800 bg-red-50 border border-red-200"
                      }`}
                    >
                      {presentationElrs.length > 0 ? (
                        <span>Presentation ELR: {presentationElrs.join(", ")}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 leading-none">
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Not in this entrypoint’s presentation tree</span>
                        </span>
                      )}
                    </div>
                    {definitionHypercubeElrs.length > 0 && !showDefinitionBeforePresentation && (
                      <div className="text-xs text-gray-500 break-words">
                        Definition ELR: {definitionHypercubeElrs.join(", ")}
                      </div>
                    )}
                    <div className="space-y-1 pt-1">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${getChipClassForField("conceptType", conceptType)}`}
                        >
                          {getConceptTypeLabel(conceptType)}
                        </span>
                        {result.xbrlType && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${getChipClassForField("xbrlType", result.xbrlType)}`}
                          >
                            XBRL: {result.xbrlType}
                          </span>
                        )}
                        {result.periodType && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${getChipClassForField("periodType", result.periodType)}`}
                          >
                            Period: {result.periodType}
                          </span>
                        )}
                        {result.balance && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${getChipClassForField("balance", result.balance)}`}
                          >
                            Balance: {result.balance}
                          </span>
                        )}
                      </div>
                      {(result.referenceDisplays ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(result.referenceDisplays ?? []).map((referenceDisplay) => (
                            <span
                              key={`${result.id}-reference-${referenceDisplay}`}
                              className={`text-xs px-2 py-0.5 rounded-full border ${getChipClassForField("referenceParagraph", referenceDisplay)}`}
                            >
                              Reference: {referenceDisplay}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {(() => {
                      const presentationOccurrences = presentationElrs.map((elr) => ({ elr }));
                      const definitionMenuGroups: ResultMenuGroup[] = associatedNetworks
                        .filter((networkKey) => networkKey !== "presentation")
                        .map((networkKey) => ({
                          network: networkKey,
                          label: networkLabels?.[networkKey] ?? networkKey,
                          occurrences: definitionHypercubeElrs.map((elr) => ({ elr })),
                        }))
                        .filter((group) => group.occurrences.length > 0);

                      const menuGroups: ResultMenuGroup[] = (
                        presentationOccurrences.length === 0
                          ? [
                              ...definitionMenuGroups,
                              {
                                network: "presentation",
                                label: goToNodeLabel,
                                occurrences: presentationOccurrences,
                              },
                            ]
                          : [
                              {
                                network: "presentation",
                                label: goToNodeLabel,
                                occurrences: presentationOccurrences,
                              },
                              ...definitionMenuGroups,
                            ]
                      ).filter((group) => group.network === "presentation" || group.occurrences.length > 0);

                      const presentationUnavailableNoteId = `presentation-note-${result.id}`;
                      const hasSinglePresentationTarget = presentationOccurrences.length === 1;
                      const hasAlternatePresentationTargets = alternatePresentationEntrypoints.length > 0;

                      return (
                        <DropdownMenu
                          open={openMenuResultId === result.id}
                          onOpenChange={(open) => {
                            setOpenMenuResultId(open ? result.id : null);
                            if (open && presentationElrs.length === 0) {
                              loadPresentationFallbacks(result.qname);
                            }
                          }}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-describedby={presentationElrs.length === 0 ? presentationUnavailableNoteId : undefined}
                            className="
                              rounded-r-none
                              border-2 border-slate-400
                              border-r border-r-slate-300
                              bg-sky-50
                              text-slate-800
                              hover:bg-sky-100
                              focus-visible:ring-1 focus-visible:ring-sky-300
                            "
                            onClick={() => {
                              if (hasSinglePresentationTarget) {
                                onNavigateToSearchNode?.(result.qname, "presentation", presentationOccurrences[0].elr);
                                return;
                              }
                              if (presentationElrs.length === 0) {
                                loadPresentationFallbacks(result.qname);
                              }
                              setOpenMenuResultId(result.id);
                            }}
                          >
                            Go to node
                          </Button>
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
                            {menuGroups.flatMap((group) => {
                              const isPresentationGroup = group.network === "presentation";
                              const showUnavailablePresentation = isPresentationGroup && group.occurrences.length === 0;

                              return [
                                <DropdownMenuItem
                                  key={`${result.id}-${group.network}-heading`}
                                  disabled
                                  className={`font-semibold text-xs ${showUnavailablePresentation ? "text-amber-700 bg-amber-50" : ""}`}
                                >
                                  {group.label}
                                </DropdownMenuItem>,
                                ...(showUnavailablePresentation
                                  ? [
                                      <DropdownMenuItem
                                        key={`${result.id}-${group.network}-unavailable`}
                                        disabled
                                        className="text-xs text-amber-700"
                                      >
                                        <span id={presentationUnavailableNoteId}>
                                          Not in this entrypoint’s Presentation tree
                                        </span>
                                      </DropdownMenuItem>,
                                      ...(presentationFallbackLoading
                                        ? [
                                            <DropdownMenuItem
                                              key={`${result.id}-${group.network}-loading`}
                                              disabled
                                              className="text-xs text-gray-500"
                                            >
                                              Loading other entrypoints...
                                            </DropdownMenuItem>,
                                          ]
                                          : hasAlternatePresentationTargets
                                          ? alternatePresentationEntrypoints.flatMap((entrypointOption) => [
                                              <DropdownMenuItem
                                                key={`${result.id}-${group.network}-${entrypointOption.href}-heading`}
                                                disabled
                                                className="pl-4 text-xs font-medium text-slate-700"
                                              >
                                                {entrypointOption.label}
                                              </DropdownMenuItem>,
                                              ...entrypointOption.elrs.map((elr) => (
                                                <DropdownMenuItem
                                                  key={`${result.id}-${group.network}-${entrypointOption.href}-${elr}`}
                                                  className="pl-8 text-xs transition-all duration-150 data-[highlighted]:bg-sky-50 data-[highlighted]:text-slate-900"
                                                  onClick={() =>
                                                    onNavigateToSearchNode?.(
                                                      result.qname,
                                                      group.network,
                                                      elr,
                                                      entrypointOption.href
                                                    )
                                                  }
                                                >
                                                  <span className="flex w-full items-center gap-3">
                                                    <span className="min-w-0 flex-1">{elr}</span>
                                                    <i
                                                      className="pi pi-external-link text-[0.8rem] text-slate-500"
                                                      aria-hidden="true"
                                                    />
                                                  </span>
                                                </DropdownMenuItem>
                                              )),
                                            ])
                                          : [
                                              <DropdownMenuItem
                                                key={`${result.id}-${group.network}-empty`}
                                                disabled
                                                className="text-xs text-gray-500"
                                              >
                                                No Presentation hits in other entrypoints.
                                              </DropdownMenuItem>,
                                            ]),
                                      ...(presentationFallbackError
                                        ? [
                                            <DropdownMenuItem
                                              key={`${result.id}-${group.network}-error`}
                                              disabled
                                              className="text-xs text-red-600"
                                            >
                                              {presentationFallbackError}
                                            </DropdownMenuItem>,
                                          ]
                                        : []),
                                    ]
                                  : group.occurrences.map((occurrence) => (
                                      <DropdownMenuItem
                                        key={`${result.id}-${group.network}-${occurrence.elr}-${occurrence.entrypoint ?? ""}`}
                                        className="text-xs transition-all duration-150 data-[highlighted]:bg-sky-50 data-[highlighted]:text-slate-900"
                                        onClick={() =>
                                          onNavigateToSearchNode?.(result.qname, group.network, occurrence.elr, occurrence.entrypoint)
                                        }
                                      >
                                        {occurrence.elr}
                                      </DropdownMenuItem>
                                    ))),
                              ];
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}
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
      {exportError && <div className="text-sm text-red-600">{exportError}</div>}

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Export Search Results</DialogTitle>
            <DialogDescription>
              Export uses the current search query and active filters. Choose a format and the fields to include.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Query: <span className="font-medium">{state?.query?.trim() || "(all concepts)"}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Format</span>
              {(["csv", "json"] as const).map((formatOption) => (
                <button
                  key={formatOption}
                  type="button"
                  className={`rounded border px-3 py-1 text-sm ${
                    exportFormat === formatOption
                      ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setExportFormat(formatOption)}
                >
                  {formatOption.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedExportFields(allExportFieldIds)}>
                All fields
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedExportFields([])}>
                Clear selection
              </Button>
            </div>

            <div className="grid max-h-[360px] grid-cols-2 gap-3 overflow-auto rounded border border-slate-200 p-3 md:grid-cols-3">
              {exportFieldOptions.map((field) => (
                <label key={field.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <Checkbox
                    checked={selectedExportFields.includes(field.id)}
                    onCheckedChange={() => toggleExportField(field.id)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>

            {selectedExportFields.length === 0 && (
              <div className="text-sm text-red-600">Select at least one field to export.</div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsExportDialogOpen(false)} disabled={exportLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                handleExport();
                if (selectedExportFields.length > 0) {
                  setIsExportDialogOpen(false);
                }
              }}
              disabled={selectedExportFields.length === 0 || exportLoading}
            >
              {exportLoading ? "Exporting..." : `Export ${exportFormat.toUpperCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchResultsTab;
