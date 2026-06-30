/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Calendar, User, Phone, Briefcase, MapPin, Monitor, Key, ClipboardList, 
  Send, Sparkles, Camera, Loader2, Trash2, CheckCircle2, AlertCircle, 
  Check, ChevronLeft, ChevronRight, Info 
} from 'lucide-react';
import { PARTNERS, REGIONS, DEVICE_TYPES, ISSUE_TYPES } from '../data';
import { Ticket } from '../types';
import { api } from '../lib/api';

interface TicketFormProps {
  onSubmit: (ticketData: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  defaultOfficerName?: string;
}

export const TicketForm: React.FC<TicketFormProps> = ({ onSubmit, onCancel, defaultOfficerName = '' }) => {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [officerName, setOfficerName] = useState(defaultOfficerName);
  const [phone, setPhone] = useState('');
  const [partner, setPartner] = useState(PARTNERS[0]);
  const [customPartner, setCustomPartner] = useState('');
  const [region, setRegion] = useState(REGIONS[0]);
  const [customRegion, setCustomRegion] = useState('');
  const [anydeskAddress, setAnydeskAddress] = useState('');
  const [deviceType, setDeviceType] = useState(DEVICE_TYPES[0]);
  const [kitNumber, setKitNumber] = useState('');
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<string[]>([]);
  const [issueDescription, setIssueDescription] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Active help tooltip states
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const handleToggleIssueType = (option: string) => {
    setSelectedIssueTypes(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const validateStep = (stepNumber: number) => {
    const tempErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!date) tempErrors.date = 'Logging date is required.';
      
      if (!officerName.trim()) {
        tempErrors.officerName = 'Officer or Supervisor name is required.';
      } else if (officerName.trim().length < 3) {
        tempErrors.officerName = 'Please enter a valid supervisor name (at least 3 characters).';
      }

      if (!phone.trim()) {
        tempErrors.phone = 'Contact phone number is required.';
      } else if (!/^[+\d\s-]{6,16}$/.test(phone.trim())) {
        tempErrors.phone = 'Phone number is invalid (must be 6-16 digits/characters).';
      }

      if (partner === 'Other' && !customPartner.trim()) {
        tempErrors.partner = 'Please supply custom partner name.';
      }

      if (region === 'Other' && !customRegion.trim()) {
        tempErrors.region = 'Please supply custom region name.';
      }
    }

    if (stepNumber === 2) {
      if (!anydeskAddress.trim()) {
        tempErrors.anydeskAddress = 'Anydesk Address is required.';
      }

      if (!kitNumber.trim()) {
        tempErrors.kitNumber = 'Kit tracking number is required.';
      }
    }

    if (stepNumber === 3) {
      if (!issueDescription.trim()) {
        tempErrors.issueDescription = 'Please provide a clear description of the technical issue.';
      } else if (issueDescription.trim().length < 5) {
        tempErrors.issueDescription = 'Describe the problem in more detail (at least 5 characters).';
      }
    }

    setErrors(prev => {
      const nextErrors = { ...prev };
      if (stepNumber === 1) {
        delete nextErrors.date;
        delete nextErrors.officerName;
        delete nextErrors.phone;
        delete nextErrors.partner;
        delete nextErrors.region;
      } else if (stepNumber === 2) {
        delete nextErrors.anydeskAddress;
        delete nextErrors.kitNumber;
      } else if (stepNumber === 3) {
        delete nextErrors.issueDescription;
      }
      return { ...nextErrors, ...tempErrors };
    });

    return Object.keys(tempErrors).length === 0;
  };

  const isFieldValid = (field: string) => {
    if (errors[field]) return false;
    
    switch (field) {
      case 'officerName':
        return officerName.trim().length >= 3;
      case 'phone':
        return phone.trim().length >= 6 && /^[+\d\s-]{6,16}$/.test(phone.trim());
      case 'anydeskAddress':
        return anydeskAddress.trim().length > 0;
      case 'kitNumber':
        return kitNumber.trim().length > 0;
      case 'issueDescription':
        return issueDescription.trim().length >= 5;
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePrevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    const selectedPartner = partner === 'Other' ? customPartner.trim() : partner;
    const selectedRegion = region === 'Other' ? customRegion.trim() : region;

    onSubmit({
      date,
      officerName: officerName.trim(),
      phone: phone.trim(),
      partner: selectedPartner,
      region: selectedRegion,
      anydeskAddress: anydeskAddress.trim(),
      deviceType,
      kitNumber: kitNumber.trim(),
      issueTypes: selectedIssueTypes,
      issueDescription: issueDescription.trim()
    });
  };

  const tooltips: Record<string, string> = {
    anydesk: "AnyDesk enables remote support access. Please verify the device ID matches the target system.",
    kit: "The physical deployment tracking code labeled on the secure briefcase container or server case.",
    partner: "The local affiliate, regional vendor, or public entity operating the technical workstation.",
    issues: "Check all matching categories to assist the triage specialist in expediting your ticket."
  };

  const toggleTooltip = (key: string) => {
    setActiveTooltip(prev => prev === key ? null : key);
  };

  return (
    <div id="ticket-form-root" className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl max-w-3xl mx-auto transition-all duration-300">
      
      {/* Title */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/60">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <ClipboardList className="w-5.5 h-5.5 text-indigo-500" />
            <span>Log Technical Support Ticket</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Please register all key fields about the site, kit status, and hardware errors.
          </p>
        </div>
      </div>

      {/* Progressive Step Progress Indicator */}
      <div className="mb-8 max-w-lg mx-auto px-2">
        <div className="flex items-center justify-between relative">
          {/* Connector Line Background */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 dark:bg-slate-800 z-0" />
          {/* Active Connector Line */}
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-600 transition-all duration-300 z-0" 
            style={{ width: `${(step - 1) * 50}%` }}
          />

          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                // Allow navigating back freely or moving forward if current step is valid
                if (s < step) {
                  setStep(s);
                } else if (s > step) {
                  let valid = true;
                  for (let checkStep = step; checkStep < s; checkStep++) {
                    if (!validateStep(checkStep)) {
                      valid = false;
                      break;
                    }
                  }
                  if (valid) setStep(s);
                }
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 relative z-10 border ${
                s === step
                  ? 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-500/20 shadow-sm'
                  : s < step
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800'
              }`}
            >
              {s < step ? <Check className="w-4 h-4 stroke-[3px]" /> : s}
              <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap hidden sm:block ${
                s === step ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {s === 1 ? '1. Contact Info' : s === 2 ? '2. System ID' : '3. Issue Details'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6 pt-2">
        
        {/* STEP 1: CONTACT & LOCATION INFORMATION */}
        {step === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/65 mb-2">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">Step 1 of 3</span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">Contact and Deployment Station Information</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Specify who is logging the request and where the active biometric unit is deployed.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Date Picker */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Log Date</span>
                </label>
                <div className="relative">
                  <input
                    id="form-date"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all ${
                      errors.date ? 'border-rose-500 bg-rose-50/10' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                </div>
                {errors.date && <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.date}</p>}
              </div>

              {/* Supervisor Name */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Officer / Supervisor Name</span>
                </label>
                <div className="relative">
                  <input
                    id="form-officer-name"
                    type="text"
                    value={officerName}
                    onChange={(e) => {
                      setOfficerName(e.target.value);
                      if (errors.officerName) setErrors(prev => ({ ...prev, officerName: '' }));
                    }}
                    placeholder="e.g. Abebe Kebede"
                    className={`w-full px-4 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all ${
                      errors.officerName ? 'border-rose-500 bg-rose-50/10' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {isFieldValid('officerName') && (
                    <Check className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                {errors.officerName && <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.officerName}</p>}
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Contact Phone Number</span>
                </label>
                <div className="relative">
                  <input
                    id="form-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    placeholder="e.g. +251..."
                    className={`w-full px-4 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all font-mono ${
                      errors.phone ? 'border-rose-500 bg-rose-50/10' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {isFieldValid('phone') && (
                    <Check className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                {errors.phone && <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.phone}</p>}
              </div>

              {/* Partner Select */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Partner Organization</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTooltip('partner')}
                    className="text-slate-400 hover:text-indigo-500 transition-colors p-0.5"
                    title="Help details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </label>
                
                {activeTooltip === 'partner' && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100/40 dark:border-indigo-900/40 p-2.5 rounded-lg animate-fadeIn mb-1 relative">
                    <span>{tooltips.partner}</span>
                  </div>
                )}

                <select
                  id="form-partner-select"
                  value={partner}
                  onChange={(e) => {
                    setPartner(e.target.value);
                    if (errors.partner) setErrors(prev => ({ ...prev, partner: '' }));
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {PARTNERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="Other">Other / Custom</option>
                </select>
              </div>

              {/* Custom Partner text input */}
              {partner === 'Other' && (
                <div className="space-y-1.5 col-span-1 md:col-span-2 animate-fadeIn">
                  <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>Specify Custom Partner Name</span>
                  </label>
                  <input
                    id="form-custom-partner"
                    type="text"
                    value={customPartner}
                    onChange={(e) => {
                      setCustomPartner(e.target.value);
                      if (errors.partner) setErrors(prev => ({ ...prev, partner: '' }));
                    }}
                    placeholder="Type partner agency name"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-indigo-50/10 dark:bg-indigo-950/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                      errors.partner ? 'border-rose-500 bg-rose-50/10' : 'border-indigo-150 dark:border-indigo-900/60'
                    }`}
                  />
                  {errors.partner && <p className="text-[11px] text-rose-500 font-medium">{errors.partner}</p>}
                </div>
              )}

              {/* Region Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Region Location</span>
                </label>
                <select
                  id="form-region-select"
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    if (errors.region) setErrors(prev => ({ ...prev, region: '' }));
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="Other">Other / Custom</option>
                </select>
              </div>

              {/* Custom Region text input */}
              {region === 'Other' && (
                <div className="space-y-1.5 col-span-1 md:col-span-2 animate-fadeIn">
                  <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>Specify Custom Region</span>
                  </label>
                  <input
                    id="form-custom-region"
                    type="text"
                    value={customRegion}
                    onChange={(e) => {
                      setCustomRegion(e.target.value);
                      if (errors.region) setErrors(prev => ({ ...prev, region: '' }));
                    }}
                    placeholder="Type custom regional deployment site"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-indigo-50/10 dark:bg-indigo-950/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                      errors.region ? 'border-rose-500 bg-rose-50/10' : 'border-indigo-150 dark:border-indigo-900/60'
                    }`}
                  />
                  {errors.region && <p className="text-[11px] text-rose-500 font-medium">{errors.region}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: SYSTEM & HARDWARE DETAILS */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/65 mb-2">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">Step 2 of 3</span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">Hardware Identity and Connections</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Specify device identifiers and physical kit metadata to allow prompt remote lookup.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Anydesk Address */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-indigo-500" />
                    <span>AnyDesk Address</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTooltip('anydesk')}
                    className="text-slate-400 hover:text-indigo-500 transition-colors p-0.5"
                    title="Help details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </label>
                
                {activeTooltip === 'anydesk' && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100/40 dark:border-indigo-900/40 p-2.5 rounded-lg animate-fadeIn mb-1">
                    <span>{tooltips.anydesk}</span>
                  </div>
                )}

                <div className="relative">
                  <input
                    id="form-anydesk-address"
                    type="text"
                    value={anydeskAddress}
                    onChange={(e) => {
                      setAnydeskAddress(e.target.value);
                      if (errors.anydeskAddress) setErrors(prev => ({ ...prev, anydeskAddress: '' }));
                    }}
                    placeholder="e.g. AD-123-456-789"
                    className={`w-full px-4 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all font-mono ${
                      errors.anydeskAddress ? 'border-rose-500 bg-rose-50/10' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {isFieldValid('anydeskAddress') && (
                    <Check className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                {errors.anydeskAddress && <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.anydeskAddress}</p>}
              </div>

              {/* Device Type Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Biometric Device Type</span>
                </label>
                <select
                  id="form-device-type-select"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {DEVICE_TYPES.map((dt) => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>

              {/* Kit Number */}
              <div className="space-y-1.5 relative col-span-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Kit Number (Serial Tag)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTooltip('kit')}
                    className="text-slate-400 hover:text-indigo-500 transition-colors p-0.5"
                    title="Help details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </label>

                {activeTooltip === 'kit' && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100/40 dark:border-indigo-900/40 p-2.5 rounded-lg animate-fadeIn mb-1">
                    <span>{tooltips.kit}</span>
                  </div>
                )}

                <div className="relative">
                  <input
                    id="form-kit-number"
                    type="text"
                    value={kitNumber}
                    onChange={(e) => {
                      setKitNumber(e.target.value);
                      if (errors.kitNumber) setErrors(prev => ({ ...prev, kitNumber: '' }));
                    }}
                    placeholder="e.g. BREBA0123, EID9876, EMP4432"
                    className={`w-full px-4 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all font-mono ${
                      errors.kitNumber ? 'border-rose-500 bg-rose-50/10' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {isFieldValid('kitNumber') && (
                    <Check className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                {errors.kitNumber && <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.kitNumber}</p>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: TECHNICAL FAULTS & IMAGE UPLOAD */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-200/40 dark:border-slate-800/65 mb-2">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">Step 3 of 3</span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">Issue Categories and Triage description</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Select the affected peripherals, upload optional fault evidence photos, and describe the system crash state.</p>
            </div>

            {/* Issue Types Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Issue Categories (Select all that apply)</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleTooltip('issues')}
                  className="text-slate-400 hover:text-indigo-500 transition-colors p-0.5"
                  title="Help details"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>

              {activeTooltip === 'issues' && (
                <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100/40 dark:border-indigo-900/40 p-2.5 rounded-lg animate-fadeIn mb-1">
                  <span>{tooltips.issues}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/60 max-h-48 overflow-y-auto custom-scrollbar">
                {ISSUE_TYPES.map((option) => {
                  const isChecked = selectedIssueTypes.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer select-none transition-all duration-150 ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-300 dark:hover:bg-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleIssueType(option)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Issue Description */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Issue Detailed Description</span>
                {isFieldValid('issueDescription') && (
                  <span className="text-emerald-500 text-[10px] font-bold flex items-center gap-0.5">
                    <Check className="w-3 h-3 stroke-[3px]" /> Ready
                  </span>
                )}
              </label>
              <textarea
                id="form-issue-description"
                rows={4}
                value={issueDescription}
                onChange={(e) => {
                  setIssueDescription(e.target.value);
                  if (errors.issueDescription) setErrors(prev => ({ ...prev, issueDescription: '' }));
                }}
                placeholder="Describe the technical issue, system crash sequence, or peripheral error in detail..."
                className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all font-sans leading-relaxed ${
                  errors.issueDescription ? 'border-rose-500 bg-rose-50/10' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.issueDescription && <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.issueDescription}</p>}
            </div>
          </div>
        )}

        {/* Form Footer Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/60">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors border border-slate-200 dark:border-slate-750 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/50 dark:border-slate-800/60 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
          
          <div>
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2.5 cursor-pointer rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>Continue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2.5 cursor-pointer rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Store & Submit Ticket</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
