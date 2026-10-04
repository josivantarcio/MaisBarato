import { decode } from 'base64-arraybuffer';
import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

export type FotoTirada = { uri: string; base64: string };

/** Abre a câmera, recorta quadrado e reduz para 800 px (fica ~100 KB). undefined = cancelou. */
export async function tirarFoto(): Promise<FotoTirada | undefined | 'sem-permissao'> {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissao.granted) return 'sem-permissao';
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (r.canceled || !r.assets?.[0]) return undefined;
  const imagem = await ImageManipulator.manipulate(r.assets[0].uri).resize({ width: 800, height: null }).renderAsync();
  const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!salva.base64) throw new Error('Falha ao processar a foto');
  return { uri: salva.uri, base64: salva.base64 };
}

/** Envia a foto para o Storage (bucket público "produtos") e devolve a URL pública. */
export async function enviarFotoProduto(ean: string, foto: FotoTirada): Promise<string> {
  const caminho = `${ean}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('produtos')
    .upload(caminho, decode(foto.base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from('produtos').getPublicUrl(caminho).data.publicUrl;
}
