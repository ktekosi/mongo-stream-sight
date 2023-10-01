import { describe, expect, test } from 'bun:test';
import { applyUpdatesToDocument } from '../../src/cache.ts';
import { type UpdateDescription } from 'mongodb';

describe('applyUpdatesToDocument', () => {
    test('should apply top-level field updates', () => {
        const doc = { a: 1, b: 2, c: 3 };
        const updates: UpdateDescription = {
            updatedFields: { b: 20, d: 4 }
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: 1, b: 20, c: 3, d: 4 });
    });

    test('should apply nested field updates', () => {
        const doc = { a: { x: 10, y: 20 }, b: 2 };
        const updates: UpdateDescription = {
            updatedFields: { 'a.x': 100 }
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: { x: 100, y: 20 }, b: 2 });
    });

    test('should remove top-level fields', () => {
        const doc = { a: 1, b: 2, c: 3 };
        const updates: UpdateDescription = {
            removedFields: ['b']
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: 1, c: 3 });
    });

    test('should remove nested fields', () => {
        const doc = { a: { x: 10, y: 20 }, b: 2 };
        const updates: UpdateDescription = {
            removedFields: ['a.x']
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: { y: 20 }, b: 2 });
    });

    test('should handle arrays in the path', () => {
        const doc = { a: [1, 2, 3], b: 4 };
        const updates: UpdateDescription = {
            updatedFields: { 'a.1': 20 },
            removedFields: ['a.2']
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: [1, 20], b: 4 });
    });

    test('should handle a mix of updates and removals', () => {
        const doc = { a: { x: 10, y: 20 }, b: 2, c: 3 };
        const updates: UpdateDescription = {
            updatedFields: { 'a.x': 100, d: 4 },
            removedFields: ['b', 'a.y']
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: { x: 100 }, c: 3, d: 4 });
    });

    test('should not modify the document if there are no updates or removals', () => {
        const doc = { a: 1, b: 2, c: 3 };
        const updates: UpdateDescription = {
            updatedFields: {},
            removedFields: []
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('should handle missing updatedFields', () => {
        const doc = { a: 1, b: 2, c: 3 };
        const updates: UpdateDescription = {
            removedFields: ['b']
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: 1, c: 3 });
    });

    test('should handle missing removedFields', () => {
        const doc = { a: 1, b: 2, c: 3 };
        const updates: UpdateDescription = {
            updatedFields: { b: 20 }
        };
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: 1, b: 20, c: 3 });
    });

    test('should not modify the document if both fields are missing', () => {
        const doc = { a: 1, b: 2, c: 3 };
        const updates: UpdateDescription = {};
        applyUpdatesToDocument(doc, updates);
        expect(doc).toEqual({ a: 1, b: 2, c: 3 });
    });
});
