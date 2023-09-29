const port = parseInt(Bun.env.PORT ?? '8000');

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
