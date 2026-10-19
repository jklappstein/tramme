// The editor as an installed app: the browser's offer (Chrome, Edge, Android)
// is kept from the page's start until the user asks for it, on the home screen.
// Imported by main.tsx first, so the offer is never missed. Safari has none:
// its Share menu adds the app to the home screen (the manifest and the icons
// of build.ts serve it as well).

import { signal } from '@preact/signals';

interface InstallOffer extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let offer: InstallOffer | null = null;
/** the browser offers to install the app now */
export const installable = signal(false);

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); offer = e as InstallOffer; installable.value = true; });
  addEventListener('appinstalled', () => { offer = null; installable.value = false; });
}

/** the browser's own question; an offer is answered once */
export async function install() {
  if (!offer) return;
  const asked = offer;
  offer = null;
  installable.value = false;
  await asked.prompt();
  await asked.userChoice;
}
