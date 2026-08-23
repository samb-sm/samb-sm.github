// ============================================================
// MeetHost — Main App Logic (Firebase + WebRTC, Vanilla JS)
// InfinityFree-ready static build
// ============================================================

import {
  db, auth,
  ref, set, get, update, onValue, push, remove, child, onDisconnect, serverTimestamp,
  signInAnonymously, onAuthStateChanged
} from './firebase-config.js';

// ============================================================
// CONFIG & STATE
// ============================================================
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const AVATAR_COLORS = ['#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6'];

const state = {
  uid: null,           // firebase auth uid
  name: '',
  roomId: null,
  roomCode: '',
  isHost: false,
  role: 'participant',
  localStream: null,
  screenStream: null,
  isSharingScreen: false,
  peers: new Map(),       // peerId -> RTCPeerConnection
  remoteStreams: new Map(), // peerId -> MediaStream
  participants: {},       // snapshot from DB
  roomData: {},
  micOn: false,
  camOn: false,
  handRaised: false,
  waiting: false,
  polls: {},
  lang: localStorage.getItem('meethost-lang') || 'bn',
  theme: localStorage.getItem('meethost-theme') || 'dark',
  pinnedId: null,
  panelOpen: false,
  activePanel: 'chat',
  startTime: null,
  audioCtx: null,
  audioAnalysers: new Map(),
};

// ============================================================
// I18N
// ============================================================
const I18N = {
  bn: {
    appName: 'মিটহোস্ট', tagline: 'আনলিমিটেড ভিডিও মিটিং হোস্ট করুন। লগইন লাগবে না।',
    heroTitle: 'মুখোমুখি দেখা হোক,', heroTitleAccent: 'যেখানেই থাকুন, যখনই চান।',
    heroSubtitle: 'রুম তৈরি করুন, কোড শেয়ার করুন, সবাইকে একসাথে আনুন। টিম, বন্ধু আর কমিউনিটির জন্য।',
    createRoom: 'রুম তৈরি করুন', joinRoom: 'রুমে জয়েন করুন', enterName: 'আপনার নাম লিখুন',
    enterCode: 'রুম কোড লিখুন', optionalPassword: 'পাসওয়ার্ড (অপশনাল)', enableWaitingRoom: 'ওয়েটিং রুম',
    startMeeting: 'মিটিং শুরু করুন', joinMeeting: 'জয়েন করুন', back: 'ফিরে যান',
    featuresTitle: 'মিট করার জন্য যা যা দরকার',
    f1: ['মাল্টি-পার্টিসিপেন্ট ভিডিও','মেশ WebRTC এ ছয়জন পর্যন্ত HD কল চলে।'],
    f2: ['হোস্ট কন্ট্রোল','মিউট, কিক, লক, হোস্ট ট্রান্সফার — পুরো নিয়ন্ত্রণ।'],
    f3: ['চ্যাট ও রিয়েকশন','গ্রুপ চ্যাট, ফ্লোটিং ইমোজি, হাত তোলা।'],
    f4: ['স্ক্রিন শেয়ারিং','ট্যাব, উইন্ডো বা পুরো স্ক্রিন এক ক্লিকে শেয়ার।'],
    f5: ['পোল ও এনগেজমেন্ট','লাইভ পোল, হ্যান্ড-রেইজ কিউ, হোস্ট ব্রডকাস্ট।'],
    f6: ['বাইলিঙ্গুয়াল ও ডার্ক মোড','বাংলা + ইংরেজি UI, সুন্দর ডার্ক থিমসহ।'],
    footer: 'Firebase Realtime Database + WebRTC দিয়ে তৈরি। সম্পূর্ণ ফ্রি হোস্টিং-এ চলে।',
    lobbyTitle: 'জয়েন করার জন্য প্রস্তুত?', lobbySubtitle: 'ঢোকার আগে ক্যামেরা ও মাইক চেক করুন',
    mic: 'মাইক্রোফোন', camera: 'ক্যামেরা', joinNow: 'এখন জয়েন করুন', cancel: 'বাতিল',
    previewError: 'ক্যামেরা/মাইক অ্যাক্সেস করা যায়নি। ব্রাউজার পারমিশন চেক করুন।',
    participants: 'অংশগ্রহণকারী', chat: 'চ্যাট', reactions: 'রিয়েকশন', polls: 'পোল',
    send: 'পাঠান', typeMessage: 'মেসেজ লিখুন...', mute: 'মিউট', unmute: 'আনমিউট',
    videoOn: 'ভিডিও চালু', videoOff: 'ভিডিও বন্ধ', shareScreen: 'স্ক্রিন শেয়ার',
    stopShare: 'শেয়ার বন্ধ', raiseHand: 'হাত তুলুন', lowerHand: 'হাত নামান', react: 'রিয়েকশন',
    leave: 'বের হন', endForAll: 'সবার জন্য শেষ', copyLink: 'লিংক কপি', copied: 'কপি হয়েছে!',
    you: 'আপনি', host: 'হোস্ট', cohost: 'কো-হোস্ট', meetingLocked: 'মিটিং লক করা',
    meetingEnded: 'হোস্ট মিটিং শেষ করেছে', kicked: 'আপনাকে মিটিং থেকে সরানো হয়েছে',
    recording: 'রেকর্ডিং', waitingRoom: 'ওয়েটিং রুম', admit: 'ঢুকতে দিন', deny: 'প্রত্যাখ্যান',
    muteAll: 'সবাইকে মিউট', lockMeeting: 'মিটিং লক', unlockMeeting: 'মিটিং আনলক',
    makeCoHost: 'কো-হোস্ট বানান', removeCoHost: 'কো-হোস্ট সরান', transferHost: 'হোস্ট বদলান',
    kick: 'সরান', ban: 'ব্যান', enableChat: 'চ্যাট চালু', disableChat: 'চ্যাট বন্ধ',
    disableScreen: 'স্ক্রিন শেয়ার বন্ধ', enableScreen: 'স্ক্রিন শেয়ার চালু',
    enableWaitingRoom: 'ওয়েটিং রুম চালু', disableWaitingRoom: 'ওয়েটিং রুম বন্ধ',
    startRecording: 'রেকর্ডিং শুরু', stopRecording: 'রেকর্ডিং বন্ধ', createPoll: 'পোল তৈরি',
    pollQuestion: 'প্রশ্ন', pollOptions: 'অপশন', addOption: 'অপশন যোগ', startPoll: 'পোল শুরু',
    closePoll: 'পোল বন্ধ', votes: 'ভোট', waitingTitle: 'হোস্ট ঢুকতে দিচ্ছেন...',
    waitingSubtitle: 'হোস্ট শীঘ্রই আপনাকে ঢুকতে দেবেন', online: 'অনলাইন',
    confirmEnd: 'সবার জন্য মিটিং শেষ করবেন?', confirmLeave: 'মিটিং থেকে বের হবেন?',
    connecting: 'কানেক্ট হচ্ছে...', roomNotFound: 'রুম পাওয়া যায়নি', roomLocked: 'রুম লক করা আছে',
    wrongPassword: 'ভুল পাসওয়ার্ড', chatDisabled: 'হোস্ট চ্যাট বন্ধ করেছে',
    screenBusy: 'অন্য কেউ শেয়ার করছে', nameRequired: 'নাম লিখুন', codeRequired: 'রুম কোড লিখুন',
  },
  en: {
    appName: 'MeetHost', tagline: 'Host unlimited video meetings. No login required.',
    heroTitle: 'Meet face-to-face,', heroTitleAccent: 'anywhere, anytime.',
    heroSubtitle: 'Create a room, share the code, and bring everyone together. For teams, friends, and communities.',
    createRoom: 'Create a Room', joinRoom: 'Join a Room', enterName: 'Enter your name',
    enterCode: 'Enter room code', optionalPassword: 'Password (optional)', enableWaitingRoom: 'Waiting room',
    startMeeting: 'Start Meeting', joinMeeting: 'Join Meeting', back: 'Back',
    featuresTitle: 'Everything you need to meet',
    f1: ['Multi-participant Video','Mesh WebRTC supports up to 6 in HD.'],
    f2: ['Host Controls','Mute, kick, lock, transfer host — full power.'],
    f3: ['Chat & Reactions','Group chat, floating emojis, hand raise.'],
    f4: ['Screen Sharing','Share tab, window, or full screen in one click.'],
    f5: ['Polls & Engagement','Live polls, hand-raise queue, broadcasts.'],
    f6: ['Bilingual & Dark Mode','Bangla + English UI with dark theme.'],
    footer: 'Built with Firebase Realtime DB + WebRTC. Runs on any free hosting.',
    lobbyTitle: 'Ready to join?', lobbySubtitle: 'Check your camera & mic before entering',
    mic: 'Microphone', camera: 'Camera', joinNow: 'Join Now', cancel: 'Cancel',
    previewError: 'Could not access camera/mic. Check browser permissions.',
    participants: 'Participants', chat: 'Chat', reactions: 'Reactions', polls: 'Polls',
    send: 'Send', typeMessage: 'Type a message...', mute: 'Mute', unmute: 'Unmute',
    videoOn: 'Video On', videoOff: 'Video Off', shareScreen: 'Share Screen',
    stopShare: 'Stop Sharing', raiseHand: 'Raise Hand', lowerHand: 'Lower Hand', react: 'React',
    leave: 'Leave', endForAll: 'End for All', copyLink: 'Copy Link', copied: 'Copied!',
    you: 'You', host: 'Host', cohost: 'Co-host', meetingLocked: 'Meeting is locked',
    meetingEnded: 'Meeting ended by host', kicked: 'You were removed from the meeting',
    recording: 'Recording', waitingRoom: 'Waiting Room', admit: 'Admit', deny: 'Deny',
    muteAll: 'Mute All', lockMeeting: 'Lock Meeting', unlockMeeting: 'Unlock Meeting',
    makeCoHost: 'Make Co-host', removeCoHost: 'Remove Co-host', transferHost: 'Transfer Host',
    kick: 'Remove', ban: 'Ban', enableChat: 'Enable Chat', disableChat: 'Disable Chat',
    disableScreen: 'Disable Screen Share', enableScreen: 'Enable Screen Share',
    enableWaitingRoom: 'Enable Waiting Room', disableWaitingRoom: 'Disable Waiting Room',
    startRecording: 'Start Recording', stopRecording: 'Stop Recording', createPoll: 'Create Poll',
    pollQuestion: 'Question', pollOptions: 'Options', addOption: 'Add option', startPoll: 'Start Poll',
    closePoll: 'Close Poll', votes: 'votes', waitingTitle: 'Waiting for host to admit you...',
    waitingSubtitle: 'The host will let you in shortly', online: 'online',
    confirmEnd: 'End this meeting for everyone?', confirmLeave: 'Leave the meeting?',
    connecting: 'Connecting...', roomNotFound: 'Room not found', roomLocked: 'Room is locked',
    wrongPassword: 'Wrong password', chatDisabled: 'Chat is disabled by host',
    screenBusy: 'Someone else is already sharing', nameRequired: 'Please enter your name',
    codeRequired: 'Please enter room code',
  }
};

