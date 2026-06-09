import { TourRuntimeContext, TourStep } from "./tours";

export type PreparedTourStepState = "ready" | "timed_out" | "failed" | "cancelled";

type PrepareTourStepArgs = {
  step: TourStep;
  getRuntime: () => TourRuntimeContext;
  isCancelled?: () => boolean;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onBeforeStepError?: (error: unknown) => void;
};

export function buildTourStepExecutionKey(
  activeTourId: string | null,
  activeStepIndex: number,
  stepId: string | null | undefined
): string | null {
  if (!activeTourId || !stepId) {
    return null;
  }

  return `${activeTourId}:${activeStepIndex}:${stepId}`;
}

export function getHelpHomeOpenState() {
  return {
    activeTourId: null as string | null,
    activeStepIndex: 0,
    helpHomeOpen: true,
  };
}

export async function prepareTourStep({
  step,
  getRuntime,
  isCancelled = () => false,
  pollIntervalMs = 120,
  now = () => Date.now(),
  sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  onBeforeStepError,
}: PrepareTourStepArgs): Promise<PreparedTourStepState> {
  if (isCancelled()) {
    return "cancelled";
  }

  try {
    await step.beforeStep?.(getRuntime());
  } catch (error) {
    onBeforeStepError?.(error);
    return isCancelled() ? "cancelled" : "failed";
  }

  if (isCancelled()) {
    return "cancelled";
  }

  if (!step.waitFor) {
    return "ready";
  }

  const startedAt = now();
  const timeoutMs = step.timeoutMs ?? 4000;

  while (!isCancelled()) {
    if (step.waitFor(getRuntime())) {
      return "ready";
    }

    if (now() - startedAt >= timeoutMs) {
      return "timed_out";
    }

    await sleep(pollIntervalMs);
  }

  return "cancelled";
}
