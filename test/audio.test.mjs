import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForSpeech } from '../audio/normalize.mjs';
import { cleanForListening } from '../audio/clean-text.mjs';

test('speech normalization reads abbreviations, numerals, and money naturally', () => {
  assert.equal(normalizeForSpeech('After WWII, Louis XIV and Chapter IV, e.g. trade'),
    'After World War Two, Louis the Fourteenth and Chapter Four, for example, trade');
  assert.equal(normalizeForSpeech('As Smith et al. argued.'), 'As Smith and colleagues argued.');
  assert.equal(normalizeForSpeech('As Smith et al . argued.'), 'As Smith and colleagues argued.'); // stray space from PDF extraction
  assert.equal(normalizeForSpeech('This was shown by Smith et al. Later work agreed.'), 'This was shown by Smith and colleagues. Later work agreed.');
  assert.equal(normalizeForSpeech('Smith et al. spent $4 billion in 1914–1918'),
    'Smith and colleagues spent 4 billion dollars in 1914 to 1918');
  assert.equal(normalizeForSpeech('trade & war and/or 9/11'), 'trade and war and or September 11th');
});

test('cleaning drops page numbers, running headers, citations, links, and references', () => {
  const header = 'JOURNAL OF WORLD HISTORY VOL 12';
  const bodies = ['Trade along the routes grew quickly.', 'Merchants carried silk east to west.', 'Caravans stopped at oasis towns.',
    'Ports grew around the Indian Ocean.', 'Coins moved between empires.', 'Ideas traveled with the goods.',
    'Plague followed the same roads.', 'The routes declined as sea trade rose.'];
  const pages = bodies.map((body, i) => `${i + 1} ${header} ${body} (Smith 2001, 14) See https://example.org/x.`);
  pages[7] += ' References Smith, J. 2001. Trade. Press.';
  const text = cleanForListening(pages);
  assert.ok(!text.includes(header), 'running header removed');
  assert.ok(!/\(Smith 2001/.test(text), 'citation removed');
  assert.ok(!text.includes('https://'), 'link removed');
  assert.ok(!text.includes('References'), 'reference list removed');
  assert.ok(text.startsWith('Trade along the routes grew quickly.'), 'page number removed');
  assert.ok(text.includes('The routes declined as sea trade rose.'), 'last page kept up to the references');
});

test('a scanned page of single characters is dropped', () => {
  const garbage = 'a b c d e f g h i j k l m n o p';
  assert.equal(cleanForListening([garbage]), '');
});
