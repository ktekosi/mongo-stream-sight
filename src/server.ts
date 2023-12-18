import { type Server } from 'bun';
import { z } from 'zod';
// import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';

// interface ResponseOptions {
//     status: number
// }

// class Response {
//     constructor(public readonly body: string, public readonly options: ResponseOptions) {
//     }
// }

// class Request {
//     constructor(private readonly req: IncomingMessage) {

//     }

//     async json(): Promise<any> {
//         return await new Promise((resolve, reject) => {
//             let body = '';
//             this.req.on('data', chunk => {
//                 body += chunk.toString();
//             });
//             this.req.on('end', () => {
//                 resolve(JSON.parse(body));
//             });
//             this.req.on('error', (err) => {
//                 reject(err);
//             });
//         });
//     }
// }

export function startServer(port: number, apiFunctions: ApiFunction[], status: () => any): Server {
    console.log(`Listening on port ${port}`);

    return Bun.serve({
        async fetch(req: Request): Promise<Response> {
            switch (req.method) {
                case 'GET':
                    return await getStatus(status);
                case 'POST':
                    return await handlePost(req, apiFunctions);
            }

            return new Response('Method not allowed', { status: 405 });
        },
        port
    });
}

// function writeResponse(response: Response, res: ServerResponse): void {
//     res.writeHead(response.options.status ?? 200, { 'Content-Type': 'application/json' });
//     res.end(response.body);
// }

// export function startServer(port: number, apiFunctions: ApiFunction[], status: () => any): Server {
//     const server = createServer((req: IncomingMessage, res: ServerResponse): void => {
//         void (async() => {
//             const request = new Request(req);
//             switch (req.method) {
//                 case 'GET':
//                     writeResponse(await getStatus(status), res);
//                     return;
//                 case 'POST':
//                     writeResponse(await handlePost(request, apiFunctions), res);
//                     return;
//             }

//             writeResponse(new Response('Method not allowed', { status: 405 }), res);
//         })();
//     });

//     server.listen(port, () => {
//         console.log(`Listening on port ${port}`);
//     });

//     return server;
// }

async function getStatus(status: () => any): Promise<Response> {
    return new Response(JSON.stringify(status()), { status: 200 });
}

export interface ApiFunction {
    name: string
    func: (params: any) => any
    params: z.ZodSchema<any>
    return: z.ZodSchema<any>
}

const ApiRequestSchema = z.object({
    method: z.string(),
    params: z.record(z.unknown())
});

type ApiRequest = z.infer<typeof ApiRequestSchema>;

async function handlePost(req: Request, apiFunctions: ApiFunction[]): Promise<Response> {
    try {
        const body = await req.json();

        const bodyValidation = ApiRequestSchema.safeParse(body);

        if (!bodyValidation.success) {
            return new Response('Invalid json', { status: 400 });
        }

        const targetFunction = apiFunctions.find(f => f.name === bodyValidation.data.method);

        if (targetFunction === undefined) {
            return new Response('Method not found', { status: 404 });
        }

        const paramsValidation = targetFunction.params.safeParse(bodyValidation.data.params);
        if (!paramsValidation.success) {
            return new Response('Invalid parameters', { status: 400 });
        }

        const result = await targetFunction.func(paramsValidation.data); // Directly pass the validated object

        const resultValidation = targetFunction.return.safeParse(result);
        if (!resultValidation.success) {
            return new Response('Internal error: Invalid function return', { status: 500 });
        }

        return new Response(JSON.stringify(result), { status: 200 });
    } catch (e) {
        return new Response('Internal error', { status: 500 });
    }
}
