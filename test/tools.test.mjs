import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPage, validateAssignments } from '../tools/build-page.mjs';
import { convert } from '../tools/from-class-manager.mjs';

const template = fs.readFileSync(new URL('../page/template.html', import.meta.url), 'utf8');
const item = (over = {}) => ({ id: 'a1', cls: 'HIS 101', color: 'burnt', type: 'reading', date: '2026-10-06', time: null, title: 'Read chapter 9', ...over });

test('demo data is valid and builds into a page with no placeholders left', () => {
  const assignments = JSON.parse(fs.readFileSync(new URL('../demo/assignments.json', import.meta.url)));
  const reader = JSON.parse(fs.readFileSync(new URL('../demo/reader.json', import.meta.url)));
  assert.deepEqual(validateAssignments(assignments), []);
  const html = buildPage(template, assignments, reader);
  assert.ok(!html.includes('__DATA__') && !html.includes('__READER__') && !html.includes('__FOOTER__'));
  assert.match(html, /4 classes · 20 items/);
});

test('the page declares UTF-8, so dashes and accents are not garbled when opened from disk', () => {
  assert.match(template.slice(0, 200), /<meta charset="utf-8">/i);
});

test('validation names each problem', () => {
  const problems = validateAssignments([item({ color: 'green' }), item({ type: 'essay', date: '10/6' })]);
  assert.ok(problems.some((p) => p.includes('color must be one of')));
  assert.ok(problems.some((p) => p.includes('type must be one of')));
  assert.ok(problems.some((p) => p.includes('date must be YYYY-MM-DD')));
  assert.ok(problems.some((p) => p.includes('duplicate id a1')));
});

test('titles cannot break out of the script tag', () => {
  const html = buildPage(template, [item({ title: '</script><img src=x onerror=alert(1)>' })]);
  assert.ok(!html.includes('</script><img'));
});

test('a Class Manager backup converts, skipping archived classes and mapping colors', () => {
  const backup = {
    classes: [
      { id: 'c1', name: 'STA 220', color: 'green', archived: false },
      { id: 'c2', name: 'Old class', color: 'blue', archived: true },
    ],
    assignments: [
      { id: 'x2', classId: 'c1', title: 'Problem set 6', dueDate: '2026-10-08', type: 'homework' },
      { id: 'x1', classId: 'c1', title: 'Quiz 3', dueDate: '2026-10-01', type: 'quiz' },
      { id: 'x3', classId: 'c2', title: 'Archived work', dueDate: '2026-10-02', type: 'homework' },
      { id: 'x4', classId: 'c1', title: 'Undated', dueDate: '', type: 'weird' },
    ],
  };
  const out = convert(backup);
  assert.deepEqual(out.map((a) => [a.id, a.color, a.type]), [['x1', 'teal', 'quiz'], ['x2', 'teal', 'homework']]);
  assert.deepEqual(validateAssignments(out), []);
  assert.throws(() => convert({}), /not a Class Manager backup/);
});
