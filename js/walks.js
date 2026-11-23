import { escapeHtml, storage, KEYS } from './util.js';
import { showError, showSuccess } from './notify.js';

// Distance at which the "approaching" cue fires, and at which the manual
// "I'm here" button appears (in kilometres and metres respectively)
const APPROACH_RADIUS_KM = 0.3;
const MANUAL_ARRIVAL_RADIUS_M = 300;

export class WalksManager {
  constructor() {
    this.walks = [];
    this.currentWalk = null;
    this.currentWaypointIndex = 0;
    this.walkStarted = false;
    this.completedWaypoints = new Set();
    this.uiPanelVisible = true;

    // Routing
    this.currentRoute = null; // OSRM control (fallback)
    this.fallbackLine = null;
    this.walkRouteLayer = null; // curated GeoJSON route
    this.routeState = 'none'; // 'none' | 'loading' | 'ready' | 'failed'

    // Battery and attention helpers
    this.alertId = null;
    this.keepAwake = true;
    this.wakeLock = null;

    this.resizeHandler = null;
    this.locationHandler = () => this.refreshWaypointStatus();
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') this.acquireWakeLock();
    };
    this.panelClickHandler = event => this.handlePanelClick(event);
  }

  async loadWalks() {
    try {
      const response = await fetch('walks.json');
      if (!response.ok) throw new Error('Failed to load walks');
      const data = await response.json();
      // Walks marked "published": false are hidden until they are ready
      this.walks = data.walks.filter(walk => walk.published !== false);
      this.populateWalkSelector();
    } catch (error) {
      console.error('Error loading walks:', error);
      showError('Failed to load guided walks');
    }
  }

  populateWalkSelector() {
    const select = document.getElementById('walkFilter');
    if (!select) return;

    select.innerHTML = '<option value="">Select a guided walk...</option>';

    this.walks.forEach(walk => {
      const option = document.createElement('option');
      option.value = walk.id;
      option.textContent = `${walk.title} (${walk.estimatedTime})`;
      select.appendChild(option);
    });
  }

  getWalkById(walkId) {
    return this.walks.find(walk => walk.id === walkId);
  }

  getStoryByIdSync(storyId) {
    if (window.storyManager && window.storyManager.stories) {
      return window.storyManager.stories.find(s => s.id === storyId);
    }
    return null;
  }

  getCurrentStory() {
    if (!this.currentWalk) return null;
    const waypoint = this.currentWalk.waypoints[this.currentWaypointIndex];
    return waypoint ? this.getStoryByIdSync(waypoint.storyId) : null;
  }

  startWalk(walkId) {
    const walk = this.getWalkById(walkId);
    if (!walk) {
      console.error('Walk not found:', walkId);
      showError('Walk not found');
      return;
    }

    if (this.walkStarted) this.teardownWalk();

    this.currentWalk = walk;
    this.currentWaypointIndex = 0;
    this.walkStarted = true;
    this.completedWaypoints.clear();
    this.uiPanelVisible = window.innerWidth > 768;

    this.createWalkUI();
    this.showWalkIntro();
    this.loadRoute(walk);
    this.acquireWakeLock();
    this.saveWalkState();
    this.showCurrentWaypoint();
  }

  // ---------- Walk panel ----------

  createWalkUI() {
    const existingUI = document.getElementById('walk-ui');
    if (existingUI) existingUI.remove();

    const walkUI = document.createElement('div');
    walkUI.id = 'walk-ui';
    walkUI.className = this.getWalkUIClass();

    walkUI.innerHTML = `
      <div class="walk-header" id="walkHeader">
        <div class="walk-title">
          <span id="walkTitleText">🚶 ${escapeHtml(this.currentWalk.title)}</span>
          <button class="toggle-btn" id="toggleWalkUI" data-action="toggle" aria-expanded="true" aria-label="Show or hide walk details">▼</button>
        </div>
        <div class="walk-progress">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <span id="progressText">0/${this.currentWalk.waypoints.length} waypoints</span>
        </div>
      </div>

      <div class="walk-content" id="walkContent">
        <div id="walkIntroContent" class="content-section"></div>
        <div id="waypointContent" class="content-section"></div>
        <div id="routingInstructions" class="content-section"></div>

        <div class="walk-actions">
          <label class="wake-toggle">
            <input type="checkbox" id="keepAwakeToggle" data-action="keep-awake" ${this.keepAwake ? 'checked' : ''}>
            Keep screen on during the walk
          </label>
          <button data-action="end" class="action-btn danger">End Walk</button>
        </div>
      </div>
    `;

    document.body.appendChild(walkUI);

    // One delegated listener handles every button in the panel
    walkUI.addEventListener('click', this.panelClickHandler);
    walkUI.addEventListener('change', this.panelClickHandler);

    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    this.resizeHandler = () => this.updateUIForScreenSize();
    window.addEventListener('resize', this.resizeHandler);

    window.addEventListener('folklore:locationupdate', this.locationHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.updateUIForScreenSize();
  }

  handlePanelClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    // The checkbox reports through "change", buttons through "click"
    if (action === 'keep-awake') {
      if (event.type === 'change') this.setKeepAwake(target.checked);
      return;
    }
    if (event.type === 'change') return;

    switch (action) {
      case 'toggle': this.toggleUI(); break;
      case 'end': this.endWalk(); break;
      case 'dismiss-intro': this.dismissIntro(); break;
      case 'view-story': this.viewCurrentStory(); break;
      case 'next': this.nextWaypoint(); break;
      case 'manual-arrive': this.manualArrive(); break;
      default: break;
    }
  }

  getWalkUIClass() {
    return window.innerWidth <= 768 ? 'walk-ui-mobile' : 'walk-ui-desktop';
  }

  updateUIForScreenSize() {
    const walkUI = document.getElementById('walk-ui');
    const toggleBtn = document.getElementById('toggleWalkUI');
    const walkContent = document.getElementById('walkContent');
    if (!walkUI || !toggleBtn || !walkContent) return;

    if (window.innerWidth <= 768) {
      walkUI.className = 'walk-ui-mobile';
      toggleBtn.style.display = 'block';
      walkContent.style.display = this.uiPanelVisible ? 'block' : 'none';
      toggleBtn.setAttribute('aria-expanded', String(this.uiPanelVisible));
    } else {
      walkUI.className = 'walk-ui-desktop';
      toggleBtn.style.display = 'none';
      walkContent.style.display = 'block';
      this.uiPanelVisible = true;
    }
  }

  toggleUI() {
    const content = document.getElementById('walkContent');
    const toggleBtn = document.getElementById('toggleWalkUI');
    if (!content || !toggleBtn) return;

    this.uiPanelVisible = !this.uiPanelVisible;
    content.style.display = this.uiPanelVisible ? 'block' : 'none';
    toggleBtn.textContent = this.uiPanelVisible ? '▼' : '▲';
    toggleBtn.setAttribute('aria-expanded', String(this.uiPanelVisible));
  }

  showWalkIntro() {
    const introContent = document.getElementById('walkIntroContent');
    if (!introContent) return;

    introContent.style.display = 'block';
    introContent.innerHTML = `
      <div class="intro-section">
        <h3>📍 Getting Started</h3>
        <p>${escapeHtml(this.currentWalk.description)}</p>
        <div class="walk-stats">
          <span class="stat">📏 ${escapeHtml(this.currentWalk.distance)}km</span>
          <span class="stat">⏱️ ${escapeHtml(this.currentWalk.estimatedTime)}</span>
          <span class="stat">📊 ${escapeHtml(this.currentWalk.difficulty)}</span>
        </div>
        <div class="start-location">
          <strong>Starting Point:</strong> ${escapeHtml(this.currentWalk.startLocation.name)}
        </div>
        <p class="safety-note">
          Stay on public rights of way, take care near roads, cliffs, and livestock,
          and check weather, tides, and opening times before you set off.
        </p>
        <button data-action="dismiss-intro" class="action-btn primary">
          Start Walking! 🚶‍♂️
        </button>
      </div>
    `;

    if (window.map) {
      window.map.setView([
        this.currentWalk.startLocation.latitude,
        this.currentWalk.startLocation.longitude
      ], 14);
    }
  }

  dismissIntro() {
    const introContent = document.getElementById('walkIntroContent');
    if (introContent) introContent.style.display = 'none';
  }

  // ---------- Waypoints ----------

  showCurrentWaypoint() {
    if (!this.currentWalk || this.currentWaypointIndex >= this.currentWalk.waypoints.length) {
      this.finishWalk();
      return;
    }

    const waypoint = this.currentWalk.waypoints[this.currentWaypointIndex];
    const story = this.getStoryByIdSync(waypoint.storyId);

    if (!story) {
      console.error('Story not found:', waypoint.storyId);
      this.currentWaypointIndex++;
      this.saveWalkState();
      this.showCurrentWaypoint();
      return;
    }

    if (window.map) {
      window.map.setView([story.latitude, story.longitude], 15);
    }

    this.clearDirections();
    this.updateWaypointContent(waypoint, story);
    this.addWaypointMarker(story, waypoint);
    this.setApproachAlert(story);
    this.refreshWaypointStatus();
  }

  updateWaypointContent(waypoint, story) {
    const waypointContent = document.getElementById('waypointContent');
    if (!waypointContent) return;

    const isLast = this.currentWaypointIndex >= this.currentWalk.waypoints.length - 1;

    waypointContent.innerHTML = `
      <div class="waypoint-section">
        <h4>📍 Waypoint ${escapeHtml(waypoint.order)}: ${escapeHtml(story.title)}</h4>
        <p class="waypoint-instruction">${escapeHtml(waypoint.instruction)}</p>

        <div class="waypoint-status">
          <div class="distance-indicator">
            <span id="distanceToWaypoint" role="status">Calculating distance...</span>
          </div>
          <div id="manualArrival" class="waypoint-actions" style="display: none;">
            <button data-action="manual-arrive" class="action-btn secondary">I'm here (unlock manually)</button>
          </div>
          <div id="waypointActions" class="waypoint-actions" style="display: none;">
            <button data-action="view-story" class="action-btn primary story-btn">
              📖 View Story
            </button>
            <button data-action="next" class="action-btn success">
              ${isLast ? 'Finish Walk ✓' : 'Continue to Next Waypoint →'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.updateProgress();
  }

  // Updates the distance text and buttons for the current waypoint.
  // Once a waypoint is completed it stays completed, so the buttons do not
  // vanish if GPS drift moves the walker outside the unlock radius.
  refreshWaypointStatus() {
    const story = this.getCurrentStory();
    const lm = window.locationManager;
    if (!story || !lm) return;

    const distanceElement = document.getElementById('distanceToWaypoint');
    const actionsDiv = document.getElementById('waypointActions');
    const manualDiv = document.getElementById('manualArrival');
    if (!distanceElement || !actionsDiv || !manualDiv) return;

    if (!this.completedWaypoints.has(story.id) && lm.isWithinUnlockRadius(story)) {
      this.unlockWaypoint(story);
    }

    if (this.completedWaypoints.has(story.id)) {
      distanceElement.textContent = "✅ You're here! Story unlocked.";
      distanceElement.className = 'distance-arrived';
      actionsDiv.style.display = 'block';
      manualDiv.style.display = 'none';
      return;
    }

    actionsDiv.style.display = 'none';
    distanceElement.className = 'distance-away';

    if (!lm.hasFix) {
      distanceElement.textContent = '📡 Waiting for your location...';
      manualDiv.style.display = 'block'; // lets walkers without GPS carry on
      return;
    }

    const metres = Math.round(lm.distanceToMetres(story.latitude, story.longitude));
    distanceElement.textContent = `📏 ${metres}m away`;
    manualDiv.style.display = metres <= MANUAL_ARRIVAL_RADIUS_M ? 'block' : 'none';

    // Directions from the walker's position, unless a curated route is in use
    if (this.routeState !== 'loading' && this.routeState !== 'ready' &&
        !this.currentRoute && !this.fallbackLine) {
      this.showRouteToWaypoint(story);
    }
  }

  // Marks the waypoint as reached. A manual arrival does not save the story as unlocked.
  unlockWaypoint(story, { manual = false } = {}) {
    if (this.completedWaypoints.has(story.id)) return;

    this.completedWaypoints.add(story.id);
    if (!manual && window.storyManager) window.storyManager.rememberUnlock(story.id);
    this.saveWalkState();
    this.updateProgress();
    this.vibrate([300]);

    setTimeout(() => {
      showSuccess(`✅ Waypoint completed! Enjoy the story of ${story.title}`);
    }, 1000);
  }

  manualArrive() {
    const story = this.getCurrentStory();
    if (!story) return;
    this.unlockWaypoint(story, { manual: true });
    this.refreshWaypointStatus();
  }

  updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    if (!progressFill || !progressText || !this.currentWalk) return;

    const total = this.currentWalk.waypoints.length;
    const completed = this.completedWaypoints.size;

    progressFill.style.width = ((completed / total) * 100) + '%';
    progressText.textContent = `${completed}/${total} waypoints`;
  }

  nextWaypoint() {
    if (!this.currentWalk || this.currentWaypointIndex >= this.currentWalk.waypoints.length) {
      return;
    }

    const story = this.getCurrentStory();
    if (story && !this.completedWaypoints.has(story.id)) {
      showError('You must reach the waypoint location first!');
      return;
    }

    this.currentWaypointIndex++;
    this.saveWalkState();
    this.showCurrentWaypoint();
  }

  // Opens the story in the same dialog used on the map, so the walk stays in place
  viewCurrentStory() {
    const story = this.getCurrentStory();

    if (!story) {
      showError('Story not found');
      return;
    }

    if (!this.completedWaypoints.has(story.id)) {
      showError('You must reach the waypoint location first!');
      return;
    }

    window.storyManager.showStoryModal(story);
  }

  // ---------- Approach cue ----------

  setApproachAlert(story) {
    this.clearApproachAlert();
    const lm = window.locationManager;
    if (!lm) return;

    this.alertId = `approach-${story.id}`;
    lm.addProximityAlert(story.latitude, story.longitude, APPROACH_RADIUS_KM, () => {
      this.vibrate([200, 100, 200]);
      showSuccess(`Approaching ${story.title}`);
    }, this.alertId);
  }

  clearApproachAlert() {
    const lm = window.locationManager;
    if (lm && this.alertId) lm.removeProximityAlert(this.alertId);
    this.alertId = null;
  }

  vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ---------- Screen wake lock ----------

  async acquireWakeLock() {
    if (!this.keepAwake || this.wakeLock || !this.walkStarted || !('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
    } catch (error) {
      console.warn('Wake lock not available:', error);
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  setKeepAwake(enabled) {
    this.keepAwake = enabled;
    if (enabled) {
      this.acquireWakeLock();
    } else {
      this.releaseWakeLock();
    }
  }

  // ---------- Routing ----------

  // A walk can name a curated GeoJSON route ("route": "routes/name.geojson").
  // Without one, or if it fails to load, directions come from the OSRM service.
  async loadRoute(walk) {
    this.clearWalkRoute();
    if (!walk.route) {
      this.routeState = 'none';
      return;
    }

    this.routeState = 'loading';
    try {
      const response = await fetch(walk.route);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const geojson = await response.json();
      if (this.currentWalk !== walk) return; // the walk changed while loading

      this.walkRouteLayer = L.geoJSON(geojson, {
        style: { color: '#2e5939', weight: 4, opacity: 0.85 }
      }).addTo(window.map);
      this.routeState = 'ready';

      const routingContent = document.getElementById('routingInstructions');
      if (routingContent) {
        routingContent.innerHTML = '<p class="route-note">🧭 Follow the green line on the map.</p>';
      }
    } catch (error) {
      console.warn('Could not load the walk route:', error);
      if (this.currentWalk === walk) {
        this.routeState = 'failed';
        this.refreshWaypointStatus();
      }
    }
  }

  clearWalkRoute() {
    if (this.walkRouteLayer && window.map) {
      window.map.removeLayer(this.walkRouteLayer);
    }
    this.walkRouteLayer = null;
  }

  showRouteToWaypoint(story) {
    const lm = window.locationManager;
    if (!lm || !lm.hasFix) return;

    this.clearRoutes();

    const userLat = lm.userLat;
    const userLng = lm.userLng;

    try {
      this.currentRoute = L.Routing.control({
        waypoints: [
          L.latLng(userLat, userLng),
          L.latLng(story.latitude, story.longitude)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        createMarker: function () { return null; },
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'foot',
          timeout: 15000
        }),
        lineOptions: {
          styles: [{ color: '#2e5939', weight: 4, opacity: 0.7 }]
        },
        show: false,
        fitSelectedRoutes: true
      });

      this.currentRoute.on('routesfound', e => {
        this.showRouteInstructions(e.routes[0]);
      });

      this.currentRoute.on('routingerror', e => {
        console.error('Routing error:', e);
        this.showFallbackRoute(userLat, userLng, story);
      });

      this.currentRoute.addTo(window.map);
    } catch (error) {
      console.error('Failed to create routing control:', error);
      this.showFallbackRoute(userLat, userLng, story);
    }
  }

  showRouteInstructions(route) {
    const routingContent = document.getElementById('routingInstructions');
    if (!routingContent || !route.instructions) return;

    const distance = (route.summary.totalDistance / 1000).toFixed(1);
    const time = Math.round(route.summary.totalTime / 60);

    let html = `
      <div class="routing-section">
        <h4>🧭 Walking Directions</h4>
        <div class="route-summary">
          <span>📏 ${distance}km</span>
          <span>⏱️ ${time} min</span>
        </div>
        <div class="route-instructions">
    `;

    route.instructions.slice(0, 5).forEach((instruction, index) => {
      const distanceText = instruction.distance > 0 ? ` (${Math.round(instruction.distance)}m)` : '';
      html += `
        <div class="instruction-step">
          <span class="step-number">${index + 1}</span>
          <span class="step-text">${escapeHtml(instruction.text)}${distanceText}</span>
        </div>
      `;
    });

    if (route.instructions.length > 5) {
      html += `<div class="more-instructions">... and ${route.instructions.length - 5} more steps</div>`;
    }

    html += `
        </div>
      </div>
    `;

    routingContent.innerHTML = html;
  }

  showFallbackRoute(userLat, userLng, story) {
    this.clearRoutes();

    this.fallbackLine = L.polyline([
      [userLat, userLng],
      [story.latitude, story.longitude]
    ], {
      color: '#d84315',
      weight: 3,
      opacity: 0.8,
      dashArray: '10, 10'
    }).addTo(window.map);

    window.map.fitBounds(L.latLngBounds([
      [userLat, userLng],
      [story.latitude, story.longitude]
    ]), { padding: [20, 20] });

    showError('Route service unavailable. Showing a direct path.');
  }

  // Removes the live directions (OSRM control and straight-line fallback)
  clearRoutes() {
    if (this.currentRoute) {
      try {
        window.map.removeControl(this.currentRoute);
      } catch (e) {
        console.warn('Error removing route control:', e);
      }
      this.currentRoute = null;
    }

    if (this.fallbackLine) {
      try {
        window.map.removeLayer(this.fallbackLine);
      } catch (e) {
        console.warn('Error removing fallback line:', e);
      }
      this.fallbackLine = null;
    }
  }

  // Clears directions between waypoints, but keeps the curated route text
  clearDirections() {
    this.clearRoutes();
    if (this.routeState !== 'ready') {
      const routingContent = document.getElementById('routingInstructions');
      if (routingContent) routingContent.innerHTML = '';
    }
  }

  clearWaypointMarkers() {
    if (!window.map) return;
    window.map.eachLayer(layer => {
      if (layer.options && layer.options.isWaypointMarker) {
        window.map.removeLayer(layer);
      }
    });
  }

  addWaypointMarker(story, waypoint) {
    if (!window.map) return;

    this.clearWaypointMarkers();

    const marker = L.marker([story.latitude, story.longitude], {
      isWaypointMarker: true,
      icon: L.divIcon({
        className: 'waypoint-marker',
        html: `<div style="
          background: #2e5939;
          color: white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${escapeHtml(waypoint.order)}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })
    }).addTo(window.map);

    marker.bindPopup(`
      <strong>Waypoint ${escapeHtml(waypoint.order)}</strong><br>
      ${escapeHtml(story.title)}<br>
      <em>${escapeHtml(waypoint.instruction)}</em>
    `);
  }

  // ---------- Finishing and ending ----------

  // Shared clean-up for finishing, ending early, or starting another walk
  teardownWalk() {
    this.walkStarted = false;
    this.clearRoutes();
    this.clearWalkRoute();
    this.routeState = 'none';
    this.clearWaypointMarkers();
    this.clearApproachAlert();
    this.releaseWakeLock();

    const walkUI = document.getElementById('walk-ui');
    if (walkUI) walkUI.remove();

    window.removeEventListener('folklore:locationupdate', this.locationHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.clearWalkState();
    this.currentWalk = null;
    this.currentWaypointIndex = 0;
    this.completedWaypoints.clear();
  }

  // Reached the end of the walk
  finishWalk() {
    const title = this.currentWalk ? this.currentWalk.title : 'the';
    this.teardownWalk();
    showSuccess(`🎉 Congratulations! You've completed the ${title} walk!`);
  }

  // Ended early, so no celebration
  abandonWalk() {
    this.teardownWalk();
    showSuccess('Walk ended. You can start it again whenever you like.');
  }

  endWalk() {
    if (confirm('Are you sure you want to end this walk?')) {
      this.abandonWalk();
    }
  }

  // ---------- Saving progress ----------
  // Stored so a walker can resume after a refresh or an app restart.

  saveWalkState() {
    if (!this.currentWalk) return;
    storage.set(KEYS.walkProgress, {
      walkId: this.currentWalk.id,
      waypointIndex: this.currentWaypointIndex,
      completedWaypoints: Array.from(this.completedWaypoints)
    });
  }

  clearWalkState() {
    storage.remove(KEYS.walkProgress);
    storage.remove(KEYS.legacyWalkState);
  }

  restoreWalkState() {
    const state = storage.get(KEYS.walkProgress, null);
    if (!state || !state.walkId) return false;

    const walk = this.getWalkById(state.walkId);
    if (!walk || state.waypointIndex >= walk.waypoints.length) {
      this.clearWalkState();
      return false;
    }

    this.currentWalk = walk;
    this.currentWaypointIndex = state.waypointIndex;
    this.completedWaypoints = new Set(state.completedWaypoints || []);
    this.walkStarted = true;
    this.uiPanelVisible = window.innerWidth > 768;

    if (window.folkloreApp) window.folkloreApp.setMode('guided');
    const select = document.getElementById('walkFilter');
    if (select) select.value = walk.id;

    this.createWalkUI();
    this.showWalkIntro();
    this.dismissIntro();
    this.loadRoute(walk);
    this.acquireWakeLock();
    this.showCurrentWaypoint();
    showSuccess(`Resumed your walk: ${walk.title}`);
    return true;
  }
}
