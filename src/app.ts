import { startServer } from './server.ts';
import { createApi, stopApi, getCaches, getStreamsStats } from './api.ts';

export interface MongoStreamSightServer {
    shutdown: () => void
}

export async function startApp(port: number, mongo: string): Promise<MongoStreamSightServer> {
    const status = (): any => {
        return {
            streams: getStreamsStats(),
            caches: Object.fromEntries(Object.entries(getCaches()).map(([hash, cache]) => [hash, cache.getStatus()])),
            memory: process.memoryUsage()
        };
    };

    const server = startServer(port, await createApi(mongo), status);

    const shutdown = (): void => {
        server.stop();
        void stopApi();
    };

    return { shutdown };
}
