import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "../polaris/dashboard/DashboardPage";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});
