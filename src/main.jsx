import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft, Check, CheckCheck, ChevronDown, Globe2, Languages,
  Menu, MessageCircleMore, Mic, MoreHorizontal, Paperclip, Phone,
  Plus, Search, Send, Settings2, Smile, Sparkles, Users, Video,
  X
} from "lucide-react";
import "./styles.css";

const languages = [
  ["zh-CN", "简体中文", "中"], ["en", "English", "EN"],
  ["es", "Español", "ES"], ["fr", "Français", "FR"],
  ["ja", "日本語", "日"], ["ko", "한국어", "한"],
  ["de", "Deutsch", "DE"], ["pt", "Português", "PT"]
];

const people = {
  maya: { name: "Maya Chen", initials: "MC", color: "#ff8d72", language: "English", status: "在线" },
  lucas: { name: "Lucas Martín", initials: "LM", color: "#8d7df7", language: "Español", status: "5 分钟前在线" },
  yuki: { name: "Yuki Tanaka", initials: "YT", color: "#45b7a7", language: "日本語", status: "在线" },
  amara: { name: "Amara Okafor", initials: "AO", color: "#dfad48", language: "English", status: "昨天在线" }
};

const initialChats = [
  { id: "global", name: "Global Studio", group: true, initials: "GS", color: "#7063e8", members: "6 位成员 · 3 种语言", time: "10:42", preview: "明天见，等不及了！", unread: 3 },
  { id: "maya", ...people.maya, time: "09:18", preview: "完美！我会把最终文件发给你。", unread: 0 },
  { id: "lucas", ...people.lucas, time: "昨天", preview: "¿Te va bien a las tres?", unread: 1 },
  { id: "yuki", ...people.yuki, time: "周一", preview: "ありがとうございます！", unread: 0 },
  { id: "amara", ...people.amara, time: "周日", preview: "That sounds like a plan.", unread: 0 }
];

const initialMessages = {
  global: [
    { id: 1, from: "maya", text: "Morning everyone! The new prototype is ready for review.", translated: "大家早上好！新原型已经可以评审了。", lang: "English", time: "10:31" },
    { id: 2, from: "yuki", text: "素晴らしいですね。モバイル版も確認できますか？", translated: "太棒了。我们也可以查看移动端版本吗？", lang: "日本語", time: "10:34" },
    { id: 3, from: "me", text: "可以，我刚刚把响应式版本也部署好了。", translated: "可以，我刚刚把响应式版本也部署好了。", lang: "简体中文", time: "10:36" },
    { id: 4, from: "lucas", text: "¡Se ve increíble! Solo tengo una pequeña nota sobre la navegación.", translated: "看起来棒极了！我只有一个关于导航的小建议。", lang: "Español", time: "10:39" },
    { id: 5, from: "maya", text: "Perfect. Let's walk through it together tomorrow.", translated: "太好了。我们明天一起过一遍吧。", lang: "English", time: "10:41" },
    { id: 6, from: "yuki", text: "また明日、楽しみにしています！", translated: "明天见，等不及了！", lang: "日本語", time: "10:42" }
  ],
  maya: [
    { id: 1, from: "maya", text: "Did the latest export work on your side?", translated: "最新导出的文件在你那边能正常打开吗？", lang: "English", time: "09:12" },
    { id: 2, from: "me", text: "可以，一切正常。动效也很流畅。", translated: "可以，一切正常。动效也很流畅。", lang: "简体中文", time: "09:15" },
    { id: 3, from: "maya", text: "Perfect! I'll send you the final files.", translated: "完美！我会把最终文件发给你。", lang: "English", time: "09:18" }
  ]
};

function prepareMessages(conversations) {
  return Object.fromEntries(
    Object.entries(conversations).map(([chatId, chatMessages]) => [
      chatId,
      chatMessages.map((message) => ({
        ...message,
        translatedFor: "zh-CN",
        translationPending: false,
        translationError: false
      }))
    ])
  );
}

function Avatar({ person, size = "md", online = false }) {
  return (
    <div className={`avatar avatar-${size}`} style={{ background: person.color }}>
      {person.initials}
      {online && <span className="online-dot" />}
    </div>
  );
}

