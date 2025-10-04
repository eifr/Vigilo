import { useEffect, useState } from "preact/hooks";

type Theme = "dark" | "light" | "system";

type UseThemeProps = {
  defaultTheme?: Theme;
  storageKey?: string;
};

type UseThemeReturn = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export function useTheme({
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: UseThemeProps = {}): UseThemeReturn {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const handleSetTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);
  };

  return { theme, setTheme: handleSetTheme };
}
