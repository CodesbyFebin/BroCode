'use strict';
(async () => {
  const search = document.getElementById('muze-search');
  const shortlist = document.getElementById('muze-shortlist');
  const results = document.getElementById('muze-results');
  const count = document.getElementById('muze-count');

  try {
    const response = await fetch('/muze/atlas.json');
    if (!response.ok) throw new Error('Catalog unavailable');
    const rows = await response.json();
    function render() {
      const query = search.value.trim().toLowerCase();
      const pool = shortlist.checked ? rows.slice(0, 100) : rows;
      const matches = pool.filter(row => row.join(' ').toLowerCase().includes(query));
      results.replaceChildren(...matches.map(([name, category]) => {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = name;
        item.append(title, document.createElement('br'), category);
        return item;
      }));
      count.textContent = `${matches.length} of ${pool.length} sample entries`;
    }
    search.addEventListener('input', render);
    shortlist.addEventListener('change', render);
    render();
  } catch {
    count.textContent = 'Sample catalog unavailable. Reload to retry.';
  }
})();
