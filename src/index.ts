import { type Arguments, argv } from './arguments.ts';
import { startServer } from './server.ts';
import { createApi } from './api.ts';

async function main(argv: Arguments): Promise<void> {
    startServer(argv.port, await createApi(argv.mongo));
}

void main(argv);
