import { describe, expect, test } from 'bun:test';
import { sortFieldChanged } from '../../src/cache.ts';
import { type UpdateDescription } from 'mongodb';

describe('sortFieldChanged', () => {
    test('should return true if a sort field is updated', () => {
        const sort = { a: 1, b: -1 };
        const updates: UpdateDescription = {
            updatedFields: { a: 10 }
        };
        expect(sortFieldChanged(sort, updates)).toBe(true);
    });

    test('should return true if a sort field is removed', () => {
        const sort = { a: 1, b: -1 };
        const updates: UpdateDescription = {
            removedFields: ['b']
        };
        expect(sortFieldChanged(sort, updates)).toBe(true);
    });

    test('should return false if no sort fields are updated or removed', () => {
        const sort = { a: 1, b: -1 };
        const updates: UpdateDescription = {
            updatedFields: { c: 10 },
            removedFields: ['d']
        };
        expect(sortFieldChanged(sort, updates)).toBe(false);
    });

    test('should handle missing updatedFields', () => {
        const sort = { a: 1, b: -1 };
        const updates: UpdateDescription = {
            removedFields: ['d']
        };
        expect(sortFieldChanged(sort, updates)).toBe(false);
    });

    test('should handle missing removedFields', () => {
        const sort = { a: 1, b: -1 };
        const updates: UpdateDescription = {
            updatedFields: { c: 10 }
        };
        expect(sortFieldChanged(sort, updates)).toBe(false);
    });

    test('should return true if a nested sort field is updated', () => {
        const sort = { 'a.b': 1, 'c.d.e': -1 };
        const updates: UpdateDescription = {
            updatedFields: { 'a.b': 10 }
        };
        expect(sortFieldChanged(sort, updates)).toBe(true);
    });

    test('should return true if a nested sort field is removed', () => {
        const sort = { 'a.b': 1, 'c.d.e': -1 };
        const updates: UpdateDescription = {
            removedFields: ['a.b']
        };
        expect(sortFieldChanged(sort, updates)).toBe(true);
    });

    test('should return false if no nested sort fields are updated or removed', () => {
        const sort = { 'a.b': 1, 'c.d.e': -1 };
        const updates: UpdateDescription = {
            updatedFields: { 'f.g': 10 },
            removedFields: ['h.i']
        };
        expect(sortFieldChanged(sort, updates)).toBe(false);
    });
});
