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

  showStoryModal(story) {
    // Remove existing modal if any
    const existingModal = document.getElementById('story-modal');
    if (existingModal) existingModal.remove();

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'story-modal';
    modal.className = 'story-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="storyManager.closeStoryModal()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>${story.title}</h2>
          <button class="close-btn" onclick="storyManager.closeStoryModal()">×</button>
        </div>
        <div class="modal-body">
          <p><strong>Category:</strong> ${story.category}</p>
          <img src="${story.image}" alt="${story.title}" style="max-width: 100%; border-radius: 8px; margin: 15px 0;" />
          <div class="story-content">
            ${story.content}
          </div>
          <audio controls style="margin-top: 15px; width: 100%;">
            <source src="${story.audio}" type="audio/mp3">
            Your browser does not support the audio element.
          </audio>
        </div>
        <div class="modal-footer">
          <button onclick="storyManager.closeStoryModal()" class="continue-btn">Close Story</button>
        </div>
      </div>
    `;

    // Add modal styles
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
    
    // Add CSS styles for modal components
    this.addModalStyles();
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  closeStoryModal() {
    const modal = document.getElementById('story-modal');
    if (modal) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  }

  addModalStyles() {
    // Check if styles already exist
    if (document.getElementById('modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'modal-styles';
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
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
      }

      .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .story-content {
        line-height: 1.6;
        margin: 15px 0;
        text-align: justify;
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
      }

      .continue-btn:hover {
        background-color: #45a049;
      }

      /* Mobile responsive */
      @media screen and (max-width: 768px) {
        .modal-content {
          margin: 10px;
          max-height: 95vh;
        }
        
        .modal-header {
          padding: 15px;
        }
        
        .modal-body {
          padding: 15px;
        }
        
        .modal-header h2 {
          font-size: 1.3em;
        }
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

  filterStories(searchTerm, category) {
    this.filteredStories = this.stories.filter(story => {
      const matchesSearch = !searchTerm || 
        story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.teaser.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !category || story.category === category;
      
      return matchesSearch && matchesCategory;
    });
    
    this.displayStories();
    this.addMarkersToMap();
  }
}
