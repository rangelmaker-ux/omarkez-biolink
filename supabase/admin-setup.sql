-- 1. Crie primeiro seu usuário em Supabase > Authentication > Users.
-- 2. Troque o e-mail abaixo pelo e-mail exato desse usuário.
-- 3. Execute este arquivo no SQL Editor depois da migração principal.

do $$
declare
  selected_user_id uuid;
begin
  select id
  into selected_user_id
  from auth.users
  where lower(email) = lower('SEU-EMAIL-AQUI')
  limit 1;

  if selected_user_id is null then
    raise exception 'Usuário não encontrado no Supabase Auth. Confira o e-mail.';
  end if;

  insert into public.admin_users (user_id)
  values (selected_user_id)
  on conflict (user_id) do nothing;
end;
$$;
