import React from "react";
import HelpHint from "./HelpHint";
import { getHelpContent, HelpContentId } from "./helpContent";
import { useHelp } from "./helpContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const HELP_TOOLTIP_DELAY_MS = 3000;

type HelpLabelProps = {
  label: React.ReactNode;
  helpId: HelpContentId;
  side?: "top" | "right" | "bottom" | "left";
  mode?: "subtle" | "prominent";
  className?: string;
};

const HelpLabel: React.FC<HelpLabelProps> = ({
  label,
  helpId,
  side = "top",
  mode = "subtle",
  className,
}) => {
  const entry = getHelpContent(helpId);
  const { helpModeEnabled } = useHelp();
  const showIcon = mode === "prominent" || helpModeEnabled;
  const tooltipDelayMs = helpModeEnabled ? 0 : HELP_TOOLTIP_DELAY_MS;

  return (
    <TooltipProvider delayDuration={tooltipDelayMs}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className ?? "inline-flex items-center gap-1.5"}>
            <span>{label}</span>
            {showIcon ? <HelpHint helpId={helpId} side={side} mode={mode} showTooltip={false} /> : null}
          </span>
        </TooltipTrigger>
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

export default HelpLabel;
