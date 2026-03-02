const SECTORS = [
  { num: 1, name: "北(坎)", start: 337.5, end: 22.5 },
  { num: 8, name: "东北(艮)", start: 22.5, end: 67.5 },
  { num: 3, name: "东(震)", start: 67.5, end: 112.5 },
  { num: 4, name: "东南(巽)", start: 112.5, end: 157.5 },
  { num: 9, name: "南(离)", start: 157.5, end: 202.5 },
  { num: 2, name: "西南(坤)", start: 202.5, end: 247.5 },
  { num: 7, name: "西(兑)", start: 247.5, end: 292.5 },
  { num: 6, name: "西北(乾)", start: 292.5, end: 337.5 }
];

const MARKER_TYPES = [
  { id: "entryDoor", label: "入户门", short: "门", category: "wind", color: "#c34f3a" },
  { id: "window", label: "窗户", short: "窗", category: "wind", color: "#b05445" },
  { id: "balcony", label: "阳台", short: "阳", category: "wind", color: "#c76a3c" },
  { id: "stove", label: "灶台", short: "灶", category: "wind", color: "#d26a4e" },
  { id: "sofa", label: "沙发", short: "沙", category: "wind", color: "#b76b58" },
  { id: "bed", label: "床", short: "床", category: "wind", color: "#a8615e" },
  { id: "desk", label: "书桌", short: "桌", category: "wind", color: "#9e5a6a" },
  { id: "altar", label: "神龛", short: "龛", category: "wind", color: "#8c4e44" },
  { id: "petBed", label: "宠物床", short: "宠", category: "wind", color: "#a96a5b" },
  { id: "sink", label: "水槽", short: "槽", category: "water", color: "#2b5ea0" },
  { id: "washbasin", label: "洗手池", short: "洗", category: "water", color: "#2e6ea7" },
  { id: "toilet", label: "马桶", short: "厕", category: "water", color: "#2f5c88" },
  { id: "drain", label: "下水管", short: "管", category: "water", color: "#2a5a93" },
  { id: "washingMachine", label: "洗衣机", short: "机", category: "water", color: "#2f6f9c" },
  { id: "bathroom", label: "卫生间", short: "卫", category: "water", color: "#275783" },
  { id: "custom", label: "自定义", short: "标", category: "neutral", color: "#6b655a" }
];
const EMBEDDED_MODE = new URLSearchParams(window.location.search).get("embedded") === "horosa";
if (EMBEDDED_MODE) {
  document.body.classList.add("horosa-embed");
}

const canvas = document.getElementById("mainCanvas");
const ctx = canvas.getContext("2d");
const canvasShell = document.getElementById("canvasShell");
const canvasArea = document.getElementById("canvasArea");
const statusBar = document.getElementById("statusBar");
const canvasHint = document.getElementById("canvasHint");

const fileInput = document.getElementById("fileInput");
const unitAngleInput = document.getElementById("unitAngle");
const doorAngleInput = document.getElementById("doorAngle");
const opacitySlider = document.getElementById("opacitySlider");
const opacityVal = document.getElementById("opacityVal");
const diskScaleInput = document.getElementById("diskScale");
const diskScaleVal = document.getElementById("diskScaleVal");
const rectRotationInput = document.getElementById("rectRotationInput");
const rectRotationSlider = document.getElementById("rectRotationSlider");
const btnDrawBox = document.getElementById("btnDrawBox");
const btnResetRect = document.getElementById("btnResetRect");
const btnDrawDoor = document.getElementById("btnDrawDoor");
const markerTypeSelect = document.getElementById("markerType");
const btnPlaceMarker = document.getElementById("btnPlaceMarker");
const btnClearMarkers = document.getElementById("btnClearMarkers");
const btnExport = document.getElementById("btnExport");
const btnExportConfig = document.getElementById("btnExportConfig");
const btnImportConfig = document.getElementById("btnImportConfig");
const configInput = document.getElementById("configInput");
const btnExportReportPng = document.getElementById("btnExportReportPng");
const btnExportReportPdf = document.getElementById("btnExportReportPdf");
const projectNameInput = document.getElementById("projectName");
const projectSearchInput = document.getElementById("projectSearch");
const projectIncludeImage = document.getElementById("projectIncludeImage");
const autoSaveEnabled = document.getElementById("autoSaveEnabled");
const btnSaveProject = document.getElementById("btnSaveProject");
const btnClearProjectSearch = document.getElementById("btnClearProjectSearch");
const projectList = document.getElementById("projectList");
const currentProjectLabel = document.getElementById("currentProjectLabel");
const projectVersionSelect = document.getElementById("projectVersionSelect");
const btnRestoreVersion = document.getElementById("btnRestoreVersion");
const diskCenterGroup = document.getElementById("diskCenterGroup");
const periodGroup = document.getElementById("periodGroup");
const markerList = document.getElementById("markerList");
const summary = document.getElementById("summary");
const recentList = document.getElementById("recentList");
const controlTabs = document.getElementById("controlTabs");
const controlPanels = Array.from(document.querySelectorAll(".control-panel"));
const markerFilters = document.getElementById("markerFilters");
const quickUpload = document.getElementById("quickUpload");
const quickDrawRect = document.getElementById("quickDrawRect");
const quickDrawDoor = document.getElementById("quickDrawDoor");
const quickPlaceMarker = document.getElementById("quickPlaceMarker");
const quickExportPng = document.getElementById("quickExportPng");
const workspaceTabs = document.getElementById("workspaceTabs");
const workspaceViews = Array.from(document.querySelectorAll(".workspace-view"));
const btnPanToggle = document.getElementById("btnPanToggle");
const btnSnapToggle = document.getElementById("btnSnapToggle");
const btnZoomOut = document.getElementById("btnZoomOut");
const btnZoomIn = document.getElementById("btnZoomIn");
const btnZoomReset = document.getElementById("btnZoomReset");
const zoomLabel = document.getElementById("zoomLabel");
const quickUndo = document.getElementById("quickUndo");
const quickRedo = document.getElementById("quickRedo");
const quickRefresh = document.getElementById("quickRefresh");

const unitAngleDisplay = document.getElementById("unitAngleDisplay");
const doorAngleDisplay = document.getElementById("doorAngleDisplay");
const diskRotationDisplay = document.getElementById("diskRotationDisplay");

let img = new Image();
let imgLoaded = false;
let scale = 1;

let rect = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  rotation: 0,
  active: false
};

let mode = "none";
let isDragging = false;
let startPoint = { x: 0, y: 0 };
let activeHandle = null;
let initialRectState = null;
let dragMarkerId = null;

let unitAzimuth = null;
let doorImageAngle = null;
let globalAlpha = 0.3;
let diskScale = 1;
let diskCenterMode = "house";
let customCenter = null;
let periodMode = "current";
let markers = [];
let selectedMarkerId = null;
let markerIdSeed = 1;
let currentFilter = "all";
let viewScale = 1;
let viewOffset = { x: 0, y: 0 };
let panMode = false;
let panStart = null;
let snapEnabled = true;
const SNAP_TOLERANCE = 8;
const RECENT_KEY = "naqi_recent_configs";
const MAX_RECENTS = 6;
const MAX_RECENT_IMAGE_SIZE = 900000;
const PROJECT_KEY = "naqi_projects";
const MAX_PROJECTS = 60;
const MAX_PROJECT_IMAGE_SIZE = 3500000;
const CURRENT_PROJECT_KEY = "naqi_current_project";
const AUTO_SAVE_KEY = "naqi_auto_save_enabled";
const MAX_VERSIONS = 12;
let autoSaveTimer = null;
const THUMB_WIDTH = 280;
const HISTORY_LIMIT = 80;
let historyStack = [];
let redoStack = [];
let historyLocked = false;
let historyTimer = null;

const WIND_NUMS = new Set([6, 7, 8, 9]);
const WATER_NUMS = new Set([1, 2, 3, 4]);
const WIND_COLOR = "rgb(180, 30, 30)";
const WATER_COLOR = "rgb(20, 30, 100)";

function setStatus(text) {
  if (statusBar) statusBar.textContent = text;
}

function isEditingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function setSegmentedActive(group, key, value) {
  if (!group) return;
  Array.from(group.querySelectorAll(".seg-btn")).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset[key] === value);
  });
}

function syncControlsFromState() {
  unitAngleInput.value = unitAzimuth ?? "";
  doorAngleInput.value = doorImageAngle ?? "";
  opacitySlider.value = globalAlpha;
  opacityVal.textContent = `${Math.round(globalAlpha * 100)}%`;
  diskScaleInput.value = diskScale;
  diskScaleVal.textContent = `${Math.round(diskScale * 100)}%`;
  rectRotationInput.value = rect.rotation || 0;
  rectRotationSlider.value = rect.rotation || 0;
  setSegmentedActive(diskCenterGroup, "center", diskCenterMode);
  setSegmentedActive(periodGroup, "period", periodMode);
  updateAngleDisplays();
}

