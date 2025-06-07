let stories = [];
let map, userMarker;

fetch("stories.json")
  .then((res) => res.json())
  .then((data) => {
    stories = data;
    initMap();
  });

function initMap() {
  map = L.map("map").setView([54.97, -1.6], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        userMarker = L.marker(userLatLng).addTo(map).bindPopup("You are here");
        showStories(userLatLng);
      },
      () => alert("Location access denied.")
    );
  } else {
    alert("Geolocation not supported.");
  }
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showStories(userCoords) {
  const container = document.getElementById("storyList");
  container.innerHTML = "";

  stories.forEach((story) => {
    const distance = getDistance(
      userCoords[0],
      userCoords[1],
      story.latitude,
      story.longitude
    );

    const div = document.createElement("div");
    div.className = "story" + (distance > 100 ? " locked" : "");

    const title = document.createElement("h2");
    title.textContent = story.title;
    div.appendChild(title);

    const category = document.createElement("p");
    category.textContent = `Category: ${story.category}`;
    div.appendChild(category);

    const img = document.createElement("img");
    img.src = story.image;
    div.appendChild(img);

    const content = document.createElement("p");
    content.innerHTML =
      distance <= 100
        ? story.content
        : '<span>🔒 Story locked. Move closer to unlock.</span>';
    div.appendChild(content);

    const marker = L.marker([story.latitude, story.longitude])
      .addTo(map)
      .bindPopup(story.title);

    div.onclick = () => {
      map.setView([story.latitude, story.longitude], 13);
      marker.openPopup();
    };

    container.appendChild(div);
  });
}

function applyFilters() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const distanceInput = parseFloat(document.getElementById("distanceFilter").value);

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition((pos) => {
    const userCoords = [pos.coords.latitude, pos.coords.longitude];

    const container = document.getElementById("storyList");
    container.innerHTML = "";

    stories
      .filter((s) => {
        const matchTitle = s.title.toLowerCase().includes(search);
        const matchCat = category === "" || s.category === category;
        const matchDist =
          isNaN(distanceInput) ||
          getDistance(userCoords[0], userCoords[1], s.latitude, s.longitude) <= distanceInput;
        return matchTitle && matchCat && matchDist;
      })
      .forEach((story) => {
        const distance = getDistance(
          userCoords[0],
          userCoords[1],
          story.latitude,
          story.longitude
        );

        const div = document.createElement("div");
        div.className = "story" + (distance > 100 ? " locked" : "");

        const title = document.createElement("h2");
        title.textContent = story.title;
        div.appendChild(title);

        const category = document.createElement("p");
        category.textContent = `Category: ${story.category}`;
        div.appendChild(category);

        const img = document.createElement("img");
        img.src = story.image;
        div.appendChild(img);

        const content = document.createElement("p");
        content.innerHTML =
          distance <= 100
            ? story.content
            : '<span>🔒 Story locked. Move closer to unlock.</span>';
        div.appendChild(content);

        const marker = L.marker([story.latitude, story.longitude])
          .addTo(map)
          .bindPopup(story.title);

        div.onclick = () => {
          map.setView([story.latitude, story.longitude], 13);
          marker.openPopup();
        };

        container.appendChild(div);
      });
  });
}
