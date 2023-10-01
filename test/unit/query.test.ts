import { describe, expect, test } from 'bun:test';
import { documentMatchesQuery } from '../../src/query.ts';

describe('documentMatchesQuery', () => {
    test('should match simple equality', () => {
        const doc = { name: 'John' };
        const query = { name: 'John' };
        expect(documentMatchesQuery(doc, query)).toBe(true);
    });

    test('should not match incorrect values', () => {
        const doc = { name: 'John' };
        const query = { name: 'Doe' };
        expect(documentMatchesQuery(doc, query)).toBe(false);
    });

    describe('comparison operators', () => {
        test('should match using $eq operator', () => {
            const doc = { age: 25 };
            const query = { age: { $eq: 25 } };
            const match = documentMatchesQuery(doc, query);
            expect(match).toBe(true);
        });

        test('$ne operator', () => {
            const doc = { age: 25 };
            const query = { age: { $ne: 30 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$gt operator', () => {
            const doc = { age: 30 };
            const query = { age: { $gt: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$gte operator', () => {
            const doc = { age: 30 };
            const query = { age: { $gte: 30 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$lt operator', () => {
            const doc = { age: 20 };
            const query = { age: { $lt: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$lte operator', () => {
            const doc = { age: 20 };
            const query = { age: { $lte: 20 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$in operator', () => {
            const doc = { age: 30 };
            const query = { age: { $in: [25, 30, 35] } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$nin operator', () => {
            const doc = { age: 40 };
            const query = { age: { $nin: [25, 30, 35] } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        // Date comparison
        test('Date comparison using $eq', () => {
            const date = new Date('2023-01-01');
            const doc = { birthdate: date };
            const query = { birthdate: { $eq: new Date('2023-01-01') } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('Date comparison using $lt', () => {
            const date = new Date('2023-01-01');
            const doc = { birthdate: date };
            const query = { birthdate: { $lt: new Date('2023-02-01') } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$eq operator should not match', () => {
            const doc = { age: 25 };
            const query = { age: { $eq: 30 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$ne operator should not match', () => {
            const doc = { age: 25 };
            const query = { age: { $ne: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$gt operator should not match', () => {
            const doc = { age: 20 };
            const query = { age: { $gt: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$gte operator should not match', () => {
            const doc = { age: 20 };
            const query = { age: { $gte: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$lt operator should not match', () => {
            const doc = { age: 30 };
            const query = { age: { $lt: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$lte operator should not match', () => {
            const doc = { age: 30 };
            const query = { age: { $lte: 20 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$in operator should not match', () => {
            const doc = { age: 40 };
            const query = { age: { $in: [25, 30, 35] } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$nin operator should not match', () => {
            const doc = { age: 30 };
            const query = { age: { $nin: [25, 30, 35] } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Negative Date comparison
        test('Date comparison using $eq should not match', () => {
            const date = new Date('2023-01-02');
            const doc = { birthdate: date };
            const query = { birthdate: { $eq: new Date('2023-01-01') } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('Date comparison using $lt should not match', () => {
            const date = new Date('2023-01-01');
            const doc = { birthdate: date };
            const query = { birthdate: { $lt: new Date('2023-01-01') } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('logical operators', () => {
        test('$and operator should match', () => {
            const doc = { age: 30, name: 'John' };
            const query = { $and: [{ age: { $gt: 25 } }, { name: 'John' }] };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$and operator should not match', () => {
            const doc = { age: 20, name: 'John' };
            const query = { $and: [{ age: { $gt: 25 } }, { name: 'John' }] };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$or operator should match', () => {
            const doc = { age: 20, name: 'John' };
            const query = { $or: [{ age: { $lt: 25 } }, { name: 'Doe' }] };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$or operator should not match', () => {
            const doc = { age: 30, name: 'John' };
            const query = { $or: [{ age: { $lt: 25 } }, { name: 'Doe' }] };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$not operator should match', () => {
            const doc = { age: 30 };
            const query = { age: { $not: { $lt: 25 } } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$not operator should not match', () => {
            const doc = { age: 20 };
            const query = { age: { $not: { $lt: 25 } } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$nor operator should match', () => {
            const doc = { age: 40, name: 'Doe' };
            const query = { $nor: [{ age: { $lt: 25 } }, { name: 'John' }] };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$nor operator should not match', () => {
            const doc = { age: 20, name: 'John' };
            const query = { $nor: [{ age: { $lt: 25 } }, { name: 'John' }] };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('regexp formats', () => {
        // Direct RegExp instance
        test('Direct RegExp instance should match', () => {
            const doc = { name: 'John' };
            const query = { name: /John/ };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('Direct RegExp instance should not match', () => {
            const doc = { name: 'Doe' };
            const query = { name: /John/ };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Using $regex and $options
        test('$regex with $options should match', () => {
            const doc = { name: 'john' };
            const query = { name: { $regex: 'john', $options: 'i' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$regex with $options should not match', () => {
            const doc = { name: 'Doe' };
            const query = { name: { $regex: 'john', $options: 'i' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Using RegExp with flags
        test('RegExp with flags should match', () => {
            const doc = { name: 'john' };
            const query = { name: /JOHN/i };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('RegExp with flags should not match', () => {
            const doc = { name: 'Doe' };
            const query = { name: /JOHN/i };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Using string pattern for $regex
        test('String pattern for $regex should match', () => {
            const doc = { name: 'John' };
            const query = { name: { $regex: 'John' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('String pattern for $regex should not match', () => {
            const doc = { name: 'Doe' };
            const query = { name: { $regex: 'John' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('$text opeartor', () => {
        test('$text should match with case sensitivity', () => {
            const doc = { description: 'The quick brown fox jumps over the lazy dog' };
            const query = { description: { $text: { $search: 'quick brown', $caseSensitive: true } } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$text should not match with case sensitivity', () => {
            const doc = { description: 'The quick brown fox jumps over the lazy dog' };
            const query = { description: { $text: { $search: 'Quick Brown', $caseSensitive: true } } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$text should match without case sensitivity', () => {
            const doc = { description: 'The quick brown fox jumps over the lazy dog' };
            const query = { description: { $text: { $search: 'Quick Brown', $caseSensitive: false } } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$text should not match partial words', () => {
            const doc = { description: 'The quick brown fox jumps over the lazy dog' };
            const query = { description: { $text: { $search: 'quic bro', $caseSensitive: false } } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$text should match multiple words in any order', () => {
            const doc = { description: 'The quick brown fox jumps over the lazy dog' };
            const query = { description: { $text: { $search: 'lazy quick', $caseSensitive: false } } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });
    });

    test('should match nested fields', () => {
        const doc = { user: { name: 'John', age: 30 } };
        const query = { 'user.name': 'John' };
        expect(documentMatchesQuery(doc, query)).toBe(true);
    });

    test('should match Date objects', () => {
        const date = new Date('2023-01-01');
        const doc = { birthdate: date };
        const query = { birthdate: new Date('2023-01-01') };
        expect(documentMatchesQuery(doc, query)).toBe(true);
    });

    // ... (you can continue adding more tests for other operators and conditions)
});
