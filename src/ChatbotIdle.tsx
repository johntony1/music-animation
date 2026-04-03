import {
  motion,
  useMotionValue,
  useTransform,
  useDragControls,
  useReducedMotion,
  animate,
  type PanInfo,
} from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";

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
function AlbumCard({ album, reduceMotion }: { album: Album; reduceMotion: boolean }) {
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
      // onHoverStart/End only fires for pointer:fine devices in Framer Motion
      onHoverStart={() => { setHovered(true); startAudio(); }}
      onHoverEnd={() => { setHovered(false); stopAudio(); }}
    >
      {/* perspective on container, not on the animated element — avoids affecting layout */}
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

        {/* ── Disc: pops up as cover tilts away ──
            At rest: center at 50px → fully behind the cover (cover spans 4–100px)
            On hover: center at 16px → 24px above container top */}
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

        {/* ── Front card: folder-lid flip ──
            Rest:  top:4,  h:96  → tint peeks 4px
            Hover: top:11, h:89  → tint exposed 11px, cover tilts −22° */}
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

      {/* Text — consistent weight, no hover weight change (avoids layout shift) */}
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

  // ── Drawer toggle (drag + keyboard) ──────────────────────
  const toggleDrawer = useCallback((open: boolean) => {
    animate(drawerProgress, open ? 1 : 0, reduceMotion ? { duration: 0 } : SNAP_SPRING);
    expandedRef.current = open;
    setExpanded(open);
  }, [drawerProgress, reduceMotion]);

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

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim()) return;
    setMessage("");
    textareaRef.current?.focus();
  }, [message]);

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
            background: "linear-gradient(178.1deg,#F5F5F5 0.64%,rgba(232,232,232,0.535) 52.61%,rgba(245,245,245,0) 112.36%)",
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
          {/* inert hides from tab order + assistive tech when collapsed */}
          <motion.div
            style={{ height: songsHeight, overflow: "hidden" }}
            className="w-full shrink-0"
            aria-hidden={!expanded}
            {...(!expanded ? { inert: "" } : {})}
          >
            <motion.div
              style={{ opacity: songsOpacity, y: songsY }}
              className="flex flex-col gap-[11px] items-start w-full pb-[8px]"
            >
              <div className="px-[12px] w-full">
                <p
                  className="text-[12px] leading-[16px] font-normal text-[#a3a3a3]"
                  style={{ fontFamily: "'Inter',system-ui,sans-serif", fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0" }}
                >
                  Recent songs
                </p>
              </div>

              {/* overflow:visible so discs can pop above the row boundary */}
              <div
                className="flex gap-[16px] items-start px-[12px] w-full"
                style={{ overflow: "visible" }}
              >
                {ALBUMS.map((album) => (
                  <AlbumCard key={album.id} album={album} reduceMotion={reduceMotion} />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* ── Input card ────────────────────────────────────
               Plain div + DOM ref: no Framer Motion wrapper → no will-change:transform
               at rest → CPU text rendering → correct weight at all times. */}
          <div style={{ width: "100%" }}>
            <div
              ref={bottomCardRef}
              onPointerDown={(e) => dragControls.start(e)}
              className="bg-white rounded-[20px] border border-[#ebebeb] w-full shrink-0"
              style={{ boxShadow: "0px 1px 2px 0px rgba(10,13,20,0.03)" }}
            >
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-[24px] items-start p-[12px] w-full"
              >
                {/* Textarea — real interactive input, placeholder matches Figma style */}
                <textarea
                  ref={textareaRef}
                  value={message}
                  rows={1}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="What mood are you in"
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter submits; Shift+Enter adds newline
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  // Prevent drag-start when typing
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full resize-none outline-none bg-transparent leading-[16px]"
                  style={{
                    fontFamily: "'Inter',system-ui,sans-serif",
                    fontSize: 12,
                    fontWeight: 400,
                    fontStyle: "normal",
                    color: message ? "#171717" : undefined,
                    fontFeatureSettings: "'ss11' 1,'calt' 0,'liga' 0",
                    // Placeholder color set via CSS in index.css
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
                      boxShadow: "0px 0px 0px 0.75px #171717,inset 0px 1px 2px 0px rgba(255,255,255,0.16)",
                      touchAction: "manipulation",
                    }}
                  >
                    {/* Gloss overlay */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[8px] pointer-events-none"
                      style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.154) 6.67%,rgba(255,255,255,0) 103.33%)" }}
                    />
                    <div className="relative z-10 size-[14px] flex items-center justify-center">
                      <ArrowUpIcon />
                    </div>
                  </motion.button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
