import { escapeHtml, toParagraphs, storage, KEYS } from './util.js';
import { showError } from './notify.js';
import { openDialog } from './dialog.js';

export class StoryManager {
  constructor() {
    this.stories = []; // published stories, in the order of stories.json
    this.sorted = []; // the same stories, nearest first
    this.filteredStories = [];
    this.markers = new Map(); // story id -> Leaflet marker
    this.searchTerm = '';
    this.category = '';
    this.listEventsBound = false;
    this.dialog = null;

    // Preview mode lets people read every story without being nearby
    this.previewMode = false;

    // Stories reached once stay unlocked, even after the walker leaves the area
    this.unlockedIds = new Set(storage.get(KEYS.unlockedStories, []));
  }

  async loadStories() {
    try {
      const response = await fetch('stories.json');
      if (!response.ok) throw new Error('Failed to load stories');
      const allStories = await response.json();
      // Entries marked "draft": true (for example placeholder text) stay hidden
      this.stories = allStories.filter(story => !story.draft);
      this.sorted = [...this.stories];
      window.storiesData = this.stories;
      this.bindListEvents();
      this.applyFilters();
      this.displayStories();
      this.addMarkersToMap();
    } catch (error) {
      console.error('Error loading stories:', error);
      showError('Failed to load stories');
    }
  }

  // ---------- Unlocking ----------

  setPreviewMode(enabled) {
    this.previewMode = enabled;
    this.syncView();
  }

  rememberUnlock(storyId) {
    if (this.unlockedIds.has(storyId)) return;
    this.unlockedIds.add(storyId);
    storage.set(KEYS.unlockedStories, Array.from(this.unlockedIds));
  }

  clearUnlocks() {
    this.unlockedIds.clear();
    storage.remove(KEYS.unlockedStories);
  }

  // Returns true when the story can be read. Reaching a story saves the unlock.
  isStoryUnlocked(story) {
    if (this.previewMode || this.unlockedIds.has(story.id)) return true;
    const lm = window.locationManager;
    if (!lm) return true;
    if (lm.isWithinUnlockRadius(story)) {
      this.rememberUnlock(story.id);
      return true;
    }
    return false;
  }

  getDistanceMetres(story) {
    const lm = window.locationManager;
    if (!lm || !lm.hasFix) return null;
    return Math.round(lm.distanceToMetres(story.latitude, story.longitude));
  }

  getUnlockRadius(story) {
    const lm = window.locationManager;
    return story.unlockRadius || (lm ? lm.defaultUnlockRadiusM : 100);
  }

  distanceLabel(story) {
    const metres = this.getDistanceMetres(story);
    return metres === null ? 'Location needed to unlock' : `Distance: ${metres}m`;
  }

  // ---------- Sorting and updating ----------

  // Called on the first fix and after each throttled position update.
  // Re-sorts, then updates the page in place where possible so open popups
  // and touch feedback are not interrupted.
  refreshProximity(userLat, userLon) {
    const lm = window.locationManager;
    if (!lm) return;

    this.stories.forEach(story => {
      story.distance = lm.getDistance(userLat, userLon, story.latitude, story.longitude);
    });
    this.sorted = [...this.stories].sort((a, b) => a.distance - b.distance);
    this.applyFilters();
    this.syncView();
  }

  // Rebuilds only what changed
  syncView() {
    const container = document.getElementById('stories');
    if (!container || !window.map) return;

    const renderedOrder = Array.from(container.children).map(card => card.dataset.storyId).join('|');
    const wantedOrder = this.filteredStories.map(story => story.id).join('|');

    if (renderedOrder !== wantedOrder) {
      this.displayStories();
    } else {
      Array.from(container.children).forEach((card, index) => {
        this.renderCard(card, this.filteredStories[index]);
      });
    }

    const sameMarkers = this.markers.size === this.filteredStories.length &&
      this.filteredStories.every(story => this.markers.has(story.id));

    if (sameMarkers) {
      this.filteredStories.forEach(story => {
        this.markers.get(story.id).setPopupContent(this.popupHtml(story));
      });
    } else {
      this.addMarkersToMap();
    }
  }

  applyFilters() {
    const term = (this.searchTerm || '').toLowerCase();
    // this.sorted is already in proximity order, so filtering keeps that order
    this.filteredStories = this.sorted.filter(story => {
      const matchesSearch = !term ||
        story.title.toLowerCase().includes(term) ||
        story.teaser.toLowerCase().includes(term);
      const matchesCategory = !this.category || story.category === this.category;
      return matchesSearch && matchesCategory;
    });
  }

  // Called when the person changes the search box or category
  filterStories(searchTerm, category) {
    this.searchTerm = searchTerm || '';
    this.category = category || '';
    this.applyFilters();
    this.displayStories();
    this.addMarkersToMap();
  }

  // ---------- Opening a story ----------

  openStory(storyId) {
    const story = this.stories.find(s => s.id === storyId);
    if (!story) return;

    if (!this.isStoryUnlocked(story)) {
      const metres = this.getDistanceMetres(story);
      if (metres === null) {
        showError('Your location is needed to unlock stories. Choose "Use my location", or switch on preview mode to read from home.');
      } else {
        showError(`You must be within ${this.getUnlockRadius(story)}m of ${story.title} to unlock it. You are ${metres}m away.`);
      }
      return;
    }

    this.showStoryModal(story);
  }

