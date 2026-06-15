const STORAGE_KEY = "mini-program-dashboard-v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
const BRAND_OPTIONS = ["三角洲行动", "无畏契约", "暗区突围", "和平经营"];
const TYPE_OPTIONS = ["默认", "L类"];
const STATUS_OPTIONS = ["正常", "封禁"];
const EMPTY_BRAND_LABEL = "未设置";
const originalData = normalizeData(window.APP_DATA || { meta: {}, dailyRows: [], weeklyRows: [] });

const metricDefs = {
  uv: {
    label: "访问UV",
    dailyPrev: "uvPrev",
    dailyCurrent: "uvToday",
    weeklyPrev: "uvW1",
    weeklyCurrent: "uvW2"
  },
  orders: {
    label: "成交量",
    dailyPrev: "ordersPrev",
    dailyCurrent: "ordersToday",
    weeklyPrev: "ordersW1",
    weeklyCurrent: "ordersW2"
  },
  new: {
    label: "新用户订单",
    dailyPrev: "newPrev",
    dailyCurrent: "newToday",
    weeklyPrev: "newW1",
    weeklyCurrent: "newW2"
  }
};

const els = {
  dashboardTitle: document.getElementById("dashboardTitle"),
  sourceLine: document.getElementById("sourceLine"),
  saveState: document.getElementById("saveState"),
  metricSelect: document.getElementById("metricSelect"),
  personFilter: document.getElementById("personFilter"),
  brandFilter: document.getElementById("brandFilter"),
  typeFilter: document.getElementById("typeFilter"),
  statusFilter: document.getElementById("statusFilter"),
  searchInput: document.getElementById("searchInput"),
  kpiGrid: document.getElementById("kpiGrid"),
  dailyKpis: document.getElementById("dailyKpis"),
  weeklyKpis: document.getElementById("weeklyKpis")
};

let state = loadState();
let activeView = "overview";

function inferType(row) {
  return String(row?.type || row?.name || "").includes("L类") ? "L类" : "默认";
}

function normalizeStatus(value) {
  return String(value || "").includes("封禁") ? "封禁" : "正常";
}

function normalizeRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: row.id || `row-${Date.now()}-${index}`,
    brandCategory: BRAND_OPTIONS.includes(row.brandCategory) ? row.brandCategory : "",
    type: TYPE_OPTIONS.includes(row.type) ? row.type : inferType(row),
    status: normalizeStatus(row.status)
  }));
}

function normalizeData(data) {
  return {
    meta: {
      ...clone(data.meta || {}),
      title: data.meta?.title || "小程序数据驾驶舱",
      subtitle: data.meta?.subtitle || ""
    },
    dailyRows: normalizeRows(data.dailyRows),
    weeklyRows: normalizeRows(data.weeklyRows)
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.dailyRows) && Array.isArray(saved.weeklyRows)) {
      return normalizeData({ meta: { ...clone(originalData.meta), ...clone(saved.meta || {}) }, dailyRows: saved.dailyRows, weeklyRows: saved.weeklyRows });
    }
  } catch (error) {
    console.warn(error);
  }
  return normalizeData(originalData);
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ meta: state.meta, dailyRows: state.dailyRows, weeklyRows: state.weeklyRows })
  );
  els.saveState.textContent = `已保存 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numberValue(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return Math.round(numberValue(value)).toLocaleString("zh-CN");
}

function percent(current, previous) {
  const curr = numberValue(current);
  const prev = numberValue(previous);
  if (prev === 0 && curr === 0) return { value: 0, label: "0.0%", cls: "flat" };
  if (prev === 0) return { value: null, label: "新增", cls: "up" };
  const value = ((curr - prev) / prev) * 100;
  return {
    value,
    label: `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`,
    cls: value > 0 ? "up" : value < 0 ? "down" : "flat"
  };
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + numberValue(row[key]), 0);
}

function currentMetric() {
  return metricDefs[els.metricSelect.value] || metricDefs.uv;
}

function filterText() {
  return els.searchInput.value.trim().toLowerCase();
}

function rowMatchesCommon(row, type) {
  const person = els.personFilter.value;
  const brand = els.brandFilter.value;
  const rowType = els.typeFilter.value;
  const status = els.statusFilter.value;
  const q = filterText();
  const personValue = type === "weekly" ? `${row.person || ""} ${row.owner || ""}` : row.owner || "";
  if (person !== "all" && !personValue.includes(person)) return false;
  if (brand !== "all" && (row.brandCategory || EMPTY_BRAND_LABEL) !== brand) return false;
  if (rowType !== "all" && row.type !== rowType) return false;
  if (status !== "all" && row.status !== status) return false;
  if (q && !String(row.name || "").toLowerCase().includes(q)) return false;
  return true;
}

function dailyRows() {
  return state.dailyRows.filter((row) => rowMatchesCommon(row, "daily"));
}

function weeklyRows() {
  return state.weeklyRows.filter((row) => rowMatchesCommon(row, "weekly"));
}

function statusClass(status) {
  if (status === "封禁") return "danger";
  return "";
}

function statusPill(status) {
  return `<span class="status-pill ${statusClass(status)}">${escapeHtml(status || "未填")}</span>`;
}

function editableText(type, id, field, value) {
  return `<span class="inline-edit" contenteditable="true" data-kind="text" data-type="${type}" data-id="${escapeHtml(id)}" data-field="${field}">${escapeHtml(value || "")}</span>`;
}

function editableSelect(type, id, field, value, options, placeholder = "") {
  const optionHtml = [
    placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "",
    ...options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`)
  ].join("");
  return `<select class="inline-select" data-type="${type}" data-id="${escapeHtml(id)}" data-field="${field}">${optionHtml}</select>`;
}