function App() {
  const [nativeLanguage, setNativeLanguage] = useState(() => localStorage.getItem("nativeLanguage") || "zh-CN");
  const [activeId, setActiveId] = useState("global");
  const [messages, setMessages] = useState(() => prepareMessages(initialMessages));
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [showOriginal, setShowOriginal] = useState({});
  const [languageOpen, setLanguageOpen] = useState(false);
  const [mobileList, setMobileList] = useState(false);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState("loading");
  const endRef = useRef(null);
  const nativeLanguageRef = useRef(nativeLanguage);

  const activeChat = initialChats.find((chat) => chat.id === activeId);
  const selectedLanguage = languages.find(([code]) => code === nativeLanguage);
  const visibleChats = initialChats.filter((chat) =>
    `${chat.name} ${chat.preview}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    nativeLanguageRef.current = nativeLanguage;
    localStorage.setItem("nativeLanguage", nativeLanguage);
    setShowOriginal({});
    setMessages((current) => Object.fromEntries(
      Object.entries(current).map(([chatId, chatMessages]) => [
        chatId,
        chatMessages.map((message) => ({ ...message, translationPending: false }))
      ])
    ));
  }, [nativeLanguage]);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((data) => setMode(data.translation)).catch(() => setMode("unavailable"));
  }, []);

  useEffect(() => {
    const pendingMessages = [];
    Object.entries(messages).forEach(([chatId, chatMessages]) => {
      chatMessages.forEach((message) => {
        if (message.translatedFor !== nativeLanguage && !message.translationPending) {
          pendingMessages.push({ chatId, message });
        }
      });
    });

    if (!pendingMessages.length) return;

    if (mode === "loading") return;

    if (mode !== "model" && mode !== "configured") {
      const unavailableKeys = new Set(pendingMessages.map(({ chatId, message }) => `${chatId}:${message.id}`));
      setMessages((current) => Object.fromEntries(
        Object.entries(current).map(([chatId, chatMessages]) => [
          chatId,
          chatMessages.map((message) => unavailableKeys.has(`${chatId}:${message.id}`)
            ? {
                ...message,
                translatedFor: nativeLanguage,
                translationPending: false,
                translationError: true
              }
            : message)
        ])
      ));
      return;
    }

    const pendingKeys = new Set(pendingMessages.map(({ chatId, message }) => `${chatId}:${message.id}`));
    setMessages((current) => Object.fromEntries(
      Object.entries(current).map(([chatId, chatMessages]) => [
        chatId,
        chatMessages.map((message) => pendingKeys.has(`${chatId}:${message.id}`)
          ? { ...message, translationPending: true, translationError: false }
          : message)
      ])
    ));

    const targetLanguage = nativeLanguage;
    (async () => {
      const results = [];
      let providerUnavailable = false;

      for (const { chatId, message } of pendingMessages) {
        if (providerUnavailable) {
          results.push({ chatId, id: message.id, error: true });
          continue;
        }

        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: message.text,
              targetLanguage: selectedLanguage[1],
              sourceLanguage: message.lang || "auto"
            })
          });
          const data = await response.json();
          if (!response.ok) {
            providerUnavailable = data.mode === "unavailable";
            if (data.mode) setMode(data.mode);
            throw new Error(data.code || "Translation failed");
          }
          if (data.mode) setMode(data.mode);
          results.push({ chatId, id: message.id, data });
        } catch {
          results.push({ chatId, id: message.id, error: true });
        }
      }

      if (nativeLanguageRef.current !== targetLanguage) return;
      const resultMap = new Map(results.map((result) => [`${result.chatId}:${result.id}`, result]));
      setMessages((current) => Object.fromEntries(
        Object.entries(current).map(([chatId, chatMessages]) => [
          chatId,
          chatMessages.map((message) => {
            const result = resultMap.get(`${chatId}:${message.id}`);
            if (!result) return message;
            if (result.error) {
              return {
                ...message,
                translatedFor: targetLanguage,
                translationPending: false,
                translationError: true
              };
            }
            return {
              ...message,
              translated: result.data.translatedText,
              lang: result.data.detectedLanguage || message.lang,
              translatedFor: targetLanguage,
              translationPending: false,
              translationError: false
            };
          })
        ])
      ));
    })();
  }, [messages, mode, nativeLanguage, selectedLanguage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, messages]);

  const conversation = useMemo(() => messages[activeId] || [
    { id: 1, from: activeId, text: activeChat.preview, translated: activeChat.preview, lang: activeChat.language, time: activeChat.time }
  ], [activeId, activeChat, messages]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((current) => ({
      ...current,
      [activeId]: [...(current[activeId] || []), {
        id: Date.now(), from: "me", text, translated: text,
        translatedFor: null, translationPending: false, translationError: false,
        lang: "自动检测", time: now
      }]
    }));
    setSending(false);
  }

  function selectChat(id) {
    setActiveId(id);
    setMobileList(false);
  }

  return (
    <main className="app-shell">
      <aside className="rail">
        <div className="brand-mark"><Languages size={24} /></div>
        <nav>
          <button className="rail-btn active" aria-label="聊天"><MessageCircleMore /></button>
          <button className="rail-btn" aria-label="联系人"><Users /></button>
        </nav>
        <div className="rail-bottom">
          <button className="rail-btn" aria-label="设置"><Settings2 /></button>
          <Avatar person={{ initials: "WY", color: "#ef765d" }} size="sm" online />
        </div>
      </aside>

      <section className={`chat-list ${mobileList ? "mobile-open" : ""}`}>
        <div className="list-head">
          <div className="wordmark"><span>chat</span><strong>_native</strong></div>
          <button className="icon-btn new-chat" aria-label="新建聊天"><Plus size={19} /></button>
        </div>

        <div className="native-picker">
          <div className="picker-icon"><Globe2 size={18} /></div>
          <div>
            <small>我的母语</small>
            <button onClick={() => setLanguageOpen(!languageOpen)}>
              {selectedLanguage[1]} <ChevronDown size={14} />
            </button>
          </div>
          <span className={`api-status ${mode}`}>
            <Sparkles size={12} />{
              mode === "model" ? "AI"
                : mode === "unavailable" ? "离线"
                  : mode === "demo" ? "Demo" : "..."
            }
          </span>
          {languageOpen && (
            <div className="language-menu">
              {languages.map(([code, name, short]) => (
                <button key={code} onClick={() => { setNativeLanguage(code); setLanguageOpen(false); }}>
                  <span>{short}</span>{name}{code === nativeLanguage && <Check size={15} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="search-box">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对话" />
          {query && <button onClick={() => setQuery("")}><X size={15} /></button>}
        </div>

        <div className="section-label"><span>消息</span><button>全部</button></div>
        <div className="conversation-list">
          {visibleChats.map((chat) => (
            <button key={chat.id} className={`conversation-item ${activeId === chat.id ? "active" : ""}`} onClick={() => selectChat(chat.id)}>
              <Avatar person={chat} online={chat.status === "在线"} />
              <div className="conversation-copy">
                <div><strong>{chat.name}</strong><time>{chat.time}</time></div>
                <div><p>{chat.preview}</p>{chat.unread > 0 && <span className="unread">{chat.unread}</span>}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flow-art" aria-hidden="true" />
      </section>

      <section className="chat-panel">
        <header className="chat-head">
          <button className="icon-btn mobile-menu" onClick={() => setMobileList(true)}><Menu size={20} /></button>
          <Avatar person={activeChat} online={!activeChat.group && activeChat.status === "在线"} />
          <div className="chat-title">
            <h1>{activeChat.name}</h1>
            <p>{activeChat.group ? activeChat.members : `${activeChat.status} · ${activeChat.language}`}</p>
          </div>
          <div className="chat-actions">
            <button className="icon-btn"><Phone size={19} /></button>
            <button className="icon-btn"><Video size={20} /></button>
            <button className="icon-btn"><MoreHorizontal size={21} /></button>
          </div>
        </header>

        <div className="translation-note">
          <Sparkles size={14} />
          {mode === "unavailable"
            ? "翻译服务不可用，当前显示原文"
            : `消息将自动翻译为 ${selectedLanguage[1]}`}
        </div>

        <div className="messages">
          <div className="date-divider"><span>今天</span></div>
          {conversation.map((message, index) => {
            const mine = message.from === "me";
            const sender = mine ? { name: "我", initials: "WY", color: "#ef765d" } : people[message.from] || activeChat;
            const previous = conversation[index - 1];
            const showAvatar = !mine && previous?.from !== message.from;
            const originalVisible = showOriginal[message.id];
            return (
              <div key={message.id} className={`message-row ${mine ? "mine" : ""}`}>
                {!mine && <div className="message-avatar">{showAvatar && <Avatar person={sender} size="sm" />}</div>}
                <div className="message-wrap">
                  {!mine && showAvatar && activeChat.group && <span className="sender-name">{sender.name}</span>}
                  <div className="bubble">
                    <p>{message.translationPending && !originalVisible
                      ? "正在翻译…"
                      : (originalVisible || message.translationError ? message.text : message.translated)}</p>
                    {message.translationError && !originalVisible && (
                      <span className="translation-error">翻译暂时不可用，已显示原文</span>
                    )}
                    {!message.translationPending && message.text !== message.translated && (
                      <button className="original-toggle" onClick={() => setShowOriginal((s) => ({ ...s, [message.id]: !s[message.id] }))}>
                        <Languages size={13} /> {originalVisible ? "查看译文" : `查看原文 · ${message.lang}`}
                      </button>
                    )}
                  </div>
                  <div className="message-meta">
                    <time>{message.time}</time>{mine && <CheckCheck size={14} />}
                  </div>
                </div>
              </div>
            );
          })}
          {conversation.some((message) => message.translationPending) && (
            <div className="translating"><i /><i /><i /><span>正在翻译消息</span></div>
          )}
          <div ref={endRef} />
        </div>

        <footer className="composer">
          <div className="composer-box">
            <button className="composer-btn"><Plus size={21} /></button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="用任何语言输入消息…"
              rows={1}
            />
            <button className="composer-btn"><Smile size={20} /></button>
            <button className="composer-btn attachment"><Paperclip size={19} /></button>
            {draft.trim() ? (
              <button className="send-btn" onClick={sendMessage} disabled={sending}><Send size={18} /></button>
            ) : <button className="voice-btn"><Mic size={20} /></button>}
          </div>
          <p><Sparkles size={11} /> 你的消息会以每位收件人的母语呈现</p>
        </footer>
      </section>
      {mobileList && <button className="mobile-scrim" onClick={() => setMobileList(false)} aria-label="关闭" />}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
