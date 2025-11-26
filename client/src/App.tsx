import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "./contexts/language-context";
import { AuthProvider, useAuth } from "@/hooks/auth-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { AuthInitializer } from "@/components/auth-initializer";
import React, { Suspense } from "react";
import { Redirect } from "wouter";
import SettingsPageWrapper from "./pages/settings-page-wrapper";
import NotFound from "./pages/not-found";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import RequestDetails from "./pages/request-details-new";
import SuccessPage from "./pages/success";
import CompareParameters from "./pages/compare-parameters";
import CompareResults from "./pages/compare-results";
import AnalysisResult from "./pages/analysis-result";
import CloneRequest from "./pages/clone-request";
import SendRequestPage from "./pages/send-request";
import ContactGroupsPage from "./pages/contact-groups"; 
import ContactGroupDetailsPage from "./pages/contact-group-details";
import EmailRequestDetailsPage from "./pages/email-request-details";
import CreateEmailRequestPage from "./pages/create-email-request-page";
import SendGroupEmailPage from "./pages/send-group-email-page";
import SelectRequestParameters from "./pages/select-request-parameters";
import { AnalyzeRequirementsPage } from "./pages/analyze-requirements";
import { AnalyzeOffersPage } from "./pages/analyze-offers";
import { AnalyzeCompliancePage } from "./pages/analyze-compliance";
import { TechnicalAnalysisDashboard } from "./pages/technical-analysis-dashboard";
import { ParameterAnalysisDashboard } from "./pages/parameter-analysis-dashboard";
import AnalysisWorkspace from "./components/AnalysisWorkspace";
import AuthPage from "@/pages/auth-page";
import OnboardingPage from "@/pages/onboarding-page";
import AdminLogin from "@/pages/admin/admin-login";
import WelcomePage from "@/pages/welcome-page";
import QuickProcurementHome from "@/pages/quick-procurement-home";
import TenderProcurementHome from "@/pages/tender-procurement-home";
import LoginLanding from "@/pages/login-landing";
import { SupplierSearchPage } from "@/pages/SupplierSearchPage";
import { NewNavigation } from "@/components/new-navigation";
import AdminEmailPanel from "@/pages/AdminEmailPanel";
import UnprocessedEmailsPage from "@/pages/admin/unprocessed-emails";
import EmailTemplatesPage from "@/pages/admin/email-templates";
import TestGeminiPage from "@/pages/test-gemini";
import AnalysisResultsPage from "@/pages/analysis/results";
import AnalysisStatusPage from "@/pages/analysis-status";

