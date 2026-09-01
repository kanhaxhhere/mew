const sb = window.supabase.createClient(window.supabaseConfig.url, window.supabaseConfig.anonKey);

let currentUid = null;
let currentProfile = null;
let activeFriendUid = null;
let activeChatChannel = null;
let friendsChannel = null;
let requestsChannel = null;
let presenceChannel = null;
let presenceState = {};
let friendsData = [];
let friendsCache = {};
let typingHideTimer = null;
let lastTypingSentAt = 0;

const LS_KEY = "baatchit_email";
const THEME_KEY = "baatchit_theme";

// ---------- Helpers ----------
function esc(str) { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }
function initials(name) { return (name || "?").trim().charAt(0).toUpperCase(); }
function slugUsername(str) { return str.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""); }
function emailKeyFor(email) { return email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"); }
function isOnline(uid) { return !!(presenceState[uid] && presenceState[uid].length > 0); }

function showToast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " error" : "");
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function setBtnLoading(btn, loading) {
  btn.querySelector(".btn-label").classList.toggle("hidden", loading);
  btn.querySelector(".btn-spinner").classList.toggle("hidden", !loading);
  btn.disabled = loading;
}

// ---------- Theme ----------
const themeToggleBtn = document.getElementById("theme-toggle-btn");
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem(THEME_KEY) || "light");
themeToggleBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ---------- DOM: screens ----------
const screens = {
  login: document.getElementById("login-screen"),
  profileSetup: document.getElementById("profile-setup-screen"),
  app: document.getElementById("app-screen"),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

// ---------- DOM: login ----------
const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("login-email-input");
const loginNameInput = document.getElementById("login-name-input");
const loginError = document.getElementById("login-error");
const loginSubmitBtn = document.getElementById("login-submit-btn");

const profileSetupForm = document.getElementById("profile-setup-form");
const setupUsernameInput = document.getElementById("setup-username-input");
const setupBioInput = document.getElementById("setup-bio-input");
const profileSetupError = document.getElementById("profile-setup-error");
const profileSetupBtn = document.getElementById("profile-setup-btn");

// ---------- DOM: app shell ----------
const appScreenEl = document.getElementById("app-screen");
const requestBadge = document.getElementById("request-badge");
const requestBadgeM = document.getElementById("request-badge-m");

const views = {
  home: document.getElementById("view-home"),
  chats: document.getElementById("view-chats"),
  friends: document.getElementById("view-friends"),
  requests: document.getElementById("view-requests"),
  profile: document.getElementById("view-profile"),
};
let currentTab = "home";

function switchTab(tab) {
  closeChatOverlay();
  currentTab = tab;
  Object.entries(views).forEach(([k, v]) => v.classList.toggle("hidden", k !== tab));
  document.querySelectorAll("[data-tab]").forEach(el => el.classList.toggle("active", el.dataset.tab === tab));
}
document.querySelectorAll("[data-tab]").forEach(el => el.addEventListener("click", () => switchTab(el.dataset.tab)));

// ---------- DOM: home ----------
const homeGreetingText = document.getElementById("home-greeting-text");
const homeRecentList = document.getElementById("home-recent-list");

// ---------- DOM: chats ----------
const chatsList = document.getElementById("chats-list");

// ---------- DOM: friends ----------
const addFriendForm = document.getElementById("add-friend-form");
const addFriendInput = document.getElementById("add-friend-input");
const addFriendMsg = document.getElementById("add-friend-msg");
const friendSearchInput = document.getElementById("friend-search-input");
const friendsCardsList = document.getElementById("friends-cards-list");

// ---------- DOM: requests ----------
const sentRequestsList = document.getElementById("sent-requests-list");
const incomingRequestsList = document.getElementById("incoming-requests-list");

// ---------- DOM: profile ----------
const profileAvatar = document.getElementById("profile-avatar");
const profileNameDisplay = document.getElementById("profile-name-display");
const profileUsernameDisplay2 = document.getElementById("profile-username-display2");
const profileBioDisplay = document.getElementById("profile-bio-display");
const profileFriendCount = document.getElementById("profile-friend-count");
const editProfileBtn = document.getElementById("edit-profile-btn");
const editProfileModal = document.getElementById("edit-profile-modal");
const modalBackdrop = document.getElementById("modal-backdrop");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const profileEditForm = document.getElementById("profile-edit-form");
const profileUsernameDisplay = document.getElementById("profile-username-display");
const profileNameInput = document.getElementById("profile-name-input");
const profileBioInput = document.getElementById("profile-bio-input");

const signoutBtn = document.getElementById("signout-btn");
const signoutBtn2 = document.getElementById("signout-btn-2");

// ---------- DOM: chat overlay ----------
const chatOverlay = document.getElementById("view-chat");
const chatBackBtn = document.getElementById("chat-back-btn");
const chatAvatar = document.getElementById("chat-avatar");
const chatTitle = document.getElementById("chat-title");
const chatStatusDot = document.getElementById("chat-status-dot");
const chatStatusText = document.getElementById("chat-status-text");
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const typingIndicator = document.getElementById("typing-indicator");
const typingName = document.getElementById("typing-name");
const emojiBtn = document.getElementById("emoji-btn");
const emojiPanel = document.getElementById("emoji-panel");
const chatHeaderProfileBtn = document.getElementById("chat-header-profile-btn");
const chatMenuBtn = document.getElementById("chat-menu-btn");

// ---------- DOM: reply preview ----------
const replyPreviewBar = document.getElementById("reply-preview-bar");
const replyPreviewName = document.getElementById("reply-preview-name");
const replyPreviewText = document.getElementById("reply-preview-text");
const replyPreviewCancel = document.getElementById("reply-preview-cancel");
let replyingTo = null; // { id, name, text }

// ---------- DOM: message action sheet ----------
const messageActionSheet = document.getElementById("message-action-sheet");
const messageSheetBackdrop = document.getElementById("message-sheet-backdrop");
const actionReplyBtn = document.getElementById("action-reply");
const actionCopyBtn = document.getElementById("action-copy");
const actionForwardBtn = document.getElementById("action-forward");
const actionSaveBtn = document.getElementById("action-save");
const actionSaveLabel = document.getElementById("action-save-label");
const actionDeleteBtn = document.getElementById("action-delete");
let activeActionMessage = null; // { id, senderName, senderUid, body, raw }

// ---------- DOM: thread action sheet + delete confirm ----------
const threadActionSheet = document.getElementById("thread-action-sheet");
const threadSheetBackdrop = document.getElementById("thread-sheet-backdrop");
const threadActionMuteBtn = document.getElementById("thread-action-mute");
const threadMuteLabel = document.getElementById("thread-mute-label");
const threadActionDeleteBtn = document.getElementById("thread-action-delete");
const threadActionCancelBtn = document.getElementById("thread-action-cancel");
const deleteChatConfirm = document.getElementById("delete-chat-confirm");
const deleteChatBackdrop = document.getElementById("delete-chat-backdrop");
const deleteChatCancelBtn = document.getElementById("delete-chat-cancel");
const deleteChatConfirmBtn = document.getElementById("delete-chat-confirm-btn");
let activeThreadFriendUid = null;

// ---------- DOM: forward modal ----------
const forwardModal = document.getElementById("forward-modal");
const forwardBackdrop = document.getElementById("forward-backdrop");
const forwardPreviewText = document.getElementById("forward-preview-text");
const forwardSearchInput = document.getElementById("forward-search-input");
const forwardFriendsList = document.getElementById("forward-friends-list");
const forwardCancelBtn = document.getElementById("forward-cancel-btn");

// ---------- DOM: friend profile overlay ----------
const friendProfileOverlay = document.getElementById("view-friend-profile");
const fpBackBtn = document.getElementById("fp-back-btn");
const fpAvatar = document.getElementById("fp-avatar");
const fpName = document.getElementById("fp-name");
const fpUsername = document.getElementById("fp-username");
const fpBio = document.getElementById("fp-bio");
const fpFriendCount = document.getElementById("fp-friend-count");
const fpRemoveBtn = document.getElementById("fp-remove-btn");

// ---------- Local-only state (NOT stored in Supabase — see README for why) ----------
// These persist per-browser only, scoped to the logged-in user, via localStorage.
let hiddenChatUids = new Set();   // "deleted" chats (frontend-only hide)
let mutedChatUids = new Set();    // muted chats (frontend-only, cosmetic — no push notifications exist to mute)
let savedMessageIds = new Set();  // bookmarked messages (frontend-only)
let hiddenMessageIds = new Set(); // "deleted for me" messages (frontend-only hide)

function localKey(suffix) { return `baatchit_${suffix}_${currentUid}`; }
function loadLocalSets() {
  hiddenChatUids = new Set(JSON.parse(localStorage.getItem(localKey("hidden_chats")) || "[]"));
  mutedChatUids = new Set(JSON.parse(localStorage.getItem(localKey("muted_chats")) || "[]"));
  savedMessageIds = new Set(JSON.parse(localStorage.getItem(localKey("saved_msgs")) || "[]"));
  hiddenMessageIds = new Set(JSON.parse(localStorage.getItem(localKey("hidden_msgs")) || "[]"));
}
function persistSet(suffix, set) { localStorage.setItem(localKey(suffix), JSON.stringify([...set])); }

function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// Parses a message's `text` column. Older plain-text messages just pass
// through untouched. Reply/forward messages are stored as a small JSON
// envelope INSIDE the existing text column (no new database column needed).
function parseMessageEnvelope(rawText) {
  try {
    const obj = JSON.parse(rawText);
    if (obj && obj.__baatchit_type === "reply") {
      return { kind: "reply", body: obj.body, replyTo: obj.replyTo };
    }
    if (obj && obj.__baatchit_type === "forward") {
      return { kind: "forward", body: obj.body, originalSender: obj.originalSender };
    }
  } catch (e) { /* not JSON — plain old message, fall through */ }
  return { kind: "plain", body: rawText };
}

// Generic long-press (mobile) + right-click (desktop) handler.
// Cancels cleanly on scroll/move so it never fights normal scrolling or text selection.
function attachLongPress(el, onLongPress) {
  let timer = null;
  let startX = 0, startY = 0;
  const THRESHOLD_MS = 480;
  const MOVE_TOLERANCE = 10;

  el.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    timer = setTimeout(() => { timer = null; onLongPress(e); }, THRESHOLD_MS);
  }, { passive: true });

  el.addEventListener("touchmove", (e) => {
    if (!timer) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - startX) > MOVE_TOLERANCE || Math.abs(t.clientY - startY) > MOVE_TOLERANCE) {
      clearTimeout(timer); timer = null;
    }
  }, { passive: true });

  el.addEventListener("touchend", () => { if (timer) { clearTimeout(timer); timer = null; } });
  el.addEventListener("touchcancel", () => { if (timer) { clearTimeout(timer); timer = null; } });

  el.addEventListener("contextmenu", (e) => { e.preventDefault(); onLongPress(e); });
}


