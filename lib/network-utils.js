export function cleanText(value, maxLength = 80) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function validId(value) {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(value)
  );
}

export function timestamp() {
  return new Date().toISOString();
}

export function isOnline(node) {
  if (!node || !node.lastSeen) {
    return false;
  }

  const age = Date.now() - new Date(node.lastSeen).getTime();

  return (
    node.status === "online" &&
    Number.isFinite(age) &&
    age >= 0 &&
    age < 90000
  );
}

export function publicNode(node) {
  return {
    id: node._id,
    name: node.name,
    type: node.type,
    status: isOnline(node) ? "online" : "offline",
    lastSeen: node.lastSeen,
    metadata: node.metadata || {}
  };
}

export function calculateStats(nodes, links) {
  const onlineNodes = nodes.filter(isOnline);

  const onlineIds = new Set(
    onlineNodes.map(node => node._id)
  );

  const activeLinks = links.filter(
    link =>
      onlineIds.has(link.from) &&
      onlineIds.has(link.to)
  );

  return {
    totalNodes: nodes.length,
    onlineNodes: onlineNodes.length,
    offlineNodes: nodes.length - onlineNodes.length,

    gateways: onlineNodes.filter(
      node => node.type === "gateway"
    ).length,

    linkCount: activeLinks.length,

    lastUpdated: timestamp()
  };
}

export function calculateRoute(nodes, links, from, to) {
  const byId = new Map(
    nodes.map(node => [node._id, node])
  );

  const source = byId.get(from);
  const destination = byId.get(to);

  if (!source || !destination) {
    return {
      reachable: false,
      route: [],
      message: "Source or destination node was not found."
    };
  }

  if (!isOnline(source) || !isOnline(destination)) {
    return {
      reachable: false,
      route: [],
      message: "Source or destination node is offline."
    };
  }

  const adjacency = new Map();

  for (const node of nodes) {
    adjacency.set(node._id, []);
  }

  for (const link of links) {
    if (
      isOnline(byId.get(link.from)) &&
      isOnline(byId.get(link.to))
    ) {
      adjacency.get(link.from)?.push(link.to);
      adjacency.get(link.to)?.push(link.from);
    }
  }

  const queue = [[from]];
  const visited = new Set([from]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current === to) {
      return {
        reachable: true,
        route: path,
        hops: path.length - 1,
        message: "A path exists in the recorded topology."
      };
    }

    for (const neighbor of adjacency.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return {
    reachable: false,
    route: [],
    message: "No path exists in the recorded topology."
  };
}
