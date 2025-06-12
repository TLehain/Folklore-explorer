// Enhanced WalksManager with mobile-optimized UI
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
    this.uiPanelVisible = false;
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
    
    this.createWalkUI();
    this.showWalkIntro();
    this.showCurrentWaypoint();
  }

  createWalkUI() {
    // Remove any existing walk UI
    const existingUI = document.getElementById('walk-ui');
    if (existingUI) existingUI.remove();

    // Create responsive walk UI that adapts to screen size
    const walkUI = document.createElement('div');
    walkUI.id = 'walk-ui';
    walkUI.className = this.getWalkUIClass();
    
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
    
    // Add event listeners
    this.addWalkUIEventListeners();
    
    // Set initial state based on screen size
    this.updateUIForScreenSize();
  }

  getWalkUIClass() {
    return window.innerWidth <= 768 ? 'walk-ui-mobile' : 'walk-ui-desktop';
  }

  addWalkUIEventListeners() {
    // Toggle button for mobile
    const toggleBtn = document.getElementById('toggleWalkUI');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleUI();
      });
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.updateUIForScreenSize();
    });
  }

  updateUIForScreenSize() {
    const walkUI = document.getElementById('walk-ui');
    const toggleBtn = document.getElementById('toggleWalkUI');
    
    if (!walkUI || !toggleBtn) return;
    
    if (window.innerWidth <= 768) {
      // Mobile layout
      walkUI.className = 'walk-ui-mobile';
      toggleBtn.style.display = 'block';
      if (!this.uiPanelVisible) {
        document.getElementById('walkContent').style.display = 'none';
        this.uiPanelVisible = false;
      }
    } else {
      // Desktop layout
      walkUI.className = 'walk-ui-desktop';
      toggleBtn.style.display = 'none';
      // Always show content on desktop
      document.getElementById('walkContent').style.display = 'block';
      this.uiPanelVisible = true;
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
    if (!introContent) return;
    
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
    window.map.setView([
      this.currentWalk.startLocation.latitude, 
      this.currentWalk.startLocation.longitude
    ], 14);
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
    window.map.setView([story.latitude, story.longitude], 15);
    
    // Update waypoint content
    this.updateWaypointContent(waypoint, story);
    
    // Add waypoint marker
    this.addWaypointMarker(story, waypoint);
    
    // Show route
    this.showRouteToWaypoint(story);
  }

  updateWaypointContent(waypoint, story) {
    const waypointContent = document.getElementById('waypointContent');
    if (!waypointContent) return;
    
    waypointContent.innerHTML = `
      <div class="waypoint-section">
        <h4>📍 Waypoint ${waypoint.order}: ${story.title}</h4>
        <p class="waypoint-instruction">${waypoint.instruction}</p>
        
        <div class="waypoint-status">
          <div class="distance-indicator">
            <span id="distanceToWaypoint">Calculating distance...</span>
          </div>
          <div id="waypointActions" class="waypoint-actions" style="display: none;">
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
}
