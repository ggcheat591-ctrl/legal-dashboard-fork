import { mapObjects } from '../../data/mapObjects.js';

export function getMapObjects() {
  return mapObjects;
}

export function findMapObjectById(id) {
  return mapObjects.find(object => Number(object.id) === Number(id));
}

export function filterMapObjects({ type = 'all', query = '' } = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return mapObjects.filter(object => {
    const matchesType = type === 'all' || object.type === type;
    const matchesQuery =
      !normalizedQuery ||
      object.name.toLowerCase().includes(normalizedQuery) ||
      object.address.toLowerCase().includes(normalizedQuery) ||
      object.description.toLowerCase().includes(normalizedQuery);

    return matchesType && matchesQuery;
  });
}
