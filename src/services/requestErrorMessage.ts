export const NETWORK_ERROR_CODE = 'network_error';

// A passenger-facing sentence per HTTP status the app can actually observe. Only the status is
// claimed; anything the server explains itself is shown verbatim instead of being guessed at here.
const httpFailureCopy: Record<number, string> = {
  400: 'Сервер не прийняв запит: перевірте введені дані.',
  404: 'MARSHGO не знайшов ці дані — можливо, вони змінилися або посилання застаріло.',
  409: 'Дані на сервері змінилися, поки тривав запит. Оновіть екран і спробуйте ще раз.',
  422: 'Сервер не зміг обробити ці значення: перевірте введені дані.',
  500: 'Сервер MARSHGO не зміг обробити запит. Спробуйте ще раз пізніше.',
};

export function requestErrorMessage(status: number, backendMessage?: string, errorCode?: string): string {
  if (errorCode === 'sms_provider_unavailable') {
    return 'Вхід за SMS тимчасово не налаштовано. Спробуйте пізніше.';
  }
  if (errorCode === 'sms_delivery_failed') {
    return 'Не вдалося надіслати SMS-код. Спробуйте ще раз пізніше.';
  }
  if (backendMessage) return backendMessage;
  if (status === 502 || status === 503 || status === 504) {
    return 'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.';
  }
  return httpFailureCopy[status] ?? `MARSHGO не зміг виконати запит (HTTP ${status}). Спробуйте ще раз.`;
}

/**
 * fetch() rejects without a status when the device cannot reach the server, and the browser's own
 * reason ("Failed to fetch") says nothing to a passenger. The connectivity flag is the only fact
 * available, so it decides whether to blame the network or the server.
 */
export function networkFailureMessage(isOnline: boolean): string {
  return isOnline
    ? 'Немає зв’язку із сервером. Повторіть спробу за мить.'
    : 'Немає з’єднання з інтернетом. Перевірте мережу й повторіть спробу.';
}

export function authRestoreErrorMessage(error: unknown): string | null {
  if (error instanceof Error && /(^Request failed \((401|403)\)$|\(HTTP (401|403)\))/.test(error.message)) return null;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Сервер не відповідає. Перевірте з’єднання та спробуйте ще раз.';
  }
  if (error instanceof Error && error.message.startsWith('Сервіс MARSHGO тимчасово недоступний.')) {
    return error.message;
  }
  return 'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.';
}