  showStoryModal(story) {
    if (this.dialog) this.dialog.close();

    const paragraphs = toParagraphs(story.content)
      .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
      .join('');
    const credits = story.credits
      ? `<p class="credits">${escapeHtml(story.credits)}</p>`
      : '';

    const bodyHtml = `
      <p><strong>Category:</strong> ${escapeHtml(story.category)}</p>
      <div class="story-image-container">
        <img
          src="${escapeHtml(story.image)}"
          alt="${escapeHtml(story.title)} - ${escapeHtml(story.category)} folklore story"
          class="story-image"
          loading="lazy"
        />
        <div class="image-error" hidden>
          <p>📸 Image unavailable</p>
        </div>
      </div>
      <div class="story-content">${paragraphs}</div>
      <div class="audio-container">
        <audio controls preload="none" aria-label="Audio narration of ${escapeHtml(story.title)}">
          <source src="${escapeHtml(story.audio)}" type="audio/mpeg">
          <p>Your browser does not support the audio element. <a href="${escapeHtml(story.audio)}">Download the audio file</a>.</p>
        </audio>
        <label class="speed-control">
          Speed
          <select data-role="speed" aria-label="Playback speed">
            <option value="0.75">0.75x</option>
            <option value="1" selected>1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
        </label>
      </div>
      ${credits}
    `;

    this.dialog = openDialog({
      id: 'story-modal',
      title: story.title,
      bodyHtml,
      footerHtml: '<button class="continue-btn" data-action="dismiss">Close Story</button>',
      onClose: () => { this.dialog = null; }
    });

    const root = this.dialog.root;
    const image = root.querySelector('.story-image');
    const imageError = root.querySelector('.image-error');
    const audio = root.querySelector('audio');
    const speed = root.querySelector('[data-role="speed"]');

    image.addEventListener('error', () => {
      image.hidden = true;
      imageError.hidden = false;
    });

    speed.addEventListener('change', () => {
      audio.playbackRate = parseFloat(speed.value);
    });

    audio.addEventListener('play', () => this.setMediaSession(story, audio));
  }

  closeStoryModal() {
    if (this.dialog) this.dialog.close();
  }

  // Shows the title and lock-screen controls while audio plays
  setMediaSession(story, audio) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: story.title,
        artist: 'Folklore Explorer',
        album: story.category,
        artwork: [{ src: new URL(story.image, window.location.href).href }]
      });

      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        audio.currentTime = Math.max(0, audio.currentTime - 15);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 15);
      });
    } catch (error) {
      console.warn('Media session not available:', error);
    }
  }

  // ---------- Story list and map ----------

  // One set of listeners on each container replaces per-item handlers
  bindListEvents() {
    if (this.listEventsBound) return;
    const container = document.getElementById('stories');
    if (!container) return;
    this.listEventsBound = true;

    container.addEventListener('click', event => {
      const card = event.target.closest('[data-story-id]');
      if (card) {
        event.preventDefault();
        this.openStory(card.dataset.storyId);
      }
    });

    container.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-story-id]');
      if (card) {
        event.preventDefault();
        this.openStory(card.dataset.storyId);
      }
    });

    const press = event => {
      const card = event.target.closest('.story');
      if (card) card.style.transform = 'scale(0.98)';
    };
    const release = event => {
      const card = event.target.closest('.story');
      if (card) card.style.transform = 'scale(1)';
    };
    container.addEventListener('touchstart', press, { passive: true });
    container.addEventListener('touchend', release);
    container.addEventListener('touchcancel', release);

    // Popup buttons are created and replaced by Leaflet, so listen on the map
    window.map.getContainer().addEventListener('click', event => {
      const button = event.target.closest('[data-open-story]');
      if (button) this.openStory(button.dataset.openStory);
    });
  }

  // Full rebuild of the list (used when the order or the filters change)
  displayStories() {
    const container = document.getElementById('stories');
    if (!container) return;
    container.innerHTML = '';

    this.filteredStories.forEach(story => {
      const card = document.createElement('div');
      card.dataset.storyId = story.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      this.renderCard(card, story);
      container.appendChild(card);
    });
  }

  // Updates one card, and skips the work when nothing visible has changed
  renderCard(card, story) {
    const unlocked = this.isStoryUnlocked(story);
    const label = this.distanceLabel(story);
    const signature = `${unlocked}|${label}`;
    if (card.dataset.signature === signature) return;

    card.dataset.signature = signature;
    card.className = `story ${unlocked ? 'unlocked' : 'locked'}`;
    card.setAttribute('aria-label', `${story.title}. ${unlocked ? 'Unlocked.' : 'Locked.'}`);
    card.innerHTML = `
      <h3>${escapeHtml(story.title)} ${unlocked ? '' : '🔒'}</h3>
      <p><strong>Category:</strong> ${escapeHtml(story.category)}</p>
      <p>${escapeHtml(story.teaser.substring(0, 100))}</p>
      ${unlocked ? '' : `<p class="distance-info">${escapeHtml(label)}</p>`}
    `;
  }

  popupHtml(story) {
    const unlocked = this.isStoryUnlocked(story);
    return `
      <strong>${escapeHtml(story.title)} ${unlocked ? '' : '🔒'}</strong><br>
      <em>${escapeHtml(story.category)}</em><br>
      ${unlocked ?
        `<button data-open-story="${escapeHtml(story.id)}" style="padding: 10px 15px; font-size: 14px; min-height: 44px;">Read Story</button>` :
        `<p>🔒 Come within ${this.getUnlockRadius(story)}m to unlock<br>${escapeHtml(this.distanceLabel(story))}</p>`
      }
    `;
  }

  addMarkersToMap() {
    if (!window.map) return;
    this.markers.forEach(marker => window.map.removeLayer(marker));
    this.markers.clear();

    this.filteredStories.forEach(story => {
      const marker = L.marker([story.latitude, story.longitude])
        .addTo(window.map)
        .bindPopup(this.popupHtml(story));
      this.markers.set(story.id, marker);
    });
  }
}
