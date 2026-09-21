import {
  syncConversationToCloud,
  syncMessageToCloud,
  isSupabaseConfigured,
} from "./auth";
import { Conversation, Message } from "@/types";

export async function cloudSaveConversation(conv: Conversation) {
  if (!isSupabaseConfigured()) return;
  try {
    await syncConversationToCloud(conv);
  } catch (e) {
    console.error("[Nexa] conv sync", e);
  }
}

export async function cloudSaveMessage(userId: string, message: Message) {
  if (!isSupabaseConfigured()) return;
  try {
    await syncMessageToCloud(userId, message);
  } catch (e) {
    console.error("[Nexa] message sync", e);
  }
}
