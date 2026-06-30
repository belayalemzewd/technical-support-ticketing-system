/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, Phone, MapPin, Briefcase, Cpu, ShieldCheck, 
  Send, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import { Ticket } from '../types';
import { api } from '../lib/api';

interface HardwareTicketFormProps {
  onSubmit: (ticketData: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  defaultUserName?: string;
}

const PARTNERS = [
  'Ethio Tele', 'Ethio Post', 'CBE Bank', 'O-tech', 'ABH', 'Blue Spark', 'Safaricom'
];

const REGIONS = [
  'Afar Region', 'Amhara Region', 'Benishangul-Gumuz Region', 'Central Ethiopia Region', 
  'Gambela Region', 'Harari Region', 'Oromia Region', 'Sidama Region', 'Somali Region', 
  'South Ethiopia Region', 'Southwest Ethiopia Peoples Region', 'Tigray Region'
];

const KIT_TYPES = ['BioRugged', 'Laxton', 'Emptech'];

const DEVICE_ISSUE_TYPES = [
  'Fingerprint Scanner', 'Face Camera', 'Iris Scanner', 'Document Scanner', 'Iris Cables', 
  'Laptop', 'Kit Charger', 'Hub', 'Battery', 'Doc Scanner Cables', 'Printer', 'Printer Cables', 
  'Keyboard', 'Mouse', 'Power Button', 'LED Indicators', 'BMS Board', 'Second Screens', 
  'PC Charger', 'SBI', 'Client', 'Global Protect (VPN)'
];

const VERIFIERS = [
  'Abebaw Nid', 'Alemzewd Nid', 'Azaria Nid', 'Demelash Nid', 'Feven Nid', 
  'Hassen Nid', 'Getahun Nid', 'Redwan Nid', 'Yohannis Nid', 'Zelalem Nid'
];

export const HardwareTicketForm: React.FC<HardwareTicketFormProps> = ({ onSubmit, onCancel, defaultUserName = '' }) => {
  // --- Section 1 State ---
  const [fullName, setFullName] = useState(defaultUserName);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPartner, setSelectedPartner] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [regCenterName, setRegCenterName] = useState('');

  // --- Section 2 State ---
  const [kitNumber, setKitNumber] = useState('');
  const [selectedKitType, setSelectedKitType] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

