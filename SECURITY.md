# Segurança

## Como relatar uma falha
**Não abra issue pública** para falhas de segurança.

Use o relato privado do GitHub: aba **Security → Report a vulnerability**
([link direto](../../security/advisories/new)). Descreva o problema, como reproduzir e o impacto.

Você recebe uma resposta em até 7 dias. Depois da correção, a falha pode ser divulgada com crédito a quem relatou,
se a pessoa quiser.

## O que interessa
- Acesso a dados de outro usuário (falha de RLS, listas compartilhadas, cupons fiscais).
- Registrar preço em nome de outra pessoa ou com origem falsa (`nfce`).
- Abuso da Edge Function `importar-nfce` (por exemplo, fazê-la acessar hosts fora de `*.gov.br`).
- Vazamento de chaves ou dados pessoais.

## Fora do escopo
- A chave **publishable** do Supabase dentro do app: ela é pública por definição; a proteção está no RLS.
- Ataques que exigem acesso físico ao celular desbloqueado.
