import { z } from 'zod';
import { type Server } from 'bun';

export function startServer(port: number, apiFunctions: ApiFunction[]): Server {
    console.log(`Listening on port ${port}`);

    return Bun.serve({
        async fetch(req: Request): Promise<Response> {
            switch (req.method) {
                case 'GET':
                    return await getStatus(req);
                case 'POST':
                    return await handlePost(req, apiFunctions);
            }

            return new Response('Method not allowed', { status: 405 });
        },
        port
    });
}

async function getStatus(req: Request): Promise<Response> {
    return new Response('Status endpoint!', { status: 200 });
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
