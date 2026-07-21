# @rangelmaker_ Bio Link

Bio link responsivo em Next.js, preparado para publicação no Vercel.

## Rodar no computador

Requer Node.js 22.

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000`.

## Conferir a versão de produção

```bash
pnpm build
pnpm start
```

## Publicar no Vercel

1. Envie esta pasta ao repositório GitHub `rangelmaker-ux/omarkez-biolink`.
2. No Vercel, selecione **Add New → Project** e importe o repositório.
3. O Vercel detectará **Next.js**. Deixe o comando e a pasta de saída nos valores padrão.
4. Clique em **Deploy**.

Não é necessário configurar uma pasta interna: o projeto Next.js está na raiz deste repositório.

## Supabase

Copie as variáveis de `.env.example` para **Vercel → Project Settings → Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

O projeto usa somente a chave pública no navegador. Nunca coloque a chave `service_role` no Vercel como variável pública.

Perfis, cards e aparência são sincronizados pelo Supabase. O acesso ao painel usa um usuário criado em **Authentication → Users** e autorizado na tabela `admin_users`.
