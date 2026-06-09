import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getHelpContent, HelpContentId } from "./helpContent";
import { useHelp } from "./helpContext";

const HELP_TOOLTIP_DELAY_MS = 3000;

type HelpHintProps = {
  helpId: HelpContentId;
  side?: "top" | "right" | "bottom" | "left";
  mode?: "subtle" | "prominent";
  showTooltip?: boolean;
};

const HelpHint: React.FC<HelpHintProps> = ({
  helpId,
  side = "top",
  mode = "subtle",
  showTooltip = true,
}) => {
  const entry = getHelpContent(helpId);
  const { helpModeEnabled } = useHelp();
  const prominent = mode === "prominent" || helpModeEnabled;
  const tooltipDelayMs = helpModeEnabled ? 0 : HELP_TOOLTIP_DELAY_MS;

  if (!prominent) {
    return null;
  }

  const trigger = (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Help: ${entry.title}`}
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1",
        prominent
          ? "border-amber-400 bg-white text-amber-600 hover:bg-amber-50"
          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
      )}
    >
      ?
    </span>
  );

  if (!showTooltip) {
    return trigger;
  }

  return (
    <TooltipProvider delayDuration={tooltipDelayMs}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs border-slate-200 bg-white text-left text-slate-900 opacity-100"
        >
          <div className="space-y-1">
            <div className="text-sm font-semibold">{entry.title}</div>
            <div className="text-xs leading-5 text-slate-700">{entry.shortText}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default HelpHint;
