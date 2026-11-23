// Offline support: service worker registration and "save this walk" downloads
export const WALK_CACHE = 'folklore-walks-v1';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}

// Downloads the images, audio, and route file for a walk into a cache that
// survives app updates. Returns how many files were saved and how many failed.
export async function saveWalkOffline(walk, stories, onProgress) {
  if (!('caches' in window)) {
    throw new Error('This browser cannot save walks for offline use.');
  }

  const urls = new Set();
  stories.forEach(story => {
    if (story.image) urls.add(story.image);
    if (story.audio) urls.add(story.audio);
  });
  if (walk.route) urls.add(walk.route);

  const list = Array.from(urls).map(url => new URL(url, window.location.href).href);
  const cache = await caches.open(WALK_CACHE);
  let saved = 0;
  let failed = 0;

  for (const url of list) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(url, response);
      saved++;
    } catch (error) {
      console.warn('Could not save', url, error);
      failed++;
    }
    if (onProgress) onProgress(saved + failed, list.length);
  }

  return { saved, failed, total: list.length };
}
