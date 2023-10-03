import { type ApiFunction } from './server.ts';
import { z } from 'zod';
import { type Document, MongoClient } from 'mongodb';
import { CacheManager, type CacheOptions, type LiveCache } from './cache.ts';

const FindParamsSchema = z.object({
    db: z.string(),
    collection: z.string(),
    query: z.object({}).nonstrict().optional(),
    projection: z.object({}).nonstrict().optional(),
    skip: z.number().optional(),
    limit: z.number().optional(),
    sort: z.object({}).nonstrict().optional()
});

export type FindParams = z.infer<typeof FindParamsSchema>;

export async function createApi(mongoUri: string): Promise<ApiFunction[]> {
    const mongo: MongoClient = new MongoClient(mongoUri, {
        socketTimeoutMS: 60000
    });

    await mongo.connect();

    const cacheManager = new CacheManager();

    const FindFunction: ApiFunction = {
        name: 'find',
        params: FindParamsSchema,
        return: z.array(z.any()),
        func: async({ db, collection, query, projection, skip, limit, sort }: FindParams): Promise<Document[]> => {
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

            const documents = liveCache.getData();

            return documents;
        }
    };

    return [FindFunction];
}