function captureState() {
  return {
    rect: { ...rect },
    markers: markers.map((m) => ({ ...m })),
    unitAzimuth,
    doorImageAngle,
    globalAlpha,
    diskScale,
    diskCenterMode,
    customCenter: customCenter ? { ...customCenter } : null,
    periodMode,
    selectedMarkerId,
    markerIdSeed
  };
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  historyLocked = true;
  rect = { ...snapshot.rect };
  markers = snapshot.markers.map((m) => ({ ...m }));
  unitAzimuth = snapshot.unitAzimuth;
  doorImageAngle = snapshot.doorImageAngle;
  globalAlpha = snapshot.globalAlpha;
  diskScale = snapshot.diskScale;
  diskCenterMode = snapshot.diskCenterMode;
  customCenter = snapshot.customCenter ? { ...snapshot.customCenter } : null;
  periodMode = snapshot.periodMode;
  selectedMarkerId = snapshot.selectedMarkerId ?? null;
  markerIdSeed =
    snapshot.markerIdSeed ?? markers.reduce((maxId, m) => Math.max(maxId, m.id), 0) + 1;
  syncControlsFromState();
  updateMarkerList();
  drawAll();
  historyLocked = false;
}

function updateUndoButtons() {
  if (quickUndo) quickUndo.disabled = historyStack.length < 2;
  if (quickRedo) quickRedo.disabled = redoStack.length === 0;
}

function initHistory() {
  historyStack = [captureState()];
  redoStack = [];
  updateUndoButtons();
}

function pushHistory() {
  if (historyLocked) return;
  historyStack.push(captureState());
  if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function scheduleHistoryPush() {
  if (historyLocked) return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    pushHistory();
  }, 350);
}

function undo() {
  if (historyStack.length < 2) return;
  const current = historyStack.pop();
  redoStack.push(current);
  const previous = historyStack[historyStack.length - 1];
  applySnapshot(previous);
  setStatus("已撤销上一步。");
  scheduleAutoSave();
  updateUndoButtons();
}

function redo() {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  historyStack.push(next);
  applySnapshot(next);
  setStatus("已重做一步。");
  scheduleAutoSave();
  updateUndoButtons();
}

function snapPointToRect(pos) {
  if (!snapEnabled || !rect.active) return pos;
  const tol = SNAP_TOLERANCE / getCombinedScale();
  const center = getRectCenter();
  const local = rotatePoint(pos, center, -rect.rotation);
  let lx = local.x;
  let ly = local.y;
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const xLines = [center.x - halfW, center.x, center.x + halfW];
  const yLines = [center.y - halfH, center.y, center.y + halfH];
  xLines.forEach((line) => {
    if (Math.abs(lx - line) <= tol) lx = line;
  });
  yLines.forEach((line) => {
    if (Math.abs(ly - line) <= tol) ly = line;
  });
  return rotatePoint({ x: lx, y: ly }, center, rect.rotation);
}

function snapRectToImage() {
  if (!snapEnabled || !imgLoaded) return;
  if (Math.abs(rect.rotation) > 0.5) return;
  if (rect.w <= 0 || rect.h <= 0) return;
  const tol = SNAP_TOLERANCE / getCombinedScale();
  const candidatesX = [
    { edge: rect.x, target: 0, offset: 0 },
    { edge: rect.x + rect.w, target: img.width, offset: rect.w },
    { edge: rect.x + rect.w / 2, target: img.width / 2, offset: rect.w / 2 }
  ];
  const candidatesY = [
    { edge: rect.y, target: 0, offset: 0 },
    { edge: rect.y + rect.h, target: img.height, offset: rect.h },
    { edge: rect.y + rect.h / 2, target: img.height / 2, offset: rect.h / 2 }
  ];
  candidatesX.forEach((c) => {
    if (Math.abs(c.edge - c.target) <= tol) rect.x = c.target - c.offset;
  });
  candidatesY.forEach((c) => {
    if (Math.abs(c.edge - c.target) <= tol) rect.y = c.target - c.offset;
  });
}

function getCombinedScale() {
  return scale * viewScale;
}

function updateZoomLabel() {
  if (!zoomLabel) return;
  zoomLabel.textContent = `${Math.round(viewScale * 100)}%`;
}

function setActivePanel(panelId) {
  if (!controlTabs) return;
  controlTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.panel === panelId);
  });
  controlPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === panelId);
  });
}

function setActiveWorkspace(viewId) {
  if (!workspaceTabs) return;
  workspaceTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });
  workspaceViews.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewId);
  });
  // Ensure canvas resizes correctly when toggling views
  if (viewId === "canvas") {
    setTimeout(() => resizeCanvas(), 0);
  }
}

function setViewScale(newScale, anchor) {
  const clamped = Math.max(0.4, Math.min(3.0, newScale));
  const combined = getCombinedScale();
  const nextCombined = scale * clamped;
  const point = anchor || { x: canvas.width / 2, y: canvas.height / 2 };
  const imgX = (point.x - viewOffset.x) / combined;
  const imgY = (point.y - viewOffset.y) / combined;
  viewScale = clamped;
  viewOffset = {
    x: point.x - imgX * nextCombined,
    y: point.y - imgY * nextCombined
  };
  updateZoomLabel();
  drawAll();
}

function resetView() {
  viewScale = 1;
  viewOffset = { x: 0, y: 0 };
  updateZoomLabel();
  drawAll();
}

function getTimestampName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `naqi-project-${stamp}.naqi`;
}

