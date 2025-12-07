import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { completeOnboardingPage, fetchOnboardingState, OnboardingStateResponse } from "@/api/onboarding";
import { onboardingRouteMap, onboardingSteps, type OnboardingPageKey, type OnboardingTourStep } from "@/onboarding/steps";
import { SpotlightLayer } from "@/components/onboarding/SpotlightLayer";
import { OnboardingCoachmark } from "@/components/onboarding/OnboardingCoachmark";

type OnboardingContextValue = {
  startOnboarding: (pageKey: OnboardingPageKey, options?: { force?: boolean }) => void;
  dismissOnboarding: (markCompleted?: boolean) => void;
  isEnabled: boolean;
  activePageKey: OnboardingPageKey | null;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const clientFlagEnabled = () => {
  const value = (import.meta.env.VITE_ONBOARDING_ENABLED ?? "true").toLowerCase();
  return !(value === "false" || value === "0");
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizePath = (path: string | null) => {
  if (!path) return path;
  const [base] = path.split("?");
  return base;
};

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [location] = useLocation();
  const [activePageKey, setActivePageKey] = useState<OnboardingPageKey | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const routeTriggeredRef = useRef<string | null>(null);

  const isClientEnabled = clientFlagEnabled();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: fetchOnboardingState,
    enabled: isClientEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: completeOnboardingPage,
    onSuccess: (_result, pageKey) => {
      queryClient.setQueryData(["onboarding-state"], (prev?: OnboardingStateResponse) => {
        if (!prev) {
          return { enabled: true, completed: [pageKey] };
        }

        if (prev.completed.includes(pageKey)) {
          return prev;
        }

        return {
          ...prev,
          completed: [...prev.completed, pageKey],
        };
      });
    },
  });

  const completed = data?.completed ?? [];
  const serverEnabled = data?.enabled ?? isClientEnabled;
  const isFeatureEnabled = isClientEnabled && serverEnabled && !isError;
  const currentSteps = activePageKey ? onboardingSteps[activePageKey] : null;
  const currentStep = currentSteps ? currentSteps[stepIndex] : null;

  const startOnboarding = useCallback(
    (pageKey: OnboardingPageKey, options?: { force?: boolean }) => {
      if (!isFeatureEnabled) return;
      if (!onboardingSteps[pageKey]) return;
      if (!options?.force && completed.includes(pageKey)) return;
      setActivePageKey(pageKey);
      setStepIndex(0);
    },
    [completed, isFeatureEnabled]
  );

  const dismissOnboarding = useCallback(
    (markCompleted: boolean = true) => {
      if (!activePageKey) return;
      const pageKey = activePageKey;
      
      // Immediately update local state to prevent re-triggering
      if (markCompleted) {
        queryClient.setQueryData(["onboarding-state"], (prev?: OnboardingStateResponse) => {
          if (!prev) {
            return { enabled: true, completed: [pageKey] };
          }
          if (prev.completed.includes(pageKey)) {
            return prev;
          }
          return {
            ...prev,
            completed: [...prev.completed, pageKey],
          };
        });
        mutation.mutate(pageKey);
      }
      
      setActivePageKey(null);
      setStepIndex(0);
      setTargetRect(null);
      routeTriggeredRef.current = null;
    },
    [activePageKey, mutation, queryClient]
  );

  const handleNext = useCallback(() => {
    if (!currentSteps || !activePageKey) {
      return;
    }

    const isLastStep = stepIndex >= currentSteps.length - 1;

    if (isLastStep) {
      dismissOnboarding(true);
      return;
    }

    setStepIndex((prev) => clamp(prev + 1, 0, currentSteps.length - 1));
  }, [activePageKey, currentSteps, dismissOnboarding, stepIndex]);

  const handleSkip = useCallback(() => {
    dismissOnboarding(true);
  }, [dismissOnboarding]);

  useEffect(() => {
    if (!isFeatureEnabled || isLoading) {
      return;
    }

    // Check for query parameters BEFORE normalizing to determine the correct page key
    const hasRequestId = location.includes("requestId=");
    const normalized = normalizePath(location);
    
    if (!normalized) {
      return;
    }

    // Check for query parameters to determine the correct page key
    let pageKey = onboardingRouteMap[normalized];
    
    // Special handling for /send-request with requestId parameter
    if (normalized === "/send-request" && hasRequestId) {
      pageKey = "send-request-with-id";
      console.log("[Onboarding] Detected send-request with requestId, using pageKey:", pageKey);
    }

    if (!pageKey) {
      console.log("[Onboarding] No pageKey found for route:", normalized, "hasRequestId:", hasRequestId);
      return;
    }

    if (completed.includes(pageKey)) {
      console.log("[Onboarding] Page already completed:", pageKey);
      return;
    }

    // Don't start onboarding if one is already active
    if (activePageKey !== null) {
      return;
    }

    // Avoid re-triggering on the same route if tour already running
    // Use full location for requestId pages to distinguish them
    const routeKey = hasRequestId ? location : normalized;
    if (routeTriggeredRef.current === routeKey) {
      return;
    }

    routeTriggeredRef.current = routeKey;
    startOnboarding(pageKey);
  }, [location, completed, isFeatureEnabled, isLoading, startOnboarding, activePageKey]);

  useEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let element: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let rafId: number | null = null;
    let retryTimeout: number | null = null;

    const updateRect = () => {
      if (!element) return;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        if (!element) return;
        setTargetRect(element.getBoundingClientRect());
      });
    };

    const attach = () => {
      element = document.querySelector<HTMLElement>(`[data-onboarding-id=\"${currentStep.target}\"]`);
      if (!element) {
        retryTimeout = window.setTimeout(attach, 250);
        return;
      }
      updateRect();
      resizeObserver = new ResizeObserver(updateRect);
      resizeObserver.observe(element);
      window.addEventListener("scroll", updateRect, true);
      window.addEventListener("resize", updateRect);
    };

    attach();

    return () => {
      if (resizeObserver && element) {
        resizeObserver.unobserve(element);
        resizeObserver.disconnect();
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [currentStep]);

  useEffect(() => {
    if (!activePageKey) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissOnboarding(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activePageKey, dismissOnboarding]);

  const contextValue = useMemo<OnboardingContextValue>(
    () => ({
      startOnboarding,
      dismissOnboarding,
      isEnabled: isFeatureEnabled,
      activePageKey,
    }),
    [startOnboarding, dismissOnboarding, isFeatureEnabled, activePageKey]
  );

  const shouldRenderOverlay = Boolean(isFeatureEnabled && activePageKey && currentStep && targetRect);

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {shouldRenderOverlay && currentStep && targetRect && (
        <>
          <SpotlightLayer rect={targetRect} onDismiss={handleSkip} />
          <OnboardingCoachmark
            rect={targetRect}
            step={currentStep}
            totalSteps={currentSteps!.length}
            stepIndex={stepIndex}
            onNext={handleNext}
            onSkip={handleSkip}
          />
        </>
      )}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
};

