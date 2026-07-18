"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPanel } from "./AdminPanel";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  CardRow,
  ProfileRow,
  SiteSettingsRow,
} from "@/lib/supabase/types";

const WHATSAPP_URL =
  "https://wa.me/5566996648516?text=Ol%C3%A1%21%20Vim%20pelo%20seu%20perfil%20e%20gostaria%20de%20solicitar%20um%20or%C3%A7amento.";

type Profile = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  image: string;
  href: string | null;
};

type ContentCard = {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  buttonLabel: string;
  kind: "link" | "download";
  image: string | null;
  url: string;
  fileName: string | null;
  openInNewTab: boolean;
};

type SiteSettings = {
  handle: string;
  subtitle: string;
  footerText: string;
  accent: string;
  motion: boolean;
};

const fallbackSettings: SiteSettings = {
  handle: "@omarkez_",
  subtitle: "Toque em um perfil para acessar os conteúdos.",
  footerText: "Conteúdo e configurações por @omarkez_",
  accent: "#e50914",
  motion: true,
};

const fallbackProfiles: Profile[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "luts",
    name: "LUTs",
    shortName: "LUTs",
    image: "/profile-luts.png",
    href: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    slug: "sony-zv-e10",
    name: "Configurações Sony ZV-E10 Mark II",
    shortName: "ZV-E10",
    image: "/profile-sony-zve10.png",
    href: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    slug: "blackmagic-cam",
    name: "Configurações Blackmagic Cam",
    shortName: "BMC",
    image: "/profile-blackmagic.png",
    href: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    slug: "contato-whatsapp",
    name: "Contato • WhatsApp",
    shortName: "WhatsApp",
    image: "/profile-contact.jpg",
    href: WHATSAPP_URL,
  },
];

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    image: row.image_url || "/profile-contact.jpg",
    href: row.slug === "contato-whatsapp" ? WHATSAPP_URL : row.link_url,
  };
}

function mapSettings(row: SiteSettingsRow): SiteSettings {
  return {
    handle: row.handle,
    subtitle: row.subtitle,
    footerText: row.footer_text,
    accent: row.accent_color,
    motion: row.motion_enabled,
  };
}

function allowedLink(value: string | null): string {
  if (!value) return "";
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? value
      : "";
  } catch {
    return "";
  }
}

