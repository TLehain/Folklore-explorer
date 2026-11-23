// Checks stories.json and walks.json before you deploy.
// Usage: node tools/validate-data.mjs [--skip-files]
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipFiles = process.argv.includes('--skip-files');

const MAX_LEG_KM = 5; // furthest allowed gap between two stops on one walk
const MAX_START_GAP_KM = 1; // furthest allowed gap between the start point and the first stop
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const errors = [];
const warnings = [];
const info = [];

const error = message => errors.push(message);
const warn = message => warnings.push(message);

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = degrees => degrees * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Categories offered by the filter in index.html
async function readCategories() {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const block = /id="categoryFilter"[\s\S]*?<\/select>/.exec(html);
  if (!block) return null;
  return Array.from(block[0].matchAll(/<option value="([^"]+)"/g)).map(match => match[1]);
}

async function checkStories(stories, categories) {
  const seen = new Set();
  const published = new Map();

  for (const story of stories) {
    const label = `Story "${story.id ?? '(no id)'}"`;

    for (const field of ['id', 'title', 'category', 'teaser', 'content', 'image', 'audio']) {
      if (!story[field] || (Array.isArray(story[field]) && !story[field].length)) {
        error(`${label}: missing "${field}".`);
      }
    }
    if (!isNumber(story.latitude) || story.latitude < -90 || story.latitude > 90) {
      error(`${label}: latitude must be a number between -90 and 90.`);
    }
    if (!isNumber(story.longitude) || story.longitude < -180 || story.longitude > 180) {
      error(`${label}: longitude must be a number between -180 and 180.`);
    }
    if (story.id && !KEBAB_CASE.test(story.id)) {
      error(`${label}: id must be lower-case kebab-case (letters, digits, and hyphens).`);
    }
    if (story.id && seen.has(story.id)) {
      error(`${label}: duplicate id.`);
    }
    seen.add(story.id);

    if (story.unlockRadius !== undefined && (!isNumber(story.unlockRadius) || story.unlockRadius < 10 || story.unlockRadius > 1000)) {
      error(`${label}: unlockRadius must be a number of metres between 10 and 1000.`);
    }

    if (story.draft) {
      info.push(`${label} is a draft and is hidden from the app.`);
      continue;
    }

    published.set(story.id, story);

    const text = Array.isArray(story.content) ? story.content.join(' ') : String(story.content || '');
    if (/lorem ipsum/i.test(text) || /lorem ipsum/i.test(story.teaser || '')) {
      error(`${label}: still contains placeholder text (Lorem ipsum). Mark it "draft": true or write it.`);
    }
    if (categories && story.category && !categories.includes(story.category)) {
      warn(`${label}: category "${story.category}" is not in the filter list in index.html.`);
    }

    if (!skipFiles) {
      for (const field of ['image', 'audio']) {
        if (story[field] && !(await exists(story[field]))) {
          error(`${label}: ${field} file not found at "${story[field]}".`);
        }
      }
    }
  }

  return published;
}

async function checkWalks(walks, publishedStories) {
  const seen = new Set();

  for (const walk of walks) {
    const label = `Walk "${walk.id ?? '(no id)'}"`;

    if (walk.id && seen.has(walk.id)) error(`${label}: duplicate id.`);
    seen.add(walk.id);

    if (walk.published === false) {
      info.push(`${label} is unpublished and was not checked.${walk.unpublishedReason ? ` Reason: ${walk.unpublishedReason}` : ''}`);
      continue;
    }

    for (const field of ['id', 'title', 'description', 'difficulty', 'estimatedTime']) {
      if (!walk[field]) error(`${label}: missing "${field}".`);
    }
    if (walk.id && !KEBAB_CASE.test(walk.id)) {
      error(`${label}: id must be lower-case kebab-case.`);
    }
    if (!isNumber(walk.distance) || walk.distance <= 0) {
      error(`${label}: distance must be a positive number of kilometres.`);
    }
    const start = walk.startLocation;
    if (!start || !isNumber(start.latitude) || !isNumber(start.longitude) || !start.name) {
      error(`${label}: startLocation needs latitude, longitude, and name.`);
    }
    if (!Array.isArray(walk.waypoints) || walk.waypoints.length < 2) {
      error(`${label}: a walk needs at least two waypoints.`);
      continue;
    }

    const stops = [];
    walk.waypoints.forEach((waypoint, index) => {
      if (waypoint.order !== index + 1) {
        error(`${label}: waypoint ${index + 1} has order ${waypoint.order}. Orders must run 1, 2, 3 in sequence.`);
      }
      if (!waypoint.instruction) error(`${label}: waypoint ${index + 1} has no instruction.`);

      const story = publishedStories.get(waypoint.storyId);
      if (!story) {
        error(`${label}: waypoint ${index + 1} refers to "${waypoint.storyId}", which is not a published story.`);
      } else {
        stops.push(story);
      }
    });

    if (stops.length !== walk.waypoints.length) continue;

    if (start && isNumber(start.latitude) && isNumber(start.longitude)) {
      const gap = haversineKm(start.latitude, start.longitude, stops[0].latitude, stops[0].longitude);
      if (gap > MAX_START_GAP_KM) {
        warn(`${label}: the start point is ${gap.toFixed(1)} km from the first stop.`);
      }
    }

    let straightLineKm = 0;
    for (let index = 1; index < stops.length; index++) {
      const leg = haversineKm(stops[index - 1].latitude, stops[index - 1].longitude, stops[index].latitude, stops[index].longitude);
      straightLineKm += leg;
      if (leg > MAX_LEG_KM) {
        error(`${label}: stops "${stops[index - 1].id}" and "${stops[index].id}" are ${leg.toFixed(1)} km apart (limit ${MAX_LEG_KM} km).`);
      }
    }

    // A walked route cannot be shorter than the straight lines between stops
    if (isNumber(walk.distance) && walk.distance < straightLineKm * 0.95) {
      error(`${label}: declared distance ${walk.distance} km is shorter than the straight-line distance between stops (${straightLineKm.toFixed(2)} km).`);
    }

    if (walk.route) {
      const routePath = walk.route;
      if (!(await exists(routePath))) {
        if (!skipFiles) error(`${label}: route file not found at "${routePath}".`);
      } else {
        try {
          const geojson = await readJson(routePath);
          if (!geojson.type) error(`${label}: route file "${routePath}" is not valid GeoJSON (no "type").`);
        } catch (parseError) {
          error(`${label}: route file "${routePath}" is not valid JSON.`);
        }
      }
    }
  }
}

async function main() {
  const [stories, walkData, categories] = await Promise.all([
    readJson('stories.json'),
    readJson('walks.json'),
    readCategories()
  ]);

  const published = await checkStories(stories, categories);
  await checkWalks(walkData.walks, published);

  info.forEach(message => console.log(`info     ${message}`));
  warnings.forEach(message => console.log(`warning  ${message}`));
  errors.forEach(message => console.log(`ERROR    ${message}`));

  console.log(`\n${stories.length} stories, ${walkData.walks.length} walks checked: ${errors.length} error(s), ${warnings.length} warning(s).${skipFiles ? ' (file checks skipped)' : ''}`);
  process.exit(errors.length ? 1 : 0);
}

main().catch(failure => {
  console.error(failure);
  process.exit(1);
});
