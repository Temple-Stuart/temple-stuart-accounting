import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEM_SHEET, type FamilyName } from '../problemSheet';
import { COCKPIT_PATH, FAMILIES, FAMILY_PAGES, TOOL_REGISTRY, familyCards, familyMenu, familyOfPath, registryLaw, toolsOf } from '../toolRegistry';

// NAV-02 — the family MENUS and the family PAGES come from one source (the registry). Hermetic:
// the real constants must pass the law (the module ran it at import); failing shapes are injected.

test('FAMILY_PAGES: six single-segment routes, one per family, unique; familyOfPath round-trips', () => {
  assert.deepEqual(Object.keys(FAMILY_PAGES), [...FAMILIES]);
  assert.deepEqual(FAMILIES.map((f) => FAMILY_PAGES[f]), ['/work', '/money-in', '/money-out', '/what-you-own', '/what-you-owe', '/the-proof']);
  for (const f of FAMILIES) assert.equal(familyOfPath(FAMILY_PAGES[f]), f);
  assert.equal(familyOfPath('/answers'), null);
  assert.equal(familyOfPath('/books'), null);
  assert.equal(familyOfPath(null), null);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
});

test('the law: a family page route must be kebab-case, unique, and never a cockpit path or a tool home', () => {
  const good = { ...FAMILY_PAGES };
  assert.deepEqual(registryLaw({ throwOnFail: false, familyPages: good }), []);
  const dup = { ...FAMILY_PAGES, 'THE PROOF': '/work' } as Record<FamilyName, string>;
  assert.match(registryLaw({ throwOnFail: false, familyPages: dup }).join('\n'), /not unique/);
  const cockpit = { ...FAMILY_PAGES, 'THE PROOF': '/books' } as Record<FamilyName, string>;
  assert.match(registryLaw({ throwOnFail: false, familyPages: cockpit }).join('\n'), /collides with a cockpit path or a tool's home/);
  const home = { ...FAMILY_PAGES, 'THE WORK': '/agenda' } as Record<FamilyName, string>;
  assert.match(registryLaw({ throwOnFail: false, familyPages: home }).join('\n'), /collides/);
  const nested = { ...FAMILY_PAGES, 'MONEY IN': '/money/in' } as Record<FamilyName, string>;
  assert.match(registryLaw({ throwOnFail: false, familyPages: nested }).join('\n'), /not a single-segment kebab-case route/);
  const missing = Object.fromEntries(Object.entries(FAMILY_PAGES).slice(0, 5)) as Record<FamilyName, string>;
  assert.match(registryLaw({ throwOnFail: false, familyPages: missing }).join('\n'), /must name the 6 families exactly/);
});

test('familyMenu: "All of <FAMILY>" first (→ the family page), then the tools in sheet order with their doors', () => {
  for (const { header, tools } of PROBLEM_SHEET) {
    const menu = familyMenu(header);
    assert.equal(menu.length, tools.length + 1);
    const [first, ...rest] = menu;
    assert.deepEqual(first, { kind: 'family', label: `All of ${header}`, href: FAMILY_PAGES[header] });
    assert.deepEqual(rest.map((i) => (i.kind === 'tool' ? i.tool.name : '?')), [...tools]);
    for (const item of rest) {
      assert.equal(item.kind, 'tool');
      if (item.kind !== 'tool') continue;
      const t = item.tool;
      if (t.status === 'NOT_BUILT') assert.deepEqual(item.door, { kind: 'none' });
      else if (t.cockpitKey) assert.deepEqual(item.door, { kind: 'cockpit', key: t.cockpitKey, href: COCKPIT_PATH[t.cockpitKey] });
      else assert.deepEqual(item.door, { kind: 'route', href: t.home });
    }
  }
  // Compliance: the menu opens the cockpit section (the carve-out's /?tab= URL), the card opens the registry home.
  const proof = familyMenu('THE PROOF').find((i) => i.kind === 'tool' && i.tool.name === 'Compliance');
  assert.ok(proof && proof.kind === 'tool');
  assert.deepEqual(proof.door, { kind: 'cockpit', key: 'compliance', href: '/?tab=compliance' });
  const card = familyCards('THE PROOF').find((c) => c.tool.name === 'Compliance');
  assert.equal(card?.home, '/compliance');
});

test('familyCards: one card per tool in sheet order — the registry home, the related surfaces resolved to doors; NOT_BUILT has neither', () => {
  for (const { header, tools } of PROBLEM_SHEET) {
    const cards = familyCards(header);
    assert.deepEqual(cards.map((c) => c.tool.name), [...tools]);
    for (const c of cards) {
      assert.equal(c.home, c.tool.home);
      if (c.tool.status === 'NOT_BUILT') { assert.equal(c.home, null); assert.equal(c.links.length, 0); }
      for (const l of c.links) assert.notEqual(l.door.kind, 'none');
    }
  }
  const budget = familyCards('MONEY OUT').find((c) => c.tool.name === 'Budget');
  assert.ok(budget);
  assert.equal(budget.home, '/business');
  assert.deepEqual(budget.links.find((l) => l.label.startsWith('Runway'))?.door, { kind: 'cockpit', key: 'calendar', href: '/runway' });
  assert.deepEqual(budget.links.find((l) => l.label === 'Personal')?.door, { kind: 'route', href: '/personal' });
});

test('every tool is in exactly one family menu and on exactly one family page, once each, and it is its own family', () => {
  const inMenus = new Map<string, FamilyName[]>();
  const onPages = new Map<string, FamilyName[]>();
  for (const f of FAMILIES) {
    for (const item of familyMenu(f)) if (item.kind === 'tool') inMenus.set(item.tool.name, [...(inMenus.get(item.tool.name) ?? []), f]);
    for (const c of familyCards(f)) onPages.set(c.tool.name, [...(onPages.get(c.tool.name) ?? []), f]);
  }
  assert.equal(TOOL_REGISTRY.length, 25);
  for (const t of TOOL_REGISTRY) {
    assert.deepEqual(inMenus.get(t.name), [t.family], `${t.name} in menus`);
    assert.deepEqual(onPages.get(t.name), [t.family], `${t.name} on pages`);
  }
  assert.equal([...inMenus.values()].flat().length, 25);
  assert.equal([...onPages.values()].flat().length, 25);
  for (const f of FAMILIES) assert.equal(familyCards(f).length, toolsOf(f).length);
});
