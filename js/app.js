import { LocationManager } from './location.js';
import { StoryManager } from './stories.js';
import { WalksManager } from './walks.js';
import { showError, showSuccess } from './notify.js';
import { openDialog } from './dialog.js';
import { storage, KEYS } from './util.js';
import { registerServiceWorker, saveWalkOffline } from './offline.js';

// ---------- Map ----------

const map = L.map('map').setView([54.5, -1.5], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

window.map = map;

// ---------- State ----------

const locationManager = new LocationManager();
const storyManager = new StoryManager();
const walksManager = new WalksManager();

// Shared registry used by the managers
window.locationManager = locationManager;
window.storyManager = storyManager;
window.walksManager = walksManager;
window.folkloreApp = { setMode };

let locationRequested = false;

// ---------- Modes ----------

function setMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(button => {
    const active = button.id === mode + 'Mode';
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const walkSelector = document.getElementById('walkSelector');
  const searchFilters = document.getElementById('searchFilters');

  if (mode === 'guided') {
    walkSelector.style.display = 'block';
    searchFilters.style.display = 'none';
  } else {
    walkSelector.style.display = 'none';
    searchFilters.style.display = 'flex';
  }
}

function startGuidedWalk() {
  const walkId = document.getElementById('walkFilter').value;
  if (!walkId) {
    showError('Please select a walk first');
    return;
  }
  walksManager.startWalk(walkId);
}

// ---------- Search and filters ----------

function bindSearchAndFilters() {
  const searchBar = document.getElementById('searchBar');
  const categoryFilter = document.getElementById('categoryFilter');

  const apply = () => storyManager.filterStories(searchBar.value, categoryFilter.value);
  searchBar.addEventListener('input', apply);
  categoryFilter.addEventListener('change', apply);
}

// ---------- Location choice and preview mode ----------

function showWelcomeDialog() {
  return new Promise(resolve => {
    let choice = 'browse';

    const dialog = openDialog({
      id: 'welcome-dialog',
      title: 'Welcome to Folklore Explorer',
      dismissible: false,
      bodyHtml: `
        <p>Stories unlock when you are near the place they belong to. To do that, the app uses your location while you have it open.</p>
        <ul class="plain-list">
          <li>This site does not collect or store your location. It stays on your device.</li>
          <li>Map tiles come from OpenStreetMap. Walking directions come from the public OSRM service, which receives your position and the next stop when it works out a route.</li>
          <li>You can browse every story without location in preview mode.</li>
        </ul>
        <p class="safety-note">Stay on public rights of way, take care near roads, cliffs, livestock, and tides, and check conditions before you set off.</p>
      `,
      footerHtml: `
        <button class="continue-btn" data-choice="use" data-autofocus>Use my location</button>
        <button class="action-btn secondary" data-choice="browse">Browse without location</button>
      `,
      onClose: () => resolve(choice)
    });

    dialog.root.addEventListener('click', event => {
      const button = event.target.closest('[data-choice]');
      if (!button) return;
      choice = button.dataset.choice;
      dialog.close();
    });
  });
}

function showPreviewBanner(message) {
  removePreviewBanner();

  const banner = document.createElement('div');
  banner.id = 'previewBanner';
  banner.className = 'preview-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    <span>${message}</span>
    <button type="button" id="useLocationBtn">Use my location</button>
  `;

  document.getElementById('map').before(banner);
  document.getElementById('useLocationBtn').addEventListener('click', () => {
    storage.set(KEYS.locationChoice, 'use');
    startLocation();
  });
}

function removePreviewBanner() {
  const banner = document.getElementById('previewBanner');
  if (banner) banner.remove();
}

function enablePreview(message) {
  storyManager.setPreviewMode(true);
  showPreviewBanner(message || 'Preview mode: every story is readable. Walks need your location to track progress.');
}

async function startLocation() {
  locationRequested = true;
  removePreviewBanner();
  storyManager.setPreviewMode(false);

  await locationManager.initialize();

  if (!locationManager.hasFix) {
    enablePreview('We could not find your location yet, so preview mode is on. Stories will lock again once a position is found.');
  }
}

// Leaves preview mode automatically when a late position fix arrives
window.addEventListener('folklore:locationupdate', () => {
  if (locationRequested && storyManager.previewMode && locationManager.hasFix) {
    removePreviewBanner();
    storyManager.setPreviewMode(false);
  }
});

async function chooseLocationMode() {
  const saved = storage.get(KEYS.locationChoice, null);

  if (saved === 'use') {
    await startLocation();
  } else if (saved === 'browse') {
    enablePreview();
  } else {
    const choice = await showWelcomeDialog();
    storage.set(KEYS.locationChoice, choice);
    if (choice === 'use') {
      await startLocation();
    } else {
      enablePreview();
    }
  }
}

// Saves battery: stop listening to the GPS while the page is hidden,
// unless a walk is running.
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    if (!walksManager.walkStarted) locationManager.stopWatching();
  } else {
    locationManager.resumeWatching();
  }
}

// ---------- Offline and housekeeping ----------

function bindOfflineButton() {
  const button = document.getElementById('saveOffline');
  const select = document.getElementById('walkFilter');

  button.addEventListener('click', async () => {
    const walk = walksManager.getWalkById(select.value);
    if (!walk) {
      showError('Please select a walk first');
      return;
    }

    const stories = walk.waypoints
      .map(waypoint => walksManager.getStoryByIdSync(waypoint.storyId))
      .filter(Boolean);

    const originalLabel = button.textContent;
    button.disabled = true;

    try {
      const result = await saveWalkOffline(walk, stories, (done, total) => {
        button.textContent = `Saving ${done}/${total}`;
      });

      if (result.failed === 0) {
        showSuccess(`${walk.title} is saved for offline use.`);
      } else {
        showError(`Saved ${result.saved} of ${result.total} files. Check your connection and try again.`);
      }
    } catch (error) {
      showError(error.message || 'Could not save this walk for offline use.');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
}

function bindClearProgressButton() {
  document.getElementById('clearProgress').addEventListener('click', () => {
    if (!confirm('Clear your saved walk progress, unlocked stories, and location choice on this device?')) return;

    walksManager.clearWalkState();
    storyManager.clearUnlocks();
    storage.remove(KEYS.locationChoice);
    window.location.reload();
  });
}

// ---------- Start-up ----------

async function init() {
  registerServiceWorker();

  document.getElementById('exploreMode').addEventListener('click', () => setMode('explore'));
  document.getElementById('guidedMode').addEventListener('click', () => setMode('guided'));
  document.getElementById('startWalk').addEventListener('click', startGuidedWalk);

  bindSearchAndFilters();
  bindOfflineButton();
  bindClearProgressButton();
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Load the data first, so the first location fix can sort the stories
  await Promise.all([storyManager.loadStories(), walksManager.loadWalks()]);

  await chooseLocationMode();

  // Resume a walk saved before a refresh, if there is one
  walksManager.restoreWalkState();
}

init();
