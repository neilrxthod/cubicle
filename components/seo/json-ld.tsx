import { jsonLdScript } from "@/lib/seo";

/** Server-safe JSON-LD for search, answer engines, and generative engines. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
    />
  );
}
