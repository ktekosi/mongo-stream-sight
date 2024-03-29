import {
    type Collection,
    type Document,
    type WithId,
    type UpdateDescription,
    type ChangeStream,
    type MongoClient
} from 'mongodb';
import { deletePath, getValueByPath, insertOrdered, setValueByPath } from './utils';
import { documentMatchesQuery } from './query';
import * as crypto from 'crypto';

export interface CacheOptions {
    query?: Document
    projection?: Document
    sort?: Document
    ttl: number
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

interface InvalidateEvent {
    operationType: 'invalidate'
}

function isInvalidateEvent(event: Document): event is InvalidateEvent {
    return event.operationType === 'invalidate';
}

interface DropEvent {
    operationType: 'drop'
    ns: {
        db: string
        coll: string
    }
}

function isDropEvent(event: Document): event is DropEvent {
    return event.operationType === 'drop';
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
    const projection = options?.projection;
    const doc = insertEvent.fullDocument;

    if (query === undefined || documentMatchesQuery(doc, query)) {
        const docToInsert = projection !== undefined ? applyProjection(doc, projection) : doc;
        insertIntoCache(cache, docToInsert, options?.sort);
        index[insertEvent.documentKey._id.toHexString()] = docToInsert;
    }
}

export function applyProjection(doc: Document, projection: Record<string, number>): WithId<Document> {
    const projectedDoc: Partial<WithId<Document>> = {};

    // Always include the _id field, if it exists
    if (doc._id !== undefined) {
        projectedDoc._id = doc._id;
    }

    for (const key in projection) {
        if (projection[key] === 1) {
            projectedDoc[key] = doc[key];
        }
    }

    return projectedDoc as WithId<Document>;
}

export function updateDocument(updateEvent: UpdateEvent, cache: Document[], index: RecordIndex, options?: CacheOptions): boolean {
    const id = updateEvent.documentKey._id.toHexString();
    const sort = options?.sort;
    // updateEvent.updateDescription.updatedFields = {age:21}

    if (index[id] === undefined) {
        // the document is not in the cache
        // we need to check if it should get into the cache
        return false;
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

    return true;
}

export function deleteDocument(deleteEvent: DeleteEvent, cache: Document[], index: RecordIndex): void {
    const id = deleteEvent.documentKey._id.toHexString();

    if (index[id] === undefined) {
        return;
    }

    removeFromCache(cache, id);
    delete index[id];
}

interface CacheStatus {
    database: string
    collection: string
    ready: boolean
    lastAccessed: Date
    count: number
}

type Resolver<T> = (value?: T | PromiseLike<T>) => void;
type Rejecter = (reason?: any) => void;

export class LiveCache {
    private readonly cache: Document[] = [];
    private readonly index: RecordIndex = {};
    private ready: boolean = false;
    private readonly changeEventsBuffer: Document[] = [];
    private readonly readyPromise: Promise<void>;
    private readonly collection: Collection;
    private lastAccessed: Date;
    private readonly changeEventHandler: OnChangeEventHandler;

    constructor(
        private readonly mongo: MongoClient,
        private readonly dbName: string,
        private readonly collectionName: string,
        private readonly changeStreamManager: ChangeStreamManager,
        private readonly options?: CacheOptions) {
        this.collection = mongo.db(dbName).collection(collectionName);

        this.changeEventHandler = (changeEvent: Document) => {
            if (this.ready) {
                this.onChangeEvent(changeEvent);
            } else {
                this.changeEventsBuffer.push(changeEvent);
            }
        };

        this.watch();

        this.readyPromise = new Promise((resolve, reject) => {
            void this.runQuery(resolve, reject);
        });

        this.lastAccessed = new Date();
    }

    public getStatus(): CacheStatus {
        return {
            database: this.dbName,
            collection: this.collectionName,
            ready: this.ready,
            lastAccessed: this.lastAccessed,
            count: this.cache.length
        };
    }

    public getLastAccessed(): Date {
        return this.lastAccessed;
    }

    public updateLastAccessed(): void {
        this.lastAccessed = new Date();
    }

    public getData(skip?: number, limit?: number): Document[] {
        return this.cache.slice(skip, (skip ?? 0) + (limit ?? this.cache.length));
    }

    public isReady(): boolean {
        return this.ready;
    }

    public async waitToBeReady(): Promise<void> {
        await this.readyPromise;
    }

    public async stop(): Promise<void> {
        await this.changeStreamManager.unregister(this.mongo, this.dbName, this.collectionName, this.changeEventHandler);
    }

    private async runQuery(resolve: Resolver<void>, reject: Rejecter): Promise<void> {
        const documents = await this.collection.find(this.options?.query ?? {}, {
            projection: this.options?.projection,
            sort: this.options?.sort
        }).toArray();

        documents.forEach(doc => {
            this.cache.push(doc);
            this.index[doc._id.toHexString()] = doc;
        });

        this.changeEventsBuffer.forEach(changeEvent => {
            this.onChangeEvent(changeEvent);
        });

        this.changeEventsBuffer.length = 0;

        this.ready = true;

        resolve();
    }

    private watch(): void {
        this.changeStreamManager.register(this.mongo, this.dbName, this.collectionName, this.changeEventHandler);
    }

    private insertDocument(insertEvent: InsertEvent): void {
        insertDocument(insertEvent, this.cache, this.index, this.options);
    }

    private async updateDocument(updateEvent: UpdateEvent): Promise<void> {
        if (!updateDocument(updateEvent, this.cache, this.index, this.options)) {
            // if document was not in the cache, then retrieve it from db and check if it should be
            // in the updateEvent we do not have the full document, so that's why we need to retrieve it from DB
            const doc = await this.collection.findOne(updateEvent.documentKey);
            if (doc === null) {
                return;
            }

            const insertEvent: InsertEvent = {
                operationType: 'insert',
                documentKey: updateEvent.documentKey,
                fullDocument: doc
            };

            this.insertDocument(insertEvent);
        }
    }

    private deleteDocument(deleteEvent: DeleteEvent): void {
        deleteDocument(deleteEvent, this.cache, this.index);
    }

    private async dropCollection(dropEvent: DropEvent): Promise<void> {
        this.cache.length = 0;
        Object.keys(this.index).forEach(key => delete this.index[key]);
        // TODO: check performance on deleting keys
    }

    private onChangeEvent(changeEvent: Document): void {
        if (isInsertEvent(changeEvent)) {
            this.insertDocument(changeEvent);
            return;
        }

        if (isUpdateEvent(changeEvent)) {
            void this.updateDocument(changeEvent);
            return;
        }

        if (isDeleteEvent(changeEvent)) {
            this.deleteDocument(changeEvent);
        }

        if (isDropEvent(changeEvent)) {
            void this.dropCollection(changeEvent);
        }
    }
}

export function createMD5Hash(inputString: string): string {
    if (typeof Bun === 'undefined') {
        const md5 = crypto.createHash('md5');
        md5.update(inputString);
        return md5.digest('hex');
    } else {
        const md5 = new Bun.CryptoHasher('md5');
        md5.update(inputString);
        return md5.digest('hex');
    }
}

export function createQueryHash(db: string, collection: string, query: Document, projection: Document, sort: Document): string {
    return createMD5Hash(JSON.stringify({ db, collection, query, projection, sort }));
}

type OnChangeEventHandler = (changeEvent: Document) => void;

export type ChangeStreamsStats = Record<string, {
    changeEventsPerSecond: number
    avgChangeEventsPerMinute: number
}>;

export class ChangeStreamManager {
    private readonly changeStreams: Record<string, ChangeStream> = {};
    private readonly registeredHandlers: Record<string, Set<OnChangeEventHandler>> = {};
    private readonly eventsHistory: Record<string, Date[]> = {};
    private cleanupInterval?: NodeJS.Timeout;
    private cleanupTimerActive: boolean = false;

    private cleanupEvents(): void {
        const now = new Date();
        for (const key of Object.keys(this.eventsHistory)) {
            this.eventsHistory[key] = this.eventsHistory[key].filter(d => d.getTime() > now.getTime() - 120000);
        }
    }

    createChangeStream(mongo: MongoClient, dbName: string, collectionName: string): void {
        const key = `${dbName}.${collectionName}`;
        if (this.changeStreams[key] === undefined) {
            this.changeStreams[key] = mongo.db(dbName).collection(collectionName).watch();
            this.eventsHistory[key] = [];
            this.registerOnChangeHandler(mongo, dbName, collectionName);

            if (!this.cleanupTimerActive) {
                this.cleanupTimerActive = true;
                this.cleanupInterval = setInterval(() => {
                    this.cleanupEvents();
                }, 60000);
            }
        }
    }

    private reWatch(mongo: MongoClient, dbName: string, collectionName: string): void {
        const key = `${dbName}.${collectionName}`;
        if (Object.keys(this.registeredHandlers).length === 0) {
            delete this.changeStreams[key];
            return;
        }
        this.changeStreams[key] = mongo.db(dbName).collection(collectionName).watch();
        this.registerOnChangeHandler(mongo, dbName, collectionName);
    }

    private registerOnChangeHandler(mongo: MongoClient, dbName: string, collectionName: string): void {
        const key = `${dbName}.${collectionName}`;
        this.changeStreams[key].on('change', (changeEvent: Document) => {
            if (isInvalidateEvent(changeEvent)) {
                this.reWatch(mongo, dbName, collectionName);
                return;
            }

            this.eventsHistory[key].push(new Date());

            for (const handler of this.registeredHandlers[key].values()) {
                handler(changeEvent);
            }
        });
    }

    public getStats(): ChangeStreamsStats {
        return Object.fromEntries(Object.entries(this.eventsHistory).map(([collection, eventsHistory]) => {
            return [collection, {
                changeEventsPerSecond: eventsHistory.filter(d => d.getTime() > new Date().getTime() - 1000).length,
                avgChangeEventsPerMinute: eventsHistory.filter(d => d.getTime() > new Date().getTime() - 60000).length
            }];
        }));
    }

    register(mongo: MongoClient, dbName: string, collectionName: string, onChangeEventHandler: OnChangeEventHandler): void {
        this.createChangeStream(mongo, dbName, collectionName);
        const key = `${dbName}.${collectionName}`;
        if (this.registeredHandlers[key] === undefined) {
            this.registeredHandlers[key] = new Set();
        }
        this.registeredHandlers[key].add(onChangeEventHandler);
    }

    async unregister(mongo: MongoClient, dbName: string, collectionName: string, onChangeEventHandler: OnChangeEventHandler): Promise<void> {
        const key = `${dbName}.${collectionName}`;
        this.registeredHandlers[key].delete(onChangeEventHandler);

        if (this.registeredHandlers[key].size === 0) {
            delete this.registeredHandlers[key];
            await this.changeStreams[key].close();
            delete this.changeStreams[key];
        }

        if (Object.keys(this.changeStreams).length === 0) {
            clearInterval(this.cleanupInterval);
            this.cleanupTimerActive = false;
        }
    }

    async stop(): Promise<void> {
        await Promise.all(Object.values(this.changeStreams).map(async(changeStream) => { await changeStream.close(); }));
        clearInterval(this.cleanupInterval);
    }
}

export class CacheManager {
    private readonly caches: Record<string, LiveCache> = {};

    constructor(private readonly changeStreamManager: ChangeStreamManager) {
    }

    getCache(mongo: MongoClient, dbName: string, collectionName: string, cacheOptions: CacheOptions): LiveCache {
        const queryHash = createQueryHash(dbName, collectionName, cacheOptions.query ?? {}, cacheOptions.projection ?? {}, cacheOptions.sort ?? {});
        if (this.caches[queryHash] === undefined) {
            this.caches[queryHash] = new LiveCache(mongo, dbName, collectionName, this.changeStreamManager, cacheOptions);
        }

        return this.caches[queryHash];
    }

    async stop(): Promise<void> {
        await Promise.all(Object.values(this.caches).map(async(liveCache) => { await liveCache.stop(); }));
    }

    getAllCaches(): Record<string, LiveCache> {
        return this.caches;
    }
}
