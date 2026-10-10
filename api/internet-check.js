import { cors, methodNotAllowed } from "../lib/security.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    5000
  );

  try {
    const response = await fetch(
      "https://www.google.com/generate_204",
      {
        method: "GET",
        signal: controller.signal,
        redirect: "follow"
      }
    );

    return res.status(200).json({
      serverHasInternet: response.ok || response.status === 204,
      testEndpoint: "Google connectivity endpoint",
      httpStatus: response.status,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Internet test failed:", error.message);

    return res.status(503).json({
      serverHasInternet: false,
      checkedAt: new Date().toISOString(),
      message: "The Internet connectivity test failed."
    });
  } finally {
    clearTimeout(timeout);
  }
}
