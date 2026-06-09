import {
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Sparkles,
  LifeBuoy,
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
  splitHelpTextParagraphs,
  type HelpContentCategory,
  type HelpContentId,
} from "./helpContent";
import { useHelp } from "./helpContext";

const explanationPages = [
  {
    title: "Why did you make this app?",
    body: "This app was created to help users navigate and understand the complexities of the UK Taxonomy Suite in an efficient, effective and intuitive way. \n\n I struggled for a long time trying to understand the taxonomy model and wanted to improve on pre-existing tools by providing a modern and user-friendly interface, better surfacing the dimensional modelling, offering a more comprehensive search experience, and adding in-line contextual help and guidance to support users.",
  },
  {
    title: "Who is this app for?",
    body: "The app is for anyone who needs to interact with the UK Taxonomy Suite. Preparers can use it to explore the taxonomy and understand how to report their data. Developers can use it to understand the modelling decisions in the taxonomy and how to implement them in their tools. Data users can use it to better inform how they process and interact with digitally reported data. \n\n Beginners are supported with a guided tour, UI hints and glossary definitions, while more advanced users can use the app to quickly understand the the dimensional modelling available for specific concepts and export search results to support their work.",
  },
  {
    title: "What do I do if I have questions or comments about the app?",
    body: "This app is maintained by an individual developer (me!) and is not an official product of the Financial Reporting Council. \n\n If you have any questions, comments, or suggestions, please feel free to reach out to me directly at robjmarks@gmail.com. I welcome any feedback that can help make the app more useful for the community.",
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
const emailPattern = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

function renderExplanationParagraph(paragraph: string) {
  const segments = paragraph.split(emailPattern);

  return segments.map((segment, index) => {
    if (!segment) {
      return null;
    }

    const isEmail = emailPattern.test(segment);
    emailPattern.lastIndex = 0;

    if (isEmail) {
      return (
        <a
          key={`${segment}-${index}`}
          href={`mailto:${segment}`}
          className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
        >
          {segment}
        </a>
      );
    }

    return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
  });
}

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
                  ? "This viewer helps you to explore the modelling used in the UK Taxonomy Suite. Start by choosing a year and an entrypoint. The tree shows how concepts are organised. When you select a concept, the details panels shows its properties, dimensional structures and tree locations."
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
                    <h3 className="font-semibold">About this app</h3>
                  </div>
                  <p className="text-sm text-slate-700">
                    Unlock the full potential of the UK taxonomies. Navigate the trees, understand concept details, view the full dimensional model, and use advanced search techniques.
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
                    <LifeBuoy className="h-5 w-5 text-rose-600" />
                    <h3 className="font-semibold">Turn app info on</h3>
                  </div>
                  <p className="mb-3 text-sm text-slate-700">
                    Display glossary terms as UI hints explaining each aspect of the taxonomy viewer. App info mode can also be toggled at any time using the button in the top navigation bar.
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
                    <h3 className="font-semibold">Take a guided tour</h3>
                  </div>
                  <p className="mb-3 text-sm text-slate-700">
                    Welcome to the UK Taxonomy Suite. This short tour will guide you through the key features of the app to help you get started exploring the taxonomies with confidence.
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
                    <h3 className="text-base font-semibold text-slate-900">Glossary</h3>
                    <p className="text-sm text-slate-600">
                      Browse glossary terms for the app, details tabs, concepts, and advanced search.
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
                    <h3 className="text-base font-semibold text-slate-900">Taxonomies Documentation and Guidance</h3>
                    <p className="text-sm text-slate-600">
                      Visit the Financial Reporting Council (FRC) website to download current documentation and guidance for the FRC Taxonomy Suite.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Button asChild type="button" className={helpActionButtonClass}>
                      <a href="https://www.frc.org.uk/library/standards-codes-policy/accounting-and-reporting/frc-taxonomies/frc-taxonomies-documentation-and-guidance/" target="_blank" rel="noreferrer">
                        Open FRC documentation
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
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
                      <div className="space-y-3 text-sm leading-6 text-slate-700">
                        {splitHelpTextParagraphs(selectedEntry.longText).map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
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

          <DialogFooter className="border-t bo
          rder-slate-200 px-6 py-4">
            <Button className="border-red-700 bg-red-300" type="button" variant="outline" onClick={handleClose}>
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
            {splitHelpTextParagraphs(explanation.body).map((paragraph, index) => (
              <p key={index}>{renderExplanationParagraph(paragraph)}</p>
            ))}
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
