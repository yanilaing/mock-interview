import {
  getCurrentAuthingUser,
  getStoredAuthToken,
  getStoredAuthUserId,
} from "./authing";
import { getSupabaseClient } from "./supabase";

const INTERVIEW_RECORDS_TABLE = "user_interview_records";

export const getInterviewRecordOwnerId = async () => {
  const storedUserId = getStoredAuthUserId();
  if (storedUserId) {
    return storedUserId;
  }

  const token = getStoredAuthToken();
  if (!token) {
    return null;
  }

  try {
    const currentUser = await getCurrentAuthingUser();
    return currentUser?.id || token;
  } catch (error) {
    console.warn("Failed to resolve stable Authing user id, falling back to token", error);
    return token;
  }
};

export const migrateInterviewRecordsToAccount = async (ownerId: string) => {
  const legacyToken = getStoredAuthToken();
  if (!legacyToken || legacyToken === ownerId) {
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    console.warn("Supabase client is unavailable, skipping interview record migration", error);
    return;
  }

  const { error } = await supabase
    .from(INTERVIEW_RECORDS_TABLE)
    .update({ user_id: ownerId })
    .eq("user_id", legacyToken);

  if (error) {
    console.warn("Failed to migrate legacy interview records to stable account id", error);
  }
};