// ---------- Boot: check saved session ----------
(async function boot() {
  const savedEmail = localStorage.getItem(LS_KEY);
  if (!savedEmail) { showScreen("login"); return; }
  const key = emailKeyFor(savedEmail);
  const { data } = await sb.from("users").select("*").eq("uid", key).maybeSingle();
  if (data) {
    currentUid = key;
    currentProfile = data;
    enterApp();
  } else {
    localStorage.removeItem(LS_KEY);
    showScreen("login");
  }
})();

// ---------- Login ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = loginEmailInput.value.trim();
  const name = loginNameInput.value.trim();
  const key = emailKeyFor(email);
  setBtnLoading(loginSubmitBtn, true);

  try {
    const { data } = await sb.from("users").select("*").eq("uid", key).maybeSingle();
    currentUid = key;
    localStorage.setItem(LS_KEY, email);

    if (data) {
      currentProfile = data;
      enterApp();
    } else {
      setupUsernameInput.value = "";
      setupBioInput.value = "";
      profileSetupForm.dataset.email = email;
      profileSetupForm.dataset.name = name;
      showScreen("profileSetup");
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = "Kuch galat ho gaya. Dobara try karo.";
    loginError.classList.remove("hidden");
  } finally {
    setBtnLoading(loginSubmitBtn, false);
  }
});

