"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ImportResult {
  success: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const EXPECTED_COLUMNS = [
  "ランキング",
  "予約組数",
  "氏（アア）",
  "名（アア）",
  "氏（漢字）",
  "名（漢字）",
  "電話",
  "Eメール",
  "性別",
  "総来店回数",
  "期間内来店回数",
  "次回の来店",
  "前回の来店",
  "営業担当",
  "顧客タグ",
];

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    // Preview first 5 rows
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.slice(0, 6).map((line) => {
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            current += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ",") {
            cols.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
      }
      cols.push(current.trim());
      return cols;
    });
    setPreview(rows);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "インポートに失敗しました");
      } else {
        setResult(data);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">CSVインポート</h1>
      <p className="text-sm text-muted-foreground mb-6">
        TableCheckからダウンロードした顧客CSVファイルをインポートします。
        電話番号・メールで既存顧客を照合し、新規作成または更新を行います。
      </p>

      {/* File Upload */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium">CSVファイルを選択</label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            <div className="text-xs text-muted-foreground">
              期待される列: {EXPECTED_COLUMNS.join(", ")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">プレビュー（先頭5行）</h2>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b">
                    {preview[0]?.map((col, i) => (
                      <th key={i} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, ri) => (
                    <tr key={ri} className="border-b">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1 whitespace-nowrap">
                          {cell || <span className="text-muted-foreground">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {file && !result && (
        <div className="flex gap-3 mb-6">
          <Button onClick={handleImport} disabled={loading}>
            {loading ? "インポート中..." : "インポート実行"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            キャンセル
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold mb-3">インポート結果</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{result.totalRows}</div>
                <div className="text-xs text-muted-foreground">総行数</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="text-2xl font-bold text-green-600">{result.created}</div>
                <div className="text-xs text-muted-foreground">新規作成</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
                <div className="text-xs text-muted-foreground">更新</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                <div className="text-xs text-muted-foreground">スキップ</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="text-xs text-destructive space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Button variant="outline" onClick={handleReset}>
                別のファイルをインポート
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
