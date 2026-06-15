import { filterMapObjects } from './mapService.js';
import { renderMapObjectCard } from './mapObjects.js';

export function bindMapControls(onChange) {
  const searchInput = document.querySelector('#mapSearch');
  const filterButtons = Array.from(document.querySelectorAll('[data-map-filter]'));

  let currentType = 'all';
  let currentQuery = '';

  const emit = () => {
    const objects = filterMapObjects({
      type: currentType,
      query: currentQuery
    });

    renderObjectsList(objects);
    onChange(objects);
  };

  searchInput?.addEventListener('input', () => {
    currentQuery = searchInput.value;
    emit();
  });

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentType = button.dataset.mapFilter;

      filterButtons.forEach(item => {
        item.classList.toggle('primary', item === button);
      });

      emit();
    });
  });

  renderObjectsList(filterMapObjects({ type: currentType, query: currentQuery }));
}

export function renderObjectsList(objects) {
  const list = document.querySelector('#mapObjectsList');
  if (!list) return;

  if (!objects.length) {
    list.innerHTML = `<div class="empty-state">Объекты не найдены</div>`;
    return;
  }

  list.innerHTML = objects.map(renderMapObjectCard).join('');
}
