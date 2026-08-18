import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Compliance from "./pages/Compliance";
import Discovery from "./pages/Discovery";
import Guidance from "./pages/Guidance";
import Leads from "./pages/Leads";
import NotFound from "./pages/NotFound";
import Outreach from "./pages/Outreach";
import Settings from "./pages/Settings";
import Legal from "./pages/Legal";
import ReplyHub from "./pages/ReplyHub";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/discover" component={Discovery} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/leads" component={Leads} />
      <Route path="/outreach" component={Outreach} />
      <Route path="/strategy" component={Guidance} />
      <Route path="/settings" component={Settings} />
      <Route path="/reply-hub" component={ReplyHub} />
      <Route path="/privacy" component={Legal} />
      <Route path="/terms" component={Legal} />
      <Route path="/acceptable-use" component={Legal} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider><Toaster /><Router /></TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
