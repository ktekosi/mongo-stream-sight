import { describe, expect, test } from 'bun:test';
import { denormalize, normalize } from '../../src/converter.ts';
import { ObjectId } from 'mongodb';

describe('denormalize', () => {
    test('converts {$oid: "string"} to ObjectId', () => {
        const input = { userId: { $oid: '507f191e810c19729de860ea' } };
        const output = denormalize(input);
        expect(output.userId).toBeInstanceOf(ObjectId);
        expect(output.userId.toHexString()).toBe('507f191e810c19729de860ea');
    });

    test('converts {"$date":{"$numberLong":"1710766800000"}} to Date', () => {
        const input = { createdAt: { $date: { $numberLong: '1710766800000' } } };
        const output = denormalize(input);
        expect(output.createdAt).toBeInstanceOf(Date);
        expect(output.createdAt.getTime()).toBe(1710766800000);
    });

    test('handles nested structures', () => {
        const input = {
            _id: { $oid: '507f1f77bcf86cd799439011' },
            metadata: {
                createdAt: { $date: { $numberLong: '1710766800000' } },
                tags: [{ $oid: '507f1f77bcf86cd799439012' }, { $oid: '507f1f77bcf86cd799439013' }]
            }
        };
        const output = denormalize(input);
        expect(output._id).toBeInstanceOf(ObjectId);
        expect(output.metadata.createdAt).toBeInstanceOf(Date);
        expect(output.metadata.tags[0]).toBeInstanceOf(ObjectId);
        expect(output.metadata.tags[1]).toBeInstanceOf(ObjectId);
    });

    test('correctly handles arrays', () => {
        const input = {
            tags: [{ $oid: '507f1f77bcf86cd799439012' }, { $oid: '507f1f77bcf86cd799439013' }]
        };
        const output = denormalize(input);
        expect(output.tags[0]).toBeInstanceOf(ObjectId);
        expect(output.tags[1]).toBeInstanceOf(ObjectId);
    });
});

describe('normalize', () => {
    test('converts ObjectId to {$oid: "string"}', () => {
        const objectId = new ObjectId();
        const input = { userId: objectId };
        const output = normalize(input);
        expect(output.userId).toEqual({ $oid: objectId.toHexString() });
    });

    test('converts Date to {"$date":{"$numberLong":"timestamp"}}', () => {
        const date = new Date();
        const input = { createdAt: date };
        const output = normalize(input);
        expect(output.createdAt).toEqual({ $date: { $numberLong: date.getTime().toString() } });
    });

    test('handles nested structures', () => {
        const objectId = new ObjectId();
        const date = new Date();
        const input = {
            _id: objectId,
            metadata: {
                createdAt: date,
                tags: [new ObjectId(), new ObjectId()]
            }
        };
        const output = normalize(input);
        expect(output._id).toEqual({ $oid: objectId.toHexString() });
        expect(output.metadata.createdAt).toEqual({ $date: { $numberLong: date.getTime().toString() } });
        expect(output.metadata.tags[0]).toHaveProperty('$oid');
        expect(output.metadata.tags[1]).toHaveProperty('$oid');
    });

    test('correctly handles arrays', () => {
        const input = {
            tags: [new ObjectId(), new ObjectId()]
        };
        const output = normalize(input);
        expect(output.tags[0]).toHaveProperty('$oid');
        expect(output.tags[1]).toHaveProperty('$oid');
    });
});
