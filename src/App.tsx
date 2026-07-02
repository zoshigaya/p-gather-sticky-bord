import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { isSupabaseEnabled, supabase } from "./supabase";

type NoteColor = "red" | "yellow" | "blue" | "green";

type StickyNote = {
  id: string;
  author?: string;
  text: string;
  color: NoteColor;
  x: number;
  y: number;
  emoji?: string;
  drawing?: string;
  likes: number;
  rotation: number;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
};

const STORAGE_KEY = "p-gather-sticky-notes-v1";
const LIKED_KEY = "p-gather-liked-notes-v1";
const OWNER_KEY = "p-gather-board-owner-v1";
const LAST_POSTED_AT_KEY = "p-gather-last-posted-at-v1";
const NOTES_PER_PAGE = 12;
const POST_COOLDOWN_MS = 15 * 60 * 1000;
const NOTE_TEXT_MAX_LENGTH = 200;

function getOwnerId() {
  const saved = localStorage.getItem(OWNER_KEY);
  if (saved) return saved;
  const id = crypto.randomUUID();
  localStorage.setItem(OWNER_KEY, id);
  return id;
}
const colors: { id: NoteColor; label: string }[] = [
  { id: "red", label: "あか" },
  { id: "yellow", label: "きいろ" },
  { id: "blue", label: "あお" },
  { id: "green", label: "みどり" },
];
const emojis = ["", "🥳", "✌", "👏", "🍛", "🎉", "🌷", "🍫"];

const starterNotes: StickyNote[] = [
  {
    id: "welcome-1",
    author: "主催",
    text: "ようこそ！ 作品の好きだったところや、ひとこと感想を気軽に貼っていってくださいね。",
    color: "yellow",
    x: 8,
    y: 12,
    emoji: "🌷",
    likes: 7,
    rotation: -2.4,
    createdAt: "2026-06-29T02:00:00.000Z",
    updatedAt: "2026-06-29T02:00:00.000Z",
  },
  {
    id: "welcome-2",
    author: "通りすがりの読者",
    text: "色づかいがとっても素敵でした！ 特に最後の一枚が大好きです。",
    color: "red",
    x: 38,
    y: 8,
    emoji: "💖",
    likes: 12,
    rotation: 1.5,
    createdAt: "2026-06-29T02:15:00.000Z",
    updatedAt: "2026-06-29T02:15:00.000Z",
  },
  {
    id: "welcome-3",
    text: "新刊読みました！ ふたりの会話がかわいくて、ずっとにこにこしていました☺",
    color: "blue",
    x: 67,
    y: 18,
    emoji: "✨",
    likes: 5,
    rotation: -1.2,
    createdAt: "2026-06-29T02:30:00.000Z",
    updatedAt: "2026-06-29T02:30:00.000Z",
  },
  {
    id: "welcome-4",
    author: "にこ",
    text: "会場の雰囲気まで含めて、最高の展示でした。また見たいです！",
    color: "blue",
    x: 25,
    y: 49,
    emoji: "👏",
    likes: 9,
    rotation: 2.1,
    createdAt: "2026-06-29T03:05:00.000Z",
    updatedAt: "2026-06-29T03:05:00.000Z",
  },
];

const layoutSpots = Array.from({ length: NOTES_PER_PAGE }, (_, index) => ({
  x: 5 + (index % 4) * 25,
  y: 6 + Math.floor(index / 4) * 32,
}));

function notesOverlap(
  a: Pick<StickyNote, "x" | "y">,
  b: Pick<StickyNote, "x" | "y">,
) {
  return Math.abs(a.x - b.x) < 19 && Math.abs(a.y - b.y) < 29;
}

function findOpenSpot(existing: StickyNote[], preferredIndex: number) {
  const ordered = [
    ...layoutSpots.slice(preferredIndex),
    ...layoutSpots.slice(0, preferredIndex),
  ];
  const open = ordered.find((spot) =>
    existing.every((note) => !notesOverlap(note, spot)),
  );
  if (open) return open;

  return ordered.reduce(
    (best, spot) => {
      const clearance = Math.min(
        ...existing.map((note) => Math.hypot(note.x - spot.x, note.y - spot.y)),
      );
      return clearance > best.clearance ? { spot, clearance } : best;
    },
    { spot: ordered[0], clearance: -1 },
  ).spot;
}

