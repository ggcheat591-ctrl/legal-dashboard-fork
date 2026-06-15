import L from 'leaflet';
import { getMapObjects, findMapObjectById } from './mapService.js';
import { createMarkerLayer } from './mapLayers.js';
import { bindMapControls } from './mapControls.js';

let mapInstance = null;
let markerLayer = null;
let selectedMarker = null;
let controlsBound = false;

export function initMap(containerId = 'legalMap') {
  const container = document.getElementById(containerId);
  if (!container) return null;

  if (!mapInstance) {
    mapInstance = L.map(containerId, {
      center: [55.7558, 37.6176],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: true
    });

    L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(mapInstance);

    renderMarkers(getMapObjects());

    mapInstance.whenReady(() => {
      fitToMarkers();
      invalidateMapSize();
    });
  }

  if (!controlsBound) {
    bindMapControls(objects => {
      renderMarkers(objects);
      fitToMarkers();
    });

    document.addEventListener('click', event => {
      const card = event.target.closest('[data-map-object]');
      if (!card) return;

      const object = findMapObjectById(card.dataset.mapObject);
      if (object) focusMapObject(object.id);
    });

    controlsBound = true;
  }

  setTimeout(() => {
    invalidateMapSize();
    fitToMarkers();
  }, 120);

  return mapInstance;
}

export function renderMarkers(objects) {
  if (!mapInstance) return;

  if (markerLayer) {
    markerLayer.removeFrom(mapInstance);
  }

  markerLayer = createMarkerLayer(objects, (object, marker) => {
    selectedMarker = marker;
    highlightObjectCard(object.id);
  });

  markerLayer.addTo(mapInstance);
}

export function focusMapObject(id) {
  if (!mapInstance || !markerLayer) return;

  let targetMarker = null;

  markerLayer.eachLayer(marker => {
    if (Number(marker.objectId) === Number(id)) {
      targetMarker = marker;
    }
  });

  const object = findMapObjectById(id);
  if (!targetMarker || !object) return;

  selectedMarker = targetMarker;
  mapInstance.setView([object.lat, object.lng], 14, { animate: true });
  targetMarker.openPopup();
  highlightObjectCard(id);
}

export function invalidateMapSize() {
  if (mapInstance) {
    mapInstance.invalidateSize();
  }
}

function fitToMarkers() {
  if (!mapInstance || !markerLayer) return;

  const layers = markerLayer.getLayers();
  if (!layers.length) return;

  const group = L.featureGroup(layers);
  mapInstance.fitBounds(group.getBounds().pad(0.18), {
    maxZoom: 14,
    animate: true
  });
}

function highlightObjectCard(id) {
  document.querySelectorAll('[data-map-object]').forEach(card => {
    card.classList.toggle('active', Number(card.dataset.mapObject) === Number(id));
  });
}
