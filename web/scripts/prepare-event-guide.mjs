import { readFile, writeFile } from 'node:fs/promises';
import { EVENT_CARDS } from '../src/events.js';

// Refresh only the data table; retain the authored explanations around it.
const target = new URL('../../docs/co-ty-phu/13-event-logic-guide.md', import.meta.url);
const start = '<!-- EVENT_CATALOG_START -->';
const end = '<!-- EVENT_CATALOG_END -->';
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const signed = value => `${value > 0 ? '+' : ''}${value}`;
const describe = choice => {
  const amount = choice.outcomes
    ? choice.outcomes.map(row => `${Math.round(row.weight * 100)}%: ${signed(row.delta)}`).join('; ')
    : signed(choice.delta);
  return `${choice.id}: ${choice.label} → ${amount}${choice.minMoney ? ` (cần ${choice.minMoney})` : ''}`;
};
const rows = EVENT_CARDS.map(card =>
  `| ${card.id} | ${card.category} | ${escape(card.title)} | ${escape(card.choices.length ? card.choices.map(describe).join(' / ') : signed(card.delta))} |`);
const table = [
  '| ID | Loại | Tên sự kiện | Lựa chọn và MONEY |',
  '| --- | --- | --- | --- |',
  ...rows
].join('\n');
const doc = await readFile(target, 'utf8');
const first = doc.indexOf(start), last = doc.indexOf(end);
if (first < 0 || last < first || doc.indexOf(start, first + start.length) >= 0 || doc.indexOf(end, last + end.length) >= 0) {
  throw new Error('Event guide must contain one ordered catalog marker pair');
}
await writeFile(target, `${doc.slice(0, first)}${start}\n${table}\n${doc.slice(last)}`, 'utf8');
console.log(`Updated ${rows.length} event rows in the V5 logic guide.`);
