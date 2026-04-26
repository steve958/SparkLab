type RouterLike = {
  back: () => void;
  replace: (href: string) => void;
};

// Pops the SPA history stack when possible, falling back to a route
// replace when the user landed on this screen directly (refresh, deep link,
// or PWA cold start). Keeping back/exit buttons on this path stops history
// from accumulating into a long Android-back chain on PWAs.
export function goBackOr(router: RouterLike, fallback: string) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.replace(fallback);
}
