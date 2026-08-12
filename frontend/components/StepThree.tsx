"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Room } from "@/app/page";

interface StepThreeProps {
  doneRooms: Room[];
  grandTotal: number;
  exportPdf: () => void;
  previewPdf: () => void;
}

export default function StepThree({
  doneRooms,
  grandTotal,
  exportPdf,
  previewPdf,
}: StepThreeProps) {
  return (
    <>
      {/* ───── STEP 3: PDF PREVIEW ───── */}
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400 pt-2">
        Step 3 — Document preview
      </p>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>PDF Preview</CardTitle>
        </CardHeader>
        <CardContent className="py-6 flex justify-center">
          {/* A4 paper mock */}
          <div className="w-full max-w-[680px] bg-white border border-stone-200 shadow-lg rounded-sm px-12 py-10 space-y-8 text-stone-800">
            {/* document header */}
            <div className="border-b border-stone-300 pb-5 space-y-1">
              <h2 className="text-xl font-bold tracking-tight">
                Renovation Scope of Work
              </h2>
              <p className="text-xs text-stone-500">
                Generated on{" "}
                {new Date().toLocaleDateString("en-SG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-stone-500">
                {doneRooms.length} room{doneRooms.length !== 1 && "s"}{" "}
                · {doneRooms.reduce((n, r) => n + (r.editableResult?.scope_of_work.length ?? 0), 0)} line items
              </p>
            </div>

            {/* per-room sections */}
            {doneRooms.map((room) => (
              <div key={room.id} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                  {room.name}
                </h3>

                {/* transcription excerpt */}
                {room.editableResult?.raw_transcription && (
                  <p className="text-xs text-stone-400 italic leading-relaxed">
                    &ldquo;{room.editableResult.raw_transcription}&rdquo;
                  </p>
                )}

                {/* mini scope table */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="text-left py-1.5 font-medium w-[90px]">
                        Category
                      </th>
                      <th className="text-left py-1.5 font-medium">
                        Description
                      </th>
                      <th className="text-center py-1.5 font-medium w-[50px]">
                        Qty
                      </th>
                      <th className="text-left py-1.5 font-medium w-[50px]">
                        Unit
                      </th>
                      <th className="text-right py-1.5 font-medium w-[70px]">
                        Unit Cost
                      </th>
                      <th className="text-right py-1.5 font-medium w-[80px]">
                        Total Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.editableResult?.scope_of_work.map(
                      (item, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-stone-100"
                        >
                          <td className="py-1.5 text-stone-600">
                            {item.category}
                          </td>
                          <td className="py-1.5">
                            {item.description}
                          </td>
                          <td className="py-1.5 text-center">
                            {item.quantity}
                          </td>
                          <td className="py-1.5 text-stone-500">
                            {item.unit}
                          </td>
                          <td className="py-1.5 text-right">
                            S${item.unit_cost.toLocaleString()}
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            S${item.total_cost.toLocaleString()}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ))}

            {/* grand total */}
            <div className="border-t-2 border-stone-400 pt-3 flex justify-between items-baseline">
              <span className="text-sm font-semibold text-stone-600">
                Grand Total
              </span>
              <span className="text-lg font-bold text-stone-900">
                S${grandTotal.toLocaleString()}
              </span>
            </div>

            {/* fine print */}
            <p className="text-[10px] text-stone-400 leading-relaxed">
              This document is a draft scope of work. All quantities,
              descriptions, and costs should be verified by a qualified
              professional before use in any contractual agreement.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* export and preview buttons */}
      <div className="pb-10 space-y-3">
        <Button
          size="lg"
          onClick={exportPdf}
          className="w-full py-6 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg rounded-xl cursor-pointer"
        >
          📄 Export to PDF
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={previewPdf}
          className="w-full py-6 text-base font-semibold text-stone-700 border-stone-300 hover:bg-stone-100 shadow-sm rounded-xl cursor-pointer"
        >
          👁️ Preview PDF in New Tab
        </Button>
      </div>
    </>
  );
}
