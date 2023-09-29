import { ObjectId, type Collection, type Document, type WithId } from 'mongodb';
import { applyUpdatesToDocument, getValueByPath, insertOrdered } from './utils';

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

export class LiveCache {
    private cache: Document[];
    private index: RecordIndex;

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
        if (sortOption === undefined) {
            this.cache.push(doc);
            return;
        }

        const sortField: string | undefined = Object.keys(sortOption)[0];

        if (sortField === undefined) {
            this.cache.push(doc);
            return;
        }

        const sortDirection: number = sortOption[sortField];
        insertOrdered(this.cache, doc, (a: Document, b: Document): number => {
            const valueA = getValueByPath(a, sortField);
            const valueB = getValueByPath(b, sortField);

            return valueA < valueB ? sortDirection : (valueA > valueB ? -sortDirection : 0);
        });
    }

    private removeFromCache(id: string): void {
        const index = this.cache.findIndex(doc => doc._id.toHexString() === id);

        if (!isNaN(index)) {
            this.cache.splice(index, 1);
        }
    }

    private insertDocument(insertEvent: InsertEvent): void {
        const query = this.options?.query;
        const doc = insertEvent.fullDocument;

        if (query === undefined || this.documentMatchesQuery(doc, query)) {
            this.insertIntoCache(doc, this.options?.sort);
            this.index[insertEvent.documentKey._id.toHexString()] = doc;
        }
    }

    private updateDocument(updateEvent: UpdateEvent): void {
        const id = updateEvent.documentKey._id.toHexString();
        const sort = this.options?.sort;

        if (this.index[id] === undefined) {
            return;
        }

        const doc: Document = this.index[id];

        applyUpdatesToDocument(doc, updateEvent.updateDescription);

        const query = this.options?.query;

        if (query === undefined || this.documentMatchesQuery(doc, query)) {
            if (sortFieldChanged(sort, updateEvent.updateDescription)) {
                this.removeFromCache(id);
                this.insertIntoCache(doc, sort);
            }
        } else {
            this.removeFromCache(id);
            delete this.index[id];
        }
    }

    private deleteDocument(deleteEvent: DeleteEvent): void {
        const id = deleteEvent.documentKey._id.toHexString();

        if (this.index[id] === undefined) {
            return;
        }

        this.removeFromCache(id);
        delete this.index[id];
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

    private documentMatchesQuery(doc: Document, query: Document): boolean {
        return false;
    }
}
