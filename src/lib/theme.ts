export type ThemeChoice = "light" | "dark" | "system";

/**
 * Apply theme via the `.dark` class on <html>.
 * Works with Tailwind v4 @custom-variant dark.
 */
export function applyTheme(theme: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  let dark = false;
  if (theme === "dark") dark = true;
  else if (theme === "light") dark = false;
  else {
    dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function readStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "light";
  try {
    // Prefer operator store (current product state)
    const op = localStorage.getItem("nexa_operator_v4");
    if (op) {
      const parsed = JSON.parse(op);
      if (parsed?.theme === "light" || parsed?.theme === "dark" || parsed?.theme === "system") {
        return parsed.theme;
      }
    }
    const legacy =
      localStorage.getItem("nexa_operator_v3") ||
      localStorage.getItem("nexa_app_state");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed?.theme === "light" || parsed?.theme === "dark" || parsed?.theme === "system") {
        return parsed.theme;
      }
    }
  } catch {
    /* */
  }
  return "light";
}
