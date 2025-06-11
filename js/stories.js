class StoryManager {
  constructor() {
    this.stories = [];
    this.markers = [];
    this.filteredStories = [];
  }

  async loadStories() {
    try {
      const response = await fetch('stories.json');
      if (!response.ok) throw new Error('Failed to load stories');
      this.stories = await response.json();
      window.storiesData = this.stories;
      this.filteredStories = [...this.stories];
      this.displayStories();
      this.addMarkersToMap();
    } catch (error) {
      console.error('Error loading stories:', error);
      window.showError('Failed to load stories');
    }
  }
  
calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

sortStoriesByProximity(userLat, userLon) {
  // Calculate distances for all stories
  this.stories.forEach(story => {
    story.distance = this.calculateDistance(userLat, userLon, story.latitude, story.longitude);
  });
  
  // Sort the main stories array by distance
  this.stories.sort((a, b) => a.distance - b.distance);
  
  // Update filtered stories to maintain the same order
  // Re-apply current filters while preserving the new proximity order
  const searchBar = document.getElementById('searchBar');
  const categoryFilter = document.getElementById('categoryFilter');
  
  if (searchBar && categoryFilter) {
    this.filterStories(searchBar.value, categoryFilter.value);
  } else {
    // If no filters are active, just copy the sorted array
    this.filteredStories = [...this.stories];
    this.displayStories();
    this.addMarkersToMap();
  }
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
    
    // Open story in modal instead of navigating
    this.showStoryModal(story);
  }

  // ENHANCED VERSION - Replace the existing showStoryModal method with this
  showStoryModal(story) {
    // Remove existing modal if any
    const existingModal = document.getElementById('story-modal');
    if (existingModal) existingModal.remove();

    // Create modal with improved image handling
    const modal = document.createElement('div');
    modal.id = 'story-modal';
    modal.className = 'story-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="storyManager.closeStoryModal()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>${story.title}</h2>
          <button class="close-btn" onclick="storyManager.closeStoryModal()" aria-label="Close story">×</button>
        </div>
        <div class="modal-body">
          <p><strong>Category:</strong> ${story.category}</p>
          <div class="story-image-container">
            <picture>
              <source srcset="${story.image.replace('.jpg', '.webp')}" type="image/webp">
              <img 
                src="${story.image}" 
                alt="${story.title} - ${story.category} folklore story" 
                class="story-image"
                loading="lazy"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
              />
            </picture>
            <div class="image-error" style="display: none;">
              <p>📸 Image unavailable</p>
            </div>
          </div>
          <div class="story-content">
            ${story.content}
          </div>
          <div class="audio-container">
            <audio controls preload="none" aria-label="Audio narration of ${story.title}">
              <source src="${story.audio}" type="audio/mp3">
              <p>Your browser does not support the audio element. <a href="${story.audio}">Download the audio file</a>.</p>
            </audio>
          </div>
        </div>
        <div class="modal-footer">
          <button onclick="storyManager.closeStoryModal()" class="continue-btn">Close Story</button>
        </div>
      </div>
    `;

    // Enhanced modal styles
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    `;

    document.body.appendChild(modal);
    this.addEnhancedModalStyles();
    document.body.style.overflow = 'hidden';
  }

  closeStoryModal() {
    const modal = document.getElementById('story-modal');
    if (modal) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  }

  // ENHANCED VERSION - Replace the existing addModalStyles method with this
  addEnhancedModalStyles() {
    if (document.getElementById('enhanced-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'enhanced-modal-styles';
    style.textContent = `
      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
      }

      .modal-content {
        position: relative;
        background: white;
        border-radius: 12px;
        max-width: 800px;
        max-height: 90vh;
        width: 100%;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #eee;
        background: #2e5939;
        color: white;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 1.5em;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        color: white;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
      }

      .close-btn:hover, .close-btn:focus {
        background: rgba(255, 255, 255, 0.1);
        outline: 2px solid white;
      }

      .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      /* Enhanced image container */
      .story-image-container {
        margin: 15px 0;
        text-align: center;
      }

      .story-image {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        /* Maintain aspect ratio */
        object-fit: cover;
        /* Set max dimensions for consistency */
        max-height: 400px;
      }

      .image-error {
        background: #f0f0f0;
        padding: 40px;
        border-radius: 8px;
        color: #666;
        font-style: italic;
      }

      .story-content {
        line-height: 1.6;
        margin: 15px 0;
        text-align: justify;
      }

      /* Enhanced audio container */
      .audio-container {
        margin: 20px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e9ecef;
      }

      .audio-container audio {
        width: 100%;
        height: 40px;
        margin: 0;
      }

      .modal-footer {
        padding: 15px 20px;
        border-top: 1px solid #eee;
        text-align: center;
      }

      .continue-btn {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
        min-height: 44px; /* Touch target size */
      }

      .continue-btn:hover, .continue-btn:focus {
        background-color: #45a049;
        outline: 2px solid #2e5939;
      }

      /* Mobile responsive enhancements */
      @media screen and (max-width: 768px) {
        .modal-content {
          margin: 10px;
          max-height: 95vh;
          max-width: calc(100vw - 20px);
        }
        
        .modal-header {
          padding: 15px;
        }
        
        .modal-body {
          padding: 15px;
        }
        
        .modal-header h2 {
          font-size: 1.3em;
          line-height: 1.2;
        }

        .story-image {
          max-height: 250px;
          width: 100%;
          object-fit: cover;
        }

        .story-content {
          font-size: 16px; /* Prevent zoom on iOS */
          text-align: left; /* Better for mobile reading */
        }

        .audio-container {
          margin: 15px 0;
          padding: 10px;
        }
      }

      /* High DPI display optimization */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        .story-image {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
      }

      /* Accessibility improvements */
      @media (prefers-reduced-motion: reduce) {
        .continue-btn, .close-btn {
          transition: none;
        }
      }

      /* Focus management for keyboard navigation */
      .modal-content:focus-within .close-btn:focus {
        outline: 2px solid #4CAF50;
        outline-offset: 2px;
      }
    `;
    
    document.head.appendChild(style);
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
        <p>${story.teaser.substring(0, 100)}</p>
        ${!isUnlocked ? `<p class="distance-info">Distance: ${this.getDistanceToStory(story)}m</p>` : ''}
      `;
      
      // Better touch handling for mobile
      storyDiv.addEventListener('click', (e) => {
        e.preventDefault();
        this.openStory(story.id);
      });

      // Add touch feedback
      storyDiv.addEventListener('touchstart', () => {
        storyDiv.style.transform = 'scale(0.98)';
      });

      storyDiv.addEventListener('touchend', () => {
        storyDiv.style.transform = 'scale(1)';
      });
      
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
            `<button onclick="storyManager.openStory('${story.id}')" style="padding: 10px 15px; font-size: 14px; min-height: 44px;">Read Story</button>` :
            `<p>🔒 Come within 100m to unlock<br>Distance: ${this.getDistanceToStory(story)}m</p>`
          }
        `);
      this.markers.push(marker);
    });
  }

  // Improved filterStories method that preserves proximity order
  filterStories(searchTerm, category) {
    this.filteredStories = this.stories.filter(story => {
      const matchesSearch = !searchTerm || 
        story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.teaser.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !category || story.category === category;
      
      return matchesSearch && matchesCategory;
    });
    
    // The filtered stories will maintain the proximity order from the original sorted array
    this.displayStories();
    this.addMarkersToMap();
  }
}
