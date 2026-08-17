/**
 * Main Application Controller (app.js)
 * Coordinates SPA navigation router, activation gate, module renderers, modals, print setup, and toast notifications.
 */

import { Storage } from './storage.js';
import { LicenseManager } from './license.js';
import { InvoiceModule } from './modules/invoice.js';
import { TemplatesModule } from './modules/templates.js';
import { OrdersModule } from './modules/orders.js';
import { ShippingModule } from './modules/shipping.js';

class AppController {
  constructor() {
    this.currentView = 'invoice';
    this.currentInvoiceState = null;
    this.activeTemplateCategory = 'All';
    this.activeOrderStatusFilter = 'All';
  }

  async init() {
    console.log('[TokkoKit] Initializing app...');
    
    // Check url key activation
    await LicenseManager.checkUrlActivation();

    // Check activation state
    this.renderActivationGate();

    // Init modules
    await ShippingModule.init();

    // Setup event bindings
    this.bindNavigation();
    this.bindActivationGate();
    this.bindSettingsModal();
    this.bindInvoiceEvents();
    this.bindTemplateEvents();
    this.bindOrderEvents();
    this.bindShippingEvents();

    // Initialize invoice state
    this.currentInvoiceState = InvoiceModule.createNewInvoiceState();
    
    // Initial Render
    this.renderCurrentView();
    this.updateHeaderAndSettings();
  }

