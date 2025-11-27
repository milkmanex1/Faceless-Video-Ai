import fs from "fs";

export function getArtStyles(_req, res) {
  const artStyles = JSON.parse(
    fs.readFileSync(new URL("./data/artStyles.json", import.meta.url), "utf-8")
  );

  res.json({ artStyles });
}

