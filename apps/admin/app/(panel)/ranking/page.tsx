import { requireAdmin } from "@/lib/supabase-server";
import { PageTitle } from "@/components/ui";
import { LiveRanking } from "./LiveRanking";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  await requireAdmin();
  return (
    <>
      <PageTitle
        title="Ranking en vivo"
        subtitle="Mismo puntaje, mismo puesto; queda más arriba quien llegó primero (P77). Las cuentas suspendidas no aparecen."
      />
      <LiveRanking />
    </>
  );
}
