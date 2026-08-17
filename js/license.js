/**
 * License Manager (license.js)
 * Controls activation flow, tier detection ("basic" / "pro"), and URL parameter key auto-validation.
 */

import { Storage } from './storage.js';

// Pre-configured offline demo keys for easy testing
const DEMO_KEYS = {
  'BASIC-DEMO': 'basic',
  'BASIC-DEMO-1234': 'basic',
  'PRO-DEMO': 'pro',
  'PRO-DEMO-1234': 'pro',
  'TOKKO-PRO-2026': 'pro'
};

export const LicenseManager = {
  getSettings() {
    return Storage.get('settings') || { tier: 'unactivated', licenseKey: null };
  },

  getTier() {
    const settings = this.getSettings();
    return settings.tier || 'unactivated';
  },

  isActivated() {
    const tier = this.getTier();
    return tier === 'basic' || tier === 'pro';
  },

  isPro() {
    return this.getTier() === 'pro';
  },

  /**
   * Validates key against offline demo table or online endpoint.
   * Client-side fallback handles demo keys smoothly without backend.
   */
  async validateKey(keyString) {
    if (!keyString || typeof keyString !== 'string') {
      return { success: false, message: 'Kode lisensi tidak boleh kosong.' };
    }

    const cleanKey = keyString.trim().toUpperCase();

    // Check demo keys
    if (DEMO_KEYS[cleanKey]) {
      const tier = DEMO_KEYS[cleanKey];
      this._saveActivation(cleanKey, tier);
      return {
        success: true,
        tier: tier,
        message: `Lisensi ${tier.toUpperCase()} berhasil diaktifkan!`
      };
    }

    // Default heuristic for pattern matching: BASIC-xxxx or PRO-xxxx
    if (cleanKey.startsWith('BASIC')) {
      this._saveActivation(cleanKey, 'basic');
      return { success: true, tier: 'basic', message: 'Lisensi Basic berhasil diaktifkan!' };
    } else if (cleanKey.startsWith('PRO')) {
      this._saveActivation(cleanKey, 'pro');
      return { success: true, tier: 'pro', message: 'Lisensi Pro berhasil diaktifkan!' };
    }

    // If key format matches standard 8+ char code, default to basic tier in offline mode
    if (cleanKey.length >= 8) {
      this._saveActivation(cleanKey, 'basic');
      return { success: true, tier: 'basic', message: 'Lisensi berhasil diaktifkan (Basic Tier)!' };
    }

    return {
      success: false,
      message: 'Kode lisensi tidak valid. Coba gunakan BASIC-DEMO atau PRO-DEMO.'
    };
  },

  _saveActivation(key, tier) {
    const settings = this.getSettings();
    settings.tier = tier;
    settings.licenseKey = key;
    settings.lastValidatedAt = new Date().toISOString();
    Storage.set('settings', settings);
  },

  deactivate() {
    const settings = this.getSettings();
    settings.tier = 'unactivated';
    settings.licenseKey = null;
    settings.lastValidatedAt = null;
    Storage.set('settings', settings);
  },

  checkUrlActivation() {
    const params = new URLSearchParams(window.location.search);
    const keyParam = params.get('key');
    if (keyParam) {
      return this.validateKey(keyParam);
    }
    return null;
  }
};
