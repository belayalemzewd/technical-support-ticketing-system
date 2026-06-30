/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Ticket, TicketStatus, UserRole } from '../types';
import { 
  FileSpreadsheet, Search, Filter, ArrowUpDown, ChevronRight, 
  HelpCircle, CheckCircle2, Loader2, AlertCircle, RefreshCw, Smartphone, 
  Calendar, UserCheck, Tag, Map, LaptopIcon
} from 'lucide-react';
import { PARTNERS, REGIONS } from '../data';

interface TicketListProps {
  tickets: Ticket[];
  userRole: UserRole;
  userEmail: string;
  userName?: string;
  onSelectTicket: (ticket: Ticket) => void;
}

export const TicketList: React.FC<TicketListProps> = ({ 
  tickets, 
  userRole, 
  userEmail,
  userName = '',
  onSelectTicket 
}) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Table level quick filter text input
  const [tableFilterText, setTableFilterText] = useState('');
  
  // Scope filter: default to 'my' for user role to easily monitor their own requests, and 'all' for admin
  const [scopeFilter, setScopeFilter] = useState<'my' | 'all'>(userRole === 'user' ? 'my' : 'all');
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'id-desc' | 'partner-asc'>('date-desc');

  // Dynamic lists of unique partners and regions represented in the files to avoid hardcoding dropdown options
  const uniquePartners = useMemo(() => {
    const list = new Set<string>();
    tickets.forEach(t => { if (t.partner) list.add(t.partner); });
    return Array.from(list).sort();
  }, [tickets]);

  const uniqueRegions = useMemo(() => {
    const list = new Set<string>();
    tickets.forEach(t => { if (t.region) list.add(t.region); });
    return Array.from(list).sort();
  }, [tickets]);

  // Count of current user's support tickets
  const userTicketsCount = useMemo(() => {
    const userLower = (userName || '').toLowerCase();
    const emailPrefix = userEmail ? userEmail.split('@')[0].toLowerCase() : '';
    return tickets.filter(t => 
      t.officerName.toLowerCase() === userLower ||
      t.officerName.toLowerCase().includes(userLower) ||
      (emailPrefix && t.officerName.toLowerCase().includes(emailPrefix))
    ).length;
  }, [tickets, userName, userEmail]);

  // Clean filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPartnerFilter('ALL');
    setRegionFilter('ALL');
    setSortBy('date-desc');
    setTableFilterText('');
    setScopeFilter(userRole === 'user' ? 'my' : 'all');
  };

  // Filter and sort tickets
  const filteredAndSortedTickets = useMemo(() => {
    const userLower = (userName || '').toLowerCase();
    const emailPrefix = userEmail ? userEmail.split('@')[0].toLowerCase() : '';

    return tickets
      .filter(t => {
        // Scope matches (My Tickets vs All Tickets)
        const matchesScope = scopeFilter === 'all' || 
          t.officerName.toLowerCase() === userLower ||
          t.officerName.toLowerCase().includes(userLower) ||
          (emailPrefix && t.officerName.toLowerCase().includes(emailPrefix));

        // Search matches
        const matchesSearch = 
          t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.officerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.anydeskAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.deviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.kitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.issueDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (Array.isArray(t.issueTypes) && t.issueTypes.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(searchTerm.toLowerCase())));

        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
        const matchesPartner = partnerFilter === 'ALL' || t.partner === partnerFilter;
        const matchesRegion = regionFilter === 'ALL' || t.region === regionFilter;

        // Table level quick filter by ID, Partner, or Officer name
        const matchesTableFilter = 
          !tableFilterText.trim() ||
          t.id.toLowerCase().includes(tableFilterText.toLowerCase()) ||
          t.partner.toLowerCase().includes(tableFilterText.toLowerCase()) ||
          t.officerName.toLowerCase().includes(tableFilterText.toLowerCase());

        return matchesScope && matchesSearch && matchesStatus && matchesPartner && matchesRegion && matchesTableFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortBy === 'id-desc') {
          return b.id.localeCompare(a.id);
        }
        if (sortBy === 'partner-asc') {
          return a.partner.localeCompare(b.partner);
        }
        return 0;
      });
  }, [tickets, searchTerm, tableFilterText, statusFilter, partnerFilter, regionFilter, sortBy, scopeFilter, userName, userEmail]);

  // Status badge styling helper
  const renderStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Open</span>
          </span>
        );
      case 'In Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>In Review</span>
          </span>
        );
      case 'Done':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Resolved</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Export currently filtered list to spreadsheet format! It writes genuine row objects
  const handleExportToExcel = () => {
    if (filteredAndSortedTickets.length === 0) {
      alert("No matching tickets found to export.");
      return;
    }

    // Format headers and details cleanly for the spreadsheet
    const excelRows = filteredAndSortedTickets.map((t) => ({
      'Ticket Reference': t.id,
      'Log Date': t.date,
      'Supervisor/Officer': t.officerName,
      'Contact Phone': t.phone,
      'Partner Agency': t.partner,
      'Georeference Region': t.region,
      'Anydesk Address': t.anydeskAddress,
      'Device Type': t.deviceType,
      'Kit Number': t.kitNumber,
      'Issue Description': t.issueDescription,
      'Issue Types': Array.isArray(t.issueTypes) ? t.issueTypes.filter(tag => typeof tag === 'string').join(', ') : 'None',
      'Current Status': t.status,
      'Admin Response/Remarks': t.responseText || 'Pending official reply',
      'Assigned Responder': t.responderName || 'N/A',
      'Assigned Support Staff': t.assignedTo || 'Unassigned',
      'Created Timestamp': new Date(t.createdAt).toLocaleString(),
      'Last Updated Timestamp': new Date(t.updatedAt).toLocaleString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    
    // Set column widths for readability inside Excel
    const colWidths = [
      { wch: 15 }, // Ticket Reference
      { wch: 12 }, // Log Date
      { wch: 22 }, // Supervisor
      { wch: 18 }, // Phone
      { wch: 25 }, // Partner
      { wch: 20 }, // Region
      { wch: 20 }, // Anydesk
      { wch: 15 }, // Device Type
      { wch: 12 }, // Kit
      { wch: 45 }, // Description
      { wch: 15 }, // Status
      { wch: 40 }, // Response
      { wch: 20 }, // Responder
      { wch: 22 }, // Assigned Support Staff
      { wch: 20 }, // Created
      { wch: 20 }, // Updated
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Support Tickets DB');
    
    // Trigger seamless file download
    XLSX.writeFile(workbook, `Ticketing_Support_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div id="ticket-list-root" className="space-y-5">
      
      {/* Top Filter & Export Bar */}
      {userRole === 'admin' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-4">
          
          {/* Row 1: Search Inputs, Excel/CSV Action & Filters reset */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-grow max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                id="search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by officer, issue, kit, anydesk address..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:border-indigo-500 transition-all font-sans"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="reset-filters-btn"
                onClick={handleResetFilters}
                className="px-3.5 py-2 hover:cursor-pointer rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>

              <button
                id="export-excel-btn"
                onClick={handleExportToExcel}
                className="px-4 py-2 hover:cursor-pointer rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs hover:shadow-md transition-all flex items-center gap-2"
                title="Export current table to spreadsheet file"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export to Excel ({filteredAndSortedTickets.length})</span>
              </button>
            </div>
          </div>

          {/* Row 2: Select Pickers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Status Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                <Filter className="w-3 h-3 text-indigo-500" />
                <span>Filter Status</span>
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Open">Open / Pending</option>
                <option value="In Review">In Review</option>
                <option value="Done">Resolved / Done</option>
              </select>
            </div>

            {/* Partner Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-500" />
                <span>Partner Agency</span>
              </label>
              <select
                id="filter-partner"
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Partners</option>
                {uniquePartners.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Region Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                <Map className="w-3 h-3 text-indigo-500" />
                <span>Region Location</span>
              </label>
              <select
                id="filter-region"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Regions</option>
                {uniqueRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Sorter Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-indigo-500" />
                <span>Order List By</span>
              </label>
              <select
                id="filter-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="date-desc">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="id-desc">Ticket Ref (Highest First)</option>
                <option value="partner-asc">Partner Name (A-Z)</option>
              </select>
            </div>
          </div>

        </div>
      )}

      {/* Grid counter overview */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredAndSortedTickets.length}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{userRole === 'admin' ? tickets.length : userTicketsCount}</span> support records
        </span>
        {userRole === 'admin' ? (
          <span className="text-indigo-600 dark:text-indigo-400 font-mono font-medium">Administrator View Modality</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">Operator Account: {userEmail}</span>
        )}
      </div>

      {/* Dynamic Quick Filtering Pane */}
      {userRole === 'admin' && (
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider font-mono">
              Table Quick Filter
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              (Filter by ID, Partner, or Officer)
            </span>
          </div>
          <div className="relative flex-grow sm:max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              id="table-quick-filter"
              type="text"
              value={tableFilterText}
              onChange={(e) => setTableFilterText(e.target.value)}
              placeholder="Search by ID, Partner, or Officer name..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pl-8.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
            />
            {tableFilterText && (
              <button
                onClick={() => setTableFilterText('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-semibold cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Desktop Matrix View (Table) */}
      <div className="hidden md:block overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold tracking-wider uppercase font-mono">
                <th className="px-5 py-4 w-28">Ref Code</th>
                <th className="px-5 py-4 w-32">Log Date</th>
                <th className="px-5 py-4 w-56">AnyDesk & Kit ID</th>
                <th className="px-5 py-4 w-48">Issue Types</th>
                <th className="px-5 py-4">Supervisor & Phone</th>
                <th className="px-5 py-4">Agency & Georeference</th>
                <th className="px-5 py-4 w-28 text-center">Status</th>
                <th className="px-5 py-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredAndSortedTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-500">
                    <HelpCircle className="w-8 h-8 mx-auto stroke-1.5 mb-2.5 opacity-60" />
                    <p className="font-medium text-sm">No support tickets match the filtered criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Adjust search parameters or clear filters is recommended.</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedTickets.map((ticket) => (
                  <tr 
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket)}
                    className="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Ref Code */}
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-slate-950 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-xs group-hover:bg-indigo-50 dark:group-hover:bg-slate-700 transition-colors">
                        {ticket.id}
                      </span>
                    </td>

                    {/* Log Date */}
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {ticket.date}
                    </td>

                    {/* Anydesk & Kit */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white leading-tight font-mono text-xs">
                        {ticket.anydeskAddress}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-1.5 leading-none">
                        <LaptopIcon className="w-3.5 h-3.5 text-indigo-400/80" />
                        <span>Kit: {ticket.kitNumber}</span>
                        <span className="text-slate-200 dark:text-slate-850">•</span>
                        <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[10px] font-semibold">{ticket.deviceType}</span>
                      </div>
                      
                      {ticket.assignedTo ? (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono mt-2 flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100/40 dark:border-indigo-900/10 px-2 py-0.5 rounded-md w-max">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Assigned: {ticket.assignedTo}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold font-mono mt-2 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md w-max border border-slate-100 dark:border-slate-800">
                          <UserCheck className="w-3.5 h-3.5 opacity-60" />
                          <span>Unassigned</span>
                        </div>
                      )}
                    </td>

                    {/* Issue Types */}
                    <td className="px-5 py-4">
                      {Array.isArray(ticket.issueTypes) && ticket.issueTypes.filter(tag => typeof tag === 'string').length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[170px]">
                          {ticket.issueTypes.filter(tag => typeof tag === 'string').map((tag) => (
                            <span key={tag} className="bg-indigo-50/50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 border border-indigo-100/40 dark:border-indigo-900/40 rounded-md px-1.5 py-0.5 text-[10px] font-semibold truncate" title={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 italic font-mono">None</span>
                      )}
                    </td>

                    {/* Supervisor Name / Phone */}
                    <td className="px-5 py-4">
                      <div className="text-slate-700 dark:text-slate-200 font-medium">
                        {ticket.officerName}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        {ticket.phone}
                      </div>
                    </td>

                    {/* Agency / Region */}
                    <td className="px-5 py-4">
                      <div className="text-slate-700 dark:text-slate-200 text-xs font-semibold uppercase tracking-wider font-mono text-indigo-600 dark:text-indigo-400">
                        {ticket.partner}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                        {ticket.region}
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-4 text-center">
                      <div className="inline-block">
                        {renderStatusBadge(ticket.status)}
                      </div>
                      {ticket.responseText || ticket.status === 'Done' ? (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 font-mono">
                          ✓ Responded
                        </div>
                      ) : (
                        <div className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-1 font-mono">
                          ☉ Awaiting Reply
                        </div>
                      )}
                    </td>

                    {/* Action Arrow column */}
                    <td className="px-5 py-4 text-right">
                      <div className="text-slate-450 dark:text-slate-650 group-hover:translate-x-1.5 transition-transform duration-200">
                        <ChevronRight className="w-5 h-5 text-indigo-500" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Feed View (Cards) */}
      <div className="block md:hidden space-y-3">
        {filteredAndSortedTickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 dark:text-slate-500">
            <HelpCircle className="w-8 h-8 mx-auto opacity-50 mb-2" />
            <p className="font-semibold text-sm">No support tickets found.</p>
          </div>
        ) : (
          filteredAndSortedTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticket)}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-3 cursor-pointer hover:border-slate-350 dark:hover:border-slate-700/80 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-950 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-sm">
                  {ticket.id}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  {ticket.date}
                </span>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  Anydesk: {ticket.anydeskAddress}
                </h4>
                <div className="text-xs font-mono text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-1.5">
                  <span>Kit: {ticket.kitNumber}</span>
                  <span>•</span>
                  <span>{ticket.region}</span>
                  <span>•</span>
                  <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1 py-0.2 rounded text-[10px] font-semibold">{ticket.deviceType}</span>
                </div>
                {Array.isArray(ticket.issueTypes) && ticket.issueTypes.filter(tag => typeof tag === 'string').length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {ticket.issueTypes.filter(tag => typeof tag === 'string').map((tag) => (
                      <span key={tag} className="bg-indigo-100/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-350 border border-indigo-200/40 dark:border-indigo-900/30 rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-none">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{ticket.officerName}</p>
                  <p className="text-slate-400 dark:text-slate-500 font-mono">{ticket.partner}</p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono mt-0.5">
                    {ticket.assignedTo ? `Assigned: ${ticket.assignedTo}` : 'Unassigned'}
                  </p>
                </div>
                <div className="text-right">
                  {renderStatusBadge(ticket.status)}
                  {ticket.responseText || ticket.status === 'Done' ? (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 font-mono">
                      ✓ Responded
                    </div>
                  ) : (
                    <div className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-1 font-mono">
                      ☉ Awaiting Reply
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
