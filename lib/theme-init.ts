export const THEME_STORAGE_KEY = "pharmashiva-theme";

/**
 * Inlined into the root layout so the stored theme lands on <html> before the
 * browser paints. Without it every load renders the system theme first and
 * flips once React hydrates — a visible flash.
 *
 * Only touches the `dark` class. Writing inline styles (or any attribute React
 * renders itself) would trip React's hydration check, so `color-scheme` lives
 * in globals.css under the `.dark` selector instead.
 *
 * Keep in sync with hooks/use-theme.ts.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
