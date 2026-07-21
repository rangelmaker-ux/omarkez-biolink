begin;

alter table public.site_settings
  alter column handle set default '@rangelmaker_',
  alter column footer_text set default 'Conteúdo e configurações por @rangelmaker_';

update public.site_settings
set
  handle = '@rangelmaker_',
  footer_text = 'Conteúdo e configurações por @rangelmaker_'
where id = 1;

commit;
