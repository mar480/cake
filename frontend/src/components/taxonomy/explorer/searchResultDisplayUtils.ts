import type { TreeNodeOccurrence } from "./explorerDataUtils";

const getOccurrenceDefinitionElrLabel = (occurrence: TreeNodeOccurrence) =>
  occurrence.elrDefinition || occurrence.elr;

export function getDefinitionElrLabelsForOccurrences(
  occurrences: TreeNodeOccurrence[]
): string[] {
  const labels: string[] = [];
  const seenElrs = new Set<string>();
  const seenElrDefinitions = new Set<string>();

  occurrences
    .filter((occurrence) => occurrence.network !== "presentation")
    .forEach((occurrence) => {
      const label = getOccurrenceDefinitionElrLabel(occurrence);
      const hasSeenElr = occurrence.elr ? seenElrs.has(occurrence.elr) : false;
      const hasSeenElrDefinition = occurrence.elrDefinition
        ? seenElrDefinitions.has(occurrence.elrDefinition)
        : false;

      if (!label || hasSeenElr || hasSeenElrDefinition) return;

      if (occurrence.elr) seenElrs.add(occurrence.elr);
      if (occurrence.elrDefinition) seenElrDefinitions.add(occurrence.elrDefinition);
      labels.push(label);
    });

  return labels;
}
