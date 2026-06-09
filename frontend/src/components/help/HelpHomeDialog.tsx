import {
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Sparkles,
  ToggleRight,
} from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  getGlossaryEntries,
  getHelpContentCategory,
  glossaryCategoryOrder,
  groupGlossaryEntries,
  type HelpContentCategory,
  type HelpContentId,
} from "./helpContent";
import { useHelp } from "./helpContext";

const explanationPages = [
  {
    title: "Start with year and entrypoint",
    body: "Choose a taxonomy year, then load an entrypoint. The entrypoint determines which reporting view and concepts are available in the tree and details panel.",
  },
  {
    title: "Use the tree to navigate",
    body: "The tree shows how concepts are organised. You can search the current tree, expand branches, and select a concept to inspect its properties, labels, references, and dimensional relationships.",
  },
  {
    title: "Use tabs to inspect context",
    body: "The details tabs help you move between concept properties, hypercube relationships, tree locations, and advanced search. Help mode surfaces glossary hints across these areas when you need them.",
  },
] as const;

const glossarySectionTitles: Record<HelpContentCategory, string> = {
  App: "App",
  "Details tab": "Details tab",
  Concept: "Concept",
  "Advanced Search": "Advanced Search",
};

const helpActionButtonClass =
  "w-full border border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200";
const helpHomeInfoRowClass =
  "grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_240px] md:items-center";

