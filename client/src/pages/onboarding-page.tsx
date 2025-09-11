import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { BusinessCardSetup } from "@/components/business-card-setup";
import { Button } from "@/components/ui/button";
import { Steps } from "@/components/ui/steps";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type OnboardingStep = "welcome" | "business-card" | "complete";

export default function OnboardingPage() {
  const { user, isOnboardingCompleted, onboardingCompletedMutation } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  
  // If user is not logged in, redirect to auth page
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  // If onboarding is already completed, redirect to home
  if (isOnboardingCompleted) {
    return <Redirect to="/" />;
  }
  
  // Handle completing the onboarding
  const handleComplete = () => {
    // Уведомим сервер о завершении онбординга, если это не было сделано при обновлении бизнес-карты
    if (!isOnboardingCompleted) {
      onboardingCompletedMutation.mutate();
    }
    return <Redirect to="/" />;
  };
  
  // Progress to the next step
  const nextStep = () => {
    if (currentStep === "welcome") {
      setCurrentStep("business-card");
    } else if (currentStep === "business-card") {
      setCurrentStep("complete");
    } else if (currentStep === "complete") {
      handleComplete();
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-8">Добро пожаловать в SupplierFinder</h1>
        
        {/* Progress steps */}
        <div className="mb-8">
          <Steps
            steps={[
              { label: "Приветствие", state: currentStep === "welcome" ? "current" : currentStep === "business-card" || currentStep === "complete" ? "complete" : "incomplete" },
              { label: "Визитная карточка", state: currentStep === "business-card" ? "current" : currentStep === "complete" ? "complete" : "incomplete" },
              { label: "Завершение", state: currentStep === "complete" ? "current" : "incomplete" },
            ]}
          />
        </div>
        
        {/* Step content */}
        <div className="mt-6">
          {currentStep === "welcome" && (
            <Card>
              <CardHeader>
                <CardTitle>Добро пожаловать, {user.username}!</CardTitle>
                <CardDescription>
                  Давайте настроим вашу учетную запись для работы с платформой 
                  SupplierFinder
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  SupplierFinder поможет вам находить поставщиков, запрашивать
                  коммерческие предложения, и анализировать полученные ответы.
                </p>
                <p>
                  Для начала работы вам необходимо настроить вашу визитную карточку,
                  которая будет автоматически добавляться к письмам, отправляемым
                  поставщикам.
                </p>
              </CardContent>
              <CardFooter>
                <Button onClick={nextStep} className="w-full">
                  Продолжить
                </Button>
              </CardFooter>
            </Card>
          )}
          
          {currentStep === "business-card" && (
            <BusinessCardSetup onComplete={nextStep} />
          )}
          
          {currentStep === "complete" && (
            <Card>
              <CardHeader>
                <CardTitle>Настройка завершена!</CardTitle>
                <CardDescription>
                  Вы успешно настроили вашу учетную запись
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Ваша учетная запись полностью настроена и готова к использованию.
                  Теперь вы можете искать поставщиков, отправлять запросы и анализировать
                  полученные предложения.
                </p>
                <p>
                  Ваш тарифный план: <strong>Trial</strong>
                </p>
                <p>
                  Количество доступных запросов: <strong>5</strong>
                </p>
              </CardContent>
              <CardFooter>
                <Button onClick={handleComplete} className="w-full">
                  Начать работу
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}