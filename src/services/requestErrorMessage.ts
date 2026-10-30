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
  return `Request failed (${status})`;
}

export function authRestoreErrorMessage(error: unknown): string | null {
  if (error instanceof Error && /^Request failed \((401|403)\)$/.test(error.message)) return null;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Сервер не відповідає. Перевірте з’єднання та спробуйте ще раз.';
  }
  if (error instanceof Error && error.message.startsWith('Сервіс MARSHGO тимчасово недоступний.')) {
    return error.message;
  }
  return 'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.';
}
