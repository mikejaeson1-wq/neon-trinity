// Cache the app shell only. Never intercept credentials, APIs, media or callbacks.
const CACHE='neon-trinity-mobile-v070';
const FILES=['mobile.html','mobile.css','mobile.mjs','mobile-library.mjs','mobile-spotify.mjs','mobile.webmanifest','vendor/supabase.mjs','cloud-config.mjs','core.mjs','appearance.mjs','player-settings.mjs','local-library.mjs','shared.mjs','assets/logo.svg','assets/icon.png','assets/icon-192.png','assets/neon-trinity.png'];
const allowed=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('neon-trinity-mobile-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET'||!allowed.has(request.url))return;
  event.respondWith(fetch(request).then(response=>{if(response.ok&&response.type!=='opaque'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}));}return response;}).catch(()=>caches.match(request).then(cached=>cached||Response.error())));
});
