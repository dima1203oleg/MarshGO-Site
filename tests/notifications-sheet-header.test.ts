import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function notificationsSheet(): string {
  const source = readFileSync('src/views/ProductionMarketplace.tsx', 'utf8');
  const line = source.split('\n').find((row) => row.includes('aria-labelledby="notification-heading"'));
  assert.ok(line, 'the notifications sheet must stay reachable from the header bell');
  return line;
}

describe('notifications sheet header keeps 44 px actions on one line', () => {
  it('grows both header actions to the touch-target floor', () => {
    const line = notificationsSheet();
    assert.match(
      line,
      /<button disabled=\{!notificationPage\.unreadCount\} onClick=\{\(\)=>void markAllNotificationsRead\(\)\} className="min-h-11 whitespace-nowrap rounded-full px-2 text-xs font-bold text-blue-700 disabled:text-slate-300">Прочитати все<\/button>/,
      '«Прочитати все» was an 87×32 text link that wrapped onto two lines',
    );
    assert.match(
      line,
      /aria-label="Закрити сповіщення" className="grid h-11 w-11/,
      'the close X had no 44×44 box of its own',
    );
  });

  it('never lets the title squeeze the actions off the sheet', () => {
    const line = notificationsSheet();
    assert.match(line, /<div className="min-w-0 flex-1 pl-2">/, 'the title block must yield width instead of pushing the actions');
    assert.match(line, /<div className="flex shrink-0 items-center gap-1">/, 'the action cluster stays at its natural width');
  });
});
