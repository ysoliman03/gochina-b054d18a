import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, ChevronDown } from "lucide-react";
import type { ItineraryIssue, ItineraryIssueSeverity } from "@/engine/itineraryIssueDetector";

const SEVERITY_META: Record<ItineraryIssueSeverity, { icon: typeof Info; className: string }> = {
  critical: { icon: AlertCircle, className: "text-destructive" },
  warning: { icon: AlertTriangle, className: "text-amber-600" },
  info: { icon: Info, className: "text-sky-600" },
};

const SEVERITY_RANK: Record<ItineraryIssueSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

type Props = {
  issues: ItineraryIssue[];
};

export function ItineraryIssuePanel({ issues }: Props) {
  const [expanded, setExpanded] = useState(false);

  const issueKey = useMemo(() => issues.map((issue) => issue.id).join("|"), [issues]);

  useEffect(() => {
    setExpanded(false);
  }, [issueKey]);

  const worstSeverity = issues.reduce<ItineraryIssueSeverity>(
    (worst, issue) =>
      SEVERITY_RANK[issue.severity] > SEVERITY_RANK[worst] ? issue.severity : worst,
    "info",
  );

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">No major issues</span>
      </div>
    );
  }

  const { icon: SummaryIcon, className: summaryClassName } = SEVERITY_META[worstSeverity];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
      >
        <SummaryIcon className={`w-4 h-4 shrink-0 ${summaryClassName}`} aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">
          {issues.length} issue{issues.length === 1 ? "" : "s"} found
        </span>
        <ChevronDown
          className={`ml-auto w-4 h-4 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <ul className="flex flex-col gap-3 border-t border-border p-4">
          {issues.map((issue) => {
            const { icon: Icon, className } = SEVERITY_META[issue.severity];
            return (
              <li key={issue.id} className="flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${className}`} aria-hidden="true" />
                <div className="min-w-0">
                  {(issue.stopTitle || issue.stopTime) && (
                    <p className="text-xs font-semibold text-muted-foreground">
                      {issue.stopTitle}
                      {issue.stopTitle && issue.stopTime ? " · " : ""}
                      {issue.stopTime}
                    </p>
                  )}
                  <p className="text-sm font-medium text-foreground leading-snug">{issue.title}</p>
                  <p className="text-sm text-muted-foreground leading-snug">{issue.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
