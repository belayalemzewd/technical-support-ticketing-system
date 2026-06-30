/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ticket } from './types';

export const PARTNERS = [
  'Ethio Tele',
  'Ethio Post',
  'CBE Bank',
  'O-tech',
  'ABH',
  'Blue Spark',
  'Safaricom'
];

export const REGIONS = [
  'Afar Region',
  'Amhara Region',
  'Benishangul-Gumuz Region',
  'Central Ethiopia Region',
  'Gambela Region',
  'Harari Region',
  'Oromia Region',
  'Sidama Region',
  'Somali Region',
  'South Ethiopia Region',
  'Southwest Ethiopia Peoples\' Region',
  'Tigray Region'
];

export const DEVICE_TYPES = [
  'BioRugged',
  'Laxton',
  'Emptech'
];

export const SUPPORT_STAFF = [
  'Abebaw Nid',
  'Alemzewd Nid',
  'Azaria Nid',
  'Demelash Nid',
  'Feven Nid',
  'Hassen Nid',
  'Getahun Nid',
  'Redwan Nid',
  'Yohannis Nid',
  'Zelalem Nid'
];

export const ISSUE_TYPES = [
  'Fingerprint Scanner',
  'Face Camera',
  'Iris Scanner',
  'Document Scanner',
  'Iris Cables',
  'Laptop',
  'Kit Charger',
  'Hub',
  'Battery',
  'Doc Scanner Cables',
  'Printer',
  'Printer Cables',
  'Keyboard',
  'Mouse',
  'Power Button',
  'LED Indicators',
  'BMS Board',
  'Second Screens',
  'PC Charger',
  'SBI',
  'Client',
  'Global Protect(VPN)'
];

// Helper to generate ISO date strings relative to today
const getRelativeDate = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'TKT-1001',
    date: getRelativeDate(0), // Today
    officerName: 'Sarah Jenkins',
    phone: '+251 911 234 567',
    partner: 'Safaricom',
    region: 'Tigray Region',
    anydeskAddress: 'AD-804-129-374',
    deviceType: 'BioRugged',
    kitNumber: 'KIT-9021',
    issueDescription: 'unable to get authentication token',
    status: 'Open',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
    updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  
];
