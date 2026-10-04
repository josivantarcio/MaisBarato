# Como contribuir com o MaisBarato

Obrigado pelo interesse! Este guia explica como propor mudanças.

## Por onde começar
1. Procure uma issue aberta, de preferência com `good first issue` ou `help wanted`.
2. Comente na issue dizendo que vai trabalhar nela, para ninguém fazer em dobro.
3. Ideia nova ou mudança grande? Abra uma issue ou uma conversa em Discussions **antes** de programar.

## Fluxo
1. Faça um **fork** do repositório e crie uma branch a partir da `main`:
   `git checkout -b corrige-total-da-lista`.
2. Rode o projeto localmente (veja o [README](README.md#rodando-o-projeto)).
3. Faça commits pequenos, com mensagem em português e no imperativo ou descritiva
   ("Mostra a distância até a loja no histórico").
4. Antes de abrir o PR, rode em `app/`:
   ```bash
   npx tsc --noEmit
   npx expo lint
   ```
5. Abra o **pull request** para a `main`, explique o que mudou e como testar, e cite a issue (`Closes #15`).
   Todo PR é revisado antes de entrar.

## Regras do projeto
- **Banco:** toda mudança de esquema é uma migração nova em `supabase/migrations/` (nunca edite uma migração já
  publicada). Toda tabela tem RLS; explique no PR quem pode ler e escrever.
- **App:** Expo SDK 57. Instale pacotes com `npx expo install <pacote>`. Prefira módulos que funcionem no Expo Go.
- **Idioma:** código, telas e documentação em português do Brasil. Comentários em inglês também são aceitos.
- **Segredos:** nunca commite `.env.local`, chaves `secret`/`service_role`, senhas ou tokens. O repositório tem
  bloqueio automático de push com segredos.
- **Dados pessoais:** não use dados reais de pessoas em testes, prints ou issues (LGPD).

## Licença das contribuições
O MaisBarato é distribuído sob a [AGPL-3.0](LICENSE). Ao enviar uma contribuição (código, texto, imagem etc.), você:

1. declara que tem o direito de enviá-la;
2. a licencia sob a AGPL-3.0, como o resto do projeto;
3. concede ao mantenedor, Josevan (josivantarcio), uma licença perpétua, mundial, gratuita, não exclusiva e
   irrevogável para usar, modificar e distribuir a contribuição como parte do MaisBarato, inclusive nas lojas de
   aplicativos (Google Play, App Store) e sob outras licenças.

Você continua sendo autor da sua contribuição e pode usá-la como quiser.

## Comportamento
Todos os participantes seguem o [Código de Conduta](CODE_OF_CONDUCT.md).