function loadRecents() {
  const raw = localStorage.getItem(RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecents(list) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
}

function loadProjects() {
  const raw = localStorage.getItem(PROJECT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProjects(list) {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(list.slice(0, MAX_PROJECTS)));
}

function getCurrentProjectName() {
  const inputName = (projectNameInput?.value || "").trim();
  if (inputName) return inputName;
  return localStorage.getItem(CURRENT_PROJECT_KEY) || "";
}

function setCurrentProjectName(name) {
  if (name) {
    localStorage.setItem(CURRENT_PROJECT_KEY, name);
  }
  if (currentProjectLabel) {
    currentProjectLabel.textContent = name || "未选择";
  }
}

function getPayloadHash(payload) {
  if (!payload || typeof payload !== "object") return "";
  const clone = { ...payload };
  delete clone.timestamp;
  try {
    return JSON.stringify(clone);
  } catch {
    return "";
  }
}

function getImageKey(dataUrl) {
  if (!dataUrl) return "";
  return `${dataUrl.length}:${dataUrl.slice(0, 64)}`;
}

function createProjectThumbnail() {
  const composite = renderCompositeCanvas();
  if (!composite) return null;
  const scale = Math.min(1, THUMB_WIDTH / composite.width);
  const w = Math.max(1, Math.round(composite.width * scale));
  const h = Math.max(1, Math.round(composite.height * scale));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = w;
  thumbCanvas.height = h;
  const tctx = thumbCanvas.getContext("2d");
  tctx.drawImage(composite, 0, 0, composite.width, composite.height, 0, 0, w, h);
  return thumbCanvas.toDataURL("image/jpeg", 0.72);
}

function updateVersionSelect(project) {
  if (!projectVersionSelect) return;
  projectVersionSelect.innerHTML = "";
  if (!project || !project.versions || project.versions.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "暂无历史版本";
    projectVersionSelect.appendChild(opt);
    if (btnRestoreVersion) btnRestoreVersion.disabled = true;
    return;
  }

  project.versions.forEach((ver, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${formatProjectTime(ver.ts)} · 标记 ${ver.payload?.markers?.length ?? 0}`;
    projectVersionSelect.appendChild(opt);
  });
  if (btnRestoreVersion) btnRestoreVersion.disabled = false;
}

function formatProjectTime(ts) {
  if (!ts) return "";
  const dt = new Date(ts);
  return dt.toLocaleString();
}

function renderProjects() {
  if (!projectList) return;
  const keyword = (projectSearchInput?.value || "").trim().toLowerCase();
  const currentName = getCurrentProjectName();
  const projects = loadProjects().filter((item) =>
    item.name.toLowerCase().includes(keyword)
  );

  if (projects.length === 0) {
    projectList.innerHTML = "<div class=\"helper\">暂无项目</div>";
    return;
  }

  projectList.innerHTML = "";
  projects.forEach((project) => {
    const row = document.createElement("div");
    row.className = "project-item" + (project.name === currentName ? " active" : "");
    let thumbEl;
    if (project.thumbnail) {
      thumbEl = document.createElement("img");
      thumbEl.src = project.thumbnail;
      thumbEl.alt = project.name;
      thumbEl.className = "project-thumb";
    } else {
      thumbEl = document.createElement("div");
      thumbEl.className = "project-thumb placeholder";
      thumbEl.textContent = "无缩略图";
    }
    const meta = document.createElement("div");
    meta.innerHTML = `<strong>${project.name}</strong>`;
    const sub = document.createElement("small");
    const markerCount = project.payload?.markers?.length ?? 0;
    const imageTag = project.payload?.imageDataUrl ? "含底图" : "无底图";
    sub.textContent = `${formatProjectTime(project.updatedAt)} · 标记 ${markerCount} · ${imageTag}`;
    meta.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "project-actions";
    const loadBtn = document.createElement("button");
    loadBtn.className = "mini-btn primary";
    loadBtn.textContent = "加载";
    loadBtn.addEventListener("click", () => {
      if (project.payload) applyConfig(project.payload);
      if (projectNameInput) projectNameInput.value = project.name;
      setCurrentProjectName(project.name);
      updateVersionSelect(project);
      setStatus(`已加载项目：${project.name}`);
    });
    const delBtn = document.createElement("button");
    delBtn.className = "mini-btn";
    delBtn.textContent = "删除";
    delBtn.addEventListener("click", () => {
      const next = loadProjects().filter((item) => item.id !== project.id);
      saveProjects(next);
      renderProjects();
    });
    actions.appendChild(loadBtn);
    actions.appendChild(delBtn);

    row.appendChild(thumbEl);
    row.appendChild(meta);
    row.appendChild(actions);
    projectList.appendChild(row);
  });

  const currentProject = projects.find((p) => p.name === currentName) || loadProjects().find((p) => p.name === currentName);
  updateVersionSelect(currentProject || null);
}

function addOrUpdateProject(name, payload, options = {}) {
  const projects = loadProjects();
  const now = Date.now();
  const existingIndex = projects.findIndex((p) => p.name === name);
  const payloadHash = getPayloadHash(payload);
  const imageKey = getImageKey(payload?.imageDataUrl);
  if (existingIndex >= 0) {
    const existing = projects[existingIndex];
    const hasChange = existing.lastHash !== payloadHash;
    const shouldRecord = options.recordVersion && hasChange && existing.payload;
    if (shouldRecord) {
        const versionPayload = { ...existing.payload, imageDataUrl: null };
      const versions = existing.versions ? [...existing.versions] : [];
      versions.unshift({ ts: existing.updatedAt || now, payload: versionPayload });
      existing.versions = versions.slice(0, MAX_VERSIONS);
    }
    projects[existingIndex] = {
      ...existing,
      payload,
      updatedAt: now,
      lastHash: payloadHash,
      imageKey,
      thumbnail: options.thumbnail !== undefined ? options.thumbnail : existing.thumbnail
    };
  } else {
    projects.unshift({
      id: `proj_${now}_${Math.floor(Math.random() * 10000)}`,
      name,
      payload,
      updatedAt: now,
      versions: [],
      lastHash: payloadHash,
      imageKey,
      thumbnail: options.thumbnail ?? null
    });
  }

  try {
    saveProjects(projects);
    if (!options.silent) {
      setStatus(`项目已保存：${name}`);
    }
  } catch (err) {
    setStatus("项目保存失败，可能是存储空间不足。");
  }
  renderProjects();
}

function renderRecents() {
  if (!recentList) return;
  const recents = loadRecents();
  if (recents.length === 0) {
    recentList.innerHTML = "<div class=\"helper\">暂无最近项目文件</div>";
    return;
  }

  recentList.innerHTML = "";
  recents.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "recent-item";
    const meta = document.createElement("div");
    meta.innerHTML = `<strong>${item.name || "未命名项目文件"}</strong>`;
    const sub = document.createElement("small");
    sub.textContent = item.note || "";
    meta.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "recent-actions";
    const applyBtn = document.createElement("button");
    applyBtn.className = "mini-btn primary";
    applyBtn.textContent = "打开";
    applyBtn.addEventListener("click", () => {
      if (item.payload) applyConfig(item.payload, { fromRecent: true });
    });
    const delBtn = document.createElement("button");
    delBtn.className = "mini-btn";
    delBtn.textContent = "移除";
    delBtn.addEventListener("click", () => {
      const next = loadRecents().filter((_, i) => i !== index);
      saveRecents(next);
      renderRecents();
    });
    actions.appendChild(applyBtn);
    actions.appendChild(delBtn);

    row.appendChild(meta);
    row.appendChild(actions);
    recentList.appendChild(row);
  });
}

function addRecentConfig(payload, name) {
  const recents = loadRecents();
  const note = payload.imageDataUrl ? "包含底图" : "不含底图";
  const entry = { name, payload, note, ts: Date.now() };
  const next = [entry, ...recents.filter((item) => item.name !== name)];
  saveRecents(next);
  renderRecents();
}

function updateAngleDisplays() {
  unitAngleDisplay.textContent = formatAngle(unitAzimuth);
  doorAngleDisplay.textContent = formatAngle(doorImageAngle);
  diskRotationDisplay.textContent = formatAngle(getDiskRotation());
}

function formatAngle(value) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value * 10) / 10}°`;
}

function isWindSector(num) {
  if (periodMode === "current") return WIND_NUMS.has(num);
  return WATER_NUMS.has(num);
}

function getDiskRotation() {
  if (unitAzimuth === null || doorImageAngle === null) return 0;
  if (Number.isNaN(unitAzimuth) || Number.isNaN(doorImageAngle)) return 0;
  return doorImageAngle - unitAzimuth;
}

function angleInSector(angle, start, end) {
  if (start < end) return angle >= start && angle < end;
  return angle >= start || angle < end;
}

function getDiskCenter() {
  if (!rect.active) return null;
  if (diskCenterMode === "house") return getRectCenter();
  if (diskCenterMode === "custom") return customCenter || getRectCenter();
  if (diskCenterMode === "marker") {
    const marker = markers.find((m) => m.id === selectedMarkerId);
    return marker ? { x: marker.x, y: marker.y } : getRectCenter();
  }
  if (diskCenterMode === "door") {
    const marker = markers.find((m) => m.type === "entryDoor");
    return marker ? { x: marker.x, y: marker.y } : getRectCenter();
  }
  return getRectCenter();
}

function getRectCenter() {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2
  };
}

function rotatePoint(point, origin, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: origin.y + dx * Math.sin(rad) + dy * Math.cos(rad)
  };
}

function getMousePos(evt) {
  const rectCanvas = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rectCanvas.left,
    y: evt.clientY - rectCanvas.top
  };
}

function screenToImage(pos) {
  const combined = getCombinedScale();
  return {
    x: (pos.x - viewOffset.x) / combined,
    y: (pos.y - viewOffset.y) / combined
  };
}

function setActiveButton(btn) {
  [btnDrawBox, btnDrawDoor, btnPlaceMarker].forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

function setMode(nextMode) {
  mode = nextMode;
}

function startDrawRect() {
  if (!imgLoaded) return;
  setMode("drawRect");
  canvas.style.cursor = "crosshair";
  setStatus("模式：绘制矩形。在图上拖动完成框选。");
  rect.active = false;
  rect.rotation = 0;
  rectRotationInput.value = "0";
  rectRotationSlider.value = "0";
  setActiveButton(btnDrawBox);
}

function resizeCanvas() {
  if (!imgLoaded) return;
  const host = canvasShell || canvasArea;
  const padding = 24;
  const maxWidth = Math.max(320, host.clientWidth - padding);
  const maxHeight = Math.max(320, host.clientHeight - padding);

  const scaleW = maxWidth / img.width;
  const scaleH = maxHeight / img.height;
  scale = Math.min(scaleW, scaleH);

  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  updateZoomLabel();
  drawAll();
}

function buildConfigPayload() {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    unitAzimuth,
    doorImageAngle,
    globalAlpha,
    diskScale,
    diskCenterMode,
    periodMode,
    customCenter,
    rect: { ...rect },
    markers: markers.map((m) => ({ ...m })),
    imageDataUrl: imgLoaded ? img.src : null
  };
}

function scheduleAutoSave() {
  if (EMBEDDED_MODE) return;
  if (!autoSaveEnabled || !autoSaveEnabled.checked) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    performAutoSave();
  }, 1200);
}

function performAutoSave() {
  if (!imgLoaded) return;
  const name = getCurrentProjectName();
  if (!name) return;
  const includeImage = projectIncludeImage?.checked ?? true;
  const payload = buildConfigPayload();
  if (!includeImage) payload.imageDataUrl = null;
  if (includeImage && payload.imageDataUrl && payload.imageDataUrl.length > MAX_PROJECT_IMAGE_SIZE) {
    payload.imageDataUrl = null;
  }
  const existing = loadProjects().find((p) => p.name === name);
  const nextImageKey = getImageKey(payload.imageDataUrl);
  let thumbnail;
  if (!existing || !existing.thumbnail || existing.imageKey !== nextImageKey) {
    thumbnail = createProjectThumbnail();
  }
  addOrUpdateProject(name, payload, { recordVersion: true, silent: true, thumbnail });
}

