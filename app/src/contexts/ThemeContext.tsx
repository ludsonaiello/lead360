/**
 * Theme Context
 * Manages dark/light mode theme switching
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Get initial theme
    const savedTheme = localStorage.getItem('theme') as Theme;
    const initialTheme = savedTheme || 'light';
    setThemeState(initialTheme);

    // Apply theme immediately
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    console.log('Setting theme to:', newTheme); // Debug log

    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);

    // Force update the DOM
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      console.log('Dark class added'); // Debug log
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Dark class removed'); // Debug log
    }

    // Log current classes
    console.log('Current html classes:', document.documentElement.className);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    console.log('Toggling from', theme, 'to', newTheme); // Debug log
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