  // --- Toast Manager ---
  showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    toast.innerHTML = `
      <span>${isError ? '⚠️' : '✅'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- Activation Gate Router ---
  renderActivationGate() {
    const gate = document.getElementById('activation-gate');
    const appShell = document.getElementById('app-shell');

    if (!LicenseManager.isActivated()) {
      gate.classList.remove('hidden');
      appShell.classList.add('hidden');
    } else {
      gate.classList.add('hidden');
      appShell.classList.remove('hidden');
    }
  }

  bindActivationGate() {
    const btn = document.getElementById('btn-activate-key');
    const input = document.getElementById('activation-key-input');
    const errorAlert = document.getElementById('activation-error-msg');

    if (btn && input) {
      btn.addEventListener('click', async () => {
        const key = input.value;
        const res = await LicenseManager.validateKey(key);
        if (res.success) {
          if (errorAlert) errorAlert.classList.add('hidden');
          this.showToast(res.message);
          this.renderActivationGate();
          this.updateHeaderAndSettings();
          this.renderCurrentView();
        } else {
          if (errorAlert) {
            errorAlert.textContent = res.message;
            errorAlert.classList.remove('hidden');
          }
        }
      });
    }
  }

  // --- Header & Settings ---
  updateHeaderAndSettings() {
    const shop = Storage.get('shopProfile') || {};
    const tier = LicenseManager.getTier();

    const shopNameHeader = document.getElementById('header-shop-name');
    if (shopNameHeader) shopNameHeader.textContent = shop.shopName || 'TokkoKit';

    const tierBadge = document.getElementById('header-tier-badge');
    if (tierBadge) {
      tierBadge.textContent = tier.toUpperCase();
      if (tier === 'pro') {
        tierBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300';
      } else {
        tierBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200';
      }
    }
  }

  bindSettingsModal() {
    const openBtn = document.getElementById('btn-open-settings');
    const closeBtn = document.getElementById('btn-close-settings');
    const modal = document.getElementById('settings-modal');
    const form = document.getElementById('settings-form');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        this.loadSettingsForm();
        modal.classList.remove('hidden');
      });
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const shop = Storage.get('shopProfile') || {};
        shop.shopName = document.getElementById('set-shop-name').value;
        shop.waNumber = document.getElementById('set-wa-number').value;
        shop.address = document.getElementById('set-address').value;
        shop.defaultTaxPercent = parseFloat(document.getElementById('set-tax').value) || 0;
        shop.defaultShippingFee = parseFloat(document.getElementById('set-shipping').value) || 0;
        shop.thankYouMessage = document.getElementById('set-thankyou').value;

        // Bank Accounts
        const bankText = document.getElementById('set-banks').value;
        const bankLines = bankText.split('\n').filter(l => l.trim());
        shop.bankAccounts = bankLines.map(line => {
          const parts = line.split('|');
          return {
            bank: (parts[0] || 'Bank').trim(),
            holder: (parts[1] || 'Toko').trim(),
            number: (parts[2] || '').trim()
          };
        });

        Storage.set('shopProfile', shop);
        this.updateHeaderAndSettings();
        this.renderInvoiceModule();
        modal.classList.add('hidden');
        this.showToast('Pengaturan toko berhasil disimpan');
      });
    }

    // Export Backup
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = Storage.exportAll();
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TokkoKit_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Backup data berhasil diunduh');
      });
    }

    // Import Backup
    const importInput = document.getElementById('input-import-backup');
    if (importInput) {
      importInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
          const res = Storage.importAll(event.target.result);
          if (res.success) {
            this.showToast(res.message);
            this.updateHeaderAndSettings();
            this.renderCurrentView();
          } else {
            this.showToast(res.message, true);
          }
        };
        reader.readAsText(file);
      });
    }

    // Reset License / Deactivate
    const deactivateBtn = document.getElementById('btn-deactivate-license');
    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', () => {
        if (confirm('Yakin ingin keluar dari lisensi saat ini?')) {
          LicenseManager.deactivate();
          if (modal) modal.classList.add('hidden');
          this.renderActivationGate();
          this.showToast('Lisensi dinonaktifkan');
        }
      });
    }
  }

  loadSettingsForm() {
    const shop = Storage.get('shopProfile') || {};
    const settings = Storage.get('settings') || {};

    document.getElementById('set-shop-name').value = shop.shopName || '';
    document.getElementById('set-wa-number').value = shop.waNumber || '';
    document.getElementById('set-address').value = shop.address || '';
    document.getElementById('set-tax').value = shop.defaultTaxPercent || 0;
    document.getElementById('set-shipping').value = shop.defaultShippingFee || 0;
    document.getElementById('set-thankyou').value = shop.thankYouMessage || '';

    const banks = shop.bankAccounts || [];
    document.getElementById('set-banks').value = banks.map(b => `${b.bank} | ${b.holder} | ${b.number}`).join('\n');

    document.getElementById('set-license-key').textContent = settings.licenseKey || 'N/A';
    document.getElementById('set-tier-name').textContent = (settings.tier || 'unactivated').toUpperCase();
  }

  // --- Navigation & View Switcher ---
  bindNavigation() {
    const navItems = document.querySelectorAll('[data-target-view]');
    navItems.forEach(el => {
      el.addEventListener('click', () => {
        const target = el.getAttribute('data-target-view');
        this.switchView(target);
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => v.classList.add('hidden'));

    const activeView = document.getElementById(`view-${viewName}`);
    if (activeView) activeView.classList.remove('hidden');

    // Update active nav styling
    const navItems = document.querySelectorAll('[data-target-view]');
    navItems.forEach(el => {
      const target = el.getAttribute('data-target-view');
      if (target === viewName) {
        el.classList.add('text-indigo-600', 'border-indigo-600', 'bg-indigo-50/80', 'font-bold');
        el.classList.remove('text-slate-600', 'border-transparent');
      } else {
        el.classList.remove('text-indigo-600', 'border-indigo-600', 'bg-indigo-50/80', 'font-bold');
        el.classList.add('text-slate-600', 'border-transparent');
      }
    });

    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'invoice':
        this.renderInvoiceModule();
        break;
      case 'templates':
        this.renderTemplatesModule();
        break;
      case 'orders':
        this.renderOrdersModule();
        break;
      case 'shipping':
        this.renderShippingModule();
        break;
    }
  }

  // --- MODULE 1: INVOICE (NOTA) ---
  bindInvoiceEvents() {
    // Regular / Dropship toggle
    const typeRegular = document.getElementById('inv-type-regular');
    const typeDropship = document.getElementById('inv-type-dropship');

    if (typeRegular && typeDropship) {
      typeRegular.addEventListener('change', () => {
        this.currentInvoiceState.orderType = 'regular';
        this.updateInvoicePreview();
      });
      typeDropship.addEventListener('change', () => {
        this.currentInvoiceState.orderType = 'dropship';
        this.updateInvoicePreview();
      });
    }

    // Status Pill
    const statusSelect = document.getElementById('inv-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', e => {
        this.currentInvoiceState.status = e.target.value;
        this.updateInvoicePreview();
      });
    }

    // Input fields binding
    const bindInput = (id, prop) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', e => {
          this.currentInvoiceState[prop] = e.target.value;
          this.updateInvoicePreview();
        });
      }
    };

    bindInput('inv-cust-name', 'customerName');
    bindInput('inv-cust-phone', 'customerPhone');
    bindInput('inv-cust-address', 'customerAddress');
    bindInput('inv-payment-method', 'paymentMethod');
    bindInput('inv-tax-percent', 'taxPercent');
    bindInput('inv-shipping-fee', 'shipping');
    bindInput('inv-note', 'note');

    // Add item row
    const addRowBtn = document.getElementById('btn-add-item-row');
    if (addRowBtn) {
      addRowBtn.addEventListener('click', () => {
        this.currentInvoiceState.items.push({ name: '', qty: 1, price: 0 });
        this.renderItemRows();
        this.updateInvoicePreview();
      });
    }

    // New invoice reset button
    const resetBtn = document.getElementById('btn-new-invoice');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentInvoiceState = InvoiceModule.createNewInvoiceState();
        this.loadInvoiceStateToForm();
        this.updateInvoicePreview();
        this.showToast('Nota baru siap dibuat');
      });
    }

    // Salin ke WhatsApp action
    const copyWaBtn = document.getElementById('btn-copy-whatsapp');
    if (copyWaBtn) {
      copyWaBtn.addEventListener('click', () => {
        InvoiceModule.saveInvoice(this.currentInvoiceState);
        const text = InvoiceModule.generateWhatsAppText(this.currentInvoiceState);
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('Teks nota berhasil disalin ke WhatsApp!');
        }).catch(err => {
          this.showToast('Gagal menyalin teks: ' + err, true);
        });
      });
    }

    // Print action
    const printBtn = document.getElementById('btn-print-receipt');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        InvoiceModule.saveInvoice(this.currentInvoiceState);
        const paperSize = document.getElementById('select-paper-size')?.value || '58mm';

        document.body.classList.remove('print-size-58mm', 'print-size-80mm', 'print-size-a4');
        document.body.classList.add(`print-size-${paperSize}`);

        const printableArea = document.getElementById('printable-area');
        if (printableArea) {
          printableArea.innerHTML = InvoiceModule.generateReceiptHTML(this.currentInvoiceState);
        }
        window.print();
      });
    }

    // Export Image (Pro)
    const exportImgBtn = document.getElementById('btn-export-image');
    if (exportImgBtn) {
      exportImgBtn.addEventListener('click', async () => {
        InvoiceModule.saveInvoice(this.currentInvoiceState);
        const targetEl = document.getElementById('receipt-preview-content');
        if (!targetEl) return;

        const res = await InvoiceModule.exportAsImage(this.currentInvoiceState, targetEl);
        if (res.success) {
          this.showToast(res.message);
        } else if (res.isProRequired) {
          this.showToast(res.message, true);
        } else {
          this.showToast(res.message, true);
        }
      });
    }
  }

  loadInvoiceStateToForm() {
    const s = this.currentInvoiceState;
    if (s.orderType === 'dropship') {
      document.getElementById('inv-type-dropship').checked = true;
    } else {
      document.getElementById('inv-type-regular').checked = true;
    }

    document.getElementById('inv-number-display').textContent = s.invoiceNumber;
    document.getElementById('inv-status-select').value = s.status || 'pending';
    document.getElementById('inv-cust-name').value = s.customerName || '';
    document.getElementById('inv-cust-phone').value = s.customerPhone || '';
    document.getElementById('inv-cust-address').value = s.customerAddress || '';
    document.getElementById('inv-payment-method').value = s.paymentMethod || 'Transfer';
    document.getElementById('inv-tax-percent').value = s.taxPercent || 0;
    document.getElementById('inv-shipping-fee').value = s.shipping || 0;
    document.getElementById('inv-note').value = s.note || '';

    this.renderItemRows();
  }

  renderItemRows() {
    const container = document.getElementById('item-rows-container');
    if (!container) return;

    container.innerHTML = '';

    this.currentInvoiceState.items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'grid grid-cols-12 gap-2 items-center text-sm';
      row.innerHTML = `
        <div class="col-span-5">
          <input type="text" placeholder="Nama Barang" value="${item.name || ''}" data-idx="${idx}" data-field="name" class="item-input w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600" />
        </div>
        <div class="col-span-2">
          <input type="number" placeholder="Qty" min="1" value="${item.qty || 1}" data-idx="${idx}" data-field="qty" class="item-input w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-center text-slate-800 focus:outline-none focus:border-indigo-600" />
        </div>
        <div class="col-span-4">
          <input type="number" placeholder="Harga (Rp)" min="0" value="${item.price || ''}" data-idx="${idx}" data-field="price" class="item-input w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600" />
        </div>
        <div class="col-span-1 text-right">
          ${this.currentInvoiceState.items.length > 1 ? `<button type="button" data-delete-idx="${idx}" class="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5">×</button>` : ''}
        </div>
      `;
      container.appendChild(row);
    });

    // Item row listeners
    container.querySelectorAll('.item-input').forEach(input => {
      input.addEventListener('input', e => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        const field = e.target.getAttribute('data-field');
        const val = e.target.value;

        if (field === 'qty') this.currentInvoiceState.items[idx].qty = parseInt(val) || 1;
        else if (field === 'price') this.currentInvoiceState.items[idx].price = parseFloat(val) || 0;
        else this.currentInvoiceState.items[idx].name = val;

        this.updateInvoicePreview();
      });
    });

    container.querySelectorAll('[data-delete-idx]').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.getAttribute('data-delete-idx'));
        this.currentInvoiceState.items.splice(idx, 1);
        this.renderItemRows();
        this.updateInvoicePreview();
      });
    });
  }

  updateInvoicePreview() {
    const totals = InvoiceModule.calculateInvoiceTotals(this.currentInvoiceState);

    // Update totals UI
    const subtotalEl = document.getElementById('calc-subtotal');
    const shippingEl = document.getElementById('calc-shipping');
    const grandTotalEl = document.getElementById('calc-total');

    if (subtotalEl) subtotalEl.textContent = InvoiceModule.formatRupiah(totals.subtotal);
    if (shippingEl) shippingEl.textContent = InvoiceModule.formatRupiah(totals.shipping);
    if (grandTotalEl) grandTotalEl.textContent = InvoiceModule.formatRupiah(totals.total);

    // Update Live Receipt Preview Box
    const previewContainer = document.getElementById('receipt-preview-box');
    if (previewContainer) {
      previewContainer.innerHTML = InvoiceModule.generateReceiptHTML(this.currentInvoiceState);
    }
  }

  renderInvoiceModule() {
    this.loadInvoiceStateToForm();
    this.updateInvoicePreview();
  }

  // --- MODULE 2: TEMPLATES ---
  bindTemplateEvents() {
    const searchInput = document.getElementById('tpl-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTemplatesModule());
    }

    const addBtn = document.getElementById('btn-add-template');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openTemplateModal());
    }

    const modal = document.getElementById('template-modal');
    const closeBtn = document.getElementById('btn-close-template-modal');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    const form = document.getElementById('template-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('tpl-id').value;
        const title = document.getElementById('tpl-title').value;
        const category = document.getElementById('tpl-category').value;
        const body = document.getElementById('tpl-body').value;

        TemplatesModule.saveTemplate({ id, title, category, body });
        if (modal) modal.classList.add('hidden');
        this.renderTemplatesModule();
        this.showToast('Template berhasil disimpan');
      });
    }
  }

  openTemplateModal(template = null) {
    const modal = document.getElementById('template-modal');
    if (!modal) return;

    document.getElementById('tpl-id').value = template ? template.id : '';
    document.getElementById('tpl-title').value = template ? template.title : '';
    document.getElementById('tpl-category').value = template ? template.category : 'Closing Scripts';
    document.getElementById('tpl-body').value = template ? template.body : '';

    modal.classList.remove('hidden');
  }

  renderTemplatesModule() {
    const container = document.getElementById('templates-list-container');
    const categoryTabs = document.getElementById('template-category-tabs');
    if (!container) return;

    const query = document.getElementById('tpl-search-input')?.value || '';
    const categories = ['All', ...TemplatesModule.getCategories()];

    // Render category chips
    if (categoryTabs) {
      categoryTabs.innerHTML = categories.map(cat => `
        <button type="button" data-cat="${cat}" class="px-3 py-1 text-xs font-semibold rounded-full border ${this.activeTemplateCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}">
          ${cat}
        </button>
      `).join('');

      categoryTabs.querySelectorAll('[data-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeTemplateCategory = btn.getAttribute('data-cat');
          this.renderTemplatesModule();
        });
      });
    }

    const templates = TemplatesModule.searchTemplates(query, this.activeTemplateCategory);

    if (templates.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-10 text-slate-500">
          <p>Belum ada template yang cocok.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = templates.map(tpl => {
      const processedText = TemplatesModule.processVariables(tpl.body, this.currentInvoiceState);
      return `
        <div class="glass-panel rounded-xl p-4 flex flex-col justify-between hover:border-indigo-300 transition-colors">
          <div>
            <div class="flex justify-between items-start mb-2">
              <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">${tpl.category}</span>
              <div class="flex gap-2">
                <button type="button" data-edit-tpl="${tpl.id}" class="text-xs text-slate-500 hover:text-slate-800">✎ Edit</button>
                <button type="button" data-del-tpl="${tpl.id}" class="text-xs text-rose-500 hover:text-rose-700">× Hapus</button>
              </div>
            </div>
            <h3 class="font-bold text-slate-900 mb-2">${tpl.title}</h3>
            <p class="text-xs text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono whitespace-pre-wrap leading-relaxed">${processedText}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button type="button" data-copy-tpl="${tpl.id}" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm">
              📋 Salin Chat
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind item actions
    container.querySelectorAll('[data-copy-tpl]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-copy-tpl');
        const tpl = templates.find(t => t.id === id);
        if (tpl) {
          const text = TemplatesModule.processVariables(tpl.body, this.currentInvoiceState);
          navigator.clipboard.writeText(text).then(() => {
            this.showToast('Template chat berhasil disalin!');
          });
        }
      });
    });

    container.querySelectorAll('[data-edit-tpl]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-tpl');
        const tpl = templates.find(t => t.id === id);
        if (tpl) this.openTemplateModal(tpl);
      });
    });

    container.querySelectorAll('[data-del-tpl]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-tpl');
        if (confirm('Hapus template ini?')) {
          TemplatesModule.deleteTemplate(id);
          this.renderTemplatesModule();
          this.showToast('Template dihapus');
        }
      });
    });
  }

  // --- MODULE 3: ORDERS (CRM) ---
  bindOrderEvents() {
    const searchInput = document.getElementById('order-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderOrdersModule());
    }

    const filterChips = document.querySelectorAll('[data-order-status-filter]');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.activeOrderStatusFilter = chip.getAttribute('data-order-status-filter');
        filterChips.forEach(c => c.classList.remove('bg-emerald-600', 'text-white'));
        chip.classList.add('bg-emerald-600', 'text-white');
        this.renderOrdersModule();
      });
    });
  }

  renderOrdersModule() {
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    const query = document.getElementById('order-search-input')?.value || '';
    const res = OrdersModule.getFilteredOrders(this.activeOrderStatusFilter, query);

    const isCappedNotice = document.getElementById('orders-capped-notice');
    if (isCappedNotice) {
      if (res.isCapped) {
        isCappedNotice.classList.remove('hidden');
        isCappedNotice.querySelector('.capped-count').textContent = res.cappedCount;
      } else {
        isCappedNotice.classList.add('hidden');
      }
    }

    if (res.orders.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 text-slate-500">
          <p>Belum ada pesanan terdaftar.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = res.orders.map(order => {
      const formattedTotal = InvoiceModule.formatRupiah(order.total);
      const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="glass-panel rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-slate-900 text-base">${order.customerName || 'Pelanggan'}</h3>
              <span class="text-xs text-slate-500 font-mono">#${order.invoiceNumber || 'ORD'}</span>
            </div>
            <div class="text-xs text-slate-600 flex items-center gap-3">
              <span class="font-semibold text-slate-800">💰 ${formattedTotal}</span>
              <span>📅 ${dateStr}</span>
              ${order.customerPhone ? `<span>📱 ${order.customerPhone}</span>` : ''}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <select data-order-status-select="${order.id}" class="bg-white text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-600">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ Pending (Belum Bayar)</option>
              <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>✅ Paid (Lunas)</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>🚚 Shipped (Dikirim)</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>🎉 Completed (Selesai)</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled (Batal)</option>
            </select>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-order-status-select]').forEach(select => {
      select.addEventListener('change', e => {
        const orderId = e.target.getAttribute('data-order-status-select');
        const newStatus = e.target.value;
        OrdersModule.updateOrderStatus(orderId, newStatus);
        this.showToast('Status pesanan diperbarui');
      });
    });
  }

  // --- MODULE 4: ONG KIR ---
  bindShippingEvents() {
    const btn = document.getElementById('btn-calc-shipping');
    if (btn) {
      btn.addEventListener('click', () => {
        const origin = document.getElementById('ship-origin').value;
        const dest = document.getElementById('ship-dest').value;
        const weight = parseInt(document.getElementById('ship-weight').value) || 0;

        const res = ShippingModule.calculateRates(origin, dest, weight);
        this.renderShippingResults(res);
      });
    }
  }

  renderShippingModule() {
    const originSelect = document.getElementById('ship-origin');
    const destSelect = document.getElementById('ship-dest');
    if (!originSelect || !destSelect) return;

    const zones = ShippingModule.getZones();
    const optionsHtml = zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');

    originSelect.innerHTML = optionsHtml;
    destSelect.innerHTML = optionsHtml;

    // Set defaults
    originSelect.value = 'yogyakarta';
    destSelect.value = 'jakarta';
  }

  renderShippingResults(res) {
    const container = document.getElementById('shipping-results-container');
    if (!container) return;

    if (!res.success) {
      container.innerHTML = `<div class="p-4 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-200 text-sm">${res.message}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-3">
        <div class="text-xs text-slate-500 flex justify-between items-center pb-2 border-b border-slate-200">
          <span>Berat dihitung: <strong>${res.weightKg} kg</strong></span>
          ${!res.isStaticData ? `<span class="text-amber-600">${res.fallbackMessage}</span>` : ''}
        </div>
        ${res.rates.map(r => `
          <div class="glass-panel p-4 rounded-xl flex justify-between items-center hover:border-indigo-300 transition-colors">
            <div>
              <div class="font-bold text-slate-900 text-sm">${r.courier}</div>
              <div class="text-xs text-slate-500">${r.service}</div>
            </div>
            <div class="font-mono font-bold text-indigo-600 text-base">
              ${InvoiceModule.formatRupiah(r.price)}
            </div>
          </div>
        `).join('')}
        <p class="text-[11px] text-slate-500 italic text-center pt-2">* Estimasi, bisa berbeda dari ongkir aktual courier</p>
      </div>
    `;
  }
}

// Instantiate and start app controller
window.addEventListener('DOMContentLoaded', () => {
  window.tokkoApp = new AppController();
  window.tokkoApp.init();
});
