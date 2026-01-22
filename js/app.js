// Using CoinGecko Pro API with API key
const COINGECKO_BASE = "https://pro-api.coingecko.com/api/v3";
const COINGECKO_API_KEY = "662d117f4ec433bbc41c795decbb2501a24aae225cda10adf23006636932f203";
const CACHE_TTL_MS = 30 * 1000;
const MAX_FAVORITES = 5;
let USE_DEMO_MODE = false; // Will auto-enable if API fails
let apiFailureCount = 0; // Track consecutive failures

let allAssets = [];
let viewAssets = [];
let favorites = loadFavorites();

let chart;
let chartSeries = {};
let liveTimer = null;

// Sample demo data
function getDemoData() {
  return {
    data: [
      { id: "bitcoin", rank: "1", symbol: "BTC", name: "Bitcoin", priceUsd: "43250.50", changePercent24Hr: "2.45", supply: "19000000", marketCapUsd: "821757500000" },
      { id: "ethereum", rank: "2", symbol: "ETH", name: "Ethereum", priceUsd: "2280.75", changePercent24Hr: "-1.23", supply: "120000000", marketCapUsd: "273690000000" },
      { id: "tether", rank: "3", symbol: "USDT", name: "Tether", priceUsd: "1.00", changePercent24Hr: "0.01", supply: "91000000000", marketCapUsd: "91000000000" },
      { id: "binance-coin", rank: "4", symbol: "BNB", name: "BNB", priceUsd: "315.20", changePercent24Hr: "3.67", supply: "166801148", marketCapUsd: "52567561648" },
      { id: "solana", rank: "5", symbol: "SOL", name: "Solana", priceUsd: "98.45", changePercent24Hr: "5.12", supply: "411000000", marketCapUsd: "40462950000" },
      { id: "ripple", rank: "6", symbol: "XRP", name: "XRP", priceUsd: "0.52", changePercent24Hr: "-0.89", supply: "99988120490", marketCapUsd: "51993822655" },
      { id: "usd-coin", rank: "7", symbol: "USDC", name: "USD Coin", priceUsd: "1.00", changePercent24Hr: "0.00", supply: "25000000000", marketCapUsd: "25000000000" },
      { id: "cardano", rank: "8", symbol: "ADA", name: "Cardano", priceUsd: "0.48", changePercent24Hr: "1.87", supply: "35000000000", marketCapUsd: "16800000000" },
      { id: "dogecoin", rank: "9", symbol: "DOGE", name: "Dogecoin", priceUsd: "0.085", changePercent24Hr: "4.23", supply: "142000000000", marketCapUsd: "12070000000" },
      { id: "avalanche", rank: "10", symbol: "AVAX", name: "Avalanche", priceUsd: "37.20", changePercent24Hr: "2.90", supply: "350000000", marketCapUsd: "13020000000" }
    ]
  };
}

// unified fetch with API key
async function fetchJson(url) {
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-cg-pro-api-key': COINGECKO_API_KEY
      },
      mode: 'cors'
    });
    if (!r.ok) throw new Error("HTTP status " + r.status);
    return await r.json();
  } catch (e) {
    // Only log detailed error on first failure
    if (apiFailureCount === 0) {
      console.error("⚠️ API Connection Failed:", e.message);
      console.warn("This might be due to: network firewall, CORS policy, or no internet");
      console.warn("💡 The app will automatically switch to demo mode after 3 failures");
    }
    throw e;
  }
}

async function getData(url, ttlMs = CACHE_TTL_MS) {
  const key = "cache_" + url;
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const { data, createdAt } = JSON.parse(cached);
      if (Date.now() - new Date(createdAt).getTime() < ttlMs) return data;
    } catch (_) {}
  }
  const data = await fetchJson(url);
  localStorage.setItem(key, JSON.stringify({ data, createdAt: new Date().toISOString() }));
  return data;
}

