/**
 * Back-compat shim. Prefer importing from @/lib/conversationStore.
 */
export {
  loadAppState,
  saveAppState,
  loadMessages,
  saveMessages,
  createId,
  addMemory,
  getRelevantMemories,
  createConversation,
  getConversation,
  getConversationsByWorkspace,
  updateConversation,
  deleteConversation,
  addMessage,
  updateMessage,
  hasAssistantForRequest,
  generateConversationTitle,
  updateBusinessContext,
} from "./conversationStore";
