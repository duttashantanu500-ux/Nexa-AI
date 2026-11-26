/**
 * Live account targets for AI Employee builder/chat.
 * Native connector loaders removed — options come from connected apps via the marketplace path.
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
 * Placeholder: detailed target lists load from connected apps at run time.
 * Does not invent page/channel ids.
 */
export async function loadLiveAccountOptions(
  _userId: string
): Promise<LiveAccountOptions> {
  return emptyOptions();
}

export function formatLiveOptionsForPrompt(opts: LiveAccountOptions): string {
  if (!opts.notionPages.length && !opts.slackChannels.length) {
    return "No live account targets preloaded. Use connected apps from Connections; never invent page or channel ids.";
  }
  return "LIVE ACCOUNT TARGETS: use only real ids from the user's connected apps.";
}
