import { LifeBuoy } from "lucide-react";
import { useHelp } from "./helpContext";

const HelpLauncherButton: React.FC = () => {
  const { openHelpHome } = useHelp();

  return (
    // <button
    //   type="button"
    //   onClick={openHelpHome}
    //   className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-rose-500/30 transition-transform duration-150 hover:scale-[1.02] sm:px-4 sm:text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800 motion-reduce:transform-none motion-reduce:transition-none "
    //   aria-label="Open help"
    // >
    //   <LifeBuoy className="h-4 w-4" />
    //   <span>Help</span>
    // </button>
    <button
  type="button"
  onClick={openHelpHome}
  className="
    group relative inline-flex items-center gap-2 overflow-hidden rounded-full
    bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400
    px-3 py-2 text-xs font-bold text-white
    shadow-lg shadow-rose-500/30
    transition-transform duration-150 hover:scale-[1.02]
    focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800
    sm:px-4 sm:text-sm
    animate-help-attention
    motion-reduce:animate-none motion-reduce:transform-none motion-reduce:transition-none
  "
  aria-label="Open help"
>
  <span
    className="
      pointer-events-none absolute inset-0
      -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent
      animate-help-shine
      motion-reduce:hidden
    "
    aria-hidden="true"
  />

  <LifeBuoy className="relative h-4 w-4 animate-help-icon motion-reduce:animate-none" />
  <span className="relative">Help</span>
</button>
  );
};

export default HelpLauncherButton;