// ---------- Profile setup ----------
profileSetupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  profileSetupError.classList.add("hidden");
  const username = slugUsername(setupUsernameInput.value);
  const bio = setupBioInput.value.trim();
  const email = profileSetupForm.dataset.email;
  const displayName = profileSetupForm.dataset.name;

  if (username.length < 3) {
    profileSetupError.textContent = "Username kam se kam 3 characters ka hona chahiye (a-z, 0-9, _).";
    profileSetupError.classList.remove("hidden");
    return;
  }
  setBtnLoading(profileSetupBtn, true);
  try {
    const { data: taken } = await sb.from("users").select("uid").eq("username", username).maybeSingle();
    if (taken) {
      profileSetupError.textContent = "Ye username already liya gaya hai. Doosra try karo.";
      profileSetupError.classList.remove("hidden");
      return;
    }
    const profileData = { uid: currentUid, email, username, display_name: displayName, bio };
    const { error } = await sb.from("users").insert(profileData);
    if (error) throw error;
    currentProfile = profileData;
    enterApp();
    showToast("Profile ban gayi 🐱");
  } catch (err) {
    console.error(err);
    profileSetupError.textContent = "Profile banane mein error aaya. Dobara try karo.";
    profileSetupError.classList.remove("hidden");
  } finally {
    setBtnLoading(profileSetupBtn, false);
  }
});

// ---------- Sign out ----------
function doSignOut() {
  cleanupChannels();
  localStorage.removeItem(LS_KEY);
  currentUid = null; currentProfile = null;
  loginForm.reset();
  showScreen("login");
}
signoutBtn.addEventListener("click", doSignOut);
signoutBtn2.addEventListener("click", doSignOut);

function cleanupChannels() {
  if (activeChatChannel) { sb.removeChannel(activeChatChannel); activeChatChannel = null; }
  if (friendsChannel) { sb.removeChannel(friendsChannel); friendsChannel = null; }
  if (requestsChannel) { sb.removeChannel(requestsChannel); requestsChannel = null; }
  if (presenceChannel) { sb.removeChannel(presenceChannel); presenceChannel = null; }
  activeFriendUid = null;
}

// ---------- Enter app ----------
function enterApp() {
  showScreen("app");
  switchTab("home");
  loadLocalSets();
  homeGreetingText.textContent = `Hey ${currentProfile.display_name.split(" ")[0]} 👋`;
  renderProfileCard();
  loadFriends();
  loadRequests();
  setupPresence();

  friendsChannel = sb.channel("friends-" + currentUid)
    .on("postgres_changes", { event: "*", schema: "public", table: "friends", filter: `owner_uid=eq.${currentUid}` }, loadFriends)
    .subscribe();

  requestsChannel = sb.channel("requests-" + currentUid)
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, loadRequests)
    .subscribe();
}

function setupPresence() {
  presenceChannel = sb.channel("presence-room", { config: { presence: { key: currentUid } } });
  presenceChannel.on("presence", { event: "sync" }, () => {
    presenceState = presenceChannel.presenceState();
    renderFriendsUI();
    renderChatsList();
    renderHomeRecent();
    updateChatHeaderStatus();
  });
  presenceChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") await presenceChannel.track({ online: true });
  });
}

