import {
  motion,
  useMotionValue,
  useTransform,
  useDragControls,
  useReducedMotion,
  animate,
  AnimatePresence,
  type PanInfo,
} from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";
import musicAiFillSrc from "./assets/music-ai-fill.png";
import waveformSrc from "./assets/waveform.svg";
import albumOmahLaySrc from "./assets/album-omah-lay.png";
import albumAsakeSrc from "./assets/album-asake.png";
import albumMavoSrc from "./assets/album-mavo.png";
import albumNo11Src from "./assets/album-no11.png";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Music Chatbot Widget
 *
 * MOUNT
 *    0ms   opacity:0, scale:0.94, blur:2px
 *  380ms   springs to resting state  (skip if prefers-reduced-motion)
 *
 * DRAWER OPEN  (drag handle or Space/Enter)
 *   live   drawerProgress 0→1 tracks pointer in real-time
 *          songs section height 0→195px, opacity+y translate
 *          handle pill shrinks: 40→28px
 *
 * ALBUM HOVER  (pointer devices only — @media hover:hover)
 *    0ms   cover: rotateX 0→−22°, top:4→11, height:96→89  (folder crack)
 *    0ms   disc: y:0→−34  (floats up from inside)
 *    0ms   audio preview fades in (RAF loop 0→0.4)
 *
 * ALBUM CLICK → NOW PLAYING
 *    0ms   whileTap scale:0.93 on card
 *          idle content exit: y:0→-10, opacity:1→0, scale:1→0.97 (120ms)
 *   60ms   now-playing enters: y:16→0, opacity:0→1, scale:0.95→1
 *          spring(stiffness:280, damping:26)
 *          header stagger +60ms | player +80ms | controls +120ms
 *          waveform bars stagger: i * 18ms
 *
 * NOW PLAYING → IDLE
 *    0ms   now-playing exits: y:0→-8, opacity:1→0, scale:1→0.98 (140ms)
 *   60ms   idle content enters: y:8→0, opacity:0→1
 *
 * DRAG  (card body only, not handle)
 *    ±2.5° tilt derived from pointer delta via useTransform
 * ───────────────────────────────────────────────────────── */

// ── Z-index scale ──────────────────────────────────────────
const Z = { back: 0, disc: 1, front: 2 } as const;

// ── Spring / timing constants ──────────────────────────────
const DRAWER_HEIGHT  = 195;
// Drawer snap — snappy spring, no bounce (frequent interaction)
const SNAP_SPRING    = { type: "spring", stiffness: 380, damping: 40 } as const;
// Widget mount — gentle entrance
const MOUNT_SPRING   = { type: "spring", visualDuration: 0.38, bounce: 0.18 } as const;
// Free drag momentum
const POS_SPRING     = { bounceStiffness: 280, bounceDamping: 28 } as const;
// Vinyl disc pop — slightly bouncy (playful)
const DISC_SPRING    = { type: "spring", stiffness: 320, damping: 26 } as const;
// Folder flip — natural, no bounce
const FLIP_SPRING    = { type: "spring", stiffness: 260, damping: 26 } as const;
// Send button press — snappy micro-interaction
const BTN_SPRING     = { type: "spring", visualDuration: 0.16, bounce: 0.4 } as const;
// Now playing content transition
const NP_ENTER_SPRING = { type: "spring", stiffness: 280, damping: 26 } as const;

// ── Album data ─────────────────────────────────────────────
const ALBUMS = [
  {
    id: 1,
    src: albumOmahLaySrc,
    title: "Clarity of mind",
    artist: "Omah Lay",
    query: "Clarity Omah Lay",
    tint: "rgba(25,20,14,0.2)",
  },
  {
    id: 2,
    src: albumAsakeSrc,
    title: "Worship",
    artist: "Asake",
    query: "Worship Asake",
    tint: "rgba(23,37,63,0.2)",
  },
  {
    id: 3,
    src: albumMavoSrc,
    title: "Mofe",
    artist: "Mavo",
    query: "Mofe",
    tint: "rgba(156,67,28,0.2)",
  },
  {
    id: 4,
    src: albumNo11Src,
    title: "How far",
    artist: "No 11",
    query: "How Far Davido",
    tint: "rgba(98,60,3,0.2)",
  },
] as const;

