import type { MediaEmbed } from "@/lib/media";

/** A YouTube / Vimeo / Facebook / Google Drive / SoundCloud / Spotify player, sized for what it holds. */
export function MediaEmbedFrame({ embed, title }: { embed: MediaEmbed; title: string }) {
  const frame = (
    <iframe
      src={embed.src}
      title={`${title} (${embed.service})`}
      className={embed.shape === "video" ? "h-full w-full" : "w-full"}
      style={embed.shape === "video" ? undefined : { height: embed.shape === "audio" ? 152 : 166 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
  return embed.shape === "video" ? (
    <div className="aspect-video overflow-hidden rounded-2xl bg-ink/5">{frame}</div>
  ) : (
    <div className="overflow-hidden rounded-2xl">{frame}</div>
  );
}
