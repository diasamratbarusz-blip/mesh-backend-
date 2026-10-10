import { cors, methodNotAllowed } from "../lib/security.js";
import { getDatabase } from "../lib/database.js";

import {
  publicNode,
  calculateStats
} from "../lib/network-utils.js";

/**
 * Mesh Network API
 *
 * Endpoint:
 * GET /api/network
 *
 * Features:
 * - MongoDB network data
 * - Total node count
 * - Online and offline node counts
 * - Gateway count
 * - Active connection count
 * - Registered node information
 * - Active network links
 * - Error handling
 * - CORS support
 */

export default async function handler(req, res) {
  // --------------------------------------------------
  // 1. CORS
  // --------------------------------------------------

  if (cors(req, res)) {
    return;
  }

  // --------------------------------------------------
  // 2. Allow GET requests only
  // --------------------------------------------------

  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  // --------------------------------------------------
  // 3. Load network information from MongoDB
  // --------------------------------------------------

  try {
    const { nodes, links } = await getDatabase();

    // Fetch nodes and links concurrently.
    const [allNodes, allLinks] = await Promise.all([
      nodes.find({}).toArray(),
      links.find({}).toArray()
    ]);

    // --------------------------------------------------
    // 4. Convert database records into public node data
    // --------------------------------------------------

    const visibleNodes = allNodes.map((node) => {
      return publicNode(node);
    });

    // --------------------------------------------------
    // 5. Calculate network statistics
    // --------------------------------------------------

    const stats = calculateStats(allNodes, allLinks);

    // --------------------------------------------------
    // 6. Identify online nodes
    //
    // Normalize IDs to strings so that MongoDB ObjectIds
    // and string IDs can be compared consistently.
    // --------------------------------------------------

    const onlineIds = new Set(
      visibleNodes
        .filter((node) => node.status === "online")
        .map((node) => String(node.id))
    );

    // --------------------------------------------------
    // 7. Identify active links
    //
    // A link is active when both endpoint nodes are online.
    // This describes recorded topology; it does not prove
    // that physical packets are being forwarded.
    // --------------------------------------------------

    const activeLinks = allLinks
      .filter((link) => {
        const from = String(link.from ?? "");
        const to = String(link.to ?? "");

        return (
          from !== "" &&
          to !== "" &&
          onlineIds.has(from) &&
          onlineIds.has(to)
        );
      })
      .map((link) => ({
        from: String(link.from),
        to: String(link.to),
        status: link.status || "active",
        createdAt: link.createdAt || null,
        updatedAt: link.updatedAt || null
      }));

    // --------------------------------------------------
    // 8. Return complete network information
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      service: "mesh-network-backend",

      dataSource: "mongodb",

      ...stats,

      nodes: visibleNodes,

      links: activeLinks
    });

  } catch (error) {
    // --------------------------------------------------
    // 9. Log diagnostic details for Vercel function logs
    // --------------------------------------------------

    console.error("Network query failed:", {
      message: error?.message || "Unknown error",
      name: error?.name || "Error",
      code: error?.code || null
    });

    // --------------------------------------------------
    // 10. Return a safe error response
    // --------------------------------------------------

    return res.status(503).json({
      success: false,

      service: "mesh-network-backend",

      error: "Unable to load network information.",

      message:
        "The network API could not retrieve its data. Check the Vercel function logs and MongoDB configuration."
    });
  }
}
