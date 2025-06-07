class StoryManager {
  constructor() {
    this.stories = [];
    this.markers = [];
    this.filteredStories = [];
  }
  openStory(storyId) {
  const story = this.stories.find(s => s.id === storyId);
  if (!story) return;
    
  // Check if user is within 100m of the story location
  if (window.locationManager) {
    const distance = window.locationManager.getDistance(
      window.locationManager.userLat,
      window.locationManager.userLng,
      story.latitude,
      story.longitude
    );
    
    if (distance > 0.1) { // 0.1km = 100m
      window.showError(`You must be within 100m of ${story.title} to unlock it. You are ${Math.round(distance * 1000)}m away.`);
      return;
    }
  }
  
  window.location.href = `story.html?id=${storyId}`;
}
displayStories() {
  const container = document.getElementById('stories');
  container.innerHTML = '';
  
  this.filteredStories.forEach(story => {
    const isUnlocked = this.isStoryUnlocked(story);
    const storyDiv = document.createElement('div');
    storyDiv.className = `story ${isUnlocked ? '' : 'locked'}`;
    storyDiv.innerHTML = `
      <h3>${story.title} ${isUnlocked ? '' : '🔒'}</h3>
      <p><strong>Category:</strong> ${story.category}</p>
      <p>${story.content.substring(0, 100)}...</p>
      ${!isUnlocked ? `<p class="distance-info">Distance: ${this.getDistanceToStory(story)}m</p>` : ''}
    `;
    storyDiv.onclick = () => this.openStory(story.id);
    container.appendChild(storyDiv);
  });
}

isStoryUnlocked(story) {
  if (!window.locationManager) return true; // Fallback if no location
  const distance = window.locationManager.getDistance(
    window.locationManager.userLat,
    window.locationManager.userLng,
    story.latitude,
    story.longitude
  );
  return distance <= 0.1; // 100m
}

getDistanceToStory(story) {
  if (!window.locationManager) return '?';
  const distance = window.locationManager.getDistance(
    window.locationManager.userLat,
    window.locationManager.userLng,
    story.latitude,
    story.longitude
  );
  return Math.round(distance * 1000);
}

addMarkersToMap() {
  this.markers.forEach(marker => window.map.removeLayer(marker));
  this.markers = [];

  this.filteredStories.forEach(story => {
    const isUnlocked = this.isStoryUnlocked(story);
    const marker = L.marker([story.latitude, story.longitude])
      .addTo(window.map)
      .bindPopup(`
        <strong>${story.title} ${isUnlocked ? '' : '🔒'}</strong><br>
        <em>${story.category}</em><br>
        ${isUnlocked ? 
          `<button onclick="storyManager.openStory('${story.id}')">Read Story</button>` :
          `<p>🔒 Come within 100m to unlock<br>Distance: ${this.getDistanceToStory(story)}m</p>`
        }
      `);
    this.markers.push(marker);
  });
}

  openStory(storyId) {
    window.location.href = `story.html?id=${storyId}`;
  }

  filterStories(searchTerm, category) {
    this.filteredStories = this.stories.filter(story => {
      const matchesSearch = !searchTerm || 
        story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !category || story.category === category;
      
      return matchesSearch && matchesCategory;
    });
    
    this.displayStories();
    this.addMarkersToMap();
  }
  // Refresh story lock states every 10 seconds
setInterval(() => {
  if (storyManager && currentMode === 'explore') {
    storyManager.displayStories();
    storyManager.addMarkersToMap();
  }
}, 10000);
}