type Album = (typeof ALBUMS)[number];

// ── Arrow-up icon ──────────────────────────────────────────
function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
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

// ── Music AI fill icon — PNG asset, 16×16 display ──────────
// Natural size: 24×23px. Displayed at inset-derived pixel coords
// inside a 16px container: top/left 1.89px, 11.67×11.11px
function MusicAiFillIcon() {
  return (
    <div
      style={{ position: "relative", width: 16, height: 16, flexShrink: 0, overflow: "hidden" }}
      aria-hidden="true"
    >
      <img
        src={musicAiFillSrc}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          top: 1.89,
          left: 1.89,
          width: 11.67,
          height: 11.11,
          display: "block",
        }}
      />
    </div>
  );
}

// ── Pause icon — Figma node 202233:43637, LIGHT button ─────
// SVG: viewBox 0 0 5.83333 8.75, two vertical bars
// Rendered dark (#171717) — sits on light #f7f7f7 button bg
// inset(18.75% 29.17%) on 14px = top/bottom 2.625px, left/right 4.083px
// → 5.833×8.75px bars, rendered at left:4.083 top:2.625 inside 14px container
function PauseIconImg() {
  return (
    <svg
      viewBox="0 0 5.83333 8.75"
      width={5.83333}
      height={8.75}
      fill="none"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible", flexShrink: 0 }}
    >
      {/* Left bar */}
      <rect x={0} y={0} width={0.972222} height={8.75} fill="#171717" />
      {/* Right bar */}
      <rect x={4.86111} y={0} width={0.972222} height={8.75} fill="#171717" />
    </svg>
  );
}

// ── Play icon — Figma node 202233:43915, DARK button ───────
// SVG: viewBox 0 0 7.34671 8.94187, filled triangle
// Rendered white — sits on dark #171717 button bg
// inset(18.06% 18.36% 18.06% 29.17%) on 14px
// → 7.347×8.942px, left:4.083 top:2.528 inside 14px container
function PlayIconImg() {
  return (
    <svg
      viewBox="0 0 7.34671 8.94187"
      width={7.34671}
      height={8.94187}
      fill="none"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible", flexShrink: 0 }}
    >
      {/* Triangle — filled white for contrast on dark bg */}
      <path d="M6.83398 4.4707L0.5 8.42969V0.511719L6.83398 4.4707Z" fill="white" />
    </svg>
  );
}

// ── Close icon ─────────────────────────────────────────────
function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" focusable="false">
      <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="#a3a3a3" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

// ── Keyboard hint badge ────────────────────────────────────
function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 500,
        color: "#5c5c5c",
        background: "#f0f0f0",
        borderRadius: 4,
        padding: "1px 5px",
        lineHeight: "16px",
        fontFamily: "'Inter',system-ui,sans-serif",
        letterSpacing: "-0.04px",
      }}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
 * WAVEFORM PROGRESS — Figma-exact waveform image reveal
 * Two layered copies of the waveform image:
 *   Bottom: greyed-out (unplayed)
 *   Top: black (played) — clip-path inset reveals left→right
 * A spring-driven motion value smoothly animates the clip
 * between each second tick, no jumping.
 * ───────────────────────────────────────────────────────── */
const PREVIEW_DURATION = 30; // iTunes preview length in seconds
// waveformSrc imported at top — local SVG asset

