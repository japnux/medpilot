"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FileSearch,
  TestTube,
  Stethoscope,
  GitBranch,
  Pill,
  Calendar,
  Telescope,
  HelpCircle,
  Compass,
  Settings,
  Sparkles,
  Mail,
  Users,
  Lightbulb,
} from "lucide-react";

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
  intro: string;
  items: { q: string; a: React.ReactNode }[];
}

/**
 * Page d'aide MedPilot : FAQ par feature, mobile-first, ancres scrollables.
 */
export default function HelpClient() {
  const sections: Section[] = [
    {
      id: "demarrage",
      label: "Démarrer avec MedPilot",
      icon: <Compass className="w-4 h-4" />,
      intro:
        "MedPilot accompagne un patient et sa famille tout au long du parcours oncologique : tu centralises documents, symptômes, médicaments, décisions, et l'IA aide à structurer et préparer les consultations.",
      items: [
        {
          q: "Par quoi commencer ?",
          a: (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Va dans <Pill className="inline w-3 h-3" />{" "}
                <b>Médicaments</b> et ajoute les traitements en cours du patient.
              </li>
              <li>
                Va dans <FileSearch className="inline w-3 h-3" />{" "}
                <b>Analyser</b> et glisse un document récent (compte-rendu,
                bilan, ordonnance). L&apos;analyse Claude se lance, l&apos;équipe
                médicale et les décisions à trancher sont extraites automatiquement.
              </li>
              <li>
                Vérifie l&apos;équipe médicale extraite dans{" "}
                <Settings className="inline w-3 h-3" /> <b>Paramètres</b>{" "}
                (chaque médecin signataire d&apos;un document est ajouté
                automatiquement).
              </li>
              <li>
                Quand un RDV approche : prépare-le dans{" "}
                <Stethoscope className="inline w-3 h-3" /> <b>Consultation</b>.
              </li>
            </ol>
          ),
        },
        {
          q: "Quelles données sont privées ?",
          a: (
            <>
              <p>
                Tout ce que tu saisis appartient à la <b>famille</b> à laquelle
                tu es lié(e). Seuls les membres explicitement invités peuvent
                voir tes données médicales. La sécurité est appliquée au niveau
                base (RLS Supabase) — pas de fuite côté API possible.
              </p>
              <p className="mt-2 text-muted">
                Les notes restent personnelles par défaut (toi seul les vois) ;
                tu peux activer un partage famille au cas par cas.
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: "analyzer",
      label: "Analyser un document",
      icon: <FileSearch className="w-4 h-4" />,
      intro:
        "Importe n'importe quel document médical (PDF ou photo). Claude l'analyse, vulgarise pour la famille, extrait les valeurs clés, les questions à poser à l'équipe et les décisions à trancher.",
      items: [
        {
          q: "Quels types de documents je peux importer ?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Anapath, biologie, imagerie, comptes-rendus, RCP</li>
              <li>Courriers, ordonnances, documents génétiques</li>
              <li>PDF (avec texte ou scan), photos</li>
            </ul>
          ),
        },
        {
          q: "Comment ça marche concrètement ?",
          a: (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <FileSearch className="inline w-3 h-3" /> <b>Analyser</b> →
                glisse ton fichier
              </li>
              <li>
                Claude lit le document (Opus 4.7) et produit 4 onglets :
                résumé famille, synthèse clinique, points clés, questions pour
                l&apos;équipe.
              </li>
              <li>
                Clique sur <b>Enregistrer</b> pour stocker l&apos;analyse,
                créer un événement timeline, et ajouter les décisions
                soulevées dans <GitBranch className="inline w-3 h-3" />{" "}
                <b>Décisions</b>.
              </li>
            </ol>
          ),
        },
        {
          q: "Le médecin signataire est-il enregistré quelque part ?",
          a: (
            <p>
              Oui — le nom + la spécialité + l&apos;hôpital sont extraits du
              document et ajoutés automatiquement à ton équipe médicale (visible
              dans <Settings className="inline w-3 h-3" /> Paramètres). Pas de
              doublon : si le médecin existe déjà, on enrichit ses infos
              uniquement si elles étaient manquantes.
            </p>
          ),
        },
        {
          q: "Si c&apos;est une biologie, qu'est-ce qui se passe ?",
          a: (
            <p>
              Les valeurs sont extraites vers le module{" "}
              <TestTube className="inline w-3 h-3" /> <b>Biologie</b> avec
              normalisation des marqueurs. Tu retrouves les tendances et les
              alertes au-delà des cibles thérapeutiques.
            </p>
          ),
        },
      ],
    },
    {
      id: "biologie",
      label: "Biologie",
      icon: <TestTube className="w-4 h-4" />,
      intro:
        "Tendances et alertes sur les marqueurs biologiques du patient. Auto-alimenté par les bilans bio analysés.",
      items: [
        {
          q: "Comment ajouter des résultats ?",
          a: (
            <p>
              Soit en analysant un bilan via{" "}
              <FileSearch className="inline w-3 h-3" /> Analyser, soit en
              saisissant manuellement depuis le tab{" "}
              <b>Marqueurs</b> ou la page détail d&apos;un marqueur.
            </p>
          ),
        },
        {
          q: "Que veulent dire les couleurs ?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-success">Vert</span> : dans la plage
                optimale
              </li>
              <li>
                <span className="text-warning">Orange</span> : à surveiller
              </li>
              <li>
                <span className="text-error">Rouge</span> : hors normes,
                discussion avec l&apos;équipe nécessaire
              </li>
            </ul>
          ),
        },
        {
          q: "Pourquoi un marqueur cardiologique apparait alors qu'on est en onco ?",
          a: (
            <p>
              Le système ajoute tous les marqueurs présents dans les bilans
              analysés. La description de chaque marqueur est{" "}
              <b>contextualisée par le cancer du patient</b> (ex : β-HCG est
              décrit comme marqueur tumoral, pas comme hormone de grossesse,
              pour un patient avec corticosurrénalome).
            </p>
          ),
        },
      ],
    },
    {
      id: "consultation",
      label: "Préparer une consultation",
      icon: <Stethoscope className="w-4 h-4" />,
      intro:
        "Avant un RDV : Claude génère des questions ciblées basées sur le profil, les derniers documents, la biologie, les symptômes et les décisions en attente.",
      items: [
        {
          q: "Comment préparer un RDV ?",
          a: (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <Stethoscope className="inline w-3 h-3" /> <b>Consultation</b> →{" "}
                <b>+ Préparer une consultation</b>
              </li>
              <li>
                Renseigne le type (oncologie, endocrino…), la date, le médecin
                (autocomplete depuis ton équipe), des points libres
              </li>
              <li>
                Clique <b>Générer la préparation</b> — Claude Haiku 4.5 lit
                tout le contexte du patient et produit ~10 questions
                priorisées + documents à apporter + décisions attendues
              </li>
              <li>
                <b>Enregistrer</b> pour créer la consultation et la planifier
                sur la timeline
              </li>
            </ol>
          ),
        },
        {
          q: "Pourquoi mes décisions « en attente équipe » sont prises en compte automatiquement ?",
          a: (
            <p>
              Si tu as marqué une décision comme <b>À poser à l&apos;équipe</b>{" "}
              et que tu l&apos;as liée à cette consultation, Claude génère
              <b> systématiquement </b>
              une question pour la couvrir.
            </p>
          ),
        },
        {
          q: "Qu'est-ce qui se passe pendant et après le RDV ?",
          a: (
            <p>
              Tu peux ouvrir la fiche consultation depuis la timeline et noter
              décisions prises et actions de suivi. Les décisions{" "}
              <b>tranchées</b> apparaissent dans la timeline et ne seront plus
              reposées en question à la prochaine prep.
            </p>
          ),
        },
      ],
    },
    {
      id: "decisions",
      label: "Décisions",
      icon: <GitBranch className="w-4 h-4" />,
      intro:
        "Cockpit des choix à trancher : inclusion essai clinique, traitement A vs B, examen complémentaire, second avis, etc.",
      items: [
        {
          q: "D'où viennent les décisions ?",
          a: (
            <p>
              Claude les extrait automatiquement quand tu analyses un
              document. Tu peux aussi en ajouter manuellement (à venir).
              Chaque décision conserve un lien vers sa source (document
              cliquable).
            </p>
          ),
        },
        {
          q: "Que veulent dire les statuts ?",
          a: (
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>À trancher</b> (pending) : choix soulevé, pas encore décidé
              </li>
              <li>
                <b>Attente équipe</b> : à poser lors d&apos;une consultation
                précise — sera injecté dans la prep
              </li>
              <li>
                <b>Attente résultat</b> : on attend un examen en cours pour
                décider (ex : statut MGMT)
              </li>
              <li>
                <b>Décidée</b> : tranchée, avec l&apos;option choisie, le
                rationale, qui a décidé et quand
              </li>
              <li>
                <b>Caduque</b> : plus d&apos;objet (ex : décision pré-op après
                chirurgie effectuée)
              </li>
            </ul>
          ),
        },
        {
          q: "Comment acter une décision ?",
          a: (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Clique <b>Acter</b> sur la décision
              </li>
              <li>
                Choisis le chemin parmi les 4 :{" "}
                <b>Décidée</b> / <b>Équipe</b> / <b>Réponse</b> / <b>Caduque</b>
              </li>
              <li>Remplis le formulaire (rationale, qui, date)</li>
              <li>
                Enregistre — un événement <i>Décision</i> est ajouté à la
                timeline
              </li>
            </ol>
          ),
        },
        {
          q: "Le système détecte les décisions obsolètes ?",
          a: (
            <p>
              Oui : 4 signaux automatiques (échéance &gt; 30j, chirurgie passée
              alors que la décision était pré-op, 2+ consults passées sans
              action, date explicite dépassée). Tu vois une bannière
              «&nbsp;Possiblement caduque&nbsp;» et le chemin <b>Caduque</b>{" "}
              est pré-sélectionné. Tu peux aussi tout archiver en lot depuis
              le compteur «&nbsp;Obsolètes&nbsp;».
            </p>
          ),
        },
      ],
    },
    {
      id: "symptomes",
      label: "Symptômes & check-in quotidien",
      icon: <span className="text-base leading-none">🌡️</span>,
      intro:
        "Track quotidien de l'état du patient (bien-être, symptômes, signes vitaux) avec détection des red flags spécifiques au cancer du patient.",
      items: [
        {
          q: "À quoi sert le check-in ?",
          a: (
            <p>
              Capturer en 1-2 min l&apos;état du patient chaque jour : score
              bien-être (1-5 emoji), symptômes ressentis, signes vitaux (TA,
              poids, température, FC, SpO₂). Sert à la fois pour le suivi
              long terme et pour alimenter la prep consultation.
            </p>
          ),
        },
        {
          q: "Comment faire un check-in rapide ?",
          a: (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Sidebar 🌡️ <b>Symptômes</b> → <b>+ Check-in</b>
              </li>
              <li>Choisis l&apos;emoji qui correspond au bien-être du jour</li>
              <li>
                Clique les chips symptômes ressentis — celles en{" "}
                <span className="text-purple-600">violet</span> sont les
                effets indésirables connus du traitement en cours
              </li>
              <li>
                Ajuste la sévérité (slider 0-10), ajoute une mesure vitale si
                besoin, ajoute une note libre
              </li>
              <li>
                <b>Enregistrer le check-in</b>
              </li>
            </ol>
          ),
        },
        {
          q: "Qu'est-ce qu'un red flag ?",
          a: (
            <>
              <p>
                Un signe d&apos;alerte clinique défini par la knowledge base
                du cancer (ex : pour un patient sous mitotane, le combo
                «&nbsp;hypotension + asthénie + fièvre&nbsp;» évoque une crise
                surrénale).
              </p>
              <p className="mt-2">
                Si tes derniers symptômes correspondent à un red flag :
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>
                  Encart rouge bloquant avec la conduite à tenir +{" "}
                  <b>boutons d&apos;appel 15 et 112</b>
                </li>
                <li>Le symptôme est marqué critique</li>
                <li>
                  Bandeau persistant sur la page tant que tu n&apos;as pas
                  cliqué <b>Résolu</b>
                </li>
                <li>Badge rouge sur l&apos;entrée Symptômes du menu</li>
              </ul>
            </>
          ),
        },
        {
          q: "Comment supprimer un check-in saisi par erreur ?",
          a: (
            <p>
              Sur l&apos;historique <b>/symptoms</b>, chaque ligne a une
              icône poubelle 🗑️ à droite. Clic → confirm → suppression.
            </p>
          ),
        },
      ],
    },
    {
      id: "medications",
      label: "Médicaments",
      icon: <Pill className="w-4 h-4" />,
      intro:
        "Liste des traitements du patient (actifs, planifiés, suspendus, arrêtés). Avec autocomplete depuis une base de référence (Vidal/Wikipédia/ANSM) et historique des changements de dose.",
      items: [
        {
          q: "Comment ajouter un médicament ?",
          a: (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <Pill className="inline w-3 h-3" /> <b>Médicaments</b> →{" "}
                <b>+ Ajouter</b>
              </li>
              <li>
                Tape le nom — si on a une référence (ex : mitotane,
                hydrocortisone, sertraline), liens officiels + effets
                indésirables courants se pré-remplissent
              </li>
              <li>
                Renseigne dosage, posologie, indication, prescripteur (depuis
                ton équipe), date de début
              </li>
              <li>Statut : Actif / Planifié / Suspendu / Arrêté</li>
            </ol>
          ),
        },
        {
          q: "Comment gérer un changement de dose (titration hydrocortisone par ex) ?",
          a: (
            <>
              <p>
                Sur la carte du médicament, clique <b>Modifier la dose</b>{" "}
                (icône 📈). Tu renseignes :
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>Nouvelle dose et posologie (optionnelle)</li>
                <li>Date du changement</li>
                <li>Raison clinique (ex : asthénie fin de journée)</li>
                <li>Prescripteur</li>
              </ul>
              <p className="mt-2">À l&apos;enregistrement :</p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>L&apos;ancienne dose est archivée dans l&apos;historique</li>
                <li>La dose courante est mise à jour</li>
                <li>
                  Un événement <i>Ajustement traitement</i> est ajouté à la
                  timeline
                </li>
                <li>
                  Claude voit la chronologie complète à la prochaine prep
                  consultation
                </li>
              </ul>
            </>
          ),
        },
        {
          q: "Où voir l'historique des doses d'un médicament ?",
          a: (
            <p>
              Sous chaque carte, déplie la section{" "}
              <b>Historique des doses (N)</b> — chaque entrée affiche la date,
              la transition (ex : 30 mg → 20 mg), la raison et le prescripteur.
            </p>
          ),
        },
      ],
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: <Calendar className="w-4 h-4" />,
      intro:
        "Vue chronologique unifiée du parcours : chirurgie, consultations, bilans, documents, décisions, ajustements de traitement.",
      items: [
        {
          q: "Qu'est-ce qui apparait sur la timeline ?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Chirurgie, consultations, hospitalisations</li>
              <li>Documents analysés (avec lien direct)</li>
              <li>Décisions actées</li>
              <li>Ajustements de traitement</li>
              <li>Événements RCP, essais cliniques</li>
            </ul>
          ),
        },
        {
          q: "Pourquoi certaines cartes ont un badge « N décisions » ?",
          a: (
            <p>
              Quand un document ou une consultation a fait émerger des
              décisions, on affiche un pill violet/orange :{" "}
              <b>2/3 décisions</b> = 2 en attente sur 3 totales. Orange si
              pending, violet si toutes actées. Clique sur la carte pour aller
              les voir.
            </p>
          ),
        },
      ],
    },
    {
      id: "watch",
      label: "Veille",
      icon: <Telescope className="w-4 h-4" />,
      intro:
        "Veille personnalisée : essais cliniques actifs, publications récentes, centres experts, recommandations émergentes — adaptée au cancer du patient et à ses traitements.",
      items: [
        {
          q: "Quand est-ce que la veille est mise à jour ?",
          a: (
            <p>
              À la demande, via le bouton <b>Rafraîchir la veille</b>. Le
              résultat est mis en cache (~7j) pour limiter le coût. Si tu
              ajoutes un médicament ou un événement majeur, relance la veille
              pour que la recherche tienne compte du nouveau contexte.
            </p>
          ),
        },
        {
          q: "À quoi servent les 4 onglets ?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Synthèse</b> : executive summary + Top priorités
              </li>
              <li>
                <b>Actions à mener</b> : recommandations concrètes à
                discuter
              </li>
              <li>
                <b>Réseau & ressources</b> : centres experts, contacts,
                associations
              </li>
              <li>
                <b>Publications</b> : articles scientifiques récents
                pertinents
              </li>
            </ul>
          ),
        },
      ],
    },
    {
      id: "cancer",
      label: "Fiche cancer",
      icon: <span className="text-base leading-none">🦀</span>,
      intro:
        "Knowledge base experte sur le cancer du patient : épidémiologie, staging, biomarqueurs, protocoles, red flags, surveillance.",
      items: [
        {
          q: "Quand consulter cette fiche ?",
          a: (
            <p>
              Pour comprendre le contexte médical général : qu&apos;est-ce que
              ce cancer, quels sont les traitements de référence, quels signes
              d&apos;alerte connaître, quels centres experts en France et en
              Europe. C&apos;est de la pédagogie pour la famille, pas un
              dossier patient.
            </p>
          ),
        },
        {
          q: "Comment est générée cette fiche ?",
          a: (
            <p>
              Par Claude Opus 4.7 avec recherche web temps réel, à la création
              de la famille (ou re-générée manuellement). Elle est partagée
              entre toutes les familles avec le même cancer (pas patient-
              spécifique) pour amortir le coût.
            </p>
          ),
        },
      ],
    },
    {
      id: "parametres",
      label: "Paramètres & équipe",
      icon: <Settings className="w-4 h-4" />,
      intro:
        "Profil patient, équipe médicale, invitations famille, préférences.",
      items: [
        {
          q: "Comment l'équipe médicale est-elle constituée ?",
          a: (
            <p>
              Auto-alimentée par les documents analysés (chaque médecin
              signataire est ajouté). Tu peux aussi en ajouter manuellement
              depuis le formulaire de consultation (bouton{" "}
              <b>+ Ajouter à l&apos;équipe</b>) ou depuis Paramètres. Les
              doublons sont gérés automatiquement (case-insensitive, sans
              accents, ignore Dr/Pr).
            </p>
          ),
        },
        {
          q: "Comment inviter un autre membre de la famille ?",
          a: (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <Settings className="inline w-3 h-3" /> <b>Paramètres</b> →
                section Famille
              </li>
              <li>Email du proche + rôle (patient / accompagnant / admin)</li>
              <li>
                Il reçoit un magic link, se connecte, et voit immédiatement la
                même famille
              </li>
            </ol>
          ),
        },
        {
          q: "Quelle différence entre les rôles ?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Patient</b> : peut tout voir et saisir
              </li>
              <li>
                <b>Accompagnant</b> : idem
              </li>
              <li>
                <b>Admin</b> : peut aussi supprimer des entrées
              </li>
            </ul>
          ),
        },
      ],
    },
    {
      id: "tips",
      label: "Astuces & raccourcis",
      icon: <Lightbulb className="w-4 h-4" />,
      intro: "Petits trucs qui font gagner du temps au quotidien.",
      items: [
        {
          q: "Les chiffres dans la sidebar, c'est quoi ?",
          a: (
            <ul className="list-disc pl-5 space-y-1">
              <li>
                🎯 Décisions : nombre de décisions en attente (statut pending)
              </li>
              <li>💊 Médicaments : nombre de médicaments actifs</li>
              <li>
                🌡️ Symptômes : nombre de symptômes critiques non résolus
                (rouge si &gt; 0)
              </li>
            </ul>
          ),
        },
        {
          q: "Comment lier une décision à un document ou une consult ?",
          a: (
            <p>
              C&apos;est automatique quand l&apos;extraction Claude la
              déclenche depuis un document. Tu peux aussi changer la
              consultation cible via le chemin <b>Attente équipe</b> dans le
              modal d&apos;actage.
            </p>
          ),
        },
        {
          q: "Comment Claude se contextualise pour ma situation ?",
          a: (
            <>
              <p>
                Chaque prompt IA injecte automatiquement :
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>Le profil cancer complet</li>
                <li>La knowledge base du cancer (staging, protocoles…)</li>
                <li>Les 5 derniers documents analysés</li>
                <li>
                  Les valeurs biologiques préoccupantes des 12 derniers mois
                </li>
                <li>Les symptômes des 14 derniers jours</li>
                <li>Les médicaments actifs + 6 derniers ajustements</li>
                <li>L&apos;équipe médicale connue</li>
                <li>Les décisions en attente et déjà tranchées</li>
              </ul>
            </>
          ),
        },
      ],
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8 pr-12 md:pr-6">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-5 h-5 text-purple-600" />
          <h1 className="text-2xl font-semibold text-ink">Aide & FAQ</h1>
        </div>
        <p className="text-sm text-muted">
          Tout ce qu&apos;il faut savoir pour utiliser MedPilot
          efficacement, organisé par feature.
        </p>
      </header>

      {/* Sommaire */}
      <nav className="rounded-lg border border-hairline bg-canvas-soft p-4">
        <p className="text-xs uppercase tracking-wider text-muted mb-2">
          Sommaire
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2 text-sm text-body hover:text-ink"
              >
                {s.icon}
                <span>{s.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {sections.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}

      {/* Footer help */}
      <footer className="rounded-xl border border-hairline bg-canvas-soft p-5 space-y-3">
        <h2 className="text-base font-medium text-ink flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          Encore une question ?
        </h2>
        <div className="space-y-1.5 text-sm text-body">
          <p className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted" />
            <a
              href="mailto:vidal.geoffrey@gmail.com"
              className="underline hover:text-ink"
            >
              vidal.geoffrey@gmail.com
            </a>
          </p>
          <p className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted" />
            <Link href="/settings" className="underline hover:text-ink">
              Inviter un proche
            </Link>{" "}
            <span className="text-muted">pour partager le suivi</span>
          </p>
          <p className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted" />
            <Link href="/changelog" className="underline hover:text-ink">
              Voir les nouveautés
            </Link>{" "}
            <span className="text-muted">de la dernière mise à jour</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <section id={section.id} className="scroll-mt-20 space-y-3">
      <header className="flex items-center gap-2 pb-2 border-b border-hairline">
        <span className="text-purple-600">{section.icon}</span>
        <h2 className="text-lg font-medium text-ink">{section.label}</h2>
      </header>
      <p className="text-sm text-muted">{section.intro}</p>
      <ul className="space-y-2">
        {section.items.map((it, i) => (
          <FaqItem key={i} q={it.q} a={it.a} />
        ))}
      </ul>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-hairline bg-surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-canvas-soft"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-ink">{q}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 text-sm text-body space-y-2">{a}</div>
      )}
    </li>
  );
}
