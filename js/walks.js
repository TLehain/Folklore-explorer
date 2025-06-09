class WalksManager {
  constructor() {
    this.walks = [];
    this.currentWalk = null;
    this.currentWaypointIndex = 0;
    this.walkStarted = false;
    this.completedWaypoints = new Set();
  }

  async loadWalks() {
    try {
      const response = await fetch('walks.json');
      if (!response.ok) throw new Error('Failed to load walks');
      const data = await response.json();
      this.walks = data.walks;
      this.populateWalkSelector();
    } catch (error) {
      console.error('Error loading walks:', error);
      window.showError('Failed to load guided walks');
    }
  }

  populateWalkSelector() {
    const select = document.getElementById('walkFilter');
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

  startWalk(walkId) {
    this.currentWalk = this.getWalkById(walkId);
    if (!this.currentWalk) {
      window.showError('Walk not found');
      return;
    }

    this.currentWaypointIndex = 0;
    this.walkStarted = true;
    this.completedWaypoints.clear();
    
    this.showWalkIntro();
    this.showCurrentWaypoint();
    this.showWalkProgress();
  }

  showWalkIntro() {
    const intro = document.createElement('div');
    intro.className = 'walk-intro';
    intro.innerHTML = `
      <div class="walk-intro-content">
        <h3>🚶 ${this.currentWalk.title}</h3>
        <p>${this.currentWalk.description}</p>
        <div class="walk-details">
          <span>📏 ${this.currentWalk.distance}km</span>
          <span>⏱️ ${this.currentWalk.estimatedTime}</span>
          <span>📊 ${this.currentWalk.difficulty}</span>
        </div>
        <p><strong>Starting Point:</strong> ${this.currentWalk.startLocation.name}</p>
        <button onclick="walksManager.dismissIntro()" class="dismiss-btn">Start Walking!</button>
      </div>
    `;
    
    intro.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    `;
    
    document.body.appendChild(intro);
    
    // Focus map on starting location
    window.map.setView([
      this.currentWalk.startLocation.latitude, 
      this.currentWalk.startLocation.longitude
    ], 14);
  }

  dismissIntro() {
    const intro = document.querySelector('.walk-intro');
    if (intro) intro.remove();
  }

  showCurrentWaypoint() {
    if (!this.currentWalk || this.currentWaypointIndex >= this.currentWalk.waypoints.length) {
      this.completeWalk();
      return;
    }

    const waypoint = this.currentWalk.waypoints[this.currentWaypointIndex];
    const story = this.getStoryByIdSync(waypoint.storyId);
    
    if (!story) {
      console.error('Story not found:', waypoint.storyId);
      return;
    }

    // Focus map on current waypoint
    window.map.setView([story.latitude, story.longitude], 15);
    
    // Show waypoint instruction
    this.showWaypointInstruction(waypoint, story);
    
    // Add special marker for current waypoint
    this.addWaypointMarker(story, waypoint);
  }

  showWaypointInstruction(waypoint, story) {
    // Remove any existing instruction
    const existing = document.getElementById('waypoint-instruction');
    if (existing) existing.remove();

    const instruction = document.createElement('div');
    instruction.id = 'waypoint-instruction';
    instruction.className = 'waypoint-instruction';
    instruction.innerHTML = `
      <div class="instruction-content">
        <h4>📍 Waypoint ${waypoint.order}: ${story.title}</h4>
        <p>${waypoint.instruction}</p>
        <div class="waypoint-status">
          <span class="distance-to-waypoint" id="distanceToWaypoint">Calculating distance...</span>
        </div>
        <div class="waypoint-actions" id="waypointActions" style="display: none;">
          <button onclick="walksManager.nextWaypoint()" class="next-waypoint-btn">
            Continue to Next Waypoint →
          </button>
        </div>
      </div>
    `;
    
    instruction.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #2e5939;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 1500;
      max-width: 90%;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(instruction);
    
    // Update distance continuously
    this.updateWaypointDistance(story);
  }

  updateWaypointDistance(story) {
    const updateDistance = () => {
      if (!window.locationManager) return;
      
      const distance = window.locationManager.getDistance(
        window.locationManager.userLat,
        window.locationManager.userLng,
        story.latitude,
        story.longitude
      );
      
      const distanceElement = document.getElementById('distanceToWaypoint');
       if (distance <= 0.1) {
        distanceElement.innerHTML = '✅ You\'re here! Story unlocked.';
        distanceElement.style.color = '#4CAF50';
        this.unlockWaypoint(story);
        // Show the next waypoint button
        const actionsDiv = document.getElementById('waypointActions');
        if (actionsDiv) {
          actionsDiv.style.display = 'block';
        }
      } else {
        distanceElement.innerHTML = `📏 ${Math.round(distance * 1000)}m away`;
        // Hide the next waypoint button if not close enough
        const actionsDiv = document.getElementById('waypointActions');
        if (actionsDiv) {
          actionsDiv.style.display = 'none';
        }
        }
        };
    
    // Update every 3 seconds
    this.distanceInterval = setInterval(updateDistance, 3000);
    updateDistance(); // Initial update
  }

  unlockWaypoint(story) {
    if (this.completedWaypoints.has(story.id)) return;
    
    this.completedWaypoints.add(story.id);
    
    // Clear distance updates
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
    }
    
    // Show success message
    setTimeout(() => {
      window.showSuccess(`✅ Waypoint completed! Enjoy the story of ${story.title}`);
      
      // Auto-advance after story time
      setTimeout(() => {
        this.nextWaypoint();
      }, this.currentWalk.waypoints[this.currentWaypointIndex].waitTime * 1000);
    }, 1000);
  }

  nextWaypoint() {
    // Check if current waypoint is completed
    const currentWaypoint = this.currentWalk.waypoints[this.currentWaypointIndex];
    const currentStory = this.getStoryByIdSync(currentWaypoint.storyId);
  
    if (!this.completedWaypoints.has(currentStory.id)) {
      window.showError('You must reach the waypoint location first!');
      return;
    }
  
    this.currentWaypointIndex++;
  
    // Clear distance updates
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
    }
  
    // Remove current instruction
    const instruction = document.getElementById('waypoint-instruction');
    if (instruction) instruction.remove();
  
    this.showCurrentWaypoint();
    this.updateWalkProgress();
  }
  showWalkProgress() {
    // Remove existing progress bar
    const existing = document.getElementById('walk-progress');
    if (existing) existing.remove();

    const progress = document.createElement('div');
    progress.id = 'walk-progress';
    progress.className = 'walk-progress';
    
    const totalWaypoints = this.currentWalk.waypoints.length;
    const completedCount = this.completedWaypoints.size;
    const progressPercent = (completedCount / totalWaypoints) * 100;
    
    progress.innerHTML = `
      <div class="progress-header">
        <span>🚶 ${this.currentWalk.title}</span>
        <span>${completedCount}/${totalWaypoints} waypoints</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progressPercent}%"></div>
      </div>
      <button onclick="walksManager.endWalk()" class="end-walk-btn">End Walk</button>
    `;
    
    progress.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 1500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      min-width: 300px;
      text-align: center;
    `;
    
    document.body.appendChild(progress);
  }
}
  updateWalkProgress() {
    const progressFill = document.querySelector('.progress-fill');
    const progressHeader = document.querySelector('.progress-header span:last-child');
    
    if (progressFill && progressHeader) {
      const totalWaypoints = this.currentWalk.waypoints.length;
      const completedCount = this.completedWaypoints.size;
      const progressPercent = (completedCount / totalWaypoints) * 100;
      
      progressFill.style.width = progressPercent + '%';
      progressHeader.textContent = `${completedCount}/${totalWaypoints} waypoints`;
    }
  }

  addWaypointMarker(story, waypoint) {
    // Remove existing waypoint markers
    window.map.eachLayer(layer => {
      if (layer.options && layer.options.isWaypointMarker) {
        window.map.removeLayer(layer);
      }
    });

    // Add new waypoint marker
    const marker = L.marker([story.latitude, story.longitude], {
      isWaypointMarker: true,
      icon: L.divIcon({
        className: 'waypoint-marker',
        html: `<div class="waypoint-number">${waypoint.order}</div>`,
        iconSize: [40, 40]
      })
    }).addTo(window.map);
    
    marker.bindPopup(`
      <strong>Waypoint ${waypoint.order}</strong><br>
      ${story.title}<br>
      <em>${waypoint.instruction}</em>
    `);
  }

  completeWalk() {
    this.walkStarted = false;
    
    // Clean up UI elements
    ['waypoint-instruction', 'walk-progress'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.remove();
    });
    
    // Clear intervals
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
    }
    
    // Show completion message
    window.showSuccess(`🎉 Congratulations! You've completed the ${this.currentWalk.title} walk!`);
    
    this.currentWalk = null;
    this.currentWaypointIndex = 0;
    this.completedWaypoints.clear();
  }

  endWalk() {
    if (confirm('Are you sure you want to end this walk?')) {
      this.completeWalk();
    }
  }

  // Fixed: Use synchronous access to stories data
  getStoryByIdSync(storyId) {
    // Access the globally available stories data
    if (window.storiesData) {
      return window.storiesData.find(s => s.id === storyId);
    }
    return null;
  }
}

// Global success message function
window.showSuccess = function(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-notification';
  successDiv.textContent = message;
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(successDiv);
  setTimeout(() => successDiv.remove(), 4000);
};
