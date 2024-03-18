import { describe, expect, test } from 'bun:test';
import { documentMatchesQuery } from '../../src/query.ts';
import { ObjectId } from 'mongodb';

describe('documentMatchesQuery', () => {
    test('should match simple equality', () => {
        const doc = { name: 'John' };
        const query = { name: 'John' };
        expect(documentMatchesQuery(doc, query)).toBe(true);
    });

    test('should match simple equality on _id type', () => {
        const _id = new ObjectId();
        const doc = { _id, name: 'John' };
        const query = { _id };
        expect(documentMatchesQuery(doc, query)).toBe(true);
    });

    test('should not match incorrect values', () => {
        const doc = { name: 'John' };
        const query = { name: 'Doe' };
        expect(documentMatchesQuery(doc, query)).toBe(false);
    });

    test('should not match incorrect values on _id type', () => {
        const _id = new ObjectId();
        const doc = { _id, name: 'John' };
        const query = { _id: new ObjectId(), name: 'Doe' };
        expect(documentMatchesQuery(doc, query)).toBe(false);
    });

    describe('comparison operators', () => {
        test('should match using $eq operator', () => {
            const doc = { age: 25 };
            const query = { age: { $eq: 25 } };
            const match = documentMatchesQuery(doc, query);
            expect(match).toBe(true);
        });

        test('should match using $eq operator on _id type', () => {
            const _id = new ObjectId();
            const doc = { _id, age: 25 };
            const query = { _id };
            const match = documentMatchesQuery(doc, query);
            expect(match).toBe(true);
        });

        test('$ne operator', () => {
            const doc = { age: 25 };
            const query = { age: { $ne: 30 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$ne operator on _id type', () => {
            const _id = new ObjectId();
            const doc = { _id, age: 25 };
            const query = { _id: { $ne: new ObjectId() } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$gt operator', () => {
            const doc = { age: 30 };
            const query = { age: { $gt: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$gt operator on _id type', () => {
            const now = new Date();
            const _id = new ObjectId(Math.floor(now.getTime() / 1000));
            const doc = { _id, age: 30 };
            const query = { _id: { $gt: new ObjectId(Math.floor(now.getTime() / 1000 - 1000)) } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$gte operator', () => {
            const doc = { age: 30 };
            const query = { age: { $gte: 30 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$gte operator on _id type', () => {
            const now = new Date();
            const _id = new ObjectId(Math.floor(now.getTime() / 1000));
            const doc = { _id, age: 30 };
            const query = { _id: { $gte: _id } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$lt operator', () => {
            const doc = { age: 20 };
            const query = { age: { $lt: 25 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$lt operator on _id type', () => {
            const now = new Date();
            const _id = new ObjectId(Math.floor(now.getTime() / 1000));
            const doc = { _id, age: 20 };
            const query = { _id: { $lt: new ObjectId(Math.floor(now.getTime() / 1000 + 1000)) } };
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

        test('$in operator with _id', () => {
            const _id = new ObjectId();
            const doc = { _id, age: 30 };
            const query = { _id: { $in: [_id, new ObjectId()] } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$nin operator', () => {
            const doc = { age: 40 };
            const query = { age: { $nin: [25, 30, 35] } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$nin operator with _id type', () => {
            const _id = new ObjectId();
            const doc = { _id, age: 40 };
            const query = { age: { $nin: [new ObjectId(), new ObjectId()] } };
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

    describe('$text operator', () => {
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

    describe('$exists operator', () => {
        test('$exists operator should match when field exists', () => {
            const doc = { name: 'John', age: 25 };
            const query = { name: { $exists: true } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$exists operator should not match when field does not exist', () => {
            const doc = { age: 25 };
            const query = { name: { $exists: true } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$exists operator should match when field does not exist and condition is false', () => {
            const doc = { age: 25 };
            const query = { name: { $exists: false } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$exists operator should not match when field exists and condition is false', () => {
            const doc = { name: 'John', age: 25 };
            const query = { name: { $exists: false } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$exists operator should handle nested fields', () => {
            const doc = { user: { name: 'John', details: { age: 25 } } };
            const query = { 'user.details.age': { $exists: true } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$exists operator should not match missing nested fields', () => {
            const doc = { user: { name: 'John' } };
            const query = { 'user.details.age': { $exists: true } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('$type operator', () => {
        // Double
        test('$type operator should match Double with number', () => {
            const doc = { value: 25.5 };
            const query = { value: { $type: 1 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Double with number', () => {
            const doc = { value: '25.5' };
            const query = { value: { $type: 1 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match Double with string', () => {
            const doc = { value: 25.5 };
            const query = { value: { $type: 'double' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Double with string', () => {
            const doc = { value: '25.5' };
            const query = { value: { $type: 'double' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // String
        test('$type operator should match String with number', () => {
            const doc = { value: 'John' };
            const query = { value: { $type: 2 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-String with number', () => {
            const doc = { value: 25 };
            const query = { value: { $type: 2 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match String with string', () => {
            const doc = { value: 'John' };
            const query = { value: { $type: 'string' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-String with string', () => {
            const doc = { value: 25 };
            const query = { value: { $type: 'string' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // ObjectId
        test('$type operator should match ObjectId with number', () => {
            const doc = { value: new ObjectId('5f50a782d48c7c12b881b0a1') };
            const query = { value: { $type: 7 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-ObjectId with number', () => {
            const doc = { value: '5f50a782d48c7c12b881b0a1' };
            const query = { value: { $type: 7 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match ObjectId with string', () => {
            const doc = { value: new ObjectId('5f50a782d48c7c12b881b0a1') };
            const query = { value: { $type: 'objectId' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-ObjectId with string', () => {
            const doc = { value: '5f50a782d48c7c12b881b0a1' };
            const query = { value: { $type: 'objectId' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Object
        test('$type operator should match Object with number', () => {
            const doc = { value: { key: 'value' } };
            const query = { value: { $type: 3 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Object with number', () => {
            const doc = { value: 'string' };
            const query = { value: { $type: 3 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match Object with string', () => {
            const doc = { value: { key: 'value' } };
            const query = { value: { $type: 'object' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Object with string', () => {
            const doc = { value: 'string' };
            const query = { value: { $type: 'object' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Array
        test('$type operator should match Array with number', () => {
            const doc = { value: [1, 2, 3] };
            const query = { value: { $type: 4 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Array with number', () => {
            const doc = { value: 'string' };
            const query = { value: { $type: 4 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match Array with string', () => {
            const doc = { value: [1, 2, 3] };
            const query = { value: { $type: 'array' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Array with string', () => {
            const doc = { value: 'string' };
            const query = { value: { $type: 'array' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Binary data
        // Note: For simplicity, we'll use a Buffer to represent binary data in this example.
        test('$type operator should match Binary data with number', () => {
            const doc = { value: Buffer.from('binary data') };
            const query = { value: { $type: 5 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Binary data with number', () => {
            const doc = { value: 'string' };
            const query = { value: { $type: 5 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match Binary data with string', () => {
            const doc = { value: Buffer.from('binary data') };
            const query = { value: { $type: 'binData' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Binary data with string', () => {
            const doc = { value: 'string' };
            const query = { value: { $type: 'binData' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Boolean
        test('$type operator should match Boolean with number', () => {
            const doc = { value: true };
            const query = { value: { $type: 8 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Boolean with number', () => {
            const doc = { value: 'true' };
            const query = { value: { $type: 8 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match Boolean with string', () => {
            const doc = { value: true };
            const query = { value: { $type: 'bool' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Boolean with string', () => {
            const doc = { value: 'true' };
            const query = { value: { $type: 'bool' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Date
        test('$type operator should match Date with number', () => {
            const doc = { value: new Date() };
            const query = { value: { $type: 9 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Date with number', () => {
            const doc = { value: '2023-01-01' };
            const query = { value: { $type: 9 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$type operator should match Date with string', () => {
            const doc = { value: new Date() };
            const query = { value: { $type: 'date' } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$type operator should not match non-Date with string', () => {
            const doc = { value: '2023-01-01' };
            const query = { value: { $type: 'date' } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('Array operators', () => {
        // $all
        test('$all operator should match documents where field contains all specified values', () => {
            const doc = { fruits: ['apple', 'banana', 'cherry'] };
            const query = { fruits: { $all: ['apple', 'banana'] } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$all operator should not match documents missing any of the specified values', () => {
            const doc = { fruits: ['apple', 'cherry'] };
            const query = { fruits: { $all: ['apple', 'banana'] } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // $elemMatch
        test('$elemMatch operator should match documents where field contains an element that matches all specified criteria', () => {
            const doc = { scores: [80, 85, 90, { extraCredit: 5 }] };
            const query = { scores: { $elemMatch: { extraCredit: { $gt: 4 } } } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$elemMatch operator should not match documents where no element satisfies all the specified criteria', () => {
            const doc = { scores: [80, 85, 90, { extraCredit: 3 }] };
            const query = { scores: { $elemMatch: { extraCredit: { $gt: 4 } } } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // $size
        test('$size operator should match documents where the array field is of the specified size', () => {
            const doc = { items: ['apple', 'banana', 'cherry'] };
            const query = { items: { $size: 3 } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$size operator should not match documents where the array field is not of the specified size', () => {
            const doc = { items: ['apple', 'banana'] };
            const query = { items: { $size: 3 } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('$mod operator', () => {
        // $mod
        test('$mod operator should match documents where field value divided by divisor has the specified remainder', () => {
            const doc = { value: 10 };
            const query = { value: { $mod: [4, 2] } }; // 10 % 4 = 2
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$mod operator should not match documents where field value divided by divisor does not have the specified remainder', () => {
            const doc = { value: 10 };
            const query = { value: { $mod: [3, 2] } }; // 10 % 3 = 1
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        test('$mod operator should match documents with negative field values', () => {
            const doc = { value: -10 };
            const query = { value: { $mod: [4, 2] } }; // -10 % 4 = -2
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$mod operator should handle divisor of 0', () => {
            const doc = { value: 10 };
            const query = { value: { $mod: [0, 0] } }; // Division by zero is not allowed
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('Bitwise operators', () => {
        // $bitsAllClear
        test('$bitsAllClear operator should match documents where all the specified bits of the field value are clear (0)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAllClear: 5 } }; // Binary: 0101
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$bitsAllClear operator should not match documents where any of the specified bits of the field value are set (1)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAllClear: 3 } }; // Binary: 0011
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // $bitsAllSet
        test('$bitsAllSet operator should match documents where all the specified bits of the field value are set (1)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAllSet: 10 } }; // Binary: 1010
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$bitsAllSet operator should not match documents where any of the specified bits of the field value are clear (0)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAllSet: 15 } }; // Binary: 1111
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // $bitsAnyClear
        test('$bitsAnyClear operator should match documents where any of the specified bits of the field value are clear (0)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAnyClear: 5 } }; // Binary: 0101
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$bitsAnyClear operator should not match documents where all the specified bits of the field value are set (1)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAnyClear: 2 } }; // Binary: 0010
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // $bitsAnySet
        test('$bitsAnySet operator should match documents where any of the specified bits of the field value are set (1)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAnySet: 8 } }; // Binary: 1000
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$bitsAnySet operator should not match documents where all the specified bits of the field value are clear (0)', () => {
            const doc = { value: 10 }; // Binary: 1010
            const query = { value: { $bitsAnySet: 5 } }; // Binary: 0101
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });
    });

    describe('$expr operator', () => {
        // Field comparison
        test('$expr operator should match documents where specified fields satisfy the given condition', () => {
            const doc = { price: 10, discountedPrice: 5 };
            const query = { $expr: { $lt: ['$discountedPrice', '$price'] } };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$expr operator should not match documents where specified fields do not satisfy the given condition', () => {
            const doc = { price: 10, discountedPrice: 15 };
            const query = { $expr: { $lt: ['$discountedPrice', '$price'] } };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Conditional expressions
        test('$expr operator with $cond should match documents based on conditional expression', () => {
            const doc = { price: 10, isDiscounted: true, discountedPrice: 5 };
            const query = {
                $expr: {
                    $eq: [
                        { $cond: { if: '$isDiscounted', then: '$discountedPrice', else: '$price' } },
                        5
                    ]
                }
            };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$expr operator with $cond should not match documents if the condition is not met', () => {
            const doc = { price: 10, isDiscounted: false, discountedPrice: 5 };
            const query = {
                $expr: {
                    $eq: [
                        { $cond: { if: '$isDiscounted', then: '$discountedPrice', else: '$price' } },
                        5
                    ]
                }
            };
            expect(documentMatchesQuery(doc, query)).toBe(false);
        });

        // Arithmetic expressions
        test('$expr operator with arithmetic expressions should match documents based on computed values', () => {
            const doc = { price: 10, tax: 2 };
            const query = {
                $expr: {
                    $eq: [
                        { $add: ['$price', '$tax'] },
                        12
                    ]
                }
            };
            expect(documentMatchesQuery(doc, query)).toBe(true);
        });

        test('$expr with $and should return true only when all expressions evaluate to true', () => {
            const doc = { a: 5, b: 10 };

            const query = {
                $expr: {
                    $and: [{ $eq: ['$a', 5] }, { $eq: ['$b', 10] }]
                }
            };
            expect(documentMatchesQuery(doc, query)).toBe(true);

            const queryFalse = {
                $expr: {
                    $and: [{ $eq: ['$a', 5] }, { $eq: ['$b', 5] }]
                }
            };
            expect(documentMatchesQuery(doc, queryFalse)).toBe(false);
        });

        test('$expr with $or should return true when any of its expressions evaluate to true', () => {
            const doc = { a: 5, b: 10 };

            const query = {
                $expr: {
                    $or: [{ $eq: ['$a', 5] }, { $eq: ['$b', 15] }]
                }
            };
            expect(documentMatchesQuery(doc, query)).toBe(true);

            const queryFalse = {
                $expr: {
                    $or: [{ $eq: ['$a', 6] }, { $eq: ['$b', 15] }]
                }
            };
            expect(documentMatchesQuery(doc, queryFalse)).toBe(false);
        });

        test('$expr with $not should negate the result of its expression', () => {
            const doc = { a: 5 };

            const query = {
                $expr: {
                    $not: [{ $eq: ['$a', 6] }]
                }
            };
            expect(documentMatchesQuery(doc, query)).toBe(true);

            const queryFalse = {
                $expr: {
                    $not: [{ $eq: ['$a', 5] }]
                }
            };
            expect(documentMatchesQuery(doc, queryFalse)).toBe(false);
        });

        test('$expr with $nor should return true if none of its expressions evaluate to true', () => {
            const doc = { a: 5, b: 10 };

            const query = {
                $expr: {
                    $nor: [{ $eq: ['$a', 6] }, { $eq: ['$b', 15] }]
                }
            };
            expect(documentMatchesQuery(doc, query)).toBe(true);

            const queryFalse = {
                $expr: {
                    $nor: [{ $eq: ['$a', 5] }, { $eq: ['$b', 15] }]
                }
            };
            expect(documentMatchesQuery(doc, queryFalse)).toBe(false);
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
});
