export function initLocationSearch({ inputId, onSelect, placeholder }) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.placeholder = placeholder || '장소를 검색하세요';
  input.setAttribute('autocomplete', 'off');

  // Wrap input so we can position the dropdown relative to it
  const wrap = input.parentNode;
  wrap.style.position = 'relative';

  const dropdown = document.createElement('ul');
  dropdown.className = 'loc-dropdown';
  dropdown.setAttribute('role', 'listbox');
  wrap.appendChild(dropdown);

  let _debounceTimer = null;
  let _selected = null;
  let _ps = null; // kakao.maps.services.Places instance

  function _getPlaces() {
    if (_ps) return Promise.resolve(_ps);
    return new Promise((resolve, reject) => {
      if (typeof kakao === 'undefined') { reject('no kakao'); return; }
      kakao.maps.load(() => {
        if (!kakao.maps.services) { reject('no services'); return; }
        _ps = new kakao.maps.services.Places();
        resolve(_ps);
      });
    });
  }

  input.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    const q = input.value.trim();
    if (!q || q.length < 1) { _close(); return; }
    _debounceTimer = setTimeout(() => _search(q), 250);
  });

  input.addEventListener('keydown', (e) => {
    const items = [...dropdown.querySelectorAll('.loc-dropdown__item')];
    const idx = items.findIndex(el => el.classList.contains('loc-dropdown__item--active'));
    if (e.key === 'ArrowDown') { e.preventDefault(); _activate(items, Math.min(idx + 1, items.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _activate(items, Math.max(idx - 1, 0)); }
    if (e.key === 'Enter') {
      const active = items.find(el => el.classList.contains('loc-dropdown__item--active'));
      if (active) { e.preventDefault(); _pick(active); }
    }
    if (e.key === 'Escape') _close();
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) _close();
  });

  async function _search(keyword) {
    try {
      const ps = await _getPlaces();
      ps.keywordSearch(keyword, (results, status) => {
        if (status !== kakao.maps.services.Status.OK || !results.length) {
          _showEmpty();
          return;
        }
        _render(results.slice(0, 8));
      });
    } catch {
      _showFallback();
    }
  }

  function _render(results) {
    dropdown.innerHTML = '';
    results.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'loc-dropdown__item';
      li.setAttribute('role', 'option');
      li.dataset.lat  = r.y;
      li.dataset.lng  = r.x;
      li.dataset.name = r.place_name;
      li.innerHTML = `
        <span class="loc-dropdown__pin">📍</span>
        <span class="loc-dropdown__text">
          <span class="loc-dropdown__name">${_esc(r.place_name)}</span>
          <span class="loc-dropdown__addr">${_esc(r.road_address_name || r.address_name || '')}</span>
        </span>
        <span class="loc-dropdown__category">${_esc(_shortCategory(r.category_name))}</span>
      `;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); _pick(li); });
      dropdown.appendChild(li);
    });
    dropdown.classList.add('open');
  }

  function _pick(li) {
    const name = li.dataset.name;
    const lat  = parseFloat(li.dataset.lat);
    const lng  = parseFloat(li.dataset.lng);
    input.value = name;
    _selected = { name, lat, lng };
    _close();
    onSelect?.(_selected);
  }

  function _activate(items, idx) {
    items.forEach(el => el.classList.remove('loc-dropdown__item--active'));
    if (items[idx]) { items[idx].classList.add('loc-dropdown__item--active'); }
  }

  function _showEmpty() {
    dropdown.innerHTML = `<li class="loc-dropdown__empty">검색 결과가 없습니다</li>`;
    dropdown.classList.add('open');
  }

  function _showFallback() {
    dropdown.innerHTML = `<li class="loc-dropdown__empty">지도 서비스 연결 중… 잠시 후 다시 시도하세요</li>`;
    dropdown.classList.add('open');
  }

  function _close() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
  }

  function _shortCategory(cat) {
    if (!cat) return '';
    const last = cat.split('>').pop().trim();
    return last.length > 8 ? last.slice(0, 8) + '…' : last;
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return {
    getSelected: () => _selected,
    setValue(name, lat, lng) {
      input.value = name;
      _selected = { name, lat, lng };
    },
  };
}