// ---------- Friends data + rendering ----------
async function loadFriends() {
  const { data, error } = await sb.from("friends").select("*").eq("owner_uid", currentUid).order("added_at", { ascending: false });
  if (error) { console.error(error); return; }
  friendsData = data || [];
  friendsCache = {};
  friendsData.forEach(f => friendsCache[f.friend_uid] = f);
  renderFriendsUI();
  renderChatsList();
  renderHomeRecent();
  renderProfileCard();
}

function renderFriendsUI() {
  const filter = friendSearchInput.value.trim().toLowerCase();
  const rows = friendsData.filter(f =>
    !filter || f.friend_display_name.toLowerCase().includes(filter) || f.friend_username.toLowerCase().includes(filter)
  );
  if (friendsData.length === 0) {
    friendsCardsList.innerHTML = `<p class="empty-note">Abhi koi friends nahi hain 🐱 Someone new add karke dekho!</p>`;
    return;
  }
  if (rows.length === 0) {
    friendsCardsList.innerHTML = `<p class="empty-note">Koi match nahi mila.</p>`;
    return;
  }
  friendsCardsList.innerHTML = "";
  rows.forEach(f => {
    const online = isOnline(f.friend_uid);
    const card = document.createElement("div");
    card.className = "friend-card";
    card.innerHTML = `
      <span class="avatar">${esc(initials(f.friend_display_name))}<span class="status-dot ${online ? "online" : "offline"}"></span></span>
      <span class="friend-card-info">
        <span class="row-name">${esc(f.friend_display_name)}</span><br>
        <span class="row-sub">@${esc(f.friend_username)}</span>
      </span>
      <span class="friend-card-actions">
        <button class="chip-btn primary">Chat</button>
        <button class="chip-btn danger">Remove</button>
      </span>`;
    card.querySelector(".primary").addEventListener("click", () => openChat({ uid: f.friend_uid, display_name: f.friend_display_name, username: f.friend_username }));
    card.querySelector(".danger").addEventListener("click", () => removeFriend(f.friend_uid, f.friend_display_name));
    friendsCardsList.appendChild(card);
  });
}
friendSearchInput.addEventListener("input", renderFriendsUI);

function renderChatsList() {
  const rows = friendsData.filter(f => !hiddenChatUids.has(f.friend_uid));
  if (rows.length === 0) {
    chatsList.innerHTML = `<p class="empty-note">Your inbox is quiet... 👀 Start a conversation!</p>`;
    return;
  }
  chatsList.innerHTML = "";
  rows.forEach(f => {
    const online = isOnline(f.friend_uid);
    const row = document.createElement("div");
    row.className = "thread-row" + (mutedChatUids.has(f.friend_uid) ? " muted-row" : "");
    row.innerHTML = `
      <span class="avatar">${esc(initials(f.friend_display_name))}<span class="status-dot ${online ? "online" : "offline"}"></span></span>
      <span>
        <span class="row-name" style="display:block">${esc(f.friend_display_name)}</span>
        <span class="row-sub">@${esc(f.friend_username)} · ${online ? "online" : "offline"}</span>
      </span>`;
    row.addEventListener("click", () => openChat({ uid: f.friend_uid, display_name: f.friend_display_name, username: f.friend_username }));
    attachLongPress(row, () => openThreadActionSheet(f.friend_uid, f.friend_display_name));
    chatsList.appendChild(row);
  });
}

function renderHomeRecent() {
  if (friendsData.length === 0) {
    homeRecentList.innerHTML = `<p class="empty-note">Abhi koi dost nahi hain 🐱 "Friends" tab se add karo!</p>`;
    return;
  }
  homeRecentList.innerHTML = "";
  friendsData.slice(0, 5).forEach(f => {
    const online = isOnline(f.friend_uid);
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML = `
      <span class="avatar">${esc(initials(f.friend_display_name))}<span class="status-dot ${online ? "online" : "offline"}"></span></span>
      <span>
        <span class="row-name" style="display:block">${esc(f.friend_display_name)}</span>
        <span class="row-sub">@${esc(f.friend_username)}</span>
      </span>`;
    row.addEventListener("click", () => openChat({ uid: f.friend_uid, display_name: f.friend_display_name, username: f.friend_username }));
    homeRecentList.appendChild(row);
  });
}

async function removeFriend(friendUid, friendName) {
  if (!confirm(`${friendName} ko friends list se hatana hai?`)) return;
  try {
    await sb.from("friends").delete().eq("owner_uid", currentUid).eq("friend_uid", friendUid);
    await sb.from("friends").delete().eq("owner_uid", friendUid).eq("friend_uid", currentUid);
    showToast("Friend remove ho gaya");
    loadFriends();
  } catch (err) {
    console.error(err);
    showToast("Kuch galat ho gaya", "error");
  }
}

// ---------- Thread (chat list) long-press: Mute / Delete chat ----------
function openThreadActionSheet(friendUid, friendName) {
  activeThreadFriendUid = friendUid;
  threadMuteLabel.textContent = mutedChatUids.has(friendUid) ? "Unmute" : "Mute";
  threadActionSheet.classList.remove("hidden");
}
function closeThreadActionSheet() { threadActionSheet.classList.add("hidden"); }
threadSheetBackdrop.addEventListener("click", closeThreadActionSheet);
threadActionCancelBtn.addEventListener("click", closeThreadActionSheet);

