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
    field: "category" | "description" | "quantity" | "unit" | "cost",
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
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400 pt-2">
        Step 2 — Edit & approve scope
      </p>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Final Scope of Work</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[90px] text-center">
                  Qty
                </TableHead>
                <TableHead className="w-[90px]">Unit</TableHead>
                <TableHead className="w-[120px] text-right">
                  Cost ($)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doneRooms.map((room) => (
                <Fragment key={room.id}>
                  {/* room group header */}
                  <TableRow className="bg-stone-100/80 hover:bg-stone-100/80">
                    <TableCell
                      colSpan={5}
                      className="font-semibold text-sm text-stone-600 py-2"
                    >
                      {room.name}
                    </TableCell>
                  </TableRow>

                  {/* editable scope rows */}
                  {room.editableResult!.scope_of_work.map(
                    (item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm text-stone-700">
                          {item.category}
                        </TableCell>
                        <TableCell>
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
                            className="h-8 text-sm border border-stone-200 bg-white"
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
                            className="h-8 w-16 text-center text-sm border border-stone-200 bg-white mx-auto"
                          />
                        </TableCell>
                        <TableCell className="text-sm text-stone-500">
                          {item.unit}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.cost}
                            onChange={(e) =>
                              setScopeField(
                                room.id,
                                idx,
                                "cost",
                                e.target.value
                              )
                            }
                            className="h-8 w-24 text-right text-sm border border-stone-200 bg-white ml-auto"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </Fragment>
              ))}

              {/* grand total row */}
              <TableRow className="border-t-2 border-stone-300 hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="text-right font-semibold text-sm text-stone-600"
                >
                  Grand Total
                </TableCell>
                <TableCell className="text-right font-bold text-base text-stone-900">
                  ${grandTotal.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
