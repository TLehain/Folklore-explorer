// Initialize everything
let locationManager;
let storyManager;
// Initialize map
const map = L.map('map').setView([54.5, -1.5], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
// Make map globally available
window.map = map;
// Initialize managers
document.addEventListener('DOMContentLoaded', async () => {
locationManager = new LocationManager();
storyManager = new StoryManager();
await locationManager.initialize();
await storyManager.loadStories();
});
// Add near the top with other managers
let walksManager;

// Update the DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', async () => {
  locationManager = new LocationManager();
  storyManager = new StoryManager();
  walksManager = new WalksManager(); // Add this line
  
  await locationManager.initialize();
  await storyManager.loadStories();
  await walksManager.loadWalks(); // Add this line
});

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
