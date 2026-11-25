const API_PREFIXES = [
  "/api/",
  "/auth/v1/",
  "/rest/v1/",
  "/storage/v1/",
  "/functions/v1/",
  "/graphql/v1/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  const isAppCode =
    request.mode === "navigate" ||
    request.destination === "script" ||
    request.destination === "style" ||
    [".html", ".htm", ".js", ".mjs", ".css"].some((extension) => url.pathname.toLowerCase().endsWith(extension));

  if (!isAppCode) return;

  // Network-only (network-first without a stale cache fallback): each navigation
  // and app-code request sees the current Vercel deployment immediately.
  event.respondWith(fetch(request, { cache: "no-store" }));
});
