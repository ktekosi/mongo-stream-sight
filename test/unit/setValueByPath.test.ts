import { describe, expect, test } from 'bun:test';
import { setValueByPath } from '../../src/utils.ts';

describe('setValueByPath', () => {
    test('should set a value in a nested object', () => {
        const obj = {};
        setValueByPath(obj, 'a.b.c', 'value');
        expect(obj).toEqual({ a: { b: { c: 'value' } } });
    });

    test('should overwrite an existing value in a nested object', () => {
        const obj = { a: { b: { c: 'oldValue' } } };
        setValueByPath(obj, 'a.b.c', 'newValue');
        expect(obj).toEqual({ a: { b: { c: 'newValue' } } });
    });

    test('should handle arrays in the path', () => {
        const obj = { a: { b: [1, 2, 3] } };
        setValueByPath(obj, 'a.b.1', 'changed');
        expect(obj).toEqual({ a: { b: [1, 'changed', 3] } });
    });

    test('should handle a mix of objects and arrays', () => {
        const obj = { a: [{ name: 'first' }, { name: 'second' }] };
        setValueByPath(obj, 'a.1.name', 'changedName');
        expect(obj).toEqual({ a: [{ name: 'first' }, { name: 'changedName' }] });
    });

    test('should create the necessary structure if path does not exist', () => {
        const obj = {};
        setValueByPath(obj, 'a.b.c.d.e', 'deepValue');
        expect(obj).toEqual({ a: { b: { c: { d: { e: 'deepValue' } } } } });
    });

    test('should handle setting a value at the root', () => {
        const obj = { existing: 'value' };
        setValueByPath(obj, 'newKey', 'newValue');
        expect(obj).toEqual({ existing: 'value', newKey: 'newValue' });
    });
});