function renderFilters() {
  const currentPerson = els.personFilter.value || "all";
  const currentBrand = els.brandFilter.value || "all";
  const currentType = els.typeFilter.value || "all";
  const currentStatus = els.statusFilter.value || "all";
  const people = new Set();
  const brands = new Set(BRAND_OPTIONS);
  const types = new Set(TYPE_OPTIONS);
  const statuses = new Set(STATUS_OPTIONS);
  state.dailyRows.forEach((row) => {
    if (row.owner) people.add(row.owner);
    brands.add(row.brandCategory || EMPTY_BRAND_LABEL);
    if (row.type) types.add(row.type);
    if (row.status) statuses.add(row.status);
  });
  state.weeklyRows.forEach((row) => {
    if (row.person) people.add(row.person);
    if (row.owner) people.add(row.owner);
    brands.add(row.brandCategory || EMPTY_BRAND_LABEL);
    if (row.type) types.add(row.type);
    if (row.status) statuses.add(row.status);
  });
  els.personFilter.innerHTML =
    `<option value="all">全部</option>` +
    [...people].sort((a, b) => a.localeCompare(b, "zh-CN")).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  els.brandFilter.innerHTML =
    `<option value="all">全部</option>` +
    [...brands].map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  els.typeFilter.innerHTML =
    `<option value="all">全部</option>` +
    [...types].map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  els.statusFilter.innerHTML =
    `<option value="all">全部</option>` +
    [...statuses].sort((a, b) => a.localeCompare(b, "zh-CN")).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  els.personFilter.value = people.has(currentPerson) ? currentPerson : "all";
  els.brandFilter.value = brands.has(currentBrand) ? currentBrand : "all";
  els.typeFilter.value = types.has(currentType) ? currentType : "all";
  els.statusFilter.value = statuses.has(currentStatus) ? currentStatus : "all";
}

function kpiCard(label, current, previous, suffix) {
  const change = percent(current, previous);
  return `
    <article class="kpi-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(current)}</strong>
      <small class="${change.cls}">${change.label} ${escapeHtml(suffix)}</small>
    </article>
  `;
}

function plainKpiCard(label, current, note) {
  return `
    <article class="kpi-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(current)}</strong>
      <small class="flat">${escapeHtml(note)}</small>
    </article>
  `;
}

