/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Ticket, TicketStatus, UserRole } from '../types';
import { 
  ArrowLeft, Calendar, User, Phone, Briefcase, MapPin, Monitor, 
  MessageSquareCode, ShieldCheck, CheckCircle2, Loader2, AlertCircle, Sparkles, Clock, Printer
} from 'lucide-react';
import { api } from '../lib/api';
import { SUPPORT_STAFF, PARTNERS, REGIONS, DEVICE_TYPES, ISSUE_TYPES } from '../data';

interface TicketDetailProps {
  ticket: Ticket;
  userRole: UserRole;
  userName: string;
  onUpdateTicket: (id: string, updatedFields: Partial<Ticket>) => void;
  onGoBack: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  userRole,
  userName,
  onUpdateTicket,
  onGoBack
}) => {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [responseText, setResponseText] = useState(ticket.responseText || '');
  const [assignedToState, setAssignedToState] = useState(ticket.assignedTo || '');
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [hwIssueStatus, setHwIssueStatus] = useState<string>(ticket.hwIssueStatus || '');
  const [hwResolutionMethod, setHwResolutionMethod] = useState<string>(ticket.hwResolutionMethod || '');
  const [hwReplacementSource, setHwReplacementSource] = useState<string>(ticket.hwReplacementSource || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  const handleHwIssueStatusChange = (val: string) => {
    setHwIssueStatus(val);
    setValidationError(null);
    if (val !== 'Resolved') {
      setHwResolutionMethod('');
      setHwReplacementSource('');
    }
  };

  const handleHwResolutionMethodChange = (val: string) => {
    setHwResolutionMethod(val);
    setValidationError(null);
    if (val !== 'Replacement') {
      setHwReplacementSource('');
    }
  };

  const handleAISuggest = async () => {
    setIsGenerating(true);
    setAiError(null);
    try {
      const response = await api.suggestReply({
        issueDescription: ticket.issueDescription,
        anydeskAddress: ticket.anydeskAddress,
        deviceType: ticket.deviceType,
        partner: ticket.partner,
        region: ticket.region
      });
      if (response && response.suggestion) {
        setResponseText(response.suggestion);
      } else {
        setAiError("Received empty response from the AI");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Failed to generate AI suggestion");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation before submission
    if (hwIssueStatus === 'Resolved') {
      if (!hwResolutionMethod) {
        setValidationError('Please select a Resolution Method when Status is "Resolved".');
        return;
      }
      if (hwResolutionMethod === 'Replacement' && !hwReplacementSource) {
        setValidationError('Please select a Replacement Source when Resolution Method is "Replacement".');
        return;
      }
    }

    onUpdateTicket(ticket.id, {
      status,
      assignedTo: assignedToState || undefined,
      responseText: responseText.trim() ? responseText.trim() : undefined,
      responderName: responseText.trim() ? `${userName} (Admin)` : undefined,
      hwIssueStatus: hwIssueStatus || undefined,
      hwResolutionMethod: hwResolutionMethod || undefined,
      hwReplacementSource: hwReplacementSource || undefined,
      updatedAt: new Date().toISOString()
    });
    setIsSuccessMessage(true);
    setTimeout(() => {
      setIsSuccessMessage(false);
    }, 3000);
  };

  return (
    <div id="ticket-detail-root" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto space-y-6">
      
      {/* Back Header navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={onGoBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Cockpit Directory</span>
        </button>

        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/40 dark:border-slate-800/60">
          Ref: {ticket.id}
        </span>
      </div>

      {/* Main Grid: Ticket Meta details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: School/Center and Context Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest font-mono">
              Anydesk Connection Profile
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug font-mono">
              {ticket.anydeskAddress}
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
              Unique Remote Node Identifier
            </p>
          </div>

          {/* Ticket Information Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Officer Meta */}
            <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 space-y-1">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                <User className="w-3 h-3 text-indigo-500" />
                <span>Logging Supervisor</span>
              </span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {ticket.officerName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {ticket.phone}
              </p>
            </div>

            {/* Date block */}
            <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 space-y-1">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>Ticket Date Logged</span>
              </span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {ticket.date}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
              </p>
            </div>

            {/* Partner Agency */}
            <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 space-y-1">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-indigo-500" />
                <span>Partner Allocation</span>
              </span>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide font-mono truncate" title={ticket.partner}>
                {ticket.partner}
              </p>
            </div>

            {/* Georeference and Hardware */}
            <div className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 space-y-1">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indigo-500" />
                <span>Region & Hardware Specs</span>
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {ticket.region} (Kit: {ticket.kitNumber})
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold uppercase mt-1">
                Device: {ticket.deviceType}
              </p>
            </div>



            {/* Assigned Technical Assistant */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-900/10 space-y-1 col-span-1 sm:col-span-2 md:col-span-3">
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                <User className="w-3 h-3 text-indigo-500 animate-pulse" />
                <span>Assigned Technical Support Specialist</span>
              </span>
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                {ticket.assignedTo ? `✓ ${ticket.assignedTo} (Assigned)` : '⚠ Unassigned / Open Pool'}
              </p>
            </div>

          </div>

          {/* Selected Issue Types */}
          {Array.isArray(ticket.issueTypes) && ticket.issueTypes.filter(tag => typeof tag === 'string').length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>Identified Hardware/Software Tags ({ticket.issueTypes.filter(tag => typeof tag === 'string').length})</span>
              </h3>
              <div className="flex flex-wrap gap-1.5 p-3.5 rounded-2xl bg-indigo-50/10 dark:bg-indigo-950/20 border border-slate-100 dark:border-slate-800/60 shadow-2xs">
                {ticket.issueTypes.filter(tag => typeof tag === 'string').map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100/50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/40"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Issue Statement representation */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
              Problem Description Summary
            </h3>
            <div className="p-4 rounded-2xl bg-amber-50/20 dark:bg-amber-950/10 border border-amber-100/60 dark:border-amber-900/10 text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-line font-sans shadow-2xs">
              {ticket.issueDescription}
            </div>
          </div>


          <div className="hidden space-y-3 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 shadow-2xs">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-2 pb-2 border-b border-slate-200/20">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>3. Tech Support Verification Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase font-mono block">Who Verified / Checked the Issue</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100/45 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-850">
                  {ticket.verifiedBy || "Not Specified"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase font-mono block">Date Verified</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100/45 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:bg-slate-850">
                  {ticket.verifiedDate || "Not Specified"}
                </p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase font-mono block">Tech Support Brief Comment / Action Taken</span>
                <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/10 rounded-xl text-xs text-slate-700 dark:text-slate-350 leading-relaxed italic">
                  "{ticket.verificationComment || "No comments registered."}"
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Dynamic Status and Admin Response Workroom */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Current Status Badge Widget */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block font-mono">
              Current Ticket State
            </span>
            <div className="flex items-center gap-2">
              {ticket.status === 'Open' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Open / Pending</span>
                </span>
              ) : ticket.status === 'In Review' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>In Review</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resolved / Done</span>
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-850 text-[11px] text-slate-450 dark:text-slate-500 space-y-1">
              <div>Logged: <span className="font-mono">{new Date(ticket.createdAt).toLocaleString()}</span></div>
              {ticket.updatedAt && (
                <div>Updated: <span className="font-mono">{new Date(ticket.updatedAt).toLocaleString()}</span></div>
              )}
            </div>
          </div>

          {/* Hardware Intervention Status Badge Widget */}
          {ticket.hwIssueStatus && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 animate-fadeIn">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block font-mono">
                Hardware Status
              </span>
              <div className="space-y-3">
                <div>
                  {ticket.hwIssueStatus === 'Resolved' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Resolved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse">
                      Under Repair
                    </span>
                  )}
                </div>
                
                {ticket.hwResolutionMethod && (
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block font-mono">
                      Resolution Method
                    </span>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {ticket.hwResolutionMethod}
                    </p>
                  </div>
                )}
                
                {ticket.hwReplacementSource && (
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block font-mono">
                      Replacement Source
                    </span>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {ticket.hwReplacementSource}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin response timeline details summary (User View) */}
          {!isAdmin && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-4">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block font-mono">
                Official Admin Response
              </span>

              {ticket.responseText ? (
                <div className="space-y-2.5">
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic whitespace-pre-line">
                    "{ticket.responseText}"
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Replied by: {ticket.responderName}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Clock className="w-5 h-5 text-slate-400 mx-auto stroke-1.5 mb-1 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-500">Awaiting support reply</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Admin personnel will review soon.</p>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Admin actions (Only active if user has role === admin) */}
      {isAdmin && (
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <form onSubmit={handleUpdate} className="space-y-4 bg-indigo-50/10 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-200/40 dark:border-indigo-900/30">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Intervention Workshop</span>
              </h3>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-medium px-2 py-0.5 rounded-sm">
                Signed in as: {userName}
              </span>
            </div>

            {isSuccessMessage && (
              <div className="p-3 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">
                ✓ Ticket successfully updated. All changes have been synchronized to client storage.
              </div>
            )}

            {validationError && (
              <div className="p-3 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-medium animate-fadeIn flex items-center gap-2 border border-rose-200/50 dark:border-rose-900/30">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Hardware Intervention Workshop Form */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-150/40 dark:border-indigo-900/30 space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <h4 className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">
                  Hardware Workshop Actions
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Issue Status (Resolved, Under Repair) */}
                <div className="space-y-1.5">
                  <label htmlFor="hw-issue-status" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block font-sans">
                    Issue Status
                  </label>
                  <select
                    id="hw-issue-status"
                    value={hwIssueStatus}
                    onChange={(e) => handleHwIssueStatusChange(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all"
                  >
                    <option value="">-- No Action / Untracked --</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Under Repair">Under Repair</option>
                  </select>
                </div>

                {/* Resolution Method (Visible only if status is Resolved) */}
                {hwIssueStatus === 'Resolved' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label htmlFor="hw-res-method" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block font-sans">
                      Resolution Method
                    </label>
                    <select
                      id="hw-res-method"
                      value={hwResolutionMethod}
                      onChange={(e) => handleHwResolutionMethodChange(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all"
                    >
                      <option value="">-- Select Method --</option>
                      <option value="Repaired/Maintained">Repaired/Maintained</option>
                      <option value="Replacement">Replacement</option>
                    </select>
                  </div>
                )}

                {/* Replacement Source (Visible only if status is Resolved and method is Replacement) */}
                {hwIssueStatus === 'Resolved' && hwResolutionMethod === 'Replacement' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label htmlFor="hw-repl-source" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block font-sans">
                      Replacement Source
                    </label>
                    <select
                      id="hw-repl-source"
                      value={hwReplacementSource}
                      onChange={(e) => {
                        setHwReplacementSource(e.target.value);
                        setValidationError(null);
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all"
                    >
                      <option value="">-- Select Source --</option>
                      <option value="New Spare">New Spare</option>
                      <option value="From This Kit">From This Kit</option>
                    </select>
                  </div>
                )}

              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Status Select */}
              <div className="space-y-1 md:col-span-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block font-sans">
                  Assign Status
                </label>
                <select
                  id="admin-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  className="w-full py-2 px-3 rounded-b-xl rounded-t-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer animate-fadeIn"
                >
                  <option value="Open">Open / Pending</option>
                  <option value="In Review">In Review</option>
                  <option value="Done">Resolved / Done</option>
                </select>
              </div>

              {/* Assign To Support Person Dropdown for Admin */}
              <div className="space-y-1 md:col-span-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block font-sans">
                  Assigned Support Staff
                </label>
                <select
                  id="admin-assignee"
                  value={assignedToState}
                  onChange={(e) => setAssignedToState(e.target.value)}
                  className="w-full py-2 px-3 rounded-b-xl rounded-t-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer animate-fadeIn"
                >
                  <option value="">Unassigned (Open pool)</option>
                  {SUPPORT_STAFF.map((staff) => (
                    <option key={staff} value={staff}>{staff}</option>
                  ))}
                </select>
              </div>

              {/* Response input text */}
              <div className="space-y-1 md:col-span-6">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                    Append Technical Response / Remarks
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleAISuggest}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 bg-white dark:bg-slate-950 border border-indigo-200/40 dark:border-indigo-900/40 px-2 py-1 rounded-lg transition-all disabled:opacity-50 tracking-tight cursor-pointer shadow-2xs hover:shadow-xs"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                        <span>Analyzing with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                        <span>AI Suggest Reply</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  id="admin-comment"
                  type="text"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="e.g. Swapped component cable. Issue confirmed and closed."
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                
                {aiError && (
                  <p className="text-[10px] text-rose-500 font-mono mt-1">
                    Error: {aiError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-850/50 text-right">
              <button
                type="submit"
                className="px-5 py-2 hover:cursor-pointer rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Apply Status & Reply</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
