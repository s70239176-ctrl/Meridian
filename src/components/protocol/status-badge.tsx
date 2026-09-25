import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone } from "@/lib/protocol/format";
import type { EscrowStatus } from "@/lib/protocol/types";

export function StatusBadge({ status }: { status: EscrowStatus }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}
