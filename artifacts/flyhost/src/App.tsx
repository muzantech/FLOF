import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

// Pages
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import VerifyEmailPage from "@/pages/verify-email";
import ForgotPasswordPage from "@/pages/forgot-password";
import ProjectsPage from "@/pages/projects";
import ProjectDetailPage from "@/pages/project-detail";
import DeploymentDetailPage from "@/pages/deployment-detail";
import TeamsPage from "@/pages/teams";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

// New pages
import OnboardingPage from "@/pages/onboarding";
import ProfilePage from "@/pages/profile";
import SubscriptionPage from "@/pages/subscription";
import DeployPage from "@/pages/deploy";
import ReferralPage from "@/pages/referral";
import InvoicesPage from "@/pages/invoices";
import HistoryPage from "@/pages/history";
import StatusPage from "@/pages/status";
import DocsPage from "@/pages/docs";
import AdminPage from "@/pages/admin";
import ServersPage from "@/pages/servers";
import ServerDetailPage from "@/pages/server-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Spinner = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
  </div>
);

// Protected Route — requires login + email verified
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  if (!user.emailVerified) return <Redirect to="/verify-email" />;

  return <Component />;
}

// Requires login only (for verify-email page itself — no email check to avoid loop)
function LoginOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  if (user.emailVerified) return <Redirect to="/dashboard" />;

  return <Component />;
}

// Redirect if already logged in
function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (user) {
    if (!user.emailVerified) return <Redirect to="/verify-email" />;
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login"><AuthRoute component={LoginPage} /></Route>
      <Route path="/register"><AuthRoute component={RegisterPage} /></Route>
      
      {/* Protected Routes */}
      <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
      <Route path="/projects"><ProtectedRoute component={ProjectsPage} /></Route>
      <Route path="/projects/:id"><ProtectedRoute component={ProjectDetailPage} /></Route>
      <Route path="/deployments/:id"><ProtectedRoute component={DeploymentDetailPage} /></Route>
      <Route path="/teams"><ProtectedRoute component={TeamsPage} /></Route>
      <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
      
      {/* New Routes */}
      <Route path="/onboarding"><ProtectedRoute component={OnboardingPage} /></Route>
      <Route path="/profile"><ProtectedRoute component={ProfilePage} /></Route>
      <Route path="/subscription"><ProtectedRoute component={SubscriptionPage} /></Route>
      <Route path="/deploy"><ProtectedRoute component={DeployPage} /></Route>
      <Route path="/referral"><ProtectedRoute component={ReferralPage} /></Route>
      <Route path="/invoices"><ProtectedRoute component={InvoicesPage} /></Route>
      <Route path="/history"><ProtectedRoute component={HistoryPage} /></Route>
      <Route path="/admin"><ProtectedRoute component={AdminPage} /></Route>
      <Route path="/servers"><ProtectedRoute component={ServersPage} /></Route>
      <Route path="/servers/:identifier"><ProtectedRoute component={ServerDetailPage} /></Route>
      
      {/* Auth utility routes */}
      <Route path="/verify-email"><LoginOnlyRoute component={VerifyEmailPage} /></Route>
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      {/* Public Routes */}
      <Route path="/status" component={StatusPage} />
      <Route path="/docs" component={DocsPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
