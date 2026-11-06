import type { Metadata } from "next";
import Detail from "@/components/ProjectDetail";
import { demoProjects } from "@/lib/demo";
import { getClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";

const BASE_URL = "https://skillpostapp.com";
type Props = { params: Promise<{ id: string }> };
type ProjectMetadata = Pick<
  Project,
  "id" | "title" | "description" | "category" | "created_at" | "profiles"
>;

function descriptionOf(project: Pick<Project, "description" | "category">): string {
  const description = project.description.trim().replace(/\s+/g, " ");
  return description.length > 160
    ? `${description.slice(0, 157).trimEnd()}...`
    : description || `مشروع في ${project.category} على SkillPost.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  let project: ProjectMetadata | null = demoProjects.find((item) => item.id === id) ?? null;
  const db = project ? null : getClient();

  if (db) {
    const { data } = await db
      .from("projects")
      .select(
        "id,title,description,category,created_at,profiles!projects_user_id_fkey(username,full_name)"
      )
      .eq("id", id)
      .maybeSingle();
    project = data as unknown as ProjectMetadata | null;
  }

  if (!project) {
    return { title: "مشروع غير موجود", robots: { index: false, follow: false } };
  }

  const description = descriptionOf(project);
  const url = `${BASE_URL}/projects/${project.id}`;
  const author = project.profiles?.full_name || project.profiles?.username;
  return {
    title: project.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title: project.title, description, url },
    twitter: { card: "summary_large_image", title: project.title, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <Detail id={id} />;
}
