import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const artStyles = JSON.parse(
  fs.readFileSync(new URL("./data/artStyles.json", import.meta.url), "utf-8")
);
// Load ffmpeg paths from .env (set in your .env file)
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TTS Rate limiting configuration based on subscription tier
const TTS_CONFIG = {
  // Adjust these values based on your ElevenLabs subscription:
  // - Free tier: DELAY_BETWEEN_REQUESTS: 3000 (3 seconds)
  // - Starter tier: DELAY_BETWEEN_REQUESTS: 1500 (1.5 seconds)
  // - Creator tier: DELAY_BETWEEN_REQUESTS: 1000 (1 second)
  // - Pro tier: DELAY_BETWEEN_REQUESTS: 500 (0.5 seconds)
  DELAY_BETWEEN_REQUESTS: 1500, // 1.5 seconds (increase for free tier, decrease for paid)
  MAX_RETRIES: 3,
  RATE_LIMIT_BACKOFF_MULTIPLIER: 2, // Exponential backoff multiplier
};

async function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function splitSentences(text) {
  return text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
}

function countWords(text) {
  // Remove extra whitespace and count words more accurately
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

async function addSentencePauses(text, voiceId, outputPath) {
  // Split text into sentences and add pauses between them
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const audioFiles = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (sentence.length === 0) continue;

    const tempAudioPath = outputPath.replace(".mp3", `_temp_${i}.mp3`);
    await generateTTS(sentence, voiceId, tempAudioPath, true); // Add pause after each sentence
    audioFiles.push(tempAudioPath);
  }

  // Concatenate all sentence audios
  const concatFile = outputPath.replace(".mp3", "_sentences.txt");
  const concatContent = audioFiles
    .map((f) => `file '${f.replace(/\\/g, "/")}'`)
    .join("\n");
  fs.writeFileSync(concatFile, concatContent);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .save(outputPath)
      .on("end", () => {
        // Clean up temporary files
        audioFiles.forEach((f) => {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        });
        if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
        resolve(outputPath);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("======================================");
        console.error("FFMPEG ERROR (scene):", err.message);
        console.error("---- STDERR ----");
        console.error(stderr);
        console.error("---- STDOUT ----");
        console.error(stdout);
        console.error("======================================");
        return reject(err);
      });
  });
}

async function groupSentencesIntoScenes(sentences, voiceId, videoDir) {
  const minSceneDuration = 4.5; // Minimum 4.5 seconds per scene
  const sceneGroups = [];
  let currentGroup = [];
  let currentDuration = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    // Generate temporary TTS to check duration
    const tempAudioPath = path.join(videoDir, `temp_${i}.mp3`);
    await generateTTS(sentence, voiceId, tempAudioPath, false);
    const sentenceDuration = await getAudioDuration(tempAudioPath);

    // Clean up temp file
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }

    currentGroup.push(sentence);
    currentDuration += sentenceDuration;

    // If we've reached minimum duration or this is the last sentence, finalize the group
    if (currentDuration >= minSceneDuration || i === sentences.length - 1) {
      sceneGroups.push({
        sentences: [...currentGroup],
        text: currentGroup.join(" "),
        duration: currentDuration,
      });
      currentGroup = [];
      currentDuration = 0;
    }
  }

  console.log(
    `Grouped ${sentences.length} sentences into ${sceneGroups.length} scenes`
  );
  sceneGroups.forEach((group, idx) => {
    console.log(
      `Scene ${idx}: ${group.duration.toFixed(2)}s - "${group.text.substring(
        0,
        50
      )}..."`
    );
  });

  return sceneGroups;
}