$(async function () {
  updateFavCounter();
  renderFavorites();
  initChart();
  await loadAssets();
  bindUI();
  initSmoothScroll();
  initScrollTopButton();
});

function bindUI() {
  $("#btnSearch").on("click", doSearch);
  $("#search").on("input", doSearch);
  $("#btnClearFavs").on("click", () => {
    if (favorites.length === 0) return;
    favorites = [];
    saveFavorites();
    updateFavCounter();
    renderFavorites();
    renderAssets();
    rebuildChartSeries();
    showToast("תיק המעקב נוקה בהצלחה", "info");
  });
}

// Convert CoinGecko format to our internal format
function convertCoinGeckoData(coins) {
  return coins.map(coin => ({
    id: coin.id,
    rank: String(coin.market_cap_rank || 0),
    symbol: coin.symbol ? coin.symbol.toUpperCase() : "",
    name: coin.name,
    priceUsd: String(coin.current_price || 0),
    changePercent24Hr: String(coin.price_change_percentage_24h || 0),
    supply: String(coin.circulating_supply || 0),
    marketCapUsd: String(coin.market_cap || 0)
  }));
}

async function loadAssets() {
  toggleLoader(true);
  try {
    if (USE_DEMO_MODE) {
      const demoData = getDemoData();
      allAssets = demoData.data || [];
    } else {
      // CoinGecko API: Get top 100 coins by market cap
      const coins = await getData(`${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`);
      allAssets = convertCoinGeckoData(coins);
    }

    viewAssets = allAssets;
    $("#countLoaded").text(allAssets.length);
    renderAssets();
    const mode = USE_DEMO_MODE ? " (מצב הדגמה)" : "";
    showToast(`נטענו ${allAssets.length} מטבעות בהצלחה${mode}`, "success");
  } catch (e) {
    console.error("Error loading assets:", e);

    // Try demo mode as fallback
    console.log("🔄 Switching to demo mode...");
    try {
      const demoJson = getDemoData();
      allAssets = demoJson.data || [];
      viewAssets = allAssets;
      $("#countLoaded").text(allAssets.length);
      renderAssets();

      $("#coinsGrid").prepend(`
        <div class="col-12">
          <div class="alert alert-warning d-flex align-items-center gap-2" role="alert">
            <i class="bi bi-info-circle-fill"></i>
            <div>
              <strong>מצב הדגמה</strong><br>
              <small>לא ניתן להתחבר ל-API. מוצגים נתוני לדוגמה.</small>
            </div>
            <button class="btn btn-sm btn-outline-warning ms-auto" onclick="location.reload()">
              <i class="bi bi-arrow-clockwise"></i> נסה שוב
            </button>
          </div>
        </div>
      `);
      showToast("מצב הדגמה - נתוני לדוגמה", "warning");
    } catch (demoError) {
      $("#coinsGrid").html(`
        <div class="col-12">
          <div class="alert alert-danger d-flex align-items-center gap-2" role="alert">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <div>
              <strong>שגיאה בטעינת נתונים</strong><br>
              <small>אנא בדוק את החיבור לאינטרנט ונסה שוב</small>
            </div>
            <button class="btn btn-sm btn-outline-danger ms-auto" onclick="location.reload()">
              <i class="bi bi-arrow-clockwise"></i> טען מחדש
            </button>
          </div>
        </div>
      `);
      showToast("שגיאה בטעינת המטבעות", "danger");
    }
  } finally {
    toggleLoader(false);
  }
}

function toggleLoader(show) {
  $("#coinsLoader").toggleClass("d-none", !show);
}

