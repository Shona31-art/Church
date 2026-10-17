/**
 * One verse's words. Text in [square brackets] marks words the translators
 * supplied (italic in printed KJV/ASV/YLT Bibles), so it's shown in italics
 * without the brackets. Brackets are guaranteed balanced by the build script.
 */
export function VerseText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\])/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[") ? (
          <em key={i} className="text-ink/75">
            {part.slice(1, -1)}
          </em>
        ) : (
          part
        ),
      )}
    </>
  );
}
