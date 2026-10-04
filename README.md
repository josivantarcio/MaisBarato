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

### 1. Banco de dados (Supabase local, precisa de Docker)
```bash
npx supabase start          # sobe Postgres + Auth + API e aplica supabase/migrations e seed.sql
npx supabase status         # mostra a URL e a chave "Publishable"
```

### 2. App
```bash
cd app
npm install
cp .env.example .env.local  # preencha com a URL e a chave publishable
npx expo start
```
No celular, use o **IP da sua máquina na rede** (ex.: `http://192.168.0.15:54321`) em vez de `127.0.0.1`.
Instale o app **Expo Go** no celular e leia o QR Code do terminal (mesma rede Wi-Fi, ou `npx expo start --tunnel`).

Crie uma conta na tela inicial e escaneie um produto. Produtos de exemplo: `7890000000011` (café),
`7890000000028` (arroz), `7890000000035` (leite). Produtos reais são buscados no Open Food Facts.

### Supabase na nuvem
```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push --include-seed
```
Depois troque a URL e a chave no `app/.env.local` pelas do projeto na nuvem.
