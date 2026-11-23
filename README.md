# Folklore Explorer

A web app for exploring folklore in the landscape. Stories unlock when you are near the place they belong to, and guided walks link several stories into a route with text and audio.

## Running it locally

Geolocation, service workers, and ES modules need a web server (not a `file://` address).

```
python3 -m http.server 8000
```

Open `http://localhost:8000`. Browsers treat `localhost` as secure. A deployed site must use HTTPS.

## Project layout

| Path | Purpose |
|---|---|
| `index.html`, `styles.css` | Page and styling |
| `js/app.js` | Start-up, modes, location choice, preview mode |
| `js/location.js` | GPS, throttling, unlock test, approach alerts |
| `js/stories.js` | Story list, map markers, story reader |
| `js/walks.js` | Guided walks, progress, routes, wake lock |
| `js/dialog.js` | Accessible dialog (focus, Escape, Tab handling) |
| `js/offline.js`, `sw.js` | Offline support and saved walks |
| `stories.json`, `walks.json` | Content |
| `routes/` | Optional GeoJSON route per walk |
| `tools/validate-data.mjs` | Data checks (run before deploying) |

## Data

### Story (`stories.json`)

| Field | Notes |
|---|---|
| `id` | Lower-case kebab-case, unique |
| `title`, `category`, `teaser` | Category must match an option in `index.html` |
| `content` | A string (blank line between paragraphs) or an array of paragraphs |
| `latitude`, `longitude` | Decimal degrees |
| `image`, `audio` | Paths from the site root, for example `image/lambton-worm.webp` |
| `unlockRadius` | Optional, metres (10 to 1000). Default 100 |
| `credits` | Optional text shown under the story: image, audio, and source credits |
| `draft` | `true` hides the story from the app |

### Walk (`walks.json`)

| Field | Notes |
|---|---|
| `id`, `title`, `description`, `difficulty`, `estimatedTime` | Text shown in the app |
| `distance` | Kilometres. Must be at least the straight-line distance between stops |
| `startLocation` | `latitude`, `longitude`, `name` |
| `waypoints` | Ordered `{ order, storyId, instruction }`. Coordinates come from the story |
| `route` | Optional path to a GeoJSON file, for example `routes/bamburgh.geojson` |
| `published` | `false` hides the walk. `unpublishedReason` is a note for you |

A walk without `route` gets live directions from the public OSRM service. A curated `route` file keeps walkers on the footpaths you chose and works offline once saved.

## Checking the data

```
node tools/validate-data.mjs
```

It fails when a walk refers to a missing story, a stop is more than 5 km from the next, the declared distance is shorter than the straight-line distance, a published story still contains placeholder text, an image, audio, or route file is missing, or an ID is not kebab-case. Use `--skip-files` to skip the file checks. The GitHub Actions workflow runs this on every push.

## Deploying

1. Run the validation script.
2. Change `VERSION` at the top of `sw.js` so visitors receive the new files.
3. Publish over HTTPS.

Walks saved for offline use are kept in a separate cache that survives version changes.

## Privacy

The site does not collect or store location data. Position stays in the browser. Saved progress (unlocked stories, walk progress, and the location choice) is kept in the browser's local storage, and the footer button clears it. Third parties receive requests as follows:

- OpenStreetMap tile servers receive the map area being viewed.
- The public OSRM service receives the walker's position and the next stop when a walk has no curated `route`.
- Google Fonts and unpkg.com serve the fonts and map library.

If you add analytics, update the notices in `index.html` and `js/app.js`.

## Still to do

- Placeholder icons in `icons/` should be replaced with your own artwork.
- Add a curated GeoJSON route for each walk (for example, exported from a GPX of the walk).
- Complete the Monks of Bearpark and Bog Faeries stories, then set `"draft": false`.
- Replace the unpublished walks with walkable routes, then set `"published": true`.
