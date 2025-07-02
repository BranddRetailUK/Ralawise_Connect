console.log('🟢 script.js loaded');

const params = new URLSearchParams(window.location.search);
const shop = params.get('shop');
const host = params.get('host');

// Initialize Shopify App Bridge (only inside Shopify)
if (window['app-bridge']) {
  const AppBridge = window['app-bridge'];
  const createApp = AppBridge.default;
  const app = createApp({
    apiKey: 'YOUR_API_KEY', // will be injected dynamically later
    host,
    forceRedirect: true
  });
}

// 🔁 Sync Button
document.querySelectorAll('.sync-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/sync?shop=${shop}`);
      const data = await res.json();
      alert(data.message || '✅ Sync triggered');
    } catch (err) {
      alert('❌ Sync failed. See console for details.');
      console.error(err);
    }
  });
});

// 📦 Load Products
async function loadProducts() {
  try {
    const res = await fetch(`http://localhost:3001/api/products?shop=${shop}`);
    const data = await res.json();
    const tableBody = document.querySelector('#productTable tbody');

    if (!data.products || !Array.isArray(data.products)) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No products found.</td></tr>';
      return;
    }

    tableBody.innerHTML = ''; // Clear existing rows
    data.products.forEach(product => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="px-4 py-3 flex items-center gap-3">
          <img src="${product.image || 'https://via.placeholder.com/40'}" alt="Product" class="w-10 h-10 rounded border" />
          <span>${product.title}</span>
        </td>
        <td class="px-4 py-3">${product.variants}</td>
        <td class="px-4 py-3">
          <span class="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">Synced</span>
        </td>
        <td class="px-4 py-3">${new Date(product.updated_at).toLocaleString()}</td>
        <td class="px-4 py-3 text-right">
          <button class="text-sm text-blue-600 hover:underline">Resync</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    console.error('❌ Failed to load products:', err);
  }
}

// 🧭 Tab Switching
const tabs = document.querySelectorAll('.tab-btn');
const pages = document.querySelectorAll('.tab-page');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    tabs.forEach(t => {
      t.classList.remove('bg-black', 'text-white');
      t.classList.add('bg-gray-200', 'text-black');
    });

    btn.classList.remove('bg-gray-200', 'text-black');
    btn.classList.add('bg-black', 'text-white');

    pages.forEach(page => page.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');

    if (tab === 'products') loadProducts();
  });
});

// 🔃 Load products on first load if already on tab
if (document.getElementById('tab-products')?.classList.contains('hidden') === false) {
  loadProducts();
}