export default function Home() {
  const [dialog, setDialog] = useState<"manage" | "add" | "profile" | null>(
    null,
  );
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>(fallbackProfiles);
  const [cards, setCards] = useState<ContentCard[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(fallbackSettings);
  const [activeSlide, setActiveSlide] = useState(0);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const totalSlides = profiles.length + 1;

  const loadSiteData = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const [settingsResult, profilesResult, cardsResult] = await Promise.all([
      client.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      client
        .from("profiles")
        .select("*")
        .eq("is_published", true)
        .order("sort_order"),
      client
        .from("cards")
        .select("*")
        .eq("is_published", true)
        .order("sort_order"),
    ]);

    if (settingsResult.data) {
      setSettings(mapSettings(settingsResult.data as SiteSettingsRow));
    }

    if (!profilesResult.error && profilesResult.data?.length) {
      setProfiles((profilesResult.data as ProfileRow[]).map(mapProfile));
    }

    if (!cardsResult.error && cardsResult.data) {
      const mappedCards = (cardsResult.data as CardRow[]).map((card) => {
        let destination = card.external_url || "";
        if (!destination && card.storage_path) {
          destination = client.storage
            .from("omarkez-media")
            .getPublicUrl(card.storage_path).data.publicUrl;
        }

        return {
          id: card.id,
          profileId: card.profile_id,
          title: card.title,
          description: card.description,
          buttonLabel: card.button_label,
          kind: card.kind,
          image: card.image_url,
          url: allowedLink(destination),
          fileName: card.file_name,
          openInNewTab: card.open_in_new_tab,
        } satisfies ContentCard;
      });
      setCards(mappedCards.filter((card) => card.url));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      await loadSiteData();
      const client = getSupabaseBrowserClient();
      if (!client) return;

      const { data: userData } = await client.auth.getUser();
      if (!active || !userData.user) return;

      const { data: membership } = await client
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (active && membership) setAdminAuthenticated(true);
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [loadSiteData]);

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  const selectedCards = useMemo(
    () => cards.filter((card) => card.profileId === selectedProfile?.id),
    [cards, selectedProfile],
  );

  function openProfile(profile: Profile) {
    const destination = allowedLink(profile.href);
    if (destination) {
      window.location.assign(destination);
      return;
    }
    setSelectedProfile(profile);
    setDialog("profile");
  }

  function goToSlide(index: number) {
    const next = Math.max(0, Math.min(index, totalSlides - 1));
    const slide = carouselRef.current?.children[next] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveSlide(next);
  }

  function syncActiveSlide() {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    const slides = Array.from(carousel.children) as HTMLElement[];
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const nextDistance = Math.abs(center - slideCenter);
      if (nextDistance < distance) {
        distance = nextDistance;
        closest = index;
      }
    });
    setActiveSlide(closest);
  }

  async function loginAdmin(event: React.FormEvent) {
    event.preventDefault();
    setAdminLoading(true);
    setAdminError("");

    const client = getSupabaseBrowserClient();
    if (!client) {
      setAdminError("Supabase não configurado no Vercel.");
      setAdminLoading(false);
      return;
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminPassword,
    });

    if (error || !data.user) {
      setAdminError("E-mail ou senha incorretos.");
      setAdminLoading(false);
      return;
    }

    const { data: membership } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!membership) {
      await client.auth.signOut();
      setAdminError("Este usuário não está autorizado como administrador.");
      setAdminLoading(false);
      return;
    }

    setAdminAuthenticated(true);
    setDialog(null);
    setAdminPassword("");
    setAdminLoading(false);
  }

  async function exitAdmin() {
    const client = getSupabaseBrowserClient();
    await client?.auth.signOut();
    setAdminAuthenticated(false);
    await loadSiteData();
  }

  if (adminAuthenticated) {
    return <AdminPanel onExit={exitAdmin} />;
  }

  return (
    <main
      className={settings.motion ? "profile-shell" : "profile-shell reduced-motion"}
      style={{ "--red": settings.accent } as React.CSSProperties}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="brand" aria-label={settings.handle}>
        <span className="brand-mark">O</span>
        <span className="brand-name">{settings.handle}</span>
      </header>

      <section className="profile-picker" aria-label="Seleção de perfis">
        <div className="heading-block">
          <p className="subtitle">{settings.subtitle}</p>
        </div>

        <div className="carousel-wrap">
          <button
            className="carousel-arrow carousel-arrow-left"
            onClick={() => goToSlide(activeSlide - 1)}
            disabled={activeSlide === 0}
            aria-label="Perfil anterior"
          >
            ‹
          </button>
          <div
            className="profiles"
            role="list"
            ref={carouselRef}
            onScroll={syncActiveSlide}
            aria-label="Perfis disponíveis"
          >
            {profiles.map((profile, index) => (
              <button
                className={
                  index === activeSlide
                    ? "profile-card profile-card-active"
                    : "profile-card"
                }
                key={profile.id}
                onClick={() => openProfile(profile)}
                role="listitem"
                aria-label={
                  profile.href
                    ? "Entrar em contato pelo WhatsApp"
                    : `Abrir perfil ${profile.name}`
                }
                style={{ "--delay": `${index * 80}ms` } as React.CSSProperties}
              >
                <span className="portrait">
                  {/* Imagens administráveis podem vir do Storage ou de URLs externas. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={
                      profile.slug === "contato-whatsapp"
                        ? "portrait-image portrait-image-contact"
                        : "portrait-image"
                    }
                    src={profile.image}
                    alt=""
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  {profile.slug === "contato-whatsapp" && (
                    <span className="contact-badge">FALE COMIGO</span>
                  )}
                  <span className="portrait-shine" />
                </span>
                <span className="profile-name">{profile.name}</span>
              </button>
            ))}
            <button
              className={
                activeSlide === profiles.length
                  ? "profile-card add-profile-card profile-card-active"
                  : "profile-card add-profile-card"
              }
              onClick={() => setDialog("add")}
              role="listitem"
              aria-label="Adicionar novo perfil"
            >
              <span className="portrait add-portrait">
                <span className="large-plus" aria-hidden="true">+</span>
                <span className="add-caption">NOVO PERFIL</span>
              </span>
              <span className="profile-name">Adicionar perfil</span>
            </button>
          </div>
          <button
            className="carousel-arrow carousel-arrow-right"
            onClick={() => goToSlide(activeSlide + 1)}
            disabled={activeSlide === totalSlides - 1}
            aria-label="Próximo perfil"
          >
            ›
          </button>
        </div>

        <div className="carousel-dots" aria-label={`Item ${activeSlide + 1} de ${totalSlides}`}>
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              className={index === activeSlide ? "dot dot-active" : "dot"}
              onClick={() => goToSlide(index)}
              aria-label={`Ir para item ${index + 1}`}
            />
          ))}
        </div>

        <div className="profile-actions">
          <button className="manage-action" onClick={() => setDialog("manage")}>
            Gerenciar perfis
          </button>
        </div>
      </section>

      <footer>{settings.footerText}</footer>

      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section
            className={dialog === "profile" ? "modal profile-modal" : "modal"}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setDialog(null)}
              aria-label="Fechar"
            >
              ×
            </button>

            {dialog === "manage" && (
              <>
                <span className="modal-icon">•••</span>
                <h2 id="modal-title">Acesso do superusuário</h2>
                <p>Entre com o usuário administrativo criado no Supabase.</p>
                <form onSubmit={loginAdmin}>
                  <label htmlFor="email">E-mail administrativo</label>
                  <input
                    id="email"
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="username"
                    autoFocus
                  />
                  <label className="password-label" htmlFor="password">Senha</label>
                  <input
                    id="password"
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                  />
                  {adminError && <span className="login-error" role="alert">{adminError}</span>}
                  <button
                    className="modal-primary"
                    disabled={!adminEmail || !adminPassword || adminLoading}
                  >
                    {adminLoading ? "Conectando..." : "Acessar painel"}
                  </button>
                </form>
                <small>Login e alterações protegidos pelo Supabase Auth e RLS.</small>
              </>
            )}

            {dialog === "add" && (
              <>
                <span className="modal-icon">+</span>
                <h2 id="modal-title">Novo perfil</h2>
                <p>Entre no painel de superusuário para criar e publicar um novo perfil.</p>
                <button className="modal-primary" onClick={() => setDialog("manage")}>
                  Entrar no painel
                </button>
              </>
            )}

            {dialog === "profile" && selectedProfile && (
              <>
                <span className="modal-icon">▶</span>
                <h2 id="modal-title">{selectedProfile.name}</h2>
                {selectedCards.length === 0 ? (
                  <p>Nenhum conteúdo publicado neste perfil ainda.</p>
                ) : (
                  <div className="profile-content-list">
                    {selectedCards.map((card) => (
                      <a
                        className="profile-content-card"
                        href={card.url}
                        key={card.id}
                        target={card.openInNewTab ? "_blank" : undefined}
                        rel={card.openInNewTab ? "noreferrer" : undefined}
                        download={card.kind === "download" ? card.fileName || true : undefined}
                      >
                        <span
                          className={`profile-content-image${card.image ? "" : " profile-content-image-fallback"}`}
                          style={card.image ? { backgroundImage: `url(${card.image})` } : undefined}
                        >
                          {!card.image && (card.kind === "download" ? "↓" : "↗")}
                        </span>
                        <span className="profile-content-copy">
                          <strong>{card.title}</strong>
                          {card.description && <small>{card.description}</small>}
                        </span>
                        <span className="profile-content-action">
                          {card.kind === "download" ? "↓" : "↗"} {card.buttonLabel}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
