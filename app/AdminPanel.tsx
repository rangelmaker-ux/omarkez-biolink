"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  CardRow,
  ProfileRow,
  SiteSettingsRow,
} from "@/lib/supabase/types";

type AdminTab = "overview" | "profiles" | "cards" | "appearance";

type AdminProfile = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  image: string;
  linkUrl: string;
  order: number;
  published: boolean;
};

type AdminCard = {
  id: string;
  profileId: string;
  title: string;
  url: string;
  kind: "link" | "download";
  published: boolean;
};

type AdminAppearance = {
  handle: string;
  accent: string;
  motion: boolean;
};

type ImportedCardRow = {
  profile_id: string;
  title: string;
  button_label: string;
  kind: "link" | "download";
  external_url: string;
  sort_order: number;
  is_published: boolean;
};

const tabs: Array<{ id: AdminTab; label: string; icon: string }> = [
  { id: "overview", label: "Visão geral", icon: "⌂" },
  { id: "profiles", label: "Perfis", icon: "◫" },
  { id: "cards", label: "Cards", icon: "▪" },
  { id: "appearance", label: "Aparência", icon: "✦" },
];

const legacyProfileSlugs: Record<string, string> = {
  luts: "luts",
  sony: "sony-zv-e10",
  blackmagic: "blackmagic-cam",
  contact: "contato-whatsapp",
};

const WHATSAPP_URL =
  "https://wa.me/5566996648516?text=Ol%C3%A1%21%20Vim%20pelo%20seu%20perfil%20e%20gostaria%20de%20solicitar%20um%20or%C3%A7amento.";

function mapProfile(row: ProfileRow): AdminProfile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    image: row.image_url || "/profile-contact.jpg",
    linkUrl: row.slug === "contato-whatsapp" ? WHATSAPP_URL : row.link_url || "",
    order: row.sort_order,
    published: row.is_published,
  };
}

function mapCard(row: CardRow): AdminCard {
  return {
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    url: row.external_url || row.storage_path || "",
    kind: row.kind,
    published: row.is_published,
  };
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `perfil-${Date.now()}`;
}

