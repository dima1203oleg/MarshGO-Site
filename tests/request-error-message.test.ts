import assert from 'node:assert/strict';
import test from 'node:test';
import { authRestoreErrorMessage, networkFailureMessage, requestErrorMessage } from '../src/services/requestErrorMessage';

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
  assert.equal(requestErrorMessage(404), 'MARSHGO не знайшов ці дані — можливо, вони змінилися або посилання застаріло.');
});

test('names an HTTP failure in Ukrainian and keeps the status visible for support', () => {
  assert.equal(requestErrorMessage(400), 'Сервер не прийняв запит: перевірте введені дані.');
  assert.equal(requestErrorMessage(409), 'Дані на сервері змінилися, поки тривав запит. Оновіть екран і спробуйте ще раз.');
  assert.equal(requestErrorMessage(418), 'MARSHGO не зміг виконати запит (HTTP 418). Спробуйте ще раз.');
  assert.equal(/Failed to fetch|Request failed/.test(requestErrorMessage(500)), false);
});

test('separates a dead network from an unanswering server without inventing a cause', () => {
  assert.equal(networkFailureMessage(false), 'Немає з’єднання з інтернетом. Перевірте мережу й повторіть спробу.');
  assert.equal(networkFailureMessage(true), 'Немає зв’язку із сервером. Повторіть спробу за мить.');
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
