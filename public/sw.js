const CACHE = "loomline-shell-v1";
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(c => c.addAll(["/"]))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => { const clone=response.clone(); caches.open(CACHE).then(c=>c.put("/",clone)); return response; }).catch(()=>caches.match("/")));
    return;
  }
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/assets/"))) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {const clone=response.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));return response;})));
  }
});
