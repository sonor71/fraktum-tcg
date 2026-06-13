import { useEffect, useRef } from "react";
import { useGameStore } from "../useGameStore";

const MUSIC_TRACKS = [
  "/assets/audio/fraktum-main-theme.mp3",
  "/assets/audio/fraktum-fracture-crown.wav",
] as const;

const MUSIC_VOLUME = 0.35;

export default function BackgroundMusic() {
  const musicEnabled = useGameStore((state) => state.settings.music);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIndexRef = useRef(0);
  const musicEnabledRef = useRef(musicEnabled);

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;

    const audio = audioRef.current;
    if (!audio) return;

    if (!musicEnabled) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => {
      // Browser autoplay is blocked until the player interacts with the page.
    });
  }, [musicEnabled]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = MUSIC_VOLUME;
    audio.loop = false;

    audioRef.current = audio;

    const loadTrack = (index: number) => {
      const normalizedIndex =
        ((index % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) %
        MUSIC_TRACKS.length;

      trackIndexRef.current = normalizedIndex;
      audio.src = MUSIC_TRACKS[normalizedIndex];
      audio.load();
    };

    const tryPlay = async () => {
      if (!musicEnabledRef.current || document.hidden) return;

      try {
        await audio.play();
      } catch {
        // A later click, key press, or touch will retry playback.
      }
    };

    const playNextTrack = () => {
      loadTrack((trackIndexRef.current + 1) % MUSIC_TRACKS.length);
      void tryPlay();
    };

    const handleAudioError = () => {
      console.error(
        `[FRAKTUM MUSIC] Failed to load: ${MUSIC_TRACKS[trackIndexRef.current]}`,
      );

      // Skip a broken file instead of stopping the whole playlist.
      playNextTrack();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        audio.pause();
      } else {
        void tryPlay();
      }
    };

    const handleUserAction = () => {
      void tryPlay();
    };

    audio.addEventListener("ended", playNextTrack);
    audio.addEventListener("error", handleAudioError);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pointerdown", handleUserAction);
    window.addEventListener("keydown", handleUserAction);
    window.addEventListener("touchstart", handleUserAction, { passive: true });

    loadTrack(0);
    void tryPlay();

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      audio.removeEventListener("ended", playNextTrack);
      audio.removeEventListener("error", handleAudioError);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pointerdown", handleUserAction);
      window.removeEventListener("keydown", handleUserAction);
      window.removeEventListener("touchstart", handleUserAction);

      audioRef.current = null;
    };
  }, []);

  return null;
}
