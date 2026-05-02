import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuraLayout from "./pages/AuraLayout.tsx";
import IntelligencePage from "./pages/IntelligencePage.tsx";
import CommunicationPage from "./pages/CommunicationPage.tsx";
import OperatorPage from "./pages/OperatorPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AuraLayout />}>
            <Route path="/" element={<IntelligencePage />} />
            <Route path="/communication" element={<CommunicationPage />} />
            <Route path="/operator" element={<OperatorPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
