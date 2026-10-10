export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === "GET") {
        try {
            const { results } = await env.DB.prepare(
                "SELECT player_name, score, date(date) as play_date FROM rummy_scores ORDER BY score ASC LIMIT 10"
            ).all();
            return Response.json(results);
        } catch (e) {
            return new Response("Error fetching scores", { status: 500 });
        }
    }

    if (request.method === "POST") {
        try {
            const body = await request.json();
            
            // Added body.player_name.length > 50 to the rejection criteria
            if (!body.player_name || typeof body.score !== 'number' || body.score < -200 || body.score > 2000 || body.player_name.length > 50) {
                return new Response("Bad Request: Invalid name or score", { status: 400 });
            }
            
            // Force the backend to truncate it just in case, before inserting
            const safeName = body.player_name.substring(0, 50);
            
            await env.DB.prepare(
                "INSERT INTO rummy_scores (player_name, score) VALUES (?, ?)"
            ).bind(safeName, body.score).run();
            
            return new Response("Score saved", { status: 200 });
        } catch (e) {
            return new Response("Error saving score", { status: 500 });
        }
    }

    return new Response("Method Not Allowed", { status: 405 });
}