import { createBrowserRouter } from "react-router";
import { RootLayout } from "./pages/RootLayout";
import { LandingPage } from "./pages/LandingPage";
import { PricingPage } from "./pages/PricingPage";
import { AgentsPage } from "./pages/AgentsPage";
import { HubPage } from "./pages/HubPage";
import { RemixPage } from "./pages/RemixPage";
import { FlowsPage } from "./pages/FlowsPage";
import { StudioPage } from "./pages/StudioPage";
import { VaultPage } from "./pages/VaultPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { BrandScorePage } from "./pages/BrandScorePage";
import { RecipesPage } from "./pages/RecipesPage";
import { CalendarPage } from "./pages/CalendarPage";
import { AdminPage } from "./pages/AdminPage";
import { SubscribePage } from "./pages/SubscribePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: LandingPage },
      { path: "pricing", Component: PricingPage },
      { path: "models", Component: AgentsPage },
      { path: "agents", Component: AgentsPage },
      { path: "hub", Component: HubPage },
      { path: "remix", Component: RemixPage },
      { path: "flows", Component: FlowsPage },
      { path: "studio", Component: StudioPage },
      { path: "studio/vault", Component: VaultPage },
      { path: "studio/campaigns", Component: CampaignsPage },
      { path: "studio/analytics", Component: AnalyticsPage },
      { path: "login", Component: LoginPage },
      { path: "subscribe", Component: SubscribePage },
      { path: "profile", Component: ProfilePage },
      { path: "brand-score", Component: BrandScorePage },
      { path: "recipes", Component: RecipesPage },
      { path: "calendar", Component: CalendarPage },
      { path: "admin", Component: AdminPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);