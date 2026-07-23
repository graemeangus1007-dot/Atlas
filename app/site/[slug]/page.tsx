import PublishedSite from "@/components/publishing/published-site";

type PublishedSitePageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * /site/[slug] — mock live site rendered from the frozen publish snapshot.
 */
export default async function PublishedSitePage({
  params,
}: PublishedSitePageProps) {
  const { slug } = await params;
  return <PublishedSite slug={decodeURIComponent(slug)} />;
}
