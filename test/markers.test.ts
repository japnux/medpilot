import { describe, expect, it } from "vitest";
import {
  computeReferenceZones,
  getMarkerConfig,
  getMarkerStatus,
  isOutOfRange,
} from "@/lib/markers";
import { CANCER_PROFILES } from "@/lib/cancer-profiles";

const cortico = CANCER_PROFILES.corticosurrenalome;

describe("getMarkerStatus — mitotanémie (target 14-20, alert 10-25)", () => {
  const mitotane = cortico.markers.mitotane;

  it("retourne normal dans la zone cible [14, 20]", () => {
    expect(getMarkerStatus(14, mitotane)).toBe("normal");
    expect(getMarkerStatus(17, mitotane)).toBe("normal");
    expect(getMarkerStatus(20, mitotane)).toBe("normal");
  });

  it("retourne warning entre cible et alerte (10 < v < 14 ou 20 < v < 25)", () => {
    expect(getMarkerStatus(12, mitotane)).toBe("warning");
    expect(getMarkerStatus(22, mitotane)).toBe("warning");
  });

  it("retourne critical hors zone d'alerte (< 10 ou > 25)", () => {
    expect(getMarkerStatus(8, mitotane)).toBe("critical");
    expect(getMarkerStatus(30, mitotane)).toBe("critical");
  });

  it("inclut les seuils alerte comme normal/warning, pas critical", () => {
    // alert_min = 10 → 10 doit être warning (>=alert_min) pas critical (<alert_min)
    expect(getMarkerStatus(10, mitotane)).toBe("warning");
    expect(getMarkerStatus(25, mitotane)).toBe("warning");
  });
});

describe("getMarkerStatus — cortisol (alert_max null)", () => {
  const cortisol = cortico.markers.cortisol;

  it("ne déclenche jamais critical sur la borne haute (alert_max null)", () => {
    // target_max = 500, alert_max = null
    expect(getMarkerStatus(700, cortisol)).toBe("warning");
    expect(getMarkerStatus(5000, cortisol)).toBe("warning");
  });

  it("déclenche critical en-dessous d'alert_min", () => {
    // alert_min = 50
    expect(getMarkerStatus(30, cortisol)).toBe("critical");
  });
});

describe("getMarkerStatus — ALAT (target_max only)", () => {
  const alat = cortico.markers.alat;

  it("normal si <= target_max", () => {
    expect(getMarkerStatus(20, alat)).toBe("normal");
    expect(getMarkerStatus(40, alat)).toBe("normal");
  });

  it("warning entre target_max et alert_max", () => {
    expect(getMarkerStatus(80, alat)).toBe("warning");
  });

  it("critical au-dessus d'alert_max", () => {
    expect(getMarkerStatus(150, alat)).toBe("critical");
  });
});

describe("getMarkerStatus — DHEA-S (aucun seuil)", () => {
  const dhea = cortico.markers.dhea_s;

  it("retourne toujours normal si aucun target/alert défini", () => {
    expect(getMarkerStatus(0, dhea)).toBe("normal");
    expect(getMarkerStatus(100, dhea)).toBe("normal");
    expect(getMarkerStatus(99999, dhea)).toBe("normal");
  });
});

describe("isOutOfRange", () => {
  it("true pour warning et critical", () => {
    expect(isOutOfRange(8, cortico.markers.mitotane)).toBe(true);
    expect(isOutOfRange(12, cortico.markers.mitotane)).toBe(true);
  });
  it("false pour normal", () => {
    expect(isOutOfRange(17, cortico.markers.mitotane)).toBe(false);
  });
});

describe("getMarkerConfig", () => {
  it("trouve un marqueur connu", () => {
    const m = getMarkerConfig("corticosurrenalome", "mitotane");
    expect(m).not.toBeNull();
    expect(m?.label).toBe("Mitotanémie");
    expect(m?.unit).toBe("mg/L");
  });

  it("retourne null pour un cancer inconnu", () => {
    expect(getMarkerConfig("inconnu", "mitotane")).toBeNull();
  });

  it("retourne null pour un marqueur inconnu", () => {
    expect(getMarkerConfig("corticosurrenalome", "inexistant")).toBeNull();
  });

  it("utilise custom_markers pour le profil custom", () => {
    const custom = {
      glycemie: {
        label: "Glycémie",
        unit: "g/L",
        target_min: 0.7,
        target_max: 1.1,
        color: "#000",
      },
    };
    const m = getMarkerConfig("custom", "glycemie", custom);
    expect(m?.label).toBe("Glycémie");
  });
});

describe("computeReferenceZones", () => {
  it("génère 4 zones pour mitotane (target + alert min/max)", () => {
    const zones = computeReferenceZones(cortico.markers.mitotane);
    expect(zones).toHaveLength(4);
    expect(zones.filter((z) => z.level === "target")).toHaveLength(2);
    expect(zones.filter((z) => z.level === "alert")).toHaveLength(2);
  });

  it("génère 2 zones pour ALAT (target_max + alert_max seulement)", () => {
    const zones = computeReferenceZones(cortico.markers.alat);
    expect(zones).toHaveLength(2);
  });

  it("génère 0 zone pour un marqueur sans seuil", () => {
    expect(computeReferenceZones(cortico.markers.dhea_s)).toHaveLength(0);
  });
});
