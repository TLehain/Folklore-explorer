// Initialize map
const map = L.map('map').setView([54.5, -1.5], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Make map globally available
window.map = map;

// Initialize everything
let locationManager;
let storyManager;
let walksManager;
let currentMode = 'explore';

// Initialize managers
document.addEventListener('DOMContentLoaded', async () => {
  locationManager = new LocationManager();
  window.locationManager = locationManager; // Add this
  storyManager = new StoryManager();
  walksManager = new WalksManager();
  
  await locationManager.initialize();
  await storyManager.loadStories();
  await walksManager.loadWalks();
  
});
  
  // Add event listeners for search and filter
  const searchBar = document.getElementById('searchBar');
  const categoryFilter = document.getElementById('categoryFilter');
  
  searchBar.addEventListener('input', () => {
    if (storyManager) {
      storyManager.filterStories(searchBar.value, categoryFilter.value);
    }
  });
  
categoryFilter.addEventListener('change', () => {
if (storyManager) {
storyManager.filterStories(searchBar.value, categoryFilter.value);
}
});

function setMode(mode) {
  currentMode = mode;
  
  // Update button states
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(mode + 'Mode').classList.add('active');
  
  // Show/hide relevant UI
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

// Update the startGuidedWalk function
function startGuidedWalk() {
  const walkId = document.getElementById('walkFilter').value;
  if (!walkId) {
    showError('Please select a walk first');
    return;
  }
  
  walksManager.startWalk(walkId);
}

// Global error function
window.showError = function(message) {
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
};
