"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Check, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Layout from "@/components/Layout";
import apiService from "@/services/api";
import topics from "@/data/topics";
import { tagColorMap, tagColorPalette } from "@/data/voice-tag-colors";

const summarizeDescription = (text, limit = 15) => {
  if (!text) {
    return "";
  }

  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length <= limit) {
    return words.join(" ");
  }

  return `${words.slice(0, limit).join(" ")}…`;
};

const formatTagLabel = (tag) =>
  tag.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const hashTagToPaletteIndex = (tag) =>
  [...tag].reduce((acc, char) => acc + char.charCodeAt(0), 0) %
  tagColorPalette.length;

const getTagClasses = (tag) => {
  const normalizedTag = tag.toLowerCase();
  return (
    tagColorMap[normalizedTag] ??
    tagColorPalette[hashTagToPaletteIndex(normalizedTag)]
  );
};

export default function CreateSeriesPage() {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

  // Form state
  const [destination, setDestination] = useState("email");
  const [content, setContent] = useState("true stories");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [selectedArtStyle, setSelectedArtStyle] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("vertical");
  const [videoLanguage, setVideoLanguage] = useState("english");
  const [durationPreference, setDurationPreference] = useState("60-90");
  const [backgroundMusic, setBackgroundMusic] = useState(true);
  const [artStyles, setArtStyles] = useState([]);
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voicesError, setVoicesError] = useState(null);
  const [musicOptions, setMusicOptions] = useState([]);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const previewAudioRef = useRef(null);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [playingMusicId, setPlayingMusicId] = useState(null);
  const artStyleScrollRef = useRef(null);
  const artStyleDefinitions = useMemo(
    () =>
      artStyles.map((style, index) => ({
        id: style.id ?? `art-style-${index}`,
        name: style.name ?? style.id ?? `Art Style ${index + 1}`,
        image: style.image ?? style.image_url ?? "",
      })),
    [artStyles]
  );

  const scrollArtStyles = (direction) => {
    if (!artStyleScrollRef.current) {
      return;
    }

    artStyleScrollRef.current.scrollBy({
      left: direction * 220,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const loadVoices = async () => {
      setVoicesLoading(true);

      try {
        const response = await fetch(`${apiBaseUrl}/voices`);
        if (!response.ok) {
          throw new Error(`Failed to fetch voices: ${response.status}`);
        }

        const data = await response.json();
        const voiceArray = data?.voices ? Object.values(data.voices) : [];

        setVoices(voiceArray);
        if (voiceArray.length) {
          setSelectedVoice((prev) => prev || voiceArray[0]?.voice_id || "");
        }
        setVoicesError(null);
      } catch (error) {
        console.error("Failed to load voices:", error);
        setVoices([]);
        setVoicesError("Unable to load voices right now.");
      } finally {
        setVoicesLoading(false);
      }
    };

    loadVoices();
  }, []);

  useEffect(() => {
    const loadArtStyles = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/artstyles`);
        if (!response.ok) {
          throw new Error(`Failed to fetch art styles: ${response.status}`);
        }

        const data = await response.json();
        const artStyleEntries = Object.entries(data?.artStyles ?? {});
        const normalizedArtStyles = artStyleEntries.map(([id, metadata]) => ({
          id,
          name: metadata?.name ?? id,
          image: metadata?.image ?? metadata?.image_url ?? "",
          prompt: metadata?.prompt ?? "",
        }));

        setArtStyles(normalizedArtStyles);
        setSelectedArtStyle((prev) => prev || normalizedArtStyles[0]?.id || "");
      } catch (error) {
        console.error("Failed to load art styles:", error);
      }
    };

    loadArtStyles();
  }, []);

  useEffect(() => {
    const loadMusic = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/music`);
        if (!response.ok) {
          throw new Error(`Failed to fetch music: ${response.status}`);
        }

        const data = await response.json();
        const musicArray = data?.music ? Object.values(data.music) : [];

        setMusicOptions(musicArray);
        setSelectedMusic((prev) => prev || musicArray[0]?.preview_url || null);
      } catch (error) {
        console.error("Failed to load music:", error);
      }
    };

    loadMusic();
  }, []);

  useEffect(() => {
    return () => {
      const audio = previewAudioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    };
  }, []);

  const handleVoicePreview = (voice) => {
    if (!voice?.preview_url) {
      return;
    }

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
    }

    const audio = previewAudioRef.current;
    if (playingVoiceId === voice.voice_id) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingVoiceId(null);
      setPlayingMusicId(null);
      return;
    }

    audio.pause();
    audio.src = voice.preview_url;
    audio.currentTime = 0;
    setPlayingMusicId(null);
    audio.play().catch((error) => {
      console.error("Voice preview failed:", error);
      setPlayingVoiceId(null);
    });
    setPlayingVoiceId(voice.voice_id);
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
  };

  const handleBackgroundMusicToggle = (checked) => {
    setBackgroundMusic(checked);
    if (!checked && playingMusicId) {
      const audio = previewAudioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingMusicId(null);
    }
  };

  const handleMusicPreview = (track) => {
    if (!track?.preview_url) {
      return;
    }

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
    }

    const audio = previewAudioRef.current;
    const trackId = track.id ?? track.preview_url;

    if (playingMusicId === trackId) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingMusicId(null);
      return;
    }

    audio.pause();
    audio.src = track.preview_url;
    audio.currentTime = 0;
    setPlayingVoiceId(null);
    setPlayingMusicId(trackId);
    audio.onended = () => setPlayingMusicId(null);
    audio.onerror = () => setPlayingMusicId(null);
    audio.play().catch((error) => {
      console.error("Music preview failed:", error + " " + audio.src);
      setPlayingMusicId(null);
    });
  };

  // API state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const aspectRatios = [
    { id: "vertical", name: "Vertical (9:16)", icon: "w-6 h-10" },
    { id: "horizontal", name: "Horizontal (16:9)", icon: "w-10 h-6" },
    { id: "square", name: "Square (1:1)", icon: "w-8 h-8" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const selectedMusicUrl = backgroundMusic ? selectedMusic : null;
      const formData = {
        user_id: "c4fbe6bd-720d-4c61-8259-9bc3c1d157c7",
        topic: content,
        voice: selectedVoice,
        art_style: selectedArtStyle,
        aspect_ratio:
          selectedAspectRatio === "vertical"
            ? "9:16"
            : selectedAspectRatio === "horizontal"
            ? "16:9"
            : "1:1",
        video_length: durationPreference === "30-60" ? "short" : "long",
        music_track: selectedMusicUrl,
        music: selectedMusicUrl,
      };

      console.log("Submitting form data:", formData);

      const response = await apiService.createVideo(formData);
      console.log("API response:", response);

      setSubmitSuccess(true);

      // Start polling for video status
      if (response.video?.id) {
        apiService.pollVideoStatus(response.video.id, (status, video) => {
          console.log(`Video ${video.id} status: ${status}`);
          if (status === "completed" && video.video_url) {
            console.log("Video completed:", video.video_url);
          }
        });
      }
    } catch (error) {
      console.error("Failed to create video:", error);
      setSubmitError(error.message || "Failed to create video");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout activePage="create">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">
            CREATE A SERIES
          </h1>
          <p className="text-grey-300">
            Schedule a series of Faceless Videos to post on auto-pilot.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="bg-white rounded-xl shadow-lg">
            <CardContent className="p-8 space-y-8">
              {/* Step 1: Destination */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <h2 className="text-xl font-bold text-blue-600">
                    Destination
                  </h2>
                </div>
                <p className="text-gray-600 mb-4">
                  The account where your video series will be posted
                </p>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Me Instead</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Content */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <h2 className="text-xl font-bold text-blue-600">Content</h2>
                </div>
                <p className="text-gray-600 mb-4">
                  What will your video series be about?
                </p>
                <Select value={content} onValueChange={setContent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose Topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={"true stories"}>True Stories</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 3: Series Settings */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <h2 className="text-xl font-bold text-blue-600">
                    Series Settings
                  </h2>
                </div>
                <p className="text-gray-600 mb-6">
                  Preferences for every video in your series
                </p>

                <div className="space-y-6">
                  {/* Narration Voice */}
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">
                          Narration Voice
                        </h3>
                        <p className="text-sm text-gray-500">
                          Select a voice that best fits your story’s tone.
                        </p>
                      </div>
                      {voicesLoading && (
                        <p className="text-xs text-gray-500">Loading voices…</p>
                      )}
                    </div>

                    {voicesError && (
                      <p className="text-sm text-red-600 mb-3">{voicesError}</p>
                    )}

                    <div
                      role="radiogroup"
                      aria-label="Narration voice selection"
                      className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-2"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#93c5fd #e5e7eb",
                      }}
                    >
                      {voicesLoading ? (
                        <p className="text-sm text-gray-500">
                          Fetching voices…
                        </p>
                      ) : voices.length ? (
                        voices.map((voice) => {
                          const isSelected = selectedVoice === voice.voice_id;

                          return (
                            <div
                              key={voice.voice_id}
                              role="radio"
                              aria-checked={isSelected}
                              tabIndex={0}
                              onClick={() => setSelectedVoice(voice.voice_id)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === " " ||
                                  event.key === "Enter"
                                ) {
                                  event.preventDefault();
                                  setSelectedVoice(voice.voice_id);
                                }
                              }}
                              className={`relative flex flex-col gap-3 rounded-3xl border px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isSelected
                                  ? "border-blue-600 bg-blue-50 shadow-[0_15px_45px_rgba(37,99,235,0.2)]"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <span
                                  aria-hidden="true"
                                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                                    isSelected
                                      ? "border-blue-600 bg-blue-600"
                                      : "border-gray-300 bg-white"
                                  }`}
                                >
                                  {isSelected && (
                                    <span className="h-2.5 w-2.5 rounded-full bg-white" />
                                  )}
                                </span>

                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-semibold text-gray-900">
                                    {voice.name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {summarizeDescription(voice.description)}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleVoicePreview(voice);
                                  }}
                                  className="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-600 transition hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                  {playingVoiceId === voice.voice_id ? (
                                    <Pause className="h-3 w-3" />
                                  ) : (
                                    <Play className="h-3 w-3" />
                                  )}
                                  <span className="sr-only">
                                    {playingVoiceId === voice.voice_id
                                      ? "Playing sample"
                                      : "Play sample"}
                                  </span>
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {voice.tags?.map((tag) => (
                                  <span
                                    key={`${voice.voice_id}-${tag}`}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] ${getTagClasses(
                                      tag
                                    )}`}
                                  >
                                    {formatTagLabel(tag)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-500">
                          Voices are unavailable right now. Please try again
                          later.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Background Music */}
                  <div>
                    <div className="flex items-center justify-between gap-4 mt-10 mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">
                          Background Music
                        </h3>
                        <p className="text-sm text-gray-500">
                          Preview and select a soundtrack for your series.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">OFF</span>
                        <Switch
                          checked={backgroundMusic}
                          onCheckedChange={handleBackgroundMusicToggle}
                        />
                        <span className="text-sm text-gray-500">ON</span>
                      </div>
                    </div>

                    {backgroundMusic && (
                      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-2">
                        {musicOptions.length ? (
                          musicOptions.map((track) => {
                            const trackId = track.id ?? track.preview_url;
                            const isSelected =
                              selectedMusic === track.preview_url;

                            return (
                              <label
                                key={track.id ?? track.preview_url}
                                className={`relative rounded-3xl border px-4 py-4 transition focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 ${
                                  isSelected
                                    ? "border-blue-600 bg-blue-50 shadow-[0_10px_30px_rgba(37,99,235,0.2)]"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="backgroundMusic"
                                  className="sr-only"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedMusic(track.preview_url)
                                  }
                                />

                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-base font-semibold text-gray-900">
                                        {track.name}
                                      </p>
                                      {isSelected && (
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                                          Selected
                                        </span>
                                      )}
                                    </div>

                                    {track.tags?.length ? (
                                      <div className="flex flex-wrap gap-2">
                                        {track.tags.map((tag) => (
                                          <span
                                            key={`${track.id}-${tag}`}
                                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] ${getTagClasses(
                                              tag
                                            )}`}
                                          >
                                            {formatTagLabel(tag)}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleMusicPreview(track);
                                    }}
                                    aria-label={
                                      playingMusicId === trackId
                                        ? `Pause ${track.name} preview`
                                        : `Play ${track.name} preview`
                                    }
                                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                                      playingMusicId === trackId
                                        ? "border-blue-600 bg-blue-50 text-blue-600"
                                        : "border-gray-200 bg-white text-blue-600 hover:border-blue-300"
                                    }`}
                                  >
                                    {playingMusicId === trackId ? (
                                      <Pause className="h-4 w-4" />
                                    ) : (
                                      <Play className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </label>
                            );
                          })
                        ) : (
                          <p className="text-sm text-gray-500">
                            Loading music tracks…
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Art Style */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">Art Style</h3>
                        <p className="text-sm text-gray-500">
                          Choose the look that will guide your renders.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => scrollArtStyles(-1)}
                          aria-label="Scroll art style list left"
                          className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <ChevronLeft className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollArtStyles(1)}
                          aria-label="Scroll art style list right"
                          className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                        >
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <div
                        ref={artStyleScrollRef}
                        className="flex gap-4 overflow-x-auto pb-2 pr-1 scroll-smooth"
                      >
                        {artStyleDefinitions.map((style) => {
                          const isSelected = selectedArtStyle === style.id;

                          return (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => setSelectedArtStyle(style.id)}
                              title={style.name}
                              aria-pressed={isSelected}
                              className={`relative flex-shrink-0 w-44 h-56 overflow-hidden rounded-3xl border-2 border-transparent bg-white p-0 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                                isSelected
                                  ? "border-blue-600 shadow-[0_20px_60px_rgba(37,99,235,0.5),0_0_0_4px_rgba(37,99,235,0.1)]"
                                  : "hover:border-gray-300"
                              }`}
                            >
                              <img
                                src={style.image || "/placeholder.svg"}
                                alt={style.name}
                                className="h-full w-full object-cover"
                              />

                              {isSelected && (
                                <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                                  <Check className="h-4 w-4" />
                                </span>
                              )}

                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                                <p className="text-xs font-semibold tracking-[0.4em] text-white">
                                  {style.name.toUpperCase()}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <h3 className="font-semibold mb-3">Aspect Ratio</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {aspectRatios.map((ratio) => (
                        <button
                          key={ratio.id}
                          type="button"
                          onClick={() => setSelectedAspectRatio(ratio.id)}
                          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-colors ${
                            selectedAspectRatio === ratio.id
                              ? "border-blue-600 bg-blue-50"
                              : "border-gray-200"
                          }`}
                        >
                          <div
                            className={`${ratio.icon} bg-gray-400 rounded mb-2`}
                          ></div>
                          <span className="text-sm font-medium">
                            {ratio.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Video Language */}
                  <div>
                    <h3 className="font-semibold mb-3">Video Language</h3>
                    <Select
                      value={videoLanguage}
                      onValueChange={setVideoLanguage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English (US)</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                        <SelectItem value="german">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration Preference */}
                  <div>
                    <h3 className="font-semibold mb-3">Duration Preference</h3>
                    <Select
                      value={durationPreference}
                      onValueChange={setDurationPreference}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30-60">30 to 60 seconds</SelectItem>
                        <SelectItem value="60-90">60 to 90 seconds</SelectItem>
                        <SelectItem value="90-120">
                          90 to 120 seconds
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Step 4: Create */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <h2 className="text-xl font-bold text-blue-600">Create</h2>
                </div>
                <p className="text-gray-600 mb-6">
                  You will be able to preview your upcoming videos before
                  posting
                </p>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "CREATE SERIES →"}
                </Button>

                {submitError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{submitError}</p>
                  </div>
                )}

                {submitSuccess && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-600 text-sm">
                      Video series created successfully! Check your dashboard
                      for updates.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </Layout>
  );
}
