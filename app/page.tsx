import Hero from "@/components/Hero";
import HomeHowItWorks from "@/components/HomeHowItWorks";
import FeaturedProjects from "@/components/FeaturedProjects";
import HomeChallenges from "@/components/HomeChallenges";
import PostsSection from "@/components/PostsSection";
import { getChannelVideos } from "@/lib/youtube/feed";

export const revalidate = 300;

export default async function Home() {
  const videos = (await getChannelVideos()).slice(0, 15);
  return (
    <>
      <Hero />
      <HomeHowItWorks />
      <FeaturedProjects />
      <HomeChallenges />
      <PostsSection videos={videos} withProjects />
    </>
  );
}
