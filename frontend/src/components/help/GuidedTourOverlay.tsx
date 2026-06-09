import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import HelpHint from "./HelpHint";
import { useHelp } from "./helpContext";
import { getTour } from "./tours";
import { buildTourStepExecutionKey, prepareTourStep } from "./tourRuntime";

type RectState = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
};

type CardPosition = React.CSSProperties;

function resolveTargetRect(anchor: string): RectState {
  const target = document.querySelector<HTMLElement>(`[data-help-anchor="${anchor}"]`);
  if (!target) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function mergeRects(rects: RectState[]): RectState {
  const validRects = rects.filter((rect): rect is NonNullable<RectState> => rect !== null);
  if (validRects.length === 0) {
    return null;
  }

  const top = Math.min(...validRects.map((rect) => rect.top));
  const left = Math.min(...validRects.map((rect) => rect.left));
  const right = Math.max(...validRects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...validRects.map((rect) => rect.top + rect.height));

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
}

function resolveCardPosition(
  targetRect: RectState,
  cardWidth: number,
  cardHeight: number,
  placement: "top" | "right" | "bottom" | "left" | "center"
): CardPosition {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
  const gap = 18;
  const clampLeft = (value: number) => Math.min(viewportWidth - cardWidth - 16, Math.max(16, value));
  const clampTop = (value: number) => Math.min(viewportHeight - cardHeight - 16, Math.max(16, value));

  if (!targetRect || placement === "center") {
    return {
      top: Math.max(16, viewportHeight / 2 - cardHeight / 2),
      left: Math.max(16, viewportWidth / 2 - cardWidth / 2),
    };
  }

  if (placement === "left") {
    return {
      top: clampTop(targetRect.top),
      left: clampLeft(targetRect.left - cardWidth - gap),
    };
  }

  if (placement === "right") {
    return {
      top: clampTop(targetRect.top),
      left: clampLeft(targetRect.left + targetRect.width + gap),
    };
  }

  if (placement === "top") {
    return {
      top: clampTop(targetRect.top - cardHeight - gap),
      left: clampLeft(targetRect.left + targetRect.width / 2 - cardWidth / 2),
    };
  }

  return {
    top: clampTop(targetRect.top + targetRect.height + gap),
    left: clampLeft(targetRect.left + targetRect.width / 2 - cardWidth / 2),
  };
}

function renderBodyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

const GuidedTourOverlay: React.FC = () => {
  const {
    helpHomeOpen,
    activeTourId,
    activeStepIndex,
    nextStep,
    previousStep,
    endTour,
    explorerDemoActions,
    explorerDemoState,
  } = useHelp();
  const [targetRect, setTargetRect] = useState<RectState>(null);
  const [spotlightRects, setSpotlightRects] = useState<SpotlightRect[]>([]);
  const [cardAnchorRect, setCardAnchorRect] = useState<RectState>(null);
  const [stepReady, setStepReady] = useState(true);
  const [stepTimedOut, setStepTimedOut] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const runtimeRef = useRef({ explorerDemoActions, explorerDemoState });
  const tour = getTour(activeTourId);

  const step = tour?.steps[activeStepIndex] ?? null;
  const isLastStep = Boolean(tour && activeStepIndex >= tour.steps.length - 1);
  const stepExecutionKey = useMemo(
    () => buildTourStepExecutionKey(activeTourId, activeStepIndex, step?.id),
    [activeStepIndex, activeTourId, step?.id]
  );
  const titleId = useMemo(() => `tour-title-${step?.id ?? "unknown"}`, [step?.id]);
  const descriptionId = useMemo(() => `tour-description-${step?.id ?? "unknown"}`, [step?.id]);

  useEffect(() => {
    runtimeRef.current = { explorerDemoActions, explorerDemoState };
  }, [explorerDemoActions, explorerDemoState]);

  useLayoutEffect(() => {
    if (!step || typeof window === "undefined" || helpHomeOpen) {
      setTargetRect(null);
      setSpotlightRects([]);
      setCardAnchorRect(null);
      return;
    }

    const updatePosition = () => {
      const target = resolveTargetRect(step.targetAnchor);
      const rawSpotlightRects = (step.spotlightAnchors ?? [step.targetAnchor])
        .map((anchor) => resolveTargetRect(anchor))
        .filter((rect): rect is NonNullable<RectState> => rect !== null);
      const spotlightPadding = step.spotlightPadding ?? 8;
      const spotlightRadius = step.spotlightRadius ?? 18;
      const normalizedSpotlightRects =
        step.spotlightStrategy === "separate"
          ? rawSpotlightRects.map((rect) => ({
              top: Math.max(0, rect.top - spotlightPadding),
              left: Math.max(0, rect.left - spotlightPadding),
              width: rect.width + spotlightPadding * 2,
              height: rect.height + spotlightPadding * 2,
              radius: spotlightRadius,
            }))
          : (() => {
              const mergedRect = mergeRects(rawSpotlightRects);
              return mergedRect
                ? [
                    {
                      top: Math.max(0, mergedRect.top - spotlightPadding),
                      left: Math.max(0, mergedRect.left - spotlightPadding),
                      width: mergedRect.width + spotlightPadding * 2,
                      height: mergedRect.height + spotlightPadding * 2,
                      radius: spotlightRadius,
                    },
                  ]
                : [];
            })();

      setTargetRect(target);
      setSpotlightRects(normalizedSpotlightRects);
      setCardAnchorRect(resolveTargetRect(step.cardAnchor ?? step.targetAnchor));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    let resizeObserver: ResizeObserver | null = null;
    const spotlightTargets = (step.spotlightAnchors ?? [step.targetAnchor])
      .map((anchor) => document.querySelector<HTMLElement>(`[data-help-anchor="${anchor}"]`))
      .filter((target): target is HTMLElement => Boolean(target));
    const cardAnchorTarget = document.querySelector<HTMLElement>(
      `[data-help-anchor="${step.cardAnchor ?? step.targetAnchor}"]`
    );

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updatePosition();
      });
      spotlightTargets.forEach((target) => resizeObserver.observe(target));
      if (cardAnchorTarget && !spotlightTargets.includes(cardAnchorTarget)) {
        resizeObserver.observe(cardAnchorTarget);
      }
      if (document.body) {
        resizeObserver.observe(document.body);
      }
      if (cardRef.current) {
        resizeObserver.observe(cardRef.current);
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(updatePosition));

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [helpHomeOpen, step, stepReady, stepTimedOut]);

  useEffect(() => {
    if (!activeTourId) {
      return;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      restoreFocusRef.current?.focus();
    };
  }, [activeTourId]);

  useEffect(() => {
    if (!step) {
      setStepReady(true);
      setStepTimedOut(false);
      return;
    }

    let cancelled = false;

    const getRuntime = () => ({
      explorer: {
        actions: runtimeRef.current.explorerDemoActions,
        state: runtimeRef.current.explorerDemoState,
        getActions: () => runtimeRef.current.explorerDemoActions,
        getState: () => runtimeRef.current.explorerDemoState,
      },
    });

    setStepReady(false);
    setStepTimedOut(false);

    prepareTourStep({
      step,
      getRuntime,
      isCancelled: () => cancelled,
      onBeforeStepError: (error) => {
        console.error("Guided tour beforeStep failed", error);
      },
    }).then((result) => {
      if (cancelled) {
        return;
      }

      setStepReady(true);
      setStepTimedOut(result === "timed_out" || result === "failed");
    });

    return () => {
      cancelled = true;
    };
  }, [step, stepExecutionKey]);

  useEffect(() => {
    if (!activeTourId || helpHomeOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        endTour(false);
        return;
      }

      const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (event.key === "Tab" && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      if (stepReady && event.key === "ArrowRight" && !isLastStep) {
        event.preventDefault();
        nextStep();
      }

      if (stepReady && event.key === "ArrowLeft" && activeStepIndex > 0) {
        event.preventDefault();
        previousStep();
      }
    };

    const focusCard = () => {
      cardRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => requestAnimationFrame(focusCard));

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeStepIndex, activeTourId, endTour, helpHomeOpen, isLastStep, nextStep, previousStep, stepReady]);

  if (helpHomeOpen || !tour || !step) {
    return null;
  }

  const placement = step.placement ?? "bottom";
  const cardWidth = cardRef.current?.offsetWidth ?? 360;
  const cardHeight = cardRef.current?.offsetHeight ?? 240;
  const cardStyle = resolveCardPosition(
    cardAnchorRect,
    cardWidth,
    cardHeight,
    cardAnchorRect ? placement : "center"
  );
  const overlayMaskId = `guided-tour-mask-${step.id}-${activeStepIndex}`;
  const bodyText = targetRect
    ? step.body
    : `${step.body}\n\nThis part of the interface is not visible yet, so the tour is continuing with a centered explanation.`;
  const bodyParagraphs = renderBodyParagraphs(bodyText);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {spotlightRects.length > 0 ? (
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <mask id={overlayMaskId}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightRects.map((rect, index) => (
                <rect
                  key={index}
                  x={rect.left}
                  y={rect.top}
                  width={rect.width}
                  height={rect.height}
                  rx={rect.radius}
                  ry={rect.radius}
                  fill="black"
                />
              ))}
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(15, 23, 42, 0.58)" mask={`url(#${overlayMaskId})`} />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-slate-950/58" />
      )}

      {spotlightRects.map((rect, index) => (
        <div
          key={index}
          className="absolute border-2 border-amber-300 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_0_24px_rgba(253,224,71,0.24)] transition-all duration-150"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: `${rect.radius}px`,
          }}
        />
      ))}

      <section
        ref={cardRef}
        className="pointer-events-auto absolute w-[340px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        style={cardStyle}
        aria-live="polite"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              {tour.title}
            </div>
            <h3 id={titleId} className="mt-1 text-lg font-semibold text-slate-900">{step.title}</h3>
          </div>
          {step.helpId ? <HelpHint helpId={step.helpId} side="left" mode="prominent" /> : null}
        </div>

        <div id={descriptionId} className="space-y-3 text-sm leading-6 text-slate-700">
          {bodyParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {!stepReady ? (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            {step.loadingMessage ?? "Preparing this step..."}
          </div>
        ) : null}

        {stepTimedOut ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            The guided action did not finish in time. You can still continue with the explanation.
          </div>
        ) : null}

        <div className="mt-4 text-xs text-slate-500">
          Step {activeStepIndex + 1} of {tour.steps.length}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => endTour(false)}
          >
            Skip
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={activeStepIndex === 0 || !stepReady}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  endTour(true);
                  return;
                }
                nextStep();
              }}
              disabled={!stepReady}
            >
              {isLastStep ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GuidedTourOverlay;
