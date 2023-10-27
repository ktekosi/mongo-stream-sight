import { startServer } from './server.ts';
import { createApi, stopApi } from './api.ts';

export interface MongoStreamSightServer {
    shutdown: () => void
}

export async function startApp(port: number, mongo: string): Promise<MongoStreamSightServer> {
    const server = startServer(port, await createApi(mongo));

    const shutdown = (): void => {
        server.stop();
        void stopApi();
    };

    return { shutdown };
}
