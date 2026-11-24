import { requireAdmin } from "@/lib/supabase-server";
import { Flash, PageTitle } from "@/components/ui";
import { ResetScoresButton } from "@/components/ResetScoresButton";
import { LiveRanking } from "./LiveRanking";

export const dynamic = "force-dynamic";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { ok, error } = await searchParams;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          title="Ranking en vivo"
          subtitle="Mismo puntaje, mismo puesto; queda más arriba quien llegó primero (P77). Las cuentas suspendidas no aparecen."
        />
        <ResetScoresButton />
      </div>
      <Flash ok={ok} error={error} />
      <LiveRanking />
    </>
  );
}
