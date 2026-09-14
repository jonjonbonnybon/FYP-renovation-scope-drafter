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
      <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--warm-gray)] pt-2 anim-fade-up">
        Step 3 — Document preview
      </p>

      {/* Wrapping the PDF preview in a dark themed card.
          See Tailwind docs on borders & backgrounds: https://tailwindcss.com/docs/background-color */}
      <Card className="bg-[var(--card)] border-[var(--border)] anim-fade-up" style={{ animationDelay: '100ms' }}>
        <CardHeader className="border-b border-[var(--border)]">
          <CardTitle className="text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
            PDF Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 flex justify-center">
          {/* A4 paper mock - uses a warm parchment paper look sitting on the dark surface.
              The heavy drop shadow helps it pop off the dark background. */}
          <div className="w-full max-w-[680px] bg-[var(--parchment)] text-[#2a2520] border border-[var(--parchment-dim)] shadow-2xl shadow-black/30 rounded-sm px-12 py-10 space-y-8">
            {/* document header */}
            <div className="border-b border-[#c4b99a] pb-5 space-y-1">
              <h2 
                className="text-xl font-bold tracking-tight text-[#1a1612]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Renovation Scope of Work
              </h2>
              <p className="text-xs text-[#7a7060]">
                Generated on{" "}
                {/* using toLocaleDateString for localized formatting as per MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString */}
                {new Date().toLocaleDateString("en-SG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-[#7a7060]">
                {doneRooms.length} room{doneRooms.length !== 1 && "s"}{" "}
                · {doneRooms.reduce((n, r) => n + (r.editableResult?.scope_of_work.length ?? 0), 0)} line items
              </p>
            </div>

            {/* per-room sections */}
            {doneRooms.map((room) => (
              <div key={room.id} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#3d3428]">
                  {room.name}
                </h3>

                {/* transcription excerpt */}
                {room.editableResult?.raw_transcription && (
                  <p className="text-xs text-[#8a7e6e] italic leading-relaxed">
                    &ldquo;{room.editableResult.raw_transcription}&rdquo;
                  </p>
                )}

                {/* mini scope table */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#d4cbb8] text-[#7a7060]">
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
                          className="border-b border-[#e6dfd3] text-[#3d3428]"
                        >
                          <td className="py-1.5">
                            {item.category}
                          </td>
                          <td className="py-1.5">
                            {item.description}
                          </td>
                          <td className="py-1.5 text-center">
                            {item.quantity}
                          </td>
                          <td className="py-1.5">
                            {item.unit}
                          </td>
                          <td className="py-1.5 text-right">
                            S${item.unit_cost.toLocaleString()}
                          </td>
                          <td className="py-1.5 text-right font-medium text-[#2a2520]">
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
            <div className="border-t-2 border-[#8a7e6e] pt-3 flex justify-between items-baseline">
              <span className="text-sm font-semibold text-[#3d3428]">
                Grand Total
              </span>
              <span className="text-lg font-bold text-[#1a1612]">
                S${grandTotal.toLocaleString()}
              </span>
            </div>

            {/* fine print */}
            <div className="space-y-2">
              <p className="text-[10px] text-[#9a9080] leading-relaxed">
                This document is a draft scope of work. All quantities,
                descriptions, and costs should be verified by a qualified
                professional before use in any contractual agreement.
              </p>
              <p className="text-[10px] text-[#9a9080] leading-relaxed">
                This scope of work was generated with AI assistance. All quantities, descriptions, and cost estimates are approximate and must be verified by a qualified professional before use in any contract or agreement. The developers of this tool accept no liability for inaccuracies.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* export and preview buttons
          Using transition-colors for smoother hover states */}
      <div className="pb-10 space-y-3 anim-fade-up" style={{ animationDelay: '200ms' }}>
        <Button
          size="lg"
          onClick={exportPdf}
          className="w-full py-6 text-base font-semibold bg-[var(--amber)] text-[var(--charcoal-deep)] hover:bg-[var(--amber-hover)] shadow-lg rounded-xl cursor-pointer transition-colors"
        >
          Export to PDF
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={previewPdf}
          className="w-full py-6 text-base font-semibold bg-transparent border border-[var(--border)] text-[var(--warm-text)] hover:bg-[var(--charcoal-light)] hover:text-[var(--parchment)] shadow-sm rounded-xl cursor-pointer transition-all"
        >
        Preview PDF in New Tab
        </Button>
      </div>
    </>
  );
}
