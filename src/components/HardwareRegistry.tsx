import React, { useState, useMemo } from 'react';
import { Ticket, TicketStatus } from '../types';
import { 
  Search, ClipboardList, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, RefreshCw,
  Cpu, MapPin, ShieldAlert, BadgeCheck, FileSpreadsheet, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface HardwareRegistryProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

export const HardwareRegistry: React.FC<HardwareRegistryProps> = ({ tickets, onSelectTicket }) => {
  // Filter for only hardware database records (IDs starting with HW-)
  const hardwareRecords = useMemo(() => {
    return tickets.filter(t => t.id.startsWith('HW-'));
  }, [tickets]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtering state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [hwStatusFilter, setHwStatusFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'id-desc'>('date-desc');

  // Dynamic filter lists
  const uniqueRegions = useMemo(() => {
    const list = new Set<string>();
    hardwareRecords.forEach(r => { if (r.region) list.add(r.region); });
    return Array.from(list).sort();
  }, [hardwareRecords]);

  // Handle Reset
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setHwStatusFilter('ALL');
    setRegionFilter('ALL');
    setSortBy('date-desc');
  };

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    return hardwareRecords
      .filter(r => {
        const matchesSearch = 
          r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.officerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.regCenterName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.kitNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.kitType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.verifiedBy || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.issueDescription || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
        const matchesHwStatus = hwStatusFilter === 'ALL' || r.hwIssueStatus === hwStatusFilter;
        const matchesRegion = regionFilter === 'ALL' || r.region === regionFilter;

        return matchesSearch && matchesStatus && matchesHwStatus && matchesRegion;
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
        return 0;
      });
  }, [hardwareRecords, searchTerm, statusFilter, hwStatusFilter, regionFilter, sortBy]);

  // Export to Excel
  const handleExport = () => {
    if (filteredAndSorted.length === 0) {
      alert("No hardware records to export.");
      return;
    }

    const rows = filteredAndSorted.map(r => ({
      'Hardware Record ID': r.id,
      'Log Date': r.date,
      'Officer Name': r.officerName,
      'Contact Phone': r.phone,
      'Partner Agency': r.partner,
      'Region': r.region,
      'Registration Center': r.regCenterName || 'N/A',
      'Kit Number': r.kitNumber,
      'Kit Type': r.kitType || 'N/A',
      'Verified By': r.verifiedBy || 'N/A',
      'Date Verified': r.dateVerified || 'N/A',
      'Hardware Status': r.hwIssueStatus || 'N/A',
      'Ticket Status': r.status,
      'Issue Description': r.issueDescription,
      'Created At': new Date(r.createdAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const colWidths = [
      { wch: 15 }, // Hardware Record ID
      { wch: 12 }, // Log Date
      { wch: 20 }, // Officer Name
      { wch: 15 }, // Phone
      { wch: 15 }, // Partner
      { wch: 15 }, // Region
      { wch: 25 }, // Registration Center
      { wch: 15 }, // Kit Number
      { wch: 15 }, // Kit Type
      { wch: 20 }, // Verified By
      { wch: 15 }, // Date Verified
      { wch: 15 }, // Hardware Status
      { wch: 12 }, // Ticket Status
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hardware Database');
    XLSX.writeFile(workbook, `hardware_table_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const renderStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider">
            <AlertCircle className="w-3 h-3" />
            <span>Open</span>
          </span>
        );
      case 'In Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>In Review</span>
          </span>
        );
      case 'Done':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            <span>Resolved</span>
          </span>
        );
    }
  };

  const renderHwBadge = (hwStatus?: string) => {
    const val = hwStatus || 'Under Repair';
    let color = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/60';
    if (val === 'Functional' || val === 'Delivered' || val === 'Resolved') {
      color = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400';
    } else if (val === 'Under Repair' || val === 'In Workshop') {
      color = 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400';
    } else if (val === 'Needs Replacement' || val === 'Defective') {
      color = 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400';
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>
        {val}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Cards & Info Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
          <Cpu className="w-24 h-24" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg">
                <Layers className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Hardware Table Registry
              </h1>
            </div>
            
          </div>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Table (.xlsx)</span>
          </button>
        </div>

        {/* Stats counter row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/60">
          <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-850/40">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold block">Total Hardware Records</span>
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5 block">{hardwareRecords.length}</span>
          </div>
          <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
            <span className="text-[10px] uppercase tracking-wider text-rose-500 dark:text-rose-400 font-bold block">Open Issues</span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">
              {hardwareRecords.filter(r => r.status === 'Open').length}
            </span>
          </div>
          <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
            <span className="text-[10px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold block">In Review</span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
              {hardwareRecords.filter(r => r.status === 'In Review').length}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
            <span className="text-[10px] uppercase tracking-wider text-emerald-500 dark:text-emerald-400 font-bold block">Resolved Cases</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              {hardwareRecords.filter(r => r.status === 'Done').length}
            </span>
          </div>
        </div>
      </div>

      {/* Table Filters Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID, Officer, Reg Center, Kit Number, Description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 dark:focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Review">In Review</option>
                <option value="Done">Resolved</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hardware Status:</span>
              <select
                value={hwStatusFilter}
                onChange={(e) => setHwStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
              >
                <option value="Functional">Functional</option>
                <option value="Under Repair">Under Repair</option>
                <option value="In Workshop">In Workshop</option>
                <option value="Needs Replacement">Needs Replacement</option>
                <option value="Defective">Defective</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Region:</span>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
              >
                <option value="ALL">All Regions</option>
                {uniqueRegions.map(reg => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="id-desc">ID Descending</option>
              </select>
            </div>

            {(searchTerm || statusFilter !== 'ALL' || hwStatusFilter !== 'ALL' || regionFilter !== 'ALL' || sortBy !== 'date-desc') && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                <th className="py-4 px-5">ID/Ref</th>
                <th className="py-4 px-5">Registration Center</th>
                <th className="py-4 px-5">Officer / Agency</th>
                <th className="py-4 px-5">Kit Info</th>
                <th className="py-4 px-5">Verification</th>
                <th className="py-4 px-5">Hardware status</th>
                <th className="py-4 px-5">Case Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
              {filteredAndSorted.length > 0 ? (
                filteredAndSorted.map((record) => (
                  <tr 
                    key={record.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-all text-xs"
                  >
                    {/* ID */}
                    <td className="py-4 px-5 font-mono font-bold text-slate-900 dark:text-white">
                      {record.id}
                    </td>

                    {/* Registration Center */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                        {record.regCenterName || "N/A Center"}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-300" />
                        <span>{record.region}</span>
                      </div>
                    </td>

                    {/* Officer & Partner */}
                    <td className="py-4 px-5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {record.officerName}
                      </div>
                      <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 font-mono mt-0.5">
                        {record.partner}
                      </div>
                    </td>

                    {/* Kit Info */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {record.kitNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {record.kitType || 'N/A Kit Type'}
                      </div>
                    </td>

                    {/* Verification */}
                    <td className="py-4 px-5">
                      {record.verifiedBy ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="truncate max-w-[120px]">{record.verifiedBy}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">{record.dateVerified}</div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          <ShieldAlert className="w-3 h-3 text-slate-300" />
                          <span>Unverified</span>
                        </span>
                      )}
                    </td>

                    {/* Hardware status badge */}
                    <td className="py-4 px-5">
                      {renderHwBadge(record.hwIssueStatus)}
                    </td>

                    {/* Overall status badge */}
                    <td className="py-4 px-5">
                      {renderStatusBadge(record.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => onSelectTicket(record)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:text-indigo-400 text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ClipboardList className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                      <p className="text-xs font-semibold">No matching hardware database records found.</p>
                      <p className="text-[10px] text-slate-400">Try adjusting your filters or search criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