threadActionMuteBtn.addEventListener("click", () => {
  if (!activeThreadFriendUid) return;
  if (mutedChatUids.has(activeThreadFriendUid)) mutedChatUids.delete(activeThreadFriendUid);
  else mutedChatUids.add(activeThreadFriendUid);
  persistSet("muted_chats", mutedChatUids);
  renderChatsList();
  closeThreadActionSheet();
  showToast(mutedChatUids.has(activeThreadFriendUid) ? "Chat muted" : "Chat unmuted");
});

threadActionDeleteBtn.addEventListener("click", () => {
  closeThreadActionSheet();
  deleteChatConfirm.classList.remove("hidden");
});
deleteChatBackdrop.addEventListener("click", () => deleteChatConfirm.classList.add("hidden"));
deleteChatCancelBtn.addEventListener("click", () => deleteChatConfirm.classList.add("hidden"));
deleteChatConfirmBtn.addEventListener("click", () => {
  if (!activeThreadFriendUid) return;
  hiddenChatUids.add(activeThreadFriendUid);
  persistSet("hidden_chats", hiddenChatUids);
  deleteChatConfirm.classList.add("hidden");
  if (activeFriendUid === activeThreadFriendUid) closeChatOverlay();
  renderChatsList();
  showToast("Chat delete ho gayi (sirf tumhari list se)");
});

// ⋮ menu inside an open chat re-uses the same sheet, scoped to the open friend
chatMenuBtn.addEventListener("click", () => {
  if (!activeFriendUid) return;
  const f = friendsCache[activeFriendUid];
  openThreadActionSheet(activeFriendUid, f ? f.friend_display_name : "");
});

// ---------- Add friend ----------
addFriendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addFriendMsg.classList.add("hidden");
  const targetUsername = slugUsername(addFriendInput.value);
  if (!targetUsername) return;

  if (targetUsername === currentProfile.username) {
    return showFormMsg(addFriendMsg, "Khud ko request nahi bhej sakte.", true);
  }
  try {
    const { data: targetProfile } = await sb.from("users").select("*").eq("username", targetUsername).maybeSingle();
    if (!targetProfile) return showFormMsg(addFriendMsg, "Ye username exist nahi karta.", true);
    if (friendsCache[targetProfile.uid]) return showFormMsg(addFriendMsg, "Ye pehle se tumhara dost hai.", true);

    const { error } = await sb.from("friend_requests").insert({
      from_uid: currentUid,
      from_username: currentProfile.username,
      from_display_name: currentProfile.display_name,
      to_uid: targetProfile.uid,
      to_username: targetProfile.username,
      to_display_name: targetProfile.display_name,
      status: "pending",
    });
    if (error) throw error;

    addFriendInput.value = "";
    showFormMsg(addFriendMsg, `Request @${targetUsername} ko bhej di gayi.`, false);
    showToast("Friend request sent ✓");
    loadRequests();
  } catch (err) {
    console.error(err);
    showFormMsg(addFriendMsg, "Kuch galat ho gaya. Dobara try karo.", true);
  }
});

function showFormMsg(el, text, isError) {
  el.textContent = text;
  el.classList.remove("hidden", "error", "success");
  el.classList.add(isError ? "error" : "success");
}

// ---------- Requests ----------
async function loadRequests() {
  const { data: incoming } = await sb.from("friend_requests").select("*").eq("to_uid", currentUid).eq("status", "pending");
  const { data: sent } = await sb.from("friend_requests").select("*").eq("from_uid", currentUid).eq("status", "pending");
  renderIncoming(incoming || []);
  renderSent(sent || []);
}

function renderIncoming(rows) {
  if (rows.length === 0) {
    incomingRequestsList.innerHTML = `<p class="empty-note">You're all caught up! ✨</p>`;
    requestBadge.classList.add("hidden");
    requestBadgeM.classList.add("hidden");
    return;
  }
  requestBadge.textContent = rows.length;
  requestBadge.classList.remove("hidden");
  requestBadgeM.textContent = rows.length;
  requestBadgeM.classList.remove("hidden");
  incomingRequestsList.innerHTML = "";
  rows.forEach(r => {
    const card = document.createElement("div");
    card.className = "request-card";
    card.innerHTML = `
      <span class="avatar">${esc(initials(r.from_display_name))}</span>
      <span class="request-info">
        <span class="request-name">${esc(r.from_display_name)}</span><br>
        <span class="request-username">@${esc(r.from_username)} · Wants to be your friend</span>
      </span>
      <span class="request-actions">
        <button class="chip-btn primary">Accept</button>
        <button class="chip-btn">Reject</button>
      </span>`;
    card.querySelector(".primary").addEventListener("click", () => acceptRequest(r));
    card.querySelector(".chip-btn:not(.primary)").addEventListener("click", async () => {
      await sb.from("friend_requests").delete().eq("id", r.id);
      loadRequests();
    });
    incomingRequestsList.appendChild(card);
  });
}

