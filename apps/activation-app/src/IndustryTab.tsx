import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { IndustryConfig, ActivationData, ColumnDef } from "./types";

interface Props {
  industry: IndustryConfig;
  darkMode: boolean;
}

/** Convert snake_case key to Title Case label */
function keyToLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Infer column format from key name and sample values */
function inferFormat(key: string, records: Record<string, unknown>[]): "number" | "percent" | "badge" | undefined {
  const k = key.toLowerCase();
  // Badge: status, risk level, severity, adherence, standing, recommendation, outcome
  if (k.includes("status") || k.includes("risk_level") || k.includes("severity") ||
      k.includes("adherence") || k.includes("standing") || k.includes("recommendation") ||
      k.includes("alert_type") || k.includes("outcome") || k.includes("level") ||
      k.includes("bracket") || k.includes("segment") || k.includes("health")) {
    // Only badge if values are short strings (not numeric)
    const sample = records[0]?.[key];
    if (typeof sample === "string" && sample.length < 30) return "badge";
  }
  // Percent: keys containing "rate"
  if (k.includes("_rate") && !k.includes("count")) return "percent";
  // Number: keys containing score, cost, value, risk (numeric), gpa, count, days
  if (k.includes("score") || k.includes("cost") || k.includes("value") ||
      k.includes("gpa") || k.includes("days") || k.includes("count") ||
      k.includes("risk") || k.includes("completion")) {
    const sample = records[0]?.[key];
    if (typeof sample === "number") return "number";
  }
  return undefined;
}

/** Derive columns dynamically from the first data record */
function deriveColumns(records: Record<string, unknown>[]): ColumnDef[] {
  if (!records.length) return [];
  return Object.keys(records[0]).map((key) => ({
    key,
    label: keyToLabel(key),
    format: inferFormat(key, records),
  }));
}

function formatCell(value: unknown, format?: string): string {
  if (value === null || value === undefined) return "—";
  if (format === "percent") return `${(Number(value) * 100).toFixed(1)}%`;
  if (format === "number") {
    const n = Number(value);
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2);
  }
  return String(value);
}

function badgeColor(value: string, dark: boolean): string {
  const v = value.toLowerCase();
  if (v.includes("risk") || v.includes("terminated") || v.includes("high") || v.includes("critical") ||
      v.includes("non-adherent") || v.includes("poor") || v.includes("injured") || v.includes("sick") ||
      v.includes("overdue") || v.includes("suspended"))
    return dark
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : "bg-red-50 text-red-700 border-red-200";
  if (v.includes("active") || v.includes("approved") || v.includes("low") || v.includes("complete") ||
      v.includes("good") || v.includes("excellent") || v.includes("healthy") || v.includes("adherent") ||
      v.includes("up-to-date") || v.includes("satisfactory"))
    return dark
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : "bg-green-50 text-green-700 border-green-200";
  if (v.includes("recruiting") || v.includes("pending") || v.includes("medium") || v.includes("warning") ||
      v.includes("moderate") || v.includes("partial") || v.includes("fair"))
    return dark
      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      : "bg-yellow-50 text-yellow-700 border-yellow-200";
  return dark
    ? "bg-gray-500/20 text-gray-300 border-gray-500/30"
    : "bg-gray-100 text-gray-600 border-gray-200";
}

function timeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

export default function IndustryTab({ industry, darkMode }: Props) {
  const [data, setData] = useState<ActivationData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [sort, setSort] = useState<SortState>(null);

  useEffect(() => {
    const docRef = doc(db, "industries", industry.id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data() as ActivationData;
        setData(d);
        setLastUpdate(d.activated_at);
      } else {
        setData(null);
        setLastUpdate("");
      }
    });
    return () => unsubscribe();
  }, [industry.id]);

  // Update the "time ago" display every second
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastUpdate) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  if (!data) {
    return (
      <div className={`flex flex-col items-center justify-center h-96 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
        <div className={`w-16 h-16 mb-6 rounded-full border-2 border-dashed flex items-center justify-center ${
          darkMode ? "border-gray-700" : "border-gray-300"
        }`}>
          <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className={`text-lg font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
          Waiting for activation data...
        </p>
        <p className={`text-sm mt-2 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
          Run <code className={`px-2 py-0.5 rounded ${
            darkMode ? "text-gray-400 bg-gray-800" : "text-gray-600 bg-gray-200"
          }`}>/fivetran-se-ai-solution-demo</code> in the Fivetran CLI
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {data.title}
          </h2>
          <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Source: <span className={darkMode ? "text-gray-300" : "text-gray-700"}>{data.source}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-sm text-green-500">Live</span>
          </div>
          <p className={`text-xs mt-1 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
            Activated {lastUpdate ? timeAgo(lastUpdate) : "—"}
          </p>
        </div>
      </div>

      {/* Data Table — columns derived dynamically from data, sortable */}
      {(() => {
        const columns = industry.columns ?? deriveColumns(data.records);

        // Sort records if a sort column is active
        const sortedRecords = sort
          ? [...data.records].sort((a, b) => {
              const av = a[sort.key];
              const bv = b[sort.key];
              if (av === bv) return 0;
              if (av === null || av === undefined) return 1;
              if (bv === null || bv === undefined) return -1;
              const cmp = typeof av === "number" && typeof bv === "number"
                ? av - bv
                : String(av).localeCompare(String(bv));
              return sort.dir === "asc" ? cmp : -cmp;
            })
          : data.records;

        const handleSort = (key: string) => {
          setSort((prev) =>
            prev?.key === key
              ? prev.dir === "asc"
                ? { key, dir: "desc" }
                : null // third click clears sort
              : { key, dir: "asc" }
          );
        };

        return (
          <div className={`overflow-x-auto rounded-lg border ${darkMode ? "border-gray-800" : "border-gray-200"}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={darkMode ? "bg-gray-900/50" : "bg-gray-50"}>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}>#</th>
                  {columns.map((col) => (
                    <th key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      } ${darkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sort?.key === col.key ? (
                          <span className="text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>
                        ) : (
                          <span className={`text-[10px] opacity-0 group-hover:opacity-30 ${darkMode ? "text-gray-600" : "text-gray-300"}`}>▼</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? "divide-gray-800/50" : "divide-gray-100"}`}>
                {sortedRecords.map((record, idx) => (
                  <tr key={idx} className={`transition-colors ${
                    darkMode ? "hover:bg-gray-900/30" : "hover:bg-gray-50"
                  }`}>
                    <td className={`px-4 py-3 font-mono text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                      {idx + 1}
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        {col.format === "badge" ? (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                            badgeColor(String(record[col.key] ?? ""), darkMode)
                          }`}>
                            {String(record[col.key] ?? "—")}
                          </span>
                        ) : (
                          <span className={
                            col.format
                              ? `font-mono ${darkMode ? "text-gray-200" : "text-gray-800"}`
                              : darkMode ? "text-gray-300" : "text-gray-700"
                          }>
                            {formatCell(record[col.key], col.format)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Footer */}
      <div className={`flex items-center justify-between text-xs pt-2 ${
        darkMode ? "text-gray-600" : "text-gray-400"
      }`}>
        <span>{data.records.length} records activated</span>
        <span>Fivetran &rarr; Snowflake &rarr; dbt &rarr; Activation</span>
      </div>
    </div>
  );
}
