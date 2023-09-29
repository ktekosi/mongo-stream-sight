import { describe, expect, test } from 'bun:test';
import { getValueByPath, insertOrdered } from '../../src/utils.ts';
import { ObjectId } from 'mongodb';

describe('insertOrdered', () => {
    const genericSortingFunction = (a: any, b: any): number => (a < b ? -1 : (b < a ? 1 : 0));

    test('should insert an item in the correct order', () => {
        const arr = [1, 3, 5, 7];
        const item = 4;
        const index = insertOrdered(arr, item, (a, b) => a - b);
        expect(index).toBe(2);
        expect(arr).toEqual([1, 3, 4, 5, 7]);
    });

    test('should insert an item at the beginning if it is the smallest', () => {
        const arr = [2, 3, 5, 7];
        const item = 1;
        const index = insertOrdered(arr, item, (a, b) => a - b);
        expect(index).toBe(0);
        expect(arr).toEqual([1, 2, 3, 5, 7]);
    });

    test('should append an item at the end if it is the largest', () => {
        const arr = [1, 3, 5, 7];
        const item = 8;
        const index = insertOrdered(arr, item, (a, b) => a - b);
        expect(index).toBe(4);
        expect(arr).toEqual([1, 3, 5, 7, 8]);
    });

    test('should handle an empty array', () => {
        const arr: number[] = [];
        const item = 5;
        const index = insertOrdered(arr, item, (a, b) => a - b);
        expect(index).toBe(0);
        expect(arr).toEqual([5]);
    });

    test('should handle strings', () => {
        const arr = ['apple', 'cherry', 'orange'];
        const item = 'banana';
        const index = insertOrdered(arr, item, genericSortingFunction);
        expect(index).toBe(1);
        expect(arr).toEqual(['apple', 'banana', 'cherry', 'orange']);
    });

    test('should handle dates', () => {
        const arr = [new Date('2023-01-01'), new Date('2023-03-01'), new Date('2023-05-01')];
        const item = new Date('2023-04-01');
        const index = insertOrdered(arr, item, genericSortingFunction);
        expect(index).toBe(2);
        expect(arr).toEqual([new Date('2023-01-01'), new Date('2023-03-01'), new Date('2023-04-01'), new Date('2023-05-01')]);
    });

    test('should handle booleans (false)', () => {
        const arr = [false, true, true];
        const item = false;
        const index = insertOrdered(arr, item, genericSortingFunction);
        expect(index).toBe(0);
        expect(arr).toEqual([false, false, true, true]);
    });

    test('should handle booleans (true)', () => {
        const arr = [false, true, true];
        const item = true;
        const index = insertOrdered(arr, item, genericSortingFunction);
        expect(index).toBe(1);
        expect(arr).toEqual([false, true, true, true]);
    });

    test('should handle ObjectId from MongoDB', () => {
        const arr = [new ObjectId('5f50a782d48c7c12b881b0a1'), new ObjectId('5f50a782d48c7c12b881b0a3')];
        const item = new ObjectId('5f50a782d48c7c12b881b0a2');
        const index = insertOrdered(arr, item, genericSortingFunction);
        expect(index).toBe(1);
        expect(arr).toEqual([new ObjectId('5f50a782d48c7c12b881b0a1'), new ObjectId('5f50a782d48c7c12b881b0a2'), new ObjectId('5f50a782d48c7c12b881b0a3')]);
    });

    test('should insert an object based on a nested field', () => {
        interface TestObject {
            id: number
            data: {
                value: number
            }
        };

        const arr: TestObject[] = [
            { id: 1, data: { value: 10 } },
            { id: 3, data: { value: 30 } },
            { id: 5, data: { value: 50 } }
        ];
        const item: TestObject = { id: 4, data: { value: 40 } };

        const index = insertOrdered(arr, item, (a, b) => genericSortingFunction(getValueByPath(a, 'data.value'), getValueByPath(b, 'data.value')));
        expect(index).toBe(2);
        expect(arr).toEqual([
            { id: 1, data: { value: 10 } },
            { id: 3, data: { value: 30 } },
            { id: 4, data: { value: 40 } },
            { id: 5, data: { value: 50 } }
        ]);
    });
});
