/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Ticket } from '../types';
import { 
  CalendarRange, ShieldAlert, CheckCircle2, Loader2, AlertCircle, Users, 
  LayoutDashboard, TrendingUp, Download
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { api } from '../lib/api';

interface AdminDashboardProps {
  tickets: Ticket[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ tickets }) => {
  const [isExportingHw, setIsExportingHw] = useState(false);

  // Dynamic Activity Trend State Hooks
  const [trendRange, setTrendRange] = useState<number>(7); // 7, 15, 30, 60, 90 days
  const [trendType, setTrendType] = useState<string>('ALL'); // 'ALL', 'HW', 'SUPPORT'
  const [trendRegion, setTrendRegion] = useState<string>('ALL'); // 'ALL', or specific region
  const [trendPartner, setTrendPartner] = useState<string>('ALL'); // 'ALL', or specific partner

  const handleExportHardwareCSV = async () => {
    setIsExportingHw(true);
    try {
      const allTickets = await api.getTickets();
      const hwTickets = allTickets.filter(t => t.id && t.id.startsWith("HW-"));

      if (hwTickets.length === 0) {
        alert("No hardware logs found to export.");
        setIsExportingHw(false);
        return;
      }

      // Define headers matching the hardware table columns
      const headers = [
        'Hardware ID',
        'Log Date',
        'Officer Name',
        'Phone',
        'Partner',
        'Region',
        'Registration Center Name',
        'Kit Type',
        'Kit Number',
        'Issue Types',
        'Issue Description',
        'Verified By',
        'Date Verified',
        'Status',
        'Hardware Issue Status',
        'Resolution Method',
        'Replacement Source',
        'Created At',
        'Updated At'
      ];

      // Map hardware tickets to CSV rows
      const rows = hwTickets.map(h => [
        h.id,
        h.date || '',
        h.officerName || '',
        h.phone || '',
        h.partner || '',
        h.region || '',
        h.regCenterName || '',
        h.kitType || h.deviceType || '',
        h.kitNumber || '',
        Array.isArray(h.issueTypes) ? h.issueTypes.join('; ') : (h.issueTypes || ''),
        h.issueDescription || '',
        h.verifiedBy || '',
        h.dateVerified || '',
        h.status || '',
        h.hwIssueStatus || '',
        h.hwResolutionMethod || '',
        h.hwReplacementSource || '',
        h.createdAt || '',
        h.updatedAt || ''
      ]);

      // Format fields with quotes and handle special characters
      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(val => {
          const escaped = String(val).replace(/"/g, '""');
          if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
            return `"${escaped}"`;
          }
          return escaped;
        }).join(','))
      ].join('\n');

      // Create a download blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hardware_logs_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export hardware logs:", err);
      alert("Failed to export hardware logs. Please try again.");
    } finally {
      setIsExportingHw(false);
    }
  };

  // Get current date parts
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM
  const currentYearPrefix = todayStr.substring(0, 4);  // YYYY

  // Calculate stats dynamically
  const todayCount = tickets.filter(t => t.date === todayStr).length;
  
  const monthCount = tickets.filter(t => {
    return t.date.startsWith(currentMonthPrefix);
  }).length;

  const yearCount = tickets.filter(t => {
    return t.date.startsWith(currentYearPrefix);
  }).length;

  const statusCounts = {
    Open: tickets.filter(t => t.status === 'Open').length,
    'In Review': tickets.filter(t => t.status === 'In Review').length,
    Done: tickets.filter(t => t.status === 'Done').length,
  };

  const assignedCount = tickets.filter(t => !!t.assignedTo).length;

  // Calculate hardware issue stats (Resolved vs Under Repair)
  const resolvedHwCount = tickets.filter(t => t.hwIssueStatus === 'Resolved').length;
  const underRepairHwCount = tickets.filter(t => t.hwIssueStatus === 'Under Repair').length;
  const totalHwCount = resolvedHwCount + underRepairHwCount;
  const resolvedHwPct = totalHwCount > 0 ? Math.round((resolvedHwCount / totalHwCount) * 100) : 0;
  const underRepairHwPct = totalHwCount > 0 ? Math.round((underRepairHwCount / totalHwCount) * 100) : 0;

  const hwBarData = [
    {
      name: 'Resolved',
      percentage: resolvedHwPct,
      count: resolvedHwCount,
      color: '#10b981', // emerald-500
    },
    {
      name: 'Under Repair',
      percentage: underRepairHwPct,
      count: underRepairHwCount,
      color: '#f59e0b', // amber-500
    }
  ];

  const staffCounts: Record<string, number> = {};

  // Extract unique regions and partners for selectors
  const uniqueRegions = React.useMemo(() => {
    return Array.from(new Set(tickets.map(t => t.region).filter(Boolean))).sort();
  }, [tickets]);

  const uniquePartners = React.useMemo(() => {
    return Array.from(new Set(tickets.map(t => t.partner).filter(Boolean))).sort();
  }, [tickets]);

  // Generate the dynamic trend chart data based on range and active filters
  const trendFilteredTickets = React.useMemo(() => {
    return tickets.filter(t => {
      if (trendType === 'HW' && !t.id.startsWith('HW-')) return false;
      if (trendType === 'SUPPORT' && t.id.startsWith('HW-')) return false;
      if (trendRegion !== 'ALL' && t.region !== trendRegion) return false;
      if (trendPartner !== 'ALL' && t.partner !== trendPartner) return false;
      return true;
    });
  }, [tickets, trendType, trendRegion, trendPartner]);

  const chartData = React.useMemo(() => {
    return Array.from({ length: trendRange }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - ((trendRange - 1) - i));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const formattedLabel = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      const count = trendFilteredTickets.filter(t => t.date === dateStr).length;
      return {
        name: formattedLabel,
        'Tickets Logged': count,
      };
    });
  }, [trendFilteredTickets, trendRange, todayStr]);

  const partnerCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  const staffWorkload: Record<string, { staff: string, Open: number, 'In Review': number, Done: number, total: number }> = {};

  tickets.forEach(t => {
    if (t.partner) {
      partnerCounts[t.partner] = (partnerCounts[t.partner] || 0) + 1;
    }
    if (t.region) {
      regionCounts[t.region] = (regionCounts[t.region] || 0) + 1;
    }
    if (t.assignedTo) {
      staffCounts[t.assignedTo] = (staffCounts[t.assignedTo] || 0) + 1;
      
      if (!staffWorkload[t.assignedTo]) {
        staffWorkload[t.assignedTo] = { staff: t.assignedTo, Open: 0, 'In Review': 0, Done: 0, total: 0 };
      }
      if (t.status === 'Open' || t.status === 'In Review' || t.status === 'Done') {
        staffWorkload[t.assignedTo][t.status]++;
      }
      staffWorkload[t.assignedTo].total++;
    }
  });

  const staffWorkloadData = Object.values(staffWorkload).sort((a, b) => b.total - a.total);

  // Calculate highest count for partner relative scaling
  const maxPartnerCount = Math.max(...Object.values(partnerCounts), 1);
  const maxRegionCount = Math.max(...Object.values(regionCounts), 1);

  // Transform partner counts for Recharts Pie Chart
  const partnerData = Object.entries(partnerCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const PARTNER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6'];

  const handleExportCSV = () => {
    // Define headers
    const headers = [
      'Ticket Reference', 
      'Log Date', 
      'Supervisor Name', 
      'Contact Phone', 
      'Partner', 
      'Region', 
      'Anydesk Address', 
      'Device Type', 
      'Kit Number', 
      'Issue Description', 
      'Current Status', 
      'Resolution Notes', 
      'Responder Name',
      'Assigned Support Staff',
      'Created At',
      'Updated At'
    ];

    // Map tickets data
    const rows = tickets.map(t => [
      t.id,
      t.date || '',
      t.officerName || '',
      t.phone || '',
      t.partner || '',
      t.region || '',
      t.anydeskAddress || '',
      t.deviceType || '',
      t.kitNumber || '',
      t.issueDescription || '',
      t.status || '',
      t.responseText || '',
      t.responderName || '',
      t.assignedTo || 'Unassigned',
      t.createdAt || '',
      t.updatedAt || ''
    ]);

    // Format fields with quotes and handle special characters
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => {
        const escaped = String(val).replace(/"/g, '""');
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
          return `"${escaped}"`;
        }
        return escaped;
      }).join(','))
    ].join('\n');

    // Create a download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `support_tickets_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="admin-dashboard-root" className="space-y-6">
      <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Admin Dashboard
              </h2>
            </div>

            <button
              id="btn-export-csv"
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-1.5 px-4 py-2 hover:cursor-pointer rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs hover:shadow-md transition-all active:scale-95"
              title="Export tickets list to Excel/CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to CSV</span>
            </button>
          </div>

          {/* Grid of KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Today */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  Tickets Logged Today
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {todayCount}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">tickets</span>
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-xl text-indigo-600 dark:text-indigo-400">
                <CalendarRange className="w-6 h-6" />
              </div>
            </div>

            {/* This Month */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  Logged This Month ({today.toLocaleString('default', { month: 'short' })})
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {monthCount}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">tickets</span>
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* This Year */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  Logged This Year ({currentYearPrefix})
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {yearCount}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">total logged</span>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl text-amber-500">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Grid: Trends and Hardware Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Dynamic Interactive Ticket Volume Activity Chart */}
            <div id="admin-activity-trends" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      <span>{trendRange}-Day Volume Activity Trends</span>
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Flow trends showing the total tickets logged day-by-day
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100/30">
                      Avg/Day: {Math.round((chartData.reduce((acc, curr) => acc + curr['Tickets Logged'], 0) / trendRange) * 10) / 10} tkts
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      Total Last {trendRange} Days: {chartData.reduce((acc, curr) => acc + curr['Tickets Logged'], 0)}
                    </span>
                  </div>
                </div>

                {/* Interactive Filtering Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5 mb-5 p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-850">
                  {/* Range Select */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Range:</span>
                    <select
                      value={trendRange}
                      onChange={(e) => setTrendRange(Number(e.target.value))}
                      className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
                    >
                      <option value={7}>7 Days</option>
                      <option value={15}>15 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={60}>60 Days</option>
                      <option value={90}>90 Days</option>
                    </select>
                  </div>

                  {/* Type Select */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Type:</span>
                    <select
                      value={trendType}
                      onChange={(e) => setTrendType(e.target.value)}
                      className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
                    >
                      <option value="ALL">All Types</option>
                      <option value="HW">Hardware Only</option>
                      <option value="SUPPORT">Support Only</option>
                    </select>
                  </div>

                  {/* Region Select */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Region:</span>
                    <select
                      value={trendRegion}
                      onChange={(e) => setTrendRegion(e.target.value)}
                      className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
                    >
                      <option value="ALL">All Regions</option>
                      {uniqueRegions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Partner Select */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">Partner:</span>
                    <select
                      value={trendPartner}
                      onChange={(e) => setTrendPartner(e.target.value)}
                      className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden border-none p-0 pr-1 font-semibold cursor-pointer"
                    >
                      <option value="ALL">All Partners</option>
                      {uniquePartners.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reset Filters button */}
                  {(trendRange !== 7 || trendType !== 'ALL' || trendRegion !== 'ALL' || trendPartner !== 'ALL') && (
                    <button
                      onClick={() => {
                        setTrendRange(7);
                        setTrendType('ALL');
                        setTrendRegion('ALL');
                        setTrendPartner('ALL');
                      }}
                      className="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 20, left: -25, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4338ca" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4338ca" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        allowDecimals={false}
                        dx={-5}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#1e293b',
                          borderRadius: '12px',
                          color: '#f8fafc',
                          fontSize: '12.5px',
                          fontFamily: 'Inter, sans-serif',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
                        }}
                        itemStyle={{ color: '#818cf8', fontWeight: 'semibold' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                        cursor={{ stroke: 'rgba(99, 102, 241, 0.2)', strokeWidth: 1 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Tickets Logged"
                        stroke="#6366f1"
                        strokeWidth={3}
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                        dot={{ stroke: '#6366f1', strokeWidth: 2, r: 4, fill: '#ffffff' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Hardware Ticket Status Summary Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs lg:col-span-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Hardware Issue Rate</span>
                  </h3>
                  <button
                    id="btn-export-hw-csv"
                    disabled={isExportingHw}
                    onClick={handleExportHardwareCSV}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 hover:cursor-pointer disabled:cursor-not-allowed rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white shadow-xs hover:shadow-sm transition-all active:scale-95"
                    title="Export hardware logs to CSV"
                  >
                    {isExportingHw ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    <span>Export Logs</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">
                  Resolved vs Under Repair hardware tickets
                </p>

                {totalHwCount === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-150 dark:border-slate-800 rounded-xl p-4 text-center">
                    <AlertCircle className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-2" />
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">No hardware tickets tracked yet.</span>
                    <span className="text-[10px] text-slate-400/80 dark:text-slate-600 mt-1">Please log or update tickets with hardware status to view metrics.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800/50 pb-3">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Total Tracked:</span>
                        <span className="ml-1.5 font-mono font-bold text-slate-800 dark:text-slate-200">{totalHwCount}</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                          {resolvedHwPct}% OK
                        </span>
                        <span className="text-amber-600 dark:text-amber-500 font-semibold font-mono">
                          {underRepairHwPct}% IP
                        </span>
                      </div>
                    </div>

                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={hwBarData}
                          margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#64748b" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#64748b" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            domain={[0, 100]}
                            unit="%"
                            allowDecimals={false}
                          />
                          <Tooltip
                            formatter={(value: any, name: any, props: any) => [`${value}% (${props.payload.count} tickets)`, 'Percentage']}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#1e293b',
                              borderRadius: '8px',
                              color: '#f8fafc',
                              fontSize: '11px',
                            }}
                          />
                          <Bar dataKey="percentage" radius={[4, 4, 0, 0]} barSize={36}>
                            {hwBarData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Grid: Status and Partner Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Status Breakdown Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs lg:col-span-1">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider font-mono">
                Ticket Status Overview
              </h3>
              
              <div className="space-y-4">
                {/* Open */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>Open / Pending</span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">
                      {statusCounts.Open} ({tickets.length ? Math.round((statusCounts.Open / tickets.length) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-500"
                      style={{ width: `${tickets.length ? (statusCounts.Open / tickets.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* In Review */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>In Review / Active</span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">
                      {statusCounts['In Review']} ({tickets.length ? Math.round((statusCounts['In Review'] / tickets.length) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${tickets.length ? (statusCounts['In Review'] / tickets.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Done */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Resolved / Done</span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">
                      {statusCounts.Done} ({tickets.length ? Math.round((statusCounts.Done / tickets.length) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${tickets.length ? (statusCounts.Done / tickets.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Assigned Tech Coverage */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                      <span>Assigned Tech Coverage</span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">
                      {assignedCount} / {tickets.length} ({tickets.length ? Math.round((assignedCount/ tickets.length) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${tickets.length ? (assignedCount / tickets.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Total Managed State System: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{tickets.length}</span> tickets
                </span>
              </div>
            </div>

            {/* Staff Workload Distribution Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs lg:col-span-1">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider font-mono">
                Support Staff Workload
              </h3>
              <div className="h-[250px] w-full mt-4">
                {staffWorkloadData.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6 font-medium font-sans">No assigned workloads yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={staffWorkloadData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="staff" tick={{ fontSize: 12 }} stroke="#64748b" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                        itemStyle={{ color: '#f8fafc' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Open" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="In Review" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Done" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Partner Breakdown Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-xs lg:col-span-1">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider font-mono">
                Ticket Counts by Partner Agency
              </h3>
              
              <div className="h-64 w-full flex flex-col justify-between">
                {partnerData.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No partner allocations logged yet.</p>
                ) : (
                  <>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={partnerData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {partnerData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PARTNER_COLORS[index % PARTNER_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#1e293b',
                              borderRadius: '12px',
                              color: '#f8fafc',
                              fontSize: '12px',
                              fontFamily: 'Inter, sans-serif',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
                            }}
                            itemStyle={{ fontWeight: 'semibold' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Elegant custom Legend for Partner breakdown */}
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {partnerData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-1.5 min-w-[70px]">
                          <div 
                            className="w-2.5 h-2.5 rounded-xs shrink-0" 
                            style={{ backgroundColor: PARTNER_COLORS[index % PARTNER_COLORS.length] }} 
                          />
                          <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[80px]" title={entry.name}>
                            {entry.name}
                          </span>
                          <span className="text-slate-850 dark:text-slate-200 font-mono font-bold">
                            ({entry.value})
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
      </div>
    </div>
  );
};
