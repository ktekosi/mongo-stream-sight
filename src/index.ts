import { type Arguments, argv } from './arguments.ts';
import { startApp } from './app.ts';

export async function main(argv: Arguments): Promise<void> {
    const app = await startApp(argv.port, argv.mongo);

    process.on('SIGINT', app.shutdown);
    process.on('SIGTERM', app.shutdown);
}

void main(argv);
