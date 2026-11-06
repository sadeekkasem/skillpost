import Feed from "@/components/Feed";
import Hero from "@/components/Hero";
import FeaturedProjects from "@/components/FeaturedProjects";
import HomeUtilityStrips from "@/components/HomeUtilityStrips";
import OpenChallengesStrip from "@/components/OpenChallengesStrip";
import PostsSection from "@/components/PostsSection";
import { getChannelVideos } from "@/lib/youtube/feed";

export const revalidate = 3600;

export default async function Home() {
  const videos = (await getChannelVideos()).slice(0, 15);
  return (
    <>
      <Hero />
      <HomeUtilityStrips />
      <FeaturedProjects />
      <OpenChallengesStrip />
      <Feed inTimeline />
      <PostsSection videos={videos} withProjects />
    </>
  );
}
