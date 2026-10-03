import { useAzioniUi } from "../azioni-ui";
import { FormInvito } from "./FormInvito";
import { FormPrenotazione } from "./FormPrenotazione";
import { Importa } from "./Importa";
import { Sequenza } from "./Sequenza";

/** Tutte le finestre dei moduli, aperte da qualunque punto dell'area sposi. */
export function Finestre() {
  const { finestra: f, chiudi } = useAzioniUi();
  return (
    <>
      <FormInvito aperto={f?.tipo === "nuovo-invito" || f?.tipo === "modifica-invito"} invito={f?.tipo === "modifica-invito" ? f.invito : undefined} onChiudi={chiudi} />
      <FormPrenotazione aperto={f?.tipo === "prenotazione"} famiglia={f?.tipo === "prenotazione" ? f.famiglia : undefined} onChiudi={chiudi} />
      <Importa aperto={f?.tipo === "importa"} onChiudi={chiudi} />
      <Sequenza aperto={f?.tipo === "sequenza"} scelti={f?.tipo === "sequenza" ? f.inviti : undefined} onChiudi={chiudi} />
    </>
  );
}
