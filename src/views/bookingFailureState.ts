import { ProductionApiError } from '../services/productionApi';

// The public offer endpoint only answers for trips that are still open for
// booking, so a 404 after a rejected booking is the server's own statement that
// this trip cannot be booked anymore. Any other failure keeps the seat count
// unknown instead of guessing it.
export function isOfferNoLongerBookable(error: unknown): boolean {
  return error instanceof ProductionApiError && error.status === 404;
}

export const OFFER_NO_LONGER_BOOKABLE_TEXT = 'Сервер більше не відкриває цю поїздку для бронювання: останні місця зайняли, поїздку скасовано або вона вже відправилася. Бронювання не створено.';

export const NETWORK_FAILURE_TEXT = 'Сервер не відповів. Бронювання перевірено за списком «Поїздки» — якщо місця немає, спробуйте ще раз.';

// Deep links open a single offer, booking or demand; their failures must read as
// product states in Ukrainian while preserving the client-side Ukrainian guards.
export function deepLinkFailureMessage(error: unknown): string {
  if (isOfferNoLongerBookable(error)) return 'Цю поїздку більше не відкрити: останні місця зайняли, її скасовано або вона вже відправилася.';
  if (error instanceof Error && /Failed to fetch|NetworkError|Load failed|abort/i.test(error.message)) return 'Сервер не відповів. Перевірте зʼєднання та спробуйте ще раз.';
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Посилання більше недоступне. Перевірте доступ і спробуйте ще раз.';
}

// Server booking errors are English; the passenger must see the real reason and
// whether a booking now exists.
export function bookingFailureMessage(error: unknown): string {
  // fetch() rejects an unreachable server with a plain TypeError, not a
  // ProductionApiError, so this has to be matched before the API branch.
  if (error instanceof Error && /Failed to fetch|NetworkError|Load failed|abort/i.test(error.message)) return NETWORK_FAILURE_TEXT;
  if (error instanceof ProductionApiError) {
    if (error.code === 'offer_expired' || /departure has passed/i.test(error.message)) return 'Відправлення цієї поїздки вже минуло — бронювання не створено.';
    if (/not enough available seats/i.test(error.message) || (error.status === 409 && !error.code)) return 'Вільних місць уже немає — бронювання не створено. Актуальну наявність оновлено.';
    if (/cannot book their own offer/i.test(error.message)) return 'Це ваша поїздка: як водій ви не можете забронювати в неї місце.';
    if (/idempotency key/i.test(error.message)) return 'Не вдалося пов’язати бронювання з маршрутом. Спробуйте забронювати ще раз.';
    if (error.status === 401 || error.status === 403) return 'Бронювання не підтверджено: спершу увійдіть в акаунт пасажира.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Не вдалося створити бронювання.';
}

// POST /bookings/:id/boarding answers in English; the driver has to see the real
// reason nothing was confirmed.
export function boardingFailureMessage(error: unknown): string {
  if (error instanceof Error && /Failed to fetch|NetworkError|Load failed|abort/i.test(error.message)) return 'Сервер не відповів. Посадку не підтверджено — повторіть сканування після відновлення зʼєднання.';
  if (error instanceof ProductionApiError) {
    if (error.code === 'ticket_invalid' || /ticket is invalid or expired/i.test(error.message)) return 'Квиток не підходить до цієї поїздки або прострочив. Посадку не підтверджено.';
    if (/booking cannot enter boarding/i.test(error.message)) return 'Бронювання більше не на етапі посадки. Посадку не підтверджено.';
    if (error.status === 404 || /booking unavailable/i.test(error.message)) return 'Це бронювання недоступне для вашого акаунта водія. Посадку не підтверджено.';
    if (error.status === 401 || error.status === 403) return 'Посадку не підтверджено: спершу увійдіть в акаунт водія.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Не вдалося підтвердити посадку.';
}

// GET /bookings/:id/ticket refuses once the trip left 'confirmed'; the passenger
// needs to know no ticket was issued rather than reading a raw English answer.
export function ticketFailureMessage(error: unknown): string {
  if (error instanceof Error && /Failed to fetch|NetworkError|Load failed|abort/i.test(error.message)) return 'Сервер не відповів. Квиток не видано — повторіть спробу після відновлення зʼєднання.';
  if (error instanceof ProductionApiError) {
    if (/no longer valid/i.test(error.message) || error.status === 409) return 'Квиток не видано: ця поїздка вже на іншому етапі — посадка, рух або завершення.';
    if (error.status === 404) return 'Квиток не видано: бронювання недоступне для вашого акаунта.';
    if (error.status === 401 || error.status === 403) return 'Квиток не видано: спершу увійдіть в акаунт пасажира.';
    return error.message;
  }
  return error instanceof Error && error.message.trim() ? error.message : 'Квиток недоступний.';
}
