import type { Metadata } from "next";
import Profile from "@/components/Profile";
import { getClient } from "@/lib/supabase";
import type { Profile as ProfileData } from "@/lib/types";

const BASE_URL = "https://skillpostapp.com";
type Props = { params: Promise<{ id: string }> };
type ProfileMetadata = Pick<
  ProfileData,
  "id" | "username" | "full_name" | "bio" | "specialty"
>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const db = getClient();
  let profile: ProfileMetadata | null = null;

  if (db) {
    const { data } = await db
      .from("profiles")
      .select("id,username,full_name,bio,specialty")
      .eq("id", id)
      .maybeSingle();
    profile = data as ProfileMetadata | null;
  }

  if (!profile) {
    return { title: "الملف الشخصي", robots: { index: false, follow: false } };
  }

  const name = profile.full_name || profile.username;
  const bio = profile.bio?.trim().replace(/\s+/g, " ");
  const description = bio
    ? bio.length > 160
      ? `${bio.slice(0, 157).trimEnd()}...`
      : bio
    : `تعرّف على ${name}${profile.specialty ? `، ${profile.specialty}` : ""}، واستعرض المشاريع والأعمال المنشورة على منصة SkillPost.`;
  const url = `${BASE_URL}/profile/${profile.id}`;
  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", title: name, description, url },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <Profile id={id} />;
}
