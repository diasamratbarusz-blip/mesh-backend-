import { cors, methodNotAllowed } from "../lib/security.js";
import { getDatabase } from "../lib/database.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const { db } = await getDatabase();

    await db.command({ ping: 1 });

    return res.status(200).json({
      status: "ok",
      service: "mesh-network-backend",
      database: "connected",
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    return res.status(503).json({
      status: "error",
      database: "unavailable",
      message: "The backend or database is unavailable."
    });
  }
}
