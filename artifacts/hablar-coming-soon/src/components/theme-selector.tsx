import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const themes = ['original', 'darker', 'blue-green', 'soft-lavender'] as const;
export type Theme = (typeof themes)[number];

const themeLabels: Record<Theme, string> = {
  original: 'Original',
  darker: 'Darker',
  'blue-green': 'Blue-green',
  'soft-lavender': 'Soft lavender',
};

const STORAGE_KEY = 'hablar-theme';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

function readSavedTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return themes.find((theme) => theme === saved) ?? 'original';
  } catch {
    return 'original';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The selected theme still works for this visit when browser storage is unavailable.
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeSelector() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeSelector must be used within ThemeProvider');

  return (
    <div className="theme-control">
      <label htmlFor="hablar-theme">Theme</label>
      <select
        id="hablar-theme"
        className="theme-select"
        value={context.theme}
        onChange={(event) => context.setTheme(event.target.value as Theme)}
      >
        {themes.map((theme) => <option key={theme} value={theme}>{themeLabels[theme]}</option>)}
      </select>
    </div>
  );
}
