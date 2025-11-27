import fs from "fs";

export function getMusic(_req, res) {
  const music = JSON.parse(
    fs.readFileSync(new URL("./data/music.json", import.meta.url), "utf-8")
  );

  res.json({ music });
}