const HelpHomeDialog: React.FC = () => {
  const {
    helpHomeOpen,
    closeHelpHome,
    helpModeEnabled,
    setHelpModeEnabled,
    activeTourId,
    startTour,
  } = useHelp();
  const [view, setView] = React.useState<"home" | "glossary">("home");
  const [explanationOpen, setExplanationOpen] = React.useState(false);
  const [explanationPage, setExplanationPage] = React.useState(0);
  const [glossaryQuery, setGlossaryQuery] = React.useState("");
  const [selectedGlossaryId, setSelectedGlossaryId] = React.useState<HelpContentId>("app.entrypoint");
  const [expandedGlossarySections, setExpandedGlossarySections] = React.useState<Record<HelpContentCategory, boolean>>({
    App: true,
    "Details tab": true,
    Concept: true,
    "Advanced Search": true,
  });

  const glossaryEntries = React.useMemo(() => getGlossaryEntries(glossaryQuery), [glossaryQuery]);
  const groupedGlossaryEntries = React.useMemo(
    () => groupGlossaryEntries(glossaryEntries),
    [glossaryEntries]
  );
  const selectedEntry =
    glossaryEntries.find((entry) => entry.id === selectedGlossaryId) ??
    glossaryEntries[0] ??
    null;

  React.useEffect(() => {
    if (!selectedEntry) {
      return;
    }
    if (selectedGlossaryId !== selectedEntry.id) {
      setSelectedGlossaryId(selectedEntry.id as HelpContentId);
    }
  }, [selectedEntry, selectedGlossaryId]);

  const handleOpenGlossary = () => {
    setView("glossary");
  };

  const handleClose = () => {
    setView("home");
    setGlossaryQuery("");
    setExplanationOpen(false);
    setExplanationPage(0);
    closeHelpHome();
  };

  const toggleGlossarySection = (category: HelpContentCategory) => {
    setExpandedGlossarySections((current) => ({
      ...current,
      [category]: !current[category],
    }));
  };

  const glossaryCategory = selectedEntry ? getHelpContentCategory(selectedEntry) : null;
  const explanation = explanationPages[explanationPage];
  const isLastExplanationPage = explanationPage === explanationPages.length - 1;

  return (
    <>
      <Dialog open={helpHomeOpen} onOpenChange={(open) => (open ? undefined : handleClose())}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-slate-200 bg-white p-0">
          <div className="rounded-t-lg bg-gradient-to-r from-sky-950 via-blue-900 to-cyan-800 px-6 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold">
                {view === "home" ? "New to taxonomies?" : "Glossary"}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm text-blue-100">
                {view === "home"
                  ? "This viewer helps you explore how reporting concepts are organised. Choose a year and entrypoint, browse the taxonomy tree, then inspect labels, references, dimensions, and search results."
                  : "Browse and search the help glossary. All definitions come from the shared help-content registry used across hints, tours, and onboarding."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {view === "home" ? (
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <BookOpenText className="h-5 w-5 text-sky-700" />
                    <h3 className="font-semibold">Explain this app</h3>
                  </div>
                  <p className="text-sm text-slate-700">
                    Start with the year and entrypoint selectors. The tree on the left
                    shows structure. The details panel on the right explains the selected
                    concept.
                  </p>
                  <Button
                    type="button"
                    className={`mt-auto ${helpActionButtonClass}`}
                    onClick={() => {
                      setExplanationPage(0);
                      setExplanationOpen(true);
                    }}
                  >
                    Read the overview
                  </Button>
                </section>

                <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <ToggleRight className="h-5 w-5 text-rose-600" />
                    <h3 className="font-semibold">Turn help mode on</h3>
                  </div>
                  <p className="mb-3 text-sm text-slate-700">
                    Turn on inline hints to see help and glossary terms across the app.
                  </p>
                  <Button
                    type="button"
                    className={`mt-auto ${helpActionButtonClass}`}
                    onClick={() => setHelpModeEnabled(!helpModeEnabled)}
                  >
                    {helpModeEnabled ? "Turn help mode off" : "Turn help mode on"}
                  </Button>
                </section>

                <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-slate-900">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold">Start a guided tour</h3>
                  </div>
                  <p className="mb-3 text-sm text-slate-700">
                    Run the beginner overview to load a sample taxonomy, filter the tree,
                    select a concept, and open a non-default details tab.
                  </p>
                  <Button
                    type="button"
                    className={`mt-auto ${helpActionButtonClass}`}
                    onClick={() => startTour("beginner-overview")}
                  >
                    {activeTourId === "beginner-overview" ? "Tour active" : "Start beginner tour"}
                  </Button>
                </section>
              </div>

              <section className="space-y-3">
                <article className={helpHomeInfoRowClass}>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Quick glossary</h3>
                    <p className="text-sm text-slate-600">
                      Browse grouped glossary terms for the app, details tabs, concepts, and advanced search.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Button type="button" className={helpActionButtonClass} onClick={handleOpenGlossary}>
                      Open glossary
                    </Button>
                  </div>
                </article>
                <article className={helpHomeInfoRowClass}>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Digital Reporting Resource Hub</h3>
                    <p className="text-sm text-slate-600">
                      The Financial Reporting Council (FRC) provides an excellent introduction to digital reporting and taxonomies covering everything from introductory concepts through to preparing, validating and using digital reports in practice.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Button asChild type="button" className={helpActionButtonClass}>
                      <a href="https://frc.org.uk/xbrl" target="_blank" rel="noreferrer">
                        Visit FRC hub
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </article>
                <article className={helpHomeInfoRowClass}>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Taxonomies Documentation and Guidance</h3>
                    <p className="text-sm text-slate-600">
                      Visit the Financial Reporting Council (FRC) website to download documentation and guidance for the FRC Taxonomy Suite.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Button asChild type="button" className={helpActionButtonClass}>
                      <a href="https://www.frc.org.uk/library/standards-codes-policy/accounting-and-reporting/frc-taxonomies/frc-taxonomies-documentation-and-guidance/" target="_blank" rel="noreferrer">
                        Open guidance
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </article>
              </section>
            </div>
          ) : (
            <div className="grid gap-4 px-6 py-6 md:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="space-y-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start px-0 text-slate-700"
                  onClick={() => setView("home")}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back to help home
                </Button>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={glossaryQuery}
                    onChange={(event) => setGlossaryQuery(event.target.value)}
                    placeholder="Search glossary"
                    className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
                  {glossaryCategoryOrder.map((category) => {
                    const sectionEntries = groupedGlossaryEntries[category];
                    if (sectionEntries.length === 0) {
                      return null;
                    }

                    const sectionExpanded = glossaryQuery ? true : expandedGlossarySections[category];

                    return (
                      <div key={category} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between bg-blue-100 px-3 py-2 text-left text-blue-950"
                          onClick={() => toggleGlossarySection(category)}
                        >
                          <span className="text-sm font-semibold text-slate-900">
                            {glossarySectionTitles[category]}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-slate-500 transition-transform ${
                              sectionExpanded ? "rotate-0" : "-rotate-90"
                            }`}
                          />
                        </button>
                        {sectionExpanded ? (
                          <div className="space-y-1 border-t border-slate-200 px-2 py-2">
                            {sectionEntries.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => setSelectedGlossaryId(entry.id as HelpContentId)}
                                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                                  selectedEntry?.id === entry.id
                                    ? "border-sky-300 bg-sky-50 text-sky-950"
                                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                                }`}
                              >
                                <div className="text-sm font-semibold">{entry.title}</div>
                                <div className="mt-1 text-xs text-slate-600">{entry.shortText}</div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </aside>

              <section className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                {selectedEntry ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                        {glossaryCategory}
                      </div>
                      <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedEntry.title}</h3>
                    </div>
                    <p className="text-sm leading-6 text-slate-800">{selectedEntry.shortText}</p>
                    {selectedEntry.longText ? (
                      <p className="text-sm leading-6 text-slate-700">{selectedEntry.longText}</p>
                    ) : null}
                    {selectedEntry.beginnerExample ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Example: {selectedEntry.beginnerExample}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">
                    No glossary entries matched your search.
                  </div>
                )}
              </section>
            </div>
          )}

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button className="border-red-700 bg-red-400" type="button" variant="outline" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={explanationOpen} onOpenChange={setExplanationOpen}>
        <DialogContent className="max-w-2xl border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>{explanation.title}</DialogTitle>
            <DialogDescription>
              Page {explanationPage + 1} of {explanationPages.length}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-7 text-slate-700">
            <p>{explanation.body}</p>
            <p>
              Dummy content placeholder: this modal is ready for a longer guided explanation of the app,
              including what taxonomies are, how entrypoints differ, and how to interpret concept metadata.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setExplanationOpen(false)}>
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExplanationPage((current) => Math.max(0, current - 1))}
                disabled={explanationPage === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                type="button"
                className={helpActionButtonClass}
                onClick={() => {
                  if (isLastExplanationPage) {
                    setExplanationOpen(false);
                    return;
                  }
                  setExplanationPage((current) => current + 1);
                }}
              >
                {isLastExplanationPage ? "Done" : "Next"}
                {!isLastExplanationPage ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HelpHomeDialog;
