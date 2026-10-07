"use client";

import React, { useState } from "react";
import { RawOcrData } from "@/lib/types";
import { Search } from "lucide-react";

export function RawOcrViewer({ data }: { data: RawOcrData }) {
  const [filter, setFilter] = useState("");

  const filteredLines = (data.lines || []).filter((line) =>
    line.text.toLowerCase().includes(filter.toLowerCase()) ||
    line.id.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-6 text-xs text-slate-600">
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">OCR Engine</span>
            <span className="font-bold text-slate-900">{data.ocr_engine || "PaddleOCR"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Total Lines</span>
            <span className="font-bold text-slate-900">{data.lines?.length || 0}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Average Confidence</span>
            <span className="font-bold text-teal-700">
              {((data.avg_conf || 1) * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Image Resolution</span>
            <span className="font-bold text-slate-800">
              {data.image_w || "—"} × {data.image_h || "—"} px
            </span>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search OCR text lines..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3 w-16">Line</th>
                <th className="py-3 px-3 w-14">Row</th>
                <th className="py-3 px-3">Extracted Text</th>
                <th className="py-3 px-3 w-28">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No matching OCR lines found
                  </td>
                </tr>
              ) : (
                filteredLines.map((line) => {
                  const confPct = Math.round(line.conf * 100);
                  const isLow = line.conf < 0.75;
                  return (
                    <tr
                      key={line.id}
                      className="hover:bg-teal-50/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-teal-800 font-bold font-mono">{line.id}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{line.row}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-900 font-semibold">{line.text}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                isLow ? "bg-amber-500" : "bg-teal-600"
                              }`}
                              style={{ width: `${confPct}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              isLow ? "text-amber-700" : "text-teal-700"
                            }`}
                          >
                            {confPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
