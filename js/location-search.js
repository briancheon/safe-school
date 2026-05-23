// Kakao Places-powered location search input with autocomplete dropdown

export function initLocationSearch({ inputId, onSelect, placeholder }) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.placeholder = placeholder || '장소를 검색하세요';

  const dropdown = document.createElement('div');
  dropdown.className = 'location-dropdown';
  dropdown.setAttribute('role', 'listbox');
  input.parentNode.style.position = 'relative';
  input.parentNode.appendChild(dropdown);

  let _debounceTimer = null;
  let _selected = null;

  input.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    const q = input.value.trim();
    if (q.length < 2) { _hideDropdown(); return; }
    _debounceTimer = setTimeout(() => _search(q), 300);
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.location-dropdown__item');
    const active = dropdown.querySelector('.location-dropdown__item--active');
    let idx = Array.from(items).indexOf(active);
    if (e.key === 'ArrowDown') { e.preventDefault(); _activate(items, Math.min(idx + 1, items.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _activate(items, Math.max(idx - 1, 0)); }
    if (e.key === 'Enter' && active) { e.preventDefault(); active.click(); }
    if (e.key === 'Escape') _hideDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!input.parentNode.contains(e.target)) _hideDropdown();
  });

  function _search(keyword) {
    if (typeof kakao === 'undefined' || !kakao.maps || !kakao.maps.services) {
      _showManualFallback();
      return;
    }
    kakao.maps.load(() => {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(keyword, (results, status) => {
        if (status !== kakao.maps.services.Status.OK) { _hideDropdown(); return; }
        _renderResults(results.slice(0, 6));
      });
    });
  }

  function _renderResults(results) {
    dropdown.innerHTML = results.map((r, i) => `
      <div class="location-dropdown__item" role="option" data-idx="${i}"
           data-lat="${r.y}" data-lng="${r.x}"
           data-name="${_esc(r.place_name)}">
        <span class="location-dropdown__icon">📍</span>
        <div class="location-dropdown__info">
          <div class="location-dropdown__name">${_esc(r.place_name)}</div>
          <div class="location-dropdown__addr">${_esc(r.road_address_name || r.address_name)}</div>
        </div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.location-dropdown__item').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.name;
        const lat  = parseFloat(item.dataset.lat);
        const lng  = parseFloat(item.dataset.lng);
        input.value = name;
        _selected = { name, lat, lng };
        _hideDropdown();
        onSelect && onSelect(_selected);
      });
    });

    dropdown.classList.add('open');
  }

  function _activate(items, idx) {
    items.forEach(el => el.classList.remove('location-dropdown__item--active'));
    if (items[idx]) items[idx].classList.add('location-dropdown__item--active');
  }

  function _hideDropdown() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
  }

  function _showManualFallback() {
    dropdown.innerHTML = `
      <div class="location-dropdown__fallback">
        지도 API가 준비되지 않았습니다.<br>
        주소를 직접 입력 후 계속하세요.
      </div>
    `;
    dropdown.classList.add('open');
  }

  function _esc(str) {
    return String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    getSelected: () => _selected,
    setValue: (name, lat, lng) => {
      input.value = name;
      _selected = { name, lat, lng };
    },
  };
}
