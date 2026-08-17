/**
 * Module 3 — Orders (Local CRM & Status Tracker)
 * Tracks order pipeline, status history, linked invoices, and Basic tier soft cap (20 orders).
 */

import { Storage } from '../storage.js';
import { LicenseManager } from '../license.js';

export const OrdersModule = {
  getOrders() {
    return Storage.get('orders') || [];
  },

  getFilteredOrders(statusFilter = 'All', searchQuery = '') {
    let orders = this.getOrders();

    if (statusFilter && statusFilter !== 'All') {
      orders = orders.filter(o => o.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      orders = orders.filter(
        o =>
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.linkedInvoiceId && o.linkedInvoiceId.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Basic tier soft cap check (PRD §8: last 20 orders visible)
    const isPro = LicenseManager.isPro();
    const totalCount = orders.length;
    const isCapped = !isPro && totalCount > 20;

    const visibleOrders = isCapped ? orders.slice(0, 20) : orders;

    return {
      orders: visibleOrders,
      totalCount: totalCount,
      isCapped: isCapped,
      cappedCount: totalCount - 20
    };
  },

  getOrderById(id) {
    const list = this.getOrders();
    return list.find(o => o.id === id) || null;
  },

  /**
   * Syncs an invoice into the CRM orders table automatically.
   */
  syncInvoiceToOrder(invoice) {
    if (!invoice || !invoice.id) return;

    const orders = this.getOrders();
    const existingIdx = orders.findIndex(o => o.linkedInvoiceId === invoice.id || o.id === invoice.linkedOrderId);

    const now = new Date().toISOString();

    if (existingIdx !== -1) {
      // Update existing order
      const existing = orders[existingIdx];
      const statusChanged = existing.status !== invoice.status;

      orders[existingIdx] = {
        ...existing,
        customerName: invoice.customerName || 'Pelanggan',
        customerPhone: invoice.customerPhone || '',
        total: invoice.total,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        updatedAt: now,
        statusHistory: statusChanged
          ? [...(existing.statusHistory || []), { status: invoice.status, at: now }]
          : existing.statusHistory
      };
    } else {
      // Create new linked order
      const newOrder = {
        id: invoice.linkedOrderId || 'ord_' + Date.now(),
        linkedInvoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName || 'Pelanggan',
        customerPhone: invoice.customerPhone || '',
        total: invoice.total,
        status: invoice.status || 'pending',
        createdAt: invoice.date || now,
        updatedAt: now,
        statusHistory: [{ status: invoice.status || 'pending', at: now }],
        notes: invoice.note || ''
      };
      orders.unshift(newOrder);
    }

    Storage.set('orders', orders);
  },

  updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);

    if (idx === -1) return false;

    const current = orders[idx];
    if (current.status === newStatus) return true;

    const now = new Date().toISOString();
    orders[idx] = {
      ...current,
      status: newStatus,
      updatedAt: now,
      statusHistory: [...(current.statusHistory || []), { status: newStatus, at: now }]
    };

    Storage.set('orders', orders);

    // Also update linked invoice status if exists
    if (current.linkedInvoiceId) {
      const invoices = Storage.get('invoices') || [];
      const invIdx = invoices.findIndex(i => i.id === current.linkedInvoiceId);
      if (invIdx !== -1) {
        invoices[invIdx].status = newStatus;
        Storage.set('invoices', invoices);
      }
    }

    return true;
  }
};
