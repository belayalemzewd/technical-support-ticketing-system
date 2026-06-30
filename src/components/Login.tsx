/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User as UserIcon, ShieldAlert, KeyRound, ArrowRight, UserCircle2, Loader2 } from 'lucide-react';
import nidpLogo from './id logo.png';
import { UserRole, User } from '../types';
import { api } from '../lib/api.ts';
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase-client.ts';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showSandboxBypass, setShowSandboxBypass] = useState(false);

  React.useEffect(() => {
    const sessionError = sessionStorage.getItem('login_error_msg');
    if (sessionError) {
      setError(sessionError);
      sessionStorage.removeItem('login_error_msg');
    }
  }, []);

  const handleAuthenticatedUser = (dbUser: User) => {
    onLogin(dbUser);
  };

  const handleSandboxBypass = async () => {
    setIsLoading(true);
    setError('');
    try {
      const isAuthorizedAdmin = [
        "kirubelay6@gmail.com",
        "admin@support.com",
        "belayalemzewd@gmail.com",
        "worldcrown12@gmail.com"
      ].includes(email.trim().toLowerCase());

      const finalRole: UserRole = mode === 'signup' ? role : (isAuthorizedAdmin ? 'admin' : 'user');
      const finalUsername = username.trim() || email.trim().split('@')[0] || 'Demo User';

      const mockUid = `sandbox-uid-${finalRole}-${Date.now()}`;
      const mockToken = `MockToken:${mockUid}:${finalRole}:${encodeURIComponent(finalUsername)}:${encodeURIComponent(email.trim())}`;
      localStorage.setItem('support_mock_auth_token', mockToken);
      
      const dbUser = await api.syncUser({
        preferredRole: finalRole,
        preferredUsername: finalUsername,
      });
      handleAuthenticatedUser(dbUser);
    } catch (err: any) {
      console.error("Sandbox bypass error:", err);
      setError(err.message || 'Failed to sync with sandbox database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: 'google',
        });
        if (oauthErr) throw oauthErr;
      } else {
        const mockEmail = 'kirubelay6@gmail.com';
        const mockName = 'Google Account User';
        const mockUid = `mock-google-uid-${Date.now()}`;
        const mockToken = `MockToken:${mockUid}:admin:${encodeURIComponent(mockName)}:${encodeURIComponent(mockEmail)}`;
        localStorage.setItem('support_mock_auth_token', mockToken);
        const dbUser = await api.syncUser({
          preferredRole: 'admin',
          preferredUsername: mockName,
        });
        handleAuthenticatedUser(dbUser);
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      let errMsg = '';
      if (err && typeof err === 'object') {
        errMsg = err.message || err.msg || JSON.stringify(err);
      } else {
        errMsg = String(err);
      }

      if (errMsg.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(errMsg);
          if (parsed.msg) {
            errMsg = parsed.msg;
          } else if (parsed.message) {
            errMsg = parsed.message;
          }
        } catch (e) {}
      }

      const lowerErr = errMsg.toLowerCase();
      if (lowerErr.includes('provider is not enabled') || lowerErr.includes('unsupported provider') || lowerErr.includes('validation_failed')) {
        errMsg = "Google Sign-In is not enabled in your Supabase project. To fix this, log in to your Supabase Dashboard, select 'Auth' -> 'Providers' and enable 'Google'. Alternatively, use the 'demo sandbox' quick buttons below to instantly sign in.";
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    setShowSandboxBypass(false);

    if (mode === 'signup' && role === 'admin') {
      const authorizedAdminEmails = [
        "kirubelay6@gmail.com",
        "admin@support.com",
        "belayalemzewd@gmail.com",
        "worldcrown12@gmail.com"
      ];
      if (!authorizedAdminEmails.includes(email.trim().toLowerCase())) {
        setError('Your email address is not authorized to register with the Admin role.');
        setIsLoading(false);
        return;
      }
    }
    
    // Check if Supabase Auth is enabled
    if (isSupabaseConfigured()) {
      if (!password.trim()) {
        setError('Please enter your password.');
        setIsLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        if (mode === 'signup') {
          if (!username.trim()) {
            setError('Please provide your name or username to create an account.');
            setIsLoading(false);
            return;
          }

          const { data, error: signUpErr } = await supabase.auth.signUp({
            email: email.trim(),
            password: password.trim(),
            options: {
              data: {
                username: username.trim(),
                role: role,
              }
            }
          });

          if (signUpErr) throw signUpErr;

          // Do NOT auto-login. If signUp() logged the user in or returned a session, sign out immediately.
          if (data.session) {
            await supabase.auth.signOut();
          }

          // Redirect to the Sign In page
          setMode('signin');
          // Clear password but keep the email populated
          setPassword('');
          
          setSuccessMessage("Your account has been created. Please check your email and verify your address before logging in.");
          setIsLoading(false);
          return;
        } else {
          // Sign in mode
          const { data, error: signInErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });

          if (signInErr) throw signInErr;

          if (!data.session) {
            setError("Authentication failed. No session returned.");
            setIsLoading(false);
            return;
          }

          // Real session exists!
          localStorage.setItem('support_mock_auth_token', data.session.access_token);
          const dbUser = await api.syncUser({
            preferredRole: data.session.user.user_metadata?.role || 'user',
            preferredUsername: data.session.user.user_metadata?.username || data.session.user.email?.split('@')[0],
          });
          handleAuthenticatedUser(dbUser);
        }
      } catch (authErr: any) {
        console.error("Supabase authentication failed:", authErr);
        let errMsg = '';
        if (authErr && typeof authErr === 'object') {
          errMsg = authErr.message || authErr.msg || JSON.stringify(authErr);
        } else {
          errMsg = String(authErr);
        }

        if (errMsg.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(errMsg);
            if (parsed.msg) {
              errMsg = parsed.msg;
            } else if (parsed.message) {
              errMsg = parsed.message;
            }
          } catch (e) {}
        }

        const lowerErr = errMsg.toLowerCase();
        const isRateLimitedOrBlocked = lowerErr.includes('rate limit') || 
                                       lowerErr.includes('rate_limit') || 
                                       lowerErr.includes('exceeded') || 
                                       lowerErr.includes('too many requests') || 
                                       lowerErr.includes('forbidden') || 
                                       lowerErr.includes('403') ||
                                       lowerErr.includes('failed to fetch') ||
                                       lowerErr.includes('unreachable');

        if (isRateLimitedOrBlocked) {
          console.warn("[Login] Supabase rate limit or connection issue. Initiating automatic sandbox fallback...");
          try {
            if (mode === 'signin') {
              let registeredUser;
              try {
                registeredUser = await api.loginByEmail(email.trim());
              } catch (loginErr) {
                console.warn("[Login] User profile fetch failed, dynamically registering sandbox profile...");
                const isAuthorizedAdmin = [
                  "kirubelay6@gmail.com",
                  "admin@support.com",
                  "belayalemzewd@gmail.com",
                  "worldcrown12@gmail.com"
                ].includes(email.trim().toLowerCase());
                const finalRole = isAuthorizedAdmin ? 'admin' : 'user';
                const finalUsername = email.trim().split('@')[0] || 'User';
                
                registeredUser = await api.syncUser({
                  preferredRole: finalRole,
                  preferredUsername: finalUsername,
                });
              }
              const mockToken = `MockToken:${registeredUser.id || registeredUser.uid}:${registeredUser.role}:${encodeURIComponent(registeredUser.username)}:${encodeURIComponent(registeredUser.email)}`;
              localStorage.setItem('support_mock_auth_token', mockToken);
              handleAuthenticatedUser(registeredUser);
              return;
            } else {
              // Sign-up mode
              const mockUid = `mock-uid-${role}-${Date.now()}`;
              const mockToken = `MockToken:${mockUid}:${role}:${encodeURIComponent(username.trim())}:${encodeURIComponent(email.trim())}`;
              localStorage.setItem('support_mock_auth_token', mockToken);
              
              const dbUser = await api.syncUser({
                preferredRole: role,
                preferredUsername: username.trim(),
              });
              handleAuthenticatedUser(dbUser);
              return;
            }
          } catch (fallbackErr: any) {
            console.error("[Login] Automatic sandbox fallback also failed:", fallbackErr);
            errMsg = `Supabase authentication failed due to rate limits or connection restrictions, and automatic Sandbox Fallback failed: ${fallbackErr.message || fallbackErr}`;
          }
        }

        if (lowerErr.includes('provider is not enabled') || lowerErr.includes('unsupported provider') || lowerErr.includes('validation_failed')) {
          errMsg = "The Email authentication provider is not enabled in your Supabase project. To fix this, log in to your Supabase Dashboard, go to 'Auth' -> 'Providers' and enable 'Email'.";
        }
        
        setError(errMsg);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Fallback Mock Auth
    try {
      if (mode === 'signin') {
        const registeredUser = await api.loginByEmail(email.trim());
        const mockToken = `MockToken:${registeredUser.id}:${registeredUser.role}:${encodeURIComponent(registeredUser.username)}:${encodeURIComponent(registeredUser.email)}`;
        localStorage.setItem('support_mock_auth_token', mockToken);
        handleAuthenticatedUser(registeredUser);
      } else {
        if (!username.trim()) {
          setError('Please provide your name or username to create an account.');
          setIsLoading(false);
          return;
        }

        const mockUid = `mock-uid-${role}-${Date.now()}`;
        const mockToken = `MockToken:${mockUid}:${role}:${encodeURIComponent(username.trim())}:${encodeURIComponent(email.trim())}`;
        localStorage.setItem('support_mock_auth_token', mockToken);
        
        const dbUser = await api.syncUser({
          preferredRole: role,
          preferredUsername: username.trim(),
        });
        handleAuthenticatedUser(dbUser);
      }
    } catch (err: any) {
      console.error("Custom registration error:", err);
      setError(err.message || 'Authentication failed. Please verify your credentials or create a new account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (presetRole: UserRole) => {
    setIsLoading(true);
    setError('');
    try {
      const selectedName = presetRole === 'admin' ? 'John Administrator' : 'Officer Sarah Jenkins';
      const selectedEmail = presetRole === 'admin' ? 'admin@support.com' : 'sarah.j@education.org';

      const mockUid = `mock-uid-${presetRole}-${Date.now()}`;
      const mockToken = `MockToken:${mockUid}:${presetRole}:${encodeURIComponent(selectedName)}:${encodeURIComponent(selectedEmail)}`;
      localStorage.setItem('support_mock_auth_token', mockToken);
      
      const dbUser = await api.syncUser({
        preferredRole: presetRole,
        preferredUsername: selectedName,
      });
      handleAuthenticatedUser(dbUser);
    } catch (err: any) {
      console.error("Quick log error:", err);
      setError('Failed to activate quick user demo account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl shadow-xl transition-all">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm">
            {isLoading ? (
              <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
            ) : (
              <img 
                src={nidpLogo} 
                alt="NIDP Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              NIDP IT SUPPORT
            </h2>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Ticketing System Portal
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Log in to manage operations & technical support requests
          </p>
        </div>



        {/* Custom Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 space-y-2">
              <p>{error}</p>
              {showSandboxBypass && (
                <button
                  id="btn-sandbox-bypass"
                  type="button"
                  onClick={handleSandboxBypass}
                  className="w-full mt-2 cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all"
                >
                  <span>Bypass and log in via Sandbox Mode</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-xs rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 animate-fadeIn">
              {successMessage}
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
                Full Name / Officer Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-600">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  id="login-username"
                  type="text"
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Abebe Kebede"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-600 font-mono text-sm">
                @
              </span>
              <input
                id="login-email"
                type="email"
                disabled={isLoading}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setSuccessMessage(''); }}
                placeholder="e.g. nid@id.et"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans disabled:opacity-50"
              />
            </div>
          </div>

          {isSupabaseConfigured() && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
                Security Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-600">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  id="login-password"
                  type="password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
                System Permission Role
              </label>
              <div className="grid grid-cols-2 gap-3 row">
                <label className="relative flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      disabled={isLoading}
                      checked={role === 'user'}
                      onChange={() => setRole('user')}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Officer (User)</span>
                  </div>
                </label>

                <label className="relative flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-indigo-50/10 dark:bg-slate-950/30 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      disabled={isLoading}
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Admin Staff</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <button
            id="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="w-full cursor-pointer flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm bg-slate-900 border border-transparent hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            <span>{mode === 'signin' ? 'Proceed to Dashboard' : 'Create Account & Proceed'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Toggle link for switching modes */}
          <div className="text-center pt-2">
            {mode === 'signin' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(''); setSuccessMessage(''); setShowSandboxBypass(false); }}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer bg-transparent border-none p-0 inline"
                >
                  Create account
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(''); setSuccessMessage(''); setShowSandboxBypass(false); }}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer bg-transparent border-none p-0 inline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
