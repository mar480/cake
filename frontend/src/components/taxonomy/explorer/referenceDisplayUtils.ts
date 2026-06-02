import type { ConceptReference } from "./apiTypes";

export const REFERENCE_TYPE_KEYS = new Set([
  "reference_role",
  "referenceRole",
  "role",
  "Role",
  "source",
  "Source",
]);

const firstNonEmptyString = (values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
};

export const getReferenceType = (ref: ConceptReference): string => {
  const keyValues = ref.reference_key_values ?? {};

  return firstNonEmptyString([
    ref.reference_role,
    ref.source,
    keyValues.role,
    keyValues.Role,
    keyValues.source,
    keyValues.Source,
    keyValues.reference_role,
    keyValues.referenceRole,
  ]);
};
