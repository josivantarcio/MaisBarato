# MaisBarato

Aplicativo móvel colaborativo para comparar preços de supermercado.
Você aponta a câmera para o código de barras e vê na hora: foto, descrição, preço
e o histórico de preços daquele produto em cada local, com o mais barato em destaque.

> **Código aberto e procurando colaboradores!** Veja [Como ajudar](#como-ajudar).
>
> *English: MaisBarato is an open source, crowdsourced grocery price comparison app for Brazil
> (Expo + React Native + Supabase). Contributions are welcome — issues are written in Portuguese,
> but feel free to comment in English.*

## O que já funciona
- Login e cadastro por e-mail e senha.
- Scanner de código de barras com histórico de preços por loja e o mais barato em destaque.
- Lojas reais pelo GPS, com sugestões do OpenStreetMap.
- Cadastro de produto com foto, marca e conteúdo; dados do Open Food Facts quando existem.
- Lista de compras que mostra onde cada item está mais barato e o melhor mercado para a lista inteira.
- Lista compartilhada com a família, por código de convite e em tempo real.
- Importação do **cupom fiscal (NFC-e)** pelo QR Code: todos os preços da nota de uma vez.
- Em andamento: preço por kg/L para comparar embalagens de tamanhos diferentes.

## Visão
1. **Agora:** escanear, registrar e consultar preços.
2. **Depois:** mais pessoas contribuindo com preços, com confirmações e reputação.
3. **Futuro:** lista de compras que monta a melhor rota; rede social do menor preço por bairro.

O planejamento está nas [issues](../../issues) e nos [milestones](../../milestones).

## Tecnologias
- **App:** [Expo](https://expo.dev) SDK 57, React Native e TypeScript (pasta `app/`).
- **Backend:** [Supabase](https://supabase.com): Postgres com RLS, Auth, Storage, Realtime e Edge Functions
  (pasta `supabase/`).

## Rodando o projeto

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

### 3. Verificações antes de abrir um PR
```bash
cd app
npx tsc --noEmit
npx expo lint
```

## Como ajudar
Toda ajuda é bem-vinda: código, testes num mercado de verdade, ideias, design e documentação.

- Comece pelas issues marcadas com
  [`good first issue`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) ou
  [`help wanted`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).
- Leia o [guia de contribuição](CONTRIBUTING.md) e o [código de conduta](CODE_OF_CONDUCT.md).
- Dúvidas e ideias: [Discussions](../../discussions).
- Encontrou uma falha de segurança? **Não abra issue pública**; veja [SECURITY.md](SECURITY.md).

## Licença
Copyright © 2026 Josevan (josivantarcio).

Este projeto é software livre, distribuído sob a **GNU Affero General Public License v3.0** ([LICENSE](LICENSE)).
Você pode usar, estudar, modificar e redistribuir o código, mas quem distribuir uma versão modificada,
ou oferecê-la como serviço pela rede, precisa publicar o código-fonte com a mesma licença.

O nome "MaisBarato" e a identidade visual do app não estão cobertos pela licença do código.
