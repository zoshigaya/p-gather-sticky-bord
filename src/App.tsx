import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

type NoteColor = "red" | "yellow" | "blue";

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
const NOTES_PER_PAGE = 12;

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
];
const emojis = ["", "👏", "💖", "✨", "🥰", "🎉", "🌷"];

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

function notesOverlap(a: Pick<StickyNote, "x" | "y">, b: Pick<StickyNote, "x" | "y">) {
  return Math.abs(a.x - b.x) < 19 && Math.abs(a.y - b.y) < 29;
}

function findOpenSpot(existing: StickyNote[], preferredIndex: number) {
  const ordered = [...layoutSpots.slice(preferredIndex), ...layoutSpots.slice(0, preferredIndex)];
  const open = ordered.find(spot => existing.every(note => !notesOverlap(note, spot)));
  if (open) return open;

  return ordered.reduce((best, spot) => {
    const clearance = Math.min(...existing.map(note => Math.hypot(note.x - spot.x, note.y - spot.y)));
    return clearance > best.clearance ? { spot, clearance } : best;
  }, { spot: ordered[0], clearance: -1 }).spot;
}

function resolveSavedOverlaps(notes: StickyNote[]) {
  const resolved: StickyNote[] = [];
  notes.forEach((note, index) => {
    const pageStart = Math.floor(index / NOTES_PER_PAGE) * NOTES_PER_PAGE;
    const notesOnPage = resolved.slice(pageStart);
    if (notesOnPage.some(placed => notesOverlap(placed, note))) {
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
      red: "red", yellow: "yellow", blue: "blue",
      pink: "red", purple: "red", green: "blue",
    };
    const migrated = (JSON.parse(value) as Array<Omit<StickyNote, "color"> & { color: string }>).map(note => ({
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

function Icon({ name }: { name: "pen" | "heart" | "lock" | "close" | "trash" | "sparkle" }) {
  const paths = {
    pen: <><path d="m14.7 6.3 3 3"/><path d="M4 20l4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/></>,
    sparkle: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/><path d="m5 14 .6 1.8 1.9.7-1.9.6L5 19l-.6-1.9-1.9-.6 1.9-.7L5 14Z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function DrawingCanvas({ onChange }: { onChange: (data?: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext("2d")!;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = event.currentTarget.getContext("2d")!;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#423d38";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current?.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(undefined);
  };

  return <div className="drawing-wrap">
    <canvas ref={canvasRef} width="760" height="380" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
    <div className="drawing-hint"><span>ここに指やマウスで落書きできます</span><button type="button" onClick={clear}>描き直す</button></div>
  </div>;
}

type NoteFormProps = { onClose: () => void; onCreate: (input: Pick<StickyNote, "author" | "text" | "color" | "emoji" | "drawing">) => void };

function NoteForm({ onClose, onCreate }: NoteFormProps) {
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [emoji, setEmoji] = useState("");
  const [drawing, setDrawing] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() && !drawing) return;
    onCreate({ author: author.trim() || undefined, text: text.trim(), color, emoji: emoji || undefined, drawing });
  };
  return <Modal onClose={onClose} className="create-modal">
    <div className="modal-heading"><div><span className="eyebrow">NEW STICKY NOTE</span><h2>感想を貼る</h2></div><CloseButton onClick={onClose}/></div>
    <form onSubmit={submit}>
      <label className="field"><span>お名前 <small>任意</small></span><input value={author} maxLength={30} onChange={e => setAuthor(e.target.value)} placeholder="匿名でも大丈夫です" /></label>
      <label className="field"><span>感想 <small>絵だけでもOK</small></span><textarea autoFocus value={text} maxLength={500} onChange={e => setText(e.target.value)} placeholder="好きだったところ、ひとこと感想など…（空欄でもOK）"/><small className="counter">{text.length} / 500</small></label>
      <fieldset><legend>付箋の色</legend><div className="color-options">{colors.map(item => <label key={item.id} title={item.label}><input type="radio" name="color" checked={color === item.id} onChange={() => setColor(item.id)}/><span className={`swatch ${item.id}`}/><span>{item.label}</span></label>)}</div></fieldset>
      <fieldset><legend>リアクション <small>任意</small></legend><div className="emoji-options">{emojis.map((item, index) => <button type="button" key={index} className={emoji === item ? "selected" : ""} onClick={() => setEmoji(item)}>{item || "なし"}</button>)}</div></fieldset>
      <fieldset><legend>らくがき <small>感想なしでも投稿できます</small></legend><DrawingCanvas onChange={setDrawing}/></fieldset>
      <div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>キャンセル</button><button type="submit" className="button primary" disabled={!text.trim() && !drawing}><Icon name="pen"/>この付箋を貼る</button></div>
    </form>
  </Modal>;
}

function Modal({ children, onClose, className = "" }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className={`modal ${className}`} role="dialog" aria-modal="true">{children}</section></div>;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return <button className="icon-button" aria-label="閉じる" onClick={onClick}><Icon name="close"/></button>;
}

export default function App() {
  const [notes, setNotes] = useState<StickyNote[]>(loadNotes);
  const [ownerId] = useState(getOwnerId);
  const [page, setPage] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(loadLiked);
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | undefined>(undefined);
  const readOnly = String(import.meta.env.VITE_READ_ONLY).toLowerCase() === "true";
  const pageCount = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const visibleNotes = notes.slice(page * NOTES_PER_PAGE, (page + 1) * NOTES_PER_PAGE);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)), [notes]);
  useEffect(() => localStorage.setItem(LIKED_KEY, JSON.stringify([...liked])), [liked]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  const selected = notes.find(note => note.id === selectedId);
  const createNote = (input: Pick<StickyNote, "author" | "text" | "color" | "emoji" | "drawing">) => {
    const now = new Date().toISOString();
    const slot = notes.length % NOTES_PER_PAGE;
    const destinationPage = Math.floor(notes.length / NOTES_PER_PAGE);
    const notesOnDestinationPage = notes.slice(destinationPage * NOTES_PER_PAGE);
    const openSpot = findOpenSpot(notesOnDestinationPage, slot);
    const note: StickyNote = {
      ...input,
      id: crypto.randomUUID(),
      ownerId,
      x: openSpot.x + Math.random(),
      y: openSpot.y + Math.random(),
      likes: 0,
      rotation: -2.5 + Math.random() * 5,
      createdAt: now,
      updatedAt: now,
    };
    setNotes(current => [...current, note]);
    setPage(destinationPage);
    setCreating(false);
    setToast("付箋をボードに貼りました！");
  };
  const like = (id: string) => {
    if (readOnly || liked.has(id)) return;
    setNotes(current => current.map(note => note.id === id ? { ...note, likes: note.likes + 1, updatedAt: new Date().toISOString() } : note));
    setLiked(current => new Set(current).add(id));
  };
  const remove = (id: string) => {
    if (!confirm("この付箋を削除しますか？")) return;
    setNotes(current => current.filter(note => note.id !== id));
    setSelectedId(undefined);
    setToast("付箋を削除しました");
  };
  const dragStart = (event: ReactPointerEvent<HTMLButtonElement>, note: StickyNote) => {
    if (isMobile) return;
    if (!admin && (readOnly || note.ownerId !== ownerId)) return;
    const board = boardRef.current!;
    const rect = board.getBoundingClientRect();
    const noteRect = event.currentTarget.getBoundingClientRect();
    drag.current = { id: note.id, dx: event.clientX - noteRect.left, dy: event.clientY - noteRect.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (nativeEvent: PointerEvent) => {
      if (!drag.current) return;
      const x = Math.max(0, Math.min(82, ((nativeEvent.clientX - rect.left - drag.current.dx) / rect.width) * 100));
      const y = Math.max(0, Math.min(76, ((nativeEvent.clientY - rect.top - drag.current.dy) / rect.height) * 100));
      if (Math.abs(nativeEvent.movementX) + Math.abs(nativeEvent.movementY) > 1) drag.current.moved = true;
      setNotes(current => current.map(item => item.id === note.id ? { ...item, x, y } : item));
    };
    const end = () => {
      const didMove = drag.current?.moved;
      setNotes(current => current.map(item => item.id === note.id ? { ...item, updatedAt: new Date().toISOString() } : item));
      drag.current = undefined;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      if (!didMove) setSelectedId(note.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };
  const loginAdmin = (event: FormEvent) => {
    event.preventDefault();
    const expected = import.meta.env.VITE_ADMIN_PASSWORD || "admin";
    if (adminPassword === expected) {
      setAdmin(true); setAdminOpen(false); setAdminPassword(""); setAdminError(false); setToast("管理者モードを有効にしました");
    } else setAdminError(true);
  };

  return <div className="app-shell handmade-shell">
    <header className="handmade-header">
      <a className="tiny-home" href="#top">ぺたぺた 感想ボード</a>
      <div className="header-actions">
        {readOnly && <span className="readonly-badge"><span/> 閲覧専用</span>}
        {admin ? <button className="text-button active" onClick={() => setAdmin(false)}><Icon name="lock"/>管理者モード中</button> : <button className="text-button" onClick={() => setAdminOpen(true)}><Icon name="lock"/>管理者</button>}
      </div>
    </header>

    <main id="top">
      <section className="welcome-paper">
        <span className="welcome-tape" aria-hidden="true"/>
        <span className="scribble star-one" aria-hidden="true">☆</span>
        <span className="scribble star-two" aria-hidden="true">＊</span>
        <div>
          <p className="little-note">Pギャザに来てくれてありがとう</p>
          <h1>Pギャザ<br/><span>感想ボード</span></h1>
          <p className="welcome-copy">展示を見た感想を、付箋に書いて貼っていってね。<br/>ひとことだけでも、らくがきだけでも大丈夫！</p>
        </div>
        <div className="welcome-action">
          {!readOnly && <button className="write-button" onClick={() => setCreating(true)}><Icon name="pen"/>感想を書く</button>}
          {readOnly && <p className="readonly-message">いまは思い出として公開中です</p>}
          <small>名前は書かなくてもOKです ◎</small>
        </div>
      </section>

      <section className="board-section">
        <div className="board-label"><span className="pin"/><span>{notes.length}枚の付箋</span><small>{readOnly ? "クリックすると読めます" : "自分で書いた付箋だけ動かせます"}</small></div>
        <div className="board-frame">
          <div className="frame-screw s1"/><div className="frame-screw s2"/><div className="frame-screw s3"/><div className="frame-screw s4"/>
          <div
            className="board"
            ref={boardRef}
            style={{ "--mobile-board-height": `${Math.max(2, Math.ceil(visibleNotes.length / 2)) * 180 + 20}px` } as React.CSSProperties}
          >
            <div className="board-grain"/>
            {visibleNotes.map((note, index) => {
              const mine = note.ownerId === ownerId;
              const canMove = !isMobile && (admin || (!readOnly && mine));
              return <button
              type="button"
              className={`sticky-note ${note.color} ${canMove ? "is-mine" : "is-locked"}`}
              key={note.id}
              style={{ left: `${note.x}%`, top: `${note.y}%`, transform: `rotate(${note.rotation}deg)`, zIndex: index + 1 }}
              onPointerDown={event => dragStart(event, note)}
              onClick={() => !canMove && setSelectedId(note.id)}
              aria-label={`${note.author || "匿名"}さんの付箋を読む`}
              title={canMove ? (admin ? "管理者：ドラッグで動かせます" : "あなたの付箋：ドラッグで動かせます") : "クリックして読む"}
            >
              <span className="note-tape"/>
              {canMove && <span className="mine-mark">{admin && !mine ? "かんり" : "じぶんの"}</span>}
              {note.emoji && <span className="note-emoji">{note.emoji}</span>}
              {note.drawing && <img className={`note-drawing ${!note.text ? "only-drawing" : ""}`} src={note.drawing} alt="投稿された落書き"/>}
              {note.text && <span className="note-text">{note.text}</span>}
              <span className="note-footer"><span>{note.author || "匿名"}</span><span className="note-like">♡ {note.likes}</span></span>
            </button>})}
            {!notes.length && <div className="empty-board"><span>✦</span><b>まだ付箋がありません</b><p>最初の一枚を貼ってみませんか？</p></div>}
          </div>
        </div>
        <nav className="board-pagination" aria-label="付箋のページ">
          <button disabled={page === 0} onClick={() => setPage(current => current - 1)} aria-label="前のページ">←</button>
          <span><b>{page + 1}</b> / {pageCount} ページ</span>
          <button disabled={page === pageCount - 1} onClick={() => setPage(current => current + 1)} aria-label="次のページ">→</button>
        </nav>
        <p className="board-help">付箋をクリックすると、ぜんぶ読めます</p>
      </section>
    </main>

    <footer className="handmade-footer"><p>またあとで、みんなで読み返そう。</p><span>✐　Pギャザ感想ボード</span></footer>

    {creating && <NoteForm onClose={() => setCreating(false)} onCreate={createNote}/>}
    {selected && <Modal onClose={() => setSelectedId(undefined)} className="detail-modal">
      <div className="modal-heading"><span className={`detail-color-dot ${selected.color}`}/><CloseButton onClick={() => setSelectedId(undefined)}/></div>
      <div className={`detail-paper ${selected.color}`}>
        {selected.emoji && <span className="detail-emoji">{selected.emoji}</span>}
        {selected.drawing && <img src={selected.drawing} alt="投稿された落書き"/>}
        {selected.text && <p>{selected.text}</p>}
        <div className="detail-meta"><b>{selected.author || "匿名"}</b><time>{formatDate(selected.createdAt)}</time></div>
      </div>
      <div className="detail-actions">
        <button className={`like-button ${liked.has(selected.id) ? "liked" : ""}`} disabled={readOnly || liked.has(selected.id)} onClick={() => like(selected.id)}><Icon name="heart"/>{liked.has(selected.id) ? "ありがとう！" : "ハートを贈る"}<b>{selected.likes}</b></button>
        {admin && <button className="delete-button" onClick={() => remove(selected.id)}><Icon name="trash"/>削除</button>}
      </div>
    </Modal>}
    {adminOpen && <Modal onClose={() => setAdminOpen(false)} className="admin-modal">
      <div className="modal-heading"><div><span className="eyebrow">FOR ORGANIZER</span><h2>管理者モード</h2></div><CloseButton onClick={() => setAdminOpen(false)}/></div>
      <p>管理者パスワードを入力すると、各付箋の詳細画面から削除できます。</p>
      <form onSubmit={loginAdmin}><label className="field"><span>パスワード</span><input type="password" autoFocus value={adminPassword} onChange={e => { setAdminPassword(e.target.value); setAdminError(false); }} placeholder="パスワードを入力"/></label>{adminError && <p className="error">パスワードが違います</p>}<button className="button primary" type="submit">管理者モードに入る</button></form>
    </Modal>}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>;
}