function applyConfig(payload, options = {}) {
  if (!payload || typeof payload !== "object") return;

  const applyState = () => {
    unitAzimuth = Number.isFinite(payload.unitAzimuth) ? payload.unitAzimuth : null;
    doorImageAngle = Number.isFinite(payload.doorImageAngle) ? payload.doorImageAngle : null;
    globalAlpha = Number.isFinite(payload.globalAlpha) ? payload.globalAlpha : globalAlpha;
    diskScale = Number.isFinite(payload.diskScale) ? Math.max(1, payload.diskScale) : diskScale;
    diskCenterMode = payload.diskCenterMode || diskCenterMode;
    periodMode = payload.periodMode || periodMode;
    customCenter = payload.customCenter || customCenter;
    rect = payload.rect ? { ...rect, ...payload.rect } : rect;
    rect.active = !!rect.active;

    markers = Array.isArray(payload.markers) ? payload.markers.map((m, idx) => ({
      id: m.id ?? idx + 1,
      type: m.type || "custom",
      label: m.label || "自定义",
      short: m.short || "标",
      category: m.category || "neutral",
      color: m.color || "#6b655a",
      x: m.x ?? 0,
      y: m.y ?? 0
    })) : [];
    markerIdSeed = markers.reduce((maxId, m) => Math.max(maxId, m.id), 0) + 1;

    syncControlsFromState();
    updateMarkerList();
    drawAll();
    initHistory();
    setStatus(options.fromRecent ? "已应用最近项目文件。" : "项目文件已导入。");
  };

  if (payload.imageDataUrl) {
    img = new Image();
    img.onload = () => {
      imgLoaded = true;
      resizeCanvas();
      applyState();
    };
    img.src = payload.imageDataUrl;
  } else {
    applyState();
    if (!imgLoaded) {
      setStatus("项目文件不含底图，请先上传户型图。");
    }
  }
}

function drawAll() {
  if (!imgLoaded) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const combinedScale = getCombinedScale();
  ctx.drawImage(img, viewOffset.x, viewOffset.y, img.width * combinedScale, img.height * combinedScale);

  if (rect.w !== 0 && rect.h !== 0) {
    drawRotatedRect(ctx, combinedScale, viewOffset);
  }

  if (rect.active) {
    drawNaQiDisk(ctx, combinedScale, viewOffset);
  }

  drawMarkers(ctx, combinedScale, viewOffset);
}

function drawRotatedRect(targetCtx, scaleFactor, offset) {
  const center = getRectCenter();
  targetCtx.save();
  targetCtx.translate(center.x * scaleFactor + offset.x, center.y * scaleFactor + offset.y);
  targetCtx.rotate((rect.rotation * Math.PI) / 180);

  const scaledW = rect.w * scaleFactor;
  const scaledH = rect.h * scaleFactor;

  targetCtx.strokeStyle = "#1f7a67";
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(-scaledW / 2, -scaledH / 2, scaledW, scaledH);

  targetCtx.beginPath();
  targetCtx.strokeStyle = "rgba(31, 122, 103, 0.4)";
  targetCtx.lineWidth = 1;
  targetCtx.moveTo(-scaledW / 2, -scaledH / 2);
  targetCtx.lineTo(scaledW / 2, scaledH / 2);
  targetCtx.moveTo(scaledW / 2, -scaledH / 2);
  targetCtx.lineTo(-scaledW / 2, scaledH / 2);
  targetCtx.stroke();

  if (rect.active && mode !== "drawRect") {
    const handleSize = 6;
    targetCtx.fillStyle = "#fff";
    targetCtx.strokeStyle = "#333";
    targetCtx.lineWidth = 1;

    const coords = [
      { x: -scaledW / 2, y: -scaledH / 2 },
      { x: scaledW / 2, y: -scaledH / 2 },
      { x: scaledW / 2, y: scaledH / 2 },
      { x: -scaledW / 2, y: scaledH / 2 }
    ];

    coords.forEach((p) => {
      targetCtx.beginPath();
      targetCtx.arc(p.x, p.y, handleSize, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    });
  }

  targetCtx.restore();

  targetCtx.beginPath();
  targetCtx.arc(center.x * scaleFactor + offset.x, center.y * scaleFactor + offset.y, 4, 0, Math.PI * 2);
  targetCtx.fillStyle = "#c34f3a";
  targetCtx.fill();
}

function getMaxDiskRadius(center) {
  if (!rect.active) return 0;
  const rectCenter = getRectCenter();
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const rawCorners = [
    { x: rectCenter.x - halfW, y: rectCenter.y - halfH },
    { x: rectCenter.x + halfW, y: rectCenter.y - halfH },
    { x: rectCenter.x + halfW, y: rectCenter.y + halfH },
    { x: rectCenter.x - halfW, y: rectCenter.y + halfH }
  ];
  let maxDistance = 0;
  rawCorners.forEach((corner) => {
    const rotated = rotatePoint(corner, rectCenter, rect.rotation);
    const dist = Math.hypot(rotated.x - center.x, rotated.y - center.y);
    if (dist > maxDistance) maxDistance = dist;
  });
  return maxDistance;
}

function drawNaQiDisk(targetCtx, scaleFactor, offset) {
  const center = getDiskCenter();
  if (!center) return;

  const cx = center.x * scaleFactor + offset.x;
  const cy = center.y * scaleFactor + offset.y;
  const maxRadius = getMaxDiskRadius(center);
  const radius = maxRadius * diskScale * scaleFactor;
  if (radius <= 0) return;

  const diskRotation = getDiskRotation();

  targetCtx.save();
  targetCtx.translate(cx, cy);
  targetCtx.rotate((diskRotation * Math.PI) / 180);
  targetCtx.globalAlpha = globalAlpha;

  SECTORS.forEach((sector) => {
    const startRad = ((sector.start - 90) * Math.PI) / 180;
    const endRad = ((sector.end - 90) * Math.PI) / 180;
    targetCtx.beginPath();
    targetCtx.moveTo(0, 0);
    targetCtx.arc(0, 0, radius, startRad, endRad);
    targetCtx.fillStyle = isWindSector(sector.num) ? WIND_COLOR : WATER_COLOR;
    targetCtx.fill();

    targetCtx.beginPath();
    targetCtx.moveTo(0, 0);
    targetCtx.lineTo(Math.cos(startRad) * radius, Math.sin(startRad) * radius);
    targetCtx.strokeStyle = "#111";
    targetCtx.lineWidth = 1.4;
    targetCtx.stroke();

    targetCtx.beginPath();
    targetCtx.moveTo(0, 0);
    targetCtx.lineTo(Math.cos(endRad) * radius, Math.sin(endRad) * radius);
    targetCtx.stroke();
  });

  targetCtx.globalAlpha = 1;

  SECTORS.forEach((sector) => {
    let midAngle = (sector.start + sector.end) / 2;
    if (sector.start > sector.end) midAngle = (sector.start + sector.end + 360) / 2;
    if (midAngle >= 360) midAngle -= 360;
    const midRad = ((midAngle - 90) * Math.PI) / 180;
    const textR = radius * 0.7;
    const tx = Math.cos(midRad) * textR;
    const ty = Math.sin(midRad) * textR;

    targetCtx.save();
    targetCtx.translate(tx, ty);
    targetCtx.rotate((-diskRotation * Math.PI) / 180);

    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";
    targetCtx.fillStyle = "#fff";
    targetCtx.font = `bold ${radius * 0.18}px "Avenir Next"`;
    targetCtx.shadowColor = "rgba(0,0,0,0.45)";
    targetCtx.shadowBlur = 4;
    targetCtx.fillText(sector.num, 0, -radius * 0.08);

    targetCtx.font = `bold ${radius * 0.11}px "PingFang SC"`;
    targetCtx.fillText(sector.name, 0, radius * 0.12);

    targetCtx.restore();
  });

  if (unitAzimuth !== null && !Number.isNaN(unitAzimuth)) {
    const unitRad = ((unitAzimuth - 90) * Math.PI) / 180;
    const arrowLen = radius * 1.15;
    targetCtx.beginPath();
    targetCtx.moveTo(0, 0);
    targetCtx.lineTo(Math.cos(unitRad) * arrowLen, Math.sin(unitRad) * arrowLen);
    targetCtx.strokeStyle = "#1f7a67";
    targetCtx.lineWidth = 3;
    targetCtx.shadowColor = "rgba(0,0,0,0.4)";
    targetCtx.shadowBlur = 2;
    targetCtx.stroke();
    targetCtx.shadowBlur = 0;

    targetCtx.save();
    targetCtx.translate(Math.cos(unitRad) * arrowLen, Math.sin(unitRad) * arrowLen);
    targetCtx.rotate(unitRad);
    targetCtx.beginPath();
    targetCtx.moveTo(0, 0);
    targetCtx.lineTo(-10, -6);
    targetCtx.lineTo(-10, 6);
    targetCtx.closePath();
    targetCtx.fillStyle = "#1f7a67";
    targetCtx.fill();
    targetCtx.restore();

    targetCtx.save();
    targetCtx.translate(Math.cos(unitRad) * arrowLen, Math.sin(unitRad) * arrowLen);
    targetCtx.rotate((-diskRotation * Math.PI) / 180);
    targetCtx.fillStyle = "#1f7a67";
    targetCtx.font = "bold 13px sans-serif";
    targetCtx.fillText(`单元门 ${Math.round(unitAzimuth)}°`, 0, -14);
    targetCtx.restore();
  }

  targetCtx.restore();

  if (doorImageAngle !== null && !Number.isNaN(doorImageAngle)) {
    const doorRad = ((doorImageAngle - 90) * Math.PI) / 180;
    targetCtx.save();
    targetCtx.translate(cx, cy);
    targetCtx.beginPath();
    targetCtx.moveTo(0, 0);
    targetCtx.lineTo(Math.cos(doorRad) * radius, Math.sin(doorRad) * radius);
    targetCtx.strokeStyle = "rgba(216, 79, 79, 0.7)";
    targetCtx.setLineDash([4, 4]);
    targetCtx.lineWidth = 2;
    targetCtx.stroke();
    targetCtx.restore();
  }
}

function drawMarkers(targetCtx, scaleFactor, offset) {
  markers.forEach((marker) => {
    const evalResult = evaluateMarker(marker);
    const x = marker.x * scaleFactor + offset.x;
    const y = marker.y * scaleFactor + offset.y;
    const radius = marker.id === selectedMarkerId ? 9 : 7;

    targetCtx.beginPath();
    targetCtx.arc(x, y, radius, 0, Math.PI * 2);
    targetCtx.fillStyle = marker.color;
    targetCtx.fill();

    if (!evalResult.ok && evalResult.expected !== "neutral") {
      targetCtx.strokeStyle = "#b14032";
      targetCtx.lineWidth = 2;
      targetCtx.stroke();
    } else {
      targetCtx.strokeStyle = "#fff";
      targetCtx.lineWidth = 2;
      targetCtx.stroke();
    }

    targetCtx.fillStyle = "#fff";
    targetCtx.font = "bold 11px sans-serif";
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";
    targetCtx.fillText(marker.short, x, y + 0.5);
  });
}

function renderCompositeCanvas() {
  if (!imgLoaded) return null;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = img.width;
  exportCanvas.height = img.height;
  const ectx = exportCanvas.getContext("2d");

  ectx.drawImage(img, 0, 0);
  if (rect.w !== 0 && rect.h !== 0) drawRotatedRect(ectx, 1, { x: 0, y: 0 });
  if (rect.active) drawNaQiDisk(ectx, 1, { x: 0, y: 0 });
  drawMarkers(ectx, 1, { x: 0, y: 0 });

  return exportCanvas;
}

function evaluateMarker(marker) {
  const sector = getSectorForPoint(marker);
  if (!sector) {
    return {
      sector: null,
      expected: marker.category,
      actual: null,
      ok: marker.category === "neutral"
    };
  }

  const actual = isWindSector(sector.num) ? "wind" : "water";
  const ok = marker.category === "neutral" || marker.category === actual;
  return { sector, expected: marker.category, actual, ok };
}

function getSectorForPoint(marker) {
  const center = getDiskCenter();
  if (!center) return null;
  const dx = marker.x - center.x;
  const dy = marker.y - center.y;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  let compass = angle + 90;
  if (compass < 0) compass += 360;
  const diskRotation = getDiskRotation();
  let rotated = compass - diskRotation;
  if (rotated < 0) rotated += 360;

  for (const sector of SECTORS) {
    if (angleInSector(rotated, sector.start, sector.end)) return sector;
  }
  return null;
}

function getMarkerStats() {
  return {
    windOk: 0,
    waterOk: 0,
    windBad: 0,
    waterBad: 0,
    unknown: 0
  };
}

function updateMarkerList() {
  markerList.innerHTML = "";
  if (markers.length === 0) {
    markerList.innerHTML = "<div class=\"helper\">暂无标记，请先放置。</div>";
    summary.textContent = "";
    return;
  }

  const stats = getMarkerStats();
  const entries = markers.map((marker) => {
    const result = evaluateMarker(marker);
    if (!result.sector) {
      stats.unknown += 1;
    } else if (marker.category === "wind") {
      result.ok ? (stats.windOk += 1) : (stats.windBad += 1);
    } else if (marker.category === "water") {
      result.ok ? (stats.waterOk += 1) : (stats.waterBad += 1);
    }
    return { marker, result };
  });

  const passesFilter = (entry) => {
    const { marker, result } = entry;
    if (currentFilter === "all") return true;
    if (currentFilter === "unknown") return !result.sector;
    if (currentFilter === "ok") return result.ok;
    if (currentFilter === "wind-bad") return marker.category === "wind" && result.sector && !result.ok;
    if (currentFilter === "water-bad") return marker.category === "water" && result.sector && !result.ok;
    return true;
  };

  const filtered = entries.filter(passesFilter);
  if (filtered.length === 0) {
    markerList.innerHTML = "<div class=\"helper\">当前筛选无结果</div>";
  }

  filtered.forEach(({ marker, result }) => {

    const row = document.createElement("div");
    row.className = "marker-row" + (marker.id === selectedMarkerId ? " active" : "");
    row.dataset.id = marker.id;

    const chip = document.createElement("div");
    chip.className = "marker-chip";
    const dot = document.createElement("span");
    dot.className = "chip-dot";
    dot.style.setProperty("--chip-color", marker.color);
    chip.appendChild(dot);
    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = marker.label;
    chip.appendChild(label);

    const meta = document.createElement("div");
    meta.className = "marker-meta";
    if (result.sector) {
      const actualLabel = result.actual === "wind" ? "气位" : "水位";
      meta.textContent = `${result.sector.num} · ${result.sector.name} · ${actualLabel}`;
    } else {
      meta.textContent = "未定位";
    }

    const status = document.createElement("div");
    status.className = "marker-status " + (result.ok ? "ok" : "warn");
    if (marker.category === "neutral") {
      status.textContent = "观察";
    } else {
      status.textContent = result.ok ? "位置合适" : "位置冲突";
    }

    const actions = document.createElement("div");
    actions.className = "marker-actions";
    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      markers = markers.filter((m) => m.id !== marker.id);
      if (selectedMarkerId === marker.id) selectedMarkerId = null;
      updateMarkerList();
      drawAll();
      scheduleAutoSave();
      pushHistory();
    });
    actions.appendChild(delBtn);

    row.appendChild(chip);
    row.appendChild(meta);
    row.appendChild(status);
    row.appendChild(actions);

    row.addEventListener("click", () => {
      selectedMarkerId = marker.id;
      updateMarkerList();
      drawAll();
    });

    markerList.appendChild(row);
  });

  summary.textContent = `气位正确 ${stats.windOk} 项，气位冲突 ${stats.windBad} 项；水位正确 ${stats.waterOk} 项，水位冲突 ${stats.waterBad} 项；未定位 ${stats.unknown} 项。`;
}

