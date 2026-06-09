
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import HypercubePopOut from "./components/taxonomy/explorer/HypercubePopOut";
import TreeLocationsPopOut from "./components/taxonomy/explorer/TreeLocationsPopOut";
import { HelpProvider } from "./components/help/HelpProvider";



const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelpProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
          }
          <Route path="/hypercube-popout" element={<HypercubePopOut />} />
          <Route path="/tree-locations-popout" element={<TreeLocationsPopOut />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </HelpProvider>
  </QueryClientProvider>
);

export default App;
