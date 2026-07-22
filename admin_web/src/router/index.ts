import { createRouter, createWebHistory } from "vue-router";
import { allRoute } from "@/router/routes";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import authService from "@/api/auth/authApi";

NProgress.configure({ showSpinner: false });

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: allRoute,
});

// Set page title
router.beforeEach((to, from, next) => {
  const title = to.meta.title;
  if (title) {
    document.title = title.toString();
  }
  next();
});

// Auth guard
router.beforeEach(async (to, from, next) => {
  NProgress.start();

  const authRequired = to.matched.some((route) => route.meta.authRequired);

  if (!authRequired) return next();

  try {
    await authService.meApi();
    return next();
  } catch (error) {
    return next({
      name: "auth.signin",
      query: { redirectedFrom: to.fullPath },
    });
  }
});

router.afterEach(() => {
  NProgress.done();
});

export default router;