function t(key) { return (I18N[state.lang] && I18N[state.lang][key]) || key; }
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    el.textContent = t(k);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.getAttribute('data-i18n-ph');
    el.placeholder = t(k);
  });
  document.querySelectorAll('.lang-toggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === state.lang);
  });
}

// ============================================================
// HELPERS
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function genId() { return Math.random().toString(36).slice(2, 10); }
function genCode() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let c = ''; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}
function pickColor(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}
function showView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
}
function playSound(kind) {
  try {
    if (!state.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      state.audioCtx = new Ctx();
    }
    const ctx = state.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const cfg = {
      join: { f: 660, s: 880, type: 'sine', dur: 0.18 },
      leave: { f: 440, s: 330, type: 'sine', dur: 0.18 },
      hand: { f: 800, type: 'triangle', dur: 0.12 },
      record: { f: 220, type: 'square', dur: 0.25 },
    }[kind];
    if (!cfg) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.f, ctx.currentTime);
    if (cfg.s) osc.frequency.linearRampToValueAtTime(cfg.s, ctx.currentTime + cfg.dur);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + cfg.dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + cfg.dur + 0.02);
  } catch (e) {}
}

// ============================================================
// AUTH
// ============================================================
async function initAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) { state.uid = user.uid; resolve(user); }
      else {
        signInAnonymously(auth).then((cred) => {
          state.uid = cred.user.uid;
          resolve(cred.user);
        }).catch((e) => {
          console.error('Anonymous auth failed', e);
          let msg = 'Firebase auth failed.';
          if (e.code === 'auth/admin-restricted-operation') {
            msg = 'Firebase-এ Anonymous sign-in চালু নেই।\\n\\nসমাধান:\\n1. console.firebase.google.com → তোমার project\\n2. Authentication → Sign-in method\\n3. Anonymous → Enable → Save\\n\\nতারপর আবার চেষ্টা করো।';
          } else if (e.code === 'auth/api-key-not-valid') {
            msg = 'Firebase API key ঠিক নেই। firebase-config.js চেক করো।';
          } else if (e.code === 'auth/network-request-failed') {
            msg = 'নেটওয়ার্ক সমস্যা। ইন্টারনেট কানেকশন চেক করো।';
          }
          toast(msg, 'error');
          reject(e);
        });
      }
    });
  });
}

// ============================================================
// LOCAL MEDIA
// ============================================================
async function initLocalMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    state.localStream = stream;
    // start OFF
    stream.getAudioTracks().forEach(tr => tr.enabled = false);
    stream.getVideoTracks().forEach(tr => tr.enabled = false);
    return stream;
  } catch (e) {
    console.warn('getUserMedia failed', e);
    return null;
  }
}

