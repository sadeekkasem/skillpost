import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "../supabase/env";
import type { LessonRecord, SheikhRecord } from "./types";

function anonClient() {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listPublishedSheikhs(): Promise<SheikhRecord[]> {
  const client = anonClient();
  if (!client) return [];
  const { data, error } = await client
    .from("published_sheikhs")
    .select("id,name,slug,youtube_channel_url,status")
    .order("name");
  if (error || !data) return [];
  return data as SheikhRecord[];
}

export async function getPublishedSheikh(slug: string): Promise<{
  sheikh: SheikhRecord;
  lessons: LessonRecord[];
} | null> {
  const client = anonClient();
  if (!client) return null;
  const { data: sheikh, error } = await client
    .from("published_sheikhs")
    .select("id,name,slug,youtube_channel_url,status")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !sheikh) return null;
  const { data: lessons } = await client
    .from("published_lessons")
    .select("id,sheikh_id,title,youtube_video_id,status")
    .eq("sheikh_id", sheikh.id)
    .order("created_at");
  return { sheikh: sheikh as SheikhRecord, lessons: (lessons ?? []) as LessonRecord[] };
}
