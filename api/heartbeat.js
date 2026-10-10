import {
  cors,
  requireApiKey,
  methodNotAllowed
} from "../lib/security.js";

import { getDatabase } from "../lib/database.js";

import {
  cleanText,
  validId,
  timestamp
} from "../lib/network-utils.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  if (!requireApiKey(req, res)) return;

  const id = cleanText(req.body?.id, 64);

  if (!validId(id)) {
    return res.status(400).json({
      error: "A valid node ID is required."
    });
  }

  try {
    const { nodes } = await getDatabase();

    const result = await nodes.updateOne(
      { _id: id },
      {
        $set: {
          status: "online",
          lastSeen: timestamp()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: "Node not found. Register it first."
      });
    }

    return res.status(200).json({
      message: "Heartbeat received.",
      nodeId: id,
      lastSeen: timestamp()
    });
  } catch (error) {
    console.error("Heartbeat failed:", error.message);

    return res.status(503).json({
      error: "Unable to process heartbeat."
    });
  }
}