// ============================================================
// WEBRTC MESH
// ============================================================
function createPeerConnection(peerId) {
  if (state.peers.has(peerId)) return state.peers.get(peerId);
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const remoteStream = new MediaStream();
  state.remoteStreams.set(peerId, remoteStream);

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      state.remoteStreams.set(peerId, stream);
    } else {
      remoteStream.addTrack(event.track);
    }
    renderVideoGrid();
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // send ICE candidate to peer via Firebase
      const candRef = push(ref(db, `rooms/${state.roomId}/signal/${peerId}/ice/${state.uid}`));
      set(candRef, event.candidate.toJSON());
      onDisconnect(candRef).remove();
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch (e) {} }
  };

  // Add local tracks
  if (state.localStream) {
    state.localStream.getTracks().forEach(tr => pc.addTrack(tr, state.localStream));
  }

  state.peers.set(peerId, pc);
  return pc;
}

async function makeOffer(peerId) {
  const pc = createPeerConnection(peerId);
  try {
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    // write offer to Firebase under signal/{peerId}/offer/{me}
    const offerRef = ref(db, `rooms/${state.roomId}/signal/${peerId}/offer/${state.uid}`);
    await set(offerRef, { type: offer.type, sdp: offer.sdp, from: state.uid });
    onDisconnect(offerRef).remove();
  } catch (e) {
    console.error('makeOffer failed', e);
  }
}

