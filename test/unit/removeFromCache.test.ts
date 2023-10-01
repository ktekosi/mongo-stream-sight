import { ObjectId } from 'mongodb';
import { describe, expect, test } from 'bun:test';
import { removeFromCache } from '../../src/cache.ts';
import { type Document } from 'mongodb';

describe('removeFromCache', () => {
    test('should remove a document with the given id', () => {
        const doc1 = { _id: new ObjectId('60d5ec9af682f49f4903cd31'), name: 'Alice' };
        const doc2 = { _id: new ObjectId('60d5ec9af682f49f4903cd32'), name: 'Bob' };
        const doc3 = { _id: new ObjectId('60d5ec9af682f49f4903cd33'), name: 'Charlie' };
        const cache: Document[] = [doc1, doc2, doc3];

        removeFromCache(cache, '60d5ec9af682f49f4903cd32');

        expect(cache).toEqual([doc1, doc3]);
    });

    test('should not modify the cache if the id is not found', () => {
        const doc1 = { _id: new ObjectId('60d5ec9af682f49f4903cd31'), name: 'Alice' };
        const doc2 = { _id: new ObjectId('60d5ec9af682f49f4903cd32'), name: 'Bob' };
        const cache: Document[] = [doc1, doc2];

        removeFromCache(cache, '60d5ec9af682f49f4903cd33');

        expect(cache).toEqual([doc1, doc2]);
    });

    test('should handle an empty cache', () => {
        const cache: Document[] = [];

        removeFromCache(cache, '60d5ec9af682f49f4903cd31');

        expect(cache).toEqual([]);
    });
});
