import type { Metadata } from "next";
import Detail from "@/components/ProjectDetail";
import { demoProjects } from "@/lib/demo";
import { absoluteUrl, clipMetaDescription } from "@/lib/seo";
import { getClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };
type ProjectMetadata = Pick<Project, "id" | "title" | "description" | "category" | "profiles">;

function projectDescription(project: Pick<Project, "description" | "category" | "title">): string {
  const fromBody = clipMetaDescription(project.description || "");
  if (fromBody) return fromBody;
  return clipMetaDescription(`مشروع «${project.title}» في ${project.category} على SkillPost.`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  let project: ProjectMetadata | null = demoProjects.find((item) => item.id === id) ?? null;
  const db = project ? null : getClient();

  if (db) {
    const { data } = await db
      .from("projects")
      .select(
        "id,title,description,category,profiles!projects_user_id_fkey(username,full_name)"
      )
      .eq("id", id)
      .maybeSingle();
    project = data as unknown as ProjectMetadata | null;
  }

  if (!project) {
    return { title: "مشروع غير موجود | SkillPost", robots: { index: false, follow: false } };
  }

  const description = projectDescription(project);
  const url = absoluteUrl(`/projects/${project.id}`);
  const title = `${project.title} | SkillPost`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: "SkillPost",
      title: project.title,
      description,
      url,
    },
    twitter: { card: "summary_large_image", title: project.title, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <Detail id={id} />;
}
