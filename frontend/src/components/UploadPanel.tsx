"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { api, type UploadResult } from "@/lib/api";

interface Props {
  onSuccess: (result: UploadResult) => void;
  sensitivity: number;
  onSensitivityChange: (v: number) => void;
}

export function UploadPanel({ onSuccess, sensitivity, onSensitivityChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file.");
      return;
    }
    setFile(f);
    setError(null);
    setDone(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.upload(file, sensitivity);
      setDone(true);
      onSuccess(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all
          ${isDragging
            ? "border-blue-400 bg-blue-500/10"
            : file
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-[#1f2937] bg-[#161b27] hover:border-slate-600 hover:bg-white/5"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onInputChange}
        />

        {file ? (
          <>
            <FileText className="h-10 w-10 text-emerald-400" />
            <div className="text-center">
              <p className="text-sm font-semibold text-emerald-400">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB · Click to change
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-slate-500" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-300">
                Drop CSV here or click to browse
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Format: timestamp, sensor_1, sensor_2, … sensor_n
              </p>
            </div>
          </>
        )}
      </div>

      {/* Sensitivity */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-slate-400">
            Anomaly Sensitivity
          </label>
          <span className="text-xs font-mono text-blue-400">
            {(sensitivity * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min={0.01}
          max={0.49}
          step={0.01}
          value={sensitivity}
          onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-[#1f2937] accent-blue-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
          <span>Low (1%)</span>
          <span>High (49%)</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all
          ${!file || uploading
            ? "cursor-not-allowed bg-slate-800 text-slate-600"
            : done
            ? "bg-emerald-600 text-white hover:bg-emerald-500"
            : "bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]"
          }`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing…
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Analysis Complete — Upload New File
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload &amp; Analyze
          </>
        )}
      </button>
    </div>
  );
}
