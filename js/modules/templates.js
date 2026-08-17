/**
 * Module 2 — Template (Chat Template Vault)
 * Handles template listing, filtering, creation/editing, and live variable substitution.
 */

import { Storage } from '../storage.js';

export const TemplatesModule = {
  getTemplates() {
    return Storage.get('templates') || [];
  },

  getCategories() {
    const list = this.getTemplates();
    const categories = new Set(list.map(t => t.category || 'Umum'));
    return Array.from(categories);
  },

  searchTemplates(query = '', categoryFilter = 'All') {
    let list = this.getTemplates();

    if (categoryFilter && categoryFilter !== 'All') {
      list = list.filter(t => t.category === categoryFilter);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        t => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      );
    }

    return list;
  },

  saveTemplate(templateData) {
    const list = this.getTemplates();
    const now = new Date().toISOString();

    if (templateData.id) {
      // Edit existing
      const idx = list.findIndex(t => t.id === templateData.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          title: templateData.title,
          category: templateData.category || 'Umum',
          body: templateData.body,
          updatedAt: now
        };
      }
    } else {
      // Create new
      const newTpl = {
        id: 'tpl_' + Date.now(),
        title: templateData.title,
        category: templateData.category || 'Umum',
        body: templateData.body,
        createdAt: now,
        updatedAt: now
      };
      list.unshift(newTpl);
    }

    Storage.set('templates', list);
    return true;
  },

  deleteTemplate(id) {
    let list = this.getTemplates();
    list = list.filter(t => t.id !== id);
    Storage.set('templates', list);
    return true;
  },

  /**
   * Replaces variables {{nama}}, {{total}}, {{tanggal}} using active invoice context or manual fallback.
   */
  processVariables(templateBody, invoiceContext = null) {
    if (!templateBody) return '';

    let text = templateBody;
    const nowStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (invoiceContext) {
      const formattedTotal = 'Rp ' + (invoiceContext.total || 0).toLocaleString('id-ID');
      text = text.replace(/\{\{nama\}\}/gi, invoiceContext.customerName || 'Kak');
      text = text.replace(/\{\{total\}\}/gi, formattedTotal);
      text = text.replace(/\{\{tanggal\}\}/gi, nowStr);
    } else {
      text = text.replace(/\{\{tanggal\}\}/gi, nowStr);
    }

    return text;
  }
};
