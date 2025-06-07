const params = new URLSearchParams(window.location.search);
const storyId = params.get("id");

fetch("stories.json")
  .then(res => res.json())
  .then(stories => {
    const story = stories.find(s => s.id === storyId);
    if (!story) {
      document.getElementById("storyContainer").innerHTML = "<p>Story not found.</p>";
      return;
    }

    const div = document.getElementById("storyContainer");
   div.innerHTML = `
  <button onclick="window.location.href='index.html'" style="
    background-color: #2e5939;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 16px;
    margin-bottom: 20px;
    cursor: pointer;
  ">← Back to Map</button>
  
  <h2>${story.title}</h2>
  <p><strong>Category:</strong> ${story.category}</p>
  <img src="${story.image}" alt="${story.title}" style="max-width: 100%; border-radius: 8px;" />
  <p>${story.content}</p>
  <audio controls style="margin-top: 15px;">
    <source src="${story.audio}" type="audio/mpeg">
    Your browser does not support the audio element.
  </audio>
`;

    `;
  });
