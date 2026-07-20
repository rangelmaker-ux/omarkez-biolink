"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  image: string;
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
    image: row.image_url || "",
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

function validCardImage(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Escolha um arquivo de imagem.";
  }
  if (file.size > 15 * 1024 * 1024) {
    return "A imagem deve ter no máximo 15 MB.";
  }
  return null;
}

async function uploadCardImage(
  client: SupabaseClient,
  file: File,
  profileId: string,
): Promise<{ path: string; publicUrl: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `cards/${profileId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await client.storage
    .from("omarkez-media")
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  const publicUrl = client.storage
    .from("omarkez-media")
    .getPublicUrl(data.path).data.publicUrl;
  return { path: data.path, publicUrl };
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
  const [newCardImage, setNewCardImage] = useState<File | null>(null);
  const [newCardImagePreview, setNewCardImagePreview] = useState("");
  const [cardImageInputKey, setCardImageInputKey] = useState(0);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [draggedProfileId, setDraggedProfileId] = useState<string | null>(null);
  const [savingProfileOrder, setSavingProfileOrder] = useState(false);
  const profilesOrderRef = useRef<AdminProfile[]>([]);
  const draggedProfileIdRef = useRef<string | null>(null);
  const profileDragSnapshotRef = useRef<AdminProfile[]>([]);

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
      profilesOrderRef.current = cloudProfiles;
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

  useEffect(() => {
    profilesOrderRef.current = profiles;
  }, [profiles]);

  const publishedProfiles = profiles.filter((profile) => profile.published).length;
  const publishedCards = cards.filter((card) => card.published).length;
  const currentProfileName = useMemo(
    () => profiles.find((profile) => profile.id === newCard.profileId)?.name,
    [newCard.profileId, profiles],
  );

  function editProfile(id: string, patch: Partial<AdminProfile>) {
    setProfiles((current) => {
      const next = current.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile,
      );
      profilesOrderRef.current = next;
      return next;
    });
  }

  function reorderProfiles(activeId: string, overId: string) {
    if (activeId === overId) return;
    const current = profilesOrderRef.current;
    const from = current.findIndex((profile) => profile.id === activeId);
    const to = current.findIndex((profile) => profile.id === overId);
    if (from < 0 || to < 0) return;

    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    profilesOrderRef.current = next;
    setProfiles(next);
  }

  async function saveProfileOrder(
    orderedProfiles: AdminProfile[],
    previousProfiles: AdminProfile[],
  ) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setSavingProfileOrder(true);

    const ordered = orderedProfiles.map((profile, index) => ({
      ...profile,
      order: (index + 1) * 10,
    }));
    const results = await Promise.all(
      ordered.map((profile) =>
        client
          .from("profiles")
          .update({ sort_order: profile.order })
          .eq("id", profile.id),
      ),
    );
    const failed = results.find((result) => result.error)?.error;

    if (failed) {
      await Promise.all(
        previousProfiles.map((profile) =>
          client
            .from("profiles")
            .update({ sort_order: profile.order })
            .eq("id", profile.id),
        ),
      );
      profilesOrderRef.current = previousProfiles;
      setProfiles(previousProfiles);
      flash(`Não foi possível salvar a ordem: ${failed.message}`);
    } else {
      profilesOrderRef.current = ordered;
      setProfiles(ordered);
      flash("Nova ordem dos perfis salva no Supabase.");
    }
    setSavingProfileOrder(false);
  }

  function startProfileDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    profileId: string,
  ) {
    if (savingProfileOrder || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    profileDragSnapshotRef.current = [...profilesOrderRef.current];
    draggedProfileIdRef.current = profileId;
    setDraggedProfileId(profileId);
    document.body.classList.add("admin-profile-dragging");
  }

  function moveDraggedProfile(event: ReactPointerEvent<HTMLButtonElement>) {
    const activeId = draggedProfileIdRef.current;
    if (!activeId) return;
    event.preventDefault();

    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-profile-id]");
    const overId = row?.dataset.profileId;
    if (overId) reorderProfiles(activeId, overId);

    const scrollArea = document.querySelector<HTMLElement>(".admin-main");
    if (!scrollArea) return;
    const bounds = scrollArea.getBoundingClientRect();
    const scrollTarget = getComputedStyle(scrollArea).overflowY === "visible"
      ? window
      : scrollArea;
    if (event.clientY < bounds.top + 80) scrollTarget.scrollBy({ top: -14 });
    if (event.clientY > bounds.bottom - 80) scrollTarget.scrollBy({ top: 14 });
  }

  async function finishProfileDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const activeId = draggedProfileIdRef.current;
    if (!activeId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggedProfileIdRef.current = null;
    setDraggedProfileId(null);
    document.body.classList.remove("admin-profile-dragging");

    const previous = profileDragSnapshotRef.current;
    const current = profilesOrderRef.current;
    if (previous.map((profile) => profile.id).join("|") !== current.map((profile) => profile.id).join("|")) {
      await saveProfileOrder(current, previous);
    }
  }

  function cancelProfileDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const previous = profileDragSnapshotRef.current;
    profilesOrderRef.current = previous;
    setProfiles(previous);
    draggedProfileIdRef.current = null;
    setDraggedProfileId(null);
    document.body.classList.remove("admin-profile-dragging");
  }

  async function moveProfileWithKeyboard(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    profileId: string,
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (savingProfileOrder) return;

    const previous = [...profilesOrderRef.current];
    const index = previous.findIndex((profile) => profile.id === profileId);
    const target = event.key === "ArrowUp" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= previous.length) return;
    const next = [...previous];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    profilesOrderRef.current = next;
    setProfiles(next);
    await saveProfileOrder(next, previous);
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

    if (newCardImage) {
      const imageError = validCardImage(newCardImage);
      if (imageError) {
        flash(imageError);
        return;
      }
    }

    setUploadingCard(true);
    let uploadedImagePath = "";
    let imageUrl = "";

    try {
      if (newCardImage) {
        const uploaded = await uploadCardImage(
          client,
          newCardImage,
          newCard.profileId,
        );
        uploadedImagePath = uploaded.path;
        imageUrl = uploaded.publicUrl;
      }

      const { data, error } = await client
        .from("cards")
        .insert({
          profile_id: newCard.profileId,
          title,
          button_label: newCard.kind === "download" ? "Baixar" : "Acessar",
          external_url: url,
          kind: newCard.kind,
          image_url: imageUrl || null,
          sort_order: Math.max(0, ...cards.map((card, index) => index * 10)) + 10,
          is_published: true,
        })
        .select("*")
        .single();

      if (error) {
        if (uploadedImagePath) {
          await client.storage.from("omarkez-media").remove([uploadedImagePath]);
        }
        flash(`Não foi possível criar o card: ${error.message}`);
        return;
      }
      setCards((current) => [...current, mapCard(data as CardRow)]);
      setNewCard((current) => ({ ...current, title: "", url: "" }));
      setNewCardImage(null);
      setNewCardImagePreview("");
      setCardImageInputKey((current) => current + 1);
      flash("Card publicado com a imagem no Supabase.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha no envio";
      flash(`Não foi possível carregar a imagem: ${message}`);
    } finally {
      setUploadingCard(false);
    }
  }

  function chooseNewCardImage(file: File | null) {
    setNewCardImage(file);
    if (!file) {
      setNewCardImagePreview("");
      return;
    }

    const imageError = validCardImage(file);
    if (imageError) {
      flash(imageError);
      setNewCardImage(null);
      setNewCardImagePreview("");
      setCardImageInputKey((current) => current + 1);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setNewCardImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function replaceCardImage(card: AdminCard, file: File) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const imageError = validCardImage(file);
    if (imageError) {
      flash(imageError);
      return;
    }

    try {
      const uploaded = await uploadCardImage(client, file, card.profileId);
      const { error } = await client
        .from("cards")
        .update({ image_url: uploaded.publicUrl })
        .eq("id", card.id);
      if (error) {
        await client.storage.from("omarkez-media").remove([uploaded.path]);
        throw error;
      }
      setCards((current) => current.map((item) => (
        item.id === card.id ? { ...item, image: uploaded.publicUrl } : item
      )));
      flash("Imagem do banner atualizada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha no envio";
      flash(`Não foi possível atualizar a imagem: ${message}`);
    }
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
            <div className="admin-order-help">
              <span aria-hidden="true">⠿</span>
              <p><strong>Organizar perfis</strong>Segure a alça e arraste para mudar a posição. A ordem é salva ao soltar.</p>
              {savingProfileOrder && <small>Salvando ordem...</small>}
            </div>
            <div className="admin-profile-list">
              {profiles.map((profile, index) => (
                <article
                  className={`admin-profile-row${draggedProfileId === profile.id ? " admin-profile-row-dragging" : ""}`}
                  data-profile-id={profile.id}
                  key={profile.id}
                >
                  <button
                    aria-label={`Mover ${profile.name}. Posição ${index + 1} de ${profiles.length}`}
                    className="admin-drag-handle"
                    disabled={savingProfileOrder}
                    onKeyDown={(event) => void moveProfileWithKeyboard(event, profile.id)}
                    onPointerCancel={cancelProfileDrag}
                    onPointerDown={(event) => startProfileDrag(event, profile.id)}
                    onPointerMove={moveDraggedProfile}
                    onPointerUp={(event) => void finishProfileDrag(event)}
                    title="Segure e arraste para reorganizar"
                    type="button"
                  >
                    <span aria-hidden="true">⠿</span>
                    <small>{index + 1}</small>
                  </button>
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
              <div className="admin-image-field">
                <label htmlFor="card-image">Imagem horizontal</label>
                <input key={cardImageInputKey} id="card-image" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif" onChange={(e) => chooseNewCardImage(e.target.files?.[0] || null)} />
              </div>
              {newCardImagePreview && (
                <div className="admin-card-image-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newCardImagePreview} alt="Prévia do banner" />
                  <span>{newCardImage?.name}</span>
                  <button type="button" onClick={() => { chooseNewCardImage(null); setCardImageInputKey((current) => current + 1); }}>Remover</button>
                </div>
              )}
              <button className="admin-publish-card" type="submit" disabled={uploadingCard}>{uploadingCard ? "Enviando imagem..." : "+ Publicar card"}</button>
            </form>
            <p className="admin-context">O novo card será publicado imediatamente em <strong>{currentProfileName || "selecione um perfil"}</strong>.</p>
            <div className="admin-card-list">
              {cards.length === 0 && <div className="admin-empty"><span>▪</span><h2>Nenhum card ainda</h2><p>Crie o primeiro link ou download acima.</p></div>}
              {cards.map((card) => (
                <article className="admin-content-row" key={card.id}>
                  <figure className="admin-card-thumb">
                    {card.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt="" />
                    ) : (
                      <span className="admin-kind">{card.kind === "download" ? "↓" : "↗"}</span>
                    )}
                  </figure>
                  <div className="admin-card-copy"><strong>{card.title}</strong><small>{profiles.find((profile) => profile.id === card.profileId)?.name} • {card.kind}</small></div>
                  <div className="admin-row-actions">
                    <label className="admin-image-action">
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif" onChange={(e) => { const file = e.target.files?.[0]; if (file) void replaceCardImage(card, file); e.currentTarget.value = ""; }} />
                      {card.image ? "Trocar imagem" : "Adicionar imagem"}
                    </label>
                    <label className={`admin-switch admin-publish-switch ${card.published ? "is-published" : "is-draft"}`}><input type="checkbox" checked={card.published} onChange={(e) => void toggleCard(card, e.target.checked)} /><span />{card.published ? "Publicado" : "Não publicado"}</label>
                    <button className="admin-danger" onClick={() => void removeCard(card.id)}>Excluir</button>
                  </div>
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
