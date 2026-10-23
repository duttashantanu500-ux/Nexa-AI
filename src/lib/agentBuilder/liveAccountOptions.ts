/**
 * Load real targets from the user's connected accounts for AI Employee Builder/chat.
 * Used so create/edit can pick Notion pages, Slack channels, Buffer channels, HubSpot records
 * instead of asking for opaque defaults.
 */

export type LiveOption = {
  id: string;
  label: string;
  meta?: string;
};

export type LiveAccountOptions = {
  notionPages: LiveOption[];
  slackChannels: LiveOption[];
  bufferChannels: LiveOption[];
  hubspotContacts: LiveOption[];
  hubspotDeals: LiveOption[];
  errors: Partial<Record<string, string>>;
};

function emptyOptions(): LiveAccountOptions {
  return {
    notionPages: [],
    slackChannels: [],
    bufferChannels: [],
    hubspotContacts: [],
    hubspotDeals: [],
    errors: {},
  };
}

/**
 * Fetch up to a small list of real targets per connected provider for this user.
 * Never fabricates rows. Failures are recorded in errors and other providers still load.
 */
export async function loadLiveAccountOptions(
  userId: string
): Promise<LiveAccountOptions> {
  const uid = (userId || "").trim();
  const out = emptyOptions();
  if (!uid) return out;

  await Promise.all([
    loadNotion(uid, out),
    loadSlack(uid, out),
    loadBuffer(uid, out),
    loadHubspot(uid, out),
  ]);

  return out;
}

async function loadNotion(userId: string, out: LiveAccountOptions) {
  try {
    const { resolveNotionToken } = await import("@/lib/connectors/notionAuth");
    const resolved = await resolveNotionToken(userId);
    if (!resolved?.token) return;
    const { notionSearch } = await import("@/lib/connectors/providers/notion");
    const r = await notionSearch({ accessToken: resolved.token, query: "" });
    if (!r.ok) {
      out.errors.notion = r.message || "Could not list Notion pages";
      return;
    }
    const pages =
      (r.data as { pages?: { id?: string; title?: string; url?: string }[] })?.pages ||
      [];
    out.notionPages = pages
      .filter((p) => p?.id)
      .slice(0, 12)
      .map((p) => ({
        id: String(p.id),
        label: (p.title || "Untitled").trim() || "Untitled",
        meta: p.url,
      }));
  } catch (e) {
    out.errors.notion = e instanceof Error ? e.message : "Notion load failed";
  }
}

async function loadSlack(userId: string, out: LiveAccountOptions) {
  try {
    const { loadConnection } = await import("@/lib/connectors/tokenStore");
    const conn = await loadConnection(userId, "slack");
    if (!conn?.accessToken) return;
    const { slackListChannels } = await import("@/lib/connectors/providers/slack");
    const r = await slackListChannels({ accessToken: conn.accessToken });
    if (!r.ok) {
      out.errors.slack = r.message || "Could not list Slack channels";
      return;
    }
    const channels =
      (r.data as { channels?: { id?: string; name?: string }[] })?.channels ||
      (Array.isArray(r.data) ? (r.data as { id?: string; name?: string }[]) : []);
    out.slackChannels = channels
      .filter((c) => c?.id)
      .slice(0, 20)
      .map((c) => ({
        id: String(c.id),
        label: c.name ? `#${String(c.name).replace(/^#/, "")}` : String(c.id),
      }));
  } catch (e) {
    out.errors.slack = e instanceof Error ? e.message : "Slack load failed";
  }
}

async function loadBuffer(userId: string, out: LiveAccountOptions) {
  try {
    const { resolveBufferToken } = await import("@/lib/connectors/bufferAuth");
    const resolved = await resolveBufferToken(userId);
    if (!resolved?.token) return;
    const { bufferListChannels } = await import("@/lib/connectors/providers/buffer");
    const r = await bufferListChannels({ accessToken: resolved.token });
    if (!r.ok) {
      out.errors.buffer = r.message || "Could not list Buffer channels";
      return;
    }
    const channels =
      (r.data as { channels?: { id?: string; name?: string; service?: string }[] })
        ?.channels || [];
    out.bufferChannels = channels
      .filter((c) => c?.id)
      .slice(0, 20)
      .map((c) => ({
        id: String(c.id),
        label: (c.name || c.id || "Channel").trim(),
        meta: c.service,
      }));
  } catch (e) {
    out.errors.buffer = e instanceof Error ? e.message : "Buffer load failed";
  }
}

