# @omarkez_ Bio Link

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

Quando o banco for conectado, copie as variáveis de `.env.example` para **Vercel → Project Settings → Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

A chave `SUPABASE_SERVICE_ROLE_KEY` é secreta e só pode ser usada no servidor. Nunca coloque essa chave em código executado no navegador.

No estado atual, o painel administrativo é uma demonstração local: as edições ficam salvas apenas no navegador do aparelho. A sincronização entre celulares será ativada quando o Supabase e a autenticação segura forem conectados.
