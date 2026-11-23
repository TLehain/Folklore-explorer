import { showError } from './notify.js';

export class LocationManager {
  constructor() {
    this.userLat = 0;
    this.userLng = 0;
    this.accuracy = null; // metres, from the latest position fix
    this.hasFix = false; // true once a real position has been received
    this.enabled = false; // true once the person has agreed to use location
    this.watchId = null;
    this.userMarker = null;
    this.proximityAlerts = new Set();

    // Unlock behaviour
    this.defaultUnlockRadiusM = 100; // used when a story has no unlockRadius
    this.maxAccuracyCreditM = 50; // most GPS inaccuracy we will forgive

    // Throttling for watchPosition updates
    this.minMoveM = 10; // react after moving this far
    this.minAccuracyGainM = 10; // or when accuracy improves by this much
    this.minIntervalMs = 15000; // or after this long
    this.lastProcessed = null;
  }

  async initialize() {
    this.enabled = true;

    if (!navigator.geolocation) {
      this.handleLocationError({ code: 0 });
      this.setDefaultLocation();
      this.sortStoriesByProximity();
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 60000
    };

    this.showLocationLoading();

    try {
      let position;
      try {
        position = await this.getCurrentPosition(options);
      } catch (highAccuracyError) {
        console.warn('High accuracy failed, trying lower accuracy:', highAccuracyError);
        position = await this.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000
        });
      }

      this.recordPosition(position);
      this.updateUserMarker();
      this.sortStoriesByProximity();
      this.startWatching();
      this.notifyChange();
    } catch (error) {
      this.handleLocationError(error);
      this.setDefaultLocation();
      this.sortStoriesByProximity();
      // A timeout or temporary failure can recover, so keep listening.
      // Permission denied (code 1) cannot recover without a change in settings.
      if (error && error.code !== 1) this.startWatching();
    } finally {
      this.hideLocationLoading();
    }
  }

  showLocationLoading() {
    const loading = document.createElement('div');
    loading.id = 'location-loading';
    loading.setAttribute('role', 'status');
    loading.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(46, 89, 57, 0.95);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 2500;
        text-align: center;
      ">
        <div>📍 Finding your location...</div>
        <div style="font-size: 0.9em; margin-top: 10px; opacity: 0.9;">
          This may take a moment on mobile devices
        </div>
      </div>
    `;
    document.body.appendChild(loading);
  }

  hideLocationLoading() {
    const loading = document.getElementById('location-loading');
    if (loading) loading.remove();
  }

  getCurrentPosition(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  handleLocationError(error) {
    console.error('Geolocation error', error);
    const messages = {
      0: 'This browser does not support location.',
      1: 'Location access denied. Enable location services in your browser settings to unlock stories by visiting them.',
      2: 'Location unavailable. Check your connection and GPS settings.',
      3: 'Location request timed out. We will keep trying in the background.'
    };
    showError(messages[error && error.code] || 'Location error. We could not find your position.');
  }

  setDefaultLocation() {
    this.userLat = 54.5;
    this.userLng = -1.5;
    this.accuracy = null;
    this.hasFix = false;
  }

  recordPosition(position) {
    this.userLat = position.coords.latitude;
    this.userLng = position.coords.longitude;
    this.accuracy = position.coords.accuracy;
    this.hasFix = true;
    this.lastProcessed = {
      lat: this.userLat,
      lng: this.userLng,
      accuracy: this.accuracy,
      time: Date.now()
    };
  }

  // Creates the marker on the first fix, then moves it on later fixes
  updateUserMarker() {
    if (!window.map || !this.hasFix) return;
    if (!this.userMarker) {
      this.userMarker = L.marker([this.userLat, this.userLng])
        .addTo(window.map)
        .bindPopup('You are here')
        .openPopup();
      window.map.setView([this.userLat, this.userLng], 13);
    } else {
      this.userMarker.setLatLng([this.userLat, this.userLng]);
    }
  }

  startWatching() {
    if (this.watchId !== null || !navigator.geolocation) return;
    this.watchId = navigator.geolocation.watchPosition(
      position => this.handlePositionUpdate(position),
      error => console.warn('Location watching failed:', error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
  }

  // Saves battery when the page is hidden and no walk is running
  stopWatching() {
    if (this.watchId === null) return;
    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  resumeWatching() {
    if (this.enabled) this.startWatching();
  }

  // Ignores tiny movements so the map and story list are not rebuilt on every fix
  handlePositionUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const last = this.lastProcessed;

    if (last && this.hasFix) {
      const movedM = this.getDistance(last.lat, last.lng, latitude, longitude) * 1000;
      const accuracyGain = last.accuracy - accuracy;
      const elapsed = Date.now() - last.time;
      if (movedM < this.minMoveM && accuracyGain < this.minAccuracyGainM && elapsed < this.minIntervalMs) {
        return;
      }
    }

    this.recordPosition(position);
    this.updateUserMarker();
    this.sortStoriesByProximity();
    this.checkProximityAlerts();
    this.notifyChange();
  }

  // Lets other modules react to a processed update
  notifyChange() {
    window.dispatchEvent(new CustomEvent('folklore:locationupdate'));
  }

  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  distanceToMetres(lat, lng) {
    return this.getDistance(this.userLat, this.userLng, lat, lng) * 1000;
  }

  // Shared unlock test. GPS inaccuracy is forgiven up to maxAccuracyCreditM,
  // so a walker standing at the stop is not locked out by a noisy fix.
  isWithinUnlockRadius(story) {
    if (!this.hasFix) return false;
    const radius = story.unlockRadius || this.defaultUnlockRadiusM;
    const credit = Math.min(this.accuracy || 0, this.maxAccuracyCreditM);
    return this.distanceToMetres(story.latitude, story.longitude) - credit <= radius;
  }

  sortStoriesByProximity() {
    if (window.storyManager) {
      window.storyManager.refreshProximity(this.userLat, this.userLng);
    }
  }

  addProximityAlert(lat, lng, radius, callback, id) {
    this.proximityAlerts.add({ id, lat, lng, radius, callback, triggered: false }); // radius in km
  }

  removeProximityAlert(id) {
    this.proximityAlerts.forEach(alert => {
      if (alert.id === id) this.proximityAlerts.delete(alert);
    });
  }

  checkProximityAlerts() {
    this.proximityAlerts.forEach(alert => {
      const distance = this.getDistance(this.userLat, this.userLng, alert.lat, alert.lng);
      if (distance <= alert.radius && !alert.triggered) {
        alert.triggered = true;
        alert.callback();
      } else if (distance > alert.radius && alert.triggered) {
        alert.triggered = false; // Reset when the user leaves the area
      }
    });
  }
}
