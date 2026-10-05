#!/usr/bin/env node
// build-page.mjs: Fill page/template.html with a semester's assignments (and an
// optional course reader) to produce one self-contained HTML checklist.
//
// Usage:
//   node tools/build-page.mjs --assignments demo/assignments.json --reader demo/reader.json --out dist/index.html
//   node tools/build-page.mjs --assignments my-assignments.json --footer "Spring 2027 · 5 classes"
//
// The output has no external dependencies except Google Fonts and can be
// opened straight from disk or hosted anywhere.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COLORS = ['blue', 'burnt', 'gold', 'rose', 'teal', 'violet'];
export const TYPES = ['exam', 'project', 'homework', 'reading', 'quiz', 'other'];

/** Return a list of problems with the assignments list. Empty means it can be rendered. */
export function validateAssignments(items) {
  const problems = [];
  if (!Array.isArray(items) || items.length === 0) return ['assignments must be a non-empty array'];
  const ids = new Set();
  items.forEach((a, i) => {
    const where = `item ${i} (${a && a.title ? a.title : 'untitled'})`;
    for (const key of ['id', 'cls', 'title', 'date']) {
      if (!a || typeof a[key] !== 'string' || !a[key]) problems.push(`${where}: missing ${key}`);
    }
    if (a && a.date && !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) problems.push(`${where}: date must be YYYY-MM-DD`);
    if (a && !COLORS.includes(a.color)) problems.push(`${where}: color must be one of ${COLORS.join(', ')}`);
    if (a && !TYPES.includes(a.type)) problems.push(`${where}: type must be one of ${TYPES.join(', ')}`);
    if (a && ids.has(a.id)) problems.push(`${where}: duplicate id ${a.id}`);
    if (a) ids.add(a.id);
  });
  return problems;
}

/** JSON that is safe to place inside a <script> tag. */
function scriptJson(value) {
  // Escape "<" (so "</script>" can't end the tag) and the two Unicode line
  // separators, which are valid in JSON but not in older JavaScript strings.
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(value).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
}

export function buildPage(template, assignments, reader = [], footer = '') {
  const problems = validateAssignments(assignments);
  if (problems.length) throw new Error(problems.join('\n'));
  const classes = new Set(assignments.map((a) => a.cls)).size;
  const text = footer || `${classes} class${classes === 1 ? '' : 'es'} · ${assignments.length} items`;
  return template
    .replace('"__DATA__"', scriptJson(assignments))
    .replace('"__READER__"', scriptJson(reader))
    .replace('__FOOTER__', text.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assignmentsPath = arg('--assignments');
  if (!assignmentsPath) {
    console.error('Usage: node tools/build-page.mjs --assignments FILE [--reader FILE] [--footer TEXT] [--out FILE]');
    process.exit(2);
  }
  const out = arg('--out', path.join(ROOT, 'dist', 'index.html'));
  try {
    const template = fs.readFileSync(path.join(ROOT, 'page', 'template.html'), 'utf8');
    const assignments = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8'));
    const readerPath = arg('--reader');
    const reader = readerPath ? JSON.parse(fs.readFileSync(readerPath, 'utf8')) : [];
    const html = buildPage(template, assignments, reader, arg('--footer', ''));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    console.log(`Wrote ${out} (${assignments.length} items)`);
  } catch (error) {
    console.error(`Could not build the page:\n${error.message}`);
    process.exit(1);
  }
}
