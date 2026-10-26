// app.js - Client Controller & Real-Time Sync
(function () {
  'use strict';

  // Room identification from URL query parameter ?room=xyz
  const urlParams = new URLSearchParams(window.location.search);
  let currentRoom = (urlParams.get('room') || 'main').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'main';

  // DOM Elements
  const wheelCanvas = document.getElementById('wheelCanvas');
  const centerSpinBtn = document.getElementById('centerSpinBtn');
  const actionStatus = document.getElementById('actionStatus');
  const viewerCountEl = document.getElementById('viewerCount');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const currentRoomLabel = document.getElementById('currentRoomLabel');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const soundVolumeSlider = document.getElementById('soundVolume');
  const volumeVal = document.getElementById('volumeVal');
  const spinDurationSlider = document.getElementById('spinDuration');
  const durationVal = document.getElementById('durationVal');

  // Items Elements
  const itemCountEl = document.getElementById('itemCount');
  const newItemInput = document.getElementById('newItemInput');
  const addItemBtn = document.getElementById('addItemBtn');
  const bulkItemsInput = document.getElementById('bulkItemsInput');
  const bulkAppendBtn = document.getElementById('bulkAppendBtn');
  const bulkReplaceBtn = document.getElementById('bulkReplaceBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
  const itemsListEl = document.getElementById('itemsList');

  // History Elements
  const historyListEl = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Room Setting Elements
  const roomInput = document.getElementById('roomInput');
  const joinRoomBtn = document.getElementById('joinRoomBtn');

  // Modal Elements
  const winnerModal = document.getElementById('winnerModal');
  const modalWinnerName = document.getElementById('modalWinnerName');
  const modalRemoveBtn = document.getElementById('modalRemoveBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  // State
  let ws = null;
  let clockOffset = 0; // serverTime - localClientTime
  let currentItems = [];
  let lastWinner = null;
  const wheel = new WheelRenderer('wheelCanvas');

  // Color Palette for new items
  const PALETTE = [
    '#FF4D4D', '#FF9F1C', '#FFD166', '#06D6A0',
    '#118AB2', '#8338EC', '#3A86FF', '#EF476F',
    '#00B4D8', '#7209B7', '#4CC9F0', '#F72585'
  ];

  currentRoomLabel.textContent = currentRoom;
  roomInput.value = currentRoom;

  // Initialize Audio & Sound
  soundVolumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    volumeVal.textContent = Math.round(val * 100) + '%';
    window.soundManager.setVolume(val);
  });

  soundToggleBtn.addEventListener('click', () => {
    const enabled = window.soundManager.toggleSound();
    soundIcon.textContent = enabled ? '🔊' : '🔇';
  });

  spinDurationSlider.addEventListener('input', (e) => {
    durationVal.textContent = parseFloat(e.target.value).toFixed(1) + ' วินาที';
  });

  // Share / Copy Link
  copyLinkBtn.addEventListener('click', async () => {
    const shareUrl = window.location.origin + window.location.pathname + '?room=' + encodeURIComponent(currentRoom);
    try {
      await navigator.clipboard.writeText(shareUrl);
      const originalText = copyLinkBtn.querySelector('.btn-text').textContent;
      copyLinkBtn.querySelector('.btn-text').textContent = 'คัดลอกแล้ว!';
      copyLinkBtn.style.background = '#10b981';
      setTimeout(() => {
        copyLinkBtn.querySelector('.btn-text').textContent = originalText;
        copyLinkBtn.style.background = '';
      }, 2000);
    } catch (e) {
      prompt('คัดลอกลิงก์ห้องนี้เพื่อส่งให้เพื่อน:', shareUrl);
    }
  });

  // Switch Room
  joinRoomBtn.addEventListener('click', () => {
    const newRoom = (roomInput.value || 'main').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'main';
    if (newRoom !== currentRoom) {
      window.location.search = '?room=' + encodeURIComponent(newRoom);
    }
  });

  roomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoomBtn.click();
  });

  // Tabs Switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById('tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1));
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // WebSocket Connection & Synchronization
  function connectWS() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws?room=${encodeURIComponent(currentRoom)}`;

    statusBadge.className = 'badge-status';
    statusText.textContent = 'กำลังเชื่อมต่อ...';

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      statusBadge.className = 'badge-status online';
      statusText.textContent = 'เชื่อมต่อสด';
      startClockSync();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onclose = () => {
      statusBadge.className = 'badge-status offline';
      statusText.textContent = 'หลุดการเชื่อมต่อ (กำลังต่อใหม่...)';
      setTimeout(connectWS, 2500);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error:', err);
      ws.close();
    };
  }

  // Measure latency & offset to server clock
  function startClockSync() {
    function ping() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', clientTime: Date.now() }));
      }
    }
    ping();
    setInterval(ping, 6000);
  }

  function getSyncedNow() {
    return Date.now() + clockOffset;
  }

  // Handle Incoming Server Events
  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'pong': {
        const clientNow = Date.now();
        const rtt = clientNow - msg.clientTime;
        // Estimated server time at receipt: msg.serverTime + rtt / 2
        clockOffset = (msg.serverTime + rtt / 2) - clientNow;
        break;
      }

      case 'sync': {
        currentItems = msg.items || [];
        wheel.setItems(currentItems);
        renderItemsList();
        viewerCountEl.textContent = msg.viewerCount || 1;
        renderHistoryList(msg.history || []);

        if (msg.state === 'spinning' && msg.spinData) {
          wheel.spinData = msg.spinData;
          wheel.isSpinning = true;
          setSpinningUI(true);
        } else {
          wheel.currentAngle = msg.currentAngle || 0;
          wheel.isSpinning = false;
          setSpinningUI(false);
        }
        break;
      }

      case 'viewer_count': {
        viewerCountEl.textContent = msg.count || 1;
        break;
      }

      case 'spin_start': {
        // Unlock Web Audio on user device if not started
        window.soundManager.init();

        wheel.spinData = msg.spinData;
        wheel.isSpinning = true;
        setSpinningUI(true);
        actionStatus.textContent = '🎡 กำลังหมุน... ผู้ชมทุกคนกำลังเห็นภาพเดียวกันแบบ Real-Time!';
        actionStatus.className = 'status-callout spinning';
        closeModal();
        break;
      }

      case 'spin_complete': {
        lastWinner = msg.winnerItem;
        wheel.isSpinning = false;
        wheel.currentAngle = msg.finalAngle;
        setSpinningUI(false);

        // Announce Winner
        actionStatus.textContent = `🎉 ผลที่ออกคือ: "${msg.winnerItem}"`;
        actionStatus.className = 'status-callout winner';

        // Play Win Fanfare & Blast Confetti
        window.soundManager.playWin();
        window.confettiCannon.fire(4500);

        // Show Modal Dialog
        showModal(msg.winnerItem);

        // Add to history
        if (msg.winnerRecord) {
          prependHistoryItem(msg.winnerRecord);
        }
        break;
      }

      case 'items_updated': {
        currentItems = msg.items || [];
        wheel.setItems(currentItems);
        renderItemsList();
        if (msg.notice) {
          actionStatus.textContent = msg.notice;
        }
        break;
      }

      case 'history_cleared': {
        renderHistoryList([]);
        break;
      }

      case 'error': {
        alert(msg.message || 'เกิดข้อผิดพลาด');
        break;
      }
    }
  }

  function setSpinningUI(spinning) {
    centerSpinBtn.disabled = spinning;
    if (spinning) {
      centerSpinBtn.querySelector('.spin-btn-label').textContent = 'กำลังหมุน';
      centerSpinBtn.querySelector('.spin-btn-sub').textContent = 'WAIT';
    } else {
      centerSpinBtn.querySelector('.spin-btn-label').textContent = 'หมุนเลย!';
      centerSpinBtn.querySelector('.spin-btn-sub').textContent = 'SPIN';
    }
  }

  // Trigger Spin Request
  centerSpinBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('ยังไม่ได้เชื่อมต่อกับเซิร์ฟเวอร์');
      return;
    }
    if (currentItems.length === 0) {
      alert('กรุณาเพิ่มรายการในวงล้อก่อนหมุน');
      return;
    }

    const duration = parseFloat(spinDurationSlider.value) * 1000;
    ws.send(JSON.stringify({
      type: 'spin_request',
      duration
    }));
  });

  // Wheel Callback on finish
  wheel.onSpinFinish = (winnerIdx, winnerItem) => {
    // Handled mainly by server 'spin_complete' for strict synchronization
  };

  // Continuous animation loop
  function loop() {
    wheel.update(getSyncedNow());
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ================= ITEMS MANAGEMENT =================
  function renderItemsList() {
    itemCountEl.textContent = currentItems.length;
    itemsListEl.innerHTML = '';

    currentItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'item-row';

      const colorBox = document.createElement('div');
      colorBox.className = 'item-color-preview';
      colorBox.style.backgroundColor = item.color;

      const text = document.createElement('span');
      text.className = 'item-text';
      text.textContent = item.label;

      const delBtn = document.createElement('button');
      delBtn.className = 'item-delete-btn';
      delBtn.innerHTML = '✖';
      delBtn.title = 'ลบรายการนี้';
      delBtn.addEventListener('click', () => {
        deleteItem(index);
      });

      row.appendChild(colorBox);
      row.appendChild(text);
      row.appendChild(delBtn);
      itemsListEl.appendChild(row);
    });
  }

  function addItem() {
    const text = (newItemInput.value || '').trim();
    if (!text) return;

    const newItem = {
      id: 'item_' + Date.now() + '_' + currentItems.length,
      label: text,
      color: PALETTE[currentItems.length % PALETTE.length]
    };

    const nextItems = [...currentItems, newItem];
    sendItemsUpdate(nextItems);
    newItemInput.value = '';
    newItemInput.focus();
  }

  function deleteItem(index) {
    const nextItems = currentItems.filter((_, idx) => idx !== index);
    sendItemsUpdate(nextItems);
  }

  function sendItemsUpdate(items) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'update_items',
      items
    }));
  }

  addItemBtn.addEventListener('click', addItem);
  newItemInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addItem();
  });

  // Shuffle Items
  shuffleBtn.addEventListener('click', () => {
    if (currentItems.length <= 1) return;
    const shuffled = [...currentItems];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    sendItemsUpdate(shuffled);
  });

  // Reset to Defaults
  resetDefaultsBtn.addEventListener('click', () => {
    if (confirm('ต้องการรีเซ็ตกลับเป็นรายการเริ่มต้นหรือไม่?')) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reset_wheel' }));
      }
    }
  });

  // Bulk Add
  bulkAppendBtn.addEventListener('click', () => {
    const lines = (bulkItemsInput.value || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) return;

    const newEntries = lines.map((label, idx) => ({
      id: 'item_' + Date.now() + '_' + (currentItems.length + idx),
      label,
      color: PALETTE[(currentItems.length + idx) % PALETTE.length]
    }));

    sendItemsUpdate([...currentItems, ...newEntries]);
    bulkItemsInput.value = '';
  });

  bulkReplaceBtn.addEventListener('click', () => {
    const lines = (bulkItemsInput.value || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) return;

    const newEntries = lines.map((label, idx) => ({
      id: 'item_' + Date.now() + '_' + idx,
      label,
      color: PALETTE[idx % PALETTE.length]
    }));

    if (confirm(`แทนที่รายการทั้งหมดด้วย ${newEntries.length} รายการนี้?`)) {
      sendItemsUpdate(newEntries);
      bulkItemsInput.value = '';
    }
  });

  // ================= HISTORY =================
  function renderHistoryList(history) {
    if (!history || history.length === 0) {
      historyListEl.innerHTML = '<div class="empty-state">ยังไม่มีการสุ่มในรอบนี้</div>';
      return;
    }

    historyListEl.innerHTML = '';
    history.forEach((rec) => {
      historyListEl.appendChild(createHistoryElement(rec));
    });
  }

  function prependHistoryItem(rec) {
    const emptyState = historyListEl.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const el = createHistoryElement(rec);
    historyListEl.prepend(el);
  }

  function createHistoryElement(rec) {
    const item = document.createElement('div');
    item.className = 'history-item';
    if (rec.color) item.style.borderLeftColor = rec.color;

    const name = document.createElement('span');
    name.className = 'history-name';
    name.textContent = rec.winner;

    const time = document.createElement('span');
    time.className = 'history-time';
    const d = new Date(rec.timestamp);
    time.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

    item.appendChild(name);
    item.appendChild(time);
    return item;
  }

  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('ต้องการล้างประวัติการสุ่มทั้งหมดหรือไม่?')) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'clear_history' }));
      }
    }
  });

  // ================= MODAL =================
  function showModal(winnerName) {
    modalWinnerName.textContent = winnerName;
    winnerModal.classList.add('open');
  }

  function closeModal() {
    winnerModal.classList.remove('open');
  }

  modalCloseBtn.addEventListener('click', closeModal);

  modalRemoveBtn.addEventListener('click', () => {
    if (lastWinner && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'remove_winner',
        label: lastWinner
      }));
    }
    closeModal();
  });

  // Click outside modal card to close
  winnerModal.addEventListener('click', (e) => {
    if (e.target === winnerModal) closeModal();
  });

  // Start WebSocket
  connectWS();
})();
