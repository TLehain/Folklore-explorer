// app.js

// List of folklore stories with their coordinates
const stories = [
  {
    title: "The Lambton Worm",
    latitude: 54.8520,
    longitude: -1.5711,
    content: "In the 14th century, young John Lambton skipped church one Sunday to fish in the River Wear...",
    image: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Penshaw_Monument.jpg"
  },
  {
    title: "The Grey Lady of Bamburgh Castle",
    latitude: 55.6090,
    longitude: -1.7109,
    content: "High on the windswept cliffs of Northumberland stands Bamburgh Castle...",
    image: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bamburgh_Castle.jpg"
  }
];

// Function to calculate distance between two coordinates using the Haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Function to display stories
function displayStories(position) {
  const userLat = position.coords.latitude;
  const userLon = position.coords.longitude;
  const container = document.getElementById('stories');
  container.innerHTML = '';

  stories.forEach(story => {
    const distance = getDistance(userLat, userLon, story.latitude, story.longitude);
    const isUnlocked = distance <= 100; // 100 meters proximity
    const storyDiv = document.createElement('div');
    storyDiv.className = 'story ' + (isUnlocked ? 'unlocked' : 'locked');

    const title = document.createElement('h2');
    title.textContent = story.title;
    storyDiv.appendChild(title);

    const img = document.createElement('img');
    img.src = story.image;
    img.alt = story.title;
    img.style.maxWidth = '100%';
    storyDiv.appendChild(img);

    const content = document.createElement('p');
    content.textContent = isUnlocked ? story.content : 'You are too far from this location to unlock the story.';
    storyDiv.appendChild(content);

    container.appendChild(storyDiv);
  });
}

// Get user's current position
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(displayStories, error => {
    alert('Error getting location: ' + error.message);
  });
} else {
  alert('Geolocation is not supported by your browser.');
}
