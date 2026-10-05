#!/usr/bin/env node
// from-class-manager.mjs: Convert a Class Manager backup (Settings > Export
// backup) into the assignments list that build-page.mjs expects.
//
// Usage:
//   node tools/from-class-manager.mjs class-manager-backup.json > my-assignments.json
//
// Archived classes are skipped. Completed assignments are kept but start
// unchecked, because Night Desk keeps its own check-offs per browser.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Class Manager has eight colors; Night Desk's palette has six.
const COLOR_MAP = { burnt: 'burnt', gold: 'gold', teal: 'teal', blue: 'blue', violet: 'violet', rose: 'rose', green: 'teal', slate: 'blue' };
const TYPES = new Set(['exam', 'project', 'homework', 'reading', 'quiz', 'other']);

export function convert(backup) {
  if (!backup || !Array.isArray(backup.classes) || !Array.isArray(backup.assignments)) {
    throw new Error('not a Class Manager backup: expected "classes" and "assignments" arrays');
  }
  const classes = new Map(backup.classes.filter((c) => !c.archived).map((c) => [c.id, c]));
  return backup.assignments
    .filter((a) => classes.has(a.classId) && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate || ''))
    .map((a) => {
      const cls = classes.get(a.classId);
      return {
        id: String(a.id),
        cls: cls.name,
        color: COLOR_MAP[cls.color] || 'burnt',
        type: TYPES.has(a.type) ? a.type : 'other',
        date: a.dueDate,
        time: null,
        title: a.title,
      };
    })
    .sort((x, y) => x.date.localeCompare(y.date) || x.cls.localeCompare(y.cls));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node tools/from-class-manager.mjs <class-manager-backup.json>');
    process.exit(2);
  }
  try {
    const items = convert(JSON.parse(fs.readFileSync(file, 'utf8')));
    process.stdout.write(JSON.stringify(items, null, 2) + '\n');
    console.error(`Converted ${items.length} assignments.`);
  } catch (error) {
    console.error(`Could not convert: ${error.message}`);
    process.exit(1);
  }
}
