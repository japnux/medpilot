import { NextResponse, type NextRequest } from "next/server";

// Force runtime Node (pdf-parse n'est pas compatible Edge)
export const runtime = "nodejs";

/**
 * POST /api/claude/parse-pdf
 * Reçoit un fichier PDF multipart et retourne son texte extrait.
 * Fallback si l'extraction échoue : retour erreur 400 → le client bascule sur textarea.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier reçu" },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    // Import dynamique : évite le tree-shaking et le bundling Edge
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);

    return NextResponse.json({
      ok: true,
      text: result.text,
      pages: result.numpages,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec d'extraction PDF";
    return NextResponse.json(
      { error: `Impossible d'extraire le texte du PDF : ${msg}` },
      { status: 400 },
    );
  }
}
