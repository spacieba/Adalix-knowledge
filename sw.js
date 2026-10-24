/* sw.js — service worker volontairement minimal.
   Il n'existe que pour rendre l'app installable sur l'écran d'accueil (c'est la
   condition posée par Chrome et Android). Il ne met RIEN en cache : une app scolaire
   qui sert une vieille version depuis un cache est bien plus pénible qu'une app qui
   exige le réseau — les enfants réviseraient sur un cours qu'on a corrigé la veille. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* on laisse le réseau faire son travail */ });