function resetRect() {
  rect.active = false;
  rect.x = 0;
  rect.y = 0;
  rect.w = 0;
  rect.h = 0;
  rect.rotation = 0;
  rectRotationInput.value = "0";
  rectRotationSlider.value = "0";
  setStatus("已重置房屋框。");
  updateMarkerList();
  drawAll();
  pushHistory();
}

function addMarkerAt(pos) {
  const typeId = markerTypeSelect?.value;
  const type = MARKER_TYPES.find((t) => t.id === typeId);
  if (!type) return;
  const snappedPos = snapPointToRect(pos);
  markers.push({
    id: markerIdSeed++,
    type: type.id,
    label: type.label,
    short: type.short,
    category: type.category,
    color: type.color,
    x: snappedPos.x,
    y: snappedPos.y
  });
  selectedMarkerId = markers[markers.length - 1].id;
  updateMarkerList();
  drawAll();
  scheduleAutoSave();
  pushHistory();
}

function getMarkerAtPos(pos) {
  const threshold = 10;
  const combined = getCombinedScale();
  for (let i = markers.length - 1; i >= 0; i -= 1) {
    const marker = markers[i];
    const dx = marker.x * combined + viewOffset.x - pos.x;
    const dy = marker.y * combined + viewOffset.y - pos.y;
    if (Math.hypot(dx, dy) <= threshold) return marker;
  }
  return null;
}

function updateCursorStyle(pos) {
  if (panMode) {
    canvas.style.cursor = "grab";
    return;
  }
  if (!rect.active) {
    canvas.style.cursor = "default";
    return;
  }

  const marker = getMarkerAtPos(pos);
  if (marker) {
    canvas.style.cursor = "grab";
    return;
  }

  const imgPos = screenToImage(pos);
  const center = getRectCenter();
  const localPos = rotatePoint(imgPos, center, -rect.rotation);
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const dx = localPos.x - center.x;
  const dy = localPos.y - center.y;
  const handleSize = 8 / getCombinedScale() + 5;

  if ((Math.abs(dx + halfW) < handleSize && Math.abs(dy + halfH) < handleSize) ||
      (Math.abs(dx - halfW) < handleSize && Math.abs(dy - halfH) < handleSize)) {
    canvas.style.cursor = "nwse-resize";
  } else if ((Math.abs(dx - halfW) < handleSize && Math.abs(dy + halfH) < handleSize) ||
             (Math.abs(dx + halfW) < handleSize && Math.abs(dy - halfH) < handleSize)) {
    canvas.style.cursor = "nesw-resize";
  } else if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
    canvas.style.cursor = "move";
  } else {
    canvas.style.cursor = "default";
  }
}

