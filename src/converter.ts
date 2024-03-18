import { type Document, ObjectId } from 'mongodb';

export function denormalize(doc: Record<string, unknown>): Document {
    function convert(value: any): any {
        if (Array.isArray(value)) {
            return value.map(convert);
        } else if (value !== null && typeof value === 'object') {
            if (value.$oid !== undefined) {
                return new ObjectId(value.$oid);
            } else if (value.$date !== undefined && value.$date.$numberLong !== undefined) {
                return new Date(parseInt(value.$date.$numberLong));
            }

            const convertedObject: any = {};
            for (const [key, val] of Object.entries(value)) {
                convertedObject[key] = convert(val);
            }
            return convertedObject;
        }
        return value;
    }

    return convert(doc);
}

export function normalize(doc: Document): Document {
    function convert(value: any): any {
        if (Array.isArray(value)) {
            return value.map(convert);
        } else if (value instanceof ObjectId) {
            return { $oid: value.toHexString() };
        } else if (value instanceof Date) {
            return { $date: { $numberLong: value.getTime().toString() } };
        } else if (value !== null && typeof value === 'object') {
            const convertedObject: any = {};
            for (const [key, val] of Object.entries(value)) {
                convertedObject[key] = convert(val);
            }
            return convertedObject;
        }
        return value;
    }

    return convert(doc);
}
