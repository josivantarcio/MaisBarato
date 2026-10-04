import { Coordenadas, distanciaM } from '../lib/geo';

// Sugestões de mercados reais perto do usuário, vindas do OpenStreetMap (API Overpass, gratuita).

export type LojaOSM = {
  osmId: string;
  nome: string;
  endereco?: string;
  bairro?: string;
  latitude: number;
  longitude: number;
  distanciaM: number;
};

const TIPOS = 'supermarket|convenience|greengrocer|wholesale|butcher|bakery|general|department_store';

export async function buscarMercadosOSM(pos: Coordenadas, raioM = 1500): Promise<LojaOSM[]> {
  const consulta = `[out:json][timeout:15];
nwr["shop"~"^(${TIPOS})$"]["name"](around:${raioM},${pos.latitude},${pos.longitude});
out center tags 60;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MaisBarato/0.1 (prototipo)' },
    body: `data=${encodeURIComponent(consulta)}`,
  });
  if (!resp.ok) throw new Error(`Overpass respondeu ${resp.status}`);
  const json: { elements: OverpassElemento[] } = await resp.json();

  return json.elements
    .map((e): LojaOSM | undefined => {
      const latitude = e.lat ?? e.center?.lat;
      const longitude = e.lon ?? e.center?.lon;
      if (latitude === undefined || longitude === undefined || !e.tags?.name) return undefined;
      const t = e.tags;
      const endereco = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ') || undefined;
      return {
        osmId: `${e.type}/${e.id}`,
        nome: t.name,
        endereco,
        bairro: t['addr:suburb'] ?? t['addr:neighbourhood'],
        latitude,
        longitude,
        distanciaM: distanciaM(pos, { latitude, longitude }),
      };
    })
    .filter((l): l is LojaOSM => !!l)
    .sort((a, b) => a.distanciaM - b.distanciaM);
}

type OverpassElemento = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
