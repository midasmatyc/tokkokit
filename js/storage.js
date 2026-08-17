/**
 * Storage Abstraction Layer (storage.js)
 * Manages localStorage reading, writing, debounced autosaving, and backup JSON export/import.
 */

const STORAGE_PREFIX = 'tokkokit_';

const DEFAULT_SHOP_PROFILE = {
  shopName: 'Toko Saya Fashion',
  waNumber: '+6281234567890',
  logoBase64: null,
  address: 'Jl. Melati No. 5, Yogyakarta',
  defaultTaxPercent: 0,
  defaultShippingFee: 15000,
  defaultShippingType: 'flat',
  bankAccounts: [
    { bank: 'BCA', holder: 'Sari P.', number: '4560-1244-95' },
    { bank: 'Mandiri', holder: 'Sari P.', number: '137-00-1122-33' }
  ],
  thankYouMessage: 'Terima kasih sudah berbelanja di toko kami! 🙏'
};

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_001',
    title: 'Closing – Terima Kasih',
    category: 'Closing Scripts',
    body: 'Halo {{nama}}, terima kasih sudah order! Total belanjaan kamu {{total}}. Ditunggu konfirmasi pembayarannya ya! 🙏',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_002',
    title: 'Follow Up Pembayaran',
    category: 'Closing Scripts',
    body: 'Halo {{nama}}, sekadar menginfokan pesananmu sebesar {{total}} masih menunggu pembayaran nih. Mau dikirim hari ini? 😊',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_003',
    title: 'Notifikasi Pengiriman',
    category: 'Shipping Notices',
    body: 'Halo {{nama}}, pesananmu sudah dikirim hari ini ya! 🚚 Terima kasih telah berbelanja.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_SETTINGS = {
  tier: 'unactivated', // "unactivated" | "basic" | "pro"
  licenseKey: null,
  lastValidatedAt: null,
  uiLanguage: 'id'
};

let autosaveTimeout = null;

export const Storage = {
  init() {
    if (!this.get('shopProfile')) {
      this.set('shopProfile', DEFAULT_SHOP_PROFILE);
    }
    if (!this.get('templates')) {
      this.set('templates', DEFAULT_TEMPLATES);
    }
    if (!this.get('invoices')) {
      this.set('invoices', []);
    }
    if (!this.get('orders')) {
      this.set('orders', []);
    }
    if (!this.get('settings')) {
      this.set('settings', DEFAULT_SETTINGS);
    }
  },

  get(key) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error(`[Storage.get] Error reading key "${key}":`, e);
      return null;
    }
  },

  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(STORAGE_PREFIX + key, serialized);
      this._triggerAutosaveIndicator();
      return true;
    } catch (e) {
      console.error(`[Storage.set] Error writing key "${key}":`, e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      this._triggerAutosaveIndicator();
      return true;
    } catch (e) {
      console.error(`[Storage.remove] Error removing key "${key}":`, e);
      return false;
    }
  },

  exportAll() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shopProfile: this.get('shopProfile'),
      invoices: this.get('invoices'),
      templates: this.get('templates'),
      orders: this.get('orders'),
      settings: this.get('settings')
    };
    return JSON.stringify(data, null, 2);
  },

  importAll(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Invalid JSON format');

      if (data.shopProfile) this.set('shopProfile', data.shopProfile);
      if (data.invoices) this.set('invoices', data.invoices);
      if (data.templates) this.set('templates', data.templates);
      if (data.orders) this.set('orders', data.orders);
      if (data.settings) this.set('settings', data.settings);

      return { success: true, message: 'Data berhasil diimport!' };
    } catch (e) {
      return { success: false, message: 'Gagal mengimport data: ' + e.message };
    }
  },

  _triggerAutosaveIndicator() {
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    const indicator = document.getElementById('autosave-indicator');
    if (indicator) {
      indicator.classList.remove('hidden', 'opacity-0');
      indicator.classList.add('opacity-100');

      autosaveTimeout = setTimeout(() => {
        indicator.classList.remove('opacity-100');
        indicator.classList.add('opacity-0');
        setTimeout(() => indicator.classList.add('hidden'), 300);
      }, 1500);
    }
  }
};

// Initialize Storage on module import
Storage.init();
