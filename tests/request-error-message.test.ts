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

test('preserves safe localized explanations and hides technical or untranslated server details', () => {
  assert.equal(requestErrorMessage(502, 'Сервіс входу тимчасово недоступний.'), 'Сервіс входу тимчасово недоступний.');
  assert.equal(requestErrorMessage(400, 'unsupported preference: allowedProviderIdsByType'), 'Перевірте введені дані та спробуйте ще раз.');
  assert.equal(requestErrorMessage(500, 'PostgreSQL connection ETIMEDOUT'), 'Не вдалося виконати дію. Спробуйте ще раз пізніше.');
  assert.equal(requestErrorMessage(500, 'Database connection failed'), 'Не вдалося виконати дію. Спробуйте ще раз пізніше.');
  assert.equal(requestErrorMessage(404), 'Не знайшли ці дані. Можливо, вони змінилися або посилання застаріло.');
});

test('uses concise product copy for request failures without exposing protocol details', () => {
  assert.equal(requestErrorMessage(400), 'Перевірте введені дані та спробуйте ще раз.');
  assert.equal(requestErrorMessage(409), 'Дані змінилися. Оновіть екран і спробуйте ще раз.');
  assert.equal(requestErrorMessage(418), 'Не вдалося виконати дію. Спробуйте ще раз.');
  assert.equal(/Failed to fetch|Request failed/.test(requestErrorMessage(500)), false);
});

test('separates a dead network from an unanswering server without inventing a cause', () => {
  assert.equal(networkFailureMessage(false), 'Немає з’єднання з інтернетом. Перевірте мережу й повторіть спробу.');
  assert.equal(networkFailureMessage(true), 'Не вдалося з’єднатися. Повторіть спробу за мить.');
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

test('explains unavailable password recovery without claiming that an email was sent', () => {
  assert.equal(
    requestErrorMessage(503, 'internal detail', 'password_reset_unavailable'),
    'Відновлення пароля тимчасово недоступне. Спробуйте пізніше.',
  );
});

test('shows restore failures but keeps an expired session silent', () => {
  assert.equal(authRestoreErrorMessage(new Error('Request failed (401)')), null);
  assert.equal(authRestoreErrorMessage(new Error('Request failed (403)')), null);
  assert.equal(
    authRestoreErrorMessage(new DOMException('timed out', 'AbortError')),
    'З’єднання перервано. Спробуйте ще раз.',
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
