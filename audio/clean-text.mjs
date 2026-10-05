// clean-text.mjs: Turn reading PDFs into plain text that sounds right when read
// aloud. It pulls the text layer with pdf.js, then drops cover and permissions
// pages, page numbers, repeated running headers, in-text citations, links, and
// everything from the reference list on.
//
// Usage:
//   node audio/clean-text.mjs readings/ texts/      # every PDF in readings/ -> texts/<name>.txt
//
// Scanned PDFs have no text layer. They are reported as "no text"; run
// audio/ocr_pdf.swift on them first.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeForSpeech } from './normalize.mjs';

export async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    try {
      const tc = await (await doc.getPage(p)).getTextContent();
      let out = '';
      const items = tc.items.filter(i => i.str !== undefined);
      for (let k = 0; k < items.length; k++) {
        const cur = items[k], next = items[k + 1];
        out += cur.str;
        if (!next) break;
        if (cur.hasEOL) { out += ' '; continue; }
        const h = cur.height || 10;
        if (Math.abs(next.transform[5] - cur.transform[5]) > h * 0.5) { out += ' '; continue; }
        const gap = next.transform[4] - (cur.transform[4] + (cur.width || 0));
        if (gap > Math.max(1.0, h * 0.16)) out += ' ';
      }
      pages.push(out.replace(/\s+/g, ' ').trim());
    } catch { pages.push(''); }
  }
  return pages;
}

export function singleCharRatio(t) {
  const toks = t.split(/\s+/).filter(Boolean);
  if (!toks.length) return 0;
  return toks.filter(w => w.length === 1).length / toks.length;
}

export function cleanForListening(pages) {
  pages = pages.filter((t, i) => {
    if (i < 2 && /Full Terms & Conditions|To cite this article|Registered in England|CROSS REF ID|Rapid #|This content downloaded|Stable URL/i.test(t) && t.length < 3000) return false;
    if (i < 2 && /rights ?reserved|\.com\/Permissions/i.test(t) && t.length < 2000) return false;
    if (singleCharRatio(t) > 0.35) return false;
    return true;
  });
  pages = pages.map(t => t.replace(/^\d{1,4}\s+/, ''));
  const starts = {};
  for (const t of pages) {
    for (const n of [3, 4, 6, 8, 10]) {
      const key = t.split(' ').slice(0, n).join(' ');
      if (key.length > 10) starts[key] = (starts[key] || 0) + 1;
    }
  }
  const minRepeat = Math.max(3, Math.ceil(pages.length * 0.25));
  const repeated = Object.entries(starts).filter(([, n]) => n >= minRepeat).map(([k]) => k)
    .sort((a, b) => b.length - a.length);
  let text = pages.map(t => {
    let changed = true;
    while (changed) {
      changed = false;
      const before = t;
      t = t.replace(/^\d{1,4}\s+/, '');
      for (const r of repeated) if (t.startsWith(r)) t = t.slice(r.length).trim();
      changed = t !== before;
    }
    return t;
  }).join(' ');

  const half = Math.floor(text.length / 2);
  const m = text.slice(half).match(/\b(References|REFERENCES|Bibliography|BIBLIOGRAPHY|Works Cited|Notes on Contributors|NOTES \d)\b/);
  if (m) text = text.slice(0, half + m.index);

  return text
    .replace(/Ļ/g, 'Th')
    .replace(/(^|\s)[^\w\s]{2,}(?=\s|$)/g, ' ')
    .replace(/([A-Za-z]) (ff|ffi|ffl|fi|fl) ([a-z])/g, '$1$2$3')
    .replace(/([a-z])- ([a-z])/g, '$1$2')
    .replace(/\s*\((?=[^()]{0,120}\b(19|20)\d{2}\b)[^()]{0,140}\)/g, '')
    .replace(/\[\s*\d+(\s*[,–-]\s*\d+)*\s*\]/g, '')
    .replace(/https?:\/\/\S+|www\.\S+|doi:?\s*\S+|DOI:?\s*\S+/gi, '')
    .replace(/Downloaded (from|by)[^.]{0,120}\./gi, '')
    .replace(/ISSN[^.]{0,60}\./gi, '')
    .replace(/©[^.]{0,100}\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [inDir, outDir] = process.argv.slice(2);
  if (!inDir || !outDir) {
    console.error('Usage: node audio/clean-text.mjs <folder-of-pdfs> <output-folder>');
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const pdfs = fs.readdirSync(inDir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
  for (const file of pdfs) {
    const text = normalizeForSpeech(cleanForListening(await extractText(path.join(inDir, file))));
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 200) {
      console.log(`no text  ${file} (${words} words; probably scanned, run ocr_pdf first)`);
      continue;
    }
    fs.writeFileSync(path.join(outDir, file.replace(/\.pdf$/i, '.txt')), text + '\n');
    console.log(`ok       ${file} (${words} words)`);
  }
}