function Router() {
  return (
    <>
      <NewNavigation />
      <Switch>
        {/* Public routes */}
        <Route path="/auth" component={AuthPage} />
        <Route path="/onboarding">
          <ProtectedRoute component={OnboardingPage} />
        </Route>
        
        {/* New navigation pages */}
        <Route path="/login-landing">
          <ProtectedRoute component={LoginLanding} />
        </Route>
        <Route path="/welcome">
          <ProtectedRoute component={WelcomePage} />
        </Route>
        <Route path="/quick-procurement">
          <ProtectedRoute component={QuickProcurementHome} />
        </Route>
        <Route path="/tender-procurement">
          <ProtectedRoute component={TenderProcurementHome} />
        </Route>
        <Route path="/search">
          <ProtectedRoute component={SupplierSearchPage} />
        </Route>
        <Route path="/admin/email">
          <ProtectedRoute component={AdminEmailPanel} />
        </Route>
        <Route path="/admin/unprocessed-emails">
          <ProtectedRoute component={UnprocessedEmailsPage} />
        </Route>
      <Route path="/admin/email-templates">
        <ProtectedRoute component={EmailTemplatesPage} />
      </Route>
      <Route path="/admin-email-panel">
        <ProtectedRoute component={AdminEmailPanel} />
      </Route>
      <Route path="/test-gemini">
        <ProtectedRoute component={TestGeminiPage} />
      </Route>
      <Route path="/analysis/results">
        <ProtectedRoute component={AnalysisResultsPage} />
      </Route>
      <Route path="/analysis/status/:requestId">
        <ProtectedRoute component={AnalysisStatusPage} />
      </Route>
      
      {/* Protected routes */}
      <Route path="/">
        <ProtectedRoute component={LoginLanding} />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/send-request">
        <ProtectedRoute component={SendRequestPage} />
      </Route>
      <Route path="/requests/:id">
        <ProtectedRoute component={RequestDetails} />
      </Route>
      <Route path="/requests/:id/clone">
        <ProtectedRoute component={CloneRequest} />
      </Route>
      <Route path="/requests">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/success/:orderNumber">
        <ProtectedRoute component={SuccessPage} />
      </Route>
      <Route path="/select-request-parameters">
        <ProtectedRoute component={SelectRequestParameters} />
      </Route>
      <Route path="/compare-parameters">
        <ProtectedRoute component={CompareParameters} />
      </Route>
      <Route path="/compare-results">
        <ProtectedRoute component={CompareResults} />
      </Route>
      <Route path="/compare-results/:requestId">
        <ProtectedRoute component={CompareResults} />
      </Route>
      <Route path="/analysis/:id">
        <ProtectedRoute component={AnalysisResult} />
      </Route>
      {/* New Dashboard-based Analysis Routes */}
      <Route path="/analyze/technical">
        <ProtectedRoute component={TechnicalAnalysisDashboard} />
      </Route>
      <Route path="/analyze/parameters">
        <ProtectedRoute component={ParameterAnalysisDashboard} />
      </Route>
      
      {/* Technical Analysis Workflow Routes */}
      <Route path="/analyze/technical/:projectId/requirements">
        <ProtectedRoute component={AnalyzeRequirementsPage} />
      </Route>
      <Route path="/analyze/technical/:projectId/workspace">
        <ProtectedRoute component={(props: any) => <AnalysisWorkspace mode="technical" {...props} />} />
      </Route>
      <Route path="/analyze/technical/:projectId/offers">
        <ProtectedRoute component={AnalyzeOffersPage} />
      </Route>
      <Route path="/analyze/technical/:projectId/compliance">
        <ProtectedRoute component={AnalyzeCompliancePage} />
      </Route>
      
      {/* Parameter Analysis Workflow Routes */}
      <Route path="/analyze/parameters/select">
        <ProtectedRoute component={AnalyzeRequirementsPage} />
      </Route>
      <Route path="/analyze/parameters/compare">
        <ProtectedRoute component={AnalyzeOffersPage} />
      </Route>
      <Route path="/analyze/parameters/results">
        <ProtectedRoute component={AnalyzeCompliancePage} />
      </Route>
      
      {/* Legacy routes for backward compatibility */}
      <Route path="/analyze/requirements">
        <ProtectedRoute component={AnalyzeRequirementsPage} />
      </Route>
      <Route path="/analyze/offers">
        <ProtectedRoute component={AnalyzeOffersPage} />
      </Route>
      <Route path="/analyze/compliance">
        <ProtectedRoute component={AnalyzeCompliancePage} />
      </Route>
      <Route path="/contact-groups">
        <ProtectedRoute component={ContactGroupsPage} />
      </Route>
      <Route path="/contact-groups/:id">
        <ProtectedRoute component={ContactGroupDetailsPage} />
      </Route>
      <Route path="/contact-groups/:id/create-email">
        <ProtectedRoute component={CreateEmailRequestPage} />
      </Route>
      <Route path="/contact-groups/:id/send-email">
        <ProtectedRoute component={SendGroupEmailPage} />
      </Route>
      <Route path="/email-requests/:id">
        <ProtectedRoute component={EmailRequestDetailsPage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPageWrapper} />
      </Route>
      <Route path="/settings/contact">
        <ProtectedRoute component={SettingsPageWrapper} />
      </Route>
      <Route path="/settings/business-card">
        <ProtectedRoute component={SettingsPageWrapper} />
      </Route>
      <Route path="/settings/subscription">
        <ProtectedRoute component={SettingsPageWrapper} />
      </Route>
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admpanel" component={() => {
        const AdminPanelPage = React.lazy(() => import('./pages/admin/admin-panel'));
        return (
          <React.Suspense fallback={<div>Loading...</div>}>
            <AdminPanelPage />
          </React.Suspense>
        );
      }} />
      <Route path="/admin/client-requests/:id/results" component={() => {
        const ClientRequestResults = React.lazy(() => import('./pages/admin/client-request-results'));
        return (
          <React.Suspense fallback={<div>Loading...</div>}>
            <ClientRequestResults />
          </React.Suspense>
        );
      }} />
      <Route path="/admin/client-requests/:id/sent-requests" component={() => {
        const ClientRequestSent = React.lazy(() => import('./pages/admin/client-request-sent'));
        return (
          <React.Suspense fallback={<div>Loading...</div>}>
            <ClientRequestSent />
          </React.Suspense>
        );
      }} />
      <Route>
        <ProtectedRoute component={NotFound} />
      </Route>
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <AuthInitializer>
            <Router />
          </AuthInitializer>
        </AuthProvider>
        <Toaster />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
