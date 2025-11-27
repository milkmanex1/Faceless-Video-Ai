import fs from "fs";
const voices = JSON.parse(
  fs.readFileSync(new URL("./data/voices.json", import.meta.url), "utf-8")
);
export function getVoices(_req, res) {
  res.json({ voices });
}
