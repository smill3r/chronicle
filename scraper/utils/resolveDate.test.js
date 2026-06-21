import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDate, parseDisplayDate, detectEra } from './resolveDate.js'

test('resolveDate: inline BC date', () => {
  const r = resolveDate({ rawLine: '3200 BC: Sumerian cuneiform writing.', headingContext: '4th millennium BC' })
  assert.equal(r.year, -3200)
  assert.equal(r.yearDisplay, '3200 BC')
  assert.equal(r.datePrecision, 'year')
})

test('resolveDate: bare number inherits BC from heading', () => {
  const r = resolveDate({ rawLine: '777 Cumae is founded by Chalcis', headingContext: 'Archaic Period (785–481 BC)' })
  assert.equal(r.year, -777)
  assert.equal(r.yearDisplay, '777 BC')
})

test('resolveDate: circa range', () => {
  const r = resolveDate({ rawLine: 'c. 300–250 BC: Library of Alexandria founded.', headingContext: '' })
  assert.equal(r.year, -300)
  assert.equal(r.datePrecision, 'range')
})

test('resolveDate: month-only line takes year from heading', () => {
  const r = resolveDate({ rawLine: 'April 27: Riots in Paris.', headingContext: '1789 – The Revolution Begins' })
  assert.equal(r.year, 1789)
  assert.equal(r.datePrecision, 'day')
})

test('resolveDate: heading with leading day number still finds the year', () => {
  const r = resolveDate({ rawLine: 'Germany invades Poland.', headingContext: '1 September 1939' })
  assert.equal(r.year, 1939)
})

test('resolveDate: kya is always BC', () => {
  const r = resolveDate({ rawLine: '80 kya – 40 kya: Aboriginal culture.', headingContext: 'Prehistory' })
  assert.equal(r.year, -80000)
  assert.equal(r.datePrecision, 'range')
})

test('resolveDate: decade heading', () => {
  const r = resolveDate({ rawLine: 'Suffrage act rescinded.', headingContext: '1930s' })
  assert.equal(r.year, 1930)
})

test('resolveDate: unresolvable returns year 0', () => {
  const r = resolveDate({ rawLine: 'As agreed in advance, members resign.', headingContext: "The Coup d'État" })
  assert.equal(r.year, 0)
  assert.equal(r.resolved, false)
})

test('resolveDate: modern AD year has no "AD" suffix', () => {
  const r = resolveDate({ rawLine: '1945: Cold War begins.', headingContext: '' })
  assert.equal(r.yearDisplay, '1945')
})

test('parseDisplayDate: skips millennium/century (digit is not the year)', () => {
  assert.equal(parseDisplayDate('Late 4th millennium BC', 'BC'), null)
  assert.equal(parseDisplayDate('Late 24th century BC', 'BC'), null)
})

test('parseDisplayDate: skips month-only display (no year to recover)', () => {
  assert.equal(parseDisplayDate('May 6', 'AD'), null)
  assert.equal(parseDisplayDate('January', 'AD'), null)
})

test('parseDisplayDate: day-leading display picks the year, not the day', () => {
  const r = parseDisplayDate('27 April 1789', 'AD')
  assert.equal(r.year, 1789)
})

test('parseDisplayDate: garbage-with-leading-number + BC era hint', () => {
  const r = parseDisplayDate('728 Thapsos abandonment', 'BC')
  assert.equal(r.year, -728)
  assert.equal(r.yearDisplay, '728 BC')
})

test('parseDisplayDate: explicit AD marker beats BC era hint', () => {
  // legitimate AD event in a BC-leaning article must not be flipped
  const r = parseDisplayDate('c. 1 – 50 AD', 'BC')
  assert.equal(r.year, 1)
})

test('detectEra: BC vs AD vs none', () => {
  assert.equal(detectEra('Archaic Period (785–481 BC)'), 'BC')
  assert.equal(detectEra('50 AD'), 'AD')
  assert.equal(detectEra('1789 – The Revolution'), null)
})
