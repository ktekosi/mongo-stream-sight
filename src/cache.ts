import { ObjectId, type Collection, type Document, type WithId, type UpdateDescription } from 'mongodb';
import { deletePath, getValueByPath, insertOrdered, setValueByPath } from './utils';
import { documentMatchesQuery } from './query';

export interface CacheOptions {
    query?: Document
    projection?: Document
    limit?: number
    skip?: number
    sort?: Document
}

interface InsertEvent {
    operationType: 'insert'
    documentKey: WithId<Document>
    fullDocument: WithId<Document>
}

function isInsertEvent(event: Document): event is InsertEvent {
    return event.operationType === 'insert';
}

interface UpdateEvent {
    operationType: 'update'
    documentKey: WithId<Document>
    updateDescription: {
        updatedFields?: Document
        removedFields?: string[]
    }
}

function isUpdateEvent(event: Document): event is UpdateEvent {
    return event.operationType === 'update';
}

interface DeleteEvent {
    operationType: 'delete'
    documentKey: WithId<Document>
}

function isDeleteEvent(event: Document): event is DeleteEvent {
    return event.operationType === 'delete';
}

type RecordIndex = Record<string, WithId<Document>>;

export function applyUpdatesToDocument(doc: Document, updates: UpdateDescription): void {
    if (updates.updatedFields !== undefined) {
        for (const [key, value] of Object.entries(updates.updatedFields)) {
            setValueByPath(doc, key, value);
        }
    }

    if (updates.removedFields !== undefined) {
        for (const key of updates.removedFields) {
            deletePath(doc, key);
        }
    }
}

export function sortFieldChanged(sort: Document, updates: UpdateDescription): boolean {
    // Check if any of the sort fields are in updatedFields
    if (updates.updatedFields !== undefined) {
        for (const key of Object.keys(sort)) {
            if (updates.updatedFields[key] !== undefined) {
                return true;
            }
        }
    }

    // Check if any of the sort fields are in removedFields
    if (updates.removedFields !== undefined) {
        for (const key of Object.keys(sort)) {
            if (updates.removedFields.includes(key)) {
                return true;
            }
        }
    }

    return false;
}

export function insertIntoCache(cache: Document[], doc: Document, sortOption?: Record<string, number>): void {
    const sortFields = Object.keys(sortOption ?? {});
    if (sortOption === undefined || sortFields.length === 0) {
        cache.push(doc);
        return;
    }

    insertOrdered(cache, doc, (a: Document, b: Document): number => {
        for (const sortField of sortFields) {
            const sortDirection: number = sortOption[sortField];
            const valueA = getValueByPath(a, sortField);
            const valueB = getValueByPath(b, sortField);

            if (valueA < valueB) {
                return -sortDirection;
            } else if (valueA > valueB) {
                return sortDirection;
            }
            // If values are equal, continue to the next sort field
        }
        return 0; // Return 0 if all fields are equal
    });
}

export function removeFromCache(cache: Document[], id: string): void {
    const index = cache.findIndex(doc => doc._id.toHexString() === id);

    if (index >= 0) {
        cache.splice(index, 1);
    }
}

export function insertDocument(insertEvent: InsertEvent, cache: Document[], index: RecordIndex, options?: CacheOptions): void {
    const query = options?.query;
    const doc = insertEvent.fullDocument;

    if (query === undefined || documentMatchesQuery(doc, query)) {
        insertIntoCache(cache, doc, options?.sort);
        index[insertEvent.documentKey._id.toHexString()] = doc;
    }
}

export function updateDocument(updateEvent: UpdateEvent, cache: Document[], index: RecordIndex, options?: CacheOptions): void {
    const id = updateEvent.documentKey._id.toHexString();
    const sort = options?.sort;

    if (index[id] === undefined) {
        return;
    }

    const doc: Document = index[id];

    applyUpdatesToDocument(doc, updateEvent.updateDescription);

    const query = options?.query;

    if (query === undefined || documentMatchesQuery(doc, query)) {
        if (sort !== undefined && sortFieldChanged(sort, updateEvent.updateDescription)) {
            removeFromCache(cache, id);
            insertIntoCache(cache, doc, sort);
        }
    } else {
        removeFromCache(cache, id);
        delete index[id];
    }
}

export function deleteDocument(deleteEvent: DeleteEvent, cache: Document[], index: RecordIndex): void {
    const id = deleteEvent.documentKey._id.toHexString();

    if (index[id] === undefined) {
        return;
    }

    removeFromCache(cache, id);
    delete index[id];
}

export class LiveCache {
    private cache: Document[];
    private readonly index: RecordIndex;

    constructor(private readonly collection: Collection, private readonly options?: CacheOptions) {
        this.cache = [];
        this.index = {};
        void this.runQuery();
        void this.watch();
    }

    public getData(): Document[] {
        return this.cache.slice(this.options?.skip, this.options?.limit);
    }

    private async runQuery(): Promise<void> {
        this.cache = await this.collection.find(this.options?.query ?? {}, {
            projection: this.options?.projection
        }).toArray();
    }

    private async watch(): Promise<void> {
        const changeStream = this.collection.watch();
        changeStream.on('change', (changeEvent: Document) => {
            void this.onChangeEvent(changeEvent);
        });
    }

    private insertIntoCache(doc: Document, sortOption?: Record<string, number>): void {
        insertIntoCache(this.cache, doc, sortOption);
    }

    private removeFromCache(id: string): void {
        removeFromCache(this.cache, id);
    }

    private insertDocument(insertEvent: InsertEvent): void {
        insertDocument(insertEvent, this.cache, this.index, this.options);
    }

    private updateDocument(updateEvent: UpdateEvent): void {
        updateDocument(updateEvent, this.cache, this.index, this.options);
    }

    private deleteDocument(deleteEvent: DeleteEvent): void {
        deleteDocument(deleteEvent, this.cache, this.index);
    }

    private async onChangeEvent(changeEvent: Document): Promise<void> {
        if (isInsertEvent(changeEvent)) {
            this.insertDocument(changeEvent);
            return;
        }

        if (isUpdateEvent(changeEvent)) {
            this.updateDocument(changeEvent);
            return;
        }

        if (isDeleteEvent(changeEvent)) {
            this.deleteDocument(changeEvent);
        }
    }
}
