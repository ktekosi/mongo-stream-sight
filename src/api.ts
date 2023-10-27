import { type ApiFunction } from './server.ts';
import { z } from 'zod';
import { type Document, MongoClient } from 'mongodb';
import { CacheManager, type CacheOptions, type LiveCache } from './cache.ts';

const FindParamsSchema = z.object({
    db: z.string(),
    collection: z.string(),
    query: z.record(z.unknown()).optional(),
    projection: z.record(z.unknown()).optional(),
    skip: z.number().optional(),
    limit: z.number().optional(),
    sort: z.record(z.unknown()).optional()
});

export type FindParams = z.infer<typeof FindParamsSchema>;

let mongo: MongoClient;
let cacheManager: CacheManager;

export async function createApi(mongoUri: string): Promise<ApiFunction[]> {
    mongo = new MongoClient(mongoUri, {
        socketTimeoutMS: 60000
    });

    await mongo.connect();

    cacheManager = new CacheManager();

    const FindFunction: ApiFunction = {
        name: 'find',
        params: FindParamsSchema,
        return: z.array(z.any()),
        func: async({ db, collection, query, projection, skip, limit, sort }: FindParams): Promise<Document[]> => {
            console.log('Got query:', query);
            const cacheOptions: CacheOptions = {
                query,
                projection,
                skip,
                limit,
                sort
            };
            const liveCache: LiveCache = cacheManager.getCache(mongo.db(db).collection(collection), cacheOptions);

            if (!liveCache.isReady()) {
                await liveCache.waitToBeReady();
            }

            return liveCache.getData();
        }
    };

    return [FindFunction];
}

export async function stopApi(): Promise<void> {
    await cacheManager.stop();
    await mongo.close(true);
}
