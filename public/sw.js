// Offline support. Slide images carry a content hash (?v=), so a cached copy is always right:
// serve them from the cache first. Everything else (the app, songs.json) comes from the
// network when there is one and falls back to the last copy when there is not.
const SLIDES = 'konti-slides-v1'
const APP = 'konti-app-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  if (/\/(slides|thumbs)\//.test(url.pathname)) {
    e.respondWith(
      caches.open(SLIDES).then(async (c) => {
        const hit = await c.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) c.put(req, res.clone())
        return res
      }),
    )
    return
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(APP).then((c) => c.put(req, res.clone()))
        return res
      })
      .catch(() => caches.match(req, { ignoreSearch: url.pathname.endsWith('/') }).then((r) => r || caches.match('./'))),
  )
})
