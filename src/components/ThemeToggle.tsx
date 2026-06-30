/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  return (
    <button
      id="theme-toggle"
      onClick={onToggle}
      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm font-medium"
      aria-label="Toggle visual theme"
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-[18px] h-[18px]" />
          <span className="sr-only sm:not-sr-only">Dark Mode</span>
        </>
      ) : (
        <>
          <Sun className="w-[18px] h-[18px] text-amber-500" />
          <span className="sr-only sm:not-sr-only text-amber-500">Light Mode</span>
        </>
      )}
    </button>
  );
};
