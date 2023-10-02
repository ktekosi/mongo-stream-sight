import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
interface Arguments {
    mongo: string
    port: number
}

// Define yargs argument configuration
const argv = yargs(hideBin(process.argv))
    .option('mongo', {
        alias: 'm',
        description: 'MongoDB URI',
        type: 'string'
    })
    .option('port', {
        alias: 'p',
        description: 'Port to listen to',
        type: 'number',
        default: parseInt(Bun.env.PORT ?? '8000')
    })
    .demandOption(['mongo'], 'Please provide the MongoDB URI using the -m or --mongo option')
    .help()
    .alias('help', 'h')
    .argv as Arguments;

const port = argv.port;

console.log(`Listening on port ${port}`);

Bun.serve({
    async fetch(req: Request): Promise<Response> {
        switch (req.method) {
            case 'GET':
                return await getStatus(req);
            case 'POST':
                return await handlePost(req);
        }

        return new Response('Method not allowed', { status: 405 });
    },
    port
});

async function getStatus(req: Request): Promise<Response> {
    return new Response('Status endpoint!', { status: 200 });
}

async function handlePost(req: Request): Promise<Response> {
    try {
        const body = await req.json();
        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response('Bad Request', { status: 400 });
    }
}
