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
  if (friendsData.length === 0) {
    chatsList.innerHTML = `<p class="empty-note">Your inbox is quiet... 👀 Start a conversation!</p>`;
    return;
  }
  chatsList.innerHTML = "";
  friendsData.forEach(f => {
    const online = isOnline(f.friend_uid);
    const row = document.createElement("div");
    row.className = "thread-row";
    row.innerHTML = `
      <span class="avatar">${esc(initials(f.friend_display_name))}<span class="status-dot ${online ? "online" : "offline"}"></span></span>
      <span>
        <span class="row-name" style="display:block">${esc(f.friend_display_name)}</span>
        <span class="row-sub">@${esc(f.friend_username)} · ${online ? "online" : "offline"}</span>
      </span>`;
    row.addEventListener("click", () => openChat({ uid: f.friend_uid, display_name: f.friend_display_name, username: f.friend_username }));
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
  activeFriendUid = null;
}
chatBackBtn.addEventListener("click", closeChatOverlay);

async function openChat(friend) {
  activeFriendUid = friend.uid;
  chatOverlay.classList.remove("hidden");
  appScreenEl.classList.add("chat-open");
  chatAvatar.textContent = initials(friend.display_name);
  chatTitle.textContent = friend.display_name;
  updateChatHeaderStatus();
  messagesEl.innerHTML = "";
  typingIndicator.classList.add("hidden");

  const chatId = chatIdFor(currentUid, friend.uid);

  const { data, error } = await sb.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(300);
  if (error) {
    console.error(error);
    messagesEl.innerHTML = `<div class="empty-state"><p>Messages load nahi ho paye.</p></div>`;
  } else if (!data || data.length === 0) {
    messagesEl.innerHTML = `<div class="empty-state"><p>Start a conversation... 🐱<br>Abhi tak koi message nahi.</p></div>`;
  } else {
    data.forEach(renderMessage);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  if (activeChatChannel) sb.removeChannel(activeChatChannel);
  activeChatChannel = sb.channel("room-" + chatId, { config: { broadcast: { self: false } } })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, (payload) => {
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
  const div = document.createElement("div");
  const mine = data.sender_uid === currentUid;
  div.className = "msg " + (mine ? "mine" : "other");
  div.innerHTML = `<span class="meta">${mine ? "Tum" : esc(data.sender_name)}</span>${esc(data.text)}`;
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
  const chatId = chatIdFor(currentUid, activeFriendUid);
  try {
    const { error } = await sb.from("messages").insert({ chat_id: chatId, sender_uid: currentUid, sender_name: currentProfile.display_name, text });
    if (error) throw error;
  } catch (err) {
    console.error(err);
    showToast("Message bhej nahi paya", "error");
  }
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
