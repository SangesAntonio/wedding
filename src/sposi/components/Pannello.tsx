import type { ReactNode } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/sposi/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/sposi/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/sposi/ui/dialog";
import { useLargo } from "../hooks/useMediaQuery";
import { cn } from "@/sposi/lib/utils";

interface Props {
  aperto: boolean;
  onChiudi: () => void;
  titolo: ReactNode;
  descrizione?: ReactNode;
  children: ReactNode;
  piede?: ReactNode;
  className?: string;
}

/** Dettaglio: pannello laterale da tablet in su, foglio dal basso su telefono. */
export function PannelloLaterale({ aperto, onChiudi, titolo, descrizione, children, piede, className }: Props) {
  const largo = useLargo();
  if (largo)
    return (
      <Sheet open={aperto} onOpenChange={(o) => !o && onChiudi()}>
        <SheetContent className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-lg", className)}>
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="font-serif text-2xl font-medium">{titolo}</SheetTitle>
            {descrizione && <SheetDescription asChild><div>{descrizione}</div></SheetDescription>}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {piede && <div className="border-t px-6 py-4">{piede}</div>}
        </SheetContent>
      </Sheet>
    );
  return (
    <Drawer open={aperto} onOpenChange={(o) => !o && onChiudi()}>
      <DrawerContent className={cn("max-h-[92dvh]", className)}>
        <DrawerHeader className="border-b text-left">
          <DrawerTitle className="font-serif text-2xl font-medium">{titolo}</DrawerTitle>
          {descrizione && <DrawerDescription asChild><div>{descrizione}</div></DrawerDescription>}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {piede && <div className="border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{piede}</div>}
      </DrawerContent>
    </Drawer>
  );
}

/** Finestra per moduli: centrata da tablet in su, foglio dal basso su telefono. */
export function Finestra({ aperto, onChiudi, titolo, descrizione, children, piede, className }: Props) {
  const largo = useLargo();
  if (largo)
    return (
      <Dialog open={aperto} onOpenChange={(o) => !o && onChiudi()}>
        <DialogContent className={cn("flex max-h-[88vh] flex-col gap-0 p-0 sm:max-w-lg", className)}>
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="font-serif text-2xl font-medium">{titolo}</DialogTitle>
            {descrizione && <DialogDescription>{descrizione}</DialogDescription>}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {piede && <div className="flex justify-end gap-2 border-t px-6 py-4">{piede}</div>}
        </DialogContent>
      </Dialog>
    );
  return (
    <Drawer open={aperto} onOpenChange={(o) => !o && onChiudi()} repositionInputs={false}>
      <DrawerContent className={cn("max-h-[94dvh]", className)}>
        <DrawerHeader className="border-b text-left">
          <DrawerTitle className="font-serif text-2xl font-medium">{titolo}</DrawerTitle>
          {descrizione && <DrawerDescription>{descrizione}</DrawerDescription>}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {piede && <div className="flex justify-end gap-2 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{piede}</div>}
      </DrawerContent>
    </Drawer>
  );
}
