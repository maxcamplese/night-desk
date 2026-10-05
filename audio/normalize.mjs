// normalize.mjs: Rewrite text so a text-to-speech voice reads it naturally:
// "WWII" becomes "World War Two", "Louis XIV" becomes "Louis the Fourteenth",
// "e.g." becomes "for example", "$4 billion" becomes "4 billion dollars".
//
// Usage:
//   node audio/normalize.mjs texts/          # rewrite every .txt file in the folder, in place
//   import { normalizeForSpeech } from './normalize.mjs'

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORD = { II: 'the Second', III: 'the Third', IV: 'the Fourth', V: 'the Fifth', VI: 'the Sixth', VII: 'the Seventh', VIII: 'the Eighth', IX: 'the Ninth', X: 'the Tenth', XI: 'the Eleventh', XII: 'the Twelfth', XIV: 'the Fourteenth', XVI: 'the Sixteenth' };
const CARD = { I: 'One', II: 'Two', III: 'Three', IV: 'Four', V: 'Five', VI: 'Six', VII: 'Seven', VIII: 'Eight', IX: 'Nine', X: 'Ten' };
const NAMES = '(Charles|Henry|Louis|Napoleon|George|Edward|William|Frederick|Wilhelm|Alexander|Nicholas|Catherine|Elizabeth|Leopold|Philip|James|Richard|Gustavus|Selim|Mehmed|Suleiman|Peter|Paul|Pius|Leo|Urban|Innocent|Benedict|Gregory)';
const SEQ = '(Article|Articles|Chapter|Chapters|Volume|Part|Section|Sections|Act|Phase|Type|Class|Category|Annex|Protocol|Title|Appendix|Book|War)';

export function normalizeForSpeech(t) {
  return t
    .replace(/\bWWII\b/g, 'World War Two')
    .replace(/\bWWI\b/g, 'World War One')
    .replace(/\bWW2\b/g, 'World War Two')
    .replace(/\bWW1\b/g, 'World War One')
    .replace(/\bWorld War II\b/g, 'World War Two')
    .replace(/\bWorld War I\b(?!I)/g, 'World War One')
    .replace(new RegExp('\\b' + NAMES + ' (XVI|XIV|XII|XI|VIII|VII|VI|IX|IV|V|X|III|II)\\b', 'g'), (m, n, r) => n + ' ' + (ORD[r] || r))
    .replace(new RegExp('\\b' + SEQ + ' (VIII|VII|VI|IX|IV|V|X|III|II|I)\\b', 'g'), (m, s, r) => s + ' ' + (CARD[r] || r))
    .replace(/\be\.g\.,?\s/g, 'for example, ')
    .replace(/\bi\.e\.,?\s/g, 'that is, ')
    // "Smith et al. argue" must not keep the period, or the voice pauses as if a sentence ended
    .replace(/\bet al\s?\.(\s+)(?=[a-z])/g, 'and colleagues$1')
    .replace(/\bet al\b/g, 'and colleagues')
    .replace(/\bcf\.\s/g, 'compare ')
    .replace(/\bvs\.\s/g, 'versus ')
    .replace(/\bca\.\s(?=\d)/g, 'around ')
    .replace(/\bNo\.\s?(\d)/g, 'Number $1')
    .replace(/\b(\d{3,4})\s?[–—]\s?(\d{2,4})\b/g, '$1 to $2')
    .replace(/\$([\d,.]+)\s?(billion|million|trillion)\b/gi, '$1 $2 dollars')
    .replace(/\$([\d,.]+)\b/g, '$1 dollars')
    .replace(/\band\/or\b/g, 'and or')
    .replace(/\b9\/11\b/g, 'September 11th')
    .replace(/\s&\s/g, ' and ')
    .replace(/\s+/g, ' ');
}


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('Usage: node audio/normalize.mjs <folder-of-txt-files> [...]');
    process.exit(2);
  }
  let changed = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.txt'))) {
      const p = path.join(dir, f);
      const text = fs.readFileSync(p, 'utf8');
      const out = normalizeForSpeech(text);
      if (out !== text) { fs.writeFileSync(p, out); changed++; }
    }
  }
  console.log(`Normalized ${changed} file(s).`);
}
