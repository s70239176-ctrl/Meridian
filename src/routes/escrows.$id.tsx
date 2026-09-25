import { createFileRoute, Link } from "@tanstack/react-router";
import { CaseActions } from "@/components/protocol/case-actions";
import { Committee } from "@/components/protocol/committee";
import { GenlayerVerifyPanel } from "@/components/protocol/genlayer-verify";
import { SettlementCard } from "@/components/protocol/settlement-card";
import { StatusBadge } from "@/components/protocol/status-badge";
import { Timeline } from "@/components/protocol/timeline";
import {
  chainLabel,
  formatAmount,
  formatClock,
  shortAddr,
  verdictLabel,
} from "@/lib/protocol/format";
import { ADJUDICATOR_SOURCE } from "@/lib/protocol/contract-source";
import { useEscrowStore } from "@/lib/protocol/store";
import { CHAIN_META } from "@/lib/protocol/types";

export const Route = createFileRoute("/escrows/$id")({ component: CasePage });

function CasePage() {
  const { id } = Route.useParams();
  const escrow = useEscrowStore((s) => s.escrows.find((e) => e.id === id));

  if (!escrow) {
    return (
      <div>
        <h1 className="font-display text-3xl text-fg">Case not found</h1>
        <p className="mt-2 text-sm text-muted">This docket id is not in the local console.</p>
        <Link to="/escrows" className="mt-4 inline-flex h-11 items-center text-sm text-fg">
          Back to docket
        </Link>
      </div>
    );
  }

  const last = escrow.rounds[escrow.rounds.length - 1];
  const prior = escrow.rounds.slice(0, -1);

  return (
    <div>
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
        {escrow.id} · {escrow.domain}
      </p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl tracking-tight text-fg">{escrow.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{escrow.spec}</p>
        </div>
        <StatusBadge status={escrow.status} />
      </div>

      <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Vault chain", chainLabel(escrow.sourceChain)],
          ["Locked", formatAmount(escrow.amount, escrow.asset)],
          ["Payer", escrow.payer.name],
          ["Payee", escrow.payee.name],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <dt className="text-xs tracking-[0.14em] text-faint uppercase">{k}</dt>
            <dd className="mt-2 text-sm text-fg">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-2xl tracking-tight text-fg">Source-chain vault</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The lock lives on {chainLabel(escrow.sourceChain)} ({CHAIN_META[escrow.sourceChain].eip155}). Address{" "}
              {shortAddr(escrow.vaultAddress, 6)}. Lock transaction {shortAddr(escrow.lockTx, 8)}. GenLayer cannot spend
              this. Payer {shortAddr(escrow.payer.address)} · payee {shortAddr(escrow.payee.address)}.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl tracking-tight text-fg">Equivalence principle</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{escrow.equivalence}</p>
          </section>

          {escrow.settlement ? <SettlementCard escrow={escrow} message={escrow.settlement} /> : null}

          {last ? (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-2xl tracking-tight text-fg">
                  {last.kind === "initial" ? "Committee" : `Appeal round ${last.index + 1}`}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {last.committeeSize} validators · leader proposed {verdictLabel(last.proposedVerdict, last.splitBps)}.
                  Models are greyboxed.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-fg">{last.proposedReasoning}</p>
              </div>
              <Committee round={last} />
            </section>
          ) : null}

          {prior.length > 0 ? (
            <section className="space-y-6">
              <h2 className="font-display text-2xl tracking-tight text-fg">Prior rounds</h2>
              {prior.map((round) => (
                <div key={round.index} className="space-y-3">
                  <p className="text-sm text-muted">
                    Round {round.index + 1} · {round.kind.replaceAll("_", " ")} · {round.committeeSize} validators ·{" "}
                    {verdictLabel(round.proposedVerdict, round.splitBps)}
                  </p>
                  <Committee round={round} />
                </div>
              ))}
            </section>
          ) : null}

          {escrow.evidence.length > 0 ? (
            <section>
              <h2 className="font-display text-2xl tracking-tight text-fg">Evidence</h2>
              <ul className="mt-4 space-y-2">
                {escrow.evidence.map((ev) => (
                  <li key={ev.id} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
                    <p className="text-sm text-fg">{ev.label}</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted">{ev.url}</p>
                    {ev.note ? <p className="mt-2 text-sm text-muted">{ev.note}</p> : null}
                    <p className="mt-2 text-xs text-faint">
                      {ev.submittedBy} · {formatClock(ev.at)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="font-display text-2xl tracking-tight text-fg">Intelligent Contract</h2>
            <p className="mt-2 text-sm text-muted">
              Deployable GenLayer source. It stores a verdict and emits the payout message only with on="finalized". It does not transfer the vault.
            </p>
            <pre className="mt-4 max-h-[32rem] overflow-auto rounded-xl bg-surface p-4 font-mono text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]">
              {ADJUDICATOR_SOURCE}
            </pre>
          </section>
        </div>

        <aside className="space-y-8 md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto md:self-start">
          <CaseActions escrow={escrow} />
          <GenlayerVerifyPanel escrow={escrow} />
          <div>
            <h2 className="font-display mb-4 text-xl tracking-tight text-fg">Path to payout</h2>
            <Timeline escrow={escrow} />
          </div>
        </aside>
      </div>
    </div>
  );
}
