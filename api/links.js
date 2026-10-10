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

  const from = cleanText(req.body?.from, 64);
  const to = cleanText(req.body?.to, 64);

  if (!validId(from) || !validId(to) || from === to) {
    return res.status(400).json({
      error: "Provide two different valid node IDs."
    });
  }

  try {
    const { nodes, links } = await getDatabase();

    const [source, destination] = await Promise.all([
      nodes.findOne({ _id: from }),
      nodes.findOne({ _id: to })
    ]);

    if (!source || !destination) {
      return res.status(404).json({
        error: "Both nodes must be registered first."
      });
    }

    const ordered = [from, to].sort();
    const id = `${ordered[0]}--${ordered[1]}`;

    const link = {
      _id: id,
      from: ordered[0],
      to: ordered[1],
      updatedAt: timestamp()
    };

    await links.replaceOne(
      { _id: id },
      link,
      { upsert: true }
    );

    return res.status(200).json({
      message: "Link saved.",
      link: {
        id: link._id,
        from: link.from,
        to: link.to,
        updatedAt: link.updatedAt
      },
      note: "This records a reported connection; it does not create a physical network link."
    });
  } catch (error) {
    console.error("Link update failed:", error.message);

    return res.status(503).json({
      error: "Unable to save the link."
    });
  }
}
