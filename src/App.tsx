/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LaptopIcon, ClipboardList, ListCollapse, LogOut, Shield, 
  UserCircle2, HelpCircle, ToggleLeft, PlusCircle, LayoutDashboard,
  Loader2, AlertCircle, Cpu, Layers
} from 'lucide-react';
import nidpLogo from './components/id logo.png';
import { Ticket, User, UserRole, TicketStatus } from './types.ts';
import { INITIAL_TICKETS } from './data.ts';
import { Login } from './components/Login.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { TicketForm } from './components/TicketForm.tsx';
import { HardwareTicketForm } from './components/HardwareTicketForm.tsx';
import { HardwareRegistry } from './components/HardwareRegistry.tsx';
import { TicketList } from './components/TicketList.tsx';
import { TicketDetail } from './components/TicketDetail.tsx';
import { api } from './lib/api.ts';
import { isSupabaseConfigured, getSupabaseClient } from './lib/supabase-client.ts';

export default function App() {
  // --- Persistent Tickets State ---
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const stored = localStorage.getItem('support_tickets_system_db');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing tickets database, resetting.", e);
      }
    }
    return INITIAL_TICKETS;
  });

  // --- Persistent User Session ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('support_user_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing user session.", e);
      }
    }
    return null;
  });

  // --- Theme Mode State ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('support_theme_mode');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return 'light'; // Clean light theme by default
  });

  // --- Layout Views ---
  // Active tab inside Dashboard: 'list' | 'create' | 'dashboard' | 'hardware-ticket' | 'hardware-registry'
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'dashboard' | 'hardware-ticket' | 'hardware-registry'>('list');

  // Set appropriate tab when currentUser loads
  useEffect(() => {
    if (currentUser) {
      setActiveTab(currentUser.role === 'admin' ? 'dashboard' : 'list');
    }
  }, [currentUser]);

  // Guard against admin accessing the hardware-ticket tab
  useEffect(() => {
    if (currentUser && currentUser.role === 'admin' && activeTab === 'hardware-ticket') {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);
  // Selected ticket for detailed intervention/reply view
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // --- DB Synchronization States ---
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');
  const [authInitializing, setAuthInitializing] = useState(true);

  // --- Path / Navigation State (Clean Lightweight Router) ---
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Listen for browser path changes (back/forward behavior)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Monitor Auth state initialization (Firebase or Supabase depending on config)
  useEffect(() => {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      
      // Perform initial check with getSession()
      const initSupabaseSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            localStorage.setItem('support_mock_auth_token', session.access_token);
            const dbUser = await api.syncUser({
              preferredRole: session.user.user_metadata?.role || 'user',
              preferredUsername: session.user.user_metadata?.username || session.user.email?.split('@')[0],
            });
            setCurrentUser(dbUser);
            localStorage.setItem('support_user_session', JSON.stringify(dbUser));
            if (window.location.pathname === '/login') {
              navigate('/');
            }
          } else {
            const storedToken = localStorage.getItem('support_mock_auth_token');
            if (storedToken && storedToken.startsWith('MockToken:')) {
              console.log("[App] Preserving active MockToken session.");
              if (!currentUser) {
                try {
                  const parts = storedToken.split(':');
                  const uid = parts[1];
                  const role = parts[2] as UserRole;
                  const username = decodeURIComponent(parts[3] || '');
                  const email = decodeURIComponent(parts[4] || '');
                  const restoredUser: User = {
                    id: uid,
                    uid,
                    email,
                    username,
                    role,
                    status: 'approved',
                  };
                  setCurrentUser(restoredUser);
                  localStorage.setItem('support_user_session', JSON.stringify(restoredUser));
                } catch (e) {
                  console.warn("Failed to parse mock token in successful session check:", e);
                }
              }
              if (window.location.pathname === '/login') {
                navigate('/');
              }
            } else {
              setCurrentUser(null);
              localStorage.removeItem('support_user_session');
              localStorage.removeItem('support_mock_auth_token');
              if (window.location.pathname !== '/login') {
                navigate('/login');
              }
            }
          }
        } catch (err) {
          console.error("Init Supabase session error (unreachable/failed to fetch):", err);
          const storedToken = localStorage.getItem('support_mock_auth_token');
          if (storedToken && (currentUser || storedToken.startsWith('MockToken:'))) {
            console.log("[App] Unreachable auth service, continuing with existing active session.");
            if (!currentUser && storedToken.startsWith('MockToken:')) {
              try {
                const parts = storedToken.split(':');
                const uid = parts[1];
                const role = parts[2] as UserRole;
                const username = decodeURIComponent(parts[3] || '');
                const email = decodeURIComponent(parts[4] || '');
                const restoredUser: User = {
                  id: uid,
                  uid,
                  email,
                  username,
                  role,
                  status: 'approved',
                };
                setCurrentUser(restoredUser);
                localStorage.setItem('support_user_session', JSON.stringify(restoredUser));
              } catch (e) {
                console.warn("Failed to parse mock token on exception:", e);
              }
            }
          } else {
            setCurrentUser(null);
            localStorage.removeItem('support_user_session');
            localStorage.removeItem('support_mock_auth_token');
            if (window.location.pathname !== '/login') {
              navigate('/login');
            }
          }
        } finally {
          setAuthInitializing(false);
        }
      };

      initSupabaseSession();

      // Listen for updates
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          localStorage.setItem('support_mock_auth_token', session.access_token);
          try {
            const dbUser = await api.syncUser({
              preferredRole: session.user.user_metadata?.role || 'user',
              preferredUsername: session.user.user_metadata?.username || session.user.email?.split('@')[0],
            });
            setCurrentUser(dbUser);
            localStorage.setItem('support_user_session', JSON.stringify(dbUser));
            if (window.location.pathname === '/login') {
              navigate('/');
            }
          } catch (err) {
            console.error("Error syncing user profile:", err);
          }
        } else {
          const storedToken = localStorage.getItem('support_mock_auth_token');
          if (storedToken && storedToken.startsWith('MockToken:')) {
            console.log("[App] Keeping active MockToken session on AuthStateChange null event.");
          } else {
            setCurrentUser(null);
            localStorage.removeItem('support_user_session');
            localStorage.removeItem('support_mock_auth_token');
            if (window.location.pathname !== '/login') {
              navigate('/login');
            }
          }
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    } else {
      setAuthInitializing(false);
    }
  }, []);

  // Sync user/route state if path changes manually (protect private pages)
  useEffect(() => {
    if (isSupabaseConfigured() && !authInitializing) {
      const runPathGuard = async () => {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && currentPath !== '/login') {
          navigate('/login');
        } else if (session && currentPath === '/login') {
          navigate('/');
        }
      };
      runPathGuard();
    }
  }, [currentPath, authInitializing]);

  // Fetch tickets from database once logged in
  useEffect(() => {
    if (currentUser && !authInitializing) {
      const fetchLiveTickets = async () => {
        setDbLoading(true);
        setDbError('');
        try {
          const liveList = await api.getTickets();
          setTickets(liveList);
        } catch (err: any) {
          console.error("Live database query failed:", err);
          setDbError("Database connection unavailable. Operating in offline fallback mode.");
        } finally {
          setDbLoading(false);
        }
      };
      fetchLiveTickets();
    }
  }, [currentUser, authInitializing]);

  // Sync tickets array to LocalStorage when changed (offline backup)
  useEffect(() => {
    localStorage.setItem('support_tickets_system_db', JSON.stringify(tickets));
  }, [tickets]);

  // Sync user session to LocalStorage when changed
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('support_user_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('support_user_session');
    }
  }, [currentUser]);

  // Sync theme and apply class to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('support_theme_mode', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // --- Handlers ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveTab(user.role === 'admin' ? 'dashboard' : 'list');
    setSelectedTicketId(null);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Failed to sign out on Supabase:", e);
      }
    }
    localStorage.removeItem('support_mock_auth_token');
    localStorage.removeItem('support_user_session');
    setCurrentUser(null);
    setSelectedTicketId(null);
    setActiveTab('list');
    navigate('/login');
  };

  const handleCreateTicket = async (ticketData: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    setDbLoading(true);
    setDbError('');
    try {
      const newTkt = await api.createTicket(ticketData);
      setTickets(prev => [newTkt, ...prev]);
      setActiveTab('list');
    } catch (err: any) {
      console.error("Failed to create ticket on live DB:", err);
      const errorMsg = err.message || JSON.stringify(err);
      setDbError(`Server failed to save ticket (${errorMsg}). Creating temporarily in offline local state.`);
      
      let maxNum = 1000;
      tickets.forEach(t => {
        const match = t.id.match(/^TKT-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const nextId = 'TKT-' + (maxNum + 1);
      const newLocalTicket: Ticket = {
        ...ticketData,
        id: nextId,
        status: 'Open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setTickets(prev => [newLocalTicket, ...prev]);
      setActiveTab('list');
    } finally {
      setDbLoading(false);
    }
  };

  const handleUpdateTicket = async (id: string, updatedFields: Partial<Ticket>) => {
    setDbLoading(true);
    setDbError('');
    try {
      const updatedTkt = await api.updateTicket(id, updatedFields);
      setTickets(prev => prev.map(t => (t.id === id ? { ...t, ...updatedTkt } : t)));
    } catch (err: any) {
      console.error("Failed to update ticket on live DB:", err);
      setDbError("Could not persist ticket updates to backend.");
      
      setTickets(prev => prev.map(t => {
        if (t.id === id) {
          return {
            ...t,
            ...updatedFields,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      }));
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    setDbLoading(true);
    setDbError('');
    try {
      await api.deleteTicket(id);
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicketId === id) {
        setSelectedTicketId(null);
      }
    } catch (err: any) {
      console.error("Failed to delete ticket from DB:", err);
      setDbError("Failed to delete the ticket from live database.");
    } finally {
      setDbLoading(false);
    }
  };

  // Safe search for the open selected ticket
  const selectedTicketObj = tickets.find(t => t.id === selectedTicketId) || null;

  if (authInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs font-mono mt-3 text-slate-500 font-semibold animate-pulse">Initializing Portal Session...</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col items-center justify-center relative p-4">
        {/* Visual background decor gradient subtle accents */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-linear-to-b from-indigo-500/5 to-transparent dark:from-indigo-500/10 pointer-events-none" />
        
        {/* Simple top header for guest login */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <div className="w-full max-w-md z-10 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key="login-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <Login onLogin={handleLogin} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col md:flex-row relative">
      
      {/* Visual background decor gradient subtle accents */}
      <div className="absolute top-0 left-0 md:left-64 lg:left-72 right-0 h-96 bg-linear-to-b from-indigo-500/5 to-transparent dark:from-indigo-500/10 pointer-events-none" />

      {/* Persistent Left Sidebar Navigation on Desktop */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-800/60 h-screen sticky top-0 shrink-0 z-30 shadow-xs">
        {/* Branding */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/60 flex items-center gap-3">
          <div id="app-logo" className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 overflow-hidden shadow-md border border-slate-100/50 dark:border-slate-750">
            <img 
              src={nidpLogo} 
              alt="NIDP Logo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block tracking-widest font-mono uppercase">NIDP SUPPORT</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">Ticketing Deck</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 font-mono">Navigation Menu</span>
            {currentUser.role === 'admin' ? (
              <>
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setSelectedTicketId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/30'
                  }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5" />
                  <span>Dashboard Analytics</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('list');
                    setSelectedTicketId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'list'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/30'
                  }`}
                >
                  <ClipboardList className="w-4.5 h-4.5" />
                  <span>Tickets Registry</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('hardware-registry');
                    setSelectedTicketId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'hardware-registry'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/30'
                  }`}
                >
                  <Layers className="w-4.5 h-4.5" />
                  <span>Hardware Registry</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setActiveTab('list');
                    setSelectedTicketId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'list'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/30'
                  }`}
                >
                  <ClipboardList className="w-4.5 h-4.5" />
                  <span>My Tickets</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('create');
                    setSelectedTicketId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'create'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/30'
                  }`}
                >
                  <PlusCircle className="w-4.5 h-4.5" />
                  <span>Create Support Ticket</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('hardware-ticket');
                    setSelectedTicketId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'hardware-ticket'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/30'
                  }`}
                >
                  <Cpu className="w-4.5 h-4.5" />
                  <span>Hardware Issue Ticket</span>
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Sidebar Footer Session info */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/60 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          {/* User Profile Info */}
          <div id="user-profile-badge" className="flex items-center gap-3 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/80 shadow-2xs">
            {currentUser.role === 'admin' ? (
              <Shield className="w-5 h-5 text-indigo-500 shrink-0" />
            ) : (
              <UserCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            )}
            <div className="text-left leading-tight min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                {currentUser.username}
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {currentUser.role === 'admin' ? 'Admin' : 'Officer'}
              </span>
            </div>
          </div>

          {/* Quick controls */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-red-400 hover:bg-rose-50 dark:hover:bg-red-950/20 border border-slate-200/55 dark:border-slate-800 hover:border-rose-200 cursor-pointer transition-all"
              title="Sign Out of Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Right Workspace Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative">
        
        {/* Top Header Panel (Mobile Screens Only) */}
        <header className="md:hidden sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 h-16 flex items-center justify-between px-4 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 overflow-hidden shadow-xs border border-slate-100 dark:border-slate-750">
              <img 
                src={nidpLogo} 
                alt="NIDP Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 block tracking-wider uppercase font-mono leading-none">NIDP SUPPORT</span>
              <span className="text-xs font-extrabold text-slate-950 dark:text-white tracking-tight">Ticketing portal</span>
            </div>
          </div>

          {/* Mobile Right Tools widget */}
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-red-400 hover:bg-rose-50 dark:hover:bg-red-950/20 cursor-pointer border border-slate-150 dark:border-slate-850"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation sub-tabs (Mobile Screens Only) */}
        <div className="md:hidden border-b border-slate-200/50 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-16 z-35">
          <div className="px-4 py-2 flex items-center justify-around">
            {currentUser.role === 'admin' ? (
              <>
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setSelectedTicketId(null);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    activeTab === 'dashboard'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('list');
                    setSelectedTicketId(null);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    activeTab === 'list'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Tickets</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('hardware-registry');
                    setSelectedTicketId(null);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    activeTab === 'hardware-registry'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Hardware</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setActiveTab('list');
                    setSelectedTicketId(null);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    activeTab === 'list'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>My Tickets</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('create');
                    setSelectedTicketId(null);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    activeTab === 'create'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Log Ticket</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('hardware-ticket');
                    setSelectedTicketId(null);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-bold transition-all ${
                    activeTab === 'hardware-ticket'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <Cpu className="w-4 h-4" />
                  <span>Hardware Form</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Container Stage Body */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          
          <AnimatePresence mode="wait">
            <motion.div
              key="portal-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >

              {/* Database status banner / error notification */}
              {dbLoading && (
                <div id="db-sync-loading-indicator" className="flex items-center gap-2 p-3 text-xs text-indigo-700 bg-indigo-50/50 border border-indigo-100 rounded-2xl dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Synchronizing tickets with database...</span>
                </div>
              )}
              {dbError && (
                <div id="db-error-alert-banner" className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50/50 border border-rose-100 rounded-2xl dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>{dbError}</span>
                </div>
              )}
              
              {/* Cockpit Header Title */}
              {!selectedTicketId && activeTab !== 'hardware-ticket' && activeTab !== 'hardware-registry' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/50 dark:border-slate-800/40">
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {activeTab === 'dashboard' 
                        ? 'Support Analytics Dashboard' 
                        : activeTab === 'create' 
                        ? 'Submit Support Ticket' 
                        : 'Support Tickets Registry'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeTab === 'dashboard' 
                        ? 'Real-time overview of ticket statuses, region distribution, and hardware peripheral faults.' 
                        : activeTab === 'create' 
                        ? 'Create and submit a technical case. Our AI assistant will help you diagnose fault images.' 
                        : 'Review, search, sort, and export regional and partner-level technical tickets.'}
                    </p>
                  </div>
                </div>
              )}

              {/* View routing router switch */}
              {selectedTicketId && selectedTicketObj ? (
                
                // --- VIEW 3: TICKET SPECIFIC DETAIL VIEW ---
                <motion.div
                  key="detail-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <TicketDetail
                    ticket={selectedTicketObj}
                    userRole={currentUser.role}
                    userName={currentUser.username}
                    onUpdateTicket={handleUpdateTicket}
                    onGoBack={() => setSelectedTicketId(null)}
                  />
                </motion.div>

              ) : activeTab === 'dashboard' && currentUser.role === 'admin' ? (
                
                // --- VIEW 4: ADMIN ANALYTICS DASHBOARD ---
                <motion.div
                  key="dashboard-panel"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <AdminDashboard tickets={tickets} />
                </motion.div>

              ) : activeTab === 'hardware-registry' && currentUser.role === 'admin' ? (

                // --- VIEW 6: HARDWARE TABLE REGISTRY ---
                <motion.div
                  key="hardware-registry-panel"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <HardwareRegistry
                    tickets={tickets}
                    onSelectTicket={(record) => setSelectedTicketId(record.id)}
                  />
                </motion.div>

              ) : activeTab === 'create' ? (
                
                // --- VIEW 2: LOG/CREATE TICKET FORM ---
                <motion.div
                  key="create-form-panel"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <TicketForm
                    onSubmit={handleCreateTicket}
                    onCancel={() => setActiveTab('list')}
                    defaultOfficerName={currentUser.username}
                  />
                </motion.div>

              ) : activeTab === 'hardware-ticket' && currentUser.role !== 'admin' ? (

                // --- VIEW 5: HARDWARE ISSUE REPORTING FORM ---
                <motion.div
                  key="hardware-ticket-panel"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <HardwareTicketForm
                    onSubmit={handleCreateTicket}
                    onCancel={() => setActiveTab('list')}
                    defaultUserName={currentUser.username}
                  />
                </motion.div>

              ) : (

                // --- VIEW 1: DIRECTORY TABLE ---
                <div className="space-y-6">
                  
                  {currentUser.role !== 'admin' && (
                    /* Display beautiful Field operator encouragement statement */
                    <div className="bg-gradient-to-r from-emerald-100/30 to-teal-50/20 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-150/45 dark:border-emerald-900/20 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                      <div className="flex items-center gap-2 header-quote">
                        <UserCircle2 className="w-5 h-5 text-emerald-500 animate-pulse" />
                        <span>Welcome back, {currentUser.username}! You are signed in as a field officer. You can submit technical issue tickets and read support replies.</span>
                      </div>
                      <button
                        onClick={() => setActiveTab('create')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Log Ticket Now</span>
                      </button>
                    </div>
                  )}

                  {/* Core ticket table list */}
                  <TicketList
                    tickets={tickets.filter(t => !t.id.startsWith('HW-'))}
                    userRole={currentUser.role}
                    userEmail={currentUser.email}
                    userName={currentUser.username}
                    onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
                  />

                </div>

              )}

            </motion.div>
          </AnimatePresence>

        </main>

        {/* Subtle brand footer */}
        <footer className="py-6 text-center text-xs text-slate-400 dark:text-slate-650 border-t border-slate-200/30 dark:border-slate-900/50 mt-auto font-medium">
          <p>© 2026 Technical Support Ticketing Deck • Persistent Storage Layer active</p>
        </footer>

      </div>

    </div>
  );
}
