import { describe, expect, test } from 'bun:test';
import { getValueByPath } from '../../src/utils.ts';

describe('getValueByPath', () => {
    test('should retrieve a value from a nested object', () => {
        const obj = {
            a: {
                b: {
                    c: 'value'
                }
            }
        };
        const result = getValueByPath(obj, 'a.b.c');
        expect(result).toBe('value');
    });

    test('should return undefined for a non-existent path', () => {
        const obj = {
            a: {
                b: {
                    c: 'value'
                }
            }
        };
        const result = getValueByPath(obj, 'a.b.d');
        expect(result).toBeUndefined();
    });

    test('should handle arrays in the path', () => {
        const obj = {
            a: {
                b: ['first', 'second', 'third']
            }
        };
        const result = getValueByPath(obj, 'a.b.1');
        expect(result).toBe('second');
    });

    test('should return undefined for an out-of-bounds array index', () => {
        const obj = {
            a: {
                b: ['first', 'second', 'third']
            }
        };
        const result = getValueByPath(obj, 'a.b.5');
        expect(result).toBeUndefined();
    });

    test('should handle a mix of objects and arrays', () => {
        const obj = {
            a: [
                { name: 'first' },
                { name: 'second' },
                { name: 'third' }
            ]
        };
        const result = getValueByPath(obj, 'a.1.name');
        expect(result).toBe('second');
    });

    test('should return the entire object if an empty path is provided', () => {
        const obj = {
            a: {
                b: 'value'
            }
        };
        const result = getValueByPath(obj, '');
        expect(result).toEqual(obj);
    });

    test('should return undefined if the object is empty', () => {
        const result = getValueByPath({}, 'a.b.c');
        expect(result).toBeUndefined();
    });
});