async function handleOffer(fromUid, offer) {
  let pc = state.peers.get(fromUid);
  if (!pc) {
    pc = createPeerConnection(fromUid);
  }
  try {
    if (pc.signalingState !== 'stable') {
      // glare - both created offers. Use polite behavior: accept incoming
      await pc.setRemoteDescription(offer);
    } else {
      await pc.setRemoteDescription(offer);
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const ansRef = ref(db, `rooms/${state.roomId}/signal/${fromUid}/answer/${state.uid}`);
    await set(ansRef, { type: answer.type, sdp: answer.sdp, from: state.uid });
    onDisconnect(ansRef).remove();
  } catch (e) {
    console.error('handleOffer failed', e);
  }
}

async function handleAnswer(fromUid, answer) {
  const pc = state.peers.get(fromUid);
  if (!pc) return;
  try {
    if (pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(answer);
    } else {
      await pc.setRemoteDescription(answer);
    }
  } catch (e) {
    console.error('handleAnswer failed', e);
  }
}

async function handleIceCandidate(fromUid, candidate) {
  const pc = state.peers.get(fromUid);
  if (!pc) return;
  try {
    await pc.addIceCandidate(candidate);
  } catch (e) {
    // may arrive before remote desc
  }
}

function closePeer(peerId) {
  const pc = state.peers.get(peerId);
  if (pc) { try { pc.close(); } catch (e) {} state.peers.delete(peerId); }
  state.remoteStreams.delete(peerId);
}

function closeAllPeers() {
  state.peers.forEach((pc) => { try { pc.close(); } catch (e) {} });
  state.peers.clear();
  state.remoteStreams.clear();
}

// Replace video track on all peers (for screen share)
function replaceVideoTrackOnAllPeers(newTrack) {
  state.peers.forEach((pc) => {
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(newTrack).catch(() => {});
  });
}

// ============================================================
// ROOM CREATE / JOIN
// ============================================================
async function createRoom() {
  const name = $('#create-name').value.trim();
  if (!name) { toast(t('nameRequired'), 'error'); return; }
  const password = $('#create-password').value.trim() || null;
  const waitingRoom = $('#create-waiting').checked;

  state.name = name;
  state.isHost = true;
  state.role = 'host';

  const roomCode = genCode();
  const roomId = `room_${genId()}`;
  state.roomId = roomId;
  state.roomCode = roomCode;

  const roomData = {
    hostId: state.uid,
    hostName: name,
    code: roomCode,
    locked: false,
    password: password,
    chatEnabled: true,
    screenShareEnabled: true,
    waitingRoomEnabled: !!waitingRoom,
    recordingActive: false,
    screenSharerId: null,
    createdAt: serverTimestamp(),
    participants: {},
    waitingRoom: {},
    chat: {},
    polls: {},
  };
  roomData.participants[state.uid] = {
    name, role: 'host', micOn: false, camOn: false,
    handRaised: false, isSharingScreen: false,
    joinedAt: Date.now(), avatarColor: pickColor(name),
  };

  await set(ref(db, `rooms/${roomId}`), roomData);
  // cleanup on disconnect
  onDisconnect(ref(db, `rooms/${roomId}/participants/${state.uid}`)).remove();
  onDisconnect(ref(db, `rooms/${roomId}/signal/${state.uid}`)).remove();
  // auto-transfer host or delete room
  onDisconnect(ref(db, `rooms/${roomId}`)).remove();

  state.startTime = Date.now();
  showView('lobby');
  await initLocalMedia();
  attachPreview();
}

async function joinRoom() {
  const name = $('#join-name').value.trim();
  const code = $('#join-code').value.trim().toLowerCase();
  const password = $('#join-password').value.trim();
  if (!name) { toast(t('nameRequired'), 'error'); return; }
  if (!code) { toast(t('codeRequired'), 'error'); return; }

  state.name = name;
  state.isHost = false;
  state.role = 'participant';

  // Find room by code
  const snapshot = await get(ref(db, 'rooms'));
  if (!snapshot.exists()) { toast(t('roomNotFound'), 'error'); return; }
  let foundRoomId = null;
  snapshot.forEach((child) => {
    if (child.val().code === code) foundRoomId = child.key;
  });
  if (!foundRoomId) { toast(t('roomNotFound'), 'error'); return; }
  state.roomId = foundRoomId;
  state.roomCode = code;

  const roomSnap = await get(ref(db, `rooms/${foundRoomId}`));
  const room = roomSnap.val();
  if (!room) { toast(t('roomNotFound'), 'error'); return; }
  if (room.locked) { toast(t('roomLocked'), 'error'); return; }
  if (room.password && room.password !== password) { toast(t('wrongPassword'), 'error'); return; }

  const participant = {
    name, role: 'participant', micOn: false, camOn: false,
    handRaised: false, isSharingScreen: false,
    joinedAt: Date.now(), avatarColor: pickColor(name),
  };

  if (room.waitingRoomEnabled && room.hostId !== state.uid) {
    // Add to waiting room
    await set(ref(db, `rooms/${foundRoomId}/waitingRoom/${state.uid}`), participant);
    onDisconnect(ref(db, `rooms/${foundRoomId}/waitingRoom/${state.uid}`)).remove();
    state.waiting = true;
    showView('waiting');
    listenForWaitingDecision();
    return;
  }

  await set(ref(db, `rooms/${foundRoomId}/participants/${state.uid}`), participant);
  onDisconnect(ref(db, `rooms/${foundRoomId}/participants/${state.uid}`)).remove();
  onDisconnect(ref(db, `rooms/${foundRoomId}/signal/${state.uid}`)).remove();

  state.startTime = Date.now();
  showView('lobby');
  await initLocalMedia();
  attachPreview();
}

// ============================================================
// WAITING ROOM
// ============================================================
function listenForWaitingDecision() {
  onValue(ref(db, `rooms/${state.roomId}/waitingRoom/${state.uid}`), (snap) => {
    if (!snap.exists() && state.waiting) {
      // Either admitted (now in participants) or denied
      get(ref(db, `rooms/${state.roomId}/participants/${state.uid}`)).then((p) => {
        if (p.exists()) {
          state.waiting = false;
          state.startTime = Date.now();
          showView('lobby');
          attachPreview();
        } else {
          toast(t('kicked'), 'error');
          cleanupAndLeave();
        }
      });
    }
  });
}

// ============================================================
// ENTER MEETING (from lobby)
// ============================================================
async function enterMeeting() {
  // sync mic/cam state
  const audio = state.localStream?.getAudioTracks()[0];
  const video = state.localStream?.getVideoTracks()[0];
  state.micOn = audio ? audio.enabled : false;
  state.camOn = video ? video.enabled : false;

  await update(ref(db, `rooms/${state.roomId}/participants/${state.uid}`), {
    micOn: state.micOn, camOn: state.camOn,
  });

  showView('meeting');
  startMeetingListeners();
  renderVideoGrid();
  buildControlBar();
  buildHostControls();
}

// ============================================================
// MEETING LISTENERS
// ============================================================
function startMeetingListeners() {
  // Room data
  onValue(ref(db, `rooms/${state.roomId}`), (snap) => {
    const room = snap.val();
    if (!room) {
      // Meeting ended
      toast(t('meetingEnded'), 'warning');
      cleanupAndLeave();
      return;
    }
    state.roomData = room;
    state.participants = room.participants || {};
    state.polls = room.polls || {};
    const me = state.participants[state.uid];

    if (!me) {
      // kicked or removed
      toast(t('kicked'), 'error');
      cleanupAndLeave();
      return;
    }

    state.role = me.role || 'participant';
    if (room.hostId === state.uid) state.role = 'host';

    // Sync UI
    $('#room-code-display').textContent = (room.code || 'XXXXXX').toUpperCase();
    $('#participant-count').textContent = Object.keys(state.participants).length;
    $('#p-count').textContent = Object.keys(state.participants).length;
    $('#lock-indicator').classList.toggle('hidden', !room.locked);
    $('#rec-indicator').classList.toggle('hidden', !room.recordingActive);

    // Initiate offers to existing participants (that aren't me and don't have a peer yet)
    Object.keys(state.participants).forEach((pid) => {
      if (pid === state.uid) return;
      if (!state.peers.has(pid)) {
        // Lower uid initiates offer to avoid glare
        if (state.uid < pid) makeOffer(pid);
      }
    });

    // Close peers who left
    Array.from(state.peers.keys()).forEach((pid) => {
      if (!state.participants[pid]) closePeer(pid);
    });

    renderVideoGrid();
    renderParticipants();
    renderPolls();
    buildHostControls();
  });

  // Listen for incoming signaling messages addressed to me
  onValue(ref(db, `rooms/${state.roomId}/signal/${state.uid}`), (snap) => {
    const signal = snap.val();
    if (!signal) return;
    // offers
    if (signal.offer) {
      Object.keys(signal.offer).forEach((fromUid) => {
        const offer = signal.offer[fromUid];
        if (offer && offer.sdp) handleOffer(fromUid, offer);
      });
    }
    // answers
    if (signal.answer) {
      Object.keys(signal.answer).forEach((fromUid) => {
        const ans = signal.answer[fromUid];
        if (ans && ans.sdp) handleAnswer(fromUid, ans);
      });
    }
    // ice candidates
    if (signal.ice) {
      Object.keys(signal.ice).forEach((fromUid) => {
        const cands = signal.ice[fromUid];
        if (!cands) return;
        Object.keys(cands).forEach((cid) => {
          const c = cands[cid];
          if (c) handleIceCandidate(fromUid, new RTCIceCandidate(c));
        });
      });
    }
  });

  // Chat
  onValue(ref(db, `rooms/${state.roomId}/chat`), (snap) => {
    const msgs = snap.val() || {};
    state.chatMessages = Object.entries(msgs).map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    renderChat();
  });

  // Timer
  state.timerInterval = setInterval(() => {
    if (state.startTime) {
      const s = Math.floor((Date.now() - state.startTime) / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      $('#timer').textContent = h > 0
        ? `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
    }
  }, 1000);
}

// ============================================================
// RENDER: VIDEO GRID
// ============================================================
function renderVideoGrid() {
  const grid = $('#video-grid');
  const participants = state.participants;
  const pids = Object.keys(participants);
  const count = pids.length;
  grid.className = `video-grid count-${count > 9 ? 'many' : count}`;

  // Sort: screen sharer first, then pinned, then host, then others
  const sorted = pids.sort((a, b) => {
    const pa = participants[a], pb = participants[b];
    if (pa.isSharingScreen && !pb.isSharingScreen) return -1;
    if (pb.isSharingScreen && !pa.isSharingScreen) return 1;
    if (state.pinnedId === a && state.pinnedId !== b) return -1;
    if (state.pinnedId === b && state.pinnedId !== a) return 1;
    if (pa.role === 'host' && pb.role !== 'host') return -1;
    if (pb.role === 'host' && pa.role !== 'host') return 1;
    return (pa.joinedAt || 0) - (pb.joinedAt || 0);
  });

  grid.innerHTML = sorted.map((pid) => {
    const p = participants[pid];
    const isMe = pid === state.uid;
    const stream = isMe ? (state.isSharingScreen ? state.screenStream : state.localStream) : state.remoteStreams.get(pid);
    const videoEl = stream ? `<video autoplay muted playsinline ${isMe && !state.isSharingScreen ? 'class="mirror"' : ''}></video>` : '';
    const showAvatar = !stream || (!p.camOn && !(isMe ? state.isSharingScreen : p.isSharingScreen));
    return `
      <div class="tile" data-pid="${pid}">
        ${videoEl}
        ${showAvatar ? `<div class="avatar-fallback" style="background:${p.avatarColor}">${initials(p.name)}</div>` : ''}
        ${p.role === 'host' ? `<span class="role-badge host">${t('host')}</span>` : ''}
        ${p.role === 'cohost' ? `<span class="role-badge cohost">${t('cohost')}</span>` : ''}
        ${(isMe ? state.isSharingScreen : p.isSharingScreen) ? `<span class="screen-badge">${t('shareScreen')}</span>` : ''}
        <div class="name-bar">
          <span class="name">${escapeHtml(p.name)}${isMe ? ` (${t('you')})` : ''}</span>
          <div class="icons">
            ${p.handRaised ? `<span class="icon-badge hand">✋</span>` : ''}
            ${!p.micOn ? `<span class="icon-badge mic-off"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M12 19v3"/></svg></span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach streams
  sorted.forEach((pid) => {
    const tile = grid.querySelector(`.tile[data-pid="${pid}"] video`);
    if (tile) {
      const isMe = pid === state.uid;
      const stream = isMe ? (state.isSharingScreen ? state.screenStream : state.localStream) : state.remoteStreams.get(pid);
      if (stream && tile.srcObject !== stream) tile.srcObject = stream;
    }
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ============================================================
// RENDER: CHAT
// ============================================================
function renderChat() {
  const container = $('#chat-messages');
  const messages = state.chatMessages || [];
  const chatDisabled = !state.roomData.chatEnabled;
  $('#chat-input').disabled = chatDisabled;
  $('#btn-send').disabled = chatDisabled;
  if (chatDisabled) $('#chat-input').placeholder = t('chatDisabled');
  else $('#chat-input').placeholder = t('typeMessage');

  container.innerHTML = messages.map((m) => {
    if (m.type === 'system') {
      return `<div class="chat-msg system"><div class="bubble">${escapeHtml(m.text)}</div></div>`;
    }
    const mine = m.senderId === state.uid;
    return `
      <div class="chat-msg ${mine ? 'mine' : ''}">
        ${!mine ? `<span class="sender">${escapeHtml(m.senderName)}</span>` : ''}
        <div class="bubble">${escapeHtml(m.text)}</div>
        <span class="time">${m.createdAt ? formatTime(m.createdAt) : ''}</span>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

// ============================================================
// RENDER: PARTICIPANTS
// ============================================================
function renderParticipants() {
  const list = $('#participants-list');
  const participants = state.participants;
  const pids = Object.keys(participants).sort((a, b) => {
    const pa = participants[a], pb = participants[b];
    if (pa.role === 'host' && pb.role !== 'host') return -1;
    if (pb.role === 'host' && pa.role !== 'host') return 1;
    if (pa.role === 'cohost' && pb.role !== 'cohost') return -1;
    if (pb.role === 'cohost' && pa.role !== 'cohost') return 1;
    return (pa.joinedAt || 0) - (pb.joinedAt || 0);
  });

  const canModerate = state.role === 'host' || state.role === 'cohost';
  const isHost = state.role === 'host';

  list.innerHTML = pids.map((pid) => {
    const p = participants[pid];
    const isMe = pid === state.uid;
    const canActOn = canModerate && !isMe && p.role !== 'host';
    return `
      <div class="participant-row" data-pid="${pid}">
        <div class="pavatar" style="background:${p.avatarColor}">${initials(p.name)}</div>
        <div class="info">
          <div class="name">${escapeHtml(p.name)}${isMe ? ` <span style="color:var(--text-muted);font-size:11px">(${t('you')})</span>` : ''}</div>
          <div class="status">
            ${!p.micOn ? '🔇' : ''} ${p.handRaised ? '✋' : ''} ${p.isSharingScreen ? '🖥️' : ''}
          </div>
        </div>
        ${canActOn ? `
          <div class="actions">
            <button class="icon-btn" data-action="mute" data-pid="${pid}" title="${t('mute')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M12 19v3"/></svg>
            </button>
            <button class="icon-btn" data-action="kick" data-pid="${pid}" title="${t('kick')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/></svg>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Waiting room list
  const waiting = state.roomData.waitingRoom || {};
  const waitingHtml = Object.keys(waiting).map((wid) => {
    const w = waiting[wid];
    if (!isHost) return '';
    return `
      <div class="participant-row" data-pid="${wid}" data-waiting="1">
        <div class="pavatar" style="background:${w.avatarColor}">${initials(w.name)}</div>
        <div class="info"><div class="name">${escapeHtml(w.name)}</div><div class="status">${t('waitingRoom')}</div></div>
        <div class="actions" style="opacity:1">
          <button class="btn btn-primary" data-action="admit" data-pid="${wid}" style="padding:6px 12px;font-size:12px">${t('admit')}</button>
          <button class="btn btn-ghost" data-action="deny" data-pid="${wid}" style="padding:6px 12px;font-size:12px">${t('deny')}</button>
        </div>
      </div>
    `;
  }).join('');
  if (waitingHtml) {
    list.innerHTML = `<div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">${t('waitingRoom')}</div>` + waitingHtml + list.innerHTML;
  }

  // Wire actions
  list.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const pid = btn.dataset.pid;
      handleParticipantAction(action, pid);
    });
  });
}

async function handleParticipantAction(action, pid) {
  const roomRef = ref(db, `rooms/${state.roomId}`);
  if (action === 'mute') {
    await update(child(roomRef, `participants/${pid}`), { micOn: false });
    toast('Muted', 'success');
  } else if (action === 'kick') {
    await remove(child(roomRef, `participants/${pid}`));
    await remove(child(roomRef, `signal/${pid}`));
    toast('Removed', 'success');
  } else if (action === 'admit') {
    const wSnap = await get(child(roomRef, `waitingRoom/${pid}`));
    if (wSnap.exists()) {
      const w = wSnap.val();
      await set(child(roomRef, `participants/${pid}`), w);
      await remove(child(roomRef, `waitingRoom/${pid}`));
    }
  } else if (action === 'deny') {
    await remove(child(roomRef, `waitingRoom/${pid}`));
  }
}

// ============================================================
// RENDER: POLLS
// ============================================================
function renderPolls() {
  const container = $('#polls-list');
  const polls = state.polls || {};
  const pollArr = Object.entries(polls).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const isHost = state.role === 'host';

  let html = '';
  if (isHost) {
    html += `
      <div class="create-poll">
        <input type="text" class="input" id="poll-question" placeholder="${t('pollQuestion')}" />
        <div id="poll-options-list">
          <div class="option-row"><input type="text" class="input poll-option-input" placeholder="${t('pollOptions')} 1" /></div>
          <div class="option-row"><input type="text" class="input poll-option-input" placeholder="${t('pollOptions')} 2" /></div>
        </div>
        <button class="btn btn-outline" id="add-poll-option" style="width:100%;margin-bottom:8px;padding:8px;font-size:13px">+ ${t('addOption')}</button>
        <button class="btn btn-primary" id="start-poll-btn">${t('startPoll')}</button>
      </div>
    `;
  }

  html += pollArr.map((poll) => {
    const total = (poll.votes || []).reduce((a, b) => a + b, 0);
    const myVote = (poll.voters && poll.voters[state.uid]) || false;
    return `
      <div class="poll-card" data-pid="${poll.id}">
        <div class="question">${escapeHtml(poll.question)}</div>
        ${(poll.options || []).map((opt, i) => {
          const v = (poll.votes || [])[i] || 0;
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return `
            <div class="poll-option" data-opt="${i}" data-poll="${poll.id}">
              <div class="bar" style="width:${pct}%"></div>
              <span class="text">${escapeHtml(opt)}</span>
              <span class="pct">${v} · ${pct}%</span>
            </div>
          `;
        }).join('')}
        <div class="poll-meta">${total} ${t('votes')}${poll.closed ? ` · ${state.lang === 'bn' ? 'বন্ধ' : 'closed'}` : ''}</div>
        ${isHost && !poll.closed ? `<button class="btn btn-ghost" data-close-poll="${poll.id}" style="padding:4px 8px;font-size:11px;margin-top:6px">${t('closePoll')}</button>` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Wire create poll
  const addOptBtn = $('#add-poll-option');
  if (addOptBtn) {
    addOptBtn.addEventListener('click', () => {
      const list = $('#poll-options-list');
      const div = document.createElement('div');
      div.className = 'option-row';
      const idx = list.children.length + 1;
      div.innerHTML = `<input type="text" class="input poll-option-input" placeholder="${t('pollOptions')} ${idx}" />`;
      list.appendChild(div);
    });
  }
  const startBtn = $('#start-poll-btn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      const q = $('#poll-question').value.trim();
      const opts = Array.from(document.querySelectorAll('.poll-option-input')).map(i => i.value.trim()).filter(Boolean);
      if (!q || opts.length < 2) { toast('Question + 2 options required', 'error'); return; }
      const pollRef = push(ref(db, `rooms/${state.roomId}/polls`));
      await set(pollRef, {
        question: q, options: opts,
        votes: new Array(opts.length).fill(0),
        voters: {}, createdAt: Date.now(), closed: false,
      });
    });
  }
  // Wire voting
  container.querySelectorAll('.poll-option[data-opt]').forEach((el) => {
    el.addEventListener('click', async () => {
      const pollId = el.dataset.poll;
      const optIdx = parseInt(el.dataset.opt, 10);
      const poll = state.polls[pollId];
      if (!poll || poll.closed) return;
      if (poll.voters && poll.voters[state.uid]) return;
      const newVotes = [...(poll.votes || [])];
      newVotes[optIdx] = (newVotes[optIdx] || 0) + 1;
      const newVoters = { ...(poll.voters || {}), [state.uid]: optIdx };
      await update(ref(db, `rooms/${state.roomId}/polls/${pollId}`), { votes: newVotes, voters: newVoters });
    });
  });
  // Wire close poll
  container.querySelectorAll('[data-close-poll]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.closePoll;
      await update(ref(db, `rooms/${state.roomId}/polls/${pid}`), { closed: true });
    });
  });
}

// ============================================================
// RENDER: HOST CONTROLS
// ============================================================
function buildHostControls() {
  const container = $('#host-controls');
  if (state.role !== 'host') {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  const r = state.roomData;
  container.innerHTML = `
    <button class="host-btn" id="hc-mute-all"><span>🔇</span> ${t('muteAll')}</button>
    <button class="host-btn ${r.locked ? 'active' : ''}" id="hc-lock"><span>🔒</span> ${r.locked ? t('unlockMeeting') : t('lockMeeting')}</button>
    <button class="host-btn ${!r.chatEnabled ? 'active' : ''}" id="hc-chat"><span>💬</span> ${r.chatEnabled ? t('disableChat') : t('enableChat')}</button>
    <button class="host-btn ${!r.screenShareEnabled ? 'active' : ''}" id="hc-screen"><span>🖥️</span> ${r.screenShareEnabled ? t('disableScreen') : t('enableScreen')}</button>
    <button class="host-btn ${r.waitingRoomEnabled ? 'active' : ''}" id="hc-waiting"><span>⏳</span> ${r.waitingRoomEnabled ? t('disableWaitingRoom') : t('enableWaitingRoom')}</button>
    <button class="host-btn danger ${r.recordingActive ? 'active' : ''}" id="hc-record"><span>●</span> ${r.recordingActive ? t('stopRecording') : t('startRecording')}</button>
  `;
  $('#hc-mute-all').addEventListener('click', muteAll);
  $('#hc-lock').addEventListener('click', () => update(ref(db, `rooms/${state.roomId}`), { locked: !r.locked }));
  $('#hc-chat').addEventListener('click', () => update(ref(db, `rooms/${state.roomId}`), { chatEnabled: !r.chatEnabled }));
  $('#hc-screen').addEventListener('click', () => update(ref(db, `rooms/${state.roomId}`), { screenShareEnabled: !r.screenShareEnabled }));
  $('#hc-waiting').addEventListener('click', () => update(ref(db, `rooms/${state.roomId}`), { waitingRoomEnabled: !r.waitingRoomEnabled }));
  $('#hc-record').addEventListener('click', () => update(ref(db, `rooms/${state.roomId}`), { recordingActive: !r.recordingActive }));
}

async function muteAll() {
  const updates = {};
  Object.keys(state.participants).forEach((pid) => {
    if (pid !== state.uid) updates[`participants/${pid}/micOn`] = false;
  });
  await update(ref(db, `rooms/${state.roomId}`), updates);
}

// ============================================================
// CONTROL BAR
// ============================================================
function buildControlBar() {
  const bar = $('#control-bar');
  const isHost = state.role === 'host';
  bar.innerHTML = `
    <button class="ctrl-btn ${state.micOn ? 'active' : ''}" id="cb-mic" title="${state.micOn ? t('mute') : t('unmute')} (M)">
      ${state.micOn
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M12 19v3"/></svg>'}
    </button>
    <button class="ctrl-btn ${state.camOn ? 'active' : ''}" id="cb-cam" title="${state.camOn ? t('videoOff') : t('videoOn')} (V)">
      ${state.camOn
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'}
    </button>
    <button class="ctrl-btn ${state.isSharingScreen ? 'active' : ''}" id="cb-screen" title="${state.isSharingScreen ? t('stopShare') : t('shareScreen')} (S)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 19v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2M5 19H3v-2a2 2 0 0 1 2-2M19 19h2v-2a2 2 0 0 0-2-2M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/></svg>
    </button>
    <button class="ctrl-btn ${state.handRaised ? 'warn' : ''}" id="cb-hand" title="${state.handRaised ? t('lowerHand') : t('raiseHand')} (R)">
      <span style="font-size:18px">✋</span>
    </button>
    <button class="ctrl-btn" id="cb-react" title="${t('react')} (E)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>
    </button>
    <button class="ctrl-btn" id="cb-chat" title="${t('chat')} (C)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
    <button class="ctrl-btn" id="cb-participants" title="${t('participants')} (P)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span class="badge">${Object.keys(state.participants).length}</span>
    </button>
    <button class="ctrl-btn" id="cb-polls" title="${t('polls')}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
    </button>
    <button class="ctrl-btn danger" id="cb-leave" title="${isHost ? t('endForAll') : t('leave')} (L)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
    </button>
  `;

  $('#cb-mic').addEventListener('click', toggleMic);
  $('#cb-cam').addEventListener('click', toggleCam);
  $('#cb-screen').addEventListener('click', toggleScreenShare);
  $('#cb-hand').addEventListener('click', toggleHand);
  $('#cb-react').addEventListener('click', toggleReactionsPopover);
  $('#cb-chat').addEventListener('click', () => openPanel('chat'));
  $('#cb-participants').addEventListener('click', () => openPanel('participants'));
  $('#cb-polls').addEventListener('click', () => openPanel('polls'));
  $('#cb-leave').addEventListener('click', leaveMeeting);
}

function toggleMic() {
  const audio = state.localStream?.getAudioTracks()[0];
  if (!audio) return;
  audio.enabled = !audio.enabled;
  state.micOn = audio.enabled;
  update(ref(db, `rooms/${state.roomId}/participants/${state.uid}`), { micOn: state.micOn });
  buildControlBar();
}

function toggleCam() {
  const video = state.localStream?.getVideoTracks()[0];
  if (!video) return;
  video.enabled = !video.enabled;
  state.camOn = video.enabled;
  update(ref(db, `rooms/${state.roomId}/participants/${state.uid}`), { camOn: state.camOn });
  buildControlBar();
  renderVideoGrid();
}

function toggleHand() {
  state.handRaised = !state.handRaised;
  update(ref(db, `rooms/${state.roomId}/participants/${state.uid}`), { handRaised: state.handRaised });
  buildControlBar();
  if (state.handRaised) playSound('hand');
}

async function toggleScreenShare() {
  if (state.isSharingScreen) {
    stopScreenShare();
    return;
  }
  if (!state.roomData.screenShareEnabled && state.role !== 'host') {
    toast(t('chatDisabled'), 'error'); return;
  }
  if (state.roomData.screenSharerId && state.roomData.screenSharerId !== state.uid) {
    toast(t('screenBusy'), 'error'); return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
    state.screenStream = stream;
    state.isSharingScreen = true;
    const screenTrack = stream.getVideoTracks()[0];
    replaceVideoTrackOnAllPeers(screenTrack);
    screenTrack.onended = () => stopScreenShare();
    await update(ref(db, `rooms/${state.roomId}`), { screenSharerId: state.uid });
    await update(ref(db, `rooms/${state.roomId}/participants/${state.uid}`), { isSharingScreen: true });
    buildControlBar();
    renderVideoGrid();
  } catch (e) {
    if (e.name !== 'NotAllowedError') console.error('screen share failed', e);
  }
}

async function stopScreenShare() {
  if (state.screenStream) state.screenStream.getTracks().forEach(tr => tr.stop());
  state.screenStream = null;
  state.isSharingScreen = false;
  const cam = state.localStream?.getVideoTracks()[0];
  if (cam) replaceVideoTrackOnAllPeers(cam);
  await update(ref(db, `rooms/${state.roomId}`), { screenSharerId: null });
  await update(ref(db, `rooms/${state.roomId}/participants/${state.uid}`), { isSharingScreen: false });
  buildControlBar();
  renderVideoGrid();
}

function toggleReactionsPopover() {
  const pop = $('#reactions-popover');
  pop.classList.toggle('hidden');
  if (!pop.dataset.built) {
    pop.innerHTML = ['👍','❤️','😂','👏','🎉','🔥','😮','🙌','😢','💯','✋','🤔']
      .map(e => `<button data-emoji="${e}">${e}</button>`).join('');
    pop.querySelectorAll('[data-emoji]').forEach((b) => {
      b.addEventListener('click', () => {
        sendReaction(b.dataset.emoji);
        pop.classList.add('hidden');
      });
    });
    pop.dataset.built = '1';
  }
}

async function sendReaction(emoji) {
  const rRef = push(ref(db, `rooms/${state.roomId}/chat`));
  await set(rRef, {
    senderId: state.uid, senderName: state.name,
    text: emoji, type: 'reaction',
    createdAt: Date.now(),
  });
}

// ============================================================
// PANELS
// ============================================================
function openPanel(name) {
  state.activePanel = name;
  $$('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  $$('.panel-section').forEach(s => s.classList.toggle('active', s.id === `panel-${name}`));
  // mobile: open drawer
  if (window.innerWidth <= 768) {
    $('#side-panel').classList.add('open');
    state.panelOpen = true;
    let backdrop = document.querySelector('.side-panel-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'side-panel-backdrop';
      backdrop.addEventListener('click', closePanel);
      document.body.appendChild(backdrop);
    }
  }
}
function closePanel() {
  $('#side-panel').classList.remove('open');
  state.panelOpen = false;
  document.querySelector('.side-panel-backdrop')?.remove();
}

// ============================================================
// CHAT SEND
// ============================================================
async function sendChat() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (!state.roomData.chatEnabled && state.role !== 'host') {
    toast(t('chatDisabled'), 'error'); return;
  }
  const rRef = push(ref(db, `rooms/${state.roomId}/chat`));
  await set(rRef, {
    senderId: state.uid, senderName: state.name,
    text, type: 'text', createdAt: Date.now(),
  });
  input.value = '';
}

// ============================================================
// LEAVE / CLEANUP
// ============================================================
async function leaveMeeting() {
  if (!confirm(t('confirmLeave'))) return;
  await cleanupAndLeave();
}

async function cleanupAndLeave() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  closeAllPeers();
  if (state.screenStream) state.screenStream.getTracks().forEach(tr => tr.stop());
  if (state.localStream) state.localStream.getTracks().forEach(tr => tr.stop());
  state.localStream = null;
  state.screenStream = null;
  state.isSharingScreen = false;

  if (state.roomId) {
    // Remove self from participants
    await remove(ref(db, `rooms/${state.roomId}/participants/${state.uid}`));
    await remove(ref(db, `rooms/${state.roomId}/waitingRoom/${state.uid}`));
    await remove(ref(db, `rooms/${state.roomId}/signal/${state.uid}`));

    // If host: transfer to first remaining participant, or delete room
    const snap = await get(ref(db, `rooms/${state.roomId}`));
    const room = snap.val();
    if (room) {
      const remaining = Object.keys(room.participants || {});
      if (remaining.length > 0) {
        const newHostId = remaining[0];
        await update(ref(db, `rooms/${state.roomId}`), { hostId: newHostId });
        await update(ref(db, `rooms/${state.roomId}/participants/${newHostId}`), { role: 'host' });
        // system message
        const mRef = push(ref(db, `rooms/${state.roomId}/chat`));
        await set(mRef, {
          senderId: 'system', senderName: 'System',
          text: `${room.participants[newHostId].name} is now the host`,
          type: 'system', createdAt: Date.now(),
        });
      } else {
        await remove(ref(db, `rooms/${state.roomId}`));
      }
    }
  }
  state.roomId = null;
  state.roomCode = '';
  state.isHost = false;
  state.role = 'participant';
  state.participants = {};
  closePanel();
  showView('landing');
}

async function endMeetingForAll() {
  if (!confirm(t('confirmEnd'))) return;
  if (state.roomId) {
    await remove(ref(db, `rooms/${state.roomId}`));
  }
  await cleanupAndLeave();
}

// ============================================================
// LOBBY PREVIEW
// ============================================================
function attachPreview() {
  const video = $('#preview-video');
  const avatar = $('#preview-avatar');
  const circle = $('#preview-avatar-circle');
  circle.textContent = initials(state.name);
  circle.style.background = `linear-gradient(135deg, ${pickColor(state.name)}, var(--accent))`;

  if (state.localStream) {
    video.srcObject = state.localStream;
    video.style.display = 'block';
    avatar.classList.add('hidden');
  } else {
    video.style.display = 'none';
    avatar.classList.remove('hidden');
  }

  // mic/cam toggles
  const micBtn = $('#lobby-mic');
  const camBtn = $('#lobby-cam');
  micBtn.classList.add('off');
  camBtn.classList.add('off');
  micBtn.onclick = () => {
    const audio = state.localStream?.getAudioTracks()[0];
    if (!audio) return;
    audio.enabled = !audio.enabled;
    micBtn.classList.toggle('off', !audio.enabled);
  };
  camBtn.onclick = () => {
    const v = state.localStream?.getVideoTracks()[0];
    if (!v) return;
    v.enabled = !v.enabled;
    camBtn.classList.toggle('off', !v.enabled);
    if (v.enabled) { video.style.display = 'block'; avatar.classList.add('hidden'); }
    else { video.style.display = 'none'; avatar.classList.remove('hidden'); }
  };
}

// ============================================================
// FEATURES GRID
// ============================================================
function renderFeatures() {
  const grid = $('#features-grid');
  const icons = ['👥','🛡️','💬','🖥️','📊','🌐'];
  grid.innerHTML = ['f1','f2','f3','f4','f5','f6'].map((k, i) => {
    const [title, desc] = I18N[state.lang][k];
    return `
      <div class="feature">
        <div class="icon">${icons[i]}</div>
        <h3>${title}</h3>
        <p>${desc}</p>
      </div>
    `;
  }).join('');
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ($('#view-meeting').classList.contains('active')) {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'm') { e.preventDefault(); toggleMic(); }
      else if (k === 'v') { e.preventDefault(); toggleCam(); }
      else if (k === 'r') { e.preventDefault(); toggleHand(); }
      else if (k === 's') { e.preventDefault(); toggleScreenShare(); }
      else if (k === 'c') { e.preventDefault(); openPanel('chat'); }
      else if (k === 'p') { e.preventDefault(); openPanel('participants'); }
      else if (k === 'e') { e.preventDefault(); toggleReactionsPopover(); }
      else if (k === 'l') { e.preventDefault(); leaveMeeting(); }
    }
  });
}

// ============================================================
// THEME
// ============================================================
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const icon = $('#theme-icon');
  if (state.theme === 'light') {
    document.documentElement.style.setProperty('--bg', '#f5f7f6');
    document.documentElement.style.setProperty('--bg-soft', '#ffffff');
    document.documentElement.style.setProperty('--card', '#ffffff');
    document.documentElement.style.setProperty('--card-soft', '#f0f4f2');
    document.documentElement.style.setProperty('--border', '#e2e8e5');
    document.documentElement.style.setProperty('--text', '#1a2520');
    document.documentElement.style.setProperty('--text-muted', '#64746e');
    icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
  } else {
    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--bg-soft');
    document.documentElement.style.removeProperty('--card');
    document.documentElement.style.removeProperty('--card-soft');
    document.documentElement.style.removeProperty('--border');
    document.documentElement.style.removeProperty('--text');
    document.documentElement.style.removeProperty('--text-muted');
    icon.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  }
}

// ============================================================
// INIT
// ============================================================
async function init() {
  applyI18n();
  renderFeatures();
  applyTheme();
  setupKeyboardShortcuts();

  // Language toggle
  $$('.lang-toggle button').forEach((b) => {
    b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      localStorage.setItem('meethost-lang', state.lang);
      applyI18n();
      renderFeatures();
      buildControlBar();
      buildHostControls();
      renderParticipants();
      renderPolls();
    });
  });

  // Theme toggle
  $('#theme-toggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('meethost-theme', state.theme);
    applyTheme();
  });

  // Tabs
  $$('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.tab-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $$('.tab-panel').forEach(p => p.classList.add('hidden'));
      $(`#panel-${b.dataset.tab}`).classList.remove('hidden');
    });
  });

  // Create / Join buttons
  $('#btn-create').addEventListener('click', async () => {
    try { await initAuth(); await createRoom(); } catch (e) { /* toast shown in initAuth */ }
  });
  $('#btn-join').addEventListener('click', async () => {
    try { await initAuth(); await joinRoom(); } catch (e) { /* toast shown in initAuth */ }
  });
  $('#create-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-create').click(); });
  $('#join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
  $('#join-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#join-code').focus(); });

  // Lobby
  $('#btn-enter').addEventListener('click', enterMeeting);
  $('#btn-lobby-cancel').addEventListener('click', async () => {
    if (state.localStream) state.localStream.getTracks().forEach(tr => tr.stop());
    state.localStream = null;
    if (state.roomId) {
      await remove(ref(db, `rooms/${state.roomId}/participants/${state.uid}`));
      await remove(ref(db, `rooms/${state.roomId}/waitingRoom/${state.uid}`));
    }
    state.roomId = null;
    showView('landing');
  });

  // Waiting cancel
  $('#btn-waiting-cancel').addEventListener('click', async () => {
    if (state.roomId) await remove(ref(db, `rooms/${state.roomId}/waitingRoom/${state.uid}`));
    state.roomId = null;
    state.waiting = false;
    showView('landing');
  });

  // Copy buttons
  $('#copy-code').addEventListener('click', () => {
    navigator.clipboard?.writeText(state.roomCode.toUpperCase());
    toast(t('copied'), 'success');
  });
  $('#copy-link').addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
    navigator.clipboard?.writeText(url);
    toast(t('copied'), 'success');
  });

  // Chat send
  $('#btn-send').addEventListener('click', sendChat);
  $('#chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

  // Panel tabs
  $$('.panel-tab').forEach((t) => {
    t.addEventListener('click', () => openPanel(t.dataset.panel));
  });

  // Mobile panel toggle
  $('#open-panel-mobile').addEventListener('click', () => openPanel(state.activePanel));

  // Reactions overlay listener
  onValue(ref(db, `rooms/${state.roomId}/chat`), () => {}); // placeholder, real listener set in startMeetingListeners

  // Auto-fill join code from URL
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="join"]').classList.add('active');
    $$('.tab-panel').forEach(p => p.classList.add('hidden'));
    $('#panel-join').classList.remove('hidden');
    $('#join-code').value = roomParam.toUpperCase();
    $('#join-name').focus();
  }

  // Show auth warning if not configured
  console.log('MeetHost initialized. Firebase project: softmax-10bd4');
}

init();
