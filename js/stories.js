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
      window.storiesData = this.stories; // Make globally available
      this.filteredStories = [...this.stories];
      this.displayStories();
      this.addMarkersToMap();
    } catch (error) {
      console.error('Error loading stories:', error);
      window.showError('Failed to load stories');
    }
  }

  displayStories() {
    const container = document.getElementById('stories');
    container.innerHTML = '';
    
    this.filteredStories.forEach(story => {
      const storyDiv = document.createElement('div');
      storyDiv.className = 'story';
      storyDiv.innerHTML = `
        <h3>${story.title}</h3>
        <p><strong>Category:</strong> ${story.category}</p>
        <p>${story.content.substring(0, 100)}...</p>
      `;
      storyDiv.onclick = () => this.openStory(story.id);
      container.appendChild(storyDiv);
    });
  }

  addMarkersToMap() {
    // Clear existing markers
    this.markers.forEach(marker => window.map.removeLayer(marker));
    this.markers = [];

    this.filteredStories.forEach(story => {
      const marker = L.marker([story.latitude, story.longitude])
        .addTo(window.map)
        .bindPopup(`
          <strong>${story.title}</strong><br>
          <em>${story.category}</em><br>
          <button onclick="storyManager.openStory('${story.id}')">Read Story</button>
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
}
