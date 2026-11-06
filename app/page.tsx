import Feed from '@/components/Feed';
import Hero from '@/components/Hero';
import FeaturedProjects from '@/components/FeaturedProjects';
import WeatherStrip from '@/components/WeatherStrip';
import RatesStrip from '@/components/RatesStrip';
import NewsStrip from '@/components/NewsStrip';
import PostsSection from '@/components/PostsSection';
import { getChannelVideos } from '@/lib/youtube/feed';

export const revalidate = 3600;

export default async function Home(){
  const videos = (await getChannelVideos()).slice(0, 15);
  return <><WeatherStrip/><RatesStrip/><Hero/><NewsStrip/><FeaturedProjects/><Feed inTimeline/><PostsSection videos={videos} withProjects/></>;
}