function WaveformProgress({
  elapsed,
  total,
  reduceMotion,
}: {
  elapsed: number;
  total: number;
  reduceMotion: boolean;
}) {
  const targetPct = total > 0 ? Math.min(1, elapsed / total) : 0;
  const progress = useMotionValue(0);

  useEffect(() => {
    animate(progress, targetPct, reduceMotion
      ? { duration: 0 }
      : { type: "spring", stiffness: 55, damping: 22, mass: 0.6 }
    );
  }, [targetPct, reduceMotion, progress]);

  // clip-path: inset(top right% bottom left) — right shrinks as song plays
  const clipPath = useTransform(
    progress,
    (v) => `inset(0 ${((1 - v) * 100).toFixed(3)}% 0 0 round 1px)`
  );

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "fill",
    display: "block",
  };

  return (
    <div
      style={{ flex: 1, position: "relative", height: 26, minWidth: 0 }}
      aria-hidden="true"
    >
      {/* Unplayed: reduced opacity → grey bars on white bg */}
      <img
        src={waveformSrc}
        alt=""
        draggable={false}
        style={{ ...imgStyle, filter: "opacity(0.2)" }}
      />
      {/* Played: full opacity dark bars, clip-path reveals left→right */}
      <motion.img
        src={waveformSrc}
        alt=""
        draggable={false}
        style={{ ...imgStyle, clipPath }}
      />
    </div>
  );
}

