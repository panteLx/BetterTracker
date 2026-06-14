import { PageContainer } from "@/components/layout/page-container";
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { ensureBootstrapForUser } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";

export default async function TransactionsPage() {
  const user = await requireUser();
  await ensureBootstrapForUser(user.id);

  return (
    <PageContainer
      user={user}
      title="Transaktionen"
      description="Filterbare Historie mit Summen fuer Einnahmen, Ausgaben und Saldo."
    >
      <TransactionsClient locale={env.defaultLocale} currentUserId={user.id} />
    </PageContainer>
  );
}
