// Stateless BYOK generation proxy.
//
// Receives { prompt, key, params }, forwards to the chosen hosted image API,
// polls until the image is ready (submit -> poll keeps each invocation short, so
// it fits serverless time limits), and returns image URLs. It stores nothing and
// must never log the key.
//
// This is the wiring point. The actual hosted-provider call is implemented in
// migration phase 2 — deliberately a stub now so the front end is wired end to
// end without committing to a specific provider yet. Local generation does not
// use this function (the browser calls the user's WebUI directly).

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { prompt, key } = body;
  if (!prompt) return json(400, { error: "Missing prompt" });
  if (!key) return json(400, { error: "Missing API key" });

  // TODO (phase 2): dispatch to the selected hosted provider using `key`, poll for
  // completion, and return { images: [url, ...] }. Never store or log `key`.
  return json(501, {
    error: "Hosted generation isn't implemented yet (stub). Use the local WebUI provider for now.",
    images: [],
  });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
