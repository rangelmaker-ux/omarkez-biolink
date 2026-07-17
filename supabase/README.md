# Modelos do Supabase

## O que será criado

- `admin_users`: controla quem pode editar o site.
- `site_settings`: nome, textos, cor e animações.
- `profiles`: perfis do carrossel principal.
- `cards`: links e downloads dentro dos perfis.
- bucket `omarkez-media`: imagens e arquivos públicos, com upload restrito ao administrador.
- políticas RLS: visitantes somente leem conteúdo publicado; administradores autenticados podem editar.

## Como instalar pelo painel

1. Abra **Supabase → SQL Editor → New query**.
2. Copie todo o conteúdo de `migrations/20260717160000_initial_omarkez_schema.sql` e execute.
3. Abra **Authentication → Users** e crie seu usuário administrativo.
4. Abra `admin-setup.sql`, troque `SEU-EMAIL-AQUI` e execute no SQL Editor.

## Variáveis do Vercel

Depois, configure no Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — pode receber a chave pública/publishable do projeto.

Não coloque a chave `service_role` no navegador.
