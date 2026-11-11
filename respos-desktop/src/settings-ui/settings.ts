import type { ConnectionTestResult, PrinterInfo, ResposSettingsApi, SettingsState } from '../shared/ipc';
import { type EditableSettings, type EditableSettingsError, type Language, LANGUAGES } from '../shared/settings-schema';
import { isPlainStringKey, settingsStrings } from './i18n';

declare global {
  interface Window {
    /** Provided by settings-preload.ts; only this bundled page ever sees it. */
    resposSettings?: ResposSettingsApi;
  }
}

/** While the server is down the page re-checks it on its own, so an unattended kitchen screen recovers. */
const AUTO_RETRY_MS = 5_000;

type TestView = { kind: 'idle' } | { kind: 'testing' } | { kind: 'done'; result: ConnectionTestResult };
type FormError = { kind: 'none' } | { kind: 'load' } | { kind: 'save'; error: EditableSettingsError | null };

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing element #${id}`);
  return found;
}

const view = {
  reason: byId('reason', HTMLParagraphElement),
  form: byId('settings-form', HTMLFormElement),
  fieldsets: ['fields', 'print-fields', 'mode-fields'].map((id) => byId(id, HTMLFieldSetElement)),
  serverUrl: byId('server-url', HTMLInputElement),
  testButton: byId('test-button', HTMLButtonElement),
  testStatus: byId('test-status', HTMLParagraphElement),
  printer: byId('printer', HTMLSelectElement),
  refreshPrinters: byId('refresh-printers', HTMLButtonElement),
  silentPrint: byId('silent-print', HTMLInputElement),
  kiosk: byId('kiosk', HTMLInputElement),
  kioskFlag: byId('kiosk-flag', HTMLParagraphElement),
  autoStart: byId('auto-start', HTMLInputElement),
  formError: byId('form-error', HTMLParagraphElement),
  appVersion: byId('app-version', HTMLSpanElement),
  cancel: byId('cancel-button', HTMLButtonElement),
  save: byId('save-button', HTMLButtonElement),
  languages: Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-language]')),
};

let language: Language = 'ru';
let state: SettingsState | null = null;
let printers: PrinterInfo[] = [];
let selectedPrinter: string | null = null;
let testView: TestView = { kind: 'idle' };
let formError: FormError = { kind: 'none' };
/** The user changed something: the automatic reconnect must not save over their edits. */
let dirty = false;
let saving = false;

function isLanguage(value: string | undefined): value is Language {
  return value !== undefined && (LANGUAGES as readonly string[]).includes(value);
}

function connectionMessage(result: ConnectionTestResult): string {
  const t = settingsStrings(language);
  if (result.ok) return t.testOk;
  if (result.error === 'bad_status' && result.status !== undefined) {
    return t.badStatusWithCode.replace('{status}', String(result.status));
  }
  return t.errors[result.error];
}

function renderPrinters(): void {
  const t = settingsStrings(language);
  const options = [new Option(t.printerNone, '')];
  for (const printer of printers) options.push(new Option(printer.displayName, printer.name));
  if (selectedPrinter !== null && !printers.some((printer) => printer.name === selectedPrinter)) {
    options.push(new Option(`${selectedPrinter} (${t.printerMissingMark})`, selectedPrinter));
  }
  view.printer.replaceChildren(...options);
  view.printer.value = selectedPrinter ?? '';
  view.silentPrint.disabled = selectedPrinter === null;
  if (selectedPrinter === null) view.silentPrint.checked = false;
}

function renderDynamic(): void {
  const t = settingsStrings(language);

  const reason = state?.reason ?? 'manual';
  view.reason.hidden = reason === 'manual';
  view.reason.textContent = reason === 'first-run' ? t.reasonFirstRun : reason === 'unreachable' ? t.reasonUnreachable : '';

  view.testButton.disabled = testView.kind === 'testing';
  if (testView.kind === 'idle') {
    view.testStatus.textContent = '';
    delete view.testStatus.dataset.kind;
  } else if (testView.kind === 'testing') {
    view.testStatus.textContent = t.testing;
    delete view.testStatus.dataset.kind;
  } else {
    view.testStatus.textContent = connectionMessage(testView.result);
    view.testStatus.dataset.kind = testView.result.ok ? 'ok' : 'error';
  }

  view.formError.hidden = formError.kind === 'none';
  if (formError.kind === 'load') view.formError.textContent = t.loadFailed;
  else if (formError.kind === 'save') view.formError.textContent = formError.error ? t.errors[formError.error] : t.saveFailed;
  else view.formError.textContent = '';

  view.save.textContent = saving ? t.saving : t.save;
  view.save.disabled = saving || state === null;
  renderPrinters();
}

