import assert from 'node:assert/strict';
import test from 'node:test';
import { authRestoreErrorMessage, requestErrorMessage } from '../src/services/requestErrorMessage';

test('shows a clear localized message when the API upstream is unavailable', () => {
  assert.equal(
    requestErrorMessage(502),
    'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.',
  );
  assert.equal(requestErrorMessage(503), 'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.');
  assert.equal(requestErrorMessage(504), 'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.');
});

test('preserves a safe server-provided explanation and the existing fallback for other errors', () => {
  assert.equal(requestErrorMessage(502, 'Сервіс входу тимчасово недоступний.'), 'Сервіс входу тимчасово недоступний.');
  assert.equal(requestErrorMessage(404), 'Request failed (404)');
});

test('explains missing SMS configuration and delivery failure without exposing backend English', () => {
  assert.equal(
    requestErrorMessage(503, 'SMS verification is not configured', 'sms_provider_unavailable'),
    'Вхід за SMS тимчасово не налаштовано. Спробуйте пізніше.',
  );
  assert.equal(
    requestErrorMessage(503, 'Could not deliver verification code', 'sms_delivery_failed'),
    'Не вдалося надіслати SMS-код. Спробуйте ще раз пізніше.',
  );
});

test('shows restore failures but keeps an expired session silent', () => {
  assert.equal(authRestoreErrorMessage(new Error('Request failed (401)')), null);
  assert.equal(authRestoreErrorMessage(new Error('Request failed (403)')), null);
  assert.equal(
    authRestoreErrorMessage(new DOMException('timed out', 'AbortError')),
    'Сервер не відповідає. Перевірте з’єднання та спробуйте ще раз.',
  );
  assert.equal(
    authRestoreErrorMessage(new Error('Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.')),
    'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.',
  );
  assert.equal(
    authRestoreErrorMessage(new TypeError('Failed to fetch')),
    'Сервіс MARSHGO тимчасово недоступний. Спробуйте ще раз пізніше.',
  );
});
