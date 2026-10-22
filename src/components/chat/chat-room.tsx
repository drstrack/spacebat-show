import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import { BatMark } from "@/components/bat-mark";
import { LivePlayer } from "@/components/live-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  deleteOwnMessage,
  getChatMe,
  joinChat,
  listChat,
  postChat,
  type ChatListItem,
  type ChatMe,
} from "@/lib/chat/chat.functions";
import type { GifHit } from "@/lib/chat/gifs.functions";
import {
  MAX_BODY_LENGTH,
  normalizeBody,
  slowDownDebug,
  slowDownSeconds,
  validateHandle,
} from "@/lib/chat/limits";
import { CHAT_RULES } from "@/lib/chat/rules";
import { AttachmentView } from "@/components/chat/attachment-view";
import { AttachmentDraft, ComposerAttach } from "@/components/chat/composer-attach";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { GifPicker } from "@/components/chat/gif-picker";
import { LiveBanner } from "@/components/chat/live-banner";
import { MessageBody } from "@/components/chat/message-body";
import { MessageMenu } from "@/components/chat/message-actions";
import { OnAirControl } from "@/components/chat/on-air-control";
import { OnlineMembers } from "@/components/chat/online-members";
import { OpenPopoutButton } from "@/components/chat/open-popout-button";
import { SystemMessage } from "@/components/chat/system-message";
import { adminDeleteMessage } from "@/lib/chat/moderation.functions";
import { beatChat } from "@/lib/chat/presence.functions";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/chat/presence";
import { isRemoved, type ChatAttachment, type ChatLive, type ChatOnlineMember } from "@/lib/chat/types";

const LIVE_TITLE_PREFIX = "🔴 LIVE · ";
const DEFAULT_POLL_MS = 4_000;
const IDLE_POLL_MS = 15_000;
const IDLE_AFTER_MS = 120_000;
const MAX_BACKOFF_MS = 60_000;
const NEAR_BOTTOM_PX = 80;
const COUNT_AT = 800;

type FeedRow =
  | {
      key: string;
      pending: true;
      nonce: string;
      handle: string;
      body: string;
      createdMs: number;
      attachment: ChatAttachment | null;
    }
  | { key: string; pending: false; id: number; deleted: true }
  | {
      key: string;
      pending: false;
      id: number;
      deleted: false;
      handle: string;
      body: string;
      createdMs: number;
      kind: "text" | "system" | "presence";
      mine: boolean;
      authorId?: string;
      attachment: ChatAttachment | null;
    };

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

function isUnauthorized(err: unknown): boolean {
  return errorText(err, "") === "Unauthorized";
}

function formatChatTime(ms: number, now = Date.now()): string {
  const date = new Date(ms);
  const current = new Date(now);
  const sameDay =
    date.getFullYear() === current.getFullYear() &&
    date.getMonth() === current.getMonth() &&
    date.getDate() === current.getDate();
  return new Intl.DateTimeFormat(
    undefined,
    sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  ).format(date);
}

function toFeedRow(item: ChatListItem): FeedRow {
  if (isRemoved(item)) return { key: `id:${item.id}`, pending: false, id: item.id, deleted: true };
  return {
    key: `id:${item.id}`,
    pending: false,
    id: item.id,
    deleted: false,
    handle: item.handle,
    body: item.body,
    createdMs: item.createdMs,
    kind: item.kind,
    mine: item.mine,
    authorId: item.authorId,
    attachment: item.attachment,
  };
}

function mergeRows(current: FeedRow[], incoming: ChatListItem[]): FeedRow[] {
  const incomingIds = new Set(incoming.map((item) => item.id));
  const next = current.filter((row) => row.pending || !incomingIds.has(row.id));
  for (const item of incoming) next.push(toFeedRow(item));
  next.sort((a, b) => {
    if (a.pending && b.pending) return a.createdMs - b.createdMs;
    if (a.pending) return 1;
    if (b.pending) return -1;
    return a.id - b.id;
  });
  return next;
}