function renderKpis() {
  const dRows = dailyRows();
  const wRows = weeklyRows();
  els.kpiGrid.innerHTML = [
    kpiCard("每日访问UV", sum(dRows, "uvToday"), sum(dRows, "uvPrev"), "较6月5日"),
    kpiCard("每日咨询UV", sum(dRows, "consultToday"), sum(dRows, "consultPrev"), "较6月5日"),
    kpiCard("每日成交量", sum(dRows, "ordersToday"), sum(dRows, "ordersPrev"), "较6月5日"),
    kpiCard("每日新用户订单", sum(dRows, "newToday"), sum(dRows, "newPrev"), "较6月5日"),
    kpiCard("每周访问UV", sum(wRows, "uvW2"), sum(wRows, "uvW1"), "周环比"),
    kpiCard("每周成交量", sum(wRows, "ordersW2"), sum(wRows, "ordersW1"), "周环比"),
    kpiCard("每周新用户订单", sum(wRows, "newW2"), sum(wRows, "newW1"), "周环比")
  ].join("");

  els.dailyKpis.innerHTML = [
    kpiCard("访问UV", sum(dRows, "uvToday"), sum(dRows, "uvPrev"), "较6月5日"),
    kpiCard("咨询UV", sum(dRows, "consultToday"), sum(dRows, "consultPrev"), "较6月5日"),
    kpiCard("成交量", sum(dRows, "ordersToday"), sum(dRows, "ordersPrev"), "较6月5日"),
    kpiCard("新用户订单", sum(dRows, "newToday"), sum(dRows, "newPrev"), "较6月5日")
  ].join("");

  els.weeklyKpis.innerHTML = [
    kpiCard("访问UV", sum(wRows, "uvW2"), sum(wRows, "uvW1"), "周环比"),
    kpiCard("成交量", sum(wRows, "ordersW2"), sum(wRows, "ordersW1"), "周环比"),
    kpiCard("新用户订单", sum(wRows, "newW2"), sum(wRows, "newW1"), "周环比"),
    plainKpiCard("品牌数", wRows.length, "当前筛选")
  ].join("");
}

function sortedComparisonRows(rows, prevKey, currentKey, limit = 12) {
  return rows
    .map((row) => ({
      label: row.name,
      previous: numberValue(row[prevKey]),
      current: numberValue(row[currentKey]),
      status: row.status,
      person: row.person || row.owner || ""
    }))
    .sort((a, b) => b.current - a.current)
    .slice(0, limit);
}

function growthRows() {
  const metric = currentMetric();
  const daily = dailyRows().map((row) => {
    const p = percent(row[metric.dailyCurrent], row[metric.dailyPrev]);
    return {
      id: row.id,
      sourceType: "daily",
      type: "每日",
      name: row.name,
      owner: row.owner,
      brandCategory: row.brandCategory,
      rowType: row.type,
      previous: numberValue(row[metric.dailyPrev]),
      current: numberValue(row[metric.dailyCurrent]),
      change: p.value,
      changeLabel: p.label,
      cls: p.cls,
      status: row.status
    };
  });
  const weekly = weeklyRows().map((row) => {
    const p = percent(row[metric.weeklyCurrent], row[metric.weeklyPrev]);
    return {
      id: row.id,
      sourceType: "weekly",
      type: "每周",
      name: row.name,
      owner: row.person,
      brandCategory: row.brandCategory,
      rowType: row.type,
      previous: numberValue(row[metric.weeklyPrev]),
      current: numberValue(row[metric.weeklyCurrent]),
      change: p.value,
      changeLabel: p.label,
      cls: p.cls,
      status: row.status
    };
  });
  return daily.concat(weekly).filter((row) => row.previous > 0 || row.current > 0);
}

