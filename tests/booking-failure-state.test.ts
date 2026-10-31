import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ProductionApiError } from '../src/services/productionApi';
import {
  boardingFailureMessage, bookingFailureMessage, deepLinkFailureMessage, isOfferNoLongerBookable, NETWORK_FAILURE_TEXT, OFFER_NO_LONGER_BOOKABLE_TEXT, ticketFailureMessage,
} from '../src/views/bookingFailureState';

describe('booking confirmation honesty', () => {
  it('states in Ukrainian that the last-seat rejection created no booking', () => {
    assert.equal(
      bookingFailureMessage(new ProductionApiError('not enough available seats', undefined, 409)),
      'Вільних місць уже немає — бронювання не створено. Актуальну наявність оновлено.',
    );
    assert.equal(
      bookingFailureMessage(new ProductionApiError('offer departure has passed', 'offer_expired', 409)),
      'Відправлення цієї поїздки вже минуло — бронювання не створено.',
    );
  });

  it('localizes an unreachable server even though fetch rejects with a plain TypeError', () => {
    assert.equal(bookingFailureMessage(new TypeError('Failed to fetch')), NETWORK_FAILURE_TEXT);
    assert.equal(bookingFailureMessage(new Error('The operation was aborted.')), NETWORK_FAILURE_TEXT);
  });

  it('keeps an unmapped server answer visible instead of masking it with a generic failure', () => {
    assert.equal(bookingFailureMessage(new ProductionApiError('journey leg already has a booking', 'leg_taken', 409)),
      'journey leg already has a booking');
  });

  it('treats only the 404 from the bookable-offer endpoint as the trip being closed', () => {
    assert.equal(isOfferNoLongerBookable(new ProductionApiError('Offer not found', 'not_found', 404)), true);
    assert.equal(isOfferNoLongerBookable(new ProductionApiError('Request failed (500)', undefined, 500)), false);
    assert.equal(isOfferNoLongerBookable(new Error('Failed to fetch')), false);
    // The seat count is unknown, so the copy must not claim a specific number.
    assert.doesNotMatch(OFFER_NO_LONGER_BOOKABLE_TEXT, /\d/);
    assert.match(OFFER_NO_LONGER_BOOKABLE_TEXT, /Бронювання не створено\./);
  });

  it('reads a closed offer deep link as a product state instead of a raw English error', () => {
    assert.equal(deepLinkFailureMessage(new ProductionApiError('Offer not found', 'not_found', 404)),
      'Цю поїздку більше не відкрити: останні місця зайняли, її скасовано або вона вже відправилася.');
    assert.equal(deepLinkFailureMessage(new TypeError('Failed to fetch')),
      'Сервер не відповів. Перевірте зʼєднання та спробуйте ще раз.');
    // A client-side guard already written for the passenger must survive unchanged.
    assert.equal(deepLinkFailureMessage(new Error('Бронювання недоступне для цього облікового запису.')),
      'Бронювання недоступне для цього облікового запису.');
  });
});

describe('boarding confirmation honesty', () => {
  it('names the real server reason and states that boarding was not confirmed', () => {
    assert.equal(boardingFailureMessage(new ProductionApiError('booking ticket is invalid or expired', 'ticket_invalid', 400)),
      'Квиток не підходить до цієї поїздки або прострочив. Посадку не підтверджено.');
    assert.equal(boardingFailureMessage(new ProductionApiError('booking cannot enter boarding', undefined, 409)),
      'Бронювання більше не на етапі посадки. Посадку не підтверджено.');
    assert.equal(boardingFailureMessage(new ProductionApiError('booking unavailable', undefined, 404)),
      'Це бронювання недоступне для вашого акаунта водія. Посадку не підтверджено.');
    assert.match(boardingFailureMessage(new ProductionApiError('Unauthorized', undefined, 401)), /увійдіть в акаунт водія/);
  });

  it('keeps a dropped connection honest about the boarding outcome', () => {
    assert.equal(boardingFailureMessage(new TypeError('Failed to fetch')),
      'Сервер не відповів. Посадку не підтверджено — повторіть сканування після відновлення зʼєднання.');
  });

  it('says no ticket was issued once the trip left the confirmed stage', () => {
    assert.equal(ticketFailureMessage(new ProductionApiError('ticket is no longer valid', undefined, 409)),
      'Квиток не видано: ця поїздка вже на іншому етапі — посадка, рух або завершення.');
    assert.match(ticketFailureMessage(new ProductionApiError('booking not found', undefined, 404)), /Квиток не видано/);
    assert.match(ticketFailureMessage(new ProductionApiError('Unauthorized', undefined, 401)), /Квиток не видано/);
    assert.equal(ticketFailureMessage(new TypeError('Failed to fetch')),
      'Сервер не відповів. Квиток не видано — повторіть спробу після відновлення зʼєднання.');
  });
});
