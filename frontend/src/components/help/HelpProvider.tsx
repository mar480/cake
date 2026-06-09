import React, { useCallback, useEffect, useMemo, useState } from "react";
import GuidedTourOverlay from "./GuidedTourOverlay";
import HelpHomeDialog from "./HelpHomeDialog";
import { HelpContext, HelpContextValue } from "./helpContext";
import { getHelpHomeOpenState } from "./tourRuntime";
import { ExplorerDemoActions, ExplorerDemoState } from "@/components/taxonomy/explorer/explorerHelpTypes";

const HELP_MODE_STORAGE_KEY = "cake.helpModeEnabled";
const ONBOARDING_DISMISSED_STORAGE_KEY = "cake.onboardingDismissed";
const COMPLETED_TOURS_STORAGE_KEY = "cake.completedTours";

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (raw === null) {
    return fallback;
  }

  return raw === "true";
}

function readStoredStringArray(key: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [helpModeEnabled, setHelpModeEnabledState] = useState(false);
  const [helpHomeOpen, setHelpHomeOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissedState] = useState(false);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<string[]>([]);
  const [explorerDemoState, setExplorerDemoState] = useState<ExplorerDemoState | null>(null);
  const [explorerDemoActions, setExplorerDemoActions] = useState<ExplorerDemoActions | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHelpModeEnabledState(readStoredBoolean(HELP_MODE_STORAGE_KEY, false));
    setOnboardingDismissedState(readStoredBoolean(ONBOARDING_DISMISSED_STORAGE_KEY, false));
    setCompletedTours(readStoredStringArray(COMPLETED_TOURS_STORAGE_KEY));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HELP_MODE_STORAGE_KEY, String(helpModeEnabled));
  }, [helpModeEnabled, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      ONBOARDING_DISMISSED_STORAGE_KEY,
      String(onboardingDismissed)
    );
  }, [hydrated, onboardingDismissed]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(COMPLETED_TOURS_STORAGE_KEY, JSON.stringify(completedTours));
  }, [completedTours, hydrated]);

  const setHelpModeEnabled = useCallback((enabled: boolean) => {
    setHelpModeEnabledState(enabled);
    if (enabled) {
      setOnboardingDismissedState(true);
    }
  }, []);

  const openHelpHome = useCallback(() => {
    const nextState = getHelpHomeOpenState();
    setActiveTourId(nextState.activeTourId);
    setActiveStepIndex(nextState.activeStepIndex);
    setHelpHomeOpen(nextState.helpHomeOpen);
    setOnboardingDismissedState(true);
  }, []);

  const closeHelpHome = useCallback(() => {
    setHelpHomeOpen(false);
  }, []);

  const setOnboardingDismissed = useCallback((dismissed: boolean) => {
    setOnboardingDismissedState(dismissed);
  }, []);

  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId);
    setActiveStepIndex(0);
    setHelpHomeOpen(false);
  }, []);

  const nextStep = useCallback(() => {
    setActiveStepIndex((current) => current + 1);
  }, []);

  const previousStep = useCallback(() => {
    setActiveStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const endTour = useCallback((completed = false) => {
    if (completed && activeTourId) {
      setCompletedTours((current) =>
        current.includes(activeTourId) ? current : [...current, activeTourId]
      );
    }
    setActiveTourId(null);
    setActiveStepIndex(0);
  }, [activeTourId]);

  const setExplorerDemoRuntime = useCallback(
    (state: ExplorerDemoState, actions: ExplorerDemoActions) => {
      setExplorerDemoState(state);
      setExplorerDemoActions(actions);
    },
    []
  );

  const clearExplorerDemoRuntime = useCallback(() => {
    setExplorerDemoState(null);
    setExplorerDemoActions(null);
  }, []);

  const value = useMemo<HelpContextValue>(
    () => ({
      helpModeEnabled,
      setHelpModeEnabled,
      helpHomeOpen,
      openHelpHome,
      closeHelpHome,
      onboardingDismissed,
      setOnboardingDismissed,
      activeTourId,
      activeStepIndex,
      completedTours,
      startTour,
      nextStep,
      previousStep,
      endTour,
      explorerDemoState,
      explorerDemoActions,
      setExplorerDemoRuntime,
      clearExplorerDemoRuntime,
    }),
    [
      activeStepIndex,
      activeTourId,
      closeHelpHome,
      completedTours,
      endTour,
      explorerDemoActions,
      explorerDemoState,
      helpHomeOpen,
      helpModeEnabled,
      nextStep,
      onboardingDismissed,
      openHelpHome,
      previousStep,
      clearExplorerDemoRuntime,
      setExplorerDemoRuntime,
      setHelpModeEnabled,
      setOnboardingDismissed,
      startTour,
    ]
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
      <HelpHomeDialog />
      <GuidedTourOverlay />
    </HelpContext.Provider>
  );
}