function render(): void {
  const t = settingsStrings(language);
  document.documentElement.lang = language === 'uz' ? 'uz-Latn' : language;
  document.title = `RestaurantOS — ${t.title}`;
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n ?? '';
    if (isPlainStringKey(key)) node.textContent = t[key];
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
    const key = node.dataset.i18nAriaLabel ?? '';
    if (isPlainStringKey(key)) node.setAttribute('aria-label', t[key]);
  }
  for (const button of view.languages) {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  }
  renderDynamic();
}

function collect(): EditableSettings {
  return {
    serverUrl: view.serverUrl.value.trim(),
    printer: selectedPrinter,
    silentPrint: selectedPrinter !== null && view.silentPrint.checked,
    kiosk: view.kiosk.checked,
    autoStart: view.autoStart.checked,
    language,
  };
}

async function testConnection(api: ResposSettingsApi): Promise<void> {
  testView = { kind: 'testing' };
  renderDynamic();
  let result: ConnectionTestResult;
  try {
    result = await api.testConnection(view.serverUrl.value);
  } catch {
    result = { ok: false, error: 'unreachable' };
  }
  // Show the address the way it will be stored (scheme added, path dropped).
  if (result.ok) view.serverUrl.value = result.serverUrl;
  testView = { kind: 'done', result };
  renderDynamic();
}

async function save(api: ResposSettingsApi): Promise<void> {
  if (saving) return;
  saving = true;
  formError = { kind: 'none' };
  renderDynamic();
  try {
    const result = await api.save(collect());
    // On success main closes this window; nothing more to do here.
    if (!result.ok) formError = { kind: 'save', error: result.error };
  } catch {
    formError = { kind: 'save', error: null };
  }
  saving = false;
  renderDynamic();
  if (formError.kind === 'save') view.serverUrl.focus();
}

async function refreshPrinters(api: ResposSettingsApi): Promise<void> {
  view.refreshPrinters.disabled = true;
  try {
    printers = await api.listPrinters();
  } catch {
    printers = [];
  }
  view.refreshPrinters.disabled = false;
  renderPrinters();
}

/** Server was down at startup: keep probing the saved address and continue as soon as it answers. */
function startAutoReconnect(api: ResposSettingsApi, savedUrl: string): void {
  const timer = window.setInterval(() => {
    if (dirty || saving) return;
    if (testView.kind === 'testing') return;
    void api.testConnection(savedUrl).then(
      (result) => {
        if (!result.ok || dirty || saving) return;
        window.clearInterval(timer);
        void save(api);
      },
      () => undefined,
    );
  }, AUTO_RETRY_MS);
}

function bind(api: ResposSettingsApi): void {
  const markDirty = (): void => {
    dirty = true;
  };
  view.serverUrl.addEventListener('input', () => {
    markDirty();
    if (testView.kind === 'done') {
      testView = { kind: 'idle' };
      renderDynamic();
    }
  });
  view.printer.addEventListener('change', () => {
    markDirty();
    selectedPrinter = view.printer.value === '' ? null : view.printer.value;
    renderPrinters();
  });
  for (const input of [view.silentPrint, view.kiosk, view.autoStart]) input.addEventListener('change', markDirty);
  for (const button of view.languages) {
    button.addEventListener('click', () => {
      if (!isLanguage(button.dataset.language) || button.dataset.language === language) return;
      markDirty();
      language = button.dataset.language;
      render();
    });
  }
  view.testButton.addEventListener('click', () => void testConnection(api));
  view.refreshPrinters.addEventListener('click', () => void refreshPrinters(api));
  view.cancel.addEventListener('click', () => void api.close());
  view.form.addEventListener('submit', (event) => {
    event.preventDefault();
    void save(api);
  });
  document.addEventListener('keydown', (event) => {
    // Escape closes only a window the user opened; on first run that would quit the app by accident.
    if (event.key === 'Escape' && state?.reason === 'manual') void api.close();
  });
}

async function start(): Promise<void> {
  render();
  const api = window.resposSettings;
  if (!api) {
    formError = { kind: 'load' };
    renderDynamic();
    return;
  }
  bind(api);
  try {
    state = await api.getState();
  } catch {
    formError = { kind: 'load' };
    renderDynamic();
    return;
  }
  language = state.settings.language;
  printers = state.printers;
  selectedPrinter = state.settings.printer;
  view.serverUrl.value = state.settings.serverUrl ?? '';
  view.silentPrint.checked = state.settings.silentPrint;
  view.kiosk.checked = state.settings.kiosk;
  view.autoStart.checked = state.settings.autoStart;
  view.kioskFlag.hidden = !state.kioskFlag;
  view.appVersion.textContent = state.appVersion;
  for (const fieldset of view.fieldsets) fieldset.disabled = false;
  render();
  view.serverUrl.focus();
  if (state.reason === 'unreachable' && state.settings.serverUrl !== null) {
    startAutoReconnect(api, state.settings.serverUrl);
  }
}

void start();
