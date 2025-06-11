class LocationManager {
  constructor() {
    this.userLat = 0;
    this.userLng = 0;
    this.watchId = null;
    this.proximityAlerts = new Set();
  }

async initialize() {
  if (!navigator.geolocation) {
    this.handleError("Geolocation is not supported by this browser.");
    this.setDefaultLocation();
    return;
  }

  // Mobile-optimized geolocation options
  const options = {
    enableHighAccuracy: true,
    timeout: 20000, // Increased timeout for mobile
    maximumAge: 60000 // Allow slightly older positions on mobile
  };

  // Show loading indicator for mobile users
  this.showLocationLoading();

  try {
    // First try with high accuracy
    let position;
    try {
      position = await this.getCurrentPosition(options);
    } catch (highAccuracyError) {
      console.warn('High accuracy failed, trying lower accuracy:', highAccuracyError);
      // Fallback to lower accuracy for mobile
      const fallbackOptions = {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
      };
      position = await this.getCurrentPosition(fallbackOptions);
    }

    this.userLat = position.coords.latitude;
    this.userLng = position.coords.longitude;
    this.sortStoriesByProximity();
    this.addUserMarker();
    this.startWatching();
    
    this.hideLocationLoading();
    
  } catch (error) {
    this.handleLocationError(error);
    this.setDefaultLocation();
    this.hideLocationLoading();
  }
}

showLocationLoading() {
  const loading = document.createElement('div');
  loading.id = 'location-loading';
  loading.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(46, 89, 57, 0.9);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 2000;
      text-align: center;
    ">
      <div>📍 Finding your location...</div>
      <div style="font-size: 0.9em; margin-top: 10px; opacity: 0.8;">
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

// Enhanced error handling with mobile-specific messages
handleLocationError(error) {
  console.error('Geolocation error', error);
  const messages = {
    1: "Location access denied. Please enable location services and refresh the page.",
    2: "Location unavailable. Check your internet connection and GPS settings.",
    3: "Location request timed out. This is common on mobile - using approximate location."
  };
  const message = messages[error.code] || "Location error. Using default location.";
  window.showError(message);
}

  getCurrentPosition(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  setDefaultLocation() {
    this.userLat = 54.5;
    this.userLng = -1.5;
  }

  addUserMarker() {
    L.marker([this.userLat, this.userLng])
      .addTo(window.map)
      .bindPopup("You are here")
      .openPopup();
    window.map.setView([this.userLat, this.userLng], 13);
  }

  handleLocationError(error) {
    console.error('Geolocation error', error);
    const messages = {
      1: "Location access denied. Using default location.",
      2: "Location unavailable. Using default location.",
      3: "Location request timed out. Using default location."
    };
    const message = messages[error.code] || "Location error. Using default location.";
    window.showError(message);
  }

  startWatching() {
    if (this.watchId) return;
    this.watchId = navigator.geolocation.watchPosition(
      position => {
        this.userLat = position.coords.latitude;
        this.userLng = position.coords.longitude;
        this.sortStoriesByProximity();
        this.checkProximityAlerts();
      },
      error => console.warn('Location watching failed:', error),
      { enableHighAccuracy: true }
    );
  }

  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
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

  sortStoriesByProximity() {
    if (window.storyManager) {
      window.storyManager.sortStoriesByProximity(this.userLat, this.userLng);
    }
  }
  // Add these methods to your LocationManager class:

addProximityAlert(lat, lng, radius, callback, id) {
  this.proximityAlerts.add({
    id: id,
    lat: lat,
    lng: lng,
    radius: radius, // in kilometers
    callback: callback,
    triggered: false
  });
}

removeProximityAlert(id) {
  this.proximityAlerts.forEach(alert => {
    if (alert.id === id) {
      this.proximityAlerts.delete(alert);
    }
  });
}

checkProximityAlerts() {
  this.proximityAlerts.forEach(alert => {
    const distance = this.getDistance(
      this.userLat, this.userLng,
      alert.lat, alert.lng
    );
    
    if (distance <= alert.radius && !alert.triggered) {
      alert.triggered = true;
      alert.callback();
    } else if (distance > alert.radius && alert.triggered) {
      alert.triggered = false; // Reset when user leaves area
    }
  });
}
}
