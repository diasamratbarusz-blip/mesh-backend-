import { cors, methodNotAllowed } from "../lib/security.js";
import { getDatabase } from "../lib/database.js";
import { publicNode } from "../lib/network-utils.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const { nodes } = await getDatabase();

    const allNodes = await nodes.find({})
      .sort({ lastSeen: -1 })
      .toArray();

    return res.status(200).json({
      count: allNodes.length,
      nodes: allNodes.map(publicNode)
    });
  } catch (error) {
    console.error("Nodes query failed:", error.message);

    return res.status(503).json({
      error: "Unable to load nodes."
    });
  }
}
