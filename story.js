
const params = new URLSearchParams(window.location.search);
const storyId = params.get("id");

fetch("stories.json")
  .then(res => res.json())
  .then(stories => {
    const story = stories.find(s => s.id === storyId);
    const div = document.getElementById("storyContainer");
    if (!story) {
      div.innerHTML = "<p>Story not found.</p>";
      return;
    }
    div.innerHTML = `
      <button onclick="window.location.href='index.html'">← Back to Map</button>
      <h2>${story.title}</h2>
      <p><strong>Category:</strong> ${story.category}</p>
      <img src="${story.image}" alt="${story.title}" style="max-width: 100%; border-radius: 8px;" />
      <p>${story.content}</p>
      <audio controls style="margin-top: 15px;">
        <source src="${story.audio}" type="audio/mp3">
        Your browser does not support the audio element.
      </audio>
    `;
  });