async function generateTTS(
  sentence,
  voiceId,
  outputPath,
  addPause = true,
  retryCount = 0
) {
  console.log("Generating TTS for:", sentence);
  console.log("Using voice ID:", voiceId);
  console.log("ElevenLabs API Key present:", !!process.env.ELEVENLABS_API_KEY);

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not set in environment variables");
  }

  if (!voiceId) {
    throw new Error("Voice ID is required for TTS generation");
  }

  // Add natural pause at the end of each sentence for better flow
  const textWithPause = addPause ? `${sentence.trim()}. ` : sentence;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: textWithPause,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.1, // Slow down narration by 10% for better clarity
          },
        }),
      }
    );

    console.log("TTS API response status:", response.status);

    if (!response.ok) {
      let errorMessage = `TTS failed: ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.text();
        console.error("TTS API error body:", errorBody);
        errorMessage += ` - ${errorBody}`;
      } catch (e) {
        console.error("Could not read error body:", e);
      }

      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retryCount < TTS_CONFIG.MAX_RETRIES) {
        const waitTime =
          Math.pow(TTS_CONFIG.RATE_LIMIT_BACKOFF_MULTIPLIER, retryCount) * 2000; // 2s, 4s, 8s
        console.log(
          `Rate limited, waiting ${waitTime}ms before retry ${retryCount + 1}/${
            TTS_CONFIG.MAX_RETRIES
          }`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return generateTTS(
          sentence,
          voiceId,
          outputPath,
          addPause,
          retryCount + 1
        );
      }

      throw new Error(errorMessage);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log("TTS audio buffer size:", buffer.length, "bytes");
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  } catch (error) {
    // Handle network errors or other issues
    if (retryCount < TTS_CONFIG.MAX_RETRIES && !error.message.includes("429")) {
      const waitTime =
        Math.pow(TTS_CONFIG.RATE_LIMIT_BACKOFF_MULTIPLIER, retryCount) * 1000; // 1s, 2s, 4s
      console.log(
        `TTS request failed, retrying in ${waitTime}ms (attempt ${
          retryCount + 1
        }/${TTS_CONFIG.MAX_RETRIES}):`,
        error.message
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return generateTTS(
        sentence,
        voiceId,
        outputPath,
        addPause,
        retryCount + 1
      );
    }
    throw error;
  }
}

const STABILITY_ENGINE_ID = process.env.STABILITY_ENGINE_ID ?? "sdxl-1.0";

async function generateImage(prompt, outputPath, aspectRatio = "1:1") {
  if (!process.env.STABILITY_API_KEY) {
    throw new Error("STABILITY_API_KEY is not set in environment variables");
  }

  //   const sizeMap = {
  //     "16:9": { width: 1792, height: 1024 },
  //     "9:16": { width: 1024, height: 1792 },
  //     "1:1": { width: 1024, height: 1024 },
  //   };

  const sizeMap = {
    "16:9": { width: 1344, height: 768 },
    "9:16": { width: 768, height: 1344 },
    "1:1": { width: 1024, height: 1024 },
  };
  const { width, height } = sizeMap[aspectRatio] ?? {
    width: 1024,
    height: 1024,
  };

  const body = {
    text_prompts: [{ text: prompt, weight: 1 }],
    width,
    height,
    samples: 1,
    cfg_scale: 7,
    steps: 30,
  };

  const response = await fetch(
    `https://api.stability.ai/v1/generation/${STABILITY_ENGINE_ID}/text-to-image`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Stability API error (${response.status}): ${
        errorText || "No error body"
      }`
    );
  }

  const payload = await response.json();
  const artifact = payload.artifacts?.[0];
  if (!artifact || !artifact.base64) {
    throw new Error("Stability API returned no image artifacts");
  }

  const buffer = Buffer.from(artifact.base64, "base64");
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}
async function createSceneVideo(
  imagePath,
  audioPath,
  effect,
  outputPath,
  effectScale,
  aspectRatio = "16:9"
) {
  const duration = await getAudioDuration(audioPath);
  const adjustedDuration = duration;

  // Convert aspect ratio into real resolution
  let videoSize;
  switch (aspectRatio) {
    case "16:9":
      videoSize = "1280x720";
      break;
    case "9:16":
      videoSize = "720x1280";
      break;
    case "1:1":
      videoSize = "1080x1080";
      break;
    default:
      videoSize = "1280x720";
  }

  // Split videoSize for pad filter
  const [w, h] = videoSize.split("x");

  const frameRate = 25;
  const totalFrames = Math.floor(adjustedDuration * frameRate);
  const minFrames = Math.max(totalFrames, 75);

  let filter;

  switch (effect) {
    case "zoomIn":
      filter = `zoompan=z='min(zoom+0.002,1.2)':d=${minFrames}:s=${videoSize},scale=${videoSize}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`;
      break;

    case "zoomOut":
      filter = `zoompan=z='max(zoom-0.002,0.9)':d=${minFrames}:s=${videoSize},scale=${videoSize}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`;
      break;

    case "zoomInSlow":
      filter = `zoompan=z='min(zoom+0.001,1.1)':d=${minFrames}:s=${videoSize},scale=${videoSize}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`;
      break;

    case "zoomOutSlow":
      filter = `zoompan=z='max(zoom-0.001,0.95)':d=${minFrames}:s=${videoSize},scale=${videoSize}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`;
      break;

    case "panLeft":
      filter = `zoompan=x='iw-(iw/zoom)*${minFrames}/75':z=1:d=${minFrames}:s=${videoSize},scale=${videoSize}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`;
      break;

    case "panRight":
      filter = `zoompan=x='0':z=1:d=${minFrames}:s=${videoSize},scale=${videoSize}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`;
      break;

    default:
      filter = `zoompan=z='min(zoom+0.002,1.2)':d=${minFrames}:s=${videoSize},scale=${videoSize}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`;
      break;
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .loop(adjustedDuration)
      .videoFilter(filter)
      .input(audioPath)
      .outputOptions([`-t ${duration}`])
      .save(outputPath)
      .on("start", (cmd) => console.log("FFmpeg started:", cmd))
      .on("stderr", (line) => console.log("FFmpeg stderr:", line))
      .on("end", () => resolve(outputPath))
      .on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.params;

    // Create media/<video_id>/ folder
    const videoDir = path.join(process.cwd(), "media", id);
    ensureDir(videoDir);

    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !video) {
      console.error("Database error:", error);
      return res.status(404).json({ error: "Video not found" });
    }

    console.log("Video data:", video);

    // Generate script from topic if not exists
    let script = video.script;
    if (!script) {
      console.log("Generating script for topic:", video.topic);

      // Adjust script length based on video_length setting
      const isShortVideo = video.video_length === "short";
      const videoDuration = isShortVideo ? "45-second" : "90-second";
      const wordCount = isShortVideo ? "90" : "180";

      // Define prompt templates
      const promptTemplates = {
        "True stories":
          "Write a single detailed narration script about the given topic. Focus on ONE coherent story with a clear beginning, middle, and end. Elaborate on the emotions, setting, and events to make it immersive. Do not list multiple short stories — focus on one. Keep sentences clear and natural, suitable for voiceover. Write the story about famous, historical figures, past or present, that made an impact on the world.",
        "Bedtime stories":
          "Write a calming and imaginative bedtime story suitable for children. Use gentle language, magical or whimsical settings, and end with a peaceful resolution. Keep the tone soothing and relaxing.",
        "What If?":
          "Write a narration script that explores a single intriguing 'what if' scenario in detail. Explain the consequences step by step, mix in speculation and logical reasoning, and keep it engaging as if explaining to a curious audience.",
        "Spooky stories":
          "Write a scary narration script that tells one eerie story with suspense, atmosphere, and twists. Use vivid, chilling descriptions to create tension, but keep it suitable for general YouTube audiences.",
        Motivational:
          "Write a motivational narration script that inspires the audience. Use a strong, uplifting tone, include rhetorical questions, relatable struggles, and powerful takeaways that encourage action and positivity.",
        "Urban Legends":
          "Write a narration script about a famous urban legend. Explain the story in detail, its origins, and why it became popular. Build suspense while telling the legend as if narrating to an intrigued audience.",
        "Fun Facts":
          "Write a narration script that lists 5–7 surprising fun facts about the topic. Each fact should be explained in one or two sentences, with engaging transitions between them.",
        Educational:
          "Write an educational narration script that explains the topic clearly and simply. Use analogies, examples, and engaging storytelling to make learning fun and easy to follow.",
        "Sci-fi":
          "Cool sci fi story. Can also talk about what ifs. Describe the scenario immersively.",
        "Life pro tips":
          "Write a narration script that shares 5–7 practical life tips. Each tip should be explained briefly but clearly, showing how it helps in real life. Keep the tone conversational and helpful.",
        "Interesting History":
          "Write a narration script about one fascinating historical event. Describe the context, key figures, dramatic moments, and its impact on the world, using storytelling to make it vivid and engaging.",
      };

      // Check if topic matches any template key (case-insensitive)
      const topicLower = video.topic.toLowerCase();
      let selectedTemplate = null;

      for (const [templateKey, templatePrompt] of Object.entries(
        promptTemplates
      )) {
        if (templateKey.toLowerCase() === topicLower) {
          selectedTemplate = templatePrompt;
          console.log(`Using template: ${templateKey}`);
          break;
        }
      }
      const baseStrictRule = `
