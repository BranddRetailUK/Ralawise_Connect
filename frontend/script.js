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
      const card = document.createElement('div');
      card.className = 'rounded-lg border p-3 flex flex-col items-center text-center shadow';

      const img = document.createElement('img');
      img.src = product.image || 'https://via.placeholder.com/200';
      img.alt = product.title;
      img.className = 'w-full max-w-[150px] object-cover rounded mb-2';

      const title = document.createElement('h3');
      title.className = 'text-sm font-semibold';
      title.textContent = product.title;

      const variants = document.createElement('p');
      variants.className = 'text-xs text-gray-500';
      variants.textContent = `${product.variants} variant(s)`;

      card.appendChild(img);
      card.appendChild(title);
      card.appendChild(variants);
      container.appendChild(card);
    });
  }

  // Default tab (deferred to ensure DOM is ready)
  setTimeout(() => {
    const defaultBtn = document.querySelector('.tab-btn[data-tab="products"]');
    if (defaultBtn) defaultBtn.click();
  }, 0);
});
