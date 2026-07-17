"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AdminTab = "overview" | "profiles" | "cards" | "appearance";

type DemoProfile = {
  id: string;
  name: string;
  image: string;
  published: boolean;
};

type DemoCard = {
  id: string;
  profileId: string;
  title: string;
  url: string;
  kind: "link" | "download";
  published: boolean;
};

type DemoAppearance = {
  handle: string;
  accent: string;
  motion: boolean;
};

const starterProfiles: DemoProfile[] = [
  { id: "luts", name: "LUTs", image: "/profile-luts.png", published: true },
  {
    id: "sony",
    name: "Configurações Sony ZV-E10 Mark II",
    image: "/profile-sony-zve10.png",
    published: true,
  },
  {
    id: "blackmagic",
    name: "Configurações Blackmagic Cam",
    image: "/profile-blackmagic.png",
    published: true,
  },
  {
    id: "contact",
    name: "Contato • WhatsApp",
    image: "/profile-contact.jpg",
    published: true,
  },
];

const starterCards: DemoCard[] = [
  {
    id: "card-welcome",
    profileId: "luts",
    title: "Pack de LUTs — em preparação",
    url: "#",
    kind: "download",
    published: false,
  },
];

const tabs: Array<{ id: AdminTab; label: string; icon: string }> = [
  { id: "overview", label: "Visão geral", icon: "⌂" },
  { id: "profiles", label: "Perfis", icon: "◫" },
  { id: "cards", label: "Cards", icon: "▦" },
  { id: "appearance", label: "Aparência", icon: "✦" },
];

