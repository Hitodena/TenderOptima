import { apiClient } from "@/lib/api-client";
import type { OnboardingPageKey } from "@/onboarding/steps";

export interface OnboardingStateResponse {
  enabled: boolean;
  completed: OnboardingPageKey[];
}

export const fetchOnboardingState = async (): Promise<OnboardingStateResponse> => {
  return apiClient.get<OnboardingStateResponse>("/api/onboarding");
};

export const completeOnboardingPage = async (pageKey: OnboardingPageKey) => {
  return apiClient.post<{ success: boolean; pageKey: OnboardingPageKey }>("/api/onboarding", {
    pageKey,
  });
};

