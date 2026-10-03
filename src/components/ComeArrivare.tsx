import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Car, LocateFixed, Navigation, Search, X } from "lucide-react";
import { LUOGO } from "../config";
import { riduciMovimento } from "../lib/calendario";

// Mappe gratuite e senza chiave: OpenFreeMap (tessere), Photon (ricerca indirizzi), OSRM (percorso).
const STILE = "https://tiles.openfreemap.org/styles/liberty";
const DEST: [number, number] = [LUOGO.lng, LUOGO.lat];

interface Risultato {
  label: string;
  sub: string;
  coord: [number, number];
}

interface Percorso {
  durata: number;
  distanza: number;
  da: [number, number];
  daNome: string;
}

const fmtDurata = (s: number) => {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")} min`;
};
const fmtDistanza = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`);

async function cercaIndirizzi(q: string, segnale: AbortSignal): Promise<Risultato[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lat=${LUOGO.lat}&lon=${LUOGO.lng}`;
  const r = await fetch(url, { signal: segnale });
  if (!r.ok) throw new Error("ricerca");
  const j = await r.json();
  return (j.features ?? []).map((f: any) => {
    const p = f.properties ?? {};
    const via = [p.street, p.housenumber].filter(Boolean).join(" ");
    const label = p.name || via || p.city || "Luogo";
    const sub = [p.name && via ? via : null, p.postcode, p.city || p.county, p.country].filter(Boolean).join(", ");
    return { label, sub, coord: f.geometry.coordinates as [number, number] };
  });
}

