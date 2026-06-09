import { createContext, useContext } from "react";
import { ExplorerDemoActions, ExplorerDemoState } from "@/components/taxonomy/explorer/explorerHelpTypes";

export type HelpContextValue = {
  helpModeEnabled: boolean;
  setHelpModeEnabled: (enabled: boolean) => void;
  helpHomeOpen: boolean;
  openHelpHome: () => void;
  closeHelpHome: () => void;
  onboardingDismissed: boolean;
  setOnboardingDismissed: (dismissed: boolean) => void;
  activeTourId: string | null;
  activeStepIndex: number;
  completedTours: string[];
  startTour: (tourId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  endTour: (completed?: boolean) => void;
  explorerDemoState: ExplorerDemoState | null;
  explorerDemoActions: ExplorerDemoActions | null;
  setExplorerDemoRuntime: (
    state: ExplorerDemoState,
    actions: ExplorerDemoActions
  ) => void;
  clearExplorerDemoRuntime: () => void;
};

export const HelpContext = createContext<HelpContextValue | null>(null);

export function useHelp(): HelpContextValue {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error("useHelp must be used within a HelpProvider");
  }
  return context;
}
