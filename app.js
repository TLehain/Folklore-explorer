```javascript
let userLat = 0;
let userLng = 0;

const map = L.map('map').setView([54.5, -1.5], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

navigator.geolocation.getCurrentPosition(pos => {
  userLat = pos.coords.latitude;
  userLng = pos.coords.longitude;
  L.marker([userLat, userLng]).addTo(map).bindPopup("You are here").openPopup();
  loadStories();
});

function loadStories() {
  fetch('stories.json')
    .then(res => res.json())
    .then(stories => {
      const container = document.getElementById('stories');
      container.innerHTML = '';

      const searchInput = document.getElementById('searchBar').value.toLowerCase();
      const category = document.getElementById('categoryFilter').value;

      stories.forEach(story => {
        if ((searchInput && !story.title.toLowerCase().includes(searchInput)) ||
            (category && story.category !== category)) return;

        const dist = getDistance(userLat, userLng, story.latitude, story.longitude);

        const div = document.createElement('div');
        div.className = 'story' + (dist > 0.1 ? ' locked' : '');
        div.innerHTML = `
          <h3>${story.title}</h3>
          <p><strong>Category:</strong> ${story.category}</p>
          <p>${dist <= 0.1 ? story.content.substring(0, 80) + '...' : '🔒 Locked. Get closer to unlock this story.'}</p>
        `;
        div.onclick = () => {
          if (dist <= 0.1) {
            window.location.href = `story.html?id=${story.id}`;
          } else {
            map.setView([story.latitude, story.longitude], 13);
          }
        };

        container.appendChild(div);

        const marker = L.marker([story.latitude, story.longitude]).addTo(map)
          .bindPopup(`<strong>${story.title}</strong><br>${dist <= 0.1 ? 'Unlocked' : 'Locked'}`);
      });
    });
}

document.getElementById('searchBar').addEventListener('input', loadStories);
document.getElementById('categoryFilter').addEventListener('change', loadStories);

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
function toRad(value) {
  return value * Math.PI / 180;
}
```
