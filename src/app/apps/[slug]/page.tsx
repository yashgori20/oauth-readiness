import { notFound } from "next/navigation";
import { GuideView } from "@/components/GuideView";
import { getGuide } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = await getGuide((await params).slug);
  if (!guide) notFound();
  return <GuideView guide={guide} />;
}