fileInput.addEventListener("change", (e) => {
  if (!e.target.files || !e.target.files[0]) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    img = new Image();
    img.onload = () => {
      imgLoaded = true;
      viewScale = 1;
      viewOffset = { x: 0, y: 0 };
      updateZoomLabel();
      canvasHint.textContent = "使用左侧控制栏开始绘制";
      resizeCanvas();
      updateMarkerList();
      drawAll();
      setActivePanel("base");
      setActiveWorkspace("canvas");
      startDrawRect();
      setStatus("图片已加载，已进入手动框选模式。");
      initHistory();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
});

unitAngleInput.addEventListener("input", (e) => {
  unitAzimuth = parseFloat(e.target.value);
  updateAngleDisplays();
  updateMarkerList();
  drawAll();
  scheduleAutoSave();
  scheduleHistoryPush();
});

doorAngleInput.addEventListener("input", (e) => {
  doorImageAngle = parseFloat(e.target.value);
  updateAngleDisplays();
  updateMarkerList();
  drawAll();
  scheduleAutoSave();
  scheduleHistoryPush();
});

opacitySlider.addEventListener("input", (e) => {
  globalAlpha = parseFloat(e.target.value);
  opacityVal.textContent = `${Math.round(globalAlpha * 100)}%`;
  drawAll();
  scheduleAutoSave();
  scheduleHistoryPush();
});

diskScaleInput.addEventListener("input", (e) => {
  diskScale = Math.max(1, parseFloat(e.target.value));
  diskScaleInput.value = diskScale;
  diskScaleVal.textContent = `${Math.round(diskScale * 100)}%`;
  drawAll();
  scheduleAutoSave();
  scheduleHistoryPush();
});

rectRotationInput.addEventListener("input", (e) => {
  rect.rotation = parseFloat(e.target.value) || 0;
  rectRotationSlider.value = rect.rotation;
  drawAll();
  scheduleAutoSave();
  scheduleHistoryPush();
});

rectRotationSlider.addEventListener("input", (e) => {
  rect.rotation = parseFloat(e.target.value) || 0;
  rectRotationInput.value = rect.rotation;
  drawAll();
  scheduleAutoSave();
  scheduleHistoryPush();
});

btnDrawBox.addEventListener("click", () => {
  if (!imgLoaded) return alert("请先上传图片");
  startDrawRect();
});

btnResetRect.addEventListener("click", () => {
  resetRect();
  updateMarkerList();
  scheduleAutoSave();
});

btnDrawDoor.addEventListener("click", () => {
  if (!imgLoaded) return alert("请先上传图片");
  setMode("drawDoorLine");
  canvas.style.cursor = "crosshair";
  setStatus("模式：绘制门向。请从门内向门外画一条线。");
  setActiveButton(btnDrawDoor);
});

btnPlaceMarker.addEventListener("click", () => {
  if (!imgLoaded) return alert("请先上传图片");
  setMode("placeMarker");
  canvas.style.cursor = "crosshair";
  setStatus("模式：放置标记。点击画布位置放置。");
  setActiveButton(btnPlaceMarker);
});

btnClearMarkers.addEventListener("click", () => {
  markers = [];
  selectedMarkerId = null;
  updateMarkerList();
  drawAll();
  scheduleAutoSave();
  pushHistory();
});

btnExport.addEventListener("click", () => {
  if (!imgLoaded) return alert("请先上传图片");
  const exportCanvas = renderCompositeCanvas();
  if (!exportCanvas) return;
  const link = document.createElement("a");
  link.download = "naqi-output.png";
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
});

function wrapLines(ctx, text, maxWidth) {
  const chars = text.split("");
  const lines = [];
  let line = "";
  chars.forEach((ch) => {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function buildReportCanvas() {
  const composite = renderCompositeCanvas();
  if (!composite) return null;

  const maxImageWidth = 1500;
  const scale = Math.min(1, maxImageWidth / composite.width);
  const imgW = Math.round(composite.width * scale);
  const imgH = Math.round(composite.height * scale);

  const padding = 36;
  const reportWidth = Math.max(imgW + padding * 2, 1000);
  const imageX = Math.round((reportWidth - imgW) / 2);

  const tips = Array.from(document.querySelectorAll(".tips li"))
    .map((li) => li.textContent.trim())
    .filter(Boolean);
  const advice =
    "气位建议放置：门、窗、灶台、沙发、床、书桌、神龛、宠物床等。水位建议放置：水槽、洗手池、马桶、下水管、洗衣机、厕所等。";

  const periodLabel = periodMode === "current" ? "1964-2044" : "2044-2124";
  const headerLines = [
    `生成时间：${new Date().toLocaleString()}`,
    `单元门角度：${formatAngle(unitAzimuth)}   入户门角度：${formatAngle(doorImageAngle)}   盘旋转：${formatAngle(
      getDiskRotation()
    )}   运期：${periodLabel}`
  ];

  const markerLines = markers.length
    ? markers.map((marker, idx) => {
        const result = evaluateMarker(marker);
        const position = result.sector
          ? `${result.sector.num}·${result.sector.name}·${result.actual === "wind" ? "气位" : "水位"}`
          : "未定位";
        const statusText =
          marker.category === "neutral" ? "观察" : result.ok ? "位置合适" : "位置冲突";
        return `${idx + 1}. ${marker.label}：${position}（${statusText}）`;
      })
    : ["暂无标记"];

  const markerDetails = markers.map((marker) => {
    const result = evaluateMarker(marker);
    const position = result.sector
      ? `${result.sector.num}·${result.sector.name}·${result.actual === "wind" ? "气位" : "水位"}`
      : "未定位";
    return { marker, result, position };
  });
  const conflictLines = markerDetails.filter((item) => {
    return item.marker.category !== "neutral" && item.result.sector && !item.result.ok;
  }).map((item) => {
    return `${item.marker.label}：${item.position}（期望 ${item.result.expected === "wind" ? "气位" : "水位"}）`;
  });
  const unknownLines = markerDetails
    .filter((item) => !item.result.sector)
    .map((item) => `${item.marker.label}：未定位`);

  const stats = getMarkerStats();
  markers.forEach((marker) => {
    const result = evaluateMarker(marker);
    if (!result.sector) {
      stats.unknown += 1;
    } else if (marker.category === "wind") {
      result.ok ? (stats.windOk += 1) : (stats.windBad += 1);
    } else if (marker.category === "water") {
      result.ok ? (stats.waterOk += 1) : (stats.waterBad += 1);
    }
  });
  const statsLine = `气位正确 ${stats.windOk} 项，气位冲突 ${stats.windBad} 项；水位正确 ${stats.waterOk} 项，水位冲突 ${stats.waterBad} 项；未定位 ${stats.unknown} 项。`;

  const suggestionLines = [];
  if (!markers.length) {
    suggestionLines.push("当前没有标注，可先放置门、窗、床、灶、沙发等关键点。");
  } else {
    if (stats.windBad > 0) {
      suggestionLines.push("存在气位冲突，建议将气位类标注调整到气位扇区。");
    }
    if (stats.waterBad > 0) {
      suggestionLines.push("存在水位冲突，建议将水位类标注调整到水位扇区。");
    }
    if (stats.unknown > 0) {
      suggestionLines.push("有未定位标注，请确认盘心、房屋框或角度输入。");
    }
    if (stats.windBad === 0 && stats.waterBad === 0 && stats.unknown === 0) {
      suggestionLines.push("当前标注均在合适位置，可继续完善细节。");
    }
  }

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = "14px \"PingFang SC\", sans-serif";
  const contentWidth = reportWidth - padding * 2;

  let textHeight = 0;
  const pushSection = (title, lines) => {
    textHeight += 28;
    lines.forEach((line) => {
      const wrapped = wrapLines(mctx, line, contentWidth);
      textHeight += wrapped.length * 22;
    });
    textHeight += 14;
  };

  pushSection("基础信息", headerLines);
  pushSection("标记判定", [statsLine, ...markerLines]);
  pushSection("冲突清单", conflictLines.length ? conflictLines : ["暂无冲突标记"]);
  if (unknownLines.length) pushSection("未定位标注", unknownLines);
  if (tips.length) pushSection("使用要点", tips);
  pushSection("建议汇总", suggestionLines);
  pushSection("纳气建议", [advice]);

  const reportHeight = padding + 40 + imgH + padding + textHeight + padding;
  const reportCanvas = document.createElement("canvas");
  reportCanvas.width = reportWidth;
  reportCanvas.height = Math.round(reportHeight);
  const rctx = reportCanvas.getContext("2d");

  rctx.fillStyle = "#ffffff";
  rctx.fillRect(0, 0, reportWidth, reportCanvas.height);

  rctx.fillStyle = "#1b1812";
  rctx.font = "bold 24px \"PingFang SC\", sans-serif";
  rctx.fillText("纳气盘判定报告", padding, padding + 6);

  const imageTop = padding + 20;
  rctx.drawImage(composite, 0, 0, composite.width, composite.height, imageX, imageTop, imgW, imgH);

  let y = imageTop + imgH + padding;
  const drawSection = (title, lines) => {
    rctx.fillStyle = "#1b1812";
    rctx.font = "bold 16px \"PingFang SC\", sans-serif";
    rctx.fillText(title, padding, y);
    y += 24;
    rctx.fillStyle = "#3a342a";
    rctx.font = "14px \"PingFang SC\", sans-serif";
    lines.forEach((line) => {
      const wrapped = wrapLines(rctx, line, contentWidth);
      wrapped.forEach((row) => {
        rctx.fillText(row, padding, y);
        y += 22;
      });
    });
    y += 10;
  };

  drawSection("基础信息", headerLines);
  drawSection("标记判定", [statsLine, ...markerLines]);
  drawSection("冲突清单", conflictLines.length ? conflictLines : ["暂无冲突标记"]);
  if (unknownLines.length) drawSection("未定位标注", unknownLines);
  if (tips.length) drawSection("使用要点", tips);
  drawSection("建议汇总", suggestionLines);
  drawSection("纳气建议", [advice]);

  return reportCanvas;
}

function exportReportPng() {
  if (!imgLoaded) return alert("请先上传图片");
  const reportCanvas = buildReportCanvas();
  if (!reportCanvas) return;
  const link = document.createElement("a");
  link.download = "naqi-report.png";
  link.href = reportCanvas.toDataURL("image/png");
  link.click();
}

function exportReportPdf() {
  if (!imgLoaded) return alert("请先上传图片");
  const reportCanvas = buildReportCanvas();
  if (!reportCanvas) return;
  const dataUrl = reportCanvas.toDataURL("image/png");
  const win = window.open("", "_blank");
  if (!win) return alert("无法打开新窗口，请检查浏览器设置");
  const html = [
    "<!doctype html><html><head><title>纳气盘判定报告</title>",
    '<style>body{margin:0;padding:24px;font-family:"PingFang SC",sans-serif;background:#fff;}img{width:100%;max-width:100%;}</style>',
    "</head><body>",
    `<img src="${dataUrl}" />`,
    "<scr" + "ipt>window.onload=function(){window.print();};</scr" + "ipt>",
    "</body></html>"
  ].join("");
  win.document.write(html);
  win.document.close();
}

if (!EMBEDDED_MODE && btnExportConfig) {
  btnExportConfig.addEventListener("click", () => {
    if (!imgLoaded) return alert("请先上传图片");
    const payload = buildConfigPayload();
    const name = getTimestampName();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = name;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);

    let recentPayload = payload;
    if (payload.imageDataUrl && payload.imageDataUrl.length > MAX_RECENT_IMAGE_SIZE) {
      recentPayload = { ...payload, imageDataUrl: null };
    }
    addRecentConfig(recentPayload, name);
    setStatus("项目文件已导出。");
  });
}

if (!EMBEDDED_MODE && btnImportConfig) {
  btnImportConfig.addEventListener("click", () => {
    if (configInput) configInput.click();
  });
}

if (btnExportReportPng) {
  btnExportReportPng.addEventListener("click", exportReportPng);
}

if (btnExportReportPdf) {
  btnExportReportPdf.addEventListener("click", exportReportPdf);
}

if (!EMBEDDED_MODE && btnSaveProject) {
  btnSaveProject.addEventListener("click", () => {
    const name = (projectNameInput?.value || "").trim() || getTimestampName();
    if (!imgLoaded) return alert("请先上传图片");
    const includeImage = projectIncludeImage?.checked ?? true;
    const payload = buildConfigPayload();
    if (!includeImage) payload.imageDataUrl = null;
    if (includeImage && payload.imageDataUrl && payload.imageDataUrl.length > MAX_PROJECT_IMAGE_SIZE) {
      payload.imageDataUrl = null;
      setStatus("底图过大，已仅保存项目参数。");
    }
    const thumbnail = createProjectThumbnail();
    addOrUpdateProject(name, payload, { recordVersion: true, thumbnail });
    if (projectNameInput) projectNameInput.value = name;
    setCurrentProjectName(name);
    scheduleAutoSave();
  });
}

if (!EMBEDDED_MODE && projectNameInput) {
  projectNameInput.addEventListener("blur", () => {
    const name = (projectNameInput.value || "").trim();
    if (name) {
      setCurrentProjectName(name);
      renderProjects();
    }
  });
}

if (!EMBEDDED_MODE && btnClearProjectSearch) {
  btnClearProjectSearch.addEventListener("click", () => {
    if (projectSearchInput) projectSearchInput.value = "";
    renderProjects();
  });
}

if (!EMBEDDED_MODE && projectSearchInput) {
  projectSearchInput.addEventListener("input", () => {
    renderProjects();
  });
}

if (!EMBEDDED_MODE && btnRestoreVersion) {
  btnRestoreVersion.addEventListener("click", () => {
    const currentName = getCurrentProjectName();
    if (!currentName) return;
    const project = loadProjects().find((p) => p.name === currentName);
    if (!project || !project.versions || project.versions.length === 0) return;
    const idx = parseInt(projectVersionSelect?.value || "0", 10);
    const version = project.versions[idx];
    if (version?.payload) {
      applyConfig(version.payload);
      if (projectNameInput) projectNameInput.value = currentName;
      setStatus(`已恢复版本：${formatProjectTime(version.ts)}`);
    }
  });
}

if (!EMBEDDED_MODE && autoSaveEnabled) {
  const saved = localStorage.getItem(AUTO_SAVE_KEY);
  if (saved !== null) autoSaveEnabled.checked = saved === "true";
  autoSaveEnabled.addEventListener("change", () => {
    localStorage.setItem(AUTO_SAVE_KEY, autoSaveEnabled.checked ? "true" : "false");
  });
}

if (!EMBEDDED_MODE && configInput) {
  configInput.addEventListener("change", (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        applyConfig(payload);
        const name = file.name || getTimestampName();
        const projectName = name.replace(/\.[^.]+$/, "");
        if (projectNameInput) projectNameInput.value = projectName;
        setCurrentProjectName(projectName);
        let recentPayload = payload;
        if (payload.imageDataUrl && payload.imageDataUrl.length > MAX_RECENT_IMAGE_SIZE) {
          recentPayload = { ...payload, imageDataUrl: null };
        }
        addRecentConfig(recentPayload, name);
      } catch (err) {
        alert("项目文件解析失败");
      }
    };
    reader.readAsText(file);
  });
}

markerTypeSelect.innerHTML = MARKER_TYPES.map((type) => {
  const tag = type.category === "wind" ? "气" : type.category === "water" ? "水" : "观";
  return `<option value="${type.id}">${type.label}（${tag}）</option>`;
}).join("");

Array.from(diskCenterGroup.querySelectorAll(".seg-btn")).forEach((btn) => {
  btn.addEventListener("click", () => {
    diskCenterGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    diskCenterMode = btn.dataset.center;
    if (diskCenterMode === "custom") {
      setStatus("自定义盘心：按住 Shift 在画布点击设定。");
    }
    updateMarkerList();
    drawAll();
    scheduleAutoSave();
    pushHistory();
  });
});

Array.from(periodGroup.querySelectorAll(".seg-btn")).forEach((btn) => {
  btn.addEventListener("click", () => {
    periodGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    periodMode = btn.dataset.period;
    updateMarkerList();
    drawAll();
    scheduleAutoSave();
    pushHistory();
  });
});

canvas.addEventListener("mousedown", (e) => {
  if (!imgLoaded) return;
  const pos = getMousePos(e);
  const imgPos = screenToImage(pos);
  startPoint = pos;
  isDragging = true;

  if (panMode && e.button === 0) {
    setMode("panning");
    panStart = { x: pos.x, y: pos.y, offsetX: viewOffset.x, offsetY: viewOffset.y };
    canvas.style.cursor = "grabbing";
    return;
  }

  if (mode === "placeMarker") {
    addMarkerAt(imgPos);
    setMode("none");
    setActiveButton(null);
    canvas.style.cursor = "default";
    setStatus("标记已放置。");
    isDragging = false;
    return;
  }

  if (diskCenterMode === "custom" && e.shiftKey) {
    customCenter = imgPos;
    setStatus("已更新自定义盘心。");
    updateMarkerList();
    drawAll();
    isDragging = false;
    setMode("none");
    scheduleAutoSave();
    pushHistory();
    return;
  }

  if (mode === "drawRect") {
    rect.x = imgPos.x;
    rect.y = imgPos.y;
    rect.w = 0;
    rect.h = 0;
    return;
  }

  if (mode === "drawDoorLine") {
    return;
  }

  const hitMarker = getMarkerAtPos(pos);
  if (hitMarker) {
    selectedMarkerId = hitMarker.id;
    dragMarkerId = hitMarker.id;
    setMode("dragMarker");
    canvas.style.cursor = "grabbing";
    updateMarkerList();
    return;
  }

  if (rect.active) {
    const center = getRectCenter();
    const localPos = rotatePoint(imgPos, center, -rect.rotation);
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    const dx = localPos.x - center.x;
    const dy = localPos.y - center.y;
    const handleSize = 8 / getCombinedScale() + 5;

    if (Math.abs(dx + halfW) < handleSize && Math.abs(dy + halfH) < handleSize) {
      setMode("resizingRect");
      activeHandle = "tl";
    } else if (Math.abs(dx - halfW) < handleSize && Math.abs(dy + halfH) < handleSize) {
      setMode("resizingRect");
      activeHandle = "tr";
    } else if (Math.abs(dx - halfW) < handleSize && Math.abs(dy - halfH) < handleSize) {
      setMode("resizingRect");
      activeHandle = "br";
    } else if (Math.abs(dx + halfW) < handleSize && Math.abs(dy - halfH) < handleSize) {
      setMode("resizingRect");
      activeHandle = "bl";
    } else if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
      setMode("movingRect");
      canvas.style.cursor = "move";
    } else {
      setMode("none");
      isDragging = false;
      return;
    }
    initialRectState = { ...rect };
  }

  if (!rect.active) {
    isDragging = false;
    setMode("none");
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!imgLoaded) return;
  const pos = getMousePos(e);
  if (!isDragging) {
    updateCursorStyle(pos);
    return;
  }

  const imgPos = screenToImage(pos);
  const combined = getCombinedScale();
  const deltaX = (pos.x - startPoint.x) / combined;
  const deltaY = (pos.y - startPoint.y) / combined;

  if (mode === "panning" && panStart) {
    viewOffset.x = panStart.offsetX + (pos.x - panStart.x);
    viewOffset.y = panStart.offsetY + (pos.y - panStart.y);
    drawAll();
    return;
  }

  if (mode === "drawRect") {
    rect.w = deltaX;
    rect.h = deltaY;
    drawAll();
    return;
  }

  if (mode === "drawDoorLine") {
    drawAll();
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#d84f4f";
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  if (mode === "movingRect") {
    rect.x = initialRectState.x + deltaX;
    rect.y = initialRectState.y + deltaY;
    drawAll();
    return;
  }

  if (mode === "resizingRect") {
    const rad = (-initialRectState.rotation * Math.PI) / 180;
    const localDx = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
    const localDy = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);

    let newX = initialRectState.x;
    let newY = initialRectState.y;
    let newW = initialRectState.w;
    let newH = initialRectState.h;

    if (activeHandle === "br") {
      newW += localDx;
      newH += localDy;
    } else if (activeHandle === "bl") {
      newX += localDx;
      newW -= localDx;
      newH += localDy;
    } else if (activeHandle === "tr") {
      newY += localDy;
      newH -= localDy;
      newW += localDx;
    } else if (activeHandle === "tl") {
      newX += localDx;
      newY += localDy;
      newW -= localDx;
      newH -= localDy;
    }

    rect.x = newX;
    rect.y = newY;
    rect.w = newW;
    rect.h = newH;
    drawAll();
    return;
  }

  if (mode === "dragMarker") {
    const marker = markers.find((m) => m.id === dragMarkerId);
    if (marker) {
      const snappedPos = snapPointToRect(imgPos);
      marker.x = snappedPos.x;
      marker.y = snappedPos.y;
      drawAll();
    }
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (!imgLoaded) return;
  if (!isDragging) return;
  isDragging = false;

  const pos = getMousePos(e);

  if (mode === "panning") {
    setMode("none");
    canvas.style.cursor = panMode ? "grab" : "default";
    drawAll();
    return;
  }

  if (mode === "drawRect") {
    rect.active = true;
    if (rect.w < 0) {
      rect.x += rect.w;
      rect.w = Math.abs(rect.w);
    }
    if (rect.h < 0) {
      rect.y += rect.h;
      rect.h = Math.abs(rect.h);
    }
    snapRectToImage();
    const combined = getCombinedScale();
    if (rect.w < 5 / combined || rect.h < 5 / combined) {
      rect.active = false;
      setStatus("房屋框过小，请重新绘制。");
    } else {
      setStatus("房屋框已完成，可拖动或微调旋转。");
    }
    setMode("none");
    setActiveButton(null);
    updateMarkerList();
    pushHistory();
  } else if (mode === "drawDoorLine") {
    const dx = pos.x - startPoint.x;
    const dy = pos.y - startPoint.y;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    let mapDeg = deg + 90;
    if (mapDeg < 0) mapDeg += 360;
    doorImageAngle = mapDeg;
    doorAngleInput.value = Math.round(doorImageAngle);
    updateAngleDisplays();
    updateMarkerList();
    setStatus(`入户门角度已设定：${Math.round(doorImageAngle)}°`);
    setMode("none");
    setActiveButton(null);
    pushHistory();
  } else if (mode === "movingRect" || mode === "resizingRect") {
    if (rect.w < 0) {
      rect.x += rect.w;
      rect.w = Math.abs(rect.w);
    }
    if (rect.h < 0) {
      rect.y += rect.h;
      rect.h = Math.abs(rect.h);
    }
    snapRectToImage();
    setMode("none");
    updateMarkerList();
    pushHistory();
  } else if (mode === "dragMarker") {
    setMode("none");
    updateMarkerList();
    pushHistory();
  }

  scheduleAutoSave();
  drawAll();
  canvas.style.cursor = "default";
});

window.addEventListener("resize", () => {
  resizeCanvas();
});

if (canvasShell && "ResizeObserver" in window) {
  const shellObserver = new ResizeObserver(() => {
    resizeCanvas();
  });
  shellObserver.observe(canvasShell);
}

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  const isMod = e.metaKey || e.ctrlKey;

  if (isMod && key === "z" && !e.shiftKey) {
    if (!isEditingTarget(e.target)) {
      e.preventDefault();
      undo();
    }
    return;
  }

  if (isMod && (key === "y" || (key === "z" && e.shiftKey))) {
    if (!isEditingTarget(e.target)) {
      e.preventDefault();
      redo();
    }
    return;
  }

  if (e.key === "Escape") {
    setMode("none");
    setActiveButton(null);
    canvas.style.cursor = "default";
  }
});