function renderAssets() {
  const $grid = $("#coinsGrid");
  $grid.empty();
  if (viewAssets.length === 0) {
    $grid.append('<div class="col-12 text-center text-muted">לא נמצאו תוצאות…</div>');
    return;
  }

  viewAssets.forEach((a) => {
    const isFav = favorites.some((f) => f.id === a.id);
    const change = Number(a.changePercent24Hr || 0);
    const badge = change >= 0 ? "text-bg-success" : "text-bg-danger";
    $grid.append(`
      <div class="col-12 col-sm-6 col-lg-4">
        <div class="card coin-card h-100 shadow-sm">
          <div class="card-body d-flex flex-column gap-2">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="fw-bold text-truncate" title="${a.name}">${escapeHtml(a.name)}</div>
                <div class="small text-uppercase text-secondary">${a.symbol}</div>
              </div>
              <span class="badge ${isFav ? "text-bg-warning" : "text-bg-light"} fav-badge">${isFav ? "במעקב" : "לא במעקב"}</span>
            </div>

            <div class="d-flex justify-content-between">
              <div>דירוג: <strong>#${a.rank}</strong></div>
              <div>מחיר: <strong>$${fmt(a.priceUsd)}</strong></div>
              <div><span class="badge ${badge}">${change.toFixed(2)}%</span></div>
            </div>

            <div class="d-flex gap-2 mt-auto">
              <button class="btn btn-sm btn-outline-primary flex-grow-1 btn-more" data-id="${a.id}" data-bs-toggle="collapse" data-bs-target="#more-${a.id}">
                עוד מידע <i class="bi bi-chevron-down rotate"></i>
              </button>
              <button class="btn btn-sm ${isFav ? "btn-warning" : "btn-outline-warning"} btn-toggle" data-id="${a.id}" data-symbol="${a.symbol}" data-name="${escapeHtml(a.name)}">Toggle</button>
            </div>

            <div id="more-${a.id}" class="collapse">
              <div class="border rounded p-2 mt-2 small bg-light-subtle more-wrap" data-id="${a.id}">
                <div class="text-center py-2 more-loading d-none">
                  <div class="progress"><div class="progress-bar progress-bar-striped progress-bar-animated" style="width:100%">טוען...</div></div>
                </div>
                <div class="more-content"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
  });

  $(".btn-more").off("click").on("click", async function () {
    const id = $(this).data("id");
    const $icon = $(this).find(".bi");
    const $wrap = $(`#more-${id} .more-wrap`);
    const $loading = $wrap.find(".more-loading");
    const $content = $wrap.find(".more-content");
    const target = document.getElementById(`more-${id}`);
    target.addEventListener("shown.bs.collapse", () => $icon.addClass("open"), { once: true });
    target.addEventListener("hidden.bs.collapse", () => $icon.removeClass("open"), { once: true });

    if (!$content.data("loaded")) {
      $loading.removeClass("d-none");
      try {
        let a;
        if (USE_DEMO_MODE) {
          // Get from demo data
          const demoData = getDemoData();
          a = demoData.data.find(coin => coin.id === id) || {};
        } else {
          // Find from already loaded data (faster)
          a = allAssets.find(coin => coin.id === id);
          if (!a) {
            // Fallback: fetch from API
            const coinData = await getData(`${COINGECKO_BASE}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
            a = {
              id: coinData.id,
              name: coinData.name,
              symbol: (coinData.symbol || "").toUpperCase(),
              supply: String(coinData.market_data?.circulating_supply || 0),
              marketCapUsd: String(coinData.market_data?.market_cap?.usd || 0),
              changePercent24Hr: String(coinData.market_data?.price_change_percentage_24h || 0)
            };
          }
        }
        const supply = Number(a.supply || 0);
        const mcap = fmt(a.marketCapUsd);
        const source = USE_DEMO_MODE ? "נתוני הדגמה" : "CoinGecko API";
        $content
          .html(`
          <div><strong>${escapeHtml(a.name)} (${a.symbol})</strong></div>
          <div class="row g-2 mt-1">
            <div class="col-6 col-sm-4"><div class="border rounded p-2 bg-white">Market Cap: <strong>$${mcap}</strong></div></div>
            <div class="col-6 col-sm-4"><div class="border rounded p-2 bg-white">Supply: <strong>${supply.toLocaleString()}</strong></div></div>
            <div class="col-12 col-sm-4"><div class="border rounded p-2 bg-white">24h: <strong>${Number(a.changePercent24Hr || 0).toFixed(2)}%</strong></div></div>
          </div>
          <div class="small mt-2 text-secondary">מקור: ${source}</div>
        `)
          .data("loaded", true);
      } catch (e) {
        // Try finding in allAssets or demo data as fallback
        try {
          let a = allAssets.find(coin => coin.id === id);
          if (!a) {
            const demoData = getDemoData();
            a = demoData.data.find(coin => coin.id === id) || {};
          }
          if (a && a.id) {
            const supply = Number(a.supply || 0);
            const mcap = fmt(a.marketCapUsd);
            $content
              .html(`
              <div><strong>${escapeHtml(a.name)} (${a.symbol})</strong></div>
              <div class="row g-2 mt-1">
                <div class="col-6 col-sm-4"><div class="border rounded p-2 bg-white">Market Cap: <strong>$${mcap}</strong></div></div>
                <div class="col-6 col-sm-4"><div class="border rounded p-2 bg-white">Supply: <strong>${supply.toLocaleString()}</strong></div></div>
                <div class="col-12 col-sm-4"><div class="border rounded p-2 bg-white">24h: <strong>${Number(a.changePercent24Hr || 0).toFixed(2)}%</strong></div></div>
              </div>
              <div class="small mt-2 text-secondary text-warning">מקור: Cache</div>
            `)
              .data("loaded", true);
          } else {
            $content.html('<div class="text-danger">לא נמצא מידע</div>');
          }
        } catch (demoErr) {
          $content.html('<div class="text-danger">שגיאה בטעינת מידע</div>');
        }
      } finally {
        $loading.addClass("d-none");
      }
    }
  });

  $(".btn-toggle").off("click").on("click", function () {
    const id = $(this).data("id");
    const symbol = String($(this).data("symbol")).toUpperCase();
    const name = $(this).data("name");
    toggleFavorite({ id, symbol, name });
  });
}

function doSearch() {
  const q = $("#search").val().trim().toLowerCase();
  if (!q) {
    viewAssets = allAssets;
    renderAssets();
    return;
  }
  viewAssets = allAssets.filter(
    (a) => a.name?.toLowerCase().includes(q) || a.symbol?.toLowerCase().includes(q) || a.id?.toLowerCase().includes(q)
  );
  renderAssets();
}

function toggleFavorite(asset) {
  const exists = favorites.find((f) => f.id === asset.id);
  if (exists) {
    favorites = favorites.filter((f) => f.id !== asset.id);
    saveFavorites();
    updateFavCounter();
    renderAssets();
    renderFavorites();
    rebuildChartSeries();
    showToast(`${asset.name} הוסר מתיק המעקב`, "warning");
    return;
  }
  if (favorites.length < MAX_FAVORITES) {
    favorites.push(asset);
    saveFavorites();
    updateFavCounter();
    renderAssets();
    renderFavorites();
    rebuildChartSeries();
    showToast(`${asset.name} נוסף לתיק המעקב`, "success");
  } else {
    const $list = $("#replaceList").empty();
    favorites.forEach((f) => {
      const $item = $(`<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
        <span><strong>${escapeHtml(f.name)}</strong> <span class="text-uppercase text-secondary">(${f.symbol})</span></span>
        <span class="badge text-bg-danger">החלף</span>
      </button>`);
      $item.on("click", () => {
        favorites = favorites.filter((x) => x.id !== f.id);
        favorites.push(asset);
        saveFavorites();
        updateFavCounter();
        renderAssets();
        renderFavorites();
        rebuildChartSeries();
        bootstrap.Modal.getInstance(document.getElementById("replaceModal")).hide();
      });
      $list.append($item);
    });
    new bootstrap.Modal("#replaceModal").show();
  }
}

function renderFavorites() {
  const $row = $("#favRow").empty();
  if (favorites.length === 0) {
    $row.append('<div class="col-12 text-muted">אין מטבעות בתיק.</div>');
    return;
  }
  favorites.forEach((f) => {
    $row.append(`
      <div class="col-6 col-md-4 col-lg-3">
        <div class="card shadow-sm">
          <div class="card-body d-flex flex-column gap-2">
            <div class="d-flex align-items-center justify-content-between">
              <div class="fw-bold text-truncate" title="${f.name}">${escapeHtml(f.name)}</div>
              <span class="text-uppercase small text-secondary">${f.symbol}</span>
            </div>
            <div class="d-flex gap-2 mt-auto">
              <button class="btn btn-sm btn-outline-danger btn-remove" data-id="${f.id}"><i class="bi bi-x-lg"></i> הסר</button>
              <a class="btn btn-sm btn-outline-secondary" target="_blank" href="https://coincap.io/assets/${f.id}">דף מטבע</a>
            </div>
          </div>
        </div>
      </div>
    `);
  });

  $(".btn-remove")
    .off("click")
    .on("click", function () {
      const id = $(this).data("id");
      favorites = favorites.filter((f) => f.id !== id);
      saveFavorites();
      updateFavCounter();
      renderFavorites();
      renderAssets();
      rebuildChartSeries();
    });
}

function updateFavCounter() {
  $("#countFavs").text(favorites.length);
}

function saveFavorites() {
  localStorage.setItem("favorites", JSON.stringify(favorites));
}
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem("favorites")) || [];
  } catch {
    return [];
  }
}

function initChart() {
  chart = new CanvasJS.Chart("chartContainer", {
    animationEnabled: false,
    backgroundColor: "transparent",
    axisX: { valueFormatString: "HH:mm:ss" },
    axisY: { prefix: "$", includeZero: false },
    legend: { cursor: "pointer" },
    data: [],
  });
  chart.render();
  rebuildChartSeries();
}

function rebuildChartSeries() {
  chartSeries = {};
  chart.options.data = [];

  // Show/hide empty message
  const $emptyMsg = $("#chartEmptyMessage");
  const $chartStatus = $("#chartStatus");

  if (favorites.length === 0) {
    $emptyMsg.show();
    $chartStatus.html('<i class="bi bi-exclamation-circle"></i> אין מטבעות בתיק').removeClass('bg-success bg-primary').addClass('bg-secondary');
  } else {
    $emptyMsg.hide();
    $chartStatus.html('<i class="bi bi-graph-up"></i> מעקב אחר ' + favorites.length + ' מטבעות').removeClass('bg-secondary').addClass('bg-primary');
  }

  favorites.forEach((f) => {
    const color = stringToColor(f.symbol);
    const series = { type: "line", name: f.symbol, showInLegend: true, markerSize: 2, lineThickness: 2, color, dataPoints: [] };
    chartSeries[f.id] = series;
    chart.options.data.push(series);
  });
  chart.render();

  if (liveTimer) clearInterval(liveTimer);
  if (favorites.length === 0) return;

  liveTimer = setInterval(pollLivePrices, 30 * 1000);
  pollLivePrices();
}

async function pollLivePrices() {
  const ids = favorites.map((f) => f.id).join(",");
  if (!ids) return;

  const $chartStatus = $("#chartStatus");

  try {
    // Update status to loading
    $chartStatus.html('<i class="bi bi-arrow-repeat"></i> מעדכן...').removeClass('bg-secondary bg-danger').addClass('bg-primary');

    let data;
    if (USE_DEMO_MODE) {
      const demoData = getDemoData();
      data = demoData.data;
    } else {
      // CoinGecko: Get current prices for favorite coins
      const coins = await getData(`${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&order=market_cap_desc&sparkline=false`);
      data = convertCoinGeckoData(coins);
    }

    // Reset failure count on success
    apiFailureCount = 0;

    const now = new Date();
    let updatedCount = 0;
    data.forEach((a) => {
      const s = chartSeries[a.id];
      if (!s) return;
      // In demo mode, add small random variation
      let price = Number(a.priceUsd || 0);
      if (USE_DEMO_MODE) {
        price = price * (1 + (Math.random() - 0.5) * 0.02); // ±1% variation
      }
      if (!isFinite(price)) return;
      s.dataPoints.push({ x: now, y: price });
      if (s.dataPoints.length > 120) s.dataPoints.shift();
      updatedCount++;
    });
    chart.render();

    // Update status to success
    const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const demoLabel = USE_DEMO_MODE ? ' (הדגמה)' : '';
    $chartStatus.html(`<i class="bi bi-check-circle"></i> עודכן ${time}${demoLabel}`).removeClass('bg-primary').addClass('bg-success');

    // After 3 seconds, change back to tracking status
    setTimeout(() => {
      if (favorites.length > 0) {
        $chartStatus.html('<i class="bi bi-graph-up"></i> מעקב אחר ' + favorites.length + ' מטבעות' + demoLabel).removeClass('bg-success').addClass('bg-primary');
      }
    }, 3000);

  } catch (e) {
    apiFailureCount++;

    // Auto-switch to demo mode after 3 consecutive failures
    if (apiFailureCount >= 3 && !USE_DEMO_MODE) {
      console.warn("⚠️ Switching to demo mode due to repeated API failures");
      USE_DEMO_MODE = true;
      showToast("עבור למצב הדגמה בגלל בעיות רשת", "warning");
      // Try again immediately with demo mode
      setTimeout(pollLivePrices, 1000);
      return;
    }

    // Show error status (but less scary in the console)
    if (apiFailureCount === 1) {
      console.log("⚠️ Chart update failed - will retry");
    }
    $chartStatus.html('<i class="bi bi-exclamation-triangle"></i> שגיאה בעדכון').removeClass('bg-primary bg-success').addClass('bg-danger');

    // After 5 seconds, change back to tracking status
    setTimeout(() => {
      if (favorites.length > 0) {
        $chartStatus.html('<i class="bi bi-graph-up"></i> מעקב אחר ' + favorites.length + ' מטבעות').removeClass('bg-danger').addClass('bg-primary');
      }
    }, 5000);
  }
}

function fmt(v) {
  if (v == null) return "-";
  const n = Number(v);
  if (!isFinite(n)) return "-";
  return n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toPrecision(3);
}
function escapeHtml(str) {
  return String(str).replace(/[&<>\"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}
function stringToColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 45%)`;
}

// Smooth scroll for navigation
function initSmoothScroll() {
  $('a.nav-link[href^="#"]').on("click", function (e) {
    e.preventDefault();
    const target = $(this.getAttribute("href"));
    if (target.length) {
      $("html, body").animate({ scrollTop: target.offset().top - 70 }, 600);
      // Update active nav link
      $(".nav-link").removeClass("active");
      $(this).addClass("active");
    }
  });
}

// Show toast notification
function showToast(message, type = "info") {
  const toastHtml = `
    <div class="toast align-items-center text-bg-${type} border-0 position-fixed bottom-0 end-0 m-3" role="alert" style="z-index: 9999;">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;
  const $toast = $(toastHtml);
  $("body").append($toast);
  const toast = new bootstrap.Toast($toast[0], { delay: 3000 });
  toast.show();
  $toast.on("hidden.bs.toast", () => $toast.remove());
}

// Scroll to top button
function initScrollTopButton() {
  const $btn = $("#scrollTopBtn");

  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 300) {
      $btn.fadeIn();
    } else {
      $btn.fadeOut();
    }
  });

  $btn.on("click", function () {
    $("html, body").animate({ scrollTop: 0 }, 600);
  });
}
