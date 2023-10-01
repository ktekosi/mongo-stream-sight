import { describe, expect, test } from 'bun:test';
import { insertIntoCache } from '../../src/cache.ts';
import { type Document } from 'mongodb';

describe('insertIntoCache', () => {
    test('should insert at the end if no sortOption is provided', () => {
        const cache: Document[] = [{ a: 1 }, { a: 2 }, { a: 3 }];
        const doc: Document = { a: 4 };
        insertIntoCache(cache, doc);
        expect(cache).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }]);
    });

    test('should insert based on the first sortOption field', () => {
        const cache: Document[] = [{ a: 1, b: 3 }, { a: 3, b: 2 }, { a: 5, b: 1 }];
        const doc: Document = { a: 4, b: 4 };
        insertIntoCache(cache, doc, { a: 1, b: 1 });
        expect(cache).toEqual([{ a: 1, b: 3 }, { a: 3, b: 2 }, { a: 4, b: 4 }, { a: 5, b: 1 }]);
    });

    test('should insert based on the second sortOption field if the first is equal', () => {
        const cache: Document[] = [{ a: 1, b: 3 }, { a: 3, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 1 }];
        const doc: Document = { a: 3, b: 3 };
        insertIntoCache(cache, doc, { a: 1, b: 1 });
        expect(cache).toEqual([{ a: 1, b: 3 }, { a: 3, b: 2 }, { a: 3, b: 3 }, { a: 3, b: 4 }, { a: 5, b: 1 }]);
    });

    test('should handle descending order for multiple sort fields', () => {
        const cache: Document[] = [{ a: 5, b: 1 }, { a: 3, b: 4 }, { a: 3, b: 2 }, { a: 1, b: 3 }];
        const doc: Document = { a: 3, b: 3 };
        insertIntoCache(cache, doc, { a: -1, b: -1 });
        expect(cache).toEqual([{ a: 5, b: 1 }, { a: 3, b: 4 }, { a: 3, b: 3 }, { a: 3, b: 2 }, { a: 1, b: 3 }]);
    });

    test('should handle nested fields in sortOption', () => {
        const cache: Document[] = [{ a: { b: 1, c: 3 } }, { a: { b: 3, c: 2 } }, { a: { b: 3, c: 4 } }];
        const doc: Document = { a: { b: 3, c: 3 } };
        insertIntoCache(cache, doc, { 'a.b': 1, 'a.c': 1 });
        expect(cache).toEqual([{ a: { b: 1, c: 3 } }, { a: { b: 3, c: 2 } }, { a: { b: 3, c: 3 } }, { a: { b: 3, c: 4 } }]);
    });
});
