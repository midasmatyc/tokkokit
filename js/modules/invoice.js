/**
 * Module 1 — Nota (WhatsApp-First Auto-Invoice Generator)
 * Builds invoices, formats WhatsApp markdown, handles print previews, image exports, and auto-generates invoice numbers.
 */

import { Storage } from '../storage.js';
import { OrdersModule } from './orders.js';
import { LicenseManager } from '../license.js';

export const InvoiceModule = {
  getInvoices() {
    return Storage.get('invoices') || [];
  },

  /**
   * Generates unique invoice number YYMMDD-XXXX
   */
  generateInvoiceNumber() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`;

    const existing = this.getInvoices();
    let uniqueNumber = '';
    let attempts = 0;

    while (!uniqueNumber || attempts < 100) {
      attempts++;
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const candidate = `${datePrefix}-${randomSuffix}`;
      if (!existing.some(i => i.invoiceNumber === candidate)) {
        uniqueNumber = candidate;
        break;
      }
    }

    return uniqueNumber || `${datePrefix}-${Date.now().toString().slice(-4)}`;
  },

  createNewInvoiceState() {
    const shop = Storage.get('shopProfile') || {};
    return {
      id: 'inv_' + Date.now(),
      invoiceNumber: this.generateInvoiceNumber(),
      date: new Date().toISOString(),
      orderType: 'regular', // "regular" | "dropship"
      status: 'pending', // "pending" | "paid" | "shipped" | "completed" | "cancelled"
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      paymentMethod: 'Transfer',
      note: '',
      items: [
        { name: '', qty: 1, price: 0 }
      ],
      subtotal: 0,
      taxPercent: shop.defaultTaxPercent || 0,
      tax: 0,
      shipping: shop.defaultShippingFee || 0,
      total: 0,
      linkedOrderId: 'ord_' + Date.now()
    };
  },

  calculateInvoiceTotals(invoiceData) {
    const items = invoiceData.items || [];
    let subtotal = 0;

    items.forEach(item => {
      const q = Math.max(0, parseInt(item.qty) || 0);
      const p = Math.max(0, parseFloat(item.price) || 0);
      subtotal += q * p;
    });

    const taxPercent = Math.max(0, parseFloat(invoiceData.taxPercent) || 0);
    const tax = Math.round(subtotal * (taxPercent / 100));
    const shipping = Math.max(0, parseFloat(invoiceData.shipping) || 0);
    const total = subtotal + tax + shipping;

    return {
      subtotal,
      tax,
      taxPercent,
      shipping,
      total
    };
  },

  saveInvoice(invoiceData) {
    const invoices = this.getInvoices();
    const totals = this.calculateInvoiceTotals(invoiceData);

    const fullInvoice = {
      ...invoiceData,
      ...totals,
      updatedAt: new Date().toISOString()
    };

    const existingIdx = invoices.findIndex(i => i.id === fullInvoice.id);
    if (existingIdx !== -1) {
      invoices[existingIdx] = fullInvoice;
    } else {
      invoices.unshift(fullInvoice);
    }

    Storage.set('invoices', invoices);

    // Sync automatically to Module 3 (Orders CRM)
    OrdersModule.syncInvoiceToOrder(fullInvoice);

    return fullInvoice;
  },

  formatRupiah(num) {
    const val = Math.round(num || 0);
    return 'Rp ' + val.toLocaleString('id-ID');
  },

  /**
   * Generates WhatsApp Markdown formatted text according to PRD §7
   */
  generateWhatsAppText(invoiceData) {
    const shop = Storage.get('shopProfile') || {};
    const totals = this.calculateInvoiceTotals(invoiceData);

    const dateStr = new Date(invoiceData.date || Date.now()).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isDropship = invoiceData.orderType === 'dropship';
    const statusText = invoiceData.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS';

    let text = `*${shop.shopName || 'Toko'}*\n`;
    if (shop.waNumber) text += `${shop.waNumber}\n`;
    text += `------------------------------\n`;

    text += `*Nota No:* #${invoiceData.invoiceNumber}\n`;
    if (isDropship) text += `*Tipe:* Dropship\n`;
    text += `*Status:* [${statusText}]\n`;
    text += `*Kepada:* ${invoiceData.customerName || '-'}\n`;
    if (invoiceData.customerPhone) text += `*No. WA:* ${invoiceData.customerPhone}\n`;
    if (invoiceData.customerAddress) text += `*Alamat:* ${invoiceData.customerAddress}\n`;
    text += `*Tanggal:* ${dateStr}\n`;
    text += `*Metode Pembayaran:* ${invoiceData.paymentMethod || 'Transfer'}\n`;
    text += `------------------------------\n`;
    text += `*Daftar Item:*\n`;

    (invoiceData.items || []).forEach(item => {
      if (!item.name) return;
      const itemTotal = (item.qty || 1) * (item.price || 0);
      text += `\`${item.name} (${item.qty}x) = ${this.formatRupiah(itemTotal)}\`\n`;
    });

    text += `------------------------------\n`;
    text += `Subtotal: ${this.formatRupiah(totals.subtotal)}\n`;
    if (totals.tax > 0) text += `Pajak (${totals.taxPercent}%): ${this.formatRupiah(totals.tax)}\n`;
    text += `Ongkir: ${this.formatRupiah(totals.shipping)}\n`;
    text += `*TOTAL: ${this.formatRupiah(totals.total)}*\n`;

    if (invoiceData.note && invoiceData.note.trim()) {
      text += `------------------------------\n`;
      text += `*Catatan:* ${invoiceData.note}\n`;
    }

    if (shop.bankAccounts && shop.bankAccounts.length > 0) {
      text += `------------------------------\n`;
      text += `*Transfer Pembayaran ke:*\n`;
      shop.bankAccounts.forEach(acc => {
        text += `• ${acc.bank} a.n ${acc.holder}: *${acc.number}*\n`;
      });
    }

    if (shop.thankYouMessage) {
      text += `------------------------------\n`;
      text += `${shop.thankYouMessage}\n`;
    }

    return text;
  },

  /**
   * Generates HTML view for Receipt Preview Box
   */
  generateReceiptHTML(invoiceData) {
    const shop = Storage.get('shopProfile') || {};
    const totals = this.calculateInvoiceTotals(invoiceData);

    const dateStr = new Date(invoiceData.date || Date.now()).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const isPaid = invoiceData.status === 'paid';
    const statusBadgeClass = isPaid ? 'badge-paid' : 'badge-pending';
    const statusLabel = isPaid ? 'Lunas' : 'Belum Lunas';

    return `
      <div id="receipt-preview-content" class="p-6 receipt-paper text-sm text-gray-900 rounded-lg">
        <div class="text-center border-b border-dashed border-gray-400 pb-4 mb-4">
          ${shop.logoBase64 && LicenseManager.isPro() ? `<img src="${shop.logoBase64}" class="h-12 mx-auto mb-2 object-contain" />` : ''}
          <h2 class="font-bold text-lg text-gray-900 tracking-tight">${shop.shopName || 'Toko Saya'}</h2>
          <p class="text-xs text-gray-600">${shop.address || ''}</p>
          <p class="text-xs text-gray-600">${shop.waNumber || ''}</p>
        </div>

        <div class="flex justify-between items-start text-xs mb-3">
          <div>
            <div class="font-bold">#${invoiceData.invoiceNumber}</div>
            <div class="text-gray-500">${dateStr}</div>
            ${invoiceData.orderType === 'dropship' ? '<span class="inline-block mt-1 text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold">DROPSHIP</span>' : ''}
          </div>
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${statusBadgeClass}">
            ${statusLabel}
          </span>
        </div>

        <div class="border-t border-b border-dashed border-gray-300 py-2 mb-3 text-xs">
          <div><span class="text-gray-500">Kepada:</span> <strong>${invoiceData.customerName || '-'}</strong></div>
          ${invoiceData.customerPhone ? `<div><span class="text-gray-500">No WA:</span> ${invoiceData.customerPhone}</div>` : ''}
          ${invoiceData.customerAddress ? `<div><span class="text-gray-500">Alamat:</span> ${invoiceData.customerAddress}</div>` : ''}
          <div><span class="text-gray-500">Bayar via:</span> ${invoiceData.paymentMethod || 'Transfer'}</div>
        </div>

        <div class="mb-3">
          <div class="font-bold text-xs border-b border-gray-200 pb-1 mb-2">Daftar Barang</div>
          ${(invoiceData.items || []).map(item => {
            if (!item.name) return '';
            const total = (item.qty || 1) * (item.price || 0);
            return `
              <div class="flex justify-between text-xs py-1">
                <span>${item.name} <span class="text-gray-500">x${item.qty}</span></span>
                <span class="font-mono">${this.formatRupiah(total)}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="border-t border-dashed border-gray-400 pt-3 text-xs space-y-1">
          <div class="flex justify-between">
            <span class="text-gray-600">Subtotal</span>
            <span class="font-mono">${this.formatRupiah(totals.subtotal)}</span>
          </div>
          ${totals.tax > 0 ? `
            <div class="flex justify-between">
              <span class="text-gray-600">Pajak (${totals.taxPercent}%)</span>
              <span class="font-mono">${this.formatRupiah(totals.tax)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between">
            <span class="text-gray-600">Ongkir</span>
            <span class="font-mono">${this.formatRupiah(totals.shipping)}</span>
          </div>
          <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-300">
            <span>TOTAL</span>
            <span class="font-mono text-emerald-700">${this.formatRupiah(totals.total)}</span>
          </div>
        </div>

        ${invoiceData.note ? `
          <div class="mt-4 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
            <span class="font-bold">Catatan:</span> ${invoiceData.note}
          </div>
        ` : ''}

        ${shop.bankAccounts && shop.bankAccounts.length > 0 ? `
          <div class="mt-4 pt-3 border-t border-dashed border-gray-300 text-xs">
            <div class="font-bold mb-1">Transfer ke:</div>
            ${shop.bankAccounts.map(acc => `<div>${acc.bank} ${acc.holder}: <strong>${acc.number}</strong></div>`).join('')}
          </div>
        ` : ''}

        <div class="mt-4 pt-3 border-t border-dashed border-gray-400 text-center text-xs text-gray-600 italic">
          ${shop.thankYouMessage || 'Terima kasih telah berbelanja!'}
        </div>
      </div>
    `;
  },

  async exportAsImage(invoiceData, targetElement) {
    if (!LicenseManager.isPro()) {
      return { success: false, isProRequired: true, message: 'Fitur Export Gambar memerlukan lisensi PRO.' };
    }

    try {
      if (window.html2canvas) {
        const canvas = await window.html2canvas(targetElement, { scale: 2 });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Nota_${invoiceData.invoiceNumber}.png`;
        link.href = dataUrl;
        link.click();
        return { success: true, message: 'Gambar nota berhasil diunduh!' };
      }
      return { success: false, message: 'Modul html2canvas tidak dimuat.' };
    } catch (e) {
      return { success: false, message: 'Gagal mengexport gambar: ' + e.message };
    }
  }
};
