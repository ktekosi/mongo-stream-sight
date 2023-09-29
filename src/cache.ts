import { ObjectId, type Collection, type Document, type WithId } from 'mongodb';

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

function insertOrdered<T>(arr: T[], item: T, compare: (a: T, b: T) => number): T[] {
    const index = arr.findIndex((element) => compare(item, element) <= 0);

    // If no suitable index is found, append the item to the end
    if (index === -1) {
        arr.push(item);
    } else {
        arr.splice(index, 0, item);
    }

    return arr;
}

type AnyObject = Record<string, any>;

function getValueByPath(obj: AnyObject, path: string): any {
    const keys = path.split('.');
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

    private insertDocument(insertEvent: InsertEvent): void {
        if (this.options?.query === undefined || this.documentMatchesQuery(insertEvent.fullDocument, this.options?.query)) {
            if (this.options?.sort !== undefined) {
                this.cache.push(insertEvent.fullDocument);
            } else {
                const sortOption: Record<string, number> = this.options?.sort ?? {};
                const sortField: string | undefined = Object.keys(sortOption)[0];

                if (sortField !== undefined) {
                    const sortDirection: number = sortOption[sortField];
                    insertOrdered(this.cache, insertEvent.fullDocument, (a: Document, b: Document): number => {
                        const valueA = getValueByPath(a, sortField);
                        const valueB = getValueByPath(b, sortField);

                        return valueA < valueB ? sortDirection : (valueA > valueB ? -sortDirection : 0);
                    });
                } else {
                    this.cache.push(insertEvent.fullDocument);
                }
            }

            this.index[insertEvent.documentKey._id.toHexString()] = insertEvent.fullDocument;
        }
    }

    private updateDocument(updateEvent: UpdateEvent): void {

    }

    private deleteDocument(deleteEvent: DeleteEvent): void {

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

    private sortCache(): void {

    }

    private documentMatchesQuery(doc: Document, query: Document): boolean {
        return false;
    }
}
