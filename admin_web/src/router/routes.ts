const setTitle = (title: string) => {
  return title
    ? `${title} | Demulla Accounting Portal`
    : "Demulla Accounting Portal";
};

const homeRoutes = [
  {
    path: "/",
    name: "home.index",
    meta: {
      title: setTitle("Home Page"),
    },
    component: () => import("@/views/HomePage.vue"),
  },
  {
    path: "/contact-us",
    name: "home.contact",
    meta: {
      title: setTitle("Contact Us"),
    },
    component: () => import("@/views/ContactUs.vue"),
  },
];

const authRoutes = [
  {
    path: "/auth/signup",
    name: "auth.signup",
    meta: {
      title: setTitle("Sign UP"),
    },
    component: () => import("@/views/auth/SignUp.vue"),
  },
  {
    path: "/auth/forgot-password",
    name: "auth.forgot-password",
    meta: {
      title: setTitle("Forgot Password"),
    },
    component: () => import("@/views/auth/ForgotPassword.vue"),
  },
  {
    path: "/auth/reset-password",
    name: "auth.reset-password",
    meta: {
      title: setTitle("Reset Password"),
    },
    component: () => import("@/views/auth/ResetPassword.vue"),
  },
  {
    path: "/auth/signin",
    name: "auth.signin",
    meta: {
      title: setTitle("Sign In"),
    },
    component: () => import("@/views/auth/SignIn.vue"),
  },
  {
    path: "/auth/2fa-setup",
    name: "auth.setup",
    meta: {
      title: setTitle("Set Up 2FA"),
    },
    component: () => import("@/views/auth/Setup2fa.vue"),
  },
  {
    path: "/auth/verify-2fa",
    name: "auth.verify",
    meta: {
      title: setTitle("Verify 2FA"),
    },
    component: () => import("@/views/auth/Verify2fa.vue"),
  },
];

const errorRoutes = [
  {
    path: "/auth/error-404",
    name: "error.404",
    meta: {
      title: setTitle("Error 404"),
    },
    component: () => import("@/views/auth/error-404.vue"),
  },
  {
    path: "/auth/error-500",
    name: "error.500",
    meta: {
      title: setTitle("Error 500"),
    },
    component: () => import("@/views/auth/error-500.vue"),
  },
  {
    path: "/auth/error-403",
    name: "error.403",
    meta: {
      title: setTitle("Error 403"),
      authRequired: true,
    },
    component: () => import("@/views/auth/error-403.vue"),
  },
  {
    path: "/:catchAll(.*)",
    redirect: "/auth/error-404",
  },
];

const dashboardRoutes = [
  {
    path: "/dashboard",
    name: "dashboard.index",
    meta: {
      title: setTitle("Dashboard"),
      authRequired: true,
    },
    component: () => import("@/views/dashboard/DashboardPage.vue"),
  },
  {
    path: "/profile/:id/view",
    name: "profile.view",
    meta: {
      title: setTitle("Dashboard"),
      authRequired: true,
    },
    component: () => import("@/views/dashboard/DashboardPage.vue"),
  },
];

const appRoutes = [
  {
    path: "/apps",
    name: "apps.index",
    meta: {
      title: setTitle("Applications"),
      authRequired: true,
    },
    component: () => import("@/views/apps/ApplicationPage.vue"),
  },
];

const reportsRoutes = [
  {
    path: "/reports",
    name: "reports.index",
    meta: {
      title: setTitle("Reports"),
      authRequired: true,
    },
    component: () => import("@/views/reports/ReportsPage.vue"),
  },
];

const docRoutes = [
  {
    path: "/documentation",
    name: "documentation.index",
    meta: {
      title: setTitle("Documentation"),
      authRequired: true,
    },
    component: () => import("@/views/docs/DocumentationPage.vue"),
  },
];

const transactionsRoutes = [
  {
    path: "/b2c-disbursements",
    name: "transactions.b2c",
    meta: {
      title: setTitle("B2C Disbursements"),
      authRequired: true,
    },
    component: () => import("@/views/transactions/B2CTransactions.vue"),
  },
];

const settingsRoutes = [
  {
    path: "/profile",
    name: "profile.index",
    meta: {
      title: setTitle("Profile"),
      authRequired: true,
    },
    component: () => import("@/views/settings/ProfilePage.vue"),
  },
  {
    path: "/security",
    name: "security.index",
    meta: {
      title: setTitle("Security Settings"),
      authRequired: true,
    },
    component: () => import("@/views/settings/SecurityPage.vue"),
  },
  {
    path: "/notifications",
    name: "notifications.index",
    meta: {
      title: setTitle("Notifications"),
      authRequired: true,
    },
    component: () => import("@/views/settings/NotificationsPage.vue"),
  },
];

export const allRoute = [
  ...authRoutes,
  ...errorRoutes,
  ...homeRoutes,
  ...dashboardRoutes,
  ...appRoutes,
  ...reportsRoutes,
  ...docRoutes,
  ...settingsRoutes,
  ...transactionsRoutes,
];
