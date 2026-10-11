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
 * Preserved features:
 * - MongoDB network data
 * - Total node count
 * - Online and offline node counts
 * - Gateway count
 * - Active connection count
 * - Registered node information
 * - Active network links
 * - Error handling
 * - CORS support
 *
 * Additional features:
 * - Normalized node IDs
 * - Node status normalization
 * - Network connectivity summary
 * - Recorded topology information
 * - Connection health summary
 * - Last-updated timestamp
 * - Internet connectivity status when recorded
 * - Safe handling of inconsistent link formats
 * - Diagnostic error logging
 *
 * Important:
 * This endpoint reports information stored in MongoDB.
 * It does not scan nearby Wi-Fi networks or independently
 * verify physical internet connectivity.
 */

function normalizeId(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function normalizeStatus(node) {
  const status = String(node?.status || "")
    .trim()
    .toLowerCase();

  if (
    status === "online" ||
    status === "offline" ||
    status === "connecting" ||
    status === "unknown"
  ) {
    return status;
  }

  if (node?.online === true) {
    return "online";
  }

  if (node?.online === false) {
    return "offline";
  }

  return "unknown";
}

function getLinkEndpoints(link) {
  const from = normalizeId(
    link?.from ??
    link?.source ??
    link?.sourceId
  );

  const to = normalizeId(
    link?.to ??
    link?.target ??
    link?.targetId
  );

  return { from, to };
}

function isRecent(timestamp, maxAgeMs) {
  if (!timestamp) {
    return false;
  }

  const time = new Date(timestamp).getTime();

  if (!Number.isFinite(time)) {
    return false;
  }

  return Date.now() - time <= maxAgeMs;
}

function normalizePublicNode(node) {
  const safeNode = publicNode(node) || {};

  const id = normalizeId(
    safeNode.id ??
    node.id ??
    node._id
  );

  const status = normalizeStatus({
    ...node,
    ...safeNode
  });

  return {
    ...safeNode,
    id,
    name:
      safeNode.name ||
      node.name ||
      `Node ${id || "unknown"}`,
    type:
      safeNode.type ||
      node.type ||
      "node",
    status
  };
}

function normalizePublicLink(link) {
  const { from, to } = getLinkEndpoints(link);

  return {
    from,
    to,
    status: String(link?.status || "active"),
    createdAt: link?.createdAt || null,
    updatedAt: link?.updatedAt || null
  };
}

function calculateConnectionSummary(nodes, links) {
  const onlineNodes = nodes.filter(
    (node) => node.status === "online"
  );

  const offlineNodes = nodes.filter(
    (node) => node.status === "offline"
  );

  const unknownNodes = nodes.filter(
    (node) => node.status === "unknown"
  );

  const onlineIds = new Set(
    onlineNodes.map((node) => normalizeId(node.id))
  );

  const activeLinks = links.filter((link) => {
    const { from, to } = getLinkEndpoints(link);

    return (
      from !== "" &&
      to !== "" &&
      onlineIds.has(from) &&
      onlineIds.has(to)
    );
  });

  return {
    onlineNodes: onlineNodes.length,
    offlineNodes: offlineNodes.length,
    unknownNodes: unknownNodes.length,
    activeLinks: activeLinks.length,
    recordedLinks: links.length
  };
}

/**
 * Main API handler.
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

    // Fetch node and link records concurrently.
    const [allNodes, allLinks] = await Promise.all([
      nodes.find({}).toArray(),
      links.find({}).toArray()
    ]);

    // --------------------------------------------------
    // 4. Convert database records into public node data
    // --------------------------------------------------

    const visibleNodes = allNodes.map((node) =>
      normalizePublicNode(node)
    );

    // --------------------------------------------------
    // 5. Calculate existing network statistics
    // --------------------------------------------------

    const stats = calculateStats(allNodes, allLinks);

    // --------------------------------------------------
    // 6. Identify online nodes
    // --------------------------------------------------

    const onlineIds = new Set(
      visibleNodes
        .filter((node) => node.status === "online")
        .map((node) => normalizeId(node.id))
        .filter(Boolean)
    );

    // --------------------------------------------------
    // 7. Normalize recorded network links
    // --------------------------------------------------

    const normalizedLinks = allLinks
      .map(normalizePublicLink)
      .filter((link) => link.from && link.to);

    // --------------------------------------------------
    // 8. Identify active recorded links
    //
    // Both endpoints must be online.
    // This does not prove packets are being forwarded.
    // --------------------------------------------------

    const activeLinks = normalizedLinks.filter((link) => {
      return (
        onlineIds.has(link.from) &&
        onlineIds.has(link.to)
      );
    });

    // --------------------------------------------------
    // 9. Calculate connection health summary
    // --------------------------------------------------

    const connectionSummary = calculateConnectionSummary(
      visibleNodes,
      normalizedLinks
    );

    // --------------------------------------------------
    // 10. Count gateway nodes
    // --------------------------------------------------

    const gateways = visibleNodes.filter((node) => {
      const type = String(node.type || "").toLowerCase();

      return (
        type === "gateway" ||
        node.gateway === true ||
        node.isGateway === true
      );
    });

    // --------------------------------------------------
    // 11. Summarize recorded internet status
    //
    // Internet status is reported only when stored data
    // explicitly provides a valid boolean value.
    // Missing data is not treated as proof of connectivity.
    // --------------------------------------------------

    const internetChecks = visibleNodes
      .map((node) => {
        const originalNode = allNodes.find((item) => {
          return normalizeId(
            item.id ?? item._id
          ) === normalizeId(node.id);
        });

        const metadata = originalNode?.metadata || {};

        const candidates = [
          originalNode?.internetAvailable,
          originalNode?.internetConnected,
          metadata.internetAvailable,
          metadata.internetConnected
        ];

        const recordedValue = candidates.find(
          (value) => typeof value === "boolean"
        );

        return {
          nodeId: normalizeId(node.id),
          internetAvailable:
            typeof recordedValue === "boolean"
              ? recordedValue
              : null
        };
      });

    const verifiedInternetNodes = internetChecks.filter(
      (item) => item.internetAvailable === true
    );

    const failedInternetNodes = internetChecks.filter(
      (item) => item.internetAvailable === false
    );

    const untestedInternetNodes = internetChecks.filter(
      (item) => item.internetAvailable === null
    );

    // --------------------------------------------------
    // 12. Determine the latest recorded update
    // --------------------------------------------------

    const timestamps = [
      ...allNodes.map((node) => node.updatedAt),
      ...allNodes.map((node) => node.lastSeen),
      ...allLinks.map((link) => link.updatedAt),
      ...allLinks.map((link) => link.createdAt)
    ]
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);

    const latestRecordedUpdate = timestamps.length
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;

    // --------------------------------------------------
    // 13. Determine whether any nodes were recently seen
    //
    // This is based on recorded lastSeen timestamps.
    // It is not a live radio scan.
    // --------------------------------------------------

    const recentlySeenNodes = allNodes.filter((node) => {
      return isRecent(node.lastSeen, 5 * 60 * 1000);
    }).length;

    // --------------------------------------------------
    // 14. Return complete network information
    //
    // Existing response fields are preserved:
    // success, service, dataSource, stats, nodes, links.
    // Additional fields are added for the dashboard.
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      service: "mesh-network-backend",

      dataSource: "mongodb",

      ...stats,

      nodes: visibleNodes,

      links: activeLinks,

      // Additional network information.
      networkStatus: {
        registeredNodes: visibleNodes.length,

        onlineNodes: connectionSummary.onlineNodes,

        offlineNodes: connectionSummary.offlineNodes,

        unknownNodes: connectionSummary.unknownNodes,

        gatewayNodes: gateways.length,

        recordedLinks: connectionSummary.recordedLinks,

        activeLinks: connectionSummary.activeLinks,

        recentlySeenNodes
      },

      internetStatus: {
        verifiedConnectedNodes: verifiedInternetNodes.length,

        recordedDisconnectedNodes: failedInternetNodes.length,

        untestedNodes: untestedInternetNodes.length,

        // This field describes stored checks, not a new
        // internet connectivity test performed by this API.
        source: "recorded-node-status"
      },

      gatewayDetails: gateways.map((node) => ({
        id: normalizeId(node.id),
        name: node.name,
        status: node.status,
        type: node.type
      })),

      lastUpdated: latestRecordedUpdate,

      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    // --------------------------------------------------
    // 15. Log diagnostic details for Vercel function logs
    // --------------------------------------------------

    console.error("Network query failed:", {
      message: error?.message || "Unknown error",
      name: error?.name || "Error",
      code: error?.code || null
    });

    // --------------------------------------------------
    // 16. Return a safe error response
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
