"use client";

import { useState, useRef, useCallback } from "react";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── CSV parsing ────────────────────────────────────────────────────────────

function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return tabs >= commas ? "\t" : ",";
}

function parseCSVLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") return line.split("\t");

  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (line[i] === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

type ParsedCSV = {
  headers: string[];
  rows: Record<string, string>[];
};

function parseCSV(text: string): ParsedCSV | { error: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { error: "Die Datei enthält zu wenig Zeilen." };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter).map((h) => h.trim());

  const rows = lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line, delimiter);
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.trim() ?? "";
      });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v));

  return { headers, rows };
}

function findCol(headers: string[], name: string): string | undefined {
  return headers.find((h) => h.toLowerCase() === name.toLowerCase());
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ColumnConfig = {
  account: boolean;
  payee: boolean;
  notes: boolean;
  category: boolean;
};

type ImportRow = {
  date: string;
  amount: string;
  account: string;
  payee: string;
  notes: string;
  category: string;
};

type ImportResult = {
  transactions: number;
  categories: number;
  payees: number;
  errors: string[];
};

type Step = "upload" | "configure" | "result";

// ─── Main dialog ─────────────────────────────────────────────────────────────

type CsvImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackerId: string;
  onSuccess: () => void;
};

export function CsvImportDialog({
  open,
  onOpenChange,
  trackerId,
  onSuccess,
}: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnConfig>({
    account: true,
    payee: true,
    notes: true,
    category: true,
  });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setParsed(null);
    setParseError(null);
    setColumns({ account: true, payee: true, notes: true, category: true });
    setImporting(false);
    setResult(null);
  }

  function handleOpenChange(value: boolean) {
    if (!value) reset();
    onOpenChange(value);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const outcome = parseCSV(text);

      if ("error" in outcome) {
        setParseError(outcome.error);
        return;
      }

      const missing = [
        !findCol(outcome.headers, "Date") && "Date",
        !findCol(outcome.headers, "Amount") && "Amount",
      ].filter(Boolean);

      if (missing.length > 0) {
        setParseError(`Fehlende Pflicht-Spalten: ${missing.join(", ")}`);
        return;
      }

      setParsed(outcome);
      setParseError(null);
      setColumns({
        account: Boolean(findCol(outcome.headers, "Account")),
        payee: Boolean(findCol(outcome.headers, "Payee")),
        notes: Boolean(findCol(outcome.headers, "Notes")),
        category: Boolean(findCol(outcome.headers, "Category")),
      });
      setStep("configure");
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);

    const dateCol = findCol(parsed.headers, "Date")!;
    const amountCol = findCol(parsed.headers, "Amount")!;
    const accountCol = columns.account ? findCol(parsed.headers, "Account") : undefined;
    const payeeCol = columns.payee ? findCol(parsed.headers, "Payee") : undefined;
    const notesCol = columns.notes ? findCol(parsed.headers, "Notes") : undefined;
    const categoryCol = columns.category ? findCol(parsed.headers, "Category") : undefined;

    const rows: ImportRow[] = parsed.rows.map((row) => ({
      date: row[dateCol] ?? "",
      amount: row[amountCol] ?? "",
      account: accountCol ? (row[accountCol] ?? "") : "",
      payee: payeeCol ? (row[payeeCol] ?? "") : "",
      notes: notesCol ? (row[notesCol] ?? "") : "",
      category: categoryCol ? (row[categoryCol] ?? "") : "",
    }));

    try {
      const response = await fetch(`/api/trackers/${trackerId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, columns }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import fehlgeschlagen");
      }

      setResult(data.result);
      setStep("result");
      onSuccess();
    } catch (error) {
      setResult({
        transactions: 0,
        categories: 0,
        payees: 0,
        errors: [error instanceof Error ? error.message : "Unbekannter Fehler"],
      });
      setStep("result");
    } finally {
      setImporting(false);
    }
  }

  const hasColumn = useCallback(
    (name: string) => Boolean(parsed && findCol(parsed.headers, name)),
    [parsed],
  );

  const visiblePreviewColumns = [
    { key: "Date", label: "Datum" },
    { key: "Amount", label: "Betrag" },
    ...(columns.account && hasColumn("Account") ? [{ key: "Account", label: "Konto" }] : []),
    ...(columns.payee && hasColumn("Payee") ? [{ key: "Payee", label: "Einzahler" }] : []),
    ...(columns.notes && hasColumn("Notes") ? [{ key: "Notes", label: "Notiz" }] : []),
    ...(columns.category && hasColumn("Category") ? [{ key: "Category", label: "Kategorie" }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>CSV-Import (Actual Budget)</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Wähle eine exportierte CSV-Datei aus Actual Budget aus."}
            {step === "configure" &&
              `${parsed?.rows.length ?? 0} Zeilen erkannt – wähle die zu importierenden Spalten.`}
            {step === "result" && "Import abgeschlossen."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {step === "upload" && (
            <UploadStep
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              parseError={parseError}
            />
          )}

          {step === "configure" && parsed && (
            <ConfigureStep
              parsed={parsed}
              columns={columns}
              onColumnsChange={setColumns}
              hasColumn={hasColumn}
              visiblePreviewColumns={visiblePreviewColumns}
            />
          )}

          {step === "result" && result && <ResultStep result={result} />}
        </div>

        <DialogFooter className="p-6 pt-0">
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
          )}

          {step === "configure" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setParsed(null);
                }}
              >
                Zurück
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing
                  ? "Importiert…"
                  : `${parsed?.rows.length ?? 0} Zeilen importieren`}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step components ─────────────────────────────────────────────────────────

function UploadStep({
  fileInputRef,
  onFileChange,
  parseError,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  parseError: string | null;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-8 text-center transition-colors hover:border-border hover:bg-muted/40"
      >
        <div className="rounded-xl bg-muted p-3">
          <Upload className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">CSV-Datei auswählen</p>
          <p className="text-xs text-muted-foreground">Actual Budget Export (.csv)</p>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={onFileChange}
      />

      {parseError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{parseError}</p>
        </div>
      )}

      <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">Erwartete Spalten:</p>
        <p>Account, Date, Payee, Notes, Category, Amount</p>
        <p className="opacity-70">Split_Amount und Cleared werden ignoriert.</p>
      </div>
    </div>
  );
}

function ConfigureStep({
  parsed,
  columns,
  onColumnsChange,
  hasColumn,
  visiblePreviewColumns,
}: {
  parsed: ParsedCSV;
  columns: ColumnConfig;
  onColumnsChange: (c: ColumnConfig) => void;
  hasColumn: (name: string) => boolean;
  visiblePreviewColumns: { key: string; label: string }[];
}) {
  const previewRows = parsed.rows.slice(0, 5);

  const toggleOptions = [
    { key: "account" as const, label: "Konto (Account)", col: "Account" },
    { key: "payee" as const, label: "Einzahler (Payee)", col: "Payee" },
    { key: "notes" as const, label: "Notiz (Notes)", col: "Notes" },
    { key: "category" as const, label: "Kategorie (Category)", col: "Category" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-3 text-sm font-medium">Spalten importieren</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {toggleOptions.map(({ key, label, col }) => (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5",
                !hasColumn(col) && "opacity-40",
              )}
            >
              <Label htmlFor={`col-${key}`} className="cursor-pointer text-sm">
                {label}
              </Label>
              <Switch
                id={`col-${key}`}
                checked={columns[key] && hasColumn(col)}
                disabled={!hasColumn(col)}
                onCheckedChange={(value) =>
                  onColumnsChange({ ...columns, [key]: value })
                }
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Datum und Betrag werden immer importiert.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Vorschau (erste {Math.min(5, previewRows.length)} von {parsed.rows.length}{" "}
          Zeilen)
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                {visiblePreviewColumns.map((col) => (
                  <TableHead key={col.key} className="whitespace-nowrap text-xs">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, i) => {
                const amountCol = findCol(parsed.headers, "Amount")!;
                const rawAmount = parseFloat(
                  row[amountCol]?.replace(",", ".") || "0",
                );
                const isNegative = rawAmount < 0;

                return (
                  <TableRow key={i}>
                    {visiblePreviewColumns.map((col) => {
                      const actualCol = findCol(parsed.headers, col.key)!;
                      const value = row[actualCol] ?? "";

                      if (col.key === "Amount") {
                        return (
                          <TableCell
                            key={col.key}
                            className="whitespace-nowrap text-xs"
                          >
                            <span
                              className={cn(
                                "font-medium",
                                isNegative ? "text-rose-600" : "text-emerald-600",
                              )}
                            >
                              {value}
                            </span>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell
                          key={col.key}
                          className="max-w-32 truncate text-xs"
                        >
                          {value || (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function ResultStep({ result }: { result: ImportResult }) {
  const allFailed = result.transactions === 0 && result.errors.length > 0;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4",
          allFailed
            ? "border-destructive/30 bg-destructive/5"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20",
        )}
      >
        {allFailed ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {allFailed
              ? "Import fehlgeschlagen"
              : `${result.transactions} Transaktion${result.transactions !== 1 ? "en" : ""} importiert`}
          </p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {result.categories > 0 && (
              <p>{result.categories} neue Kategorie{result.categories !== 1 ? "n" : ""} angelegt</p>
            )}
            {result.payees > 0 && (
              <p>{result.payees} neue{result.payees !== 1 ? "" : "r"} Einzahler angelegt</p>
            )}
            {result.errors.length > 0 && (
              <p className="text-destructive">
                {result.errors.length} Zeile{result.errors.length !== 1 ? "n" : ""} übersprungen
              </p>
            )}
          </div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Übersprungene Zeilen</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            {result.errors.map((error, i) => (
              <p key={i} className="text-xs text-destructive">
                {error}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
