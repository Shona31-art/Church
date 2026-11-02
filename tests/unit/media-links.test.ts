import { describe, expect, test } from "vitest";
import { mediaEmbed, playableFileUrl } from "@/lib/media";

describe("mediaEmbed: links to media kept on other services", () => {
  test("YouTube (still the privacy-enhanced player)", () => {
    expect(mediaEmbed("https://youtu.be/dQw4w9WgXcQ")).toEqual({ src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", shape: "video", service: "YouTube" });
  });

  test("Vimeo, including unlisted links with a hash", () => {
    expect(mediaEmbed("https://vimeo.com/76979871")?.src).toBe("https://player.vimeo.com/video/76979871");
    expect(mediaEmbed("https://vimeo.com/76979871/a1b2c3d4e5")?.src).toBe("https://player.vimeo.com/video/76979871?h=a1b2c3d4e5");
    expect(mediaEmbed("https://player.vimeo.com/video/76979871?h=a1b2c3d4e5")?.src).toBe("https://player.vimeo.com/video/76979871?h=a1b2c3d4e5");
    expect(mediaEmbed("https://vimeo.com/channels/staffpicks")).toBeNull();
  });

  test("Facebook videos go through Facebook's video player", () => {
    const e = mediaEmbed("https://www.facebook.com/GraceChurch/videos/1234567890/");
    expect(e?.service).toBe("Facebook");
    expect(e?.src).toBe(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent("https://www.facebook.com/GraceChurch/videos/1234567890/")}&show_text=false`);
    expect(mediaEmbed("https://fb.watch/abc123/")?.service).toBe("Facebook");
    expect(mediaEmbed("https://www.facebook.com/GraceChurch")).toBeNull(); // a page, not a video
  });

  test("Google Drive share links become the preview player", () => {
    expect(mediaEmbed("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing")?.src).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
    expect(mediaEmbed("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345")?.src).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
    expect(mediaEmbed("https://drive.google.com/drive/folders/abc")).toBeNull();
  });

  test("SoundCloud and Spotify are audio players", () => {
    expect(mediaEmbed("https://soundcloud.com/grace-church/sunday-sermon")).toMatchObject({ shape: "audio-tall", service: "SoundCloud" });
    expect(mediaEmbed("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=abc")).toEqual({ src: "https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk", shape: "audio", service: "Spotify" });
    expect(mediaEmbed("https://open.spotify.com/intl-en/show/4rOoJ6Egrf8K2IrywzwOMk")?.src).toBe("https://open.spotify.com/embed/show/4rOoJ6Egrf8K2IrywzwOMk");
  });

  test("only ever builds players on the services' own domains", () => {
    expect(mediaEmbed("javascript:alert(1)")).toBeNull();
    expect(mediaEmbed("https://evil.example/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view")).toBeNull();
    expect(mediaEmbed("https://soundcloud.com/a/b%22onload%3Dalert(1)")).toBeNull();
    expect(mediaEmbed("https://drive.google.com/file/d/abc\"<script>/view")).toBeNull();
    expect(mediaEmbed("")).toBeNull();
  });
});

describe("playableFileUrl", () => {
  test("direct audio/video files play as they are", () => {
    expect(playableFileUrl("https://church.example/sermon.mp4")).toBe("https://church.example/sermon.mp4");
    expect(playableFileUrl("https://church.example/watch")).toBeNull();
  });

  test("Dropbox share links become direct file links", () => {
    expect(playableFileUrl("https://www.dropbox.com/scl/fi/abc123/sermon.mp3?rlkey=xyz&dl=0")).toBe("https://www.dropbox.com/scl/fi/abc123/sermon.mp3?rlkey=xyz&raw=1");
    expect(playableFileUrl("https://www.dropbox.com/scl/fi/abc123/notes.pdf?dl=0")).toBeNull();
  });
});
