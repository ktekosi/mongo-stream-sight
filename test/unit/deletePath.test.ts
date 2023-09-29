import { describe, expect, test } from 'bun:test';
import { deletePath } from '../../src/utils.ts';

describe('deletePath', () => {
    test('should delete a top-level field', () => {
        const obj = { a: 1, b: 2, c: 3 };
        deletePath(obj, 'b');
        expect(obj).toEqual({ a: 1, c: 3 });
    });

    test('should delete a nested field', () => {
        const obj = { a: { b: { c: 3, d: 4 }, e: 5 }, f: 6 };
        deletePath(obj, 'a.b.c');
        expect(obj).toEqual({ a: { b: { d: 4 }, e: 5 }, f: 6 });
    });

    test('should handle non-existing paths', () => {
        const obj = { a: 1, b: 2, c: 3 };
        deletePath(obj, 'd.e.f');
        expect(obj).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('should handle a mix of objects and arrays', () => {
        const obj = { a: [{ name: 'first' }, { name: 'second', age: 25 }] };
        deletePath(obj, 'a.1.age');
        expect(obj).toEqual({ a: [{ name: 'first' }, { name: 'second' }] });
    });

    test('should not modify the object if the path does not exist', () => {
        const obj = { a: { b: 2 }, c: 3 };
        deletePath(obj, 'a.d.e');
        expect(obj).toEqual({ a: { b: 2 }, c: 3 });
    });
});
