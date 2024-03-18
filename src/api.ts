import { type ApiFunction } from './server.ts';
import { z } from 'zod';
import { type Document, MongoClient } from 'mongodb';
import { CacheManager, type CacheOptions, type LiveCache } from './cache.ts';
import { denormalize, normalize } from './converter.ts';

const CountParamsSchema = z.object({
    db: z.string(),
    collection: z.string(),
    query: z.record(z.unknown()).optional(),
    skip: z.number().optional(),
    limit: z.number().optional(),
    ttl: z.number().optional()
});

const FindParamsSchema = z.object({
    db: z.string(),
    collection: z.string(),
    query: z.record(z.unknown()).optional(),
    projection: z.record(z.unknown()).optional(),
    skip: z.number().optional(),
    limit: z.number().optional(),
    sort: z.record(z.unknown()).optional(),
    ttl: z.number().optional()
});

export type FindParams = z.infer<typeof FindParamsSchema>;
export type CountParams = z.infer<typeof CountParamsSchema>;

let mongo: MongoClient;
let cacheManager: CacheManager;

export async function createApi(mongoUri: string): Promise<ApiFunction[]> {
    mongo = new MongoClient(mongoUri, {
        socketTimeoutMS: parseInt(Bun.env.MONGO_SOCKET_TIMEOUT_MS ?? '60000'),
        connectTimeoutMS: parseInt(Bun.env.MONGO_CONNECT_TIMEOUT_MS ?? '2000'),
        serverSelectionTimeoutMS: parseInt(Bun.env.MONGO_SERVER_SELECTION_TIMEOUT_MS ?? '2000')
    });

    try {
        await mongo.connect();
    } catch (e: unknown) {
        if (e instanceof Error) {
            console.info(`[ERROR] Failed to connect to MongoDB: ${mongoUri}`);
            console.error('[ERROR]', e.message);
        } else {
            console.error(e);
        }
        process.exit(1);
    }

    cacheManager = new CacheManager();

    const FindFunction: ApiFunction = {
        name: 'find',
        params: FindParamsSchema,
        return: z.array(z.any()),
        func: async({ db, collection, query, projection, skip, limit, sort, ttl }: FindParams): Promise<Document[]> => {
            const cacheOptions: CacheOptions = {
                query: denormalize(query ?? {}),
                projection,
                sort,
                ttl: ttl ?? -1
            };
            const liveCache: LiveCache = cacheManager.getCache(mongo, db, collection, cacheOptions);

            if (!liveCache.isReady()) {
                await liveCache.waitToBeReady();
            }

            const result = liveCache.getData(skip, limit);

            return result.map(normalize);
        }
    };

    const CountFunction: ApiFunction = {
        name: 'count',
        params: CountParamsSchema,
        return: z.number(),
        func: async({ db, collection, query, skip, limit, ttl }: CountParams): Promise<number> => {
            const cacheOptions: CacheOptions = {
                query: denormalize(query ?? {}),
                ttl: ttl ?? -1
            };
            const liveCache: LiveCache = cacheManager.getCache(mongo, db, collection, cacheOptions);

            if (!liveCache.isReady()) {
                await liveCache.waitToBeReady();
            }

            return liveCache.getData(skip, limit).length;
        }
    };

    return [FindFunction, CountFunction];
}

export async function stopApi(): Promise<void> {
    await cacheManager.stop();
    await mongo.close(true);
}

export function getCaches(): Record<string, LiveCache> {
    return cacheManager.getAllCaches();
}
