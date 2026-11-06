import type { Metadata } from "next";
import Profile from "@/components/Profile";
import { absoluteUrl, clipMetaDescription } from "@/lib/seo";
import { getClient } from "@/lib/supabase";
import type { Profile as ProfileData } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };
type ProfileMetadata = Pick<ProfileData, "id" | "username" | "full_name" | "bio" | "specialty">;

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
    return { title: "الملف الشخصي | SkillPost", robots: { index: false, follow: false } };
  }

  const name = profile.full_name || profile.username;
  const bio = clipMetaDescription(profile.bio || "");
  const description =
    bio ||
    clipMetaDescription(
      `تعرّف على ${name}${profile.specialty ? `، ${profile.specialty}` : ""}، واستعرض المشاريع والأعمال المنشورة على SkillPost.`
    );
  const url = absoluteUrl(`/profile/${profile.id}`);
  return {
    title: `${name} | SkillPost`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      siteName: "SkillPost",
      title: name,
      description,
      url,
    },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <Profile id={id} />;
}