function validDestination(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function importLegacyCards(
  client: SupabaseClient,
  profiles: AdminProfile[],
  currentCards: AdminCard[],
): Promise<AdminCard[]> {
  if (localStorage.getItem("omarkez-cloud-import-complete") === "true") {
    return currentCards;
  }

  const saved = localStorage.getItem("omarkez-admin-demo");
  if (!saved) {
    localStorage.setItem("omarkez-cloud-import-complete", "true");
    return currentCards;
  }

  try {
    const parsed = JSON.parse(saved) as {
      cards?: Array<{
        id?: string;
        profileId?: string;
        title?: string;
        url?: string;
        kind?: "link" | "download";
      }>;
    };

    const existing = new Set(
      currentCards.map((card) => `${card.profileId}|${card.title}|${card.url}`),
    );
    const rows: ImportedCardRow[] = (parsed.cards || [])
      .filter(
        (card) =>
          card.id !== "card-welcome" &&
          Boolean(card.title?.trim()) &&
          Boolean(card.url?.trim()) &&
          validDestination(card.url?.trim() || ""),
      )
      .map((card, index) => {
        const slug = legacyProfileSlugs[card.profileId || ""];
        const profile = profiles.find(
          (item) => item.slug === slug || item.id === card.profileId,
        );
        if (!profile) return null;

        const title = card.title!.trim();
        const url = card.url!.trim();
        const signature = `${profile.id}|${title}|${url}`;
        if (existing.has(signature)) return null;
        existing.add(signature);

        const kind: "link" | "download" =
          card.kind === "download" ? "download" : "link";

        return {
          profile_id: profile.id,
          title,
          button_label: kind === "download" ? "Baixar" : "Acessar",
          kind,
          external_url: url,
          sort_order: (currentCards.length + index + 1) * 10,
          is_published: true,
        };
      })
      .filter((row): row is ImportedCardRow => row !== null);

    if (rows.length) {
      const { data, error } = await client
        .from("cards")
        .insert(rows)
        .select("*");
      if (error) throw error;
      currentCards = [
        ...currentCards,
        ...((data || []) as CardRow[]).map(mapCard),
      ];
    }

    localStorage.setItem("omarkez-cloud-import-complete", "true");
    localStorage.removeItem("omarkez-admin-demo");
    return currentCards;
  } catch {
    return currentCards;
  }
}

export function AdminPanel({ onExit }: { onExit: () => void | Promise<void> }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [appearance, setAppearance] = useState<AdminAppearance>({
    handle: "@omarkez_",
    accent: "#e50914",
    motion: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [newProfile, setNewProfile] = useState({ name: "", image: "" });
  const [newCard, setNewCard] = useState({
    profileId: "",
    title: "",
    url: "",
    kind: "link" as "link" | "download",
  });

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCloudData() {
      const client = getSupabaseBrowserClient();
      if (!client) {
        if (active) {
          setConnectionError("As variáveis do Supabase não foram encontradas.");
          setLoaded(true);
        }
        return;
      }

      const [profilesResult, cardsResult, settingsResult] = await Promise.all([
        client.from("profiles").select("*").order("sort_order"),
        client.from("cards").select("*").order("sort_order"),
        client.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      ]);

      const error = profilesResult.error || cardsResult.error || settingsResult.error;
      if (error) {
        if (active) {
          setConnectionError(`Falha ao acessar o Supabase: ${error.message}`);
          setLoaded(true);
        }
        return;
      }

      const cloudProfiles = (profilesResult.data as ProfileRow[]).map(mapProfile);
      let cloudCards = (cardsResult.data as CardRow[]).map(mapCard);
      cloudCards = await importLegacyCards(client, cloudProfiles, cloudCards);

      if (!active) return;
      setProfiles(cloudProfiles);
      setCards(cloudCards);
      setNewCard((current) => ({
        ...current,
        profileId: current.profileId || cloudProfiles[0]?.id || "",
      }));

      if (settingsResult.data) {
        const settings = settingsResult.data as SiteSettingsRow;
        setAppearance({
          handle: settings.handle,
          accent: settings.accent_color,
          motion: settings.motion_enabled,
        });
      }
      setLoaded(true);
    }

    void loadCloudData();
    return () => {
      active = false;
    };
  }, []);

  const publishedProfiles = profiles.filter((profile) => profile.published).length;
  const publishedCards = cards.filter((card) => card.published).length;
  const currentProfileName = useMemo(
    () => profiles.find((profile) => profile.id === newCard.profileId)?.name,
    [newCard.profileId, profiles],
  );

  function editProfile(id: string, patch: Partial<AdminProfile>) {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile,
      ),
    );
  }

  async function persistProfile(id: string, patch: Partial<AdminProfile>) {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const dbPatch: Record<string, string | number | boolean | null> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.shortName !== undefined) dbPatch.short_name = patch.shortName;
    if (patch.image !== undefined) dbPatch.image_url = patch.image || null;
    if (patch.linkUrl !== undefined) dbPatch.link_url = patch.linkUrl || null;
    if (patch.published !== undefined) dbPatch.is_published = patch.published;
    if (patch.order !== undefined) dbPatch.sort_order = patch.order;

    const { error } = await client.from("profiles").update(dbPatch).eq("id", id);
    if (error) {
      flash(`Não foi possível salvar: ${error.message}`);
      return;
    }
    editProfile(id, patch);
    flash("Perfil salvo no Supabase.");
  }

  async function createProfile(event: FormEvent) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    const name = newProfile.name.trim();
    if (!client || !name) return;

    let slug = slugify(name);
    if (profiles.some((profile) => profile.slug === slug)) {
      slug = `${slug}-${Date.now().toString().slice(-5)}`;
    }

    const { data, error } = await client
      .from("profiles")
      .insert({
        slug,
        name,
        short_name: name.slice(0, 18),
        image_url: newProfile.image.trim() || "/profile-contact.jpg",
        sort_order: Math.max(0, ...profiles.map((profile) => profile.order)) + 10,
        is_published: false,
      })
      .select("*")
      .single();

    if (error) {
      flash(`Não foi possível criar: ${error.message}`);
      return;
    }
    setProfiles((current) => [...current, mapProfile(data as ProfileRow)]);
    setNewProfile({ name: "", image: "" });
    flash("Novo perfil criado na nuvem como rascunho.");
  }

  async function removeProfile(id: string) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.from("profiles").delete().eq("id", id);
    if (error) {
      flash(`Não foi possível excluir: ${error.message}`);
      return;
    }
    setProfiles((current) => current.filter((profile) => profile.id !== id));
    setCards((current) => current.filter((card) => card.profileId !== id));
    flash("Perfil e seus cards foram excluídos.");
  }

  async function createCard(event: FormEvent) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    const title = newCard.title.trim();
    const url = newCard.url.trim();
    if (!client || !newCard.profileId || !title || !validDestination(url)) {
      flash("Informe um título e um link válido começando com https://.");
      return;
    }

    const { data, error } = await client
      .from("cards")
      .insert({
        profile_id: newCard.profileId,
        title,
        button_label: newCard.kind === "download" ? "Baixar" : "Acessar",
        external_url: url,
        kind: newCard.kind,
        sort_order: Math.max(0, ...cards.map((card, index) => index * 10)) + 10,
        is_published: true,
      })
      .select("*")
      .single();

    if (error) {
      flash(`Não foi possível criar o card: ${error.message}`);
      return;
    }
    setCards((current) => [...current, mapCard(data as CardRow)]);
    setNewCard((current) => ({ ...current, title: "", url: "" }));
    flash("Card publicado no Supabase e liberado no perfil.");
  }

  async function toggleCard(card: AdminCard, published: boolean) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client
      .from("cards")
      .update({ is_published: published })
      .eq("id", card.id);
    if (error) {
      flash(`Não foi possível atualizar: ${error.message}`);
      return;
    }
    setCards((current) =>
      current.map((item) =>
        item.id === card.id ? { ...item, published } : item,
      ),
    );
    flash(published ? "Card publicado." : "Card movido para rascunho.");
  }

  async function removeCard(id: string) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.from("cards").delete().eq("id", id);
    if (error) {
      flash(`Não foi possível excluir: ${error.message}`);
      return;
    }
    setCards((current) => current.filter((card) => card.id !== id));
    flash("Card excluído do Supabase.");
  }

  async function saveAppearance() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client
      .from("site_settings")
      .update({
        handle: appearance.handle,
        accent_color: appearance.accent,
        motion_enabled: appearance.motion,
      })
      .eq("id", 1);
    if (error) {
      flash(`Não foi possível salvar: ${error.message}`);
      return;
    }
    flash("Aparência salva no Supabase.");
  }

  return (
    <section
      className="admin-shell"
      style={{ "--admin-accent": appearance.accent } as React.CSSProperties}
    >
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="brand-mark">O</span>
          <div><strong>SUPERUSUÁRIO</strong><small>{appearance.handle}</small></div>
        </div>
        <nav className="admin-nav" aria-label="Menu administrativo">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "admin-nav-item admin-nav-active" : "admin-nav-item"}
              onClick={() => setTab(item.id)}
            >
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="admin-local-note admin-cloud-note">
          <span>SUPABASE CONECTADO</span>
          <p>Perfis, cards e aparência agora são salvos na nuvem.</p>
        </div>
        <button className="admin-exit" onClick={() => void onExit()}>Sair do painel</button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>PAINEL DE CONTROLE</p>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <span className="admin-status"><i /> Supabase ativo</span>
        </header>

        {notice && <div className="admin-toast" role="status">{notice}</div>}
        {connectionError && <div className="admin-error-banner" role="alert">{connectionError}</div>}
        {!loaded && <div className="admin-loading">Carregando dados da nuvem...</div>}

        {loaded && tab === "overview" && (
          <div className="admin-view admin-view-enter">
            <div className="admin-stats">
              <article><span>Perfis publicados</span><strong>{publishedProfiles}</strong><small>de {profiles.length} perfis</small></article>
              <article><span>Cards publicados</span><strong>{publishedCards}</strong><small>de {cards.length} cards</small></article>
              <article><span>Armazenamento</span><strong>CLOUD</strong><small>Supabase ativo</small></article>
            </div>
            <div className="admin-columns">
              <article className="admin-panel-card">
                <div className="admin-card-heading"><h2>Funcionando agora</h2><span className="ready-chip">ONLINE</span></div>
                <ul className="admin-checklist">
                  <li><b>✓</b> Login protegido pelo Supabase Auth</li>
                  <li><b>✓</b> Criar, editar, publicar e excluir perfis</li>
                  <li><b>✓</b> Adicionar links e downloads aos perfis</li>
                  <li><b>✓</b> Cards publicados aparecem imediatamente</li>
                  <li><b>✓</b> Dados iguais no celular e computador</li>
                </ul>
              </article>
              <article className="admin-panel-card">
                <div className="admin-card-heading"><h2>Conexão ativa</h2><span className="ready-chip">SUPABASE</span></div>
                <ul className="admin-checklist">
                  <li><b>✓</b> Banco de perfis e cards conectado</li>
                  <li><b>✓</b> Regras RLS protegendo as alterações</li>
                  <li><b>✓</b> Conteúdo público filtrado por publicação</li>
                  <li><b>✓</b> Preferências visuais salvas na nuvem</li>
                  <li><b>✓</b> Migração do card criado localmente</li>
                </ul>
              </article>
            </div>
          </div>
        )}

        {loaded && tab === "profiles" && (
          <div className="admin-view admin-view-enter">
            <form className="admin-create-form" onSubmit={createProfile}>
              <div><label htmlFor="profile-name">Nome do novo perfil</label><input id="profile-name" value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} placeholder="Ex.: Bastidores" /></div>
              <div><label htmlFor="profile-image">Imagem ou URL</label><input id="profile-image" value={newProfile.image} onChange={(e) => setNewProfile({ ...newProfile, image: e.target.value })} placeholder="https://... ou /imagem.jpg" /></div>
              <button type="submit">+ Criar perfil</button>
            </form>
            <div className="admin-profile-list">
              {profiles.map((profile) => (
                <article className="admin-profile-row" key={profile.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.image} alt="" />
                  <div className="admin-profile-fields">
                    <label htmlFor={`name-${profile.id}`}>Nome</label>
                    <input id={`name-${profile.id}`} value={profile.name} onChange={(e) => editProfile(profile.id, { name: e.target.value })} onBlur={() => void persistProfile(profile.id, { name: profile.name })} />
                    <label htmlFor={`image-${profile.id}`}>Imagem</label>
                    <input id={`image-${profile.id}`} value={profile.image} onChange={(e) => editProfile(profile.id, { image: e.target.value })} onBlur={() => void persistProfile(profile.id, { image: profile.image })} />
                    <label htmlFor={`link-${profile.id}`}>Link direto opcional</label>
                    <input id={`link-${profile.id}`} value={profile.linkUrl} onChange={(e) => editProfile(profile.id, { linkUrl: e.target.value })} onBlur={() => void persistProfile(profile.id, { linkUrl: profile.linkUrl })} />
                  </div>
                  <label className="admin-switch"><input type="checkbox" checked={profile.published} onChange={(e) => void persistProfile(profile.id, { published: e.target.checked })} /><span />{profile.published ? "Publicado" : "Rascunho"}</label>
                  <button className="admin-danger" onClick={() => void removeProfile(profile.id)}>Excluir</button>
                </article>
              ))}
            </div>
          </div>
        )}

        {loaded && tab === "cards" && (
          <div className="admin-view admin-view-enter">
            <form className="admin-create-form admin-card-form" onSubmit={createCard}>
              <div><label htmlFor="card-profile">Perfil</label><select id="card-profile" value={newCard.profileId} onChange={(e) => setNewCard({ ...newCard, profileId: e.target.value })}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div>
              <div><label htmlFor="card-title">Título do card</label><input id="card-title" value={newCard.title} onChange={(e) => setNewCard({ ...newCard, title: e.target.value })} placeholder="Ex.: Baixar LUT Cinematic" /></div>
              <div><label htmlFor="card-url">Link ou arquivo</label><input id="card-url" value={newCard.url} onChange={(e) => setNewCard({ ...newCard, url: e.target.value })} placeholder="https://..." /></div>
              <div><label htmlFor="card-kind">Tipo</label><select id="card-kind" value={newCard.kind} onChange={(e) => setNewCard({ ...newCard, kind: e.target.value as "link" | "download" })}><option value="link">Link</option><option value="download">Download</option></select></div>
              <button type="submit">+ Publicar card</button>
            </form>
            <p className="admin-context">O novo card será publicado imediatamente em <strong>{currentProfileName || "selecione um perfil"}</strong>.</p>
            <div className="admin-card-list">
              {cards.length === 0 && <div className="admin-empty"><span>▪</span><h2>Nenhum card ainda</h2><p>Crie o primeiro link ou download acima.</p></div>}
              {cards.map((card) => (
                <article className="admin-content-row" key={card.id}>
                  <span className="admin-kind">{card.kind === "download" ? "↓" : "↗"}</span>
                  <div><strong>{card.title}</strong><small>{profiles.find((profile) => profile.id === card.profileId)?.name} • {card.kind}</small></div>
                  <label className="admin-switch"><input type="checkbox" checked={card.published} onChange={(e) => void toggleCard(card, e.target.checked)} /><span />{card.published ? "Publicado" : "Rascunho"}</label>
                  <button className="admin-danger" onClick={() => void removeCard(card.id)}>Excluir</button>
                </article>
              ))}
            </div>
          </div>
        )}

        {loaded && tab === "appearance" && (
          <div className="admin-view admin-view-enter">
            <article className="admin-panel-card admin-settings-card">
              <h2>Identidade do site</h2>
              <div className="admin-setting"><div><strong>Nome exibido</strong><small>Aparece no topo e no rodapé</small></div><input value={appearance.handle} onChange={(e) => setAppearance({ ...appearance, handle: e.target.value })} /></div>
              <div className="admin-setting"><div><strong>Cor de destaque</strong><small>Botões e elementos ativos</small></div><input className="admin-color" type="color" value={appearance.accent} onChange={(e) => setAppearance({ ...appearance, accent: e.target.value })} /></div>
              <div className="admin-setting"><div><strong>Animações da experiência</strong><small>Movimento, profundidade e transições</small></div><label className="admin-switch"><input type="checkbox" checked={appearance.motion} onChange={(e) => setAppearance({ ...appearance, motion: e.target.checked })} /><span />{appearance.motion ? "Ativadas" : "Reduzidas"}</label></div>
              <button className="admin-save" onClick={() => void saveAppearance()}>Salvar no Supabase</button>
            </article>
          </div>
        )}
      </main>
    </section>
  );
}
