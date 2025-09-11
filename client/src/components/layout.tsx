import { ReactNode } from "react";
import { Link } from "wouter";
import { MainNavigation } from "@/components/main-navigation";
import { SubscriptionAlerts } from "@/components/subscription-alerts";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main menu */}
      <MainNavigation />
      
      {/* Subscription alerts */}
      <SubscriptionAlerts />
      
      {/* Main content */}
      <main className="flex-1">
        <div className="container mx-auto py-6">
          {title && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{title}</h1>
            </div>
          )}
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-6 bg-background">
        <div className="container mx-auto">
          <div className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TenderOptima
          </div>
        </div>
      </footer>
    </div>
  );
}