function resolveSavedOverlaps(notes: StickyNote[]) {
  const resolved: StickyNote[] = [];
  notes.forEach((note, index) => {
    const pageStart = Math.floor(index / NOTES_PER_PAGE) * NOTES_PER_PAGE;
    const notesOnPage = resolved.slice(pageStart);
    if (notesOnPage.some((placed) => notesOverlap(placed, note))) {
      const spot = findOpenSpot(notesOnPage, index % NOTES_PER_PAGE);
      resolved.push({ ...note, ...spot, updatedAt: new Date().toISOString() });
    } else {
      resolved.push(note);
    }
  });
  return resolved;
}

function loadNotes() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return resolveSavedOverlaps(starterNotes);
    const legacyColors: Record<string, NoteColor> = {
      red: "red",
      yellow: "yellow",
      blue: "blue",
      green: "green",
      pink: "red",
      purple: "red",
    };
    const migrated = (
      JSON.parse(value) as Array<Omit<StickyNote, "color"> & { color: string }>
    ).map((note) => ({
      ...note,
      color: legacyColors[note.color] ?? "yellow",
    }));
    return resolveSavedOverlaps(migrated);
  } catch {
    return resolveSavedOverlaps(starterNotes);
  }
}

function loadLiked() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(LIKED_KEY) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fromDatabase(row: Record<string, unknown>): StickyNote {
  return {
    id: row.id as string,
    ownerId: row.user_id as string,
    author: (row.author as string | null) ?? undefined,
    text: row.text as string,
    color: row.color as NoteColor,
    x: row.x as number,
    y: row.y as number,
    emoji: (row.emoji as string | null) ?? undefined,
    drawing: (row.drawing_url as string | null) ?? undefined,
    likes: row.likes as number,
    rotation: row.rotation as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function drawingToBlob(dataUrl: string) {
  return await (await fetch(dataUrl)).blob();
}

function Icon({
  name,
}: {
  name: "pen" | "heart" | "lock" | "close" | "trash" | "sparkle";
}) {
  const paths = {
    pen: (
      <>
        <path d="m14.7 6.3 3 3" />
        <path d="M4 20l4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2M19 6l-1 15H6L5 6" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
        <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
        <path d="m5 14 .6 1.8 1.9.7-1.9.6L5 19l-.6-1.9-1.9-.6 1.9-.7L5 14Z" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function DrawingCanvas({ onChange }: { onChange: (data?: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [lineWidth, setLineWidth] = useState(7);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = event.pointerId;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext("2d")!;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || activePointerId.current !== event.pointerId) return;
    const ctx = event.currentTarget.getContext("2d")!;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = "#423d38";
    ctx.lineWidth = tool === "eraser" ? lineWidth * 2.2 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  const end = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || activePointerId.current !== event.pointerId) return;
    drawing.current = false;
    activePointerId.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixels = canvas
      .getContext("2d")
      ?.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasInk = pixels
      ? pixels.some((value, index) => index % 4 === 3 && value > 0)
      : false;
    onChange(hasInk ? canvas.toDataURL("image/png") : undefined);
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(undefined);
  };

  return (
    <div className="drawing-wrap">
      <div className="drawing-tools">
        <button
          type="button"
          className={tool === "pen" ? "active" : ""}
          onClick={() => setTool("pen")}
        >
          ✎ ペン
        </button>
        <button
          type="button"
          className={tool === "eraser" ? "active" : ""}
          onClick={() => setTool("eraser")}
        >
          ▱ 消しゴム
        </button>
        <label>
          太さ{" "}
          <input
            type="range"
            min="3"
            max="24"
            value={lineWidth}
            onChange={(event) => setLineWidth(Number(event.target.value))}
          />
        </label>
      </div>
      <canvas
        ref={canvasRef}
        width="760"
        height="380"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="drawing-hint">
        <span>ここに指やマウスで落書きできます</span>
        <button type="button" onClick={clear}>
          描き直す
        </button>
      </div>
    </div>
  );
}

type NoteFormProps = {
  onClose: () => void;
  onCreate: (
    input: Pick<StickyNote, "author" | "text" | "color" | "emoji" | "drawing">,
  ) => void;
};

function NoteForm({ onClose, onCreate }: NoteFormProps) {
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [emoji, setEmoji] = useState("");
  const [drawing, setDrawing] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() && !drawing) return;
    onCreate({
      author: author.trim() || undefined,
      text: text.trim(),
      color,
      emoji: emoji || undefined,
      drawing,
    });
  };
  return (
    <Modal onClose={onClose} className="create-modal">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">NEW STICKY NOTE</span>
          <h2>感想を貼る</h2>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <form onSubmit={submit}>
        <label className="field">
          <span>
            お名前 <small>任意</small>
          </span>
          <input
            value={author}
            maxLength={30}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="匿名でも大丈夫です"
          />
        </label>
        <label className="field">
          <span>
            感想 <small>絵だけでもOK</small>
          </span>
          <textarea
            autoFocus
            value={text}
            maxLength={NOTE_TEXT_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="好きだったところ、ひとこと感想など…（空欄でもOK）"
          />
          <small className="counter">
            {text.length} / {NOTE_TEXT_MAX_LENGTH}
          </small>
        </label>
        <fieldset>
          <legend>
            らくがき <small>感想なしでも投稿できます</small>
          </legend>
          <DrawingCanvas onChange={setDrawing} />
        </fieldset>
        <fieldset>
          <legend>付箋の色</legend>
          <div className="color-options">
            {colors.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                className={color === item.id ? "selected" : ""}
                aria-pressed={color === item.id}
                onClick={() => setColor(item.id)}
              >
                <span className={`swatch ${item.id}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            リアクション <small>任意</small>
          </legend>
          <div className="emoji-options">
            {emojis.map((item, index) => (
              <button
                type="button"
                key={index}
                className={emoji === item ? "selected" : ""}
                onClick={() => setEmoji(item)}
              >
                {item || "なし"}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!text.trim() && !drawing}
          >
            <Icon name="pen" />
            この付箋を貼る
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  children,
  onClose,
  className = "",
}: {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={`modal ${className}`} role="dialog" aria-modal="true">
        {children}
      </section>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-button" aria-label="閉じる" onClick={onClick}>
      <Icon name="close" />
    </button>
  );
}

export default function App() {
  const [notes, setNotes] = useState<StickyNote[]>(() =>
    isSupabaseEnabled
      ? []
      : loadNotes().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  const [ownerId] = useState(getOwnerId);
  const [remoteOwnerId, setRemoteOwnerId] = useState<string>();
  const [page, setPage] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(() =>
    isSupabaseEnabled ? new Set() : loadLiked(),
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(isSupabaseEnabled);
  const [connectionError, setConnectionError] = useState("");
  const readOnly =
    String(import.meta.env.VITE_READ_ONLY).toLowerCase() === "true";
  const effectiveOwnerId = remoteOwnerId ?? ownerId;
  const pageCount = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const visibleNotes = notes.slice(
    page * NOTES_PER_PAGE,
    (page + 1) * NOTES_PER_PAGE,
  );

  useEffect(() => {
    if (!isSupabaseEnabled)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    if (!isSupabaseEnabled)
      localStorage.setItem(LIKED_KEY, JSON.stringify([...liked]));
  }, [liked]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    const fetchRemoteNotes = async () => {
      const { data, error } = await client
        .from("sticky_notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) throw error;
      setNotes((data ?? []).map((row) => fromDatabase(row)));
    };

    const initialize = async () => {
      try {
        const { data: sessionData } = await client.auth.getSession();
        let user = sessionData.session?.user;
        if (!user) {
          const { data, error } = await client.auth.signInAnonymously();
          if (error) throw error;
          user = data.user ?? undefined;
        }
        if (!user) throw new Error("匿名ユーザーを作成できませんでした");
        if (!active) return;
        setRemoteOwnerId(user.id);
        await fetchRemoteNotes();
        const { data: likeRows, error: likeError } = await client
          .from("sticky_note_likes")
          .select("note_id")
          .eq("user_id", user.id);
        if (likeError) throw likeError;
        if (active)
          setLiked(
            new Set((likeRows ?? []).map((row) => row.note_id as string)),
          );
      } catch (error) {
        if (active)
          setConnectionError(
            error instanceof Error
              ? error.message
              : "Supabaseへ接続できませんでした",
          );
      } finally {
        if (active) setLoading(false);
      }
    };

    void initialize();
    const channel = client
      .channel("sticky-notes-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sticky_notes" },
        () => {
          void fetchRemoteNotes().catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("admin") === "1")
      setAdminOpen(true);
  }, []);

  const selected = notes.find((note) => note.id === selectedId);
  const createNote = async (
    input: Pick<StickyNote, "author" | "text" | "color" | "emoji" | "drawing">,
  ) => {
    const lastPostedAt = Number(localStorage.getItem(LAST_POSTED_AT_KEY) ?? 0);
    const remainingMs = POST_COOLDOWN_MS - (Date.now() - lastPostedAt);
    if (remainingMs > 0) {
      setToast(
        `連続投稿は15分空けてください（あと約${Math.ceil(remainingMs / 60000)}分）`,
      );
      return;
    }
    const now = new Date().toISOString();
    const note: StickyNote = {
      ...input,
      id: crypto.randomUUID(),
      ownerId: effectiveOwnerId,
      x: 0,
      y: 0,
      likes: 0,
      rotation: -2.5 + Math.random() * 5,
      createdAt: now,
      updatedAt: now,
    };
    if (supabase) {
      if (!remoteOwnerId) {
        setToast("接続準備中です。少し待ってから試してください");
        return;
      }
      let uploadedDrawingPath: string | undefined;
      try {
        let drawingUrl: string | undefined;
        if (input.drawing) {
          const path = `${remoteOwnerId}/${note.id}.png`;
          const { error: uploadError } = await supabase.storage
            .from("drawings")
            .upload(path, await drawingToBlob(input.drawing), {
              contentType: "image/png",
              upsert: false,
            });
          if (uploadError) throw uploadError;
          uploadedDrawingPath = path;
          drawingUrl = supabase.storage.from("drawings").getPublicUrl(path)
            .data.publicUrl;
        }
        const { data, error } = await supabase
          .from("sticky_notes")
          .insert({
            id: note.id,
            user_id: remoteOwnerId,
            author: note.author ?? null,
            text: note.text,
            color: note.color,
            x: note.x,
            y: note.y,
            emoji: note.emoji ?? null,
            drawing_url: drawingUrl ?? null,
            rotation: note.rotation,
          })
          .select()
          .single();
        if (error) throw error;
        setNotes((current) => [
          fromDatabase(data),
          ...current.filter((item) => item.id !== note.id),
        ]);
      } catch (error) {
        if (uploadedDrawingPath) {
          await supabase.storage.from("drawings").remove([uploadedDrawingPath]);
        }
        const message =
          typeof error === "object" && error && "message" in error
            ? String(error.message)
            : "";
        setToast(
          message.includes("sticky_note_rate_limit")
            ? "連続投稿は15分空けてください"
            : message
              ? `投稿できませんでした：${message}`
              : "投稿できませんでした",
        );
        return;
      }
    } else {
      setNotes((current) => [note, ...current]);
    }
    localStorage.setItem(LAST_POSTED_AT_KEY, String(Date.now()));
    setPage(0);
    setCreating(false);
    setToast("付箋をボードに貼りました！");
  };
  const like = async (id: string) => {
    if (readOnly || liked.has(id)) return;
    if (supabase) {
      if (!remoteOwnerId) return;
      const { error } = await supabase
        .from("sticky_note_likes")
        .insert({ note_id: id, user_id: remoteOwnerId });
      if (error && error.code !== "23505") {
        setToast("ハートを送れませんでした");
        return;
      }
      setLiked((current) => new Set(current).add(id));
      const { data } = await supabase
        .from("sticky_notes")
        .select("likes, updated_at")
        .eq("id", id)
        .single();
      if (data)
        setNotes((current) =>
          current.map((note) =>
            note.id === id
              ? { ...note, likes: data.likes, updatedAt: data.updated_at }
              : note,
          ),
        );
      return;
    }
    setNotes((current) =>
      current.map((note) =>
        note.id === id
          ? {
              ...note,
              likes: note.likes + 1,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    );
    setLiked((current) => new Set(current).add(id));
  };
  const remove = async (id: string) => {
    const note = notes.find((item) => item.id === id);
    const isOwner = note?.ownerId === effectiveOwnerId;
    if (!admin && (readOnly || !isOwner)) return;
    if (!confirm("この付箋を削除しますか？")) return;
    if (supabase) {
      const result = admin
        ? await supabase.rpc("admin_delete_sticky_note", {
            note_id: id,
            provided_password: adminSecret,
          })
        : await supabase
            .from("sticky_notes")
            .delete()
            .eq("id", id)
            .eq("user_id", remoteOwnerId);
      if (result.error || (admin && !result.data)) {
        setToast("削除できませんでした");
        return;
      }
    }
    setNotes((current) => current.filter((note) => note.id !== id));
    setSelectedId(undefined);
    setToast("付箋を削除しました");
  };
  const loginAdmin = async (event: FormEvent) => {
    event.preventDefault();
    let valid = false;
    if (supabase) {
      const { data, error } = await supabase.rpc("verify_board_admin", {
        provided_password: adminPassword,
      });
      valid = !error && data === true;
    } else {
      valid =
        adminPassword === (import.meta.env.VITE_ADMIN_PASSWORD || "admin");
    }
    if (valid) {
      setAdminSecret(adminPassword);
      setAdmin(true);
      setAdminOpen(false);
      setAdminPassword("");
      setAdminError(false);
      setToast("管理者モードを有効にしました");
    } else setAdminError(true);
  };

  const exportNotes = (format: "json" | "csv") => {
    const stamp = new Date().toISOString().slice(0, 10);
    let content: string;
    let mime: string;
    if (format === "json") {
      content = JSON.stringify(
        { exportedAt: new Date().toISOString(), notes },
        null,
        2,
      );
      mime = "application/json;charset=utf-8";
    } else {
      const safeCell = (value: unknown) => {
        let text = String(value ?? "");
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
      };
      const rows = [
        [
          "id",
          "name",
          "comment",
          "color",
          "emoji",
          "likes",
          "drawing_url",
          "x",
          "y",
          "created_at",
        ],
        ...notes.map((note) => [
          note.id,
          note.author ?? "",
          note.text,
          note.color,
          note.emoji ?? "",
          note.likes,
          note.drawing ?? "",
          note.x,
          note.y,
          note.createdAt,
        ]),
      ];
      content = `\uFEFF${rows.map((row) => row.map(safeCell).join(",")).join("\r\n")}`;
      mime = "text/csv;charset=utf-8";
    }
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `p-gather-sticky-notes-${stamp}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast(`${format.toUpperCase()}を書き出しました`);
  };

  return (
    <div className="app-shell handmade-shell">
      <header className="handmade-header">
        <a className="tiny-home" href="#top">
          Pギャザ 感想ボード
        </a>
        {readOnly && (
          <span className="readonly-badge">
            <span /> 閲覧専用
          </span>
        )}
      </header>

      <main id="top">
        {admin && (
          <div className="admin-tools">
            <b>管理者メニュー</b>
            <button onClick={() => exportNotes("json")}>JSON保存</button>
            <button onClick={() => exportNotes("csv")}>CSV保存</button>
            <button
              onClick={() => {
                setAdmin(false);
                setAdminSecret("");
              }}
            >
              終了
            </button>
          </div>
        )}
        <section className="welcome-paper">
          <span className="welcome-tape" aria-hidden="true" />
          <div>
            <p className="little-note">Pギャザに来てくれてありがとう</p>
            <h1>
              <span>感想ボード</span>
            </h1>
            <p className="welcome-copy">
              展示を見た感想を、付箋に書いて貼っていってね。
              <br />
              ひとことだけでも、らくがきだけでも大丈夫！
            </p>
          </div>
          <div className="welcome-action">
            {!readOnly && (
              <button
                className="write-button"
                onClick={() => setCreating(true)}
              >
                <Icon name="pen" />
                感想を書く
              </button>
            )}
            {readOnly && (
              <p className="readonly-message">いまは思い出として公開中です</p>
            )}
            <small>名前は書かなくてもOKです ◎</small>
          </div>
        </section>

        <section className="board-section">
          <div className="board-label">
            <span className="pin" />
            <span>
              {loading ? "付箋を読み込み中…" : `${notes.length}枚の付箋`}
            </span>
            <small>新しい付箋から順番に並んでいます</small>
          </div>
          {connectionError && (
            <div className="connection-error">
              <b>Supabaseの準備がまだ必要です</b>
              <span>{connectionError}</span>
            </div>
          )}
          <div className="board-frame">
            <div className="frame-screw s1" />
            <div className="frame-screw s2" />
            <div className="frame-screw s3" />
            <div className="frame-screw s4" />
            <div className="board">
              <div className="board-grain" />
              {visibleNotes.map((note, index) => (
                <button
                  type="button"
                  className={`sticky-note ${note.color}`}
                  key={note.id}
                  style={{
                    transform: `rotate(${note.rotation}deg)`,
                    zIndex: index + 1,
                  }}
                  onClick={() => setSelectedId(note.id)}
                  aria-label={`${note.author || "匿名"}さんの付箋を読む`}
                  title="クリックして読む"
                >
                  <span className="note-tape" />
                  {note.emoji && (
                    <span className="note-emoji">{note.emoji}</span>
                  )}
                  {note.drawing && (
                    <img
                      className={`note-drawing ${!note.text ? "only-drawing" : ""}`}
                      src={note.drawing}
                      alt="投稿された落書き"
                    />
                  )}
                  {note.text && <span className="note-text">{note.text}</span>}
                  <span className="note-footer">
                    <span>{note.author || "匿名"}</span>
                    <span className="note-like">♡ {note.likes}</span>
                  </span>
                </button>
              ))}
              {!notes.length && (
                <div className="empty-board">
                  <span>✦</span>
                  <b>まだ付箋がありません</b>
                </div>
              )}
            </div>
          </div>
          <nav className="board-pagination" aria-label="付箋のページ">
            <button
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              aria-label="前のページ"
            >
              ←
            </button>
            <span>
              <b>{page + 1}</b> / {pageCount} ページ
            </span>
            <button
              disabled={page === pageCount - 1}
              onClick={() => setPage((current) => current + 1)}
              aria-label="次のページ"
            >
              →
            </button>
          </nav>
          <p className="board-help">付箋をクリックすると、ぜんぶ読めます</p>
        </section>
      </main>

      <footer className="handmade-footer">
        <span>✐　感想ボード</span>
      </footer>

      {creating && (
        <NoteForm onClose={() => setCreating(false)} onCreate={createNote} />
      )}
      {selected && (
        <Modal
          onClose={() => setSelectedId(undefined)}
          className="detail-modal"
        >
          <div className="modal-heading">
            <span className={`detail-color-dot ${selected.color}`} />
            <CloseButton onClick={() => setSelectedId(undefined)} />
          </div>
          <div className={`detail-paper ${selected.color}`}>
            {selected.emoji && (
              <span className="detail-emoji">{selected.emoji}</span>
            )}
            {selected.drawing && (
              <img src={selected.drawing} alt="投稿された落書き" />
            )}
            {selected.text && <p>{selected.text}</p>}
            <div className="detail-meta">
              <b>{selected.author || "匿名"}</b>
              <time>{formatDate(selected.createdAt)}</time>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className={`like-button ${liked.has(selected.id) ? "liked" : ""}`}
              disabled={readOnly || liked.has(selected.id)}
              onClick={() => like(selected.id)}
            >
              <Icon name="heart" />
              {liked.has(selected.id) ? "ありがとう！" : "ハートを贈る"}
              <b>{selected.likes}</b>
            </button>
            {(admin ||
              (!readOnly && selected.ownerId === effectiveOwnerId)) && (
              <button
                className="delete-button"
                onClick={() => remove(selected.id)}
              >
                <Icon name="trash" />
                {admin ? "削除" : "自分の付箋を削除"}
              </button>
            )}
          </div>
        </Modal>
      )}
      {adminOpen && (
        <Modal onClose={() => setAdminOpen(false)} className="admin-modal">
          <div className="modal-heading">
            <div>
              <span className="eyebrow">FOR ORGANIZER</span>
              <h2>管理者モード</h2>
            </div>
            <CloseButton onClick={() => setAdminOpen(false)} />
          </div>
          <p>
            管理者パスワードを入力すると、各付箋の詳細画面から削除できます。
          </p>
          <form onSubmit={loginAdmin}>
            <label className="field">
              <span>パスワード</span>
              <input
                type="password"
                autoFocus
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setAdminError(false);
                }}
                placeholder="パスワードを入力"
              />
            </label>
            {adminError && <p className="error">パスワードが違います</p>}
            <button className="button primary" type="submit">
              管理者モードに入る
            </button>
          </form>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