function oldestId(rows: FeedRow[]): number | null {
  let oldest: number | null = null;
  for (const row of rows) {
    if (row.pending) continue;
    if (oldest == null || row.id < oldest) oldest = row.id;
  }
  return oldest;
}

function newestId(items: ChatListItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0);
}

export function ChatRoom({ layout = "page" }: { layout?: "page" | "popout" }) {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [phase, setPhase] = useState<"loading" | "signedOut" | "join" | "banned" | "ready">(
    "loading",
  );
  const [me, setMe] = useState<ChatMe | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [handle, setHandle] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [draft, setDraft] = useState("");
  const [gifReady, setGifReady] = useState<GifHit | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const removeUploadRef = useRef<(() => void) | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownTick, setCooldownTick] = useState(0);
  const [joining, setJoining] = useState(false);
  const [formError, setFormError] = useState("");
  const [sendError, setSendError] = useState("");
  const [notice, setNotice] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [live, setLive] = useState<ChatLive | null>(null);
  const [online, setOnline] = useState<ChatOnlineMember[] | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [popoutElsewhere, setPopoutElsewhere] = useState(false);
  const stickRef = useRef(true);
  const lastIdRef = useRef(0);
  const liveRef = useRef(false);
  const preserveRef = useRef<number | null>(null);
  const listTail = useRef(Promise.resolve());
  const sendingRef = useRef(false);
  const cooldownUntilRef = useRef(0);

  const enqueue = useCallback(<T,>(task: () => Promise<T>) => {
    const run = listTail.current.then(task, task);
    listTail.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= cooldownUntilRef.current) {
        cooldownUntilRef.current = 0;
        setCooldownUntil(0);
        setSendError((current) => (slowDownSeconds(current) != null ? "" : current));
        return;
      }
      setCooldownTick(Date.now());
    }, 200);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    setMounted(true);
    try {
      setShowImages(localStorage.getItem("spacebat-chat-show-images") !== "0");
    } catch {
      setShowImages(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted || isPending) return;
    if (!userId) {
      setPhase("signedOut");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    void getChatMe()
      .then((next) => {
        if (cancelled) return;
        setMe(next);
        setHandle(next.member?.handle ?? "");
        if (next.member?.banned) setPhase("banned");
        else if (!next.member?.rulesAccepted) setPhase("join");
        else setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          setPhase("signedOut");
          return;
        }
        setFormError(errorText(err, "Couldn’t open the room."));
        setPhase("join");
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, mounted, userId]);

  const rememberLive = useCallback((next: ChatLive | null | undefined) => {
    const liveNow = next ?? { isLive: false, sinceMs: null, source: null };
    liveRef.current = liveNow.isLive;
    setLive(liveNow);
    if (typeof document === "undefined") return;
    if (liveNow.isLive) {
      if (!document.title.startsWith(LIVE_TITLE_PREFIX)) {
        document.title = `${LIVE_TITLE_PREFIX}${document.title}`;
      }
      return;
    }
    if (document.title.startsWith(LIVE_TITLE_PREFIX)) {
      document.title = document.title.slice(LIVE_TITLE_PREFIX.length);
    }
  }, []);

  useEffect(() => {
    setRows([]);
    setHistoryReady(false);
    setHasEarlier(false);
    setShowNew(false);
    setOnline(null);
    lastIdRef.current = 0;
    rememberLive(null);
  }, [rememberLive, userId]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("spacebat-chat");
    channelRef.current = channel;
    if (layout === "popout") {
      const announce = () => channel.postMessage({ type: "popout-open" });
      const depart = () => channel.postMessage({ type: "popout-closed" });
      announce();
      channel.onmessage = (event) => {
        const type = event.data?.type;
        if (type === "popout-close") window.close();
        if (type === "popout-ping") announce();
      };
      window.addEventListener("pagehide", depart);
      return () => {
        depart();
        window.removeEventListener("pagehide", depart);
        channel.close();
        channelRef.current = null;
      };
    }
    channel.onmessage = (event) => {
      const type = event.data?.type;
      if (type === "popout-open") setPopoutElsewhere(true);
      if (type === "popout-closed") setPopoutElsewhere(false);
    };
    channel.postMessage({ type: "popout-ping" });
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [layout]);

  useEffect(() => {
    if (phase !== "ready") return;
    if (layout !== "popout" && popoutElsewhere) return;
    let stopped = false;
    let timer = 0;
    let idleSince = Date.now();
    let baseMs = DEFAULT_POLL_MS;
    let failures = 0;
    let sawHistory = false;
    let scheduled = false;

    const waitMs = () => {
      if (failures > 0) return Math.min(DEFAULT_POLL_MS * 2 ** failures, MAX_BACKOFF_MS);
      if (!liveRef.current && Date.now() - idleSince >= IDLE_AFTER_MS) return IDLE_POLL_MS;
      return baseMs;
    };

    const arm = () => {
      window.clearTimeout(timer);
      if (stopped || scheduled || document.visibilityState === "hidden") return;
      timer = window.setTimeout(() => {
        run();
      }, waitMs());
    };

    const run = () => {
      if (stopped || scheduled || document.visibilityState === "hidden") return;
      scheduled = true;
      window.clearTimeout(timer);
      void enqueue(async () => {
        try {
          if (stopped || document.visibilityState === "hidden") return;
          const result = sawHistory
            ? await listChat({ data: { after: lastIdRef.current } })
            : await listChat({ data: {} });
          if (stopped) return;
          rememberLive(result.live);
          if (Array.isArray(result.online)) setOnline(result.online);
          if (typeof result.nextPollMs === "number" && result.nextPollMs > 0) {
            baseMs = result.nextPollMs;
          }
          if (!sawHistory) {
            const newest = newestId(result.messages);
            if (newest > lastIdRef.current) lastIdRef.current = newest;
            stickRef.current = true;
            setRows((current) =>
              mergeRows(
                current.filter((row) => row.pending || row.id > newest),
                result.messages,
              ),
            );
            setHasEarlier(result.messages.length >= 50);
            setShowNew(false);
            setHistoryReady(true);
            sawHistory = true;
          } else if (result.messages.length > 0) {
            const newest = newestId(result.messages);
            if (newest > lastIdRef.current) lastIdRef.current = newest;
            idleSince = Date.now();
            const away = !stickRef.current;
            setRows((current) => mergeRows(current, result.messages));
            if (away) setShowNew(true);
          }
          failures = 0;
          setReconnecting(false);
          setFormError("");
          void getChatMe()
            .then((next) => {
              if (stopped) return;
              setMe(next);
              if (next.member?.banned) setPhase("banned");
            })
            .catch(() => undefined);
        } catch (err) {
          if (stopped) return;
          if (isUnauthorized(err)) {
            setPhase("signedOut");
            return;
          }
          if (errorText(err, "") === "You can't post in the room.") {
            setPhase("banned");
            return;
          }
          failures += 1;
          setReconnecting(true);
          if (!sawHistory) setFormError(errorText(err, "Couldn’t load messages."));
        } finally {
          scheduled = false;
          if (!stopped && document.visibilityState !== "hidden") arm();
        }
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        return;
      }
      void run();
    };

    const onKey = () => {
      const wasIdle = Date.now() - idleSince >= IDLE_AFTER_MS;
      idleSince = Date.now();
      if (wasIdle && failures === 0 && document.visibilityState === "visible") arm();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    if (document.visibilityState !== "hidden") void run();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [enqueue, layout, phase, popoutElsewhere, rememberLive]);

  useEffect(() => {
    if (phase !== "ready") return;
    if (layout !== "popout" && popoutElsewhere) return;
    let stopped = false;
    const beat = () => {
      if (stopped) return;
      void beatChat().catch(() => undefined);
    };
    const timer = window.setInterval(beat, PRESENCE_HEARTBEAT_MS);
    const onPageHide = () => {
      if (stopped) return;
      try {
        const body = new Blob(["1"], { type: "text/plain" });
        navigator.sendBeacon?.("/api/chat/presence", body);
      } catch {
        /* heartbeats stop with the page, so the leave still posts */
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [layout, phase, popoutElsewhere]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (preserveRef.current != null) {
      el.scrollTop = el.scrollHeight - preserveRef.current;
      preserveRef.current = null;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [rows]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distance < NEAR_BOTTOM_PX;
    if (stickRef.current) setShowNew(false);
  }

  function scrollToLatest() {
    stickRef.current = true;
    setShowNew(false);
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function loadEarlier() {
    const before = oldestId(rows);
    if (before == null || loadingEarlier) return;
    setLoadingEarlier(true);
    const el = scrollerRef.current;
    const preserve = el ? el.scrollHeight - el.scrollTop : null;
    try {
      const result = await enqueue(() => listChat({ data: { before } }));
      preserveRef.current = preserve;
      rememberLive(result.live);
      if (Array.isArray(result.online)) setOnline(result.online);
      setRows((current) => mergeRows(current, result.messages));
      if (result.messages.length < 50) setHasEarlier(false);
    } catch (err) {
      if (isUnauthorized(err)) setPhase("signedOut");
      else setSendError(errorText(err, "Couldn’t load earlier messages."));
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    const parsed = validateHandle(handle, me?.isAdmin ?? false);
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }
    if (!accepted) {
      setFormError("Accept the room rules to join.");
      return;
    }
    setJoining(true);
    setFormError("");
    try {
      const member = await joinChat({ data: { handle: parsed.handle, acceptRules: true } });
      setMe((current) => (current ? { ...current, member } : current));
      setHandle(member.handle);
      setPhase(member.banned ? "banned" : "ready");
    } catch (err) {
      if (isUnauthorized(err)) setPhase("signedOut");
      else setFormError(errorText(err, "Couldn’t join the room."));
    } finally {
      setJoining(false);
    }
  }

  async function submitDraft() {
    if (
      sendingRef.current ||
      uploadBusy ||
      me?.member?.muted ||
      Date.now() < cooldownUntilRef.current
    ) {
      return;
    }
    const raw = draftRef.current?.value ?? draft;
    const trimmed = raw.trim();
    if (!trimmed && !attachment) {
      setSendError("Write a message first.");
      return;
    }
    const normalized = trimmed ? normalizeBody(raw) : { ok: true as const, body: "" };
    if (!normalized.ok) {
      setSendError(normalized.error);
      return;
    }
    const nonce = crypto.randomUUID();
    const sentAttachment = attachment;
    const optimistic: FeedRow = {
      key: `pending:${nonce}`,
      pending: true,
      nonce,
      handle: me?.member?.handle ?? "You",
      body: normalized.body,
      createdMs: Date.now(),
      attachment: sentAttachment,
    };
    sendingRef.current = true;
    setSending(true);
    setSendError("");
    stickRef.current = true;
    setRows((current) => [...current, optimistic]);
    try {
      const saved = await postChat({
        data: { body: normalized.body, nonce, uploadId: sentAttachment?.id },
      });
      if (saved.id > lastIdRef.current) lastIdRef.current = saved.id;
      setRows((current) =>
        mergeRows(
          current.filter((row) => !(row.pending && row.nonce === nonce)),
          [saved],
        ),
      );
      setDraft((current) => (current === raw ? "" : current));
      setGifReady(null);
      setAttachment((current) => (current?.id === sentAttachment?.id ? null : current));
    } catch (err) {
      setRows((current) => current.filter((row) => !(row.pending && row.nonce === nonce)));
      if (isUnauthorized(err)) setPhase("signedOut");
      else {
        const message = errorText(err, "Couldn’t send that.");
        const pause = slowDownSeconds(message);
        if (pause != null) {
          const until = Date.now() + pause * 1000;
          cooldownUntilRef.current = until;
          setCooldownUntil(until);
          setCooldownTick(Date.now());
        }
        setSendError(message);
        if (errorText(err, "") === "You're muted.") {
          void getChatMe()
            .then((next) => {
              setMe(next);
              if (next.member?.banned) setPhase("banned");
            })
            .catch(() => undefined);
        }
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function onSend(event: FormEvent) {
    event.preventDefault();
    void submitDraft();
  }

  function markRemoved(id: number) {
    setRows((current) =>
      current.map((row) =>
        !row.pending && row.id === id ? { key: row.key, pending: false, id, deleted: true } : row,
      ),
    );
  }

  async function onDeleteSystem(id: number) {
    const previous = rows.find((row) => !row.pending && row.id === id) ?? null;
    markRemoved(id);
    try {
      await adminDeleteMessage({ data: { id } });
    } catch (err) {
      if (previous) {
        setRows((current) =>
          current.map((row) => (!row.pending && row.id === id ? previous : row)),
        );
      }
      setSendError(errorText(err, "Couldn’t remove that."));
    }
  }

  async function onDelete(id: number) {
    const previous = rows.find((row) => !row.pending && row.id === id) ?? null;
    setRows((current) =>
      current.map((row) =>
        !row.pending && row.id === id ? { key: row.key, pending: false, id, deleted: true } : row,
      ),
    );
    try {
      await deleteOwnMessage({ data: { id } });
    } catch (err) {
      if (previous) {
        setRows((current) =>
          current.map((row) => (!row.pending && row.id === id ? previous : row)),
        );
      }
      setSendError(errorText(err, "Couldn’t remove that."));
    }
  }

  function insertDraft(text: string) {
    const el = draftRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${text}${draft.slice(end)}`;
    const caret = start + text.length;
    setDraft(next);
    requestAnimationFrame(() => {
      const node = draftRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  }

  function toggleImages() {
    setShowImages((current) => {
      const next = !current;
      try {
        localStorage.setItem("spacebat-chat-show-images", next ? "1" : "0");
      } catch {
        /* the toggle still applies for this visit */
      }
      return next;
    });
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submitDraft();
  }

  const nowMs = cooldownTick || Date.now();
  const cooldownLeft = cooldownUntil > nowMs ? Math.ceil((cooldownUntil - nowMs) / 1000) : 0;
  const composerError =
    cooldownLeft > 0
      ? `Slow down, you can post again in ${cooldownLeft}s${slowDownDebug(sendError)}`
      : sendError;
  const counted = normalizeBody(draft);
  const count = counted.ok ? counted.body.length : draft.trim().length;
  const showCount = count >= COUNT_AT || draft.length >= COUNT_AT;
  function bringPopoutBack() {
    channelRef.current?.postMessage({ type: "popout-close" });
    setPopoutElsewhere(false);
  }

  function onSignIn(event: MouseEvent<HTMLAnchorElement>) {
    if (layout !== "popout" || !window.opener) return;
    event.preventDefault();
    try {
      window.opener.location.assign("/login");
      window.close();
    } catch {
      window.location.assign("/login");
    }
  }

  const shell =
    layout === "popout"
      ? "flex h-dvh min-h-0 w-full flex-col overflow-x-hidden bg-paper"
      : "mx-auto flex w-full min-w-0 max-w-3xl flex-col overflow-x-clip px-4 py-6 sm:px-6 sm:py-8";

  return (
    <section className={shell}>
      {layout === "popout" ? (
        <header className="border-b-4 border-ink">
          <div className="flex items-center gap-2 px-3 py-2">
            <BatMark className="size-8 border-2 border-ink" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl leading-none tracking-wide">SpaceBat Chat</h1>
              {me?.member?.handle ? (
                <p className="truncate text-xs text-muted">{me.member.handle}</p>
              ) : null}
              {phase === "ready" && online ? (
                <div className="mt-1">
                  <OnlineMembers members={online} />
                </div>
              ) : null}
            </div>
            <LivePlayer compact />
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="shrink-0 text-sm text-crimson hover:underline"
            >
              Open full site
            </a>
          </div>
          {me?.isAdmin ? (
            <div className="px-3 pb-2">
              <OnAirControl live={live} onChange={rememberLive} />
            </div>
          ) : null}
          {live?.isLive ? (
            <LiveBanner
              placement="bar"
              sinceLabel={live.sinceMs == null ? null : formatChatTime(live.sinceMs)}
            />
          ) : null}
        </header>
      ) : (
        <header>
          <p className="caption-box">The room</p>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-wide">SpaceBat Chat</h1>
          <p className="mt-2 text-sm text-muted">
            Listeners only. New posts show up every few seconds.
          </p>
          {phase === "ready" && online && !popoutElsewhere ? (
            <div className="mt-3">
              <OnlineMembers members={online} />
            </div>
          ) : null}
          <OpenPopoutButton />
          {me?.isAdmin ? <OnAirControl live={live} onChange={rememberLive} /> : null}
        </header>
      )}

      {layout === "page" && popoutElsewhere ? (
        <p className="mt-4 border-4 border-ink bg-caption px-4 py-3 text-sm">
          Chat is open in another window —{" "}
          <button
            type="button"
            onClick={bringPopoutBack}
            className="font-display text-base tracking-wide text-crimson underline"
          >
            Bring it back here
          </button>
        </p>
      ) : null}

      {me && !me.durable ? (
        <p className="mt-4 border-4 border-ink bg-caption px-4 py-3 text-sm text-ink">
          This preview isn't connected to a database, so messages may vanish.
        </p>
      ) : null}

      {phase === "loading" || !mounted || isPending ? (
        <p className="mt-8 text-sm text-muted">Opening the room…</p>
      ) : null}

      {phase === "signedOut" && mounted && !isPending ? (
        <div className="mt-8">
          <h2 className="font-display text-3xl tracking-wide">Sign in first</h2>
          <p className="mt-2 text-sm text-muted">The room is for listeners with an account.</p>
          <Button asChild className="mt-6">
            <Link to="/login" onClick={onSignIn}>
              Sign in
            </Link>
          </Button>
        </div>
      ) : null}

      {phase === "banned" ? (
        <p className="mt-8 border-4 border-ink bg-surface px-4 py-4 text-base">
          You can't post in the room.
        </p>
      ) : null}

      {phase === "join" ? (
        <form onSubmit={onJoin} className="mt-6 space-y-4">
          <label className="block">
            <span className="font-display text-2xl tracking-wide">Your name in the room</span>
            <Input
              className="mt-2"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              autoComplete="off"
              maxLength={40}
              required
            />
          </label>
          <fieldset className="border-4 border-ink bg-surface px-4 py-4">
            <legend className="px-1 font-display text-2xl tracking-wide">Room rules</legend>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {CHAT_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[#9b1b30]"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                required
              />
              <span>I accept these rules.</span>
            </label>
          </fieldset>
          {formError ? <p className="text-sm text-crimson">{formError}</p> : null}
          <Button type="submit" disabled={joining}>
            {joining ? "Joining" : "Join the room"}
          </Button>
        </form>
      ) : null}

      {phase === "ready" ? (
        <div
          className={
            layout === "popout"
              ? "flex min-h-0 min-w-0 flex-1 flex-col"
              : "mt-4 flex h-[min(42rem,calc(100dvh-14rem))] min-w-0 flex-col"
          }
        >
          {layout === "page" && live?.isLive ? (
            <div className="mb-3">
              <LiveBanner
                placement="room"
                sinceLabel={live.sinceMs == null ? null : formatChatTime(live.sinceMs)}
              />
            </div>
          ) : null}
          <div className="relative min-h-0 flex-1 border-4 border-ink bg-ivory">
            <div
              ref={scrollerRef}
              onScroll={onScroll}
              className="h-full min-w-0 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-3"
              style={{ overflowAnchor: "none" }}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {hasEarlier ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={loadingEarlier}
                    onClick={() => void loadEarlier()}
                  >
                    {loadingEarlier ? "Loading" : "Load earlier"}
                  </Button>
                </div>
              ) : null}
              {!historyReady && !formError ? (
                <p className="text-sm text-muted">Opening the room…</p>
              ) : null}
              {historyReady && rows.length === 0 ? (
                <p className="text-sm text-muted">The room is quiet. Say something.</p>
              ) : null}
              {formError ? <p className="text-sm text-crimson">{formError}</p> : null}
              {rows.map((row) => (
                <MessageRow
                  key={row.key}
                  row={row}
                  isAdmin={Boolean(me?.isAdmin)}
                  showImages={showImages}
                  blobHost={me?.blobHost ?? null}
                  onDelete={(id) => void onDelete(id)}
                  onDeleteSystem={(id) => void onDeleteSystem(id)}
                  onRemove={markRemoved}
                  onError={setSendError}
                  onNotice={setNotice}
                />
              ))}
            </div>
            {showNew ? (
              <button
                type="button"
                onClick={scrollToLatest}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 border-4 border-ink bg-caption px-3 py-1 font-display text-base tracking-wide text-ink"
              >
                New messages ↓
              </button>
            ) : null}
          </div>

          {me?.member?.muted ? (
            <p
              data-chat-composer=""
              className="mt-3 border-4 border-ink bg-surface px-4 py-4 text-base"
            >
              You're muted until {formatChatTime(me.member.mutedUntilMs ?? Date.now())}.
            </p>
          ) : (
            <form data-chat-composer="" onSubmit={onSend} className="mt-3 min-w-0">
              {reconnecting ? <p className="mb-2 text-sm text-muted">Reconnecting…</p> : null}
              <AttachmentDraft
                attachment={attachment}
                progress={uploadProgress}
                onRemove={() => removeUploadRef.current?.()}
              />
              {gifReady && draft.includes(`https://i.giphy.com/${gifReady.id}.gif`) ? (
                <div className="mb-2 flex items-center gap-3 border-4 border-ink bg-caption px-3 py-2">
                  <img
                    src={gifReady.preview}
                    alt=""
                    className="size-14 shrink-0 border-2 border-ink object-cover"
                  />
                  <p className="font-display text-base tracking-wide">GIF ready, press Send</p>
                </div>
              ) : null}
              <label className="block min-w-0">
                <span className="sr-only">Message</span>
                <textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setSendError("");
                  }}
                  onKeyDown={onDraftKeyDown}
                  disabled={me?.member?.muted}
                  rows={3}
                  placeholder={me?.member ? `Message as ${me.member.handle}` : "Message"}
                  className="w-full resize-none border-4 border-ink bg-ivory px-3 py-2 text-base text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson disabled:opacity-50"
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <EmojiPicker onInsert={insertDraft} />
                  {me?.gifSearch ? (
                    <GifPicker
                      onInsert={insertDraft}
                      onPicked={(hit) => {
                        setGifReady(hit);
                        setSendError("");
                      }}
                    />
                  ) : null}
                  <ComposerAttach
                    enabled={Boolean(me?.uploads)}
                    attachment={attachment}
                    onAttachment={setAttachment}
                    onError={setSendError}
                    onBusy={setUploadBusy}
                    onProgress={setUploadProgress}
                    removeRef={removeUploadRef}
                  />
                  <button
                    type="button"
                    aria-pressed={showImages}
                    onClick={toggleImages}
                    className={
                      showImages
                        ? "text-xs text-ink underline-offset-2 hover:underline"
                        : "text-xs text-muted line-through"
                    }
                  >
                    Show images and GIFs
                  </button>
                </div>
                {showCount ? (
                  <p
                    className={
                      count > MAX_BODY_LENGTH ? "text-sm text-crimson" : "text-sm text-muted"
                    }
                  >
                    {count}/{MAX_BODY_LENGTH}
                  </p>
                ) : (
                  <p className="text-sm text-muted">Enter sends. Shift+Enter adds a line.</p>
                )}
                <Button
                  type="submit"
                  disabled={sending || uploadBusy || Boolean(me?.member?.muted) || cooldownLeft > 0}
                >
                  {sending ? "Sending" : "Send"}
                </Button>
              </div>
              {notice ? <p className="mt-2 text-sm text-ink">{notice}</p> : null}
              {composerError ? <p className="mt-2 text-sm text-crimson">{composerError}</p> : null}
            </form>
          )}
          {me?.member?.muted && (notice || sendError) ? (
            <div className="mt-2">
              {notice ? <p className="text-sm text-ink">{notice}</p> : null}
              {sendError ? <p className="text-sm text-crimson">{sendError}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MessageRow({
  row,
  isAdmin,
  showImages,
  blobHost,
  onDelete,
  onDeleteSystem,
  onRemove,
  onError,
  onNotice,
}: {
  row: FeedRow;
  isAdmin: boolean;
  showImages: boolean;
  blobHost: string | null;
  onDelete: (id: number) => void;
  onDeleteSystem: (id: number) => void;
  onRemove: (id: number) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  if (row.pending) {
    return (
      <article className="border-2 border-dashed border-ink/40 px-3 py-2">
        <header className="flex items-baseline justify-between gap-3">
          <span className="font-display text-xl tracking-wide text-crimson">{row.handle}</span>
          <time className="text-xs text-muted" dateTime={new Date(row.createdMs).toISOString()}>
            {formatChatTime(row.createdMs)}
          </time>
        </header>
        <MessageBody body={row.body} showImages={showImages} />
        {row.attachment ? (
          <AttachmentView attachment={row.attachment} blobHost={blobHost} showImages={showImages} />
        ) : null}
      </article>
    );
  }
  if (row.deleted) {
    return <p className="text-sm text-muted">message removed</p>;
  }
  if (row.kind === "presence") {
    return (
      <div className="flex flex-col items-center gap-0.5 px-2">
        <p className="max-w-full break-words text-center text-xs leading-5 text-muted">
          {row.body}
        </p>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => onDeleteSystem(row.id)}
            className="text-[11px] text-muted underline-offset-2 hover:text-crimson hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>
    );
  }
  if (row.kind === "system") {
    return (
      <div className="flex flex-col items-center gap-1">
        <SystemMessage body={row.body} />
        {isAdmin ? (
          <button
            type="button"
            onClick={() => onDeleteSystem(row.id)}
            className="text-xs text-muted underline-offset-2 hover:text-crimson hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <article className="border-2 border-ink/20 px-3 py-2">
      <header className="flex items-baseline justify-between gap-3">
        <span className="font-display text-xl tracking-wide text-crimson">{row.handle}</span>
        <time className="text-xs text-muted" dateTime={new Date(row.createdMs).toISOString()}>
          {formatChatTime(row.createdMs)}
        </time>
      </header>
      <MessageBody body={row.body} showImages={showImages} />
      {row.attachment ? (
        <AttachmentView attachment={row.attachment} blobHost={blobHost} showImages={showImages} />
      ) : null}
      {row.mine && row.kind === "text" ? (
        <button
          type="button"
          onClick={() => onDelete(row.id)}
          className="mt-1 text-xs text-muted underline-offset-2 hover:text-crimson hover:underline"
        >
          Delete
        </button>
      ) : null}
      {!row.mine && row.kind === "text" ? (
        <MessageMenu
          messageId={row.id}
          authorId={row.authorId}
          isAdmin={isAdmin}
          onRemove={() => onRemove(row.id)}
          onError={onError}
          onNotice={onNotice}
        />
      ) : null}
    </article>
  );
}