function openPreferencesPanel() {
  setActivePanel("base");
  const panel = document.querySelector(".controls");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  setStatus("偏好设置可在左侧面板完成。");
}

function openRecentPanel() {
  setActivePanel("export");
  setActiveWorkspace("analysis");
  const panel = document.getElementById("recentList");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  setStatus("已打开最近项目文件。");
}

function showHelpPanel() {
  setActiveWorkspace("tips");
  const tips = document.querySelector(".tips");
  if (tips) {
    tips.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  setStatus("已定位到使用要点。");
}

function bindTauriMenuEvents() {
  const tauriEvent = window.__TAURI__ && window.__TAURI__.event;
  if (!tauriEvent || !tauriEvent.listen) return;

  tauriEvent.listen("menu-export-png", () => btnExport.click());
  if (!EMBEDDED_MODE && btnExportConfig) tauriEvent.listen("menu-export-config", () => btnExportConfig.click());
  if (!EMBEDDED_MODE && btnImportConfig) tauriEvent.listen("menu-import-config", () => btnImportConfig.click());
  tauriEvent.listen("menu-open-recent", () => openRecentPanel());
  tauriEvent.listen("menu-manual-rect", () => btnDrawBox.click());
  tauriEvent.listen("menu-reset-rect", () => btnResetRect.click());
  tauriEvent.listen("menu-clear-markers", () => btnClearMarkers.click());
  tauriEvent.listen("menu-preferences", () => openPreferencesPanel());
  tauriEvent.listen("menu-show-help", () => showHelpPanel());
}

if (controlTabs) {
  controlTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    setActivePanel(btn.dataset.panel);
  });
}