async function calcolaPercorso(da: [number, number]) {
  const url = `https://router.project-osrm.org/route/v1/driving/${da[0]},${da[1]};${DEST[0]},${DEST[1]}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("percorso");
  const j = await r.json();
  if (j.code !== "Ok" || !j.routes?.length) throw new Error("nessun percorso");
  const route = j.routes[0];
  return { durata: route.duration as number, distanza: route.distance as number, geometria: route.geometry as { type: "LineString"; coordinates: [number, number][] } };
}

function puntoMarker(classe: string, html = "") {
  const el = document.createElement("div");
  el.className = classe;
  el.innerHTML = html;
  return el;
}

export default function ComeArrivare({ onChiudi }: { onChiudi: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const pannello = useRef<HTMLDivElement>(null);
  const mappa = useRef<maplibregl.Map | null>(null);
  const markerPartenza = useRef<maplibregl.Marker | null>(null);
  const [q, setQ] = useState("");
  const [risultati, setRisultati] = useState<Risultato[]>([]);
  const [stato, setStato] = useState<"" | "cerco" | "calcolo" | "localizzo">("");
  const [errore, setErrore] = useState("");
  const [percorso, setPercorso] = useState<Percorso | null>(null);

  // mappa con globo e volo verso il luogo
  useEffect(() => {
    if (!box.current) return;
    const lento = riduciMovimento();
    const m = new maplibregl.Map({
      container: box.current,
      style: STILE,
      center: lento ? DEST : [DEST[0] - 40, DEST[1] + 8],
      zoom: lento ? 14 : 1.2,
      attributionControl: { compact: true },
    });
    mappa.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.on("style.load", () => m.setProjection({ type: "globe" }));
    m.on("load", () => {
      m.addSource("percorso", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "percorso-bordo", type: "line", source: "percorso", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFDF7", "line-width": 9 } });
      m.addLayer({ id: "percorso", type: "line", source: "percorso", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#5E7A63", "line-width": 5 } });
      if (!lento)
        setTimeout(() => m.flyTo({ center: DEST, zoom: 15.2, pitch: 50, bearing: -18, duration: 6500, curve: 1.6, essential: true }), 500);
    });
    new maplibregl.Marker({ element: puntoMarker("pin", '<div class="pin-sposi"><span>A&amp;R</span></div>'), anchor: "bottom" })
      .setLngLat(DEST)
      .setPopup(new maplibregl.Popup({ offset: 36, closeButton: false }).setHTML(`<strong>${LUOGO.nome.replace(/&/g, "&amp;")}</strong><br>${LUOGO.indirizzo}`))
      .addTo(m);
    return () => {
      m.remove();
      mappa.current = null;
    };
  }, []);

  // chiusura con Esc e blocco dello scroll sotto
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onChiudi();
    window.addEventListener("keydown", k);
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prima;
    };
  }, [onChiudi]);

  // ricerca mentre si scrive
  useEffect(() => {
    if (q.trim().length < 3) {
      setRisultati([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setStato("cerco");
      cercaIndirizzi(q.trim(), ctrl.signal)
        .then((r) => {
          setRisultati(r);
          setErrore(r.length ? "" : "Nessun indirizzo trovato. Provate ad aggiungere la città.");
        })
        .catch((e) => e.name !== "AbortError" && setErrore("Ricerca non disponibile in questo momento."))
        .finally(() => setStato(""));
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const traccia = async (da: [number, number], daNome: string) => {
    setRisultati([]);
    setErrore("");
    setStato("calcolo");
    try {
      const r = await calcolaPercorso(da);
      setPercorso({ durata: r.durata, distanza: r.distanza, da, daNome });
      const m = mappa.current;
      if (m) {
        (m.getSource("percorso") as GeoJSONSource | undefined)?.setData({ type: "Feature", properties: {}, geometry: r.geometria });
        markerPartenza.current?.remove();
        markerPartenza.current = new maplibregl.Marker({ element: puntoMarker("pin-partenza") }).setLngLat(da).addTo(m);
        const b = new maplibregl.LngLatBounds();
        r.geometria.coordinates.forEach((c) => b.extend(c));
        const stretto = window.innerWidth < 760;
        // il pannello cresce quando compare il riquadro del percorso: ~90px in più
        const hPannello = (pannello.current?.offsetHeight ?? 300) + 90;
        const wPannello = (pannello.current?.offsetWidth ?? 370) + 50;
        m.fitBounds(b, {
          padding: stretto ? { top: 80, bottom: Math.min(hPannello, window.innerHeight * 0.62) + 30, left: 40, right: 40 } : { top: 70, bottom: 70, left: wPannello, right: 70 },
          pitch: 0,
          bearing: 0,
          duration: riduciMovimento() ? 0 : 2200,
          maxZoom: 15,
        });
      }
    } catch {
      setErrore("Non riesco a calcolare il percorso in auto da lì. Usate i pulsanti qui sotto per aprire il navigatore.");
      setPercorso(null);
    } finally {
      setStato("");
    }
  };

  const usaPosizione = () => {
    if (!navigator.geolocation) {
      setErrore("Il dispositivo non condivide la posizione.");
      return;
    }
    setStato("localizzo");
    setErrore("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setQ("");
        traccia([p.coords.longitude, p.coords.latitude], "La vostra posizione");
      },
      () => {
        setStato("");
        setErrore("Posizione non disponibile: controllate i permessi o scrivete l'indirizzo di partenza.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };

  const da = percorso ? `${percorso.da[1]},${percorso.da[0]}` : "";
  const dest = encodeURIComponent(`${LUOGO.nome}, ${LUOGO.indirizzo}`);
  const linkGoogle = `https://www.google.com/maps/dir/?api=1&destination=${dest}${da ? `&origin=${da}` : ""}`;
  const linkApple = `https://maps.apple.com/?daddr=${dest}${da ? `&saddr=${da}` : ""}`;
  const linkWaze = `https://waze.com/ul?q=${dest}&navigate=yes`;

  return (
    <div className="mappa-scena" role="dialog" aria-modal="true" aria-label="Come arrivare">
      <div ref={box} className="mappa" />
      <button className="mappa-chiudi" onClick={onChiudi} aria-label="Chiudi la mappa">
        <X size={20} />
      </button>
      <div className="mappa-pannello" ref={pannello}>
        <p className="etichetta">Come arrivare</p>
        <p className="mappa-luogo">{LUOGO.nome}</p>
        <p className="mappa-indirizzo">{LUOGO.indirizzo}</p>

        <div className="mappa-cerca">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Da dove partite? Via, città…"
            aria-label="Indirizzo di partenza"
            autoComplete="street-address"
            enterKeyHint="search"
          />
          {q && (
            <button className="mappa-x" onClick={() => setQ("")} aria-label="Cancella">
              <X size={14} />
            </button>
          )}
        </div>
        {risultati.length > 0 && (
          <ul className="mappa-risultati" role="listbox">
            {risultati.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setQ(r.label);
                    traccia(r.coord, r.label);
                  }}
                >
                  <span className="n">{r.label}</span>
                  <span className="s">{r.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="btn btn-chiaro btn-pieno" onClick={usaPosizione} disabled={stato === "localizzo"}>
          <LocateFixed size={16} /> {stato === "localizzo" ? "Cerco la posizione…" : "Usa la mia posizione"}
        </button>

        {stato === "calcolo" && <p className="aiuto">Calcolo il percorso…</p>}
        {errore && <p className="aiuto errore">{errore}</p>}

        {percorso && stato !== "calcolo" && (
          <div className="mappa-percorso anim-entra">
            <Car size={20} />
            <div>
              <p className="t">
                {fmtDurata(percorso.durata)} <span>· {fmtDistanza(percorso.distanza)}</span>
              </p>
              <p className="d">In auto da {percorso.daNome}, senza traffico</p>
            </div>
          </div>
        )}

        <p className="sotto-etichetta">Apri nel navigatore</p>
        <div className="mappa-app">
          <a href={linkGoogle} target="_blank" rel="noopener">
            <Navigation size={14} /> Google Maps
          </a>
          <a href={linkApple} target="_blank" rel="noopener">
            Apple Mappe
          </a>
          <a href={linkWaze} target="_blank" rel="noopener">
            Waze
          </a>
        </div>
      </div>
    </div>
  );
}