function renderOverviewTable() {
  const rows = growthRows();
  const finite = rows.filter((row) => Number.isFinite(row.change));
  const top = finite.sort((a, b) => b.change - a.change).slice(0, 8);
  const bottom = finite.sort((a, b) => a.change - b.change).slice(0, 8);
  const combined = top.concat(bottom);
  document.getElementById("overviewCount").textContent = `${combined.length} 条`;
  renderTable(
    document.getElementById("overviewTable"),
    ["周期", "品牌名称", "负责人", "品牌分类", "类型", "基期", "当前", "环比", "状态"],
    combined.map((row) => [
      row.type,
      editableText(row.sourceType, row.id, "name", row.name),
      editableText(row.sourceType, row.id, row.sourceType === "weekly" ? "person" : "owner", row.owner),
      editableSelect(row.sourceType, row.id, "brandCategory", row.brandCategory, BRAND_OPTIONS, "请选择"),
      editableSelect(row.sourceType, row.id, "type", row.rowType, TYPE_OPTIONS),
      formatNumber(row.previous),
      formatNumber(row.current),
      `<span class="${row.cls}">${row.changeLabel}</span>`,
      editableSelect(row.sourceType, row.id, "status", row.status, STATUS_OPTIONS)
    ]),
    [5, 6]
  );
}

function renderDailyTable() {
  const metric = currentMetric();
  const rows = dailyRows().sort((a, b) => numberValue(b[metric.dailyCurrent]) - numberValue(a[metric.dailyCurrent]));
  document.getElementById("dailyCount").textContent = `${rows.length} 条`;
  renderTable(
    document.getElementById("dailyTable"),
    ["品牌名称", "负责人", "品牌分类", "类型", "状态", "6月5日访问UV", "今日访问UV", "访问环比", "今日咨询UV", "今日成交量", "今日新客", "刷量数", "备注"],
    rows.map((row) => {
      const change = percent(row.uvToday, row.uvPrev);
      return [
        editableText("daily", row.id, "name", row.name),
        editableText("daily", row.id, "owner", row.owner),
        editableSelect("daily", row.id, "brandCategory", row.brandCategory, BRAND_OPTIONS, "请选择"),
        editableSelect("daily", row.id, "type", row.type, TYPE_OPTIONS),
        editableSelect("daily", row.id, "status", row.status, STATUS_OPTIONS),
        formatNumber(row.uvPrev),
        formatNumber(row.uvToday),
        `<span class="${change.cls}">${change.label}</span>`,
        formatNumber(row.consultToday),
        formatNumber(row.ordersToday),
        formatNumber(row.newToday),
        row.brushCount ? formatNumber(row.brushCount) : "",
        editableText("daily", row.id, "note", row.note || "")
      ];
    }),
    [5, 6, 8, 9, 10, 11]
  );
}

function weeklyPersonSummary() {
  const groups = new Map();
  weeklyRows().forEach((row) => {
    const key = row.person || row.owner || "未填";
    if (!groups.has(key)) {
      groups.set(key, { person: key, count: 0, uvW1: 0, uvW2: 0, ordersW1: 0, ordersW2: 0, newW1: 0, newW2: 0 });
    }
    const item = groups.get(key);
    item.count += 1;
    ["uvW1", "uvW2", "ordersW1", "ordersW2", "newW1", "newW2"].forEach((keyName) => {
      item[keyName] += numberValue(row[keyName]);
    });
  });
  return [...groups.values()].sort((a, b) => b.uvW2 - a.uvW2);
}

