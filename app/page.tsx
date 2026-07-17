"use client";

import { useEffect, useState } from "react";

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

  return (
    <main className="profile-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="brand" aria-label="O Markez">
        <span className="brand-mark">O</span>
        <span className="brand-name">MARKEZ</span>
      </header>

      <section className="profile-picker" aria-labelledby="picker-title">
        <div className="heading-block">
          <p className="eyebrow">ESCOLHA SUA EXPERIÊNCIA</p>
          <h1 id="picker-title">Quem está assistindo?</h1>
          <p className="subtitle">Toque em um perfil para acessar os conteúdos.</p>
        </div>

        <div className="profiles" role="list">
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
        </div>

        <div className="profile-actions">
          <button className="secondary-action" onClick={() => setDialog("add")}>
            <span className="plus" aria-hidden="true">+</span>
            Adicionar perfil
          </button>
          <button className="manage-action" onClick={() => setDialog("manage")}>
            Gerenciar perfis
          </button>
        </div>
      </section>

      <footer>Conteúdo e configurações por O Markez</footer>

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
