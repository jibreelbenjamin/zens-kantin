"use client";
import * as React from "react";

const NOTIFICATION_SOUND_SRC = "/sounds/notification.mp3";

/**
 * Bunyi notifikasi pesanan baru masuk — diputar dari file audio
 * (public/sounds/notification.mp3) lewat elemen <audio>, bukan lagi
 * disintesis lewat Web Audio API. Elemen audio dibuat sekali & disimpan
 * di ref supaya panggilan berturut-turut (beberapa pesanan masuk hampir
 * bersamaan) tetap bisa memutar ulang dari awal tanpa delay membuat
 * elemen baru. Dipakai kasir saat ada pesanan baru masuk, supaya tidak
 * kelewatan meski lagi sibuk/ramai.
 */
export function useNotificationSound() {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const play = React.useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_SRC);
      }
      const audio = audioRef.current;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Autoplay diblokir browser sebelum ada interaksi user — abaikan, bukan fitur kritis.
      });
    } catch {
      // Elemen audio tidak tersedia/diblokir browser — abaikan, bukan fitur kritis.
    }
  }, []);

  return play;
}