function renderWeeklyTables() {
  const metric = currentMetric();
  const summary = weeklyPersonSummary();
  document.getElementById("personSummaryCount").textContent = `${summary.length} 人`;
  renderTable(
    document.getElementById("personSummaryTable"),
    ["负责人", "品牌数", "访问UV", "访问环比", "成交量", "成交环比", "新用户订单", "新客环比"],
    summary.map((row) => {
      const uv = percent(row.uvW2, row.uvW1);
      const orders = percent(row.ordersW2, row.ordersW1);
      const fresh = percent(row.newW2, row.newW1);
      return [
        row.person,
        formatNumber(row.count),
        formatNumber(row.uvW2),
        `<span class="${uv.cls}">${uv.label}</span>`,
        formatNumber(row.ordersW2),
        `<span class="${orders.cls}">${orders.label}</span>`,
        formatNumber(row.newW2),
        `<span class="${fresh.cls}">${fresh.label}</span>`
      ];
    }),
    [1, 2, 4, 6]
  );

  const rows = weeklyRows().sort((a, b) => numberValue(b[metric.weeklyCurrent]) - numberValue(a[metric.weeklyCurrent]));
  document.getElementById("weeklyCount").textContent = `${rows.length} 条`;
  renderTable(
    document.getElementById("weeklyTable"),
    ["品牌名称", "负责人", "品牌分类", "类型", "状态", "W1访问UV", "W2访问UV", "访问环比", "W1成交", "W2成交", "成交环比", "W1新客", "W2新客", "新客环比"],
    rows.map((row) => {
      const uv = percent(row.uvW2, row.uvW1);
      const orders = percent(row.ordersW2, row.ordersW1);
      const fresh = percent(row.newW2, row.newW1);
      return [
        editableText("weekly", row.id, "name", row.name),
        editableText("weekly", row.id, "person", row.person),
        editableSelect("weekly", row.id, "brandCategory", row.brandCategory, BRAND_OPTIONS, "请选择"),
        editableSelect("weekly", row.id, "type", row.type, TYPE_OPTIONS),
        editableSelect("weekly", row.id, "status", row.status, STATUS_OPTIONS),
        formatNumber(row.uvW1),
        formatNumber(row.uvW2),
        `<span class="${uv.cls}">${uv.label}</span>`,
        formatNumber(row.ordersW1),
        formatNumber(row.ordersW2),
        `<span class="${orders.cls}">${orders.label}</span>`,
        formatNumber(row.newW1),
        formatNumber(row.newW2),
        `<span class="${fresh.cls}">${fresh.label}</span>`
      ];
    }),
    [5, 6, 8, 9, 11, 12]
  );
}