IMPORTANT: You MUST follow the word count EXACTLY. 
This rule overrides creativity, storytelling, and style.
Count every word carefully CRITICAL STYLE RULES:
- DO NOT use screenplay format.
- DO NOT include [FADE IN], [CUT TO], [DISSOLVE TO], or any bracketed stage directions.
- DO NOT write camera movements or scene transitions.
- DO NOT use NARRATOR (V.O).
- Write as a natural spoken narration, like a YouTube storyteller.
- No brackets, no labels, no scene headings, no screenplay cues.
This rule overrides creativity, formatting, and style.
`;
      const defaultPrompt =
        "You are a script writer for educational, interesting videos. Write engaging narration scripts. \n\nTone: engaging, conversational, and energetic, as if speaking directly to an audience on YouTube. Make it feel like natural storytelling, flowing from one point to the next.The script MUST follow the word count EXACTLY. This rule is more important than creativity or storytelling. ";
      // Use selected template or default prompt
      const systemPrompt = selectedTemplate
        ? selectedTemplate + "\n\n" + baseStrictRule
        : defaultPrompt;

      const scriptResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              systemPrompt +
              "\n\nIMPORTANT: Create content that is safe for all audiences. Avoid any content involving violence, adult themes, hate speech, or controversial topics. Keep the content educational, entertaining, and family-friendly.",
          },
          {
            role: "user",
            content: `Write a narration script about ${
              video.topic
            }, for a ${videoDuration} video. The script must be EXACTLY ${wordCount} words (±10 words maximum). Count your words carefully and ensure the final script is between ${
              parseInt(wordCount) - 10
            } and ${
              parseInt(wordCount) + 10
            } words. Ensure the content is family-friendly and safe for all audiences.`,
          },
        ],
        max_tokens: isShortVideo ? 400 : 600,
        temperature: 0.7,
      });

      script = scriptResponse.choices[0].message.content;
      console.log("Generated script:", script);

      // Validate word count and regenerate if necessary
      const actualWordCount = countWords(script);
      const targetWordCount = parseInt(wordCount);
      const minWords = targetWordCount - 20;
      const maxWords = targetWordCount + 20;

      console.log(
        `Script word count: ${actualWordCount} (target: ${targetWordCount}, range: ${minWords}-${maxWords})`
      );

      // If script is too long, regenerate with stricter instructions
      if (actualWordCount > maxWords) {
        console.log(
          `Script too long (${actualWordCount} words), regenerating with stricter word limit...`
        );

        const retryResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content:
                systemPrompt +
                "\n\nCRITICAL: You must write scripts that are EXACTLY the specified word count. Count every word carefully.",
            },
            {
              role: "user",
              content: `Write a narration script about ${video.topic}, for a ${videoDuration} video. The script must be EXACTLY ${wordCount} words (±5 words maximum). This is a strict requirement - count your words and ensure the final script is between ${minWords} and ${maxWords} words.`,
            },
          ],
          max_tokens: isShortVideo ? 300 : 500, // Reduced token limit to force shorter responses
          temperature: 0.5, // Lower temperature for more consistent length
        });

        script = retryResponse.choices[0].message.content;
        const retryWordCount = countWords(script);
        console.log(`Retry script word count: ${retryWordCount}`);

        // If still too long, DONT truncate the script
        if (retryWordCount > maxWords) {
          console.log(
            `Script still too long after retry (${retryWordCount} words), keeping full script to preserve content flow`
          );
        }
      }

      // Save script back to database
      await supabase.from("videos").update({ script }).eq("id", id);
    }

    const narrationText = script
      .split("\n")
      .filter((line) => line.trim().length > 0) // Filter out empty lines
      .map((line) => line.trim())
      .join(" ");
    const sentences = splitSentences(narrationText);

    // Group sentences into scenes with minimum duration
    const sceneGroups = await groupSentencesIntoScenes(
      sentences,
      video.voice,
      videoDir
    );

    // --- Sequential TTS for scene groups (avoids rate-limit errors) ---
    const audioClips = [];
    for (let i = 0; i < sceneGroups.length; i++) {
      const tempAudioPath = path.join(videoDir, `temp_clip_${i}.mp3`);
      const finalAudioPath = path.join(videoDir, `clip_${i}.mp3`);

      try {
        // Generate TTS with sentence-level pauses for better flow
        await addSentencePauses(
          sceneGroups[i].text,
          video.voice,
          tempAudioPath
        );

        fs.copyFileSync(tempAudioPath, finalAudioPath);
        audioClips.push(finalAudioPath);
        console.log(`Successfully generated TTS for scene ${i}`);
      } catch (error) {
        console.error(`TTS generation failed for scene ${i}:`, error.message);
        throw error;
      } finally {
        if (fs.existsSync(tempAudioPath)) {
          fs.unlinkSync(tempAudioPath);
        }
      }

      // Add longer delay between TTS requests to avoid rate limiting
      console.log(
        `Waiting ${TTS_CONFIG.DELAY_BETWEEN_REQUESTS}ms before next TTS request to avoid rate limiting...`
      );
      await new Promise((r) =>
        setTimeout(r, TTS_CONFIG.DELAY_BETWEEN_REQUESTS)
      );
    }
    //This step is to make image generation more accurate lol.
    const rewriteSceneToVisualPrompt = async (sceneText) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Rewrite the user's narration into a highly detailed, VISUAL image prompt. Focus ONLY on what can be drawn. Remove abstract ideas, emotions, metaphors, or backstory unless visually representable. Make it suitable for Stable Diffusion. Include: characters, setting, lighting, location, camera angle, atmosphere. Keep it literal and visual.",
          },
          {
            role: "user",
            content: sceneText,
          },
        ],
        max_tokens: 150,
        temperature: 0.4,
      });

      return response.choices[0].message.content.trim();
    };

    // --- Parallel image generation for scene groups (fast) ---
    const imagePromises = sceneGroups.map(async (sceneGroup, i) => {
      const imagePath = path.join(videoDir, `scene_${i}.jpg`);

      // 1. Rewrite narration into visual prompt
      const visualPrompt = await rewriteSceneToVisualPrompt(sceneGroup.text);
      console.log(`Scene ${i} visual prompt:`, visualPrompt);

      // 2. Orientation prompt rules
      let orientationPrompt = "";
      if (video.aspect_ratio === "9:16") {
        orientationPrompt =
          "PORTRAIT ORIENTATION ONLY. A tall vertical composition designed for 9:16. No horizontal landscape framing.";
      } else if (video.aspect_ratio === "16:9") {
        orientationPrompt =
          "LANDSCAPE ORIENTATION ONLY. A wide cinematic composition designed for 16:9.";
      } else {
        orientationPrompt =
          "SQUARE ORIENTATION ONLY. A centered and balanced 1:1 framing.";
      }

      // 3. Style metadata
      const styleMeta = artStyles[video.art_style];
      const stylePrompt =
        styleMeta?.prompt ??
        `${video.art_style.replace(/[_-]/g, " ")} illustration`;

      // 4. Final prompt
      const finalPrompt = `
      ${stylePrompt}.
      Scene: ${visualPrompt}.
      ${orientationPrompt}
      No words, no letters, no text, no captions.
      Ultra detailed, high-quality professional artwork.
      `;

      // 5. Generate image
      return generateImage(finalPrompt, imagePath, video.aspect_ratio);
    });
    const imageClips = await Promise.all(imagePromises);

    // Calculate scale factor - but ensure we don't cut off audio
    let totalDuration = 0;
    const individualDurations = [];
    for (const clip of audioClips) {
      const duration = await getAudioDuration(clip);
      individualDurations.push(duration);
      totalDuration += duration;
    }
    let scaleFactor = 50 / totalDuration;
    if (scaleFactor < 0.9) scaleFactor = 0.9; // Less aggressive scaling to preserve audio
    if (scaleFactor > 1.1) scaleFactor = 1.1;

    // Ensure minimum effect duration for visibility
    const minEffectDuration = 3.0; // Minimum 3 seconds for effects to be visible

    // Create scene videos sequentially
    const sceneVideos = [];
    const effects = [
      "zoomIn",
      "zoomOut",
      "panLeft",
      "panRight",
      "zoomInSlow",
      "zoomOutSlow",
    ];

    for (let i = 0; i < sceneGroups.length; i++) {
      const sceneOut = path.join(videoDir, `scene_${i}.mp4`);
      // Ensure every scene gets an effect, cycling through all available effects
      const effect = effects[i % effects.length];

      // Calculate effective duration for this scene
      const sceneDuration = individualDurations[i];
      const effectiveDuration = Math.max(
        sceneDuration * scaleFactor,
        minEffectDuration
      );

      console.log(
        `Scene ${i}: Using effect ${effect}, original duration: ${sceneDuration.toFixed(
          2
        )}s, effective duration: ${effectiveDuration.toFixed(2)}s`
      );

      // Use effective duration instead of scale factor for better effect visibility
      const effectScale = effectiveDuration / sceneDuration;

      try {
        await createSceneVideo(
          imageClips[i],
          audioClips[i],
          effect,
          sceneOut,
          effectScale,
          video.aspect_ratio
        );
        sceneVideos.push(sceneOut);
        console.log(`Scene ${i}: Effect ${effect} applied successfully`);
      } catch (error) {
        console.error(
          `Scene ${i}: Failed to apply effect ${effect}, using fallback:`,
          error.message
        );
        // Fallback: create scene without effect but with minimum duration
        await createSceneVideo(
          imageClips[i],
          audioClips[i],
          "zoomIn", // Simple fallback effect
          sceneOut,
          Math.max(scaleFactor, 1.0), // Ensure minimum scaling
          video.aspect_ratio
        );
        sceneVideos.push(sceneOut);
      }
    }

    // Concatenate scenes
    const concatFile = path.join(videoDir, `scenes_${id}.txt`);
    const concatContent = sceneVideos
      .map((f) => `file '${f.replace(/\\/g, "/")}'\n`)
      .join("");
    fs.writeFileSync(concatFile, concatContent);

    const narrationVideoPath = path.join(videoDir, `narration_${id}.mp4`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .save(narrationVideoPath)
        .on("end", resolve)
        .on("error", (err, stdout, stderr) => {
          console.error("======================================");
          console.error("FFMPEG ERROR (scene):", err.message);
          console.error("---- STDERR ----");
          console.error(stderr);
          console.error("---- STDOUT ----");
          console.error(stdout);
          console.error("======================================");
          return reject(err);
        });
    });

    // Download music
    const musicPath = path.join(videoDir, `music_${id}.mp3`);
    console.log("Attempting to download music from:", video.music_track);

    if (!video.music_track) {
      throw new Error("No music track URL provided");
    }

    try {
      const resMusic = await fetch(video.music_track);
      console.log("Music download response status:", resMusic.status);

      if (!resMusic.ok) {
        throw new Error(
          `Failed to download music: ${resMusic.status} ${resMusic.statusText}`
        );
      }

      const musicBuffer = Buffer.from(await resMusic.arrayBuffer());
      console.log("Music buffer size:", musicBuffer.length, "bytes");

      fs.writeFileSync(musicPath, musicBuffer);
      console.log("Music saved to:", musicPath);
    } catch (error) {
      console.error("Music download error:", error);
      throw new Error(`Failed to download music: ${error.message}`);
    }

    // Mix narration + music
    const finalPath = path.join(videoDir, `final_${id}.mp4`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(narrationVideoPath)
        .input(musicPath)
        .complexFilter([
          "[0:a]volume=1.5[voice]",
          "[1:a]volume=0.35[music]",
          "[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        ])
        .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy"])
        .save(finalPath)
        .on("start", (cmd) => console.log("FFmpeg command:", cmd))
        .on("stderr", (stderrLine) => console.log("FFmpeg stderr:", stderrLine))
        .on("end", resolve)
        .on("error", (err, stdout, stderr) => {
          console.error("======================================");
          console.error("FFMPEG ERROR (scene):", err.message);
          console.error("---- STDERR ----");
          console.error(stderr);
          console.error("---- STDOUT ----");
          console.error(stdout);
          console.error("======================================");
          return reject(err);
        });
    });

    // Upload to Supabase
    const fileBuffer = fs.readFileSync(finalPath);
    const { error: storageError } = await supabase.storage
      .from("videos")
      .upload(`final_${id}.mp4`, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage
      .from("videos")
      .getPublicUrl(`final_${id}.mp4`);

    await supabase
      .from("videos")
      .update({ video_url: urlData.publicUrl, status: "completed" })
      .eq("id", id);

    return res.status(200).json({ video_url: urlData.publicUrl });
  } catch (err) {
    console.error("Render error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
