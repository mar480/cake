import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
// import conceptsData from "@/data/json/concepts/concepts.json"; // Load the full JSON here

interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

interface DetailPanelProps {
  selectedNode: any;
  onNavigateToNode?: (qname: string) => void;
  onNavigateToCrossReference?: (qname: string) => void;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b">
      <div
        className="flex items-center justify-between bg-gray-100 p-2 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="font-semibold text-sm">{title}</div>
        <div>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>
      {isOpen && <div className="p-2">{children}</div>}
    </div>
  );
};

interface DetailPanelProps {
  selectedNode: any;
  onNavigateToNode?: (qname: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  selectedNode,
  onNavigateToNode,
  onNavigateToCrossReference,
}) => {
  const [activeTab, setActiveTab] = useState("Details");
  const [concept, setConcept] = useState<any | null>(null);

  useEffect(() => {
    if (selectedNode?.data?.qname) {
      const qname = selectedNode.data.qname;
      fetch(`/api/concept-details?qname=${encodeURIComponent(qname)}`)
        .then((res) => res.json())
        .then((data) => {
          setConcept(data);
        })
        .catch((err) => {
          console.error("Error fetching concept data:", err);
          setConcept(null);
        });
    } else {
      setConcept(null);
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4 text-gray-500">
        Please select a concept from the taxonomy tree to view its details.
      </div>
    );
  }

  if (!concept?.concept) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-4 text-red-500">
      Concept data is missing or malformed. Please select another concept.
    </div>
  );
}


  if (!concept) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4 text-gray-500">
        No concept data found.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b">
        {["Details", "Hypercube Relationships", "Tree Locations"].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-1 text-sm font-medium ${
              activeTab === tab
                ? "bg-white border-b-2 border-blue-500"
                : "bg-gray-100"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-2 border-b">
        <div className="font-medium">
          {concept.concept?.local_name ||
            selectedNode.label ||
            selectedNode.data?.qname}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "Details" && (
          <div className="flex flex-col">
            <Accordion
              type="multiple"
              defaultValue={["properties", "labels", "references", "xbrlInfo"]}
              className="w-full"
            >
              <AccordionItem value="properties">
                <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-gray-50">
                  Properties
                </AccordionTrigger>
                <AccordionContent>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="py-2 px-2 border text-sm text-left">
                          Property
                        </th>
                        <th className="py-2 px-2 border text-sm text-left">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Name", value: concept.concept.local_name },
                        concept.cross_ref_destination
                          ? {
                              label: "Cross Reference Target",
                              value: concept.cross_ref_destination,
                            }
                          : null,
                        {
                          label: "Namespace",
                          value: concept.concept.namespace,
                        },
                        concept.concept.balance != null
                          ? { label: "Balance", value: concept.concept.balance }
                          : null,
                        concept.cash_flow_classification
                          ? {
                              label: "Cash Flow Classification",
                              value: concept.cash_flow_classification,
                            }
                          : null,
                        {
                          label: "Period Type",
                          value: concept.concept.period_type,
                        },
                        {
                          label: "Data Type",
                          value: concept.concept.full_type,
                        },
                        {
                          label: "XBRL Type",
                          value: concept.concept.xbrl_type,
                        },
                        {
                          label: "Substitution Group",
                          value: concept.concept.substitution_group,
                        },
                        {
                          label: "Abstract",
                          value: concept.concept.abstract ? "true" : "false",
                        },
                        {
                          label: "Nillable",
                          value: concept.concept.nillable ? "true" : "false",
                        },
                      ]
                        .filter(
                          (
                            row
                          ): row is {
                            label: string;
                            value: string | boolean | null;
                          } => row !== null
                        )
                        .map((row, idx) => (
                          <tr
                            key={row.label}
                            className={
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="py-1 px-2 border text-sm w-1/4 font-medium">
                              {row.label}
                            </td>
                            <td className="py-1 px-2 border text-sm">
                              {row.label === "Cross Reference Target" ? (
                                <div>
                                  {Array.isArray(row.value) ? (
                                    row.value.map(
                                      (qname: string, i: number) => (
                                        <button
                                          key={qname}
                                          className="text-blue-600 underline hover:text-blue-800 mr-2 text-left break-words whitespace-normal max-w-sm"
                                          onClick={() => {
                                            console.log(
                                              "Navigating to cross reference:",
                                              qname
                                            );
                                            onNavigateToCrossReference?.(qname);
                                          }}
                                        >
                                          {qname}
                                        </button>
                                      )
                                    )
                                  ) : (
                                    <button
                                      className="text-blue-600 underline hover:text-blue-800 text-left break-words whitespace-normal max-w-sm"
                                      onClick={() => {
                                        console.log(
                                          "Navigating to cross reference:",
                                          row.value
                                        );
                                        onNavigateToCrossReference?.(
                                          String(row.value)
                                        );
                                      }}
                                    >
                                      {String(row.value)}
                                    </button>
                                  )}
                                </div>
                              ) : row.label === "Name" ? (
                                <button
                                  className="text-blue-600 underline hover:text-blue-800  text-left break-words whitespace-normal max-w-sm"
                                  onClick={() => {
                                    console.log(
                                      "Navigating to node:",
                                      selectedNode.data.qname
                                    );
                                    onNavigateToNode?.(
                                      `${selectedNode.data.qname}`
                                    );
                                  }}
                                >
                                  {String(row.value)}
                                </button>
                              ) : (
                                row.value ?? "–"
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="labels">
                <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-gray-50">
                  Labels
                </AccordionTrigger>
                <AccordionContent>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="py-2 px-2 border text-sm text-left w-sm whitespace-nowrap">
                          Type
                        </th>

                        <th className="py-2 px-2 border text-sm text-left">
                          Language
                        </th>
                        <th className="py-2 px-2 border text-sm text-left">
                          Label
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const labels = concept.labels || [];
                        const preferred = concept.concept?.preferred_label_role;

                        const langOrder = (lang: string): number =>
                          lang === "en" ? 0 : lang === "cy" ? 1 : 2;

                        const typeOrder = (type: string): number => {
                          if (preferred && type === preferred) return 0;
                          if (type === "Standard Label") return 1;
                          if (type === "Documentation") return 3;
                          return 2; // other types
                        };

                        const sortedLabels = [...labels].sort((a, b) => {
                          const langCmp = langOrder(a.lang) - langOrder(b.lang);
                          if (langCmp !== 0) return langCmp;

                          const typeCmp = typeOrder(a.type) - typeOrder(b.type);
                          if (typeCmp !== 0) return typeCmp;

                          return a.label_text.localeCompare(b.label_text); // consistent fallback
                        });

                        return sortedLabels.map((label, idx) => (
                          <tr
                            key={idx}
                            className={
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="py-1 px-2 border text-sm w-1/4 whitespace-nowrap align-top">
                              {label.type ===
                              concept.concept.preferred_label_role ? (
                                <div className="px-2 py-1 rounded bg-blue-100 text-blue-800 inline-block">
                                  <div className="font-semibold">
                                    {label.type}
                                  </div>
                                  <div className="text-xs italic">
                                    (Preferred)
                                  </div>
                                </div>
                              ) : (
                                label.type
                              )}
                            </td>

                            <td className="py-1 px-2 border text-sm">
                              {label.lang}
                            </td>
                            <td className="py-1 px-2 border text-sm">
                              {label.label_text}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="references">
                <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-gray-50">
                  References
                </AccordionTrigger>
                <AccordionContent>
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="py-2 px-2 border text-sm text-left w-1/4">
                          Type
                        </th>
                        <th className="py-2 px-2 border text-sm text-left">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(concept.references || [])]
                        .sort((a, b) => {
                          const priority = (role: string | null) => {
                            if (role === "Full / FRS101") return 0;
                            if (role === "FRS 102") return 1;
                            if (role === "Companies Act") return 2;
                            return 3;
                          };
                          const aRole = a.reference_role || "";
                          const bRole = b.reference_role || "";
                          const aP = priority(aRole);
                          const bP = priority(bRole);
                          return aP !== bP
                            ? aP - bP
                            : aRole.localeCompare(bRole);
                        })
                        .map((ref: any, idx: number) => {
                          const { reference_role, ...details } = ref;
                          const orderedFields = [
                            "name",
                            "number",
                            "year",
                            "schedule",
                            "part",
                            "report",
                            "section",
                            "paragraph",
                          ].filter((key) => key in details);

                          return (
                            <tr
                              key={idx}
                              className={
                                idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }
                            >
                              <td className="py-1 px-2 border align-top text-sm w-1/4 whitespace-nowrap">
                                {reference_role || "—"}
                              </td>
                              <td className="py-1 px-2 border text-sm align-top">
                                <div className="grid grid-cols-[120px_1fr] gap-y-1">
                                  {orderedFields.map((key) => (
                                    <React.Fragment key={key}>
                                      <div className="text-sm font-medium text-gray-700">
                                        {key.charAt(0).toUpperCase() +
                                          key.slice(1)}
                                      </div>

                                      <div className="text-sm">
                                        {String(details[key])}
                                      </div>
                                    </React.Fragment>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {activeTab === "Hypercube Relationships" && (
          <div className="p-4 text-center text-gray-500">
            Hypercube relationships panel content will be implemented soon
          </div>
        )}
        {activeTab === "Tree Locations" && (
          <div className="p-4 text-center text-gray-500">
            Tree Locations panel content will be implemented soon
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailPanel;
