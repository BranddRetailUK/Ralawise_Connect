// frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPages = document.querySelectorAll('.tab-page');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;

      // Toggle tab page visibility
      tabPages.forEach(page => page.classList.add('hidden'));
      document.getElementById(`tab-${tab}`).classList.remove('hidden');

      // Toggle button styles
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
    });
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

  // Default tab (deferred to ensure DOM is ready)
  setTimeout(() => {
    const defaultBtn = document.querySelector('.tab-btn[data-tab="products"]');
    if (defaultBtn) defaultBtn.click();
  }, 0);
});
