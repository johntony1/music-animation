import {
  motion,
  useMotionValue,
  useTransform,
  useDragControls,
  animate,
  type PanInfo,
} from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Chatbot Drawer
 *
 * MOUNT
 *    0ms   invisible, scale 0.94, blur 2px
 *  220ms   springs in
 *
 * DRAWER OPEN (drag handle up)
 *   live   drawerProgress 0→1 tracks pointer in real-time
 *   25%    input card bends back: rotateX 0 → −14°  (perspective 600px)
 *   60%    springs flat: rotateX → 0°  (paper-peel reveal)
 *
 * ALBUM HOVER — 3D folder crack-open
 *    0ms   cover: rotateX 0° → −22°  (hinge: bottom edge, top lifts away, perspective 380px)
 *           subtle tilt — just enough to peek the disc, NOT a full flip
 *    0ms   disc: y: 0 → −34  (floats up from inside the folder)
 *    0ms   audio preview fades in
 *
 * DRAG (card body only)
 *    ±2.5° tilt via useTransform
 * ───────────────────────────────────────────────────────── */

// ── Constants ─────────────────────────────────────────────
const DRAWER_HEIGHT = 195;
const SNAP_SPRING = { type: "spring", stiffness: 360, damping: 36 } as const;
const MOUNT_SPRING = { type: "spring", visualDuration: 0.38, bounce: 0.2 } as const;
const POS_SPRING = { bounceStiffness: 280, bounceDamping: 28 } as const;
const DISC_SPRING = { type: "spring", stiffness: 340, damping: 28 } as const;
const CARD_SPRING = { type: "spring", stiffness: 400, damping: 34 } as const;
const FLIP_SPRING = { type: "spring", stiffness: 240, damping: 24 } as const;

// ── Album data ─────────────────────────────────────────────
const ALBUMS = [
  {
    id: 1,
    src: "https://www.figma.com/api/mcp/asset/6028659e-99d1-4f34-8fd9-2dd8470ceefc",
    title: "Clarity of mind",
    artist: "Omah Lay",
    query: "Clarity Omah Lay",
    tint: "rgba(25,20,14,0.2)",
  },
  {
    id: 2,
    src: "https://www.figma.com/api/mcp/asset/a5046ded-e756-4cd9-9d07-9f6051e7d753",
    title: "Worship",
    artist: "Asake",
    query: "Worship Asake",
    tint: "rgba(23,37,63,0.2)",
  },
  {
    id: 3,
    src: "https://www.figma.com/api/mcp/asset/1fb67a2a-f119-48b6-8488-2f3e759efda5",
    title: "Mofe",
    artist: "Mavo",
    query: "Mofe",
    tint: "rgba(156,67,28,0.2)",
  },
  {
    id: 4,
    src: "https://www.figma.com/api/mcp/asset/ec9986d6-7f6d-4d43-adf5-cac261fa8e2c",
    title: "How far",
    artist: "No 11",
    query: "How Far Davido",
    tint: "rgba(98,60,3,0.2)",
  },
];

type Album = (typeof ALBUMS)[0];


