/**
 * enhancements.js — Interactive improvements (additive, runs after script.js)
 *  - Year auto-play animation
 *  - Data info card for Diagram
 *  - Loading overlay management
 *  - VOC/NOx slider sync for Sandbox
 *  - Factor reset button
 */

(function () {
  'use strict';

  // ---- Cached site data for info card ----
  var siteDataCache = null;

  function loadSiteData() {
    return new Promise(function (resolve) {
      if (siteDataCache) return resolve(siteDataCache);
      Papa.parse('data/sites.csv', {
        download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: function (res) {
          siteDataCache = {};
          (res.data || []).forEach(function (r) {
            if (r.Station && r.Year) siteDataCache[r.Year] = { nox: r['24NOX'], o3: r['M1M1O3'] };
          });
          resolve(siteDataCache);
        },
        error: function () { resolve({}); }
      });
    });
  }

  // ---- Info card update ----
  function updateInfoCard(year) {
    var card = document.getElementById('diagramInfo');
    if (!card || !siteDataCache) return;

    var d = siteDataCache[year];
    if (!d) { card.style.display = 'none'; return; }

    card.style.display = 'flex';
    var noxEl = document.getElementById('infoNOx');
    var o3El = document.getElementById('infoO3');
    var trendEl = document.getElementById('infoTrend');

    if (noxEl) noxEl.textContent = d.nox.toFixed(1);
    if (o3El) o3El.textContent = d.o3.toFixed(1);

    // Year-on-year trend
    if (trendEl) {
      var prev = siteDataCache[year - 1];
      if (prev && prev.nox) {
        var pct = ((d.nox - prev.nox) / prev.nox * 100);
        var sign = pct > 0 ? '+' : '';
        trendEl.textContent = sign + pct.toFixed(1) + '%';
        trendEl.className = 'info-value ' + (pct <= 0 ? 'trend-down' : 'trend-up');
      } else {
        trendEl.textContent = '--';
        trendEl.className = 'info-value';
      }
    }
  }

  // ---- Loading overlay helpers ----
  function hideLoading(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  function hideAllLoadings() {
    ['plotLoading', 'evoPlotLoading', 'evoTimeLoading', 'sandboxLoading'].forEach(hideLoading);
  }

  // Watch for Plotly renders to dismiss loading
  function watchPlotReady(divId, loadingId) {
    var div = document.getElementById(divId);
    if (!div) return;
    // Use MutationObserver to detect when Plotly injects SVG
    var obs = new MutationObserver(function (mutations) {
      if (div.querySelector('.plot-container')) {
        hideLoading(loadingId);
      }
    });
    obs.observe(div, { childList: true, subtree: true });
    // Fallback: hide after timeout
    setTimeout(function () { hideLoading(loadingId); }, 6000);
  }

  // ---- Year auto-play ----
  var playTimer = null;

  function setupYearPlay() {
    var btn = document.getElementById('yearPlayBtn');
    var slider = document.getElementById('yearRange');
    if (!btn || !slider) return;

    btn.addEventListener('click', function () {
      if (playTimer) {
        // Stop
        clearInterval(playTimer);
        playTimer = null;
        btn.classList.remove('playing');
        btn.innerHTML = '&#9654;';
        return;
      }

      // Start
      btn.classList.add('playing');
      btn.innerHTML = '&#9724;'; // stop square

      var min = parseInt(slider.min, 10);
      var max = parseInt(slider.max, 10);
      var cur = parseInt(slider.value, 10);

      // If at end, restart from beginning
      if (cur >= max) {
        cur = min;
        slider.value = cur;
        slider.dispatchEvent(new Event('input'));
      }

      playTimer = setInterval(function () {
        cur++;
        if (cur > max) {
          clearInterval(playTimer);
          playTimer = null;
          btn.classList.remove('playing');
          btn.innerHTML = '&#9654;';
          return;
        }
        slider.value = cur;
        slider.dispatchEvent(new Event('input'));
      }, 1000);
    });
  }

  // ---- Sandbox factor slider sync ----
  function setupFactorSliders() {
    var vocSlider = document.getElementById('vocSlider');
    var vocInput = document.getElementById('vocFactorInput');
    var noxSlider = document.getElementById('noxSlider');
    var noxInput = document.getElementById('noxFactorInput');
    var resetBtn = document.getElementById('resetFactors');

    function syncSliderToInput(slider, input) {
      if (!slider || !input) return;
      slider.addEventListener('input', function () {
        input.value = parseFloat(slider.value).toFixed(2);
        input.dispatchEvent(new Event('input'));
      });
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        if (isFinite(v) && v >= parseFloat(slider.min) && v <= parseFloat(slider.max)) {
          slider.value = v;
        }
      });
    }

    syncSliderToInput(vocSlider, vocInput);
    syncSliderToInput(noxSlider, noxInput);

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (vocSlider) vocSlider.value = 1.0;
        if (noxSlider) noxSlider.value = 1.0;
        if (vocInput) { vocInput.value = '1.0'; vocInput.dispatchEvent(new Event('input')); }
        if (noxInput) { noxInput.value = '1.0'; noxInput.dispatchEvent(new Event('input')); }
      });
    }
  }

  // ---- Diagram year change → update info card ----
  function hookYearChange() {
    var slider = document.getElementById('yearRange');
    if (!slider) return;

    // Patch: after original handler fires, also update info card
    slider.addEventListener('input', function () {
      var year = parseInt(slider.value, 10);
      updateInfoCard(year);
    });
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function () {
    // Load data for info card
    loadSiteData().then(function () {
      var slider = document.getElementById('yearRange');
      if (slider) updateInfoCard(parseInt(slider.value, 10));
    });

    setupYearPlay();
    setupFactorSliders();
    hookYearChange();

    // Watch for plot renders
    watchPlotReady('plot', 'plotLoading');
    watchPlotReady('evoPlot', 'evoPlotLoading');
    watchPlotReady('evoTime', 'evoTimeLoading');
    watchPlotReady('sandboxPlot', 'sandboxLoading');

    // Also hide on page change
    window.addEventListener('PAGE_CHANGE', function () {
      setTimeout(hideAllLoadings, 3000);
    });
  });

})();
