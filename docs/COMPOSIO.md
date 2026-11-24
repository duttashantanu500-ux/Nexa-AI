# Composio integration (Nexa)

Nexa uses **Composio as the only third-party app integration provider** for marketplace connections.

## Environment

```
COMPOSIO_API_KEY=your_project_api_key
```

- Server-only. Never expose to the browser, client bundles, or LLM prompts.
- One project key serves all Nexa users; connected accounts are isolated by Composio `userId` (= Nexa user id).

## Connection limit

Hard product limit: **3 connected accounts per user** (Free and Pro).

Enforced:

- Server: `POST /api/composio/connect` via `assertCanAddConnection`
- Client: Connections marketplace UI disables Connect at 3
- Plans: `maxConnections: 3` for both Free and Pro

## APIs

| Route | Purpose |
|-------|--------|
| `GET /api/composio/toolkits` | Catalogue (search, logos from Composio) |
| `GET /api/composio/connections` | User's connected accounts + slot usage |
| `POST /api/composio/connect` | Start authorize / Connect Link |
| `POST /api/composio/disconnect` | Delete account (ownership-checked) |
| `POST /api/composio/execute` | Real tool execution |

## Billing note

Composio usage (tool calls, OAuth) is billed against the **Nexa project** API key, not automatically per end customer. Monitor usage in the Composio dashboard and set alerts. Do not assume silent per-seat Composio charges to end users unless a separate commercial arrangement is configured.

## Native connectors

Legacy native OAuth paths (Notion/Slack/Buffer/HubSpot/Ideogram) are superseded by the Composio marketplace UI. Prefer Composio for exernal apps. Local data and Vault remain first-party Nexa features.
