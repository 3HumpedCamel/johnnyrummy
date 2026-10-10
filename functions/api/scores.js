export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === "GET") {
        try {
            // Fetch top 10 lowest scores (lowest is best in Rummy)
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
            if (!body.player_name || typeof body.score !== 'number') {
                return new Response("Bad Request", { status: 400 });
            }
            
            await env.DB.prepare(
                "INSERT INTO rummy_scores (player_name, score) VALUES (?, ?)"
            ).bind(body.player_name, body.score).run();
            
            return new Response("Score saved", { status: 200 });
        } catch (e) {
            return new Response("Error saving score", { status: 500 });
        }
    }

    return new Response("Method Not Allowed", { status: 405 });
}