function renderSent(rows) {
  if (rows.length === 0) {
    sentRequestsList.innerHTML = `<p class="empty-note">Koi pending request nahi.</p>`;
    return;
  }
  sentRequestsList.innerHTML = "";
  rows.forEach(r => {
    const card = document.createElement("div");
    card.className = "request-card";
    card.innerHTML = `
      <span class="avatar">${esc(initials(r.to_display_name))}</span>
      <span class="request-info">
        <span class="request-name">${esc(r.to_display_name)}</span><br>
        <span class="request-username">@${esc(r.to_username)} · pending</span>
      </span>
      <span class="request-actions"><button class="chip-btn">Cancel</button></span>`;
    card.querySelector(".chip-btn").addEventListener("click", async () => {
      await sb.from("friend_requests").delete().eq("id", r.id);
      loadRequests();
    });
    sentRequestsList.appendChild(card);
  });
}

async function acceptRequest(r) {
  try {
    await sb.from("friends").insert({ owner_uid: currentUid, friend_uid: r.from_uid, friend_username: r.from_username, friend_display_name: r.from_display_name });
    await sb.from("friends").insert({ owner_uid: r.from_uid, friend_uid: currentUid, friend_username: currentProfile.username, friend_display_name: currentProfile.display_name });
    await sb.from("friend_requests").update({ status: "accepted" }).eq("id", r.id);
    showToast("Friend request accepted ✓");
    loadFriends();
    loadRequests();
  } catch (err) {
    console.error(err);
    showToast("Kuch galat ho gaya", "error");
  }
}

// ---------- Profile ----------
function renderProfileCard() {
  profileAvatar.textContent = initials(currentProfile.display_name);
  profileNameDisplay.textContent = currentProfile.display_name;
  profileUsernameDisplay2.textContent = "@" + currentProfile.username;
  profileBioDisplay.textContent = currentProfile.bio || "Bio khali hai 🐾";
  profileFriendCount.textContent = friendsData.length;
}

editProfileBtn.addEventListener("click", () => {
  profileUsernameDisplay.value = "@" + currentProfile.username;
  profileNameInput.value = currentProfile.display_name;
  profileBioInput.value = currentProfile.bio || "";
  editProfileModal.classList.remove("hidden");
});
cancelEditBtn.addEventListener("click", () => editProfileModal.classList.add("hidden"));
modalBackdrop.addEventListener("click", () => editProfileModal.classList.add("hidden"));

profileEditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const displayName = profileNameInput.value.trim();
  const bio = profileBioInput.value.trim();
  const submitBtn = profileEditForm.querySelector("button[type=submit]");
  setBtnLoading(submitBtn, true);
  try {
    const { error } = await sb.from("users").update({ display_name: displayName, bio }).eq("uid", currentUid);
    if (error) throw error;
    currentProfile.display_name = displayName;
    currentProfile.bio = bio;
    renderProfileCard();
    editProfileModal.classList.add("hidden");
    showToast("Profile updated ✓");
  } catch (err) {
    console.error(err);
    showToast("Save nahi ho paya", "error");
  } finally {
    setBtnLoading(submitBtn, false);
  }
});

// ---------- Chat ----------
function chatIdFor(uidA, uidB) { return [uidA, uidB].sort().join("_"); }

function updateChatHeaderStatus() {
  if (!activeFriendUid) return;
  const online = isOnline(activeFriendUid);
  chatStatusDot.className = "status-dot " + (online ? "online" : "offline");
  chatStatusText.textContent = online ? "online" : "offline";
}

function closeChatOverlay() {
  chatOverlay.classList.add("hidden");
  appScreenEl.classList.remove("chat-open");
  if (activeChatChannel) { sb.removeChannel(activeChatChannel); activeChatChannel = null; }
  clearTimeout(typingHideTimer);
  typingIndicator.classList.add("hidden");
  cancelReply();
  activeFriendUid = null;
}
chatBackBtn.addEventListener("click", closeChatOverlay);

async function openChat(friend) {
  activeFriendUid = friend.uid;

  // Opening a chat again brings it back into the Chats list if it was locally "deleted"
  if (hiddenChatUids.has(friend.uid)) {
    hiddenChatUids.delete(friend.uid);
    persistSet("hidden_chats", hiddenChatUids);
    renderChatsList();
  }

  chatOverlay.classList.remove("hidden");
  appScreenEl.classList.add("chat-open");
  chatAvatar.textContent = initials(friend.display_name);
  chatTitle.textContent = friend.display_name;
  updateChatHeaderStatus();
  messagesEl.innerHTML = "";
  typingIndicator.classList.add("hidden");
  cancelReply();

  const chatId = chatIdFor(currentUid, friend.uid);

  const { data, error } = await sb.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(300);
  if (error) {
    console.error(error);
    messagesEl.innerHTML = `<div class="empty-state"><p>Messages load nahi ho paye.</p></div>`;
  } else {
    const visible = (data || []).filter(m => !hiddenMessageIds.has(m.id));
    if (visible.length === 0) {
      messagesEl.innerHTML = `<div class="empty-state"><p>Start a conversation... 🐱<br>Abhi tak koi message nahi.</p></div>`;
    } else {
      visible.forEach(renderMessage);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  if (activeChatChannel) sb.removeChannel(activeChatChannel);
  activeChatChannel = sb.channel("room-" + chatId, { config: { broadcast: { self: false } } })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, (payload) => {
      if (hiddenMessageIds.has(payload.new.id)) return;
      if (messagesEl.querySelector(".empty-state")) messagesEl.innerHTML = "";
      renderMessage(payload.new);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      typingIndicator.classList.add("hidden");
    })
    .on("broadcast", { event: "typing" }, (payload) => {
      typingName.textContent = payload.payload.name;
      typingIndicator.classList.remove("hidden");
      clearTimeout(typingHideTimer);
      typingHideTimer = setTimeout(() => typingIndicator.classList.add("hidden"), 2000);
    })
    .subscribe();

  messageInput.focus();
}

function renderMessage(data) {
  const parsed = parseMessageEnvelope(data.text);
  const div = document.createElement("div");
  const mine = data.sender_uid === currentUid;
  div.className = "msg " + (mine ? "mine" : "other");
  div.dataset.messageId = data.id;

  let inner = `<span class="meta">${mine ? "Tum" : esc(data.sender_name)}</span>`;

  if (parsed.kind === "reply" && parsed.replyTo) {
    inner += `<span class="msg-reply-quote" data-jump-to="${esc(parsed.replyTo.id || "")}">
      <span class="rq-name">${esc(parsed.replyTo.name)}</span>
      <span class="rq-text">${esc(parsed.replyTo.text)}</span>
    </span>`;
  }
  if (parsed.kind === "forward") {
    inner += `<span class="msg-forward-label">↗ Forwarded${parsed.originalSender ? " · " + esc(parsed.originalSender) : ""}</span>`;
  }
  inner += `${esc(parsed.body)}<span class="msg-time">${formatTime(data.created_at)}</span>`;
  if (savedMessageIds.has(data.id)) inner += `<span class="msg-saved-star">⭐</span>`;

  div.innerHTML = inner;

  const quoteEl = div.querySelector(".msg-reply-quote");
  if (quoteEl) {
    quoteEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetId = quoteEl.dataset.jumpTo;
      const targetEl = messagesEl.querySelector(`[data-message-id="${targetId}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        targetEl.classList.add("highlight-flash");
        setTimeout(() => targetEl.classList.remove("highlight-flash"), 1200);
      } else {
        showToast("Original message ab dikh nahi raha");
      }
    });
  }

  attachLongPress(div, () => openMessageActionSheet({
    id: data.id, senderUid: data.sender_uid, senderName: mine ? currentProfile.display_name : data.sender_name, body: parsed.body,
  }));

  messagesEl.appendChild(div);
}

messageInput.addEventListener("input", () => {
  if (!activeChatChannel) return;
  const now = Date.now();
  if (now - lastTypingSentAt < 1200) return;
  lastTypingSentAt = now;
  activeChatChannel.send({ type: "broadcast", event: "typing", payload: { name: currentProfile.display_name } });
});

messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !activeFriendUid) return;
  messageInput.value = "";

  let payloadText = text;
  if (replyingTo) {
    payloadText = JSON.stringify({ __baatchit_type: "reply", body: text, replyTo: replyingTo });
  }

  const chatId = chatIdFor(currentUid, activeFriendUid);
  try {
    const { error } = await sb.from("messages").insert({ chat_id: chatId, sender_uid: currentUid, sender_name: currentProfile.display_name, text: payloadText });
    if (error) throw error;
    cancelReply();
  } catch (err) {
    console.error(err);
    showToast("Message bhej nahi paya", "error");
  }
});

// ---------- Reply preview ----------
function startReply(msg) {
  replyingTo = { id: msg.id, name: msg.senderName, text: msg.body.length > 80 ? msg.body.slice(0, 80) + "…" : msg.body };
  replyPreviewName.textContent = msg.senderName;
  replyPreviewText.textContent = msg.body;
  replyPreviewBar.classList.remove("hidden");
  messageInput.focus();
}
function cancelReply() {
  replyingTo = null;
  replyPreviewBar.classList.add("hidden");
}
replyPreviewCancel.addEventListener("click", cancelReply);

// ---------- Message action sheet (long-press / right-click on a bubble) ----------
function openMessageActionSheet(msg) {
  activeActionMessage = msg;
  actionSaveLabel.textContent = savedMessageIds.has(msg.id) ? "Unsave" : "Save";
  messageActionSheet.classList.remove("hidden");
}
function closeMessageActionSheet() { messageActionSheet.classList.add("hidden"); }
messageSheetBackdrop.addEventListener("click", closeMessageActionSheet);

actionReplyBtn.addEventListener("click", () => {
  if (activeActionMessage) startReply(activeActionMessage);
  closeMessageActionSheet();
});

actionCopyBtn.addEventListener("click", async () => {
  if (!activeActionMessage) return;
  try {
    await navigator.clipboard.writeText(activeActionMessage.body);
    showToast("Message copied");
  } catch (err) {
    console.error(err);
    showToast("Copy nahi ho paya", "error");
  }
  closeMessageActionSheet();
});

actionSaveBtn.addEventListener("click", () => {
  if (!activeActionMessage) return;
  const id = activeActionMessage.id;
  if (savedMessageIds.has(id)) { savedMessageIds.delete(id); showToast("Unsaved"); }
  else { savedMessageIds.add(id); showToast("Saved ⭐ (sirf is device par)"); }
  persistSet("saved_msgs", savedMessageIds);
  const bubble = messagesEl.querySelector(`[data-message-id="${id}"]`);
  if (bubble) {
    const existingStar = bubble.querySelector(".msg-saved-star");
    if (savedMessageIds.has(id) && !existingStar) {
      const star = document.createElement("span");
      star.className = "msg-saved-star"; star.textContent = "⭐";
      bubble.appendChild(star);
    } else if (!savedMessageIds.has(id) && existingStar) {
      existingStar.remove();
    }
  }
  closeMessageActionSheet();
});

actionDeleteBtn.addEventListener("click", () => {
  if (!activeActionMessage) return;
  hiddenMessageIds.add(activeActionMessage.id);
  persistSet("hidden_msgs", hiddenMessageIds);
  const bubble = messagesEl.querySelector(`[data-message-id="${activeActionMessage.id}"]`);
  if (bubble) bubble.remove();
  showToast("Delete ho gaya (sirf tumhare liye)");
  closeMessageActionSheet();
});

// ---------- Forward ----------
actionForwardBtn.addEventListener("click", () => {
  if (!activeActionMessage) return;
  closeMessageActionSheet();
  forwardPreviewText.textContent = `"${activeActionMessage.body}"`;
  forwardSearchInput.value = "";
  renderForwardList("");
  forwardModal.classList.remove("hidden");
});
forwardBackdrop.addEventListener("click", () => forwardModal.classList.add("hidden"));
forwardCancelBtn.addEventListener("click", () => forwardModal.classList.add("hidden"));
forwardSearchInput.addEventListener("input", () => renderForwardList(forwardSearchInput.value));

function renderForwardList(filterText) {
  const filter = filterText.trim().toLowerCase();
  const rows = friendsData.filter(f => !filter || f.friend_display_name.toLowerCase().includes(filter) || f.friend_username.toLowerCase().includes(filter));
  if (rows.length === 0) {
    forwardFriendsList.innerHTML = `<p class="empty-note">Koi dost nahi mila.</p>`;
    return;
  }
  forwardFriendsList.innerHTML = "";
  rows.forEach(f => {
    const btn = document.createElement("button");
    btn.className = "forward-row";
    btn.innerHTML = `<span class="avatar">${esc(initials(f.friend_display_name))}</span>
      <span><span class="row-name" style="display:block">${esc(f.friend_display_name)}</span><span class="row-sub">@${esc(f.friend_username)}</span></span>`;
    btn.addEventListener("click", () => forwardMessageTo(f.friend_uid, f.friend_display_name));
    forwardFriendsList.appendChild(btn);
  });
}

async function forwardMessageTo(targetUid, targetName) {
  if (!activeActionMessage) return;
  const chatId = chatIdFor(currentUid, targetUid);
  const payloadText = JSON.stringify({ __baatchit_type: "forward", body: activeActionMessage.body, originalSender: activeActionMessage.senderName });
  try {
    const { error } = await sb.from("messages").insert({ chat_id: chatId, sender_uid: currentUid, sender_name: currentProfile.display_name, text: payloadText });
    if (error) throw error;
    forwardModal.classList.add("hidden");
    showToast(`Forwarded to ${targetName} ✓`);
  } catch (err) {
    console.error(err);
    showToast("Forward nahi ho paya", "error");
  }
}

// ---------- Chat header → friend profile ----------
chatHeaderProfileBtn.addEventListener("click", () => openFriendProfile(activeFriendUid));
fpBackBtn.addEventListener("click", () => friendProfileOverlay.classList.add("hidden"));

async function openFriendProfile(friendUid) {
  const f = friendsCache[friendUid];
  if (!f) return;
  fpAvatar.textContent = initials(f.friend_display_name);
  fpName.textContent = f.friend_display_name;
  fpUsername.textContent = "@" + f.friend_username;
  fpBio.textContent = "…";
  fpFriendCount.textContent = "…";
  friendProfileOverlay.classList.remove("hidden");

  const { data: userRow } = await sb.from("users").select("bio").eq("uid", friendUid).maybeSingle();
  fpBio.textContent = (userRow && userRow.bio) ? userRow.bio : "Bio khali hai 🐾";

  const { count } = await sb.from("friends").select("*", { count: "exact", head: true }).eq("owner_uid", friendUid);
  fpFriendCount.textContent = count ?? 0;
}

fpRemoveBtn.addEventListener("click", async () => {
  if (!activeFriendUid) return;
  const f = friendsCache[activeFriendUid];
  friendProfileOverlay.classList.add("hidden");
  await removeFriend(activeFriendUid, f ? f.friend_display_name : "");
  closeChatOverlay();
});

// ---------- Emoji picker ----------
emojiBtn.addEventListener("click", () => emojiPanel.classList.toggle("hidden"));
emojiPanel.querySelectorAll("button").forEach(b => {
  b.addEventListener("click", () => {
    messageInput.value += b.textContent;
    messageInput.focus();
    emojiPanel.classList.add("hidden");
  });
});
document.addEventListener("click", (e) => {
  if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) emojiPanel.classList.add("hidden");
});
