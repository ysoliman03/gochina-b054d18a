const SITE_URL = "https://gochina.lovable.app";

export function pageHead(opts: {
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
}) {
  const url = SITE_URL + opts.path;
  const type = opts.type ?? "website";
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:type", content: type },
      { property: "og:url", content: url },
      { name: "twitter:title", content: opts.title },
      { name: "twitter:description", content: opts.description },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function articleJsonLd(title: string, description: string, path: string) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      url: SITE_URL + path,
    }),
  };
}