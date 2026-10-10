import crypto from "node:crypto";

export function cors(req, res) {
  const origin = req.headers.origin;
  const configured = process.env.FRONTEND_ORIGIN || "";

  const allowedOrigins = configured
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-API-Key"
  );

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}

export function requireApiKey(req, res) {
  const expected = process.env.API_SECRET;
  const supplied = req.headers["x-api-key"];

  if (!expected) {
    res.status(503).json({
      error: "API_SECRET is not configured."
    });

    return false;
  }

  if (
    typeof supplied !== "string" ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(
      Buffer.from(supplied),
      Buffer.from(expected)
    )
  ) {
    res.status(401).json({
      error: "A valid API key is required."
    });

    return false;
  }

  return true;
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));

  return res.status(405).json({
    error: "Method not allowed.",
    allowedMethods: allowed
  });
}
