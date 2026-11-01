import { createHash } from 'node:crypto'

/** Creates a stable cache name from the shell files so changed files get a new version. */
export function shellIdentity(contents: Record<string, string | Uint8Array>) {
  const hash = createHash('sha256')
  for (const [name, content] of Object.entries(contents).sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(name).update('\0').update(content).update('\0')
  }
  return 'rafik-shell-' + hash.digest('hex').slice(0, 16)
}

/** Builds the service-worker source that caches the app shell for offline page loads. */
export function shellWorker(cache: string, assets: string[]) {
  return `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(assets)};
// Never skipWaiting: every open tab keeps the complete version it started with.
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rafik-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith(caches.open(CACHE).then(cache=>cache.match('/index.html',{ignoreVary:true})).then(hit=>hit||fetch(event.request)));
  return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true})).then(hit=>hit||fetch(event.request)));
});`
}
