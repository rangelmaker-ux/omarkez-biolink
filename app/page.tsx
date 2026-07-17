"use client";

import { useEffect, useRef, useState } from "react";
import { AdminPanel } from "./AdminPanel";

const LOCAL_ADMIN_PASSWORD_HASH =
  "7daa1b2b4e91b247ae0fecb856e9a08f00d1e1a7193273419e9819504b73152e";

type Profile = {
  id: string;
  name: string;
  shortName: string;
  image: string;
  href?: string;
};

const profiles: Profile[] = [
  {
    id: "luts",
    name: "LUTs",
    shortName: "LUTs",
    image: "/profile-luts.png",
  },
  {
    id: "sony",
    name: "Configurações Sony ZV-E10 Mark II",
    shortName: "ZV-E10",
    image: "/profile-sony-zve10.png",
  },
  {
    id: "blackmagic",
    name: "Configurações Blackmagic Cam",
    shortName: "BMC",
    image: "/profile-blackmagic.png",
  },
  {
    id: "contact",
    name: "Contato • WhatsApp",
    shortName: "WhatsApp",
    image: "/profile-contact.jpg",
    href:
      "https://wa.me/5566992352452?text=Ol%C3%A1%21%20Vim%20pelo%20seu%20perfil%20e%20gostaria%20de%20solicitar%20um%20or%C3%A7amento.",
  },
];

export default function Home() {
  const [dialog, setDialog] = useState<"manage" | "add" | "profile" | null>(
    null,
  );
  const [selectedProfile, setSelectedProfile] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const totalSlides = profiles.length + 1;

  useEffect(() => {
    setAdminAuthenticated(sessionStorage.getItem("omarkez-admin-session") === "active");
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  function openProfile(profile: Profile) {
    if (profile.href) {
      window.location.assign(profile.href);
      return;
    }
    setSelectedProfile(profile.name);
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
    const bytes = new TextEncoder().encode(adminPassword);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    if (hash === LOCAL_ADMIN_PASSWORD_HASH) {
      sessionStorage.setItem("omarkez-admin-session", "active");
      setAdminAuthenticated(true);
      setDialog(null);
      setAdminPassword("");
    } else {
      setAdminError("Senha incorreta. Tente novamente.");
    }
    setAdminLoading(false);
  }

  function exitAdmin() {
    sessionStorage.removeItem("omarkez-admin-session");
    setAdminAuthenticated(false);
  }

  if (adminAuthenticated) {
    return <AdminPanel onExit={exitAdmin} />;
  }

  return (
    <main className="profile-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="brand" aria-label="@omarkez_">
        <span className="brand-mark">O</span>
        <span className="brand-name">@omarkez_</span>
      </header>

      <section className="profile-picker" aria-label="Seleção de perfis">
        <div className="heading-block">
          <p className="subtitle">Toque em um perfil para acessar os conteúdos.</p>
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
                <img
                  className={
                    profile.id === "contact"
                      ? "portrait-image portrait-image-contact"
                      : "portrait-image"
                  }
                  src={profile.image}
                  alt=""
                  loading={index === 0 ? "eager" : "lazy"}
                />
                {profile.id === "contact" && (
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

      <footer>Conteúdo e configurações por @omarkez_</footer>

      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section
            className="modal"
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
                <p>
                  Entre para testar o painel administrativo local. A proteção
                  definitiva será ativada no servidor com o Supabase.
                </p>
                <form onSubmit={loginAdmin}>
                  <label htmlFor="password">Senha administrativa</label>
                  <input
                    id="password"
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    autoFocus
                  />
                  {adminError && <span className="login-error" role="alert">{adminError}</span>}
                  <button className="modal-primary" disabled={!adminPassword || adminLoading}>
                    {adminLoading ? "Verificando..." : "Acessar painel"}
                  </button>
                </form>
                <small>Modo de demonstração: dados salvos somente neste navegador.</small>
              </>
            )}

            {dialog === "add" && (
              <>
                <span className="modal-icon">+</span>
                <h2 id="modal-title">Novo perfil</h2>
                <p>
                  Em breve você poderá criar novos perfis pelo painel de
                  superusuário.
                </p>
                <button className="modal-primary" onClick={() => setDialog(null)}>
                  Entendi
                </button>
              </>
            )}

            {dialog === "profile" && (
              <>
                <span className="modal-icon">▶</span>
                <h2 id="modal-title">{selectedProfile}</h2>
                <p>
                  Este perfil está pronto para receber os cards, links, imagens
                  e arquivos para download.
                </p>
                <button className="modal-primary" onClick={() => setDialog(null)}>
                  Continuar
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