export function AdminPanel({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [profiles, setProfiles] = useState(starterProfiles);
  const [cards, setCards] = useState(starterCards);
  const [appearance, setAppearance] = useState<DemoAppearance>({
    handle: "@omarkez_",
    accent: "#e50914",
    motion: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [newProfile, setNewProfile] = useState({ name: "", image: "" });
  const [newCard, setNewCard] = useState({
    profileId: "luts",
    title: "",
    url: "",
    kind: "link" as "link" | "download",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("omarkez-admin-demo");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.profiles)) setProfiles(parsed.profiles);
        if (Array.isArray(parsed.cards)) setCards(parsed.cards);
        if (parsed.appearance) setAppearance(parsed.appearance);
      }
    } catch {
      // Keep the safe defaults if browser storage was cleared or malformed.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      "omarkez-admin-demo",
      JSON.stringify({ profiles, cards, appearance }),
    );
  }, [appearance, cards, loaded, profiles]);

  const publishedProfiles = profiles.filter((profile) => profile.published).length;
  const publishedCards = cards.filter((card) => card.published).length;
  const currentProfileName = useMemo(
    () => profiles.find((profile) => profile.id === newCard.profileId)?.name,
    [newCard.profileId, profiles],
  );

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function updateProfile(id: string, patch: Partial<DemoProfile>) {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile,
      ),
    );
    flash("Perfil atualizado neste navegador.");
  }

  function createProfile(event: FormEvent) {
    event.preventDefault();
    const name = newProfile.name.trim();
    if (!name) return;
    setProfiles((current) => [
      ...current,
      {
        id: `profile-${Date.now()}`,
        name,
        image: newProfile.image.trim() || "/profile-contact.jpg",
        published: false,
      },
    ]);
    setNewProfile({ name: "", image: "" });
    flash("Novo perfil criado como rascunho.");
  }

  function removeProfile(id: string) {
    if (starterProfiles.some((profile) => profile.id === id)) {
      flash("Perfis principais não são removidos no modo de demonstração.");
      return;
    }
    setProfiles((current) => current.filter((profile) => profile.id !== id));
    setCards((current) => current.filter((card) => card.profileId !== id));
    flash("Perfil de teste removido.");
  }

  function createCard(event: FormEvent) {
    event.preventDefault();
    if (!newCard.title.trim() || !newCard.url.trim()) return;
    setCards((current) => [
      ...current,
      {
        id: `card-${Date.now()}`,
        profileId: newCard.profileId,
        title: newCard.title.trim(),
        url: newCard.url.trim(),
        kind: newCard.kind,
        published: false,
      },
    ]);
    setNewCard((current) => ({ ...current, title: "", url: "" }));
    flash("Card criado como rascunho.");
  }

  return (
    <section className="admin-shell" style={{ "--admin-accent": appearance.accent } as React.CSSProperties}>
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
        <div className="admin-local-note">
          <span>DEMONSTRAÇÃO LOCAL</span>
          <p>Os dados ficam somente neste navegador até a conexão com o Supabase.</p>
        </div>
        <button className="admin-exit" onClick={onExit}>Sair do painel</button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>PAINEL DE CONTROLE</p>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <span className="admin-status"><i /> Alterações locais ativas</span>
        </header>

        {notice && <div className="admin-toast" role="status">{notice}</div>}

        {tab === "overview" && (
          <div className="admin-view admin-view-enter">
            <div className="admin-stats">
              <article><span>Perfis publicados</span><strong>{publishedProfiles}</strong><small>de {profiles.length} perfis</small></article>
              <article><span>Cards publicados</span><strong>{publishedCards}</strong><small>de {cards.length} cards</small></article>
              <article><span>Armazenamento</span><strong>LOCAL</strong><small>Supabase pendente</small></article>
            </div>
            <div className="admin-columns">
              <article className="admin-panel-card">
                <div className="admin-card-heading"><h2>O que funciona agora</h2><span className="ready-chip">PRONTO</span></div>
                <ul className="admin-checklist">
                  <li><b>✓</b> Entrar com a senha administrativa</li>
                  <li><b>✓</b> Criar, renomear e ocultar perfis de teste</li>
                  <li><b>✓</b> Adicionar links e downloads como cards</li>
                  <li><b>✓</b> Salvar alterações neste navegador</li>
                  <li><b>✓</b> Configurar identidade visual do painel</li>
                </ul>
              </article>
              <article className="admin-panel-card">
                <div className="admin-card-heading"><h2>Próxima conexão</h2><span className="pending-chip">SUPABASE</span></div>
                <ul className="admin-checklist admin-pending-list">
                  <li><b>→</b> Autenticação segura no servidor</li>
                  <li><b>→</b> Upload real de imagens e arquivos</li>
                  <li><b>→</b> Dados iguais no celular e computador</li>
                  <li><b>→</b> Publicação automática das alterações</li>
                  <li><b>→</b> Métricas de cliques e downloads</li>
                </ul>
              </article>
            </div>
          </div>
        )}

        {tab === "profiles" && (
          <div className="admin-view admin-view-enter">
            <form className="admin-create-form" onSubmit={createProfile}>
              <div><label htmlFor="profile-name">Nome do novo perfil</label><input id="profile-name" value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} placeholder="Ex.: Bastidores" /></div>
              <div><label htmlFor="profile-image">Imagem ou URL</label><input id="profile-image" value={newProfile.image} onChange={(e) => setNewProfile({ ...newProfile, image: e.target.value })} placeholder="Opcional nesta demonstração" /></div>
              <button type="submit">+ Criar perfil</button>
            </form>
            <div className="admin-profile-list">
              {profiles.map((profile) => (
                <article className="admin-profile-row" key={profile.id}>
                  <img src={profile.image} alt="" />
                  <div className="admin-profile-fields">
                    <label htmlFor={`name-${profile.id}`}>Nome</label>
                    <input id={`name-${profile.id}`} value={profile.name} onChange={(e) => updateProfile(profile.id, { name: e.target.value })} />
                  </div>
                  <label className="admin-switch"><input type="checkbox" checked={profile.published} onChange={(e) => updateProfile(profile.id, { published: e.target.checked })} /><span />{profile.published ? "Publicado" : "Rascunho"}</label>
                  <button className="admin-danger" onClick={() => removeProfile(profile.id)}>Excluir</button>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "cards" && (
          <div className="admin-view admin-view-enter">
            <form className="admin-create-form admin-card-form" onSubmit={createCard}>
              <div><label htmlFor="card-profile">Perfil</label><select id="card-profile" value={newCard.profileId} onChange={(e) => setNewCard({ ...newCard, profileId: e.target.value })}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div>
              <div><label htmlFor="card-title">Título do card</label><input id="card-title" value={newCard.title} onChange={(e) => setNewCard({ ...newCard, title: e.target.value })} placeholder="Ex.: Baixar LUT Cinematic" /></div>
              <div><label htmlFor="card-url">Link ou arquivo</label><input id="card-url" value={newCard.url} onChange={(e) => setNewCard({ ...newCard, url: e.target.value })} placeholder="https://..." /></div>
              <div><label htmlFor="card-kind">Tipo</label><select id="card-kind" value={newCard.kind} onChange={(e) => setNewCard({ ...newCard, kind: e.target.value as "link" | "download" })}><option value="link">Link</option><option value="download">Download</option></select></div>
              <button type="submit">+ Adicionar card</button>
            </form>
            <p className="admin-context">Exibindo todos os cards. Novo card será adicionado em <strong>{currentProfileName}</strong>.</p>
            <div className="admin-card-list">
              {cards.length === 0 && <div className="admin-empty"><span>▦</span><h2>Nenhum card ainda</h2><p>Crie o primeiro link ou download acima.</p></div>}
              {cards.map((card) => (
                <article className="admin-content-row" key={card.id}>
                  <span className="admin-kind">{card.kind === "download" ? "↓" : "↗"}</span>
                  <div><strong>{card.title}</strong><small>{profiles.find((profile) => profile.id === card.profileId)?.name} • {card.kind}</small></div>
                  <label className="admin-switch"><input type="checkbox" checked={card.published} onChange={(e) => setCards((current) => current.map((item) => item.id === card.id ? { ...item, published: e.target.checked } : item))} /><span />{card.published ? "Publicado" : "Rascunho"}</label>
                  <button className="admin-danger" onClick={() => setCards((current) => current.filter((item) => item.id !== card.id))}>Excluir</button>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "appearance" && (
          <div className="admin-view admin-view-enter">
            <article className="admin-panel-card admin-settings-card">
              <h2>Identidade do site</h2>
              <div className="admin-setting"><div><strong>Nome exibido</strong><small>Aparece no topo e no rodapé</small></div><input value={appearance.handle} onChange={(e) => setAppearance({ ...appearance, handle: e.target.value })} /></div>
              <div className="admin-setting"><div><strong>Cor de destaque</strong><small>Botões e elementos ativos</small></div><input className="admin-color" type="color" value={appearance.accent} onChange={(e) => setAppearance({ ...appearance, accent: e.target.value })} /></div>
              <div className="admin-setting"><div><strong>Animações da experiência</strong><small>Movimento, profundidade e transições</small></div><label className="admin-switch"><input type="checkbox" checked={appearance.motion} onChange={(e) => setAppearance({ ...appearance, motion: e.target.checked })} /><span />{appearance.motion ? "Ativadas" : "Reduzidas"}</label></div>
              <button className="admin-save" onClick={() => flash("Preferências salvas neste navegador.")}>Salvar preferências</button>
            </article>
          </div>
        )}
      </main>
    </section>
  );
}
