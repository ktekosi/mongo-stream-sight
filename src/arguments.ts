import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
export interface Arguments {
    mongo: string
    port: number
}

// Define yargs argument configuration
export const argv = yargs(hideBin(process.argv))
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
