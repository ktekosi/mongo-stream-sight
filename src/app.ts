import { startServer } from './server.ts';
import { createApi, stopApi, getCaches } from './api.ts';

export interface MongoStreamSightServer {
    shutdown: () => void
}

export async function startApp(port: number, mongo: string): Promise<MongoStreamSightServer> {
    const status = (): any => {
        return {
            caches: Object.keys(getCaches())
        };
    };

    const server = startServer(port, await createApi(mongo), status);

    const shutdown = (): void => {
        server.stop();
        void stopApi();
    };

    return { shutdown };
}
