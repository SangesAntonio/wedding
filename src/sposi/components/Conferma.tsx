import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/sposi/ui/alert-dialog";
import { buttonVariants } from "@/sposi/ui/button";

interface Domanda {
  titolo: string;
  testo?: ReactNode;
  conferma?: string;
  distruttiva?: boolean;
}

const Ctx = createContext<(d: Domanda) => Promise<boolean>>(() => Promise.resolve(false));

/** `const chiedi = useConferma(); if (await chiedi({ titolo: "Revocare?" })) …` */
export const useConferma = () => useContext(Ctx);

export function ConfermaProvider({ children }: { children: ReactNode }) {
  const [domanda, setDomanda] = useState<Domanda | null>(null);
  const risolvi = useRef<(v: boolean) => void>(() => {});
  const chiedi = useCallback(
    (d: Domanda) =>
      new Promise<boolean>((ok) => {
        risolvi.current = ok;
        setDomanda(d);
      }),
    [],
  );
  const chiudi = (v: boolean) => {
    risolvi.current(v);
    setDomanda(null);
  };
  return (
    <Ctx.Provider value={chiedi}>
      {children}
      <AlertDialog open={!!domanda} onOpenChange={(o) => !o && chiudi(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{domanda?.titolo}</AlertDialogTitle>
            {domanda?.testo && <AlertDialogDescription>{domanda.testo}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => chiudi(false)}>Annulla</AlertDialogCancel>
            <AlertDialogAction className={domanda?.distruttiva ? buttonVariants({ variant: "destructive" }) : undefined} onClick={() => chiudi(true)}>
              {domanda?.conferma ?? "Conferma"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}