  // --- Section 3 State ---
  const [selectedVerifier, setSelectedVerifier] = useState('');
  const [dateVerified, setDateVerified] = useState('2026-06-27');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleToggleIssue = (issue: string) => {
    setSelectedIssues(prev =>
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  };

  const validateForm = () => {
    const tempErrors: Record<string, string> = {};

    // Section 1 Validation
    if (!fullName.trim()) tempErrors.fullName = 'User Full Name is required.';
    if (!phoneNumber.trim()) {
      tempErrors.phoneNumber = 'Phone Number is required.';
    } else if (!/^[+\d\s-]{6,16}$/.test(phoneNumber.trim())) {
      tempErrors.phoneNumber = 'Phone number is invalid.';
    }
    if (!selectedPartner) tempErrors.partner = 'Partner selection is required.';
    if (!selectedRegion) tempErrors.region = 'Region selection is required.';
    if (!regCenterName.trim()) tempErrors.regCenterName = 'Registration Center Name / ID is required.';

    // Section 2 Validation
    if (!kitNumber.trim()) tempErrors.kitNumber = 'Kit Number is required.';
    if (!selectedKitType) tempErrors.kitType = 'KIT Type selection is required.';
    if (selectedIssues.length === 0) tempErrors.issues = 'Please select at least one device issue type.';

    // Section 3 Validation
    if (!selectedVerifier) tempErrors.verifier = 'Tech Support Verifier selection is required.';
    if (!dateVerified) tempErrors.dateVerified = 'Verification Date is required.';

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        document.getElementById(`err-${firstErrorKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const issueDescription = `
### HARDWARE ISSUE REPORTING FORM
User Full Name:** ${fullName.trim()}
Phone Number:** ${phoneNumber.trim()}
Partner:** ${selectedPartner}
Region:** ${selectedRegion}
Registration Center:** ${regCenterName.trim()}
Kit Number:** ${kitNumber.trim()}
KIT Type:** ${selectedKitType}
Device Issue Types:** ${selectedIssues.join(', ')}
Verified By:** ${selectedVerifier} (NIDP Tech Support)
Date Verified:** ${formatDate(dateVerified)}
`.trim();

    onSubmit({
      date: dateVerified,
      officerName: fullName.trim(),
      phone: phoneNumber.trim(),
      partner: selectedPartner,
      region: selectedRegion,
      anydeskAddress: 'N/A',
      deviceType: selectedKitType,
      kitNumber: kitNumber.trim(),
      issueTypes: selectedIssues,
      issueDescription: issueDescription,
      regCenterName: regCenterName.trim(),
      verifiedBy: selectedVerifier,
      dateVerified: dateVerified,
      kitType: selectedKitType,
      hwIssueStatus: 'Under Repair'
    });

    setSubmitSuccess(true);
  };

  const handleReset = () => {
    setFullName(defaultUserName);
    setPhoneNumber('');
    setSelectedPartner('');
    setSelectedRegion('');
    setRegCenterName('');
    setKitNumber('');
    setSelectedKitType('');
    setSelectedIssues([]);
    setSelectedVerifier('');
    setDateVerified('2026-06-27');
    setErrors({});
    setSubmitSuccess(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div id="hardware-ticket-form-root" className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto transition-all duration-300 relative">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800/60">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400">
              <Cpu className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-serif-display">
              Hardware Issue Reporting Form
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
            This form is to be completed by the user after a National ID Program (NIDP) Tech Support person has verified a hardware malfunction.
          </p>
        </div>
        
        {/* Utility Actions */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
          >
            Reset Form
          </button>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-8">
        
        {/* SECTION 1: USER & LOCATION DETAILS */}
        <section className="space-y-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-150/50 dark:border-slate-800/60">
          <div className="border-b border-slate-200/40 dark:border-slate-800/50 pb-2 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">1</span>
            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              User & Location Details
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* User Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>User Full Name</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                }}
                placeholder="Enter your full name"
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.fullName ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.fullName && <p id="err-fullName" className="text-[10px] text-red-500 font-medium">{errors.fullName}</p>}
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-500" />
                <span>Phone Number</span>
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: '' }));
                }}
                placeholder="e.g. +251 911 000 000"
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.phoneNumber ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.phoneNumber && <p id="err-phoneNumber" className="text-[10px] text-red-500 font-medium">{errors.phoneNumber}</p>}
            </div>

            {/* Partner Organization (Dropdown select) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                <span>Partner</span>
              </label>
              <select
                value={selectedPartner}
                onChange={(e) => {
                  setSelectedPartner(e.target.value);
                  if (errors.partner) setErrors(prev => ({ ...prev, partner: '' }));
                }}
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.partner ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="">-- Select Partner --</option>
                {PARTNERS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {errors.partner && <p id="err-partner" className="text-[10px] text-red-500 font-medium">{errors.partner}</p>}
            </div>

            {/* Region Location (Dropdown select) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span>Region</span>
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  if (errors.region) setErrors(prev => ({ ...prev, region: '' }));
                }}
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.region ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="">-- Select Region --</option>
                {REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.region && <p id="err-region" className="text-[10px] text-red-500 font-medium">{errors.region}</p>}
            </div>

            {/* Registration Center Name / ID */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span>Registration Center Name</span>
              </label>
              <input
                type="text"
                value={regCenterName}
                onChange={(e) => {
                  setRegCenterName(e.target.value);
                  if (errors.regCenterName) setErrors(prev => ({ ...prev, regCenterName: '' }));
                }}
                placeholder="e.g. Addis Ababa NIDP Station A03"
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.regCenterName ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.regCenterName && <p id="err-regCenterName" className="text-[10px] text-red-500 font-medium">{errors.regCenterName}</p>}
            </div>

          </div>
        </section>

        {/* SECTION 2: KIT & DEVICE INFORMATION */}
        <section className="space-y-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-150/50 dark:border-slate-800/60">
          <div className="border-b border-slate-200/40 dark:border-slate-800/50 pb-2 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">2</span>
            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Kit & Device Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kit Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Kit Number</span>
              </label>
              <input
                type="text"
                value={kitNumber}
                onChange={(e) => {
                  setKitNumber(e.target.value);
                  if (errors.kitNumber) setErrors(prev => ({ ...prev, kitNumber: '' }));
                }}
                placeholder="e.g. KIT-4421, BRE092"
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.kitNumber ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.kitNumber && <p id="err-kitNumber" className="text-[10px] text-red-500 font-medium">{errors.kitNumber}</p>}
            </div>

            {/* KIT Type (Dropdown select) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                <span>Kit Type</span>
              </label>
              <select
                value={selectedKitType}
                onChange={(e) => {
                  setSelectedKitType(e.target.value);
                  if (errors.kitType) setErrors(prev => ({ ...prev, kitType: '' }));
                }}
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.kitType ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="">-- Select KIT Type --</option>
                {KIT_TYPES.map(kt => (
                  <option key={kt} value={kt}>{kt}</option>
                ))}
              </select>
              {errors.kitType && <p id="err-kitType" className="text-[10px] text-red-500 font-medium">{errors.kitType}</p>}
            </div>

            {/* Device Issue Type (Multi-Select Checkboxes) */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Device Issue Type</span>
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80">
                {DEVICE_ISSUE_TYPES.map(issue => {
                  const isChecked = selectedIssues.includes(issue);
                  return (
                    <label 
                      key={issue} 
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[10px] font-medium cursor-pointer select-none transition-all ${
                        isChecked 
                          ? 'bg-red-50/50 dark:bg-red-950/20 border-red-400 dark:border-red-900/60 text-red-700 dark:text-red-400 font-semibold'
                          : 'border-slate-100 hover:bg-slate-50/40 dark:border-slate-850 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleIssue(issue)}
                        className="rounded border-slate-300 dark:border-slate-700 text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer accent-red-600"
                      />
                      <span>{issue}</span>
                    </label>
                  );
                })}
              </div>
              {errors.issues && <p id="err-issues" className="text-[10px] text-red-500 font-medium">{errors.issues}</p>}
            </div>
          </div>
        </section>

        {/* SECTION 3: TECH SUPPORT VERIFICATION */}
        <section className="space-y-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-150/50 dark:border-slate-800/60">
          <div className="border-b border-slate-200/40 dark:border-slate-800/50 pb-2 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">3</span>
            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Tech Support Verification
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Who Checked / Verified the Issue (Dropdown Select) */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Who Checked / Verified the Issue</span>
                </span>
              </label>
              <select
                value={selectedVerifier}
                onChange={(e) => {
                  setSelectedVerifier(e.target.value);
                  if (errors.verifier) setErrors(prev => ({ ...prev, verifier: '' }));
                }}
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.verifier ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="">-- Select NIDP Tech Support person --</option>
                {VERIFIERS.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {errors.verifier && <p id="err-verifier" className="text-[10px] text-red-500 font-medium">{errors.verifier}</p>}
            </div>

            {/* Date Verified */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>Date Verified</span>
              </label>
              <input
                type="date"
                value={dateVerified}
                onChange={(e) => {
                  setDateVerified(e.target.value);
                  if (errors.dateVerified) setErrors(prev => ({ ...prev, dateVerified: '' }));
                }}
                className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/80 focus:outline-none transition-all ${
                  errors.dateVerified ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.dateVerified && <p id="err-dateVerified" className="text-[10px] text-red-500 font-medium">{errors.dateVerified}</p>}
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Format: DD/MM/2026</p>
            </div>
          </div>
        </section>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-150 dark:border-slate-800/60">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Submit Hardware Ticket</span>
          </button>
        </div>

      </form>

      {/* Success Notification Banner */}
      {submitSuccess && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150/40 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-400 text-xs font-medium flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <span className="font-bold block">Hardware Issue Ticket Saved Successfully!</span>
            <span>The ticket has been synchronized into the NIDP Deck registry. Admins and technicians have been notified.</span>
          </div>
        </div>
      )}
    </div>
  );
};
