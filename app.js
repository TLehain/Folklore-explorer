let currentMode = 'explore';
let currentWalk = null;
let walkProgress = 0;
let userLat = 0;
let userLng = 0;

const map = L.map('map').setView([54.5, -1.5], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

function initializeLocation() {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by this browser.");
    // Use default location (center of UK)
    userLat = 54.5;
    userLng = -1.5;
    loadStories();
    return;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000
  };

  navigator.geolocation.getCurrentPosition(
    position => {
      userLat = position.coords.latitude;
      userLng = position.coords.longitude;
      L.marker([userLat, userLng]).addTo(map)
        .bindPopup("You are here")
        .openPopup();
      loadStories();
    },
    error => handleLocationError(error),
    options
  );
}

function handleLocationError(error) {
  const messages = {
    1: "Location access denied. Using default location. Enable location services for full experience.",
    2: "Location unavailable. Using default location.",
    3: "Location request timed out. Using default location."
  };
  
  const message = messages[error.code] || "Location error. Using default location.";
  showError(message);
  
  // Use default location
  userLat = 54.5;
  userLng = -1.5;
  loadStories();
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-notification';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #ff6b6b;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => errorDiv.remove(), 5000);
}

// Replace the direct geolocation call with:
initializeLocation();

function loadStories() {
  function showLoading() {
  const container = document.getElementById('stories');
  container.innerHTML = '<div class="loading">Loading stories...</div>';
}

function loadStories() {
  showLoading();
  
  fetch('stories.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load stories');
      return res.json();
    })
    .then(stories => {
      // ... rest of your existing loadStories code
    })
    .catch(error => {
      console.error('Error loading stories:', error);
      const container = document.getElementById('stories');
      container.innerHTML = '<div class="error">Failed to load stories. Please refresh the page.</div>';
    });
}
  fetch('stories.json')
    .then(res => res.json())
    .then(stories => {
      const container = document.getElementById('stories');
      container.innerHTML = '';

      const searchInput = document.getElementById('searchBar').value.toLowerCase();
      const category = document.getElementById('categoryFilter').value;

      stories.forEach(story => {
        if ((searchInput && !story.title.toLowerCase().includes(searchInput)) ||
            (category && story.category !== category)) return;

        const dist = getDistance(userLat, userLng, story.latitude, story.longitude);

        const div = document.createElement('div');
        div.className = 'story' + (dist > 0.1 ? ' locked' : '');
        div.innerHTML = `
          <h3>${story.title}</h3>
          <p><strong>Category:</strong> ${story.category}</p>
          <p>${dist <= 0.1 ? story.content.substring(0, 80) + '...' : '🔒 Locked. Get closer to unlock this story.'}</p>
        `;
        div.onclick = () => {
          if (dist <= 0.1) {
            window.location.href = `story.html?id=${story.id}`;
          } else {
            map.setView([story.latitude, story.longitude], 13);
          }
        };

        container.appendChild(div);

        const marker = L.marker([story.latitude, story.longitude]).addTo(map)
          .bindPopup(`<strong>${story.title}</strong><br>${dist <= 0.1 ? 'Unlocked' : 'Locked'}`);
      });
    });
}

document.getElementById('searchBar').addEventListener('input', loadStories);
document.getElementById('categoryFilter').addEventListener('change', loadStories);

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
function toRad(value) {
  return value * Math.PI / 180;
}
function setMode(mode) {
  currentMode = mode;
  
  // Update button states
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(mode + 'Mode').classList.add('active');
  
  // Show/hide appropriate UI
  if (mode === 'guided') {
    document.getElementById('walkSelector').style.display = 'block';
    document.getElementById('searchFilters').style.display = 'none';
    loadWalks();
  } else {
    document.getElementById('walkSelector').style.display = 'none';
    document.getElementById('searchFilters').style.display = 'flex';
  }
  
  loadStories();
}

function loadWalks() {
  // For now, create some example walks from your existing stories
  const walks = [
    {
      id: 'northern-legends',
      title: 'Northern Legends Walk',
      stories: ['lambton-worm', 'grey-lady-bamburgh']
    }
  ];
  
  const select = document.getElementById('walkFilter');
  select.innerHTML = '<option value="">Select a guided walk...</option>';
  
  walks.forEach(walk => {
    const option = document.createElement('option');
    option.value = walk.id;
    option.textContent = walk.title;
    select.appendChild(option);
  });
}

function startGuidedWalk() {
  const walkId = document.getElementById('walkFilter').value;
  if (!walkId) {
    showError('Please select a walk first');
    return;
  }
  
  // Simple implementation - just focus on first story
  if (walkId === 'northern-legends') {
    showError('Guided walk started! Navigate to The Lambton Worm location.');
    // Focus map on first story
    map.setView([54.852, -1.5711], 13);
  }
}

let proximityAlerts = new Set(); // Track which stories we've already alerted for
let watchId = null;

function startLocationWatching() {
  if (watchId) return; // Already watching
  
  watchId = navigator.geolocation.watchPosition(
    position => {
      userLat = position.coords.latitude;
      userLng = position.coords.longitude;
      checkProximityAlerts();
    },
    error => console.warn('Location watching failed:', error),
    { enableHighAccuracy: true }
  );
}

function checkProximityAlerts() {
  fetch('stories.json')
    .then(res => res.json())
    .then(stories => {
      stories.forEach(story => {
        const distance = getDistance(userLat, userLng, story.latitude, story.longitude);
        const alertKey = story.id + '-close';
        
        // Alert when user gets within 200m but hasn't been alerted yet
        if (distance <= 0.2 && distance > 0.1 && !proximityAlerts.has(alertKey)) {
          proximityAlerts.add(alertKey);
          showProximityAlert(story, distance);
        }
      });
    });
}

function showProximityAlert(story, distance) {
  const alert = document.createElement('div');
  alert.className = 'proximity-alert';
  alert.innerHTML = `
    <strong>📍 You're close to a story!</strong><br>
    ${story.title} - ${Math.round(distance * 1000)}m away
  `;
  alert.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 1000;
    text-align: center;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    animation: slideUp 0.3s ease-out;
  `;
  
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 4000);
}