// ── Arrow-up icon ──────────────────────────────────────────
function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Vinyl disc ─────────────────────────────────────────────
function VinylDisc({
  src,
  isSpinning,
  size = 80,
}: {
  src: string;
  isSpinning: boolean;
  size?: number;
}) {
  const rotation = useMotionValue(0);
  const rafRef = useRef<number>(0);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!isSpinning) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      rotation.set(rotation.get() + ((now - lastRef.current) / 1000) * 120);
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpinning]);

  const s = size;
  const center = s / 2;
  const labelR = s * 0.19;
  const holeR = s * 0.044;

  return (
    <motion.div
      style={{ rotate: rotation, width: s, height: s, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Base */}
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#100518" }} />
      {/* Groove rings */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        backgroundImage: "repeating-radial-gradient(circle, rgba(255,255,255,0) 0,rgba(255,255,255,0) 4.5px,rgba(255,255,255,0.045) 4.5px,rgba(255,255,255,0.045) 5px)",
      }} />
      {/* Iridescent band */}
      <div style={{
        position: "absolute", inset: s * 0.15, borderRadius: "50%",
        background: "conic-gradient(from 0deg,rgba(110,50,200,.28),rgba(50,110,220,.2),rgba(50,185,210,.16),rgba(195,125,55,.2),rgba(205,55,125,.26),rgba(110,50,200,.28))",
      }} />
      {/* Center label art */}
      <div style={{
        position: "absolute", width: labelR * 2, height: labelR * 2,
        left: center - labelR, top: center - labelR,
        borderRadius: "50%", overflow: "hidden", zIndex: 2,
        boxShadow: "0 0 0 0.75px rgba(255,255,255,0.12)",
      }}>
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
      </div>
      {/* Spindle hole */}
      <div style={{
        position: "absolute", width: holeR * 2, height: holeR * 2,
        left: center - holeR, top: center - holeR,
        borderRadius: "50%", background: "#0c0e0f", zIndex: 3,
      }} />
      {/* Gloss */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(ellipse at 28% 18%,rgba(255,255,255,0.09) 0%,transparent 55%)",
      }} />
      {/* Rim */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
        boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.11),0 0.5px 0.5px 0 black",
      }} />
    </motion.div>
  );
}


