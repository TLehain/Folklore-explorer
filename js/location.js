class LocationManager {
constructor() {
this.userLat = 0;
this.userLng = 0;
this.watchId = null;
this.proximityAlerts = new Set();
}
async initialize() {
if (!navigator.geolocation) {
this.handleError("Geolocation is not supported by this browser.");
this.setDefaultLocation();
return;
}
const options = {
enableHighAccuracy: true,
timeout: 10000,
maximumAge: 300000
};
try {
const position = await this.getCurrentPosition(options);
this.userLat = position.coords.latitude;
this.userLng = position.coords.longitude;
this.sortStoriesByProximity();
this.addUserMarker();
this.startWatching();
} catch (error) {
this.handleLocationError(error);
this.setDefaultLocation();
}
}
getCurrentPosition(options) {
return new Promise((resolve, reject) => {
navigator.geolocation.getCurrentPosition(resolve, reject, options);
});
}
setDefaultLocation() {
this.userLat = 54.5;
this.userLng = -1.5;
}
addUserMarker() {
L.marker([this.userLat, this.userLng])
.addTo(window.map)
.bindPopup("You are here")
.openPopup();
}
handleLocationError(error) {
const messages = {
1: "Location access denied. Using default location.",
2: "Location unavailable. Using default location.",
3: "Location request timed out. Using default location."
};
const message = messages[error.code] || "Location error. Using default location.";
window.showError(message);
}
startWatching() {
if (this.watchId) return;
this.watchId = navigator.geolocation.watchPosition(
position => {
this.userLat = position.coords.latitude;
this.userLng = position.coords.longitude;
this.sortStoriesByProximity();  
this.checkProximityAlerts();
},
error => console.warn('Location watching failed:', error),
{ enableHighAccuracy: true }
);
}
getDistance(lat1, lon1, lat2, lon2) {
const R = 6371;
const dLat = this.toRad(lat2 - lat1);
const dLon = this.toRad(lon2 - lon1);
const a =
Math.sin(dLat/2) * Math.sin(dLat/2) +
Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
Math.sin(dLon/2) * Math.sin(dLon/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
return R * c;
}
toRad(value) {
return value * Math.PI / 180;
}
sortStoriesByProximity() {
  if (window.storyManager) {
    window.storyManager.sortStoriesByProximity(this.userLat, this.userLng);
    }
  } 
} 

