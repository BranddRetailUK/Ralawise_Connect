// frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
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

  document.querySelector('.sync-trigger')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.sync-trigger');
  const badge = document.getElementById('sync-badge');
  const shop = new URLSearchParams(window.location.search).get('shop');
  if (!shop) return alert('Missing shop in URL');

  // 🔄 Show syncing state
  btn.disabled = true;
  btn.classList.add('opacity-50', 'cursor-wait');
  badge.classList.remove('hidden');

  try {
    const res = await fetch('/api/generate-sku-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop }),
    });

    const data = await res.json();

    if (res.ok) {
      alert(`✅ ${data.inserted} SKUs mapped. Starting sync...`);
      await fetch(`/api/sync?shop=${shop}`);
      alert(`✅ Sync complete.`);
    } else {
      console.error(data);
      alert('❌ Failed to generate SKU map: ' + data.error);
    }
  } catch (err) {
    console.error('❌ Sync error:', err);
    alert('❌ Failed to start sync');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-wait');
    badge.classList.add('hidden');
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

  async function loadCollections() {
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    if (!shop) return;

    try {
      const res = await fetch(`/api/collections?shop=${shop}`, {
        cache: "no-store"
      });
      const data = await res.json();

      console.log("📦 Collection data:", data);

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

  // Default tab
  setTimeout(() => {
    const defaultBtn = document.querySelector('.tab-btn[data-tab="products"]');
    if (defaultBtn) defaultBtn.click();
  }, 0);

  // Load top bar stats
  loadDashboardStats();
});