if (workspaceTabs) {
  workspaceTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    setActiveWorkspace(btn.dataset.view);
  });
}

if (markerFilters) {
  markerFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    markerFilters.querySelectorAll(".filter-btn").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    updateMarkerList();
  });
}

if (btnPanToggle) {
  btnPanToggle.addEventListener("click", () => {
    panMode = !panMode;
    btnPanToggle.classList.toggle("active", panMode);
    canvas.style.cursor = panMode ? "grab" : "default";
    setStatus(panMode ? "拖拽模式：拖动画布移动" : "拖拽模式已关闭");
  });
}

if (btnSnapToggle) {
  btnSnapToggle.addEventListener("click", () => {
    snapEnabled = !snapEnabled;
    btnSnapToggle.classList.toggle("active", snapEnabled);
    setStatus(snapEnabled ? "吸附对齐已开启" : "吸附对齐已关闭");
  });
}

if (btnZoomIn) {
  btnZoomIn.addEventListener("click", () => {
    setViewScale(viewScale * 1.1);
  });
}

if (btnZoomOut) {
  btnZoomOut.addEventListener("click", () => {
    setViewScale(viewScale / 1.1);
  });
}

if (btnZoomReset) {
  btnZoomReset.addEventListener("click", () => {
    resetView();
  });
}

if (quickUpload) quickUpload.addEventListener("click", () => fileInput.click());
if (quickDrawRect) quickDrawRect.addEventListener("click", () => btnDrawBox.click());
if (quickDrawDoor) quickDrawDoor.addEventListener("click", () => btnDrawDoor.click());
if (quickPlaceMarker) quickPlaceMarker.addEventListener("click", () => btnPlaceMarker.click());
if (quickUndo) quickUndo.addEventListener("click", () => undo());
if (quickRedo) quickRedo.addEventListener("click", () => redo());
if (quickExportPng) quickExportPng.addEventListener("click", () => btnExport.click());
if (quickRefresh) quickRefresh.addEventListener("click", () => window.location.reload());

updateMarkerList();
updateAngleDisplays();
setStatus("请上传户型图开始。");
if (!EMBEDDED_MODE) {
  renderRecents();
  const initialProjectName = getCurrentProjectName();
  if (projectNameInput && initialProjectName) projectNameInput.value = initialProjectName;
  setCurrentProjectName(initialProjectName);
  renderProjects();
}
updateUndoButtons();
if (btnSnapToggle) btnSnapToggle.classList.toggle("active", snapEnabled);
bindTauriMenuEvents();
