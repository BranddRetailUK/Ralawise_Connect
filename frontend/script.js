// frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
  let matchedSKUs = [];

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPages = document.querySelectorAll('.tab-page');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;

      tabPages.forEach(page => page.classList.add('hidden'));
      document.getElementById(`tab-${tab}`).classList.remove('hidden');

      tabButtons.forEach(btn => {
        btn.classList.remove('bg-black', 'text-white');
        btn.classList.add('bg-gray-200', 'text-black');
      });
      button.classList.remove('bg-gray-200', 'text-black');
      button.classList.add('bg-black', 'text-white');

      if (tab === 'sync') {
        loadSyncLogs();
        startLiveLogPolling();
      } else {
        stopLiveLogPolling();
      }

      if (tab === 'products') {
        loadProducts();
      }

      if (tab === 'collections') {
        loadCollections();
      }
    });
  });

  // Sync Button Logic
  document.querySelector('.sync-trigger')?.addEventListener('click', async () => {
    const shop = new URLSearchParams(window.location.search).get('shop');
    if (!shop) return;

    const button = document.querySelector('.sync-trigger');
    const span = button.querySelector('span');
    let progressBar = button.querySelector('.progress-bar');

    if (progressBar) progressBar.remove();

    progressBar = document.createElement('div');
    progressBar.classList.add('progress-bar');
    button.prepend(progressBar);

    button.classList.remove('bg-black', 'text-white', 'bg-green-600');
    button.classList.add('syncing');
    span.textContent = 'Syncing...';

    try {
      const res = await fetch('/api/generate-sku-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      });

      const data = await res.json();

      if (res.ok) {
        await fetch(`/api/sync?shop=${shop}`);
        span.textContent = 'Synced ✅';

        setTimeout(() => {
          button.classList.remove('syncing', 'bg-green-600');
          button.classList.add('bg-black', 'text-white');
          span.textContent = 'Start Sync';
        }, 3000);
      } else {
        console.error(data);
        button.classList.remove('syncing');
        button.classList.add('bg-black', 'text-white');
        span.textContent = 'Start Sync';
      }
    } catch (err) {
      console.error('❌ Sync error:', err);
      button.classList.remove('syncing');
      button.classList.add('bg-black', 'text-white');
      span.textContent = 'Start Sync';
    }
  });

  let logPoller = null;

  function startLiveLogPolling() {
    if (logPoller) return;
    logPoller = setInterval(async () => {
      try {
        const res = await fetch('/api/live-logs');
        const { logs } = await res.json();
        const list = document.getElementById('live-log-list');
        list.innerHTML = '';
        logs.forEach(line => {
          const li = document.createElement('li');
          li.className = 'text-sm text-gray-700';
          li.textContent = line;
          list.appendChild(li);
        });
      } catch (err) {
        console.error('❌ Failed to fetch live logs:', err);
      }
    }, 1000);
  }

  function stopLiveLogPolling() {
    if (logPoller) {
      clearInterval(logPoller);
      logPoller = null;
    }
  }

  async function loadSyncLogs() {
    try {
      const res = await fetch('/api/sync-logs');
      const data = await res.json();
      const list = document.getElementById('sync-log-list');
      const lastSync = document.getElementById('last-sync-time');

      list.innerHTML = '';

      if (data.logs.length > 0) {
        const timestamp = new Date(data.logs[0].time).toLocaleString();
        lastSync.textContent = timestamp;
      }

      data.logs.forEach(log => {
        const li = document.createElement('li');
        if (log.status === 'success') {
          li.innerHTML = `<span class="text-green-600">✅</span> ${log.sku} synced (Qty ${log.quantity})`;
        } else {
          li.innerHTML = `<span class="text-red-600">❌</span> Failed to sync ${log.sku}: ${log.error}`;
        }
        list.appendChild(li);
      });
    } catch (err) {
      console.error('❌ Failed to load sync logs:', err);
    }
  }

  async function loadProducts() {
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    if (!shop) return;

    const res = await fetch(`/api/products?shop=${shop}`);
    const data = await res.json();
    const container = document.getElementById('product-grid');
    container.innerHTML = '';

    data.products.forEach(product => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-4 border rounded px-4 py-3 bg-white shadow-sm';

      const left = document.createElement('div');
      left.className = 'flex items-center gap-4';

      const img = document.createElement('img');
      img.src = product.image || 'https://placehold.co/80x80?text=No+Image';
      img.alt = product.title || 'Product image';
      img.className = 'w-12 h-12 object-cover rounded border';
      img.onerror = () => {
        img.src = 'https://placehold.co/80x80?text=No+Image';
      };

      const info = document.createElement('div');
      info.innerHTML = `
        <div class="text-sm font-semibold text-gray-900">${product.title}</div>
        <div class="text-xs text-gray-500">${product.variants} variant(s)</div>
      `;

      left.appendChild(img);
      left.appendChild(info);
      row.appendChild(left);

      container.appendChild(row);
    });
  }

  // === SKU Match Upload Logic ===
  const matchForm = document.getElementById('sku-match-form');
  if (matchForm) {
    matchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('match-file');
      const resultsContainer = document.getElementById('sku-match-results');

      if (!fileInput.files.length) return;

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);

      resultsContainer.innerHTML = '⏳ Matching...';

      try {
        const res = await fetch('/api/match-skus', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (!Array.isArray(data)) throw new Error('Unexpected response');

        matchedSKUs = data;

        resultsContainer.innerHTML = '';
        data.forEach(row => {
          const div = document.createElement('div');
          div.className = 'border rounded p-2 bg-gray-50';

          div.innerHTML = `
            <div><strong>${row.handle || '[No Handle]'}</strong></div>
            <div>Original SKU: ${row.original_sku || '–'}</div>
            <div>Suggested: <span class="font-semibold">${row.suggested_sku || '❌ No Match'}</span></div>
            <div>Confidence: <span class="${row.confidence === 'high' ? 'text-green-600' : 'text-yellow-600'}">${row.confidence}</span></div>
            <div class="text-xs text-gray-500">${row.reason}</div>
          `;

          resultsContainer.appendChild(div);
        });

        const updateBtn = document.getElementById('updateBtn');
        updateBtn.disabled = false;
        updateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        updateBtn.classList.add('bg-green-600', 'hover:bg-green-700');
      } catch (err) {
        console.error('❌ Match failed:', err);
        resultsContainer.innerHTML = '<p class="text-red-600">Failed to match SKUs.</p>';
      }
    });
  }

  document.getElementById('updateBtn')?.addEventListener('click', async () => {
    const shop = new URLSearchParams(window.location.search).get('shop');
    if (!matchedSKUs.length || !shop) return alert("No matched SKUs or shop ID.");

    const res = await fetch('/api/update-skus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches: matchedSKUs, shop }),
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.updated} SKUs updated!`);
    } else {
      alert('❌ Failed to update SKUs. Check logs.');
    }
  });

  async function loadCollections() {
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    if (!shop) return;

    try {
      const res = await fetch(`/api/collections?shop=${shop}`, {
        cache: "no-store"
      });
      const data = await res.json();

      const container = document.getElementById('collections-grid');
      container.innerHTML = '';

      if (!data.collections?.length) {
        container.innerHTML = '<p class="text-gray-500 col-span-full">No collections found.</p>';
        return;
      }

      data.collections.forEach(col => {
        const div = document.createElement('div');
        div.className = 'bg-white shadow rounded p-4';

        div.innerHTML = `
          <div class="flex items-center gap-4">
            <img src="${col.image || 'https://placehold.co/80x80?text=No+Image'}" class="w-16 h-16 object-cover rounded border" alt="Collection image" />
            <div>
              <a href="https://${shop}/collections/${col.handle}" target="_blank" class="text-sm font-semibold text-blue-600 hover:underline">
                ${col.title}
              </a>
              <div class="text-xs text-gray-500">${col.product_count} product(s)</div>
            </div>
          </div>
        `;

        container.appendChild(div);
      });
    } catch (err) {
      console.error('❌ Failed to load collections:', err);
    }
  }

  async function loadDashboardStats() {
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    if (!shop) return;

    try {
      const res = await fetch(`/api/dashboard-stats?shop=${shop}`);
      const stats = await res.json();

      document.getElementById('stat-products').textContent = stats.products ?? '–';
      document.getElementById('stat-collections').textContent = stats.collections ?? '–';
      document.getElementById('stat-errors').textContent = stats.sync_errors ?? '–';
      document.getElementById('stat-skus').textContent = stats.mapped_skus ?? '–';
    } catch (err) {
      console.error('❌ Failed to load dashboard stats:', err);
    }
  }

  // Default tab load
  setTimeout(() => {
    const defaultBtn = document.querySelector('.tab-btn[data-tab="products"]');
    if (defaultBtn) defaultBtn.click();
  }, 0);

  loadDashboardStats();
});
