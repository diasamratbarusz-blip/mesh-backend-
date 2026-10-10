import { cors, methodNotAllowed } from "../lib/security.js";
import { getDatabase } from "../lib/database.js";
import {
  publicNode,
  calculateStats
} from "../lib/network-utils.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const { nodes, links } = await getDatabase();

    const [allNodes, allLinks] = await Promise.all([
      nodes.find({}).toArray(),
      links.find({}).toArray()
    ]);

    const stats = calculateStats(allNodes, allLinks);

    const visibleNodes = allNodes.map(publicNode);

    const onlineIds = new Set(
      visibleNodes
        .filter(node => node.status === "online")
        .map(node => node.id)
    );

    const activeLinks = allLinks.filter(
      link =>
        onlineIds.has(link.from) &&
        onlineIds.has(link.to)
    );

    return res.status(200).json({
      ...stats,
      dataSource: "mongodb",
      nodes: visibleNodes,
      links: activeLinks
    });
  } catch (error) {
    console.error("Network query failed:", error.message);

    return res.status(503).json({
      error: "Unable to load network information."
    });
  }
}
