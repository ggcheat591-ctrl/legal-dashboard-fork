import L from 'leaflet';
import { getMapObjectIcon } from './mapObjects.js';

export function createMarkerLayer(objects, onSelect) {
  const group = L.layerGroup();

  objects.forEach(object => {
    const icon = L.divIcon({
      className: 'custom-map-marker',
      html: `<span>${getMapObjectIcon(object.type)}</span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([object.lat, object.lng], { icon });

    marker.bindPopup(`
      <div class="map-popup">
        <b>${object.name}</b>
        <span>${object.address}</span>
        <small>${object.description}</small>
      </div>
    `);

    marker.on('click', () => onSelect?.(object, marker));
    marker.objectId = object.id;
    group.addLayer(marker);
  });

  return group;
}
