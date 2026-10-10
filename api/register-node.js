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
  const name = cleanText(req.body?.name, 80);
  const type = cleanText(req.body?.type || "node", 20);

  if (!validId(id) || !name) {
    return res.status(400).json({
      error: "Provide a valid node ID and name."
    });
  }

  if (!["node", "gateway", "relay"].includes(type)) {
    return res.status(400).json({
      error: "Type must be node, gateway, or relay."
    });
  }

  try {
    const { nodes } = await getDatabase();

    const existing = await nodes.findOne({ _id: id });

    const metadata =
      req.body?.metadata &&
      typeof req.body.metadata === "object" &&
      !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : {};

    const node = {
      _id: id,
      name,
      type,
      status: "online",
      lastSeen: timestamp(),
      metadata
    };

    await nodes.replaceOne(
      { _id: id },
      node,
      { upsert: true }
    );

    return res.status(existing ? 200 : 201).json({
      message: existing ? "Node updated." : "Node registered.",
      node: {
        id: node._id,
        name: node.name,
        type: node.type,
        status: node.status,
        lastSeen: node.lastSeen,
        metadata: node.metadata
      }
    });
  } catch (error) {
    console.error("Node registration failed:", error.message);

    return res.status(503).json({
      error: "Unable to register the node."
    });
  }
}
