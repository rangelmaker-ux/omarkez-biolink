"use client";

import { useEffect, useRef, useState } from "react";

const profiles = [
  {
    id: "luts",
    name: "LUTs",
    shortName: "LUTs",
    image: "/profile-luts.png",
  },
  {
    id: "sony",
    name: "Configurações Sony ZV-10 Mark II",
    shortName: "ZV-10",
    image: "/profile-sony-zv10.png",
  },
  {
    id: "blackmagic",
    name: "Configurações Blackmagic Cam",
    shortName: "BMC",
    image: "/profile-blackmagic.png",
  },
];

export default function Home() {
  const [dialog, setDialog] = useState<"manage" | "add" | "profile" | null>(
    null,
  );
  const [selectedProfile, setSelectedProfile] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const totalSlides = profiles.length + 1;

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  function openProfile(name: string) {
    setSelectedProfile(name);
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

  return (
    <main className="profile-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="brand" aria-label="@omarkez_">
        <span className="brand-mark">O</span>
        <span className="brand-name">@omarkez_</span>
      </header>

      <section className="profile-picker" aria-labelledby="picker-title">
        <div className="heading-block">
          <p className="eyebrow">ESCOLHA SUA EXPERIÊNCIA</p>
          <h1 id="picker-title">Quem está assistindo?</h1>
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
              className="profile-card"
              key={profile.id}
              onClick={() => openProfile(profile.name)}
              role="listitem"
              aria-label={`Abrir perfil ${profile.name}`}
              style={{ "--delay": `${index * 80}ms` } as React.CSSProperties}
            >
              <span className="portrait">
                <img
                  className="portrait-image"
                  src={profile.image}
                  alt=""
                  loading={index === 0 ? "eager" : "lazy"}
                />
                <span className="portrait-shine" />
              </span>
              <span className="profile-name">{profile.name}</span>
            </button>
          ))}
            <button
              className="profile-card add-profile-card"
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
                <h2 id="modal-title">Área de gerenciamento</h2>
                <p>
                  O acesso de superusuário será protegido pela senha que você
                  definir.
                </p>
                <label htmlFor="password">Senha</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Aguardando configuração"
                  disabled
                />
                <button className="modal-primary" disabled>
                  Acessar painel
                </button>
                <small>A senha será ativada na próxima etapa.</small>
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
