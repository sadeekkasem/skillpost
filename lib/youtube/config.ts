export type YouTubeChannel = {
  /** Channel ID (starts with "UC"). Resolve with: node scripts/youtube-channel-check.mjs <url|@handle> */
  id: string;
  handle: string;
  name: string;
  url: string;
  /** Our own channel: keeps SkillPost branding on cards. */
  isOwn?: boolean;
  /** Drip: visible = perDay * (Europe/Helsinki days since startDate + 1), newest first. Unset = unlimited. */
  startDate?: string;
  perDay?: number;
};

export const YOUTUBE_CHANNELS: YouTubeChannel[] = [
  {
    id: "UCPeeWJdGwbQ3F9880lSooLA",
    handle: "@SadeekShopExcel",
    name: "SadeekShop",
    url: "https://www.youtube.com/@SadeekShopExcel",
    isOwn: true,
  },
  {
    id: "UC0qQvvv2qinPDAksk6gCAvQ",
    handle: "@Omar.shaaban88",
    name: "مدرسة تحليل البيانات",
    url: "https://www.youtube.com/@Omar.shaaban88",
    startDate: "2026-10-30",
    perDay: 2,
  },
];

export const OWN_CHANNEL = YOUTUBE_CHANNELS.find((c) => c.isOwn) ?? YOUTUBE_CHANNELS[0];
export const YOUTUBE_CHANNEL_ID = OWN_CHANNEL.id;
export const YOUTUBE_CHANNEL_URL = OWN_CHANNEL.url;
export const feedUrl = (channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
export const YOUTUBE_FEED_URL = feedUrl(YOUTUBE_CHANNEL_ID);
