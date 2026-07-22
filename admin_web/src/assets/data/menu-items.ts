import { hasPermissionInModules } from "@/helpers/permissions";
import type { MenuItemType } from "@/types/menu";

const isAdmin: boolean = false;

export const MENU_ITEMS: MenuItemType[] = [
  {
    key: "dashboard-basic",
    icon: "iconoir-home-alt",
    label: "Dashboard",
    route: { name: "dashboard.index" },
  },
  {
    key: "apps",
    icon: "iconoir-mobile-dev-mode",
    label: "Applications",
    route: { name: "apps.index" },
  },
  {
    key: "transactions",
    icon: "iconoir-reports",
    label: "Transactions",
    children: [
      {
        key: "transactions-b2c",
        label: "B2C Disbursements",
        route: { name: "transactions.b2c" },
        parentKey: "transactions",
      },
      {
        key: "transactions-stk",
        label: "STK Push",
        route: { name: "dashboard.index" },
        parentKey: "transactions",
      },
      {
        key: "transactions-paybill",
        label: "Paybill Payments",
        route: { name: "dashboard.index" },
        parentKey: "transactions",
      },
      {
        key: "transactions-status",
        label: "Status Queries",
        route: { name: "dashboard.index" },
        parentKey: "transactions",
      },
    ],
  },
  {
    key: "reports",
    icon: "iconoir-graph-up",
    label: "Reports",
    route: { name: "reports.index" },
  },
  {
    key: "api-docs",
    icon: "iconoir-code",
    label: "API Documentation",
    route: { name: "documentation.index" },
  },
  {
    key: "settings",
    icon: "iconoir-settings",
    label: "Settings",
    children: [
      {
        key: "settings-profile",
        label: "Profile",
        route: { name: "profile.index" },
        parentKey: "settings",
      },
      {
        key: "settings-security",
        label: "Security",
        route: { name: "security.index" },
        parentKey: "settings",
      },
      {
        key: "settings-notifications",
        label: "Notifications",
        route: { name: "notifications.index" },
        parentKey: "settings",
      },
    ],
  },
];