// ── Album card ─────────────────────────────────────────────
function AlbumCard({ album }: { album: Album }) {
  const [hovered, setHovered] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number>(0);

  // Fetch iTunes 30s preview on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(album.query)}&media=music&limit=1`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.results?.[0]?.previewUrl) setPreviewUrl(d.results[0].previewUrl);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [album.query]);

  const startAudio = useCallback(() => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.volume = 0;
    audioRef.current = audio;
    audio.play().catch(() => {});
    cancelAnimationFrame(fadeRef.current);
    const fadeIn = () => {
      if (!audioRef.current) return;
      if (audioRef.current.volume < 0.4) {
        audioRef.current.volume = Math.min(0.4, audioRef.current.volume + 0.02);
        fadeRef.current = requestAnimationFrame(fadeIn);
      }
    };
    fadeRef.current = requestAnimationFrame(fadeIn);
  }, [previewUrl]);

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(fadeRef.current);
    const audio = audioRef.current;
    if (!audio) return;
    const fadeOut = () => {
      if (audio.volume > 0.02) {
        audio.volume = Math.max(0, audio.volume - 0.03);
        fadeRef.current = requestAnimationFrame(fadeOut);
      } else {
        audio.pause();
        audioRef.current = null;
      }
    };
    fadeRef.current = requestAnimationFrame(fadeOut);
  }, []);

  return (
    <motion.div
      className="flex flex-col gap-[8px] items-start shrink-0 cursor-pointer"
      style={{ width: 100 }}
      onHoverStart={() => { setHovered(true); startAudio(); }}
      onHoverEnd={() => { setHovered(false); stopAudio(); }}
    >
      {/* Cover container — perspective here gives the 3D depth for the flip.
          overflow:visible so the disc can peek above the top edge. */}
      <div
        className="relative"
        style={{ width: 100, height: 100, perspective: "380px", perspectiveOrigin: "50% 100%" }}
      >
        {/* ── Back card: tint + inner glow — the "folder body" ── */}
        <div
          className="absolute inset-0 rounded-[16px] pointer-events-none"
          style={{
            zIndex: 0,
            background: album.tint,
            boxShadow: "inset 1px 0px 2px 3px rgba(255,255,255,0.25), inset 0px 1px 2px 0px rgba(255,255,255,0.4)",
          }}
        />

        {/* ── Disc: behind the cover at rest, floats up when cover flips away ──
            y:0 → fully hidden under the cover (disc spans 10–90px, cover spans 0–100px)
            y:−34 → center at 16px, top 24px above container → peeks above */}
        <motion.div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            translateX: "-50%",
            translateY: "-50%",
            zIndex: 1,
          }}
          animate={hovered ? { y: -34 } : { y: 0 }}
          transition={DISC_SPRING}
        >
          <VinylDisc src={album.src} isSpinning={hovered} size={80} />
        </motion.div>

        {/* ── Front card: album art — the "folder lid" ──
            Rest:  top:4,  height:96  → tint peeks 4px at top
            Hover: top:11, height:89  → tint exposed 11px + rotateX −22° folder crack
            Both animate together so you see the tint AND the flip at the same time. */}
        <motion.div
          className="absolute left-0 w-[100px] rounded-[16px] overflow-hidden"
          style={{
            zIndex: 2,
            transformOrigin: "bottom center",
            boxShadow: "0px 1px 2px 0px rgba(10,13,20,0.03)",
          }}
          initial={{ top: 4, height: 96, rotateX: 0 }}
          animate={hovered
            ? { top: 11, height: 89, rotateX: -22 }
            : { top: 4,  height: 96, rotateX: 0 }
          }
          transition={FLIP_SPRING}
        >
          <img
            src={album.src}
            alt={album.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </motion.div>
      </div>

      {/* Text */}
      <div className="flex flex-col items-start w-[100px]"
           style={{ fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0" }}>
        <p className="text-[12px] leading-[18px] font-medium text-[#171717] tracking-[-0.072px] w-full truncate"
           style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>
          {album.title}
        </p>
        <p className="text-[12px] leading-[18px] font-normal text-[#5c5c5c] tracking-[-0.072px]"
           style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>
          {album.artist}
        </p>
      </div>
    </motion.div>
  );
}

// ── Main widget ────────────────────────────────────────────
export function ChatbotIdle() {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const expandedRef = useRef(false);

  // Drawer — 0 closed, 1 open
  const drawerProgress = useMotionValue(0);
  const songsHeight  = useTransform(drawerProgress, [0, 1], [0, DRAWER_HEIGHT]);
  const songsOpacity = useTransform(drawerProgress, [0, 0.12, 1], [0, 0.5, 1]);
  const songsY       = useTransform(drawerProgress, [0, 1], [8, 0]);

  // Handle pill morphs
  const pillWidth   = useTransform(drawerProgress, [0, 1], [40, 28]);
  const pillOpacity = useTransform(drawerProgress, [0, 1], [0.18, 0.32]);

  // ── Bending animation on the input/player card ────────────
  // Card bends backward as drawer opens (−14° at 25% open) then springs flat
  const bendX = useTransform(
    drawerProgress,
    [0, 0.25, 0.6, 1],
    [0, -14, -4, 0]
  );

  // Tilt during card-body drag
  const posX  = useMotionValue(0);
  const posY  = useMotionValue(0);
  const tiltX = useTransform(posY, [-80, 80], [2.5, -2.5]);
  const tiltY = useTransform(posX, [-80, 80], [-2.5, 2.5]);


  // ── Handle pan ────────────────────────────────────────────
  const onHandlePan = (_: PointerEvent, info: PanInfo) => {
    const base  = expandedRef.current ? 1 : 0;
    const delta = -info.offset.y / DRAWER_HEIGHT;
    drawerProgress.set(Math.max(0, Math.min(1, base + delta)));
  };

  const onHandlePanEnd = (_: PointerEvent, info: PanInfo) => {
    const current = drawerProgress.get();
    const vel     = -info.velocity.y / DRAWER_HEIGHT;
    const shouldOpen = vel > 0.8 || (vel > -0.8 && current > 0.42);
    animate(drawerProgress, shouldOpen ? 1 : 0, SNAP_SPRING);
    expandedRef.current = shouldOpen;
  };

  return (
    <div
      ref={constraintsRef}
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ perspective: "900px" }}
    >
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum
        dragTransition={POS_SPRING}
        style={{
          x: posX, y: posY,
          rotateX: tiltX, rotateY: tiltY,
          position: "absolute",
          top: "calc(50% - 60px)",
          left: "calc(50% - 238px)",
          transformOrigin: "center center",
        }}
        initial={{ opacity: 0, scale: 0.94, filter: "blur(2px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={MOUNT_SPRING}
        className="pointer-events-auto select-none w-[477px]"
        whileDrag={{ cursor: "grabbing" }}
      >
        {/* ── Outer shell ─────────────────────────────────── */}
        <div
          className="flex flex-col items-start pb-[2px] px-[2px] rounded-[22px] w-full"
          style={{
            background: "linear-gradient(178.1deg, #F5F5F5 0.64%, rgba(232,232,232,0.535) 52.61%, rgba(245,245,245,0) 112.36%)",
          }}
        >
          {/* ── Handle ────────────────────────────────────── */}
          <motion.div
            onPan={onHandlePan}
            onPanEnd={onHandlePanEnd}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-center pb-[10px] pt-[13px] px-[16px] w-full shrink-0 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            aria-label="Drag to open or close"
            role="button"
            tabIndex={0}
          >
            <motion.div
              className="h-[3px] rounded-full bg-black"
              style={{ width: pillWidth, opacity: pillOpacity }}
            />
          </motion.div>

          {/* ── Songs drawer ──────────────────────────────── */}
          <motion.div
            style={{ height: songsHeight, overflow: "hidden" }}
            className="w-full shrink-0"
          >
            <motion.div
              style={{ opacity: songsOpacity, y: songsY }}
              className="flex flex-col gap-[11px] items-start w-full pb-[8px]"
            >
              {/* Label */}
              <div className="px-[12px] w-full">
                <p className="text-[12px] leading-[16px] font-normal text-[#a3a3a3]"
                   style={{ fontFamily: "'Inter',system-ui,sans-serif", fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0" }}>
                  Recent songs
                </p>
              </div>

              {/* Album row — overflow:visible so discs pop above without layout shift */}
              <div className="flex gap-[16px] items-start px-[12px] w-full" style={{ overflow: "visible" }}>
                {ALBUMS.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* ── Input / Now-playing card ───────────────────── */}
          {/* Perspective wrapper for the bend animation */}
          <div style={{ perspective: "600px", perspectiveOrigin: "50% 0%", width: "100%" }}>
            <motion.div
              style={{
                rotateX: bendX,
                transformOrigin: "top center",
                boxShadow: "0px 1px 2px 0px rgba(10,13,20,0.03)",
              }}
              onPointerDown={(e) => dragControls.start(e)}
              className="bg-white rounded-[20px] border border-[#ebebeb] p-[12px] flex flex-col items-start w-full shrink-0"
            >
              <div className="w-full flex flex-col gap-[24px] items-start">
                    {/* leading-none wrapper matches Figma's leading-[0] container pattern */}
                    <div className="flex flex-col justify-center leading-none shrink-0 w-full not-italic">
                      <p
                        className="text-[12px] leading-[16px] text-[#a3a3a3]"
                        style={{
                          fontFamily: "'Inter',system-ui,sans-serif",
                          fontWeight: 400,
                          fontStyle: "normal",
                          fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                        } as React.CSSProperties}
                      >
                        What mood are you in
                      </p>
                    </div>

                    <div className="flex items-center justify-end w-full">
                      <motion.button
                        whileHover={{ scale: 1.07 }}
                        whileTap={{ scale: 0.92 }}
                        transition={{ type: "spring", visualDuration: 0.18, bounce: 0.45 }}
                        aria-label="Send message"
                        className="relative overflow-hidden rounded-[8px] p-[6px] flex items-center justify-center shrink-0 cursor-pointer"
                        style={{
                          background: "#171717",
                          boxShadow: "0px 0px 0px 0.75px #171717, inset 0px 1px 2px 0px rgba(255,255,255,0.16)",
                        }}
                      >
                        <div aria-hidden="true" className="absolute inset-0 rounded-[8px] pointer-events-none"
                             style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.154) 6.67%,rgba(255,255,255,0) 103.33%)" }} />
                        <div className="relative z-10 size-[14px] flex items-center justify-center">
                          <ArrowUpIcon />
                        </div>
                      </motion.button>
                    </div>
                  </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