function renderTable(table, headers, rows, numericIndexes = []) {
  const head = `<thead><tr>${headers.map((header, index) => `<th class="${numericIndexes.includes(index) ? "num" : ""}">${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
  if (!rows.length) {
    table.innerHTML = `${head}<tbody><tr><td class="empty-cell" colspan="${headers.length}">暂无数据</td></tr></tbody>`;
    return;
  }
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) => `<td data-label="${escapeHtml(headers[index])}" class="${numericIndexes.includes(index) ? "num" : ""}">${typeof cell === "string" && /<[^>]+>/.test(cell) ? cell : escapeHtml(cell)}</td>`)
          .join("")}</tr>`
    )
    .join("");
  table.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function renderEditableTables() {
  const dRows = dailyRows();
  const wRows = weeklyRows();
  document.getElementById("dailyEditCount").textContent = `${dRows.length} 条`;
  document.getElementById("weeklyEditCount").textContent = `${wRows.length} 条`;
  renderEditableTable(document.getElementById("dailyEditTable"), dRows, "daily", [
    ["name", "品牌", "text"],
    ["owner", "负责人", "text"],
    ["brandCategory", "品牌分类", "select", BRAND_OPTIONS, "请选择"],
    ["type", "类型", "select", TYPE_OPTIONS],
    ["status", "状态", "select", STATUS_OPTIONS],
    ["uvPrev", "6月5日UV", "number"],
    ["uvToday", "今日UV", "number"],
    ["consultPrev", "6月5日咨询", "number"],
    ["consultToday", "今日咨询", "number"],
    ["ordersPrev", "6月5日成交", "number"],
    ["ordersToday", "今日成交", "number"],
    ["newPrev", "6月5日新客", "number"],
    ["newToday", "今日新客", "number"],
    ["brushCount", "刷量数", "number"],
    ["note", "备注", "text"]
  ]);
  renderEditableTable(document.getElementById("weeklyEditTable"), wRows, "weekly", [
    ["name", "品牌", "text"],
    ["person", "负责人", "text"],
    ["brandCategory", "品牌分类", "select", BRAND_OPTIONS, "请选择"],
    ["type", "类型", "select", TYPE_OPTIONS],
    ["status", "状态", "select", STATUS_OPTIONS],
    ["uvW1", "W1访问UV", "number"],
    ["uvW2", "W2访问UV", "number"],
    ["ordersW1", "W1成交量", "number"],
    ["ordersW2", "W2成交量", "number"],
    ["newW1", "W1新客", "number"],
    ["newW2", "W2新客", "number"]
  ]);
}

function renderEditableTable(table, rows, type, columns) {
  const headers = columns.map((col) => col[1]).concat([""]);
  const head = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
  if (!rows.length) {
    table.innerHTML = `${head}<tbody><tr><td class="empty-cell" colspan="${headers.length}">暂无数据</td></tr></tbody>`;
    return;
  }
  const body = rows
    .map((row) => {
      const cells = columns
        .map(([field, headerLabel, kind, options = [], placeholder = ""]) => {
          const label = headerLabel || field;
          if (kind === "select") {
            return `<td data-label="${escapeHtml(label)}">${editableSelect(type, row.id, field, row[field], options, placeholder)}</td>`;
          }
          const value = kind === "number" ? numberValue(row[field]) : row[field] || "";
          return `<td contenteditable="true" data-label="${escapeHtml(label)}" data-kind="${kind}" data-type="${type}" data-id="${escapeHtml(row.id)}" data-field="${field}" class="${kind === "number" ? "num" : ""}">${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr>${cells}<td data-label="操作"><button class="delete-row" type="button" data-delete="${type}" data-id="${escapeHtml(row.id)}">×</button></td></tr>`;
    })
    .join("");
  table.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function renderCharts() {
  const metric = currentMetric();
  document.getElementById("dailyChartLabel").textContent = metric.label;
  document.getElementById("weeklyChartLabel").textContent = metric.label;
  document.getElementById("growthChartLabel").textContent = metric.label;
  drawComparisonBars(
    document.getElementById("dailyChart"),
    sortedComparisonRows(dailyRows(), metric.dailyPrev, metric.dailyCurrent, 10),
    state.meta.dailyPeriod?.baseline || "基期",
    state.meta.dailyPeriod?.current || "当前",
    "#64748b",
    "#22d3ee"
  );
  drawComparisonBars(
    document.getElementById("weeklyChart"),
    sortedComparisonRows(weeklyRows(), metric.weeklyPrev, metric.weeklyCurrent, 10),
    "6月1日-6月7日",
    "6月8日-6月14日",
    "#64748b",
    "#60a5fa"
  );
  const personItems = weeklyPersonSummary()
    .map((row) => ({ label: row.person, value: row[metric.weeklyCurrent] || 0 }))
    .sort((a, b) => b.value - a.value);
  drawSingleBars(document.getElementById("personChart"), personItems, "#fbbf24");
  const growth = growthRows()
    .filter((row) => Number.isFinite(row.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10)
    .map((row) => ({ label: `${row.type} ${row.name}`, value: row.change }));
  drawDivergingBars(document.getElementById("growthChart"), growth);
}

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.font = "12px Microsoft YaHei, Segoe UI, Arial, sans-serif";
  ctx.textBaseline = "middle";
  return { ctx, width: rect.width, height: rect.height };
}

function noChartData(ctx, width, height) {
  ctx.fillStyle = "#8ea7bd";
  ctx.textAlign = "center";
  ctx.fillText("暂无数据", width / 2, height / 2);
}

function shortLabel(label, size = 10) {
  const text = String(label || "");
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function drawComparisonBars(canvas, rows, prevLabel, currentLabel, prevColor, currentColor) {
  const { ctx, width, height } = canvasContext(canvas);
  if (!rows.length) return noChartData(ctx, width, height);
  const compact = width < 520;
  const left = compact ? 76 : 112;
  const right = compact ? 34 : 56;
  const top = 22;
  const bottom = 30;
  const chartWidth = Math.max(80, width - left - right);
  const rowHeight = (height - top - bottom) / rows.length;
  const max = Math.max(1, ...rows.flatMap((row) => [row.previous, row.current]));
  ctx.fillStyle = "#8ea7bd";
  ctx.textAlign = "right";
  rows.forEach((row, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    const barH = Math.min(12, rowHeight * 0.28);
    ctx.fillStyle = "#c7d7e5";
    ctx.fillText(shortLabel(row.label, compact ? 6 : 11), left - 10, y);
    ctx.fillStyle = prevColor;
    ctx.fillRect(left, y - barH - 2, (row.previous / max) * chartWidth, barH);
    ctx.fillStyle = currentColor;
    ctx.fillRect(left, y + 2, (row.current / max) * chartWidth, barH);
    ctx.fillStyle = "#dff8ff";
    ctx.textAlign = "left";
    if (!compact || index % 2 === 0) {
      ctx.fillText(formatNumber(row.current), left + (row.current / max) * chartWidth + 6, y + 2 + barH / 2);
    }
    ctx.textAlign = "right";
  });
  drawLegend(ctx, width, height, [
    [prevLabel, prevColor],
    [currentLabel, currentColor]
  ]);
}

function drawSingleBars(canvas, rows, color) {
  const { ctx, width, height } = canvasContext(canvas);
  if (!rows.length) return noChartData(ctx, width, height);
  const compact = width < 520;
  const left = compact ? 66 : 92;
  const right = compact ? 34 : 56;
  const top = 24;
  const bottom = 24;
  const chartWidth = Math.max(80, width - left - right);
  const rowHeight = (height - top - bottom) / rows.length;
  const max = Math.max(1, ...rows.map((row) => row.value));
  rows.forEach((row, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    const barH = Math.min(16, rowHeight * 0.42);
    ctx.fillStyle = "#c7d7e5";
    ctx.textAlign = "right";
    ctx.fillText(shortLabel(row.label, compact ? 5 : 8), left - 10, y);
    ctx.fillStyle = color;
    ctx.fillRect(left, y - barH / 2, (row.value / max) * chartWidth, barH);
    ctx.fillStyle = "#dff8ff";
    ctx.textAlign = "left";
    if (!compact || index % 2 === 0) {
      ctx.fillText(formatNumber(row.value), left + (row.value / max) * chartWidth + 6, y);
    }
  });
}

function drawDivergingBars(canvas, rows) {
  const { ctx, width, height } = canvasContext(canvas);
  if (!rows.length) return noChartData(ctx, width, height);
  const compact = width < 520;
  const left = compact ? 82 : 126;
  const right = compact ? 42 : 64;
  const top = 22;
  const bottom = 26;
  const chartWidth = Math.max(120, width - left - right);
  const zeroX = left + chartWidth / 2;
  const rowHeight = (height - top - bottom) / rows.length;
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  ctx.strokeStyle = "rgba(125, 211, 252, 0.36)";
  ctx.beginPath();
  ctx.moveTo(zeroX, top - 6);
  ctx.lineTo(zeroX, height - bottom + 6);
  ctx.stroke();
  rows.forEach((row, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    const barH = Math.min(16, rowHeight * 0.44);
    const len = (Math.abs(row.value) / maxAbs) * (chartWidth / 2);
    ctx.fillStyle = "#c7d7e5";
    ctx.textAlign = "right";
    ctx.fillText(shortLabel(row.label, compact ? 7 : 12), left - 10, y);
    ctx.fillStyle = row.value >= 0 ? "#34d399" : "#fb7185";
    ctx.fillRect(row.value >= 0 ? zeroX : zeroX - len, y - barH / 2, len, barH);
    ctx.fillStyle = "#dff8ff";
    ctx.textAlign = row.value >= 0 ? "left" : "right";
    if (!compact || index % 2 === 0) {
      ctx.fillText(`${row.value >= 0 ? "+" : ""}${row.value.toFixed(1)}%`, row.value >= 0 ? zeroX + len + 6 : zeroX - len - 6, y);
    }
  });
}

function drawLegend(ctx, width, height, items) {
  let x = 16;
  const y = height - 14;
  ctx.textAlign = "left";
  items.forEach(([label, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 5, 12, 10);
    ctx.fillStyle = "#8ea7bd";
    ctx.fillText(label, x + 18, y);
    x += ctx.measureText(label).width + 48;
  });
}

function defaultSubtitle() {
  const meta = state.meta || {};
  return `每日 ${state.dailyRows.length} 条 · 每周 ${state.weeklyRows.length} 条 · ${meta.dailyPeriod?.baseline || "基期"} / ${meta.dailyPeriod?.current || "当前"} · ${meta.weeklyPeriod?.baseline || "W1"} / ${meta.weeklyPeriod?.current || "W2"}`;
}

function updateHeaderText() {
  const title = state.meta?.title || "小程序数据驾驶舱";
  const subtitle = state.meta?.subtitle || defaultSubtitle();
  if (document.activeElement !== els.dashboardTitle) {
    els.dashboardTitle.textContent = title;
  }
  if (document.activeElement !== els.sourceLine) {
    els.sourceLine.textContent = subtitle;
  }
  document.title = title;
}

function renderAll() {
  updateHeaderText();
  renderFilters();
  renderKpis();
  renderOverviewTable();
  renderDailyTable();
  renderWeeklyTables();
  renderEditableTables();
  renderCharts();
}

function setView(view) {
  activeView = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === view);
  });
  requestAnimationFrame(renderCharts);
}

function findRow(type, id) {
  const rows = type === "daily" ? state.dailyRows : state.weeklyRows;
  return rows.find((row) => row.id === id);
}

function updateRowField(type, id, field, rawValue, kind = "text") {
  const row = findRow(type, id);
  if (!row) return;
  row[field] = kind === "number" ? numberValue(rawValue) : String(rawValue ?? "").trim();
  if (field === "person" && type === "weekly") row.owner = row.person;
  saveState();
  renderAll();
}

function deleteRow(type, id) {
  const rows = type === "daily" ? state.dailyRows : state.weeklyRows;
  const index = rows.findIndex((row) => row.id === id);
  if (index >= 0) {
    rows.splice(index, 1);
    saveState();
    renderAll();
  }
}

function addDailyRow() {
  state.dailyRows.unshift({
    id: `daily-${Date.now()}`,
    name: "新品牌",
    owner: "",
    brandCategory: "",
    type: "默认",
    status: "正常",
    uvPrev: 0,
    uvToday: 0,
    consultPrev: 0,
    consultToday: 0,
    ordersPrev: 0,
    ordersToday: 0,
    newPrev: 0,
    newToday: 0,
    brushCount: 0,
    note: ""
  });
  saveState();
  renderAll();
  setView("edit");
}

function addWeeklyRow() {
  state.weeklyRows.unshift({
    id: `weekly-${Date.now()}`,
    name: "新品牌",
    person: "未分配",
    owner: "未分配",
    brandCategory: "",
    type: "默认",
    status: "正常",
    uvW1: 0,
    uvW2: 0,
    ordersW1: 0,
    ordersW2: 0,
    newW1: 0,
    newW2: 0
  });
  saveState();
  renderAll();
  setView("edit");
}

function exportData() {
  const blob = new Blob([JSON.stringify({ meta: state.meta, dailyRows: state.dailyRows, weeklyRows: state.weeklyRows }, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "mini-program-dashboard-data.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

[els.metricSelect, els.personFilter, els.brandFilter, els.typeFilter, els.statusFilter, els.searchInput].forEach((control) => {
  control.addEventListener("input", renderAll);
  control.addEventListener("change", renderAll);
});

document.getElementById("saveBtn").addEventListener("click", saveState);
document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("addDailyBtn").addEventListener("click", addDailyRow);
document.getElementById("addWeeklyBtn").addEventListener("click", addWeeklyRow);
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("还原为原始数据？")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = clone(originalData);
  els.saveState.textContent = "已还原";
  renderAll();
});

document.addEventListener("focusout", (event) => {
  const metaEditable = event.target.closest("[contenteditable='true'][data-meta-field]");
  if (metaEditable) {
    const field = metaEditable.dataset.metaField;
    state.meta[field] = metaEditable.textContent.trim();
    saveState();
    renderAll();
    return;
  }
  const editable = event.target.closest("[contenteditable='true'][data-field]");
  if (!editable) return;
  updateRowField(editable.dataset.type, editable.dataset.id, editable.dataset.field, editable.textContent, editable.dataset.kind);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("[contenteditable='true'][data-field], [contenteditable='true'][data-meta-field]")) {
    event.preventDefault();
    event.target.blur();
  }
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-field][data-type]");
  if (!select) return;
  updateRowField(select.dataset.type, select.dataset.id, select.dataset.field, select.value, "text");
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  if (confirm("删除这条数据？")) deleteRow(button.dataset.delete, button.dataset.id);
});

window.addEventListener("resize", () => requestAnimationFrame(renderCharts));

renderAll();
