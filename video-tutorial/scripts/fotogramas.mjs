// Renderiza fotogramas sueltos para revisar el video: node scripts/fotogramas.mjs <segundo> <segundo> ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const segundos = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "ComoPedir" });
for (const s of segundos) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
  await renderStill({ composition, serveUrl, frame, output: `out/fotogramas/${String(s).replace(".", "_")}.jpg`, imageFormat: "jpeg", scale: 0.5 });
  console.log("listo", s);
}
