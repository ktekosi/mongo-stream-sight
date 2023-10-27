export function insertOrdered<T>(arr: T[], item: T, compare: (a: T, b: T) => number): number {
    const index = arr.findIndex((element) => compare(item, element) <= 0);
    let insertIndex: number;

    // If no suitable index is found, append the item to the end
    if (index === -1) {
        arr.push(item);
        insertIndex = arr.length - 1;
    } else {
        arr.splice(index, 0, item);
        insertIndex = index;
    }

    return insertIndex;
}

type AnyObject = Record<string, any>;

export function getValueByPath(obj: AnyObject, path: string): any {
    const keys = path.split('.').filter(f => f.length > 0);
    let current = obj;

    for (const key of keys) {
        if (current !== undefined && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return undefined;
        }
    }

    return current;
}

export function setValueByPath(obj: any, path: string, value: any): void {
    const keys = path.split('.').filter(f => f.length > 0);
    let current = obj;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        // If it's the last key in the path, set the value
        if (i === keys.length - 1) {
            current[key] = value;
        } else {
            // If the key doesn't exist in the object or isn't an object, initialize it as an empty object
            if (current[key] === undefined || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
    }
}

export function deletePath(obj: any, path: string): void {
    const keys = path.split('.').filter(f => f.length > 0);
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) {
            return; // If a part of the path doesn't exist, skip removal
        }
        current = current[keys[i]];
    }

    delete current[keys[keys.length - 1]];
}
