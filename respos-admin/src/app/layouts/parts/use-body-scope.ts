import { useEffect } from 'react';
import { applyTheme } from '@/shared/lib/theme';

const KDS_THEME_COLOR = '#111a2e';

/** Mirrors the workspace scope on body so portaled dialogs and toasts inherit density and the KDS palette. */
export function useBodyScope(workspace: string | undefined, theme?: 'kds'): void {
  useEffect(() => {
    const { dataset } = document.body;
    if (workspace) dataset.workspace = workspace;
    if (theme) {
      dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', KDS_THEME_COLOR);
    }
    return () => {
      delete dataset.workspace;
      if (theme) {
        delete dataset.theme;
        applyTheme();
      }
    };
  }, [workspace, theme]);
}