// ── Now playing card ───────────────────────────────────────
function NowPlayingCard({
  album,
  isPlaying,
  elapsed,
  onPlayPause,
  onPrevious: _onPrevious,
  onNext: _onNext,
  onClose,
  reduceMotion,
}: {
  album: Album;
  isPlaying: boolean;
  elapsed: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  reduceMotion: boolean;
}) {
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const stagger = (i: number) =>
    reduceMotion
      ? { duration: 0 }
      : { ...NP_ENTER_SPRING, delay: i * 0.055 };

  return (
    <motion.div
      key="now-playing"
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14, ease: "easeIn" } }
      }
      transition={NP_ENTER_SPRING}
      className="flex flex-col w-full"
      style={{ gap: 10, paddingTop: 12, paddingBottom: 12 }}
    >
      {/* ── Header ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stagger(0)}
        className="flex items-center justify-between"
        style={{ paddingLeft: 12, paddingRight: 12 }}
      >
        <div className="flex items-center" style={{ gap: 4 }}>
          <MusicAiFillIcon />
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "#a3a3a3",
              fontFamily: "'Inter',system-ui,sans-serif",
              letterSpacing: "-0.06px",
            }}
          >
            Now playing...
          </span>
        </div>
        {/* Close button */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          whileHover={{ scale: 1.1, background: "#f0f0f0" }}
          whileTap={{ scale: 0.9 }}
          transition={BTN_SPRING}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="Close now playing"
        >
          <CloseIcon />
        </motion.button>
      </motion.div>

      {/* ── Divider ── */}
      <motion.div
        initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={stagger(0.5)}
        style={{
          height: 1,
          background: "#ebebeb",
          width: "100%",
          transformOrigin: "left center",
        }}
      />

      {/* ── Player row ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stagger(1)}
        className="flex items-center"
        style={{ paddingLeft: 12, paddingRight: 12, gap: 8 }}
      >
        {/* Vinyl pill */}
        <motion.div
          initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={stagger(1.5)}
          style={{
            width: 113,
            height: 45,
            borderRadius: 10.7,
            background: "linear-gradient(135deg, #f7f7f7 0%, #d5eaff 100%)",
            boxShadow: "inset 0px -0.365px 0.486px 0px rgba(0,0,0,0.18), 0px 0px 0px 0.75px rgba(0,0,0,0.06)",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Mini vinyl — absolute positioned */}
          <div style={{ position: "absolute", left: 3.65, top: 3.65 }}>
            <VinylDisc src={album.src} isSpinning={isPlaying} size={37} reduceMotion={reduceMotion} />
          </div>
          {/* Track info */}
          <div
            style={{
              position: "absolute",
              left: 46,
              right: 8,
              top: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 1,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#171717",
                letterSpacing: -0.066,
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "'Inter',system-ui,sans-serif",
              }}
            >
              {album.title}
            </p>
            <p
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: "#5c5c5c",
                letterSpacing: -0.06,
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "'Inter',system-ui,sans-serif",
              }}
            >
              {album.artist}
            </p>
          </div>
        </motion.div>

        {/* Progress section — elapsed · bar · total */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          {/* Elapsed */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: "#5c5c5c",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
              fontFamily: "'Inter',system-ui,sans-serif",
              letterSpacing: "-0.04px",
              minWidth: 26,
            }}
          >
            {fmt(elapsed)}
          </span>

          {/* Waveform fills remaining space */}
          <WaveformProgress elapsed={elapsed} total={PREVIEW_DURATION} reduceMotion={reduceMotion} />

          {/* Total */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: "#a3a3a3",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
              fontFamily: "'Inter',system-ui,sans-serif",
              letterSpacing: "-0.04px",
              minWidth: 26,
              textAlign: "right",
            }}
          >
            0:30
          </span>
        </div>
      </motion.div>

      {/* ── Divider ── */}
      <motion.div
        initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={stagger(2)}
        style={{
          height: 1,
          background: "#ebebeb",
          width: "100%",
          transformOrigin: "left center",
        }}
      />

      {/* ── Controls row ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stagger(2.5)}
        className="flex items-center justify-between"
        style={{ paddingLeft: 12, paddingRight: 12 }}
      >
        {/* Keyboard hints */}
        <div className="flex items-center" style={{ gap: 4 }}>
          <KbdHint>Space</KbdHint>
          <span
            style={{
              fontSize: 10,
              color: "#a3a3a3",
              fontFamily: "'Inter',system-ui,sans-serif",
              marginRight: 6,
            }}
          >
            Pause
          </span>
          <KbdHint>P</KbdHint>
          <span
            style={{
              fontSize: 10,
              color: "#a3a3a3",
              fontFamily: "'Inter',system-ui,sans-serif",
              marginRight: 6,
            }}
          >
            Prev
          </span>
          <KbdHint>N</KbdHint>
          <span
            style={{
              fontSize: 10,
              color: "#a3a3a3",
              fontFamily: "'Inter',system-ui,sans-serif",
            }}
          >
            Next
          </span>
        </div>

        {/* Play / Pause button — styles switch with state
              Playing  → LIGHT #f7f7f7 button shows pause icon  (Figma 202233:43635)
              Paused   → DARK  #171717 button shows play  icon  (Figma 202233:43913) */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
          onPointerDown={(e) => e.stopPropagation()}
          whileHover={reduceMotion ? {} : { scale: 1.08 }}
          whileTap={reduceMotion ? {} : { scale: 0.88 }}
          transition={BTN_SPRING}
          aria-label={isPlaying ? "Pause" : "Play"}
          style={{
            position: "relative",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: isPlaying ? "#f7f7f7" : "#171717",
            boxShadow: isPlaying
              ? "0px 0px 0px 0.75px #ebebeb, inset 0px 1px 2px 0px rgba(255,255,255,0.16)"
              : "0px 0px 0px 0.75px #171717, inset 0px 1px 2px 0px rgba(255,255,255,0.16)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {/* Gloss overlay */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 8,
              pointerEvents: "none",
              background: isPlaying
                ? "linear-gradient(180deg, rgba(255,255,255,0.512) 6.67%, rgba(255,255,255,0) 103.33%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.154) 6.67%, rgba(255,255,255,0) 103.33%)",
            }}
          />
          <AnimatePresence mode="wait" initial={false}>
            {isPlaying ? (
              <motion.span
                key="pause"
                initial={{ opacity: 0, scale: 0.55, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.55, rotate: 20 }}
                transition={{ duration: 0.13, ease: "easeOut" }}
                style={{ display: "flex", position: "relative", zIndex: 1 }}
              >
                <PauseIconImg />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ opacity: 0, scale: 0.55, rotate: 20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.55, rotate: -20 }}
                transition={{ duration: 0.13, ease: "easeOut" }}
                style={{ display: "flex", position: "relative", zIndex: 1 }}
              >
                <PlayIconImg />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── Vinyl disc ─────────────────────────────────────────────
function VinylDisc({
  src,
  isSpinning,
  size = 80,
  reduceMotion = false,
}: {
  src: string;
  isSpinning: boolean;
  size?: number;
  reduceMotion?: boolean;
}) {
  const rotation = useMotionValue(0);
  const rafRef   = useRef<number>(0);
  const lastRef  = useRef(0);

  useEffect(() => {
    if (!isSpinning || reduceMotion) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      rotation.set(rotation.get() + ((now - lastRef.current) / 1000) * 120);
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpinning, reduceMotion, rotation]);

  const s      = size;
  const center = s / 2;
  const labelR = s * 0.19;
  const holeR  = s * 0.044;

  return (
    <motion.div
      style={{
        rotate: reduceMotion ? 0 : rotation,
        width: s, height: s,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
      }}
      aria-hidden="true"
    >
      {/* Base */}
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#100518" }} />
      {/* Groove rings */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        backgroundImage: "repeating-radial-gradient(circle,rgba(255,255,255,0) 0,rgba(255,255,255,0) 4.5px,rgba(255,255,255,0.045) 4.5px,rgba(255,255,255,0.045) 5px)",
      }} />
      {/* Iridescent band */}
      <div style={{
        position: "absolute", inset: s * 0.15, borderRadius: "50%",
        background: "conic-gradient(from 0deg,rgba(110,50,200,.28),rgba(50,110,220,.2),rgba(50,185,210,.16),rgba(195,125,55,.2),rgba(205,55,125,.26),rgba(110,50,200,.28))",
      }} />
      {/* Center label */}
      <div style={{
        position: "absolute",
        width: labelR * 2, height: labelR * 2,
        left: center - labelR, top: center - labelR,
        borderRadius: "50%", overflow: "hidden", zIndex: 2,
        boxShadow: "0 0 0 0.75px rgba(255,255,255,0.12)",
      }}>
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
      </div>
      {/* Spindle hole */}
      <div style={{
        position: "absolute",
        width: holeR * 2, height: holeR * 2,
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
function AlbumCard({
  album,
  reduceMotion,
  onPlay,
}: {
  album: Album;
  reduceMotion: boolean;
  onPlay?: (album: Album, previewUrl: string | null) => void;
}) {
  const [hovered, setHovered]       = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef  = useRef<number>(0);

  // Fetch iTunes 30s preview once on mount
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

  // Cleanup audio on unmount
  useEffect(() => () => { audioRef.current?.pause(); }, []);

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
      whileTap={reduceMotion ? {} : { scale: 0.93 }}
      transition={BTN_SPRING}
      onClick={() => {
        stopAudio();
        onPlay?.(album, previewUrl);
      }}
      role="button"
      aria-label={`Play ${album.title} by ${album.artist}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          stopAudio();
          onPlay?.(album, previewUrl);
        }
      }}
    >
      {/* perspective on container, not on the animated element */}
      <div
        className="relative"
        style={{
          width: 100, height: 100,
          perspective: reduceMotion ? undefined : "380px",
          perspectiveOrigin: "50% 100%",
        }}
      >
        {/* ── Back card: tint + inner glow ── */}
        <div
          className="absolute inset-0 rounded-[16px] pointer-events-none"
          style={{
            zIndex: Z.back,
            background: album.tint,
            boxShadow: "inset 1px 0px 2px 3px rgba(255,255,255,0.25),inset 0px 1px 2px 0px rgba(255,255,255,0.4)",
          }}
        />

        {/* ── Disc: pops up as cover tilts away ── */}
        <motion.div
          style={{
            position: "absolute",
            left: "50%", top: "50%",
            translateX: "-50%", translateY: "-50%",
            zIndex: Z.disc,
          }}
          animate={reduceMotion ? { y: 0 } : (hovered ? { y: -34 } : { y: 0 })}
          transition={DISC_SPRING}
        >
          <VinylDisc src={album.src} isSpinning={hovered} size={80} reduceMotion={reduceMotion} />
        </motion.div>

        {/* ── Front card: folder-lid flip ── */}
        <motion.div
          className="absolute left-0 w-[100px] rounded-[16px] overflow-hidden"
          style={{
            zIndex: Z.front,
            transformOrigin: "bottom center",
            boxShadow: "0px 1px 2px 0px rgba(10,13,20,0.03)",
          }}
          initial={{ top: 4, height: 96, rotateX: 0 }}
          animate={reduceMotion
            ? { top: 4, height: 96, rotateX: 0 }
            : hovered
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
      <div
        className="flex flex-col items-start w-[100px]"
        style={{ fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0" }}
      >
        <p
          className="text-[12px] leading-[18px] font-medium text-[#171717] tracking-[-0.072px] w-full truncate"
          style={{ fontFamily: "'Inter',system-ui,sans-serif" }}
        >
          {album.title}
        </p>
        <p
          className="text-[12px] leading-[18px] font-normal text-[#5c5c5c] tracking-[-0.072px]"
          style={{ fontFamily: "'Inter',system-ui,sans-serif" }}
        >
          {album.artist}
        </p>
      </div>
    </motion.div>
  );
}

// ── Main widget ────────────────────────────────────────────
export function ChatbotIdle() {
  const reduceMotion = useReducedMotion() ?? false;

  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls   = useDragControls();
  const expandedRef    = useRef(false);
  const [expanded, setExpanded] = useState(false);

  // ── Drawer motion values ──────────────────────────────────
  const drawerProgress = useMotionValue(0);
  const songsHeight    = useTransform(drawerProgress, [0, 1], [0, DRAWER_HEIGHT]);
  const songsOpacity   = useTransform(drawerProgress, [0, 0.12, 1], [0, 0.5, 1]);
  const songsY         = useTransform(drawerProgress, [0, 1], [8, 0]);
  const pillWidth      = useTransform(drawerProgress, [0, 1], [40, 28]);
  const pillOpacity    = useTransform(drawerProgress, [0, 1], [0.18, 0.32]);

  const bottomCardRef = useRef<HTMLDivElement>(null);

  // ── Card tilt during drag ─────────────────────────────────
  const posX  = useMotionValue(0);
  const posY  = useMotionValue(0);
  const tiltX = useTransform(posY, [-80, 80], [2.5, -2.5]);
  const tiltY = useTransform(posX, [-80, 80], [-2.5, 2.5]);

  // ── Now playing state ─────────────────────────────────────
  const [playingAlbum, setPlayingAlbum] = useState<Album | null>(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [elapsed, setElapsed]           = useState(0);
  const nowPlayingAudioRef              = useRef<HTMLAudioElement | null>(null);
  const nowPlayingFadeRef               = useRef<number>(0);
  const previewUrlsCache                = useRef<Map<number, string | null>>(new Map());

  // Elapsed timer
  useEffect(() => {
    if (!isPlaying || !playingAlbum) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [isPlaying, playingAlbum]);

  // Keyboard shortcuts for now playing
  useEffect(() => {
    if (!playingAlbum) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === " ") {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handleNavigate("prev");
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleNavigate("next");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingAlbum]);

  const startNowPlayingAudio = useCallback((url: string) => {
    const audio = new Audio(url);
    audio.volume = 0;
    nowPlayingAudioRef.current = audio;
    audio.play().catch(() => {});
    cancelAnimationFrame(nowPlayingFadeRef.current);
    const fadeIn = () => {
      if (!nowPlayingAudioRef.current) return;
      if (nowPlayingAudioRef.current.volume < 0.7) {
        nowPlayingAudioRef.current.volume = Math.min(0.7, nowPlayingAudioRef.current.volume + 0.015);
        nowPlayingFadeRef.current = requestAnimationFrame(fadeIn);
      }
    };
    nowPlayingFadeRef.current = requestAnimationFrame(fadeIn);
  }, []);

  const stopNowPlayingAudio = useCallback(() => {
    cancelAnimationFrame(nowPlayingFadeRef.current);
    if (nowPlayingAudioRef.current) {
      nowPlayingAudioRef.current.pause();
      nowPlayingAudioRef.current = null;
    }
  }, []);

  const handlePlayAlbum = useCallback(
    (album: Album, previewUrl: string | null) => {
      stopNowPlayingAudio();
      previewUrlsCache.current.set(album.id, previewUrl);
      setPlayingAlbum(album);
      setIsPlaying(true);
      setElapsed(0);
      if (previewUrl) startNowPlayingAudio(previewUrl);
    },
    [startNowPlayingAudio, stopNowPlayingAudio]
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (nowPlayingAudioRef.current) {
        if (next) nowPlayingAudioRef.current.play().catch(() => {});
        else nowPlayingAudioRef.current.pause();
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!playingAlbum) return;
      const idx = ALBUMS.findIndex((a) => a.id === playingAlbum.id);
      const nextIdx =
        direction === "next"
          ? (idx + 1) % ALBUMS.length
          : (idx - 1 + ALBUMS.length) % ALBUMS.length;
      const nextAlbum = ALBUMS[nextIdx];
      const cachedUrl = previewUrlsCache.current.get(nextAlbum.id);

      if (cachedUrl !== undefined) {
        handlePlayAlbum(nextAlbum, cachedUrl);
      } else {
        // Fetch on demand
        fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            nextAlbum.query
          )}&media=music&limit=1`
        )
          .then((r) => r.json())
          .then((d) => {
            const url = d.results?.[0]?.previewUrl ?? null;
            handlePlayAlbum(nextAlbum, url);
          })
          .catch(() => handlePlayAlbum(nextAlbum, null));
      }
    },
    [playingAlbum, handlePlayAlbum]
  );

  const handleClose = useCallback(() => {
    stopNowPlayingAudio();
    setPlayingAlbum(null);
    setIsPlaying(false);
    setElapsed(0);
  }, [stopNowPlayingAudio]);

  // Cleanup on unmount
  useEffect(() => () => stopNowPlayingAudio(), [stopNowPlayingAudio]);

  // ── Drawer toggle (drag + keyboard) ──────────────────────
  const toggleDrawer = useCallback(
    (open: boolean) => {
      animate(drawerProgress, open ? 1 : 0, reduceMotion ? { duration: 0 } : SNAP_SPRING);
      expandedRef.current = open;
      setExpanded(open);
    },
    [drawerProgress, reduceMotion]
  );

  const onHandlePan = (_: PointerEvent, info: PanInfo) => {
    const base  = expandedRef.current ? 1 : 0;
    const delta = -info.offset.y / DRAWER_HEIGHT;
    drawerProgress.set(Math.max(0, Math.min(1, base + delta)));
  };

  const onHandlePanEnd = (_: PointerEvent, info: PanInfo) => {
    const vel = -info.velocity.y / DRAWER_HEIGHT;
    const shouldOpen = vel > 0.8 || (vel > -0.8 && drawerProgress.get() > 0.42);
    toggleDrawer(shouldOpen);
  };

  // ── Input state ───────────────────────────────────────────
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!message.trim()) return;
      setMessage("");
      textareaRef.current?.focus();
    },
    [message]
  );

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
          rotateX: reduceMotion ? 0 : tiltX,
          rotateY: reduceMotion ? 0 : tiltY,
          position: "absolute",
          top: "calc(50% - 60px)",
          left: "calc(50% - 238px)",
          transformOrigin: "center center",
        }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94, filter: "blur(2px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={reduceMotion ? { duration: 0 } : MOUNT_SPRING}
        className="pointer-events-auto select-none w-[477px]"
        whileDrag={{ cursor: "grabbing" }}
      >
        {/* ── Outer shell ─────────────────────────────────── */}
        <div
          className="flex flex-col items-start pb-[2px] px-[2px] rounded-[22px] w-full"
          style={{
            background:
              "linear-gradient(178.1deg,#F5F5F5 0.64%,rgba(232,232,232,0.535) 52.61%,rgba(245,245,245,0) 112.36%)",
          }}
        >
          {/* ── Handle — drag + keyboard toggle ──────────── */}
          <motion.div
            onPan={onHandlePan}
            onPanEnd={onHandlePanEnd}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                toggleDrawer(!expandedRef.current);
              }
            }}
            className="flex items-center justify-center pb-[10px] pt-[13px] px-[16px] w-full shrink-0 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            role="button"
            aria-label={expanded ? "Close recent songs" : "Open recent songs"}
            aria-expanded={expanded}
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
            aria-hidden={!expanded}
            {...(!expanded ? { inert: true as unknown as boolean } : {})}
          >
            <motion.div
              style={{ opacity: songsOpacity, y: songsY }}
              className="flex flex-col gap-[11px] items-start w-full pb-[8px]"
            >
              <div className="px-[12px] w-full">
                <p
                  className="text-[12px] leading-[16px] font-normal text-[#a3a3a3]"
                  style={{
                    fontFamily: "'Inter',system-ui,sans-serif",
                    fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0",
                  }}
                >
                  Recent songs
                </p>
              </div>

              <div
                className="flex gap-[16px] items-start px-[12px] w-full"
                style={{ overflow: "visible" }}
              >
                {ALBUMS.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    reduceMotion={reduceMotion}
                    onPlay={handlePlayAlbum}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* ── Bottom card: idle textarea ↔ now playing ──── */}
          <div style={{ width: "100%" }}>
            <div
              ref={bottomCardRef}
              onPointerDown={(e) => dragControls.start(e)}
              className="bg-white rounded-[20px] border border-[#ebebeb] w-full shrink-0 overflow-hidden"
              style={{ boxShadow: "0px 1px 2px 0px rgba(10,13,20,0.03)" }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {playingAlbum ? (
                  <NowPlayingCard
                    key="now-playing"
                    album={playingAlbum}
                    isPlaying={isPlaying}
                    elapsed={elapsed}
                    onPlayPause={handlePlayPause}
                    onPrevious={() => handleNavigate("prev")}
                    onNext={() => handleNavigate("next")}
                    onClose={handleClose}
                    reduceMotion={reduceMotion}
                  />
                ) : (
                  <motion.div
                    key="idle"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.12, ease: "easeIn" } }
                    }
                    transition={{ type: "spring", visualDuration: 0.22, bounce: 0.1 }}
                  >
                    <form
                      onSubmit={handleSubmit}
                      className="flex flex-col gap-[24px] items-start p-[12px] w-full"
                    >
                      <textarea
                        ref={textareaRef}
                        value={message}
                        rows={1}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="What mood are you in"
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-full resize-none outline-none bg-transparent leading-[16px]"
                        style={{
                          fontFamily: "'Inter',system-ui,sans-serif",
                          fontSize: 12,
                          fontWeight: 400,
                          fontStyle: "normal",
                          color: message ? "#171717" : undefined,
                          fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0",
                        }}
                      />

                      <div className="flex items-center justify-end w-full">
                        <motion.button
                          type="submit"
                          whileHover={{ scale: 1.07 }}
                          whileTap={{ scale: 0.94 }}
                          transition={BTN_SPRING}
                          aria-label="Send message"
                          className="relative overflow-hidden rounded-[8px] p-[6px] flex items-center justify-center shrink-0 cursor-pointer"
                          style={{
                            background: "#171717",
                            boxShadow:
                              "0px 0px 0px 0.75px #171717,inset 0px 1px 2px 0px rgba(255,255,255,0.16)",
                            touchAction: "manipulation",
                          }}
                        >
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 rounded-[8px] pointer-events-none"
                            style={{
                              background:
                                "linear-gradient(180deg,rgba(255,255,255,0.154) 6.67%,rgba(255,255,255,0) 103.33%)",
                            }}
                          />
                          <div className="relative z-10 size-[14px] flex items-center justify-center">
                            <ArrowUpIcon />
                          </div>
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
