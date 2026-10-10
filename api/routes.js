import {
  cors,
  methodNotAllowed
} from "../lib/security.js";

import { getDatabase } from "../lib/database.js";

import {
  calculateRoute,
  cleanText,
  validId
} from "../lib/network-utils.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  const from = cleanText(req.body?.from, 64);
  const to = cleanText(req.body?.to, 64);

  if (!validId(from) || !validId(to)) {
    return res.status(400).json({
      reachable: false,
      error: "Valid source and destination IDs are required."
    });
  }

  try {
    const { nodes, links } = await getDatabase();

    const [allNodes, allLinks] = await Promise.all([
      nodes.find({}).toArray(),
      links.find({}).toArray()
    ]);

    const result = calculateRoute(
      allNodes,
      allLinks,
      from,
      to
    );

    return res.status(200).json({
      ...result,
      routeType: "recorded-topology",
      note: "This calculates a path; it does not forward real network packets."
    });
  } catch (error) {
    console.error("Route calculation failed:", error.message);

    return res.status(503).json({
      reachable: false,
      error: "Unable to calculate the route."
    });
  }
}
