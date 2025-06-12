// Enhanced WalksManager with mobile-optimized UI - FIXED VERSION
class WalksManager {
  constructor() {
    this.walks = [];
    this.currentWalk = null;
    this.currentWaypointIndex = 0;
    this.walkStarted = false;
    this.completedWaypoints = new Set();
    this.currentRoute = null;
    this.distanceInterval = null;
    this.fallbackLine = null;
    this.uiPanelVisible = true; // Default to true for desktop
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
    if (!select) {
      console.error('walkFilter element not found');
      return;
    }
    
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
    console.log('Starting walk:', walkId); // Debug log
    
    this.currentWalk = this.getWalkById(walkId);
    if (!this.currentWalk) {
      console.error('Walk not found:', walkId);
      window.showError('Walk not found');
      return;
    }

    this.currentWaypointIndex = 0;
    this.walkStarted = true;
    this.completedWaypoints.clear();
    
    // Set initial UI visibility based on screen size
    this.uiPanelVisible = window.innerWidth > 768;
    
    this.createWalkUI();
    this.showWalkIntro();
    this.showCurrentWaypoint();
  }

  createWalkUI() {
    console.log('Creating walk UI'); // Debug log
    
    // Remove any existing walk UI
    const existingUI = document.getElementById('walk-ui');
    if (existingUI) {
      console.log('Removing existing UI');
      existingUI.remove();
    }

    // Create responsive walk UI that adapts to screen size
    const walkUI = document.createElement('div');
    walkUI.id = 'walk-ui';
    walkUI.className = this.getWalkUIClass();
    
    console.log('Walk UI class:', walkUI.className); // Debug log
    
    walkUI.innerHTML = `
      <div class="walk-header" id="walkHeader">
        <div class="walk-title">
          <span id="walkTitleText">🚶 ${this.currentWalk.title}</span>
          <button class="toggle-btn" id="toggleWalkUI">▼</button>
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
          <button onclick="walksManager.endWalk()" class="action-btn danger">
            End Walk
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(walkUI);
    console.log('Walk UI appended to body'); // Debug log
    
    // Add event listeners
    this.addWalkUIEventListeners();
    
    // Set initial state based on screen size
    this.updateUIForScreenSize();
    
    // Force visibility for desktop
    if (window.innerWidth > 768) {
      walkUI.style.display = 'block';
      walkUI.style.position = 'fixed';
      walkUI.style.top = '20px';
      walkUI.style.right = '20px';
      walkUI.style.zIndex = '1500';
      console.log('Desktop UI positioned and made visible');
    }
  }

  getWalkUIClass() {
    const className = window.innerWidth <= 768 ? 'walk-ui-mobile' : 'walk-ui-desktop';
    console.log('UI Class determined:', className, 'Width:', window.innerWidth); // Debug log
    return className;
  }

  addWalkUIEventListeners() {
    // Toggle button for mobile
    const toggleBtn = document.getElementById('toggleWalkUI');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        console.log('Toggle button clicked');
        this.toggleUI();
      });
    }
    
    // Handle window resize
    const resizeHandler = () => {
      console.log('Window resized to:', window.innerWidth);
      this.updateUIForScreenSize();
    };
    
    // Remove existing listener if it exists
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    this.resizeHandler = resizeHandler;
    window.addEventListener('resize', this.resizeHandler);
  }

  updateUIForScreenSize() {
    const walkUI = document.getElementById('walk-ui');
    const toggleBtn = document.getElementById('toggleWalkUI');
    const walkContent = document.getElementById('walkContent');
    
    if (!walkUI || !toggleBtn || !walkContent) {
      console.error('UI elements not found for resize update');
      return;
    }
    
    console.log('Updating UI for screen size:', window.innerWidth); // Debug log
    
    if (window.innerWidth <= 768) {
      // Mobile layout
      walkUI.className = 'walk-ui-mobile';
      toggleBtn.style.display = 'block';
      if (!this.uiPanelVisible) {
        walkContent.style.display = 'none';
      } else {
        walkContent.style.display = 'block';
      }
    } else {
      // Desktop layout
      walkUI.className = 'walk-ui-desktop';
      toggleBtn.style.display = 'none';
      // Always show content on desktop
      walkContent.style.display = 'block';
      this.uiPanelVisible = true;
      
      // Ensure desktop positioning
      walkUI.style.position = 'fixed';
      walkUI.style.top = '20px';
      walkUI.style.right = '20px';
      walkUI.style.bottom = 'auto';
      walkUI.style.left = 'auto';
      walkUI.style.width = '400px';
      walkUI.style.zIndex = '1500';
      
      console.log('Desktop layout applied');
    }
  }

  toggleUI() {
    const content = document.getElementById('walkContent');
    const toggleBtn = document.getElementById('toggleWalkUI');
    
    if (!content || !toggleBtn) return;
    
    if (this.uiPanelVisible) {
      // Hide content
      content.style.display = 'none';
      toggleBtn.textContent = '▲';
      this.uiPanelVisible = false;
    } else {
      // Show content
      content.style.display = 'block';
      toggleBtn.textContent = '▼';
      this.uiPanelVisible = true;
    }
  }

  showWalkIntro() {
    const introContent = document.getElementById('walkIntroContent');
    if (!introContent) {
      console.error('walkIntroContent element not found');
      return;
    }
    
    introContent.innerHTML = `
      <div class="intro-section">
        <h3>📍 Getting Started</h3>
        <p>${this.currentWalk.description}</p>
        <div class="walk-stats">
          <span class="stat">📏 ${this.currentWalk.distance}km</span>
          <span class="stat">⏱️ ${this.currentWalk.estimatedTime}</span>
          <span class="stat">📊 ${this.currentWalk.difficulty}</span>
        </div>
        <div class="start-location">
          <strong>Starting Point:</strong> ${this.currentWalk.startLocation.name}
        </div>
        <button onclick="walksManager.dismissIntro()" class="action-btn primary">
          Start Walking! 🚶‍♂️
        </button>
      </div>
    `;
    
    // Focus map on starting location
    if (window.map) {
      window.map.setView([
        this.currentWalk.startLocation.latitude, 
        this.currentWalk.startLocation.longitude
      ], 14);
    }
  }

  dismissIntro() {
    const introContent = document.getElementById('walkIntroContent');
    if (introContent) {
      introContent.style.display = 'none';
    }
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
      this.currentWaypointIndex++;
      this.showCurrentWaypoint();
      return;
    }

    // Focus map on current waypoint
    if (window.map) {
      window.map.setView([story.latitude, story.longitude], 15);
    }
    
    // Update waypoint content
    this.updateWaypointContent(waypoint, story);
    
    // Add waypoint marker
    this.addWaypointMarker(story, waypoint);
    
    // Show route
    this.showRouteToWaypoint(story);
  }

  updateWaypointContent(waypoint, story) {
    const waypointContent = document.getElementById('waypointContent');
    if (!waypointContent) {
      console.error('waypointContent element not found');
      return;
    }
    
    waypointContent.innerHTML = `
      <div class="waypoint-section">
        <h4>📍 Waypoint ${waypoint.order}: ${story.title}</h4>
        <p class="waypoint-instruction">${waypoint.instruction}</p>
        
        <div class="waypoint-status">
          <div class="distance-indicator">
            <span id="distanceToWaypoint">Calculating distance...</span>
          </div>
        <div id="waypointActions" class="waypoint-actions" style="display: none;">
          <button onclick="walksManager.viewCurrentStory()" class="action-btn primary story-btn">
            📖 View Story
          </button>
          <button onclick="walksManager.nextWaypoint()" class="action-btn success">
            Continue to Next Waypoint →
          </button>
        </div>
        </div>
      </div>
    `;
    
    // Update distance continuously
    this.updateWaypointDistance(story);
    this.updateProgress();
  }

  updateWaypointDistance(story) {
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
    }

    const updateDistance = () => {
      if (!window.locationManager) return;
      
      const distance = window.locationManager.getDistance(
        window.locationManager.userLat,
        window.locationManager.userLng,
        story.latitude,
        story.longitude
      );
      
      const distanceElement = document.getElementById('distanceToWaypoint');
      if (!distanceElement) return;
      
      if (distance <= 0.1) {
        distanceElement.innerHTML = '✅ You\'re here! Story unlocked.';
        distanceElement.className = 'distance-arrived';
        this.unlockWaypoint(story);
        const actionsDiv = document.getElementById('waypointActions');
        if (actionsDiv) actionsDiv.style.display = 'block';
      } else {
        distanceElement.innerHTML = `📏 ${Math.round(distance * 1000)}m away`;
        distanceElement.className = 'distance-away';
        const actionsDiv = document.getElementById('waypointActions');
        if (actionsDiv) actionsDiv.style.display = 'none';
      }
    };
    
    this.distanceInterval = setInterval(updateDistance, 3000);
    updateDistance();
  }

  updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill && progressText) {
      const totalWaypoints = this.currentWalk.waypoints.length;
      const completedCount = this.completedWaypoints.size;
      const progressPercent = (completedCount / totalWaypoints) * 100;
      
      progressFill.style.width = progressPercent + '%';
      progressText.textContent = `${completedCount}/${totalWaypoints} waypoints`;
    }
  }

  showRouteToWaypoint(story) {
    if (!window.locationManager) return;
    
    this.clearRoutes();
    
    const userLat = window.locationManager.userLat;
    const userLng = window.locationManager.userLng;
    
    if (!userLat || !userLng || userLat === 0 || userLng === 0) {
      console.warn('Invalid user location for routing');
      return;
    }
    
    try {
      this.currentRoute = L.Routing.control({
        waypoints: [
          L.latLng(userLat, userLng),
          L.latLng(story.latitude, story.longitude)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        createMarker: function() { return null; },
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'foot',
          timeout: 15000
        }),
        lineOptions: {
          styles: [{ color: '#2e5939', weight: 4, opacity: 0.7 }]
        },
        show: false, // Hide the default routing panel
        fitSelectedRoutes: true
      });

      this.currentRoute.on('routesfound', (e) => {
        this.showRouteInstructions(e.routes[0]);
      });

      this.currentRoute.on('routingerror', (e) => {
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
    
    let instructionsHTML = `
      <div class="routing-section">
        <h4>🧭 Walking Directions</h4>
        <div class="route-summary">
          <span>📏 ${distance}km</span>
          <span>⏱️ ${time} min</span>
        </div>
        <div class="route-instructions">
    `;
    
    // Show only the first few key instructions to avoid clutter
    const keyInstructions = route.instructions.slice(0, 5);
    keyInstructions.forEach((instruction, index) => {
      const distanceText = instruction.distance > 0 ? ` (${Math.round(instruction.distance)}m)` : '';
      instructionsHTML += `
        <div class="instruction-step">
          <span class="step-number">${index + 1}</span>
          <span class="step-text">${instruction.text}${distanceText}</span>
        </div>
      `;
    });
    
    if (route.instructions.length > 5) {
      instructionsHTML += `<div class="more-instructions">... and ${route.instructions.length - 5} more steps</div>`;
    }
    
    instructionsHTML += `
        </div>
      </div>
    `;
    
    routingContent.innerHTML = instructionsHTML;
  }

  unlockWaypoint(story) {
    if (this.completedWaypoints.has(story.id)) return;
    
    this.completedWaypoints.add(story.id);
    
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
      this.distanceInterval = null;
    }
    
    setTimeout(() => {
      this.showSuccess(`✅ Waypoint completed! Enjoy the story of ${story.title}`);
    }, 1000);
  }

  nextWaypoint() {
    if (!this.currentWalk || this.currentWaypointIndex >= this.currentWalk.waypoints.length) {
      return;
    }

    const currentWaypoint = this.currentWalk.waypoints[this.currentWaypointIndex];
    const currentStory = this.getStoryByIdSync(currentWaypoint.storyId);
  
    if (currentStory && !this.completedWaypoints.has(currentStory.id)) {
      window.showError('You must reach the waypoint location first!');
      return;
    }
  
    this.currentWaypointIndex++;
  
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
      this.distanceInterval = null;
    }
  
    this.showCurrentWaypoint();
  }
viewCurrentStory() {
  if (!this.currentWalk || this.currentWaypointIndex >= this.currentWalk.waypoints.length) {
    return;
  }

  const currentWaypoint = this.currentWalk.waypoints[this.currentWaypointIndex];
  const currentStory = this.getStoryByIdSync(currentWaypoint.storyId);

  if (!currentStory) {
    window.showError('Story not found');
    return;
  }

  // Check if user is at the location
  if (!this.completedWaypoints.has(currentStory.id)) {
    window.showError('You must reach the waypoint location first!');
    return;
  }

  // Store walk state
  this.storeWalkState();
  
  // Hide walk UI temporarily
  this.hideWalkUI();
  
  // Show the story
  this.showStoryModal(currentStory);
}

storeWalkState() {
  // Store the current walk state so we can resume later
  this.walkStateBeforeStory = {
    walkId: this.currentWalk.id,
    waypointIndex: this.currentWaypointIndex,
    completedWaypoints: new Set(this.completedWaypoints)
  };
}

hideWalkUI() {
  const walkUI = document.getElementById('walk-ui');
  if (walkUI) {
    walkUI.style.display = 'none';
  }
}

showWalkUI() {
  const walkUI = document.getElementById('walk-ui');
  if (walkUI) {
    walkUI.style.display = 'block';
  }
}

showStoryModal(story) {
  // Create story modal
  const modal = document.createElement('div');
  modal.id = 'story-modal';
  modal.className = 'story-modal';
  modal.innerHTML = `
    <div class="story-modal-content">
      <div class="story-modal-header">
        <h2>${story.title}</h2>
        <button class="close-story-btn" onclick="walksManager.closeStoryModal()">✕</button>
      </div>
      <div class="story-modal-body">
        <div class="story-category-badge">${story.category}</div>
        <div class="story-text">${story.story}</div>
      </div>
      <div class="story-modal-footer">
        <button onclick="walksManager.closeStoryModal()" class="action-btn primary">
          🚶 Return to Walk
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add escape key listener
  this.modalKeyHandler = (e) => {
    if (e.key === 'Escape') {
      this.closeStoryModal();
    }
  };
  document.addEventListener('keydown', this.modalKeyHandler);
}

closeStoryModal() {
  const modal = document.getElementById('story-modal');
  if (modal) {
    modal.remove();
  }
  
  // Remove escape key listener
  if (this.modalKeyHandler) {
    document.removeEventListener('keydown', this.modalKeyHandler);
    this.modalKeyHandler = null;
  }
  
  // Show walk UI again
  this.showWalkUI();
}
  completeWalk() {
    this.walkStarted = false;
    this.clearRoutes();
    
    // Remove walk UI
    const walkUI = document.getElementById('walk-ui');
    if (walkUI) walkUI.remove();
    
    if (this.distanceInterval) {
      clearInterval(this.distanceInterval);
      this.distanceInterval = null;
    }
    
    // Clean up resize listener
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    // Clean up story modal state
    this.walkStateBeforeStory = null;
    if (this.modalKeyHandler) {
      document.removeEventListener('keydown', this.modalKeyHandler);
      this.modalKeyHandler = null;
    }
    
    this.showSuccess(`🎉 Congratulations! You've completed the ${this.currentWalk.title} walk!`);
    
    this.currentWalk = null;
    this.currentWaypointIndex = 0;
    this.completedWaypoints.clear();
  }

