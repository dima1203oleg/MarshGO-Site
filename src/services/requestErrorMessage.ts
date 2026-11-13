export const NETWORK_ERROR_CODE = 'network_error';

// Short customer-facing copy; implementation details and raw server codes never reach the UI.
const httpFailureCopy: Record<number, string> = {
  400: 'Перевірте введені дані та спробуйте ще раз.',
  404: 'Не знайшли ці дані. Можливо, вони змінилися або посилання застаріло.',
  409: 'Дані змінилися. Оновіть екран і спробуйте ще раз.',
  422: 'Перевірте введені дані.',
  500: 'Не вдалося виконати дію. Спробуйте ще раз пізніше.',
};

const technicalBackendDetails = /\b(?:unsupported preference|HTTP\s*\d{3}|API|SQL|PostgreSQL|Redis|GTFS|OSRM|provider|endpoint|stack trace|internal server error|ECONN(?:REFUSED|RESET)|ETIMEDOUT|database|constraint|undefined|null)\b/i;
const machineCode = /\b(?:[A-Z][A-Z0-9_]{2,}|[a-z]+(?:_[a-z0-9]+)+|[a-z]+[A-Z][A-Za-z0-9]*)\b/;

export function requestErrorMessage(status: number, backendMessage?: string, errorCode?: string): string {
  if (errorCode === 'password_reset_unavailable') {
    return 'Відновлення пароля тимчасово недоступне. Спробуйте пізніше.';
  }
  if (errorCode === 'sms_provider_unavailable') {
    return 'Вхід за SMS тимчасово не налаштовано. Спробуйте пізніше.';
  }
  if (errorCode === 'sms_delivery_failed') {
    return 'Не вдалося надіслати SMS-код. Спробуйте ще раз пізніше.';
  }
  if (backendMessage && /[\u0400-\u04FF]/.test(backendMessage)
    && !technicalBackendDetails.test(backendMessage) && !machineCode.test(backendMessage) && !/[{}]/.test(backendMessage)) return backendMessage;
  if (status === 502 || status === 503 || status === 504) {
    return 'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.';
  }
  return httpFailureCopy[status] ?? 'Не вдалося виконати дію. Спробуйте ще раз.';
}

/**
 * fetch() rejects without a status when the device cannot reach the server, and the browser's own
 * reason ("Failed to fetch") says nothing to a passenger. The connectivity flag is the only fact
 * available, so it decides whether to blame the network or the server.
 */
export function networkFailureMessage(isOnline: boolean): string {
  return isOnline
    ? 'Не вдалося з’єднатися. Повторіть спробу за мить.'
    : 'Немає з’єднання з інтернетом. Перевірте мережу й повторіть спробу.';
}

export function authRestoreErrorMessage(error: unknown): string | null {
  if (error instanceof Error && /(^Request failed \((401|403)\)$|\(HTTP (401|403)\))/.test(error.message)) return null;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'З’єднання перервано. Спробуйте ще раз.';
  }
  if (error instanceof Error && error.message.startsWith('Сервіс MARSHGO тимчасово недоступний.')) {
    return error.message;
  }
  return 'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.';
}
