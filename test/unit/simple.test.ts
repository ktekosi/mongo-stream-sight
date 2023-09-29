import { expect, test } from 'bun:test';

test('2 * 2', async() => {
    const result = await Promise.resolve(2 * 2);
    expect(result).toEqual(4);
});
