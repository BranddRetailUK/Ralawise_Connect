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

// Global Sync Button(s)
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

// Tab Switching Logic
const tabs = document.querySelectorAll('.tab-btn');
const pages = document.querySelectorAll('.tab-page');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    // Reset all tab button styles
    tabs.forEach(t => {
      t.classList.remove('bg-black', 'text-white');
      t.classList.add('bg-gray-200', 'text-black');
    });

    // Style active tab button
    btn.classList.remove('bg-gray-200', 'text-black');
    btn.classList.add('bg-black', 'text-white');

    // Toggle visible content
    pages.forEach(page => page.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
  });
});
