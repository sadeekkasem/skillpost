import Hero from "@/components/Hero";
import HomeHowItWorks from "@/components/HomeHowItWorks";
import FeaturedProjects from "@/components/FeaturedProjects";
import HomeChallenges from "@/components/HomeChallenges";
import PostsSection from "@/components/PostsSection";

export const revalidate = 300;

export default async function Home() {
  return (
    <>
      <Hero />
      <HomeHowItWorks />
      <FeaturedProjects />
      <HomeChallenges />
      <PostsSection latest />
    </>
  );
}
