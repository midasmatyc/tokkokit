/**
 * Module 4 — Ongkir (Shipping Estimator)
 * Reads static rate data from data/shippingRates.json.
 */

import { Storage } from '../storage.js';

let shippingData = null;

export const ShippingModule = {
  async init() {
    try {
      const res = await fetch('./data/shippingRates.json');
      if (res.ok) {
        shippingData = await res.json();
      }
    } catch (e) {
      console.warn('[ShippingModule] Could not load static shipping rates file:', e);
    }
  },

  getZones() {
    if (shippingData && shippingData.zones) {
      return shippingData.zones;
    }
    return [
      { id: 'yogyakarta', name: 'Yogyakarta / DIY' },
      { id: 'jakarta', name: 'DKI Jakarta' },
      { id: 'bandung', name: 'Bandung / Jawa Barat' },
      { id: 'surabaya', name: 'Surabaya / Jawa Timur' },
      { id: 'semarang', name: 'Semarang / Jawa Tengah' }
    ];
  },

  calculateRates(originId, destId, weightGrams) {
    if (!originId || !destId || !weightGrams || weightGrams <= 0) {
      return { success: false, message: 'Harap isi asal, tujuan, dan berat barang.' };
    }

    const weightKg = Math.ceil(weightGrams / 1000); // Round up to nearest kg
    const routeKey = `${originId}_${destId}`;

    if (shippingData && shippingData.rates && shippingData.rates[routeKey]) {
      const baseRates = shippingData.rates[routeKey];
      const calculated = baseRates.map(item => ({
        courier: item.courier,
        service: item.service,
        price: item.pricePerKg * weightKg,
        weightKg: weightKg
      }));

      return {
        success: true,
        isStaticData: true,
        weightKg: weightKg,
        rates: calculated
      };
    }

    // Fallback if route is not in static table
    const shop = Storage.get('shopProfile') || {};
    const fallbackFee = (shop.defaultShippingFee || 15000) * weightKg;

    return {
      success: true,
      isStaticData: false,
      weightKg: weightKg,
      fallbackMessage: 'Rute tidak ditemukan di tabel estimasi. Menampilkan tarif standar toko.',
      rates: [
        {
          courier: 'Tarif Standar Toko',
          service: `Estimasi Flat (${weightKg} kg)`,
          price: fallbackFee,
          weightKg: weightKg
        }
      ]
    };
  }
};
