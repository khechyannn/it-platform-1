if (!requireLogin()) {
  throw new Error('redirect');
}

let currentUser = getUser();
let currentUserId = currentUser.id;
let currentRoomId = null;
let socket = null;
let typingTimeout = null;

const currentUserEl = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const roomsList = document.getElementById('roomsList');
const messagesEl = document.getElementById('messages');
const partnerNameEl = document.getElementById('partnerName');
const partnerStatusEl = document.getElementById('partnerStatus');
const typingIndicator = document.getElementById('typingIndicator');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

currentUserEl.textContent = `${currentUser.name} (${currentUser.role})`;
logoutBtn.addEventListener('click', logout);

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: authHeaders(options.headers || {}),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      logout();
      throw new Error('Session expired');
    }
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('ru-RU');
}

function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = 'message' + (msg.sender_id === currentUserId ? ' own' : '');
  div.dataset.id = msg.id;
  div.innerHTML = `
    <div class="message-meta">${msg.sender_name || 'User ' + msg.sender_id} · ${formatTime(msg.created_at)}</div>
    <div>${escapeHtml(msg.text)}</div>
  `;
  messagesEl.appendChild(div);

  if (msg.sender_id !== currentUserId && !msg.is_read) {
    api(`/api/chat/messages/${msg.id}/read/`, { method: 'PATCH' }).catch(console.error);
  }
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

async function loadRooms() {
  const rooms = await api('/api/chat/rooms/');
  roomsList.innerHTML = rooms.map((room) => `
    <li data-id="${room.id}" class="${room.id === currentRoomId ? 'active' : ''}">
      <div class="room-title">
        ${escapeHtml(room.partner.name)}
        ${room.unread_count > 0 ? `<span class="unread">${room.unread_count}</span>` : ''}
      </div>
      <div class="room-meta">
        ${room.partner.online ? '🟢 онлайн' : '⚫ офлайн'}
        ${room.last_message ? ' · ' + escapeHtml(room.last_message.slice(0, 40)) : ''}
      </div>
    </li>
  `).join('');

  roomsList.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => openRoom(Number(li.dataset.id), rooms));
  });

  updatePartnerStatus(rooms);
  return rooms;
}

function updatePartnerStatus(rooms) {
  if (!currentRoomId) return;
  const room = rooms.find((r) => r.id === currentRoomId);
  if (!room) return;
  partnerNameEl.textContent = room.partner.name;
  partnerStatusEl.textContent = room.partner.online ? 'онлайн' : 'офлайн';
  partnerStatusEl.className = 'status ' + (room.partner.online ? 'online' : 'offline');
}

async function openRoom(roomId, rooms) {
  currentRoomId = roomId;
  updatePartnerStatus(rooms);
  messageInput.disabled = false;
  messageForm.querySelector('button').disabled = false;

  messagesEl.innerHTML = '';
  const result = await api(`/api/chat/rooms/${roomId}/messages/?limit=50`);
  result.data.forEach(renderMessage);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  await loadRooms();
}

function connectSocket() {
  if (socket) socket.disconnect();
  socket = io({ auth: { token: getToken() } });

  socket.on('connect_error', () => {
    logout();
  });

  socket.on('message:send', (msg) => {
    if (msg.room_id === currentRoomId) {
      renderMessage(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (msg.sender_id !== currentUserId && !msg.is_read) {
        socket.emit('message:read', { message_id: msg.id });
      }
    }
    loadRooms();
  });

  socket.on('message:read', () => loadRooms());

  socket.on('user:typing', (data) => {
    if (data.room_id !== currentRoomId || data.user_id === currentUserId) return;
    typingIndicator.textContent = data.typing ? 'печатает...' : '';
  });

  socket.on('user:online', () => loadRooms());
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentRoomId) return;

  socket.emit('message:send', { room_id: currentRoomId, text }, (res) => {
    if (res?.error) alert(res.error);
  });
  messageInput.value = '';
  socket.emit('user:typing', { room_id: currentRoomId, typing: false });
});

messageInput.addEventListener('input', () => {
  if (!currentRoomId) return;
  socket.emit('user:typing', { room_id: currentRoomId, typing: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('user:typing', { room_id: currentRoomId, typing: false });
  }, 1500);
});

connectSocket();
loadRooms();
