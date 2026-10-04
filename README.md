# MaisBarato

Aplicativo móvel colaborativo para comparar preços de supermercado.
Você aponta a câmera para o código de barras e vê na hora: foto, descrição, preço
e o histórico de preços daquele produto em cada local, com o mais barato em destaque.

> Status: fase de concepção. Veja o [Diário de Bordo](DIARIO_DE_BORDO.md) e o [MEMORY.md](MEMORY.md).

## Visão
1. **Agora:** cadastro + escanear código de barras + registrar/consultar preços.
2. **Depois:** mais pessoas contribuindo com preços (crowdsourcing).
3. **Futuro:** lista de compras que mostra onde cada item está mais barato; rede social de menor preço por localização.

## Rodando o protótipo
```bash
cd app
npm install
npx expo start
```
Instale o app **Expo Go** no celular (Play Store / App Store) e leia o QR Code que aparece no terminal.
O celular e o computador precisam estar na mesma rede Wi-Fi (ou use `npx expo start --tunnel`).

Códigos de exemplo com histórico (dados fictícios): `7890000000011` (café), `7890000000028` (arroz), `7890000000035` (leite).
Produtos reais são buscados no Open Food Facts; você pode registrar preços para eles.
