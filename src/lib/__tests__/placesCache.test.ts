import test from 'node:test';
import assert from 'node:assert/strict';
import { PlacesCacheCorruptError, cachedRowToPlace, type PlacesCacheRow } from '../placesCache';

// SELL-05b — a corrupt cached value throws a named error and is declared; never an empty list.

const row = (over: Partial<PlacesCacheRow> = {}): PlacesCacheRow => ({
  placeId: 'p1', name: 'Café', address: 'Rua 1', rating: 4.5, reviewCount: 120, priceLevel: 2, website: null,
  types: '["restaurant","cafe"]', photos: '["ref-a"]', city: 'Lisbon', country: 'Portugal', category: 'dinner', latitude: 38.7, longitude: -9.1,
  ...over,
});
const photo = (ref: string) => `/api/places/photo?ref=${ref}`;

test('a well-formed row maps to the place the routes read', () => {
  const p = cachedRowToPlace(row(), photo);
  assert.deepEqual(p, { placeId: 'p1', name: 'Café', address: 'Rua 1', rating: 4.5, reviewCount: 120, priceLevel: 2, priceLevelDisplay: '$$', website: null, types: ['restaurant', 'cafe'], photos: ['/api/places/photo?ref=ref-a'], city: 'Lisbon', country: 'Portugal', category: 'dinner', latitude: 38.7, longitude: -9.1 });
  assert.deepEqual(cachedRowToPlace(row({ types: null, photos: '', priceLevel: null }), photo).types, []);
  assert.equal(cachedRowToPlace(row({ priceLevel: null }), photo).priceLevelDisplay, null);
});

test('a corrupt types or photos value throws PlacesCacheCorruptError naming the row and the field — never an empty list', () => {
  const corrupt = (over: Partial<PlacesCacheRow>, field: 'types' | 'photos') =>
    assert.throws(() => cachedRowToPlace(row(over), photo), (e: unknown) => e instanceof PlacesCacheCorruptError && e.name === 'PlacesCacheCorruptError' && e.placeId === 'p1' && e.field === field && /corrupt/.test(e.message));
  corrupt({ types: '{restaurant}' }, 'types');           // a Postgres array literal, not JSON
  corrupt({ photos: '{}' }, 'photos');                   // JSON, but not an array
  corrupt({ photos: '[1,2]' }, 'photos');                // an array, but not of strings
  corrupt({ types: 'not json at all' }, 'types');
});