async function loadHubspot(userId: string, out: LiveAccountOptions) {
  try {
    const { resolveHubspotToken } = await import("@/lib/connectors/hubspotAuth");
    const resolved = await resolveHubspotToken(userId);
    if (!resolved?.token) return;
    const hs = await import("@/lib/connectors/providers/hubspot");
    const [contacts, deals] = await Promise.all([
      hs.hubspotListContacts({ accessToken: resolved.token, limit: 10 }),
      hs.hubspotListDeals({ accessToken: resolved.token, limit: 10 }),
    ]);
    if (contacts.ok) {
      const list =
        (contacts.data as {
          contacts?: {
            id?: string;
            properties?: { firstname?: string; lastname?: string; email?: string };
            email?: string;
            name?: string;
          }[];
        })?.contacts || [];
      out.hubspotContacts = list
        .filter((c) => c?.id)
        .slice(0, 10)
        .map((c) => {
          const p = c.properties || {};
          const name =
            [p.firstname, p.lastname].filter(Boolean).join(" ").trim() ||
            p.email ||
            c.email ||
            c.name ||
            c.id;
          return {
            id: String(c.id),
            label: String(name),
            meta: p.email || c.email,
          };
        });
    } else {
      out.errors.hubspot_contacts = contacts.message;
    }
    if (deals.ok) {
      const list =
        (deals.data as {
          deals?: {
            id?: string;
            properties?: { dealname?: string; amount?: string };
            name?: string;
          }[];
        })?.deals || [];
      out.hubspotDeals = list
        .filter((d) => d?.id)
        .slice(0, 10)
        .map((d) => {
          const p = d.properties || {};
          return {
            id: String(d.id),
            label: String(p.dealname || d.name || d.id),
            meta: p.amount ? `$${p.amount}` : undefined,
          };
        });
    } else {
      out.errors.hubspot_deals = deals.message;
    }
  } catch (e) {
    out.errors.hubspot = e instanceof Error ? e.message : "HubSpot load failed";
  }
}

/** Compact text for LLM system prompts. */
export function formatLiveOptionsForPrompt(opts: LiveAccountOptions): string {
  const blocks: string[] = [];
  if (opts.notionPages.length) {
    blocks.push(
      "Notion pages (use as parent for notion.create_page - prefer id in config.parent_id or name in parent_name):\n" +
        opts.notionPages.map((p) => '  - "' + p.label + '" id=' + p.id).join("\n")
    );
  }
  if (opts.slackChannels.length) {
    blocks.push(
      "Slack channels (use id or #name in slack.post_message config.channel):\n" +
        opts.slackChannels.map((c) => "  - " + c.label + " id=" + c.id).join("\n")
    );
  }
  if (opts.bufferChannels.length) {
    blocks.push(
      "Buffer channels (use id in buffer.create_post config.channel):\n" +
        opts.bufferChannels
          .map(
            (c) =>
              '  - "' +
              c.label +
              '" id=' +
              c.id +
              (c.meta ? " (" + c.meta + ")" : "")
          )
          .join("\n")
    );
  }
  if (opts.hubspotContacts.length) {
    blocks.push(
      "HubSpot contacts (sample - use id for get/update):\n" +
        opts.hubspotContacts
          .map((c) => '  - "' + c.label + '" id=' + c.id)
          .join("\n")
    );
  }
  if (opts.hubspotDeals.length) {
    blocks.push(
      "HubSpot deals (sample - use id for get/update):\n" +
        opts.hubspotDeals.map((d) => '  - "' + d.label + '" id=' + d.id).join("\n")
    );
  }
  if (!blocks.length) {
    return "No live account targets loaded (connector not connected, or list empty). Do not invent page/channel names.";
  }
  return (
    "LIVE ACCOUNT TARGETS from the user's connected apps (prefer these real ids/names in step config; never invent):\n" +
    blocks.join("\n") +
    "\nWhen the user picks a target by name, put the matching id into step config."
  );
}
