import Feed from '@/components/Feed';
import Hero from '@/components/Hero';
import WeatherStrip from '@/components/WeatherStrip';
import PostsSection from '@/components/PostsSection';
import { getChannelVideos } from '@/lib/youtube/feed';

export const revalidate = 3600;

export default async function Home(){
  const videos = (await getChannelVideos()).slice(0, 15);
  return <><WeatherStrip/><Hero/><Feed inTimeline/><PostsSection videos={videos} withProjects/></>;
}
