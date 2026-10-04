import * as Location from 'expo-location';

import { Coordenadas } from './geo';

export type Posicao = Coordenadas & { precisaoM: number | null };

export type ResultadoPosicao =
  | { ok: true; posicao: Posicao }
  | { ok: false; motivo: 'negada' | 'indisponivel' };

/** Pede permissão (se preciso) e devolve a posição atual do aparelho. */
export async function obterPosicao(): Promise<ResultadoPosicao> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { ok: false, motivo: 'negada' };
  try {
    // Usa a última posição conhecida se for recente e precisa; é instantâneo.
    const ultima = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 });
    const atual = ultima ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return {
      ok: true,
      posicao: {
        latitude: atual.coords.latitude,
        longitude: atual.coords.longitude,
        precisaoM: atual.coords.accuracy,
      },
    };
  } catch {
    return { ok: false, motivo: 'indisponivel' };
  }
}
