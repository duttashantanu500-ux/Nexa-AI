import { ToolDefinition } from "./types";
import { webSearch } from "./webSearch";
import { readWebPage } from "./pageReader";

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: "web_search",
    description: "Search the public web for relevant pages",
    permission: "read",
    requiresAuth: false,
    available: true,
  },
  {
    name: "web_page_reader",
    description: "Read and extract text from a public webpage",
    permission: "read",
    requiresAuth: false,
    available: true,
  },
  {
    name: "structured_data",
    description: "Structure research into tables and lists",
    permission: "read",
    requiresAuth: false,
    available: true,
  },
];

export async function runTool(
  name: string,
  input: Record<string, unknown>
) {
  switch (name) {
    case "web_search":
      return webSearch(String(input.query || ""), Number(input.limit) || 10);
    case "web_page_reader":
      return readWebPage(String(input.url || ""));
    default:
      return {
        ok: false,
        tool: name,
        error: `Tool "${name}" is not available`,
      };
  }
}
