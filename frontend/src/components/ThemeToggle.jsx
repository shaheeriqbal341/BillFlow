import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ compact = false }) {
  const [dark, setDark] = useState(() => localStorage.getItem('billflow-theme') === 'dark');

  const toggle = () => {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light';
    localStorage.setItem('billflow-theme', nextDark ? 'dark' : 'light');
  };

  return (
    <button className={`theme-toggle${compact ? ' theme-toggle-compact' : ''}`} type="button" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title={compact ? `${dark ? 'Light' : 'Dark'} theme` : undefined}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
