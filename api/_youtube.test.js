import { describe, expect, it } from 'vitest';
import { parseChannelId, parseFeed } from './_youtube.js';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q"/>
 <id>yt:channel:sXVk37bltHxD1rDPwtNM8Q</id>
 <title>Kurzgesagt – In a Nutshell</title>
 <entry>
  <id>yt:video:abcdefghijk</id>
  <yt:videoId>abcdefghijk</yt:videoId>
  <title>What If You Fell Into a Black Hole? &amp; More</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
  <published>2026-10-01T14:00:00+00:00</published>
  <media:group><media:title>x</media:title><media:community><media:statistics views="1234567"/></media:community></media:group>
 </entry>
 <entry>
  <id>yt:video:short123456</id>
  <yt:videoId>short123456</yt:videoId>
  <title>A short</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/short123456"/>
  <published>2026-10-02T14:00:00+00:00</published>
 </entry>
</feed>`;

describe('YouTube proxy', () => {
  it('čte videa z RSS a vynechá Shorts', () => {
    const r = parseFeed(FEED);
    expect(r.channelTitle).toBe('Kurzgesagt – In a Nutshell');
    expect(r.videos).toEqual([{ id: 'abcdefghijk', title: 'What If You Fell Into a Black Hole? & More', published: '2026-10-01T14:00:00+00:00', views: 1234567 }]);
  });

  it('ID kanálu z kanonického odkazu, ne z prvního channelId na stránce', () => {
    const html = '{"channelId":"UCxxxxxxxxxxxxxxxxxxxxxx"} <link rel="canonical" href="https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q">';
    expect(parseChannelId(html)).toBe('UCsXVk37bltHxD1rDPwtNM8Q');
    expect(parseChannelId('"externalId":"UCHnyfMqiRRG1u-2MsSQLbXA"')).toBe('UCHnyfMqiRRG1u-2MsSQLbXA');
    expect(parseChannelId('nic')).toBeNull();
  });
});