  endWalk() {
    if (confirm('Are you sure you want to end this walk?')) {
      this.completeWalk();
    }
  }

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

  showFallbackRoute(userLat, userLng, story) {
    this.clearRoutes();
    
    this.fallbackLine = L.polyline([
      [userLat, userLng],
      [story.latitude, story.longitude]
    ], {
      color: '#ff6b6b',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(window.map);
    
    const bounds = L.latLngBounds([
      [userLat, userLng],
      [story.latitude, story.longitude]
    ]);
    window.map.fitBounds(bounds, { padding: [20, 20] });
    
    window.showError('Route service unavailable - showing direct path');
  }

  addWaypointMarker(story, waypoint) {
    if (!window.map) return;
    
    window.map.eachLayer(layer => {
      if (layer.options && layer.options.isWaypointMarker) {
        window.map.removeLayer(layer);
      }
    });

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
        ">${waypoint.order}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })
    }).addTo(window.map);
    
    marker.bindPopup(`
      <strong>Waypoint ${waypoint.order}</strong><br>
      ${story.title}<br>
      <em>${waypoint.instruction}</em>
    `);
  }

  getStoryByIdSync(storyId) {
    if (window.storyManager && window.storyManager.stories) {
      return window.storyManager.stories.find(s => s.id === storyId);
    }
    return null;
  }

  showSuccess(message) {
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
      z-index: 2000;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      max-width: 90%;
      text-align: center;
    `;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
  }

  // Debug method to check if walk UI is properly created
  debugWalkUI() {
    console.log('=== Walk UI Debug Info ===');
    console.log('Walk started:', this.walkStarted);
    console.log('Current walk:', this.currentWalk?.title || 'None');
    console.log('Screen width:', window.innerWidth);
    console.log('UI Panel visible:', this.uiPanelVisible);
    
    const walkUI = document.getElementById('walk-ui');
    if (walkUI) {
      console.log('Walk UI element found');
      console.log('Walk UI class:', walkUI.className);
      console.log('Walk UI style display:', walkUI.style.display);
      console.log('Walk UI computed style:', window.getComputedStyle(walkUI).display);
      console.log('Walk UI position:', walkUI.style.position);
      console.log('Walk UI z-index:', walkUI.style.zIndex);
    } else {
      console.log('Walk UI element NOT found');
    }
    console.log('=== End Debug Info ===');
  }
}
