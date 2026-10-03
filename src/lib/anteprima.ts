// Modalità anteprima: l'area sposi mostra l'invito in un riquadro (?anteprima) e gli manda le
// impostazioni non ancora salvate. In anteprima non si salva nulla.
export const IN_ANTEPRIMA = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("anteprima") && window.parent !== window;

export interface MessaggioAnteprima {
  tipo: "invito-anteprima";
  config: unknown;
}
