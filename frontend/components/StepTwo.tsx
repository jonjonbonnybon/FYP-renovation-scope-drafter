"use client";

import React, { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Room } from "@/app/page";

interface StepTwoProps {
  doneRooms: Room[];
  grandTotal: number;
  setScopeField: (
    roomId: string,
    itemIndex: number,
    field: "category" | "description" | "quantity" | "unit" | "unit_cost",
    value: any
  ) => void;
}

export default function StepTwo({
  doneRooms,
  grandTotal,
  setScopeField,
}: StepTwoProps) {
  return (
    <>
      {/* ───── SCOPE OF WORK TABLE (all rooms) ───── */}
      {/* staggered reveal for the label to make it pop */}
      <p 
        className="anim-fade-up text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--warm-gray)] pt-2"
        style={{ animationDelay: "0.1s" }}
      >
        Step 2 — Edit & approve scope
      </p>

      {/* Main container card using standard dark design tokens */}
      <Card 
        className="anim-fade-up bg-[var(--card)] border-[var(--border)] mt-4" 
        style={{ animationDelay: "0.2s" }}
      >
        <CardHeader className="border-b border-[var(--border)]">
          <CardTitle 
            style={{ fontFamily: 'var(--font-heading)' }} 
            className="text-[var(--parchment)]"
          >
            Final Scope of Work
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              {/* Amber-tinted header */}
              <TableRow className="bg-[var(--amber)]/10 border-b border-[var(--border)] hover:bg-[var(--amber)]/10 transition-colors">
                <TableHead className="w-[120px] text-[var(--amber)] font-medium text-xs uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-[var(--amber)] font-medium text-xs uppercase tracking-wider">Description</TableHead>
                <TableHead className="w-[90px] text-center text-[var(--amber)] font-medium text-xs uppercase tracking-wider">
                  Qty
                </TableHead>
                <TableHead className="w-[90px] text-[var(--amber)] font-medium text-xs uppercase tracking-wider">Unit</TableHead>
                <TableHead className="w-[100px] text-right text-[var(--amber)] font-medium text-xs uppercase tracking-wider">
                  Unit Cost (S$)
                </TableHead>
                <TableHead className="w-[120px] text-right text-[var(--amber)] font-medium text-xs uppercase tracking-wider">
                  Total Cost (S$)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doneRooms.map((room) => (
                <Fragment key={room.id}>
                  {/* Room group header visually separates different rooms */}
                  <TableRow className="bg-[var(--charcoal-light)] hover:bg-[var(--charcoal-light)] border-b border-[var(--border)]">
                    <TableCell
                      colSpan={6}
                      className="font-semibold text-sm text-[var(--parchment)] py-2"
                    >
                      {room.name}
                    </TableCell>
                  </TableRow>

                  {/* Editable scope rows - inline editing pattern avoids jarring popups */}
                  {room.editableResult!.scope_of_work.map(
                    (item, idx) => (
                      <TableRow 
                        key={idx}
                        className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
                      >
                        <TableCell className="font-medium text-sm text-[var(--warm-text)]">
                          {item.category}
                        </TableCell>
                        <TableCell>
                          {/* styled to look inline with the cell, not like a standalone form field */}
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              setScopeField(
                                room.id,
                                idx,
                                "description",
                                e.target.value
                              )
                            }
                            className="h-8 text-sm border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] focus-visible:ring-1 focus-visible:ring-[var(--amber)]/50"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              setScopeField(
                                room.id,
                                idx,
                                "quantity",
                                e.target.value
                              )
                            }
                            className="h-8 w-16 text-center text-sm border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] mx-auto focus-visible:ring-1 focus-visible:ring-[var(--amber)]/50"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={item.unit}
                            onChange={(e) =>
                              setScopeField(
                                room.id,
                                idx,
                                "unit",
                                e.target.value
                              )
                            }
                            className="h-8 w-20 text-sm border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] focus-visible:ring-1 focus-visible:ring-[var(--amber)]/50"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) =>
                              setScopeField(
                                room.id,
                                idx,
                                "unit_cost",
                                e.target.value
                              )
                            }
                            className="h-8 w-20 text-right text-sm border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] ml-auto focus-visible:ring-1 focus-visible:ring-[var(--amber)]/50"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm text-[var(--parchment)] font-medium">
                          S${item.total_cost.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </Fragment>
              ))}

              {/* Grand total row at the very bottom with amber accent */}
              <TableRow className="border-t-2 border-[var(--amber)]/40 hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="text-right font-semibold text-sm text-[var(--warm-text)]"
                >
                  Grand Total
                </TableCell>
                <TableCell className="text-right font-bold text-base text-[var(--amber)]">
                  S${grandTotal.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
