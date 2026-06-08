/**
 * Oncomex Web Analytics Dashboard Controller
 * Connects directly to Firestore to fetch visitor events and renders interactive charts.
 */

(function () {
  'use strict';

  // --- Configuration ---
  // ENTER YOUR FIREBASE API CREDENTIALS HERE
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBuVPKN3R9X325j-xeLeeHWC3P2T6xmJqY",
    authDomain: "oncomex-analytics.firebaseapp.com",
    projectId: "oncomex-analytics",
    storageBucket: "oncomex-analytics.firebasestorage.app",
    messagingSenderId: "134639730771",
    appId: "1:134639730771:web:da9e797062bf44259146a6"
  };

  // --- Elements & Instances ---
  const setupWarning = document.getElementById('setup-warning');
  const visitorSelector = document.getElementById('visitor-selector');
  const statVisitors = document.getElementById('stat-visitors');
  const statClicks = document.getElementById('stat-clicks');
  const statAvgTime = document.getElementById('stat-avg-time');
  const statAvgCompletionMain = document.getElementById('stat-avg-completion-main');
  const statCtr = document.getElementById('stat-ctr');
  const statSuccessRate = document.getElementById('stat-success-rate');
  const statAbandonRate = document.getElementById('stat-abandon-rate');
  
  // UX Specific Elements
  const statRageClicks = document.getElementById('stat-rage-clicks');
  const statAvgHesitation = document.getElementById('stat-avg-hesitation');
  const statDeadClicks = document.getElementById('stat-dead-clicks');
  const statBacktracks = document.getElementById('stat-backtracks');
  
  const visitorsTableBody = document.getElementById('visitors-table-body');
  const clicksTableBody = document.getElementById('clicks-table-body');
  const heatmapListBody = document.getElementById('heatmap-list-body');
  const uxAlertsListBody = document.getElementById('ux-alerts-list-body');
  const surveyTableBody = document.getElementById('survey-table-body');
  const fcsrCardsContainer = document.getElementById('fcsr-cards-container');
  const ttfcCardsContainer = document.getElementById('ttfc-cards-container');
  const btnResetDatabase = document.getElementById('btn-reset-database');

  // Report Modal DOM Elements
  const btnGenerateReport = document.getElementById('btn-generate-report');
  const reportModal = document.getElementById('report-modal');
  const btnCloseReport = document.getElementById('btn-close-report');
  const reportLoadingContainer = document.getElementById('report-loading-container');
  const reportLoadingText = document.getElementById('report-loading-text');
  const reportContentContainer = document.getElementById('report-content-container');
  const btnCopyReport = document.getElementById('btn-copy-report');
  const btnPrintReport = document.getElementById('btn-print-report');

  let currentReportMarkdown = '';

  // Custom Confirmation Modal DOM Elements
  const confirmationModal = document.getElementById('confirmation-modal');
  const modalConfirmTitle = document.getElementById('modal-confirm-title');
  const modalConfirmDesc = document.getElementById('modal-confirm-desc');
  const securityInputContainer = document.getElementById('security-input-container');
  const requiredWordSpan = document.getElementById('required-word');
  const securityConfirmText = document.getElementById('security-confirm-text');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalConfirm = document.getElementById('btn-modal-confirm');

  // Heatmap UI Controls & Elements
  const btnHeatmapVisual = document.getElementById('btn-heatmap-view-visual');
  const btnHeatmapTable = document.getElementById('btn-heatmap-view-table');
  const panelHeatmapVisual = document.getElementById('heatmap-visual-panel');
  const panelHeatmapTable = document.getElementById('heatmap-table-panel');
  const heatmapStepSelector = document.getElementById('heatmap-step-selector');
  const heatmapWireframeBg = document.getElementById('heatmap-wireframe-bg');
  const heatmapCanvas = document.getElementById('heatmap-canvas');

  // Chart instances
  let clicksChart = null;
  let ctrChart = null;
  let timeChart = null;
  let funnelChart = null;

  let allEvents = [];
  let currentFilter = 'global';

  const CHRONOLOGICAL_STEPS = [
    'Landing',
    '1. Nombre',
    '2. Edad',
    '3. Género',
    '4. Motivación',
    '5. Destinatario',
    '6. Beneficiarios',
    '6.1. Modal Beneficiario',
    '7. Datos Contacto',
    '8. Procesando',
    '9. Resultados'
  ];

  const INTERACTIVE_STEPS = [
    'Landing',
    '1. Nombre',
    '2. Edad',
    '3. Género',
    '4. Motivación',
    '5. Destinatario',
    '6. Beneficiarios',
    '7. Datos Contacto',
    '9. Resultados'
  ];

  // Check if Firebase is set up
  if (!FIREBASE_CONFIG.projectId) {
    setupWarning.classList.remove('hide');
    console.warn('[Dashboard] Firebase Project ID is empty. Please enter your credentials in dashboard.js.');
    return;
  }

  // --- Initialize Firebase Firestore ---
  try {
    window.firebase.initializeApp(FIREBASE_CONFIG);
    const db = window.firebase.firestore();
    console.log('[Dashboard] Connecting to Firestore in real-time...');
    
    // Listen to changes in the database
    db.collection('analytics_events')
      .orderBy('timestamp', 'desc')
      .onSnapshot((snapshot) => {
        allEvents = [];
        snapshot.forEach((doc) => {
          allEvents.push({ id: doc.id, ...doc.data() });
        });
        console.log(`[Dashboard] Sincronizados ${allEvents.length} eventos.`);
        
        updateVisitorSelector();
        renderDashboard();
      }, (err) => {
        console.error('[Dashboard] Error reading database:', err);
      });
  } catch (err) {
    console.error('[Dashboard] Initialization failed:', err);
    setupWarning.classList.remove('hide');
  }

  // --- 1. Populate Visitor Selector Dropdown ---
  function updateVisitorSelector() {
    const previousSelection = visitorSelector.value;
    
    // Reset dropdown
    visitorSelector.innerHTML = '<option value="global">Global (Todos los usuarios)</option>';

    // Get unique visitors
    const visitors = [...new Set(allEvents.map(e => e.visitor_id))].filter(Boolean);
    
    visitors.forEach(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = id; // display id
      visitorSelector.appendChild(option);
    });

    // Retain previous selection if it still exists
    if (visitors.includes(previousSelection)) {
      visitorSelector.value = previousSelection;
      currentFilter = previousSelection;
    } else {
      visitorSelector.value = 'global';
      currentFilter = 'global';
    }
  }

  // Handle segment selection
  visitorSelector.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderDashboard();
  });

  // Handle Heatmap View Tab toggling
  if (btnHeatmapVisual && btnHeatmapTable) {
    btnHeatmapVisual.addEventListener('click', () => {
      btnHeatmapVisual.classList.add('active');
      btnHeatmapTable.classList.remove('active');
      panelHeatmapVisual.classList.remove('hide');
      panelHeatmapTable.classList.add('hide');
    });

    btnHeatmapTable.addEventListener('click', () => {
      btnHeatmapTable.classList.add('active');
      btnHeatmapVisual.classList.remove('active');
      panelHeatmapTable.classList.remove('hide');
      panelHeatmapVisual.classList.add('hide');
    });
  }

  // Handle Heatmap Step Selector change
  if (heatmapStepSelector) {
    heatmapStepSelector.addEventListener('change', () => {
      renderDashboard();
    });
  }

  // --- Custom Confirmation Modal & Deletion Logic ---
  let modalConfirmCallback = null;

  function showCustomConfirmModal({ title, description, requiredWord, onConfirm }) {
    modalConfirmTitle.textContent = title;
    modalConfirmDesc.innerHTML = description;
    requiredWordSpan.textContent = requiredWord;
    securityConfirmText.value = '';
    btnModalConfirm.disabled = true;
    modalConfirmCallback = onConfirm;

    // Enable/disable confirm button based on required word
    securityConfirmText.oninput = () => {
      btnModalConfirm.disabled = securityConfirmText.value.trim().toUpperCase() !== requiredWord.toUpperCase();
    };

    confirmationModal.classList.remove('hide');
    securityConfirmText.focus();
  }

  function hideCustomConfirmModal() {
    confirmationModal.classList.add('hide');
    modalConfirmCallback = null;
  }

  if (btnModalCancel) {
    btnModalCancel.addEventListener('click', hideCustomConfirmModal);
  }

  if (btnModalConfirm) {
    btnModalConfirm.addEventListener('click', async () => {
      if (typeof modalConfirmCallback === 'function') {
        const callback = modalConfirmCallback;
        hideCustomConfirmModal();
        await callback();
      }
    });
  }

  // --- Report Modal Event Listeners ---
  if (btnGenerateReport) {
    btnGenerateReport.addEventListener('click', showReportModal);
  }
  if (btnCloseReport) {
    btnCloseReport.addEventListener('click', hideReportModal);
  }
  if (btnCopyReport) {
    btnCopyReport.addEventListener('click', copyReportToClipboard);
  }
  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', printReport);
  }
  if (reportModal) {
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        hideReportModal();
      }
    });
  }

  // Handle database reset (clear all logged events) with Custom Error-Prevention Modal
  if (btnResetDatabase) {
    btnResetDatabase.addEventListener('click', () => {
      showCustomConfirmModal({
        title: 'Restablecer Base de Datos',
        description: 'Esta acción borrará de forma permanente todos los eventos y métricas de Firestore de <strong>TODOS</strong> los visitantes. Esta acción no se puede deshacer.',
        requiredWord: 'RESTABLECER',
        onConfirm: async () => {
          btnResetDatabase.textContent = 'Borrando...';
          btnResetDatabase.disabled = true;

          try {
            const db = window.firebase.firestore();
            const snapshot = await db.collection('analytics_events').get();

            if (snapshot.size === 0) {
              alert('No hay datos registrados en la base de datos para borrar.');
              return;
            }

            const docs = snapshot.docs;
            const chunkSize = 450;

            for (let i = 0; i < docs.length; i += chunkSize) {
              const chunk = docs.slice(i, i + chunkSize);
              const batch = db.batch();
              chunk.forEach(doc => batch.delete(doc.ref));
              await batch.commit();
            }

            console.log('[Dashboard] Base de datos restablecida correctamente por el administrador.');
            alert('¡Base de datos restablecida con éxito! Todas las métricas se han puesto a 0.');
            
            allEvents = [];
            updateVisitorSelector();
            renderDashboard();

          } catch (err) {
            console.error('[Dashboard] Error al restablecer la base de datos:', err);
            alert('Ocurrió un error al intentar borrar los datos. Revisa la consola del navegador.');
          } finally {
            btnResetDatabase.textContent = 'Restablecer Datos';
            btnResetDatabase.disabled = false;
          }
        }
      });
    });
  }

  // Handle specific visitor data deletion with Custom Confirmation Modal
  window.deleteVisitorData = function (visitorId) {
    showCustomConfirmModal({
      title: 'Eliminar Datos del Visitante',
      description: `Esta acción borrará de forma permanente todos los eventos y métricas de Firestore del visitante con ID: <strong style="color: var(--color-brand-blue); font-family: monospace;">${visitorId}</strong>. Esta acción no se puede deshacer.`,
      requiredWord: 'ELIMINAR',
      onConfirm: async () => {
        const deleteBtns = document.querySelectorAll(`button.delete-visitor-btn`);
        deleteBtns.forEach(btn => {
          if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(visitorId)) {
            btn.textContent = 'Borrando...';
            btn.disabled = true;
          }
        });

        try {
          const db = window.firebase.firestore();
          const snapshot = await db.collection('analytics_events').where('visitor_id', '==', visitorId).get();

          if (snapshot.size === 0) {
            alert('No hay eventos registrados para este visitante.');
            return;
          }

          const docs = snapshot.docs;
          const chunkSize = 450;

          for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            const batch = db.batch();
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }

          console.log(`[Dashboard] Datos del visitante ${visitorId} eliminados correctamente.`);
          alert(`¡Datos del visitante ${visitorId} eliminados con éxito!`);
          
          if (currentFilter === visitorId) {
            currentFilter = 'global';
            visitorSelector.value = 'global';
          }
          
          allEvents = allEvents.filter(e => e.visitor_id !== visitorId);
          updateVisitorSelector();
          renderDashboard();

        } catch (err) {
          console.error('[Dashboard] Error al eliminar datos del visitante:', err);
          alert('Ocurrió un error al intentar eliminar los datos del visitante.');
        }
      }
    });
  };

  // --- 2. Main Dashboard Render Engine ---
  function renderDashboard() {
    // A. Filter Events
    const filteredEvents = currentFilter === 'global' 
      ? allEvents 
      : allEvents.filter(e => e.visitor_id === currentFilter);

    // B. Calculate Overview Statistics
    calculateOverviewStats(filteredEvents);

    // C. Render Charts
    renderClicksChart(filteredEvents);
    renderTimeChart(filteredEvents);
    
    // D. Render Heatmap Zone Analysis
    renderHeatmapAnalysis(filteredEvents);

    // D.2 Render Funnel and UX Alerts
    populateUxAlertsTable(filteredEvents);

    // E. Populate Data Tables
    populateVisitorsTable(filteredEvents);
    populateClicksTable(filteredEvents);
    populateSurveyTable(filteredEvents);
    populateFcsrCards(filteredEvents);
    populateTtfcCards(filteredEvents);
  }

  // --- 3. Compute Metrics ---
  function calculateOverviewStats(events) {
    // 1. Unique visitors
    const uniqueIds = new Set(events.map(e => e.visitor_id).filter(Boolean));
    statVisitors.textContent = uniqueIds.size;

    // 2. Total click count
    const clicks = events.filter(e => e.event_type === 'click');
    statClicks.textContent = clicks.length;

    // 3. Average step time spent
    const timeEvents = events.filter(e => e.event_type === 'step_duration' && e.duration_seconds > 0);
    if (statAvgTime) {
      if (timeEvents.length > 0) {
        const totalSeconds = timeEvents.reduce((acc, curr) => acc + curr.duration_seconds, 0);
        const avgSeconds = (totalSeconds / timeEvents.length).toFixed(1);
        statAvgTime.textContent = `${avgSeconds}s`;
      } else {
        statAvgTime.textContent = '0s';
      }
    }

    // 4. CTR / Tasa de Conversión (Clicks on "Recibir llamada del asesor" / unique visitors)
    const leadClicks = clicks.filter(c => 
      c.click_data && 
      c.click_data.target_text && 
      c.click_data.target_text.toLowerCase().includes('recibir llamada')
    );
    const uniqueLeads = new Set(leadClicks.map(e => e.visitor_id).filter(Boolean));
    
    if (uniqueIds.size > 0) {
      const ctrPct = ((uniqueLeads.size / uniqueIds.size) * 100).toFixed(1);
      statCtr.textContent = `${ctrPct}%`;
    } else {
      statCtr.textContent = '0%';
    }

    // 4.5. Tasa de Éxito del Flujo y Tasa de Abandono
    const completedVisitorIds = new Set();
    events.forEach(e => {
      if (e.visitor_id && (e.event_type === 'ux_flow_completion' || 
                           normalizeStepNameForFunnel(e.step_name, e) === '9. Resultados')) {
        completedVisitorIds.add(e.visitor_id);
      }
    });

    if (statSuccessRate && statAbandonRate) {
      if (uniqueIds.size > 0) {
        const successPct = (completedVisitorIds.size / uniqueIds.size) * 100;
        const abandonPct = 100 - successPct;
        statSuccessRate.textContent = `${successPct.toFixed(1)}%`;
        statAbandonRate.textContent = `${abandonPct.toFixed(1)}%`;
      } else {
        statSuccessRate.textContent = '0.0%';
        statAbandonRate.textContent = '0.0%';
      }
    }

    // 5. Clics de Rabia (Rage Clicks)
    const rageClicks = events.filter(e => e.event_type === 'ux_rage_click');
    statRageClicks.textContent = rageClicks.length;

    // 6. Vacilación Promedio (Hesitation)
    const hesitationEvents = events.filter(e => e.event_type === 'ux_hesitation' && e.hesitation_seconds > 0);
    if (hesitationEvents.length > 0) {
      const totalHesitation = hesitationEvents.reduce((acc, curr) => acc + curr.hesitation_seconds, 0);
      const avgHesitation = (totalHesitation / hesitationEvents.length).toFixed(1);
      statAvgHesitation.textContent = `${avgHesitation}s`;
    } else {
      statAvgHesitation.textContent = '0s';
    }

    // 7. Clics Fallidos (Failed Click Rate)
    if (clicks.length > 0) {
      const deadClicks = clicks.filter(c => c.click_data && c.click_data.is_ctr_element === false).length;
      const deadPct = ((deadClicks / clicks.length) * 100).toFixed(1);
      statDeadClicks.textContent = `${deadPct}%`;
    } else {
      statDeadClicks.textContent = '0%';
    }

    // 8. Retrocesos (Backtracks)
    const backtrackEvents = events.filter(e => e.event_type === 'ux_backtrack');
    statBacktracks.textContent = backtrackEvents.length;

    // 9. Tiempo de Finalización Promedio (Flow Completion)
    const completionEvents = events.filter(e => e.event_type === 'ux_flow_completion');
    const statAvgCompletion = document.getElementById('stat-avg-completion-time');
    
    let avgCompletionStr = '0s';
    if (completionEvents.length > 0) {
      const totalCompletion = completionEvents.reduce((acc, curr) => acc + curr.duration_seconds, 0);
      const avgCompletion = (totalCompletion / completionEvents.length).toFixed(1);
      avgCompletionStr = `${avgCompletion}s`;
      
      if (statAvgCompletion) {
        statAvgCompletion.textContent = `Tiempo Promedio: ${avgCompletionStr}`;
        statAvgCompletion.style.display = 'inline-block';
      }
    } else {
      if (statAvgCompletion) {
        statAvgCompletion.style.display = 'none';
      }
    }
    
    if (statAvgCompletionMain) {
      statAvgCompletionMain.textContent = avgCompletionStr;
    }
  }

  // --- 4. Chart Render Logic (Chart.js CDNs) ---

  // Bar Chart: Events/Clicks per step
  function renderClicksChart(events) {
    const ctx = document.getElementById('chart-clicks-per-step').getContext('2d');
    
    // Group click events by step name and normalize them
    const stepCounts = {};
    CHRONOLOGICAL_STEPS.forEach(step => {
      stepCounts[step] = 0;
    });

    events.filter(e => e.event_type === 'click').forEach(e => {
      const step = normalizeStepNameForFunnel(e.step_name, e);
      if (stepCounts[step] !== undefined) {
        stepCounts[step]++;
      } else {
        stepCounts[step] = (stepCounts[step] || 0) + 1;
      }
    });

    // Filter to only include steps with clicks, sorted chronologically
    const labels = CHRONOLOGICAL_STEPS.filter(step => stepCounts[step] > 0);
    const dataValues = labels.map(step => stepCounts[step]);

    // Safeguard overlap
    if (clicksChart) clicksChart.destroy();

    clicksChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Sin Datos'],
        datasets: [{
          label: 'Total de Clics',
          data: dataValues.length > 0 ? dataValues : [0],
          backgroundColor: '#00B0CA',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#F1F5F9' },
            ticks: { font: { family: 'Poppins', size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Poppins', size: 10 } }
          }
        }
      }
    });
  }



  // Line Chart: Average step time spent
  function renderTimeChart(events) {
    const ctx = document.getElementById('chart-time-per-step').getContext('2d');
    
    // Group and calculate average duration per step
    const stepDurations = {};
    CHRONOLOGICAL_STEPS.forEach(step => {
      stepDurations[step] = { sum: 0, count: 0 };
    });

    events.filter(e => e.event_type === 'step_duration').forEach(e => {
      const step = normalizeStepNameForFunnel(e.step_name, e);
      if (stepDurations[step] !== undefined) {
        stepDurations[step].sum += e.duration_seconds;
        stepDurations[step].count += 1;
      }
    });

    // Show all chronological steps on the X-axis
    const labels = CHRONOLOGICAL_STEPS;
    const dataValues = labels.map(step => {
      const d = stepDurations[step];
      return d.count > 0 ? parseFloat((d.sum / d.count).toFixed(1)) : 0;
    });

    if (timeChart) timeChart.destroy();

    timeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['Sin Datos'],
        datasets: [{
          label: 'Tiempo Promedio (segundos)',
          data: dataValues.length > 0 ? dataValues : [0],
          borderColor: '#0F4FA4',
          backgroundColor: 'rgba(15, 79, 164, 0.04)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#0F4FA4',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#F1F5F9' },
            ticks: { font: { family: 'Poppins', size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Poppins', size: 10 } }
          }
        }
      }
    });
  }

  // --- 5. Click Heatmap Spatial coordinate analyzer & Visualizer ---
  function renderHeatmapAnalysis(events) {
    // 1. Render data sectors in table
    renderHeatmapTable(events);
    
    // 2. Render canvas visual mockup heatmap
    renderVisualHeatmap(events);
  }

  // A. Render Heatmap Sector Stats in Table
  function renderHeatmapTable(events) {
    const clicks = events.filter(e => e.event_type === 'click');
    const gridSize = 5;
    const bins = {};

    clicks.forEach(c => {
      if (c.click_data && typeof c.click_data.x_pct === 'number' && typeof c.click_data.y_pct === 'number') {
        const xBin = Math.floor(c.click_data.x_pct / (100 / gridSize));
        const yBin = Math.floor(c.click_data.y_pct / (100 / gridSize));

        const xIndex = Math.min(xBin, gridSize - 1);
        const yIndex = Math.min(yBin, gridSize - 1);

        const key = `${xIndex}-${yIndex}`;
        bins[key] = (bins[key] || 0) + 1;
      }
    });

    const listEntries = [];
    const totalClicks = clicks.length || 1;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const key = `${x}-${y}`;
        const count = bins[key] || 0;
        if (count > 0) {
          const pct = ((count / totalClicks) * 100).toFixed(1);
          listEntries.push({
            xRange: `${x * 20}% - ${(x + 1) * 20}%`,
            yRange: `${y * 20}% - ${(y + 1) * 20}%`,
            count: count,
            pct: parseFloat(pct)
          });
        }
      }
    }

    listEntries.sort((a, b) => b.pct - a.pct);

    heatmapListBody.innerHTML = '';
    if (listEntries.length === 0) {
      heatmapListBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--color-text-light);">Sin clics registrados</td></tr>';
      return;
    }

    listEntries.forEach(entry => {
      let intensityText = 'Baja';
      let intensityClass = 'intensity-low';
      
      if (entry.pct > 25) {
        intensityText = 'Alta';
        intensityClass = 'intensity-high';
      } else if (entry.pct > 10) {
        intensityText = 'Media';
        intensityClass = 'intensity-medium';
      }

      const row = `
        <tr>
          <td>${entry.xRange}</td>
          <td>${entry.yRange}</td>
          <td style="font-weight: 600;">${entry.pct}%</td>
          <td><span class="intensity-badge ${intensityClass}">${intensityText}</span></td>
        </tr>
      `;
      heatmapListBody.innerHTML += row;
    });
  }

  // B. Draw Step-Specific Mock Wireframe
  function buildStepWireframe(step) {
    if (!heatmapWireframeBg) return;
    
    let html = `
      <div class="wire-header">
        <div class="wire-logo"></div>
        <div class="wire-menu"></div>
      </div>
    `;
    
    switch (step) {
      case 'Landing':
        html += `
          <div class="wire-hero" style="font-size: 7px; color: var(--color-text-medium); line-height: 1.2;">Oncomex Hero Banner</div>
          <div class="wire-title"></div>
          <div class="wire-subtitle"></div>
          <div class="wire-desc-block">
            <div class="wire-line"></div>
            <div class="wire-line"></div>
            <div class="wire-line-short"></div>
          </div>
          <div class="wire-btn" style="font-size: 7px;">Quiero cotizar</div>
        `;
        break;
      case '1. Nombre':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 12%;"></div></div>
          <div class="wire-title" style="width: 75%;"></div>
          <div class="wire-subtitle" style="width: 45%;"></div>
          <div class="wire-input"></div>
          <div class="wire-btn" style="font-size: 7px;">Siguiente</div>
        `;
        break;
      case '2. Edad':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 25%;"></div></div>
          <div class="wire-title" style="width: 60%;"></div>
          <div class="wire-subtitle" style="width: 35%;"></div>
          <div class="wire-input"></div>
          <div class="wire-btn" style="font-size: 7px;">Siguiente</div>
        `;
        break;
      case '3. Género':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 37%;"></div></div>
          <div class="wire-title" style="width: 55%;"></div>
          <div class="wire-cards-row">
            <div class="wire-card-option">
              <div class="wire-card-dot" style="background-color: var(--color-brand-teal);"></div>
              <div class="wire-card-line"></div>
            </div>
            <div class="wire-card-option">
              <div class="wire-card-dot"></div>
              <div class="wire-card-line"></div>
            </div>
          </div>
          <div class="wire-btn" style="font-size: 7px;">Siguiente</div>
        `;
        break;
      case '4. Motivación':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 50%;"></div></div>
          <div class="wire-title" style="width: 70%;"></div>
          <div class="wire-list">
            <div class="wire-list-item"><div class="wire-check" style="background-color: var(--color-brand-teal); border-color: var(--color-brand-teal);"></div><div class="wire-card-line" style="width: 60%;"></div></div>
            <div class="wire-list-item"><div class="wire-check"></div><div class="wire-card-line" style="width: 70%;"></div></div>
            <div class="wire-list-item"><div class="wire-check"></div><div class="wire-card-line" style="width: 50%;"></div></div>
          </div>
          <div class="wire-btn" style="font-size: 7px;">Siguiente</div>
        `;
        break;
      case '5. Destinatario':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 62%;"></div></div>
          <div class="wire-title" style="width: 80%;"></div>
          <div class="wire-list">
            <div class="wire-list-item"><div class="wire-check" style="background-color: var(--color-brand-teal); border-color: var(--color-brand-teal);"></div><div class="wire-card-line" style="width: 60%;"></div></div>
            <div class="wire-list-item"><div class="wire-check"></div><div class="wire-card-line" style="width: 80%;"></div></div>
            <div class="wire-list-item"><div class="wire-check"></div><div class="wire-card-line" style="width: 65%;"></div></div>
          </div>
          <div class="wire-btn" style="font-size: 7px;">Siguiente</div>
        `;
        break;
      case '6. Beneficiarios':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 75%;"></div></div>
          <div class="wire-title" style="width: 70%;"></div>
          <div class="wire-list">
            <div class="wire-list-item"><div class="wire-check" style="background-color: var(--color-brand-teal); border-color: var(--color-brand-teal);"></div><div class="wire-card-line" style="width: 75%;"></div></div>
            <div class="wire-list-item"><div class="wire-check"></div><div class="wire-card-line" style="width: 55%;"></div></div>
          </div>
          <div class="wire-btn" style="font-size: 7px;">Siguiente</div>
        `;
        break;
      case '6.1. Modal Beneficiario':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 75%;"></div></div>
          <div class="wire-title" style="width: 70%;"></div>
          <div class="wire-list" style="opacity: 0.25;">
            <div class="wire-list-item"><div class="wire-check"></div><div class="wire-card-line" style="width: 75%;"></div></div>
            <div class="wire-list-item"><div class="wire-check"></div><div class="wire-card-line" style="width: 55%;"></div></div>
          </div>
          <div class="wire-btn" style="font-size: 7px; opacity: 0.25;">Siguiente</div>
          
          <!-- Modal Card Wireframe Overlay -->
          <div class="wire-modal-backdrop" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 2;">
            <div class="wire-modal-card" style="background-color: #FFFFFF; border-radius: 12px; width: 85%; padding: 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid var(--color-border); margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="wire-card-line" style="width: 55%; height: 5px; background-color: var(--color-text-dark);"></div>
                <div style="width: 10px; height: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-text-light); font-size: 8px; font-weight: bold;">✕</div>
              </div>
              <div class="wire-input" style="height: 20px; margin-top: 2px;"></div>
              <div class="wire-card-line" style="width: 40%; height: 3px; background-color: var(--color-text-light);"></div>
              <div class="wire-cards-row" style="margin-top: 2px;">
                <div class="wire-card-option" style="height: 22px; padding: 2px; flex-direction: row; align-items: center; gap: 4px; justify-content: flex-start; padding-left: 6px;">
                  <div class="wire-card-dot" style="width: 6px; height: 6px;"></div>
                  <div class="wire-card-line" style="width: 60%; height: 3px;"></div>
                </div>
                <div class="wire-card-option" style="height: 22px; padding: 2px; flex-direction: row; align-items: center; gap: 4px; justify-content: flex-start; padding-left: 6px; border-color: var(--color-brand-teal);">
                  <div class="wire-card-dot" style="width: 6px; height: 6px; background-color: var(--color-brand-teal);"></div>
                  <div class="wire-card-line" style="width: 60%; height: 3px;"></div>
                </div>
              </div>
              <div class="wire-btn" style="height: 20px; font-size: 6.5px; margin-top: 4px;">Agregar</div>
            </div>
          </div>
        `;
        break;
      case '7. Datos Contacto':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 87%;"></div></div>
          <div class="wire-title" style="width: 75%;"></div>
          <div class="wire-subtitle" style="width: 45%;"></div>
          <div class="wire-input"></div>
          <div class="wire-input"></div>
          <div class="wire-desc-block">
            <div class="wire-line" style="width: 90%;"></div>
            <div class="wire-line" style="width: 85%;"></div>
          </div>
          <div class="wire-btn" style="font-size: 7px;">Ver mi cotización</div>
        `;
        break;
      case '8. Procesando':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 95%;"></div></div>
          <div class="wire-hero" style="height: 100px; display: flex; flex-direction: column; gap: 8px; justify-content: center; align-items: center; border-style: solid; border-color: var(--color-brand-teal);">
            <div style="width: 14px; height: 14px; border: 2px solid var(--color-brand-teal); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="font-size: 7px; font-weight: 500;">Calculando póliza...</div>
          </div>
        `;
        break;
      case '9. Resultados':
        html += `
          <div class="wire-progress"><div class="wire-progress-bar" style="width: 100%; background-color: var(--color-green);"></div></div>
          <div class="wire-results-box" style="margin-top: 4px;">
            <div class="wire-badge">Seguro Oncológico Auna</div>
            <div class="wire-price">S/ 45.00 / mes</div>
            <div class="wire-card-line" style="width: 75%;"></div>
          </div>
          <div class="wire-btn green" style="font-size: 7px; margin-top: auto;">Recibir llamada del asesor</div>
        `;
        break;
      default:
        html += `
          <div class="wire-hero">Paso Desconocido</div>
        `;
    }
    
    heatmapWireframeBg.innerHTML = html;
  }

  // C. Render Visual Glowing Dots on Mock View Canvas
  function renderVisualHeatmap(events) {
    const selectedStep = heatmapStepSelector ? heatmapStepSelector.value : 'Landing';
    
    // 1. Re-render background mockup
    buildStepWireframe(selectedStep);
    
    // 2. Draw canvas clicks
    if (!heatmapCanvas) return;
    const ctx = heatmapCanvas.getContext('2d');
    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);
    
    // Filter click events for the selected step
    const stepClicks = events.filter(e => 
      e.event_type === 'click' && 
      normalizeStepNameForFunnel(e.step_name, e) === selectedStep
    );
    
    stepClicks.forEach(c => {
      const click = c.click_data || {};
      if (typeof click.x_pct !== 'number' || typeof click.y_pct !== 'number') return;
      
      let xPct = click.x_pct;
      let yPct = click.y_pct;
      
      // Calculate responsive scaling (convert to mock container coordinates)
      // Extract screen width from device info
      let screenWidth = 375; // standard default
      if (c.device_info && c.device_info.screen_size) {
        const parts = c.device_info.screen_size.split('x');
        if (parts.length > 0) {
          const w = parseInt(parts[0]);
          if (!isNaN(w)) screenWidth = w;
        }
      }
      
      // Normalize X coordinates from Desktop center column (480px max-width)
      if (screenWidth > 480) {
        const clickX = (xPct / 100) * screenWidth;
        const offset = (screenWidth - 480) / 2;
        xPct = ((clickX - offset) / 480) * 100;
      }
      
      // Clamps
      xPct = Math.max(0, Math.min(100, xPct));
      yPct = Math.max(0, Math.min(100, yPct));
      
      const canvasX = (xPct / 100) * heatmapCanvas.width;
      const canvasY = (yPct / 100) * heatmapCanvas.height;
      
      // Glow circle radius
      const radius = 10;
      
      // Draw smooth radial glow
      const gradient = ctx.createRadialGradient(canvasX, canvasY, 1, canvasX, canvasY, radius);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.95)');  // Intense solid red core
      gradient.addColorStop(0.3, 'rgba(245, 158, 11, 0.7)'); // Fire orange transition
      gradient.addColorStop(0.6, 'rgba(253, 224, 71, 0.4)'); // Solar yellow glow
      gradient.addColorStop(1, 'rgba(253, 224, 71, 0)');     // Transparent falloff
      
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
  }

  // --- 6. Table Population ---

  // Populate Segmented Visitors Table
  function populateVisitorsTable(events) {
    // Group events by visitor_id
    const visitorMap = {};
    
    // Sort all events to find the most recent state correctly
    const sortedEvents = [...allEvents].sort((a, b) => b.timestamp - a.timestamp);

    sortedEvents.forEach(e => {
      const id = e.visitor_id;
      if (!id) return;

      if (!visitorMap[id]) {
        visitorMap[id] = {
          visitor_id: id,
          last_step: normalizeStepNameForFunnel(e.step_name),
          screen_size: e.device_info ? e.device_info.screen_size : 'Desconocido',
          clicks_count: 0,
          rage_clicks_count: 0,
          completion_time: null,
          ua: e.device_info ? e.device_info.user_agent : '',
          country: 'Desconocido'
        };
      }

      if (e.device_info && e.device_info.country && visitorMap[id].country === 'Desconocido') {
        visitorMap[id].country = e.device_info.country;
      }

      if (e.event_type === 'click') {
        visitorMap[id].clicks_count += 1;
      }
      if (e.event_type === 'ux_rage_click') {
        visitorMap[id].rage_clicks_count += 1;
      }
      if (e.event_type === 'ux_flow_completion') {
        visitorMap[id].completion_time = e.duration_seconds;
      }
    });

    // Convert map to array
    let list = Object.values(visitorMap);
    
    // If we are filtering by a specific visitor, only show that one
    if (currentFilter !== 'global') {
      list = list.filter(v => v.visitor_id === currentFilter);
    }

    visitorsTableBody.innerHTML = '';
    if (list.length === 0) {
      visitorsTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--color-text-light);">No hay visitantes registrados</td></tr>';
      return;
    }

    list.forEach(v => {
      // Simple parse UserAgent for OS/Device
      let device = 'PC / Computadora';
      if (v.ua.match(/Android/i)) device = 'Móvil (Android)';
      else if (v.ua.match(/iPhone/i)) device = 'Móvil (iPhone)';
      else if (v.ua.match(/iPad/i)) device = 'Tablet (iPad)';
      else if (v.ua.match(/Mobile/i)) device = 'Dispositivo Móvil';

      const isCurrentSelected = v.visitor_id === currentFilter ? 'style="background-color: var(--color-border-light); font-weight:600;"' : '';

      // High frustration indicator
      let frustrationAlert = '';
      if (v.rage_clicks_count >= 2) {
        frustrationAlert = ' <span class="intensity-badge intensity-high" style="font-size: 9px; padding: 1px 4px; margin-left: 6px;">Frustrado 😡</span>';
      } else if (v.rage_clicks_count > 0) {
        frustrationAlert = ' <span class="intensity-badge intensity-medium" style="font-size: 9px; padding: 1px 4px; margin-left: 6px;">Fricción ⚠️</span>';
      }

      // Completion time badge
      let completionBadge = '';
      if (v.completion_time) {
        completionBadge = ` <span class="intensity-badge intensity-low" style="font-size: 9px; padding: 1px 4px; margin-left: 6px; background-color: rgba(16, 185, 129, 0.15); color: #059669;">⏱️ ${v.completion_time}s</span>`;
      }

      // Helper mapping flag emoji based on country name
      let countryWithFlag = '🏳️ Desconocido';
      if (v.country && v.country !== 'Desconocido') {
        const name = v.country.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (name.includes('mexic')) countryWithFlag = '🇲🇽 México';
        else if (name.includes('peru')) countryWithFlag = '🇵🇪 Perú';
        else if (name.includes('colombia')) countryWithFlag = '🇨🇴 Colombia';
        else if (name.includes('chile')) countryWithFlag = '🇨🇱 Chile';
        else if (name.includes('argentina')) countryWithFlag = '🇦🇷 Argentina';
        else if (name.includes('venezuela')) countryWithFlag = '🇻🇪 Venezuela';
        else if (name.includes('ecuador')) countryWithFlag = '🇪🇨 Ecuador';
        else if (name.includes('uruguay')) countryWithFlag = '🇺🇾 Uruguay';
        else if (name.includes('paraguay')) countryWithFlag = '🇵🇾 Paraguay';
        else if (name.includes('bolivia')) countryWithFlag = '🇧🇴 Bolivia';
        else if (name.includes('brasil') || name.includes('brazil')) countryWithFlag = '🇧🇷 Brasil';
        else if (name.includes('espan') || name.includes('spain')) countryWithFlag = '🇪🇸 España';
        else if (name.includes('united states') || name.includes('ee. uu.') || name.includes('ee.uu') || name.includes('usa')) countryWithFlag = '🇺🇸 EE. UU.';
        else if (name.includes('canada')) countryWithFlag = '🇨🇦 Canadá';
        else countryWithFlag = `📍 ${v.country}`;
      }

      const row = `
        <tr ${isCurrentSelected} onclick="document.getElementById('visitor-selector').value = '${v.visitor_id}'; document.getElementById('visitor-selector').dispatchEvent(new Event('change'));">
          <td style="font-family: monospace; color: var(--color-brand-blue);">${v.visitor_id}${frustrationAlert}${completionBadge}</td>
          <td>${v.last_step}</td>
          <td>${v.screen_size}</td>
          <td style="font-weight: 600;">${v.clicks_count}</td>
          <td>${device}</td>
          <td>${countryWithFlag}</td>
          <td>
            <button class="delete-visitor-btn" onclick="event.stopPropagation(); deleteVisitorData('${v.visitor_id}')">
              Eliminar
            </button>
          </td>
        </tr>
      `;

      visitorsTableBody.innerHTML += row;
    });
  }

  // Populate Clicks Real-Time Log Table
  function populateClicksTable(events) {
    const clicks = events.filter(e => e.event_type === 'click');

    clicksTableBody.innerHTML = '';
    if (clicks.length === 0) {
      clicksTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--color-text-light);">No se registran clics</td></tr>';
      return;
    }

    // Show latest 50 clicks for performance
    const latestClicks = clicks.slice(0, 50);

    latestClicks.forEach(c => {
      const click = c.click_data || {};
      const timeStr = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const coordStr = `X: ${click.x_pct}%, Y: ${click.y_pct}%`;
      const isCtrClass = click.is_ctr_element ? 'style="color: var(--color-green); font-weight: 600;"' : '';
      const elementBadge = click.is_ctr_element ? '<span style="color: var(--color-green); font-size:10px; font-weight:700;">[Acción]</span> ' : '';
      const stepNormalized = normalizeStepNameForFunnel(c.step_name);

      const row = `
        <tr>
          <td>${stepNormalized}</td>
          <td style="font-family: monospace;">${coordStr}</td>
          <td ${isCtrClass}>${elementBadge}${click.target_text || '(Sin Texto)'}</td>
          <td style="color: var(--color-text-medium); font-size: 11px;">${click.target_class || '-'}</td>
          <td>${timeStr}</td>
        </tr>
      `;
      clicksTableBody.innerHTML += row;
    });
  }

  // Populate UX Survey Responses Table
  function populateSurveyTable(events) {
    if (!surveyTableBody) return;

    // Filter only final survey responses (friction survey is disabled)
    const surveyResponses = events.filter(e => e.event_type === 'ux_survey_response');

    // Sort chronologically descending
    surveyResponses.sort((a, b) => b.timestamp - a.timestamp);

    surveyTableBody.innerHTML = '';
    if (surveyResponses.length === 0) {
      surveyTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--color-text-medium);">No se registran respuestas de encuestas</td></tr>';
      return;
    }

    surveyResponses.forEach(s => {
      const timeStr = new Date(s.timestamp).toLocaleString();
      const isCurrentSelected = s.visitor_id === currentFilter ? 'style="background-color: var(--color-border-light); font-weight:600;"' : '';
      
      const qEvidentDiscount = s.q1_evident_discount || '-';
      const qUnderstandCosts = s.q2_understand_costs || '-';
      const qTrustAdvisor = s.q3_trust_advisor || '-';
      const qMagicWand = s.q4_magic_wand || '-';

      const row = `
        <tr ${isCurrentSelected} onclick="document.getElementById('visitor-selector').value = '${s.visitor_id}'; document.getElementById('visitor-selector').dispatchEvent(new Event('change'));">
          <td style="font-family: monospace; color: var(--color-brand-blue);">${s.visitor_id}</td>
          <td style="font-weight: 600; text-align: center;">${qEvidentDiscount}</td>
          <td style="white-space: normal; word-break: break-word; max-width: 150px; text-align: left;">${qUnderstandCosts}</td>
          <td style="white-space: normal; word-break: break-word; max-width: 150px; text-align: left;">${qTrustAdvisor}</td>
          <td style="white-space: normal; word-break: break-word; max-width: 250px; text-align: left;">${qMagicWand}</td>
          <td>${timeStr}</td>
        </tr>
      `;
      surveyTableBody.innerHTML += row;
    });
  }

  // Populate First Click Success Rate (FCSR) Cards
  function populateFcsrCards(events) {
    if (!fcsrCardsContainer) return;

    // 1. Group events by visitor_id
    const clicksByVisitor = {};
    events.forEach(e => {
      if (e.event_type === 'click' && e.visitor_id) {
        if (!clicksByVisitor[e.visitor_id]) {
          clicksByVisitor[e.visitor_id] = [];
        }
        clicksByVisitor[e.visitor_id].push(e);
      }
    });

    // 2. Identify the first click per step for each visitor
    const firstClicksByStep = {}; // { stepName: { visitorId: clickEvent } }
    
    // Initialize step arrays in firstClicksByStep
    CHRONOLOGICAL_STEPS.forEach(step => {
      firstClicksByStep[step] = {};
    });

    for (const visitorId in clicksByVisitor) {
      const visitorClicks = clicksByVisitor[visitorId];
      // Sort chronologically by timestamp ascending
      visitorClicks.sort((a, b) => a.timestamp - b.timestamp);

      const seenSteps = new Set();
      for (const click of visitorClicks) {
        const stepNormalized = normalizeStepNameForFunnel(click.step_name, click);
        if (CHRONOLOGICAL_STEPS.includes(stepNormalized)) {
          if (!seenSteps.has(stepNormalized)) {
            seenSteps.add(stepNormalized);
            firstClicksByStep[stepNormalized][visitorId] = click;
          }
        }
      }
    }

    // 3. Calculate metrics for each step and render cards
    fcsrCardsContainer.innerHTML = '';
    
    // Only show the FCSR for the Resultados screen containing "Recibir llamada del asesor" CTA
    const stepsToRender = ['9. Resultados'];

    stepsToRender.forEach(step => {
      const stepClicks = firstClicksByStep[step];
      const visitorsWithClicks = Object.keys(stepClicks);
      const denominator = visitorsWithClicks.length;
      
      let numerator = 0;
      visitorsWithClicks.forEach(visitorId => {
        const click = stepClicks[visitorId];
        if (isClickOnMainCta(click)) {
          numerator++;
        }
      });

      const rate = denominator > 0 ? ((numerator / denominator) * 100) : 0;
      const rateFormatted = rate.toFixed(1);

      // Determine color coding based on rate
      let progressClass = 'fcsr-progress-bar-red';
      let textClass = 'text-red';
      if (rate >= 60) {
        progressClass = 'fcsr-progress-bar-green';
        textClass = 'text-green';
      } else if (rate >= 30) {
        progressClass = 'fcsr-progress-bar-amber';
        textClass = 'text-amber';
      }

      // Get CTA display text for visual helper
      const ctaLabel = getMainCtaLabelForStep(step);

      const cardHtml = `
        <div class="fcsr-card">
          <div class="fcsr-card-header">
            <span class="fcsr-card-title">${step}</span>
            <span class="fcsr-card-cta">${ctaLabel}</span>
          </div>
          <div class="fcsr-progress-wrapper">
            <div class="fcsr-progress-bar-bg">
              <div class="fcsr-progress-bar-fill ${progressClass}" style="width: ${rateFormatted}%"></div>
            </div>
            <span class="fcsr-percentage ${textClass}">${rateFormatted}%</span>
          </div>
          <div class="fcsr-card-footer">
            <span>Primer clic correcto: <strong>${numerator}</strong></span>
            <span>Usuarios interactuaron: <strong>${denominator}</strong></span>
          </div>
        </div>
      `;
      fcsrCardsContainer.innerHTML += cardHtml;
    });
  }

  // Populate Time to First Click (TTFC) Cards
  function populateTtfcCards(events) {
    if (!ttfcCardsContainer) return;

    const hesitationEvents = events.filter(e => e.event_type === 'ux_hesitation');

    // Group hesitation delays by normalized step name
    const hesitationByStep = {};
    INTERACTIVE_STEPS.forEach(step => {
      hesitationByStep[step] = [];
    });

    hesitationEvents.forEach(e => {
      const stepNormalized = normalizeStepNameForFunnel(e.step_name, e);
      if (hesitationByStep[stepNormalized]) {
        hesitationByStep[stepNormalized].push(e.hesitation_seconds);
      }
    });

    ttfcCardsContainer.innerHTML = '';

    INTERACTIVE_STEPS.forEach(step => {
      const delays = hesitationByStep[step] || [];
      const totalDelays = delays.length;

      let avgDelay = 0;
      if (totalDelays > 0) {
        const sum = delays.reduce((acc, val) => acc + val, 0);
        avgDelay = parseFloat((sum / totalDelays).toFixed(2));
      }

      const avgDelayFormatted = avgDelay > 0 ? `${avgDelay.toFixed(2)}` : '0.00';

      // Determine status text/color based on average time
      let statusText = 'Rápido';
      let statusColorClass = 'text-green';
      if (avgDelay > 6) {
        statusText = 'Lento';
        statusColorClass = 'text-red';
      } else if (avgDelay > 3) {
        statusText = 'Moderado';
        statusColorClass = 'text-amber';
      }

      const cardHtml = `
        <div class="ttfc-card">
          <div class="ttfc-card-header">
            <span class="ttfc-card-title">${step}</span>
            <span class="ttfc-card-badge">${statusText}</span>
          </div>
          <div class="ttfc-metric-wrapper">
            <span class="ttfc-value ${statusColorClass}">${avgDelayFormatted}</span>
            <span class="ttfc-unit">segundos</span>
          </div>
          <div class="ttfc-card-footer">
            <span>Interacciones medidas: <strong>${totalDelays}</strong></span>
          </div>
        </div>
      `;
      ttfcCardsContainer.innerHTML += cardHtml;
    });
  }

  // Helper to verify if the first click is on the screen's main CTA
  function isClickOnMainCta(clickEvent) {
    const clickData = clickEvent.click_data || {};
    const text = (clickData.target_text || '').toLowerCase().trim();
    const step = normalizeStepNameForFunnel(clickEvent.step_name, clickEvent);
    
    switch (step) {
      case 'Landing':
        return text.includes('cotizar') || text.includes('comenzar');
      case '1. Nombre':
      case '2. Edad':
        return text.includes('comenzar') || text.includes('continuar');
      case '3. Género':
      case '4. Motivación':
      case '5. Destinatario':
      case '6. Beneficiarios':
        return text.includes('continuar');
      case '6.1. Modal Beneficiario':
        return text === 'agregar' || text.includes('guardar') || text.includes('agregar');
      case '7. Datos Contacto':
        return text.includes('revisar');
      case '9. Resultados':
        return text.includes('recibir');
      default:
        return false;
    }
  }

  // Helper to get CTA display label
  function getMainCtaLabelForStep(step) {
    switch (step) {
      case 'Landing':
        return 'CTA: Cotizar';
      case '1. Nombre':
      case '2. Edad':
        return 'CTA: Comenzar';
      case '3. Género':
      case '4. Motivación':
      case '5. Destinatario':
      case '6. Beneficiarios':
        return 'CTA: Continuar';
      case '6.1. Modal Beneficiario':
        return 'CTA: Agregar';
      case '7. Datos Contacto':
        return 'CTA: Revisar cotización';
      case '9. Resultados':
        return 'CTA: Recibir llamada';
      default:
        return 'CTA';
    }
  }

  // --- 6. Funnel and UX Alerts Helpers ---

  function normalizeStepNameForFunnel(stepName, event) {
    if (!stepName) return 'Landing';
    const s = stepName.toLowerCase();
    if (s.includes('landing') || s.includes('para los que más amas')) return 'Landing';
    if (s.includes('cómo te llamas') || s.includes('llamas')) return '1. Nombre';
    if (s.includes('edad') || s.includes('años')) return '2. Edad';
    if (s.includes('género') || s.includes('sexo')) return '3. Género';
    if (s.includes('motiva') || s.includes('por qué')) return '4. Motivación';
    if (s.includes('quién es') || s.includes('para quién')) return '5. Destinatario';
    
    if (s.includes('quiénes deseas') || s.includes('familia') || s.includes('beneficiarios')) {
      if (event && event.event_type === 'click' && event.click_data) {
        const cData = event.click_data;
        const tClass = (cData.target_class || '').toLowerCase();
        const tText = (cData.target_text || '').toLowerCase();
        if (tClass.includes('modal') || tText.includes('agregar beneficiario') || tText === 'agregar') {
          return '6.1. Modal Beneficiario';
        }
      }
      return '6. Beneficiarios';
    }
    
    if (s.includes('contacto') || s.includes('casi tenemos tu póliza')) return '7. Datos Contacto';
    if (s.includes('cargando') || s.includes('calculando')) return '8. Procesando';
    if (s.includes('listo') || s.includes('cotización') || s.includes('resultado') || s.includes('resumen')) return '9. Resultados';
    return stepName;
  }

  function renderFunnelChart(events) {
    const el = document.getElementById('chart-ux-funnel');
    if (!el) return;
    const ctx = el.getContext('2d');

    const FUNNEL_STAGES = [
      'Landing',
      '1. Nombre',
      '2. Edad',
      '3. Género',
      '4. Motivación',
      '5. Destinatario',
      '6. Beneficiarios',
      '6.1. Modal Beneficiario',
      '7. Datos Contacto',
      '8. Procesando',
      '9. Resultados'
    ];

    // Group events by visitor
    const visitorStages = {};
    events.forEach(e => {
      const visitorId = e.visitor_id;
      if (!visitorId) return;

      if (!visitorStages[visitorId]) {
        visitorStages[visitorId] = new Set();
      }

      const normalized = normalizeStepNameForFunnel(e.step_name);
      visitorStages[visitorId].add(normalized);
    });

    // Count unique visitors at each stage cumulatively
    const stageCounts = {};
    FUNNEL_STAGES.forEach(stage => {
      stageCounts[stage] = 0;
    });

    const visitors = Object.keys(visitorStages);
    visitors.forEach(vId => {
      const visitedSet = visitorStages[vId];
      let maxStageIndex = -1;
      FUNNEL_STAGES.forEach((stage, idx) => {
        if (visitedSet.has(stage)) {
          if (idx > maxStageIndex) maxStageIndex = idx;
        }
      });

      for (let i = 0; i <= maxStageIndex; i++) {
        stageCounts[FUNNEL_STAGES[i]]++;
      }
    });

    const labels = FUNNEL_STAGES;
    const dataValues = FUNNEL_STAGES.map(stage => stageCounts[stage]);

    if (funnelChart) funnelChart.destroy();

    funnelChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Usuarios Activos',
          data: dataValues,
          backgroundColor: '#00B0CA',
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw;
                const total = dataValues[0] || 1;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${val} usuarios (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: '#F1F5F9' },
            ticks: { font: { family: 'Poppins', size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { font: { family: 'Poppins', size: 11 } }
          }
        }
      }
    });
  }

  function populateUxAlertsTable(events) {
    if (!uxAlertsListBody) return;
    const alerts = [];

    events.filter(e => e.event_type === 'ux_rage_click').forEach(e => {
      alerts.push({
        timestamp: e.timestamp,
        type: 'Clic de Rabia 😡',
        badgeClass: 'intensity-high',
        step: e.step_name || 'Landing',
        detail: `Clic repetido en: "${e.target_text || e.target_tag}"`
      });
    });

    events.filter(e => e.event_type === 'ux_backtrack').forEach(e => {
      alerts.push({
        timestamp: e.timestamp,
        type: 'Retroceso 🔙',
        badgeClass: 'intensity-medium',
        step: e.step_name || 'Landing',
        detail: `Regresó desde pantalla`
      });
    });

    events.filter(e => e.event_type === 'ux_hesitation' && e.hesitation_seconds > 4).forEach(e => {
      alerts.push({
        timestamp: e.timestamp,
        type: 'Vacilación Alta ⏱️',
        badgeClass: 'intensity-low',
        step: e.step_name || 'Landing',
        detail: `Tardó ${e.hesitation_seconds}s en interactuar`
      });
    });

    alerts.sort((a, b) => b.timestamp - a.timestamp);

    uxAlertsListBody.innerHTML = '';
    if (alerts.length === 0) {
      uxAlertsListBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--color-text-light);">Sin alertas de fricción</td></tr>';
      return;
    }

    alerts.slice(0, 15).forEach(a => {
      const row = `
        <tr>
          <td><span class="intensity-badge ${a.badgeClass}">${a.type}</span></td>
          <td>${a.step}</td>
          <td style="font-size: 11px; font-weight: 500;">${a.detail}</td>
        </tr>
      `;
      uxAlertsListBody.innerHTML += row;
    });
  }

  // --- Report Modal Helper Functions & Generator ---
  function showReportModal() {
    if (!reportModal) return;
    
    // Show modal & loading spinner
    reportModal.classList.remove('hide');
    reportLoadingContainer.classList.remove('hide');
    reportContentContainer.classList.add('hide');
    
    // Cycle loading texts to simulate analysis
    const loadingTexts = [
      "Analizando métricas del embudo y comportamiento de usuarios...",
      "Procesando clics de rabia, retrocesos y vacilación...",
      "Sintetizando respuestas cualitativas de la encuesta...",
      "Generando reporte ejecutivo final..."
    ];
    let textIndex = 0;
    reportLoadingText.textContent = loadingTexts[textIndex];
    
    const textInterval = setInterval(() => {
      textIndex = (textIndex + 1) % loadingTexts.length;
      if (reportLoadingText) {
        reportLoadingText.textContent = loadingTexts[textIndex];
      }
    }, 450);
    
    // Generate report after 800ms simulation
    setTimeout(() => {
      clearInterval(textInterval);
      
      const filteredEvents = currentFilter === 'global' 
        ? allEvents 
        : allEvents.filter(e => e.visitor_id === currentFilter);
        
      generateAndInjectReport(filteredEvents);
      
      reportLoadingContainer.classList.add('hide');
      reportContentContainer.classList.remove('hide');
    }, 800);
  }

  function hideReportModal() {
    if (reportModal) {
      reportModal.classList.add('hide');
    }
  }

  async function copyReportToClipboard() {
    if (!currentReportMarkdown) return;
    try {
      await navigator.clipboard.writeText(currentReportMarkdown);
      const originalText = btnCopyReport.textContent;
      btnCopyReport.textContent = '✅ ¡Copiado!';
      setTimeout(() => {
        btnCopyReport.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error('[Dashboard] Error copying text:', err);
      alert('No se pudo copiar el texto automáticamente. Puedes seleccionarlo y copiarlo manualmente.');
    }
  }

  function printReport() {
    window.print();
  }

  function generateAndInjectReport(events) {
    if (!reportContentContainer) return;
    
    if (events.length === 0) {
      reportContentContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: var(--color-text-medium);">
          <p>⚠️ No hay suficientes eventos registrados para generar el reporte de comportamiento.</p>
        </div>
      `;
      currentReportMarkdown = 'No hay suficientes eventos registrados para generar el reporte.';
      return;
    }

    // 1. Calculate general statistics
    const uniqueIds = new Set(events.map(e => e.visitor_id).filter(Boolean));
    const totalVisitors = uniqueIds.size;

    const clicks = events.filter(e => e.event_type === 'click');
    const totalClicks = clicks.length;

    const completedIds = new Set();
    events.forEach(e => {
      if (e.visitor_id && (e.event_type === 'ux_flow_completion' || normalizeStepNameForFunnel(e.step_name, e) === '9. Resultados')) {
        completedIds.add(e.visitor_id);
      }
    });
    const successCount = completedIds.size;
    const successRate = totalVisitors > 0 ? (successCount / totalVisitors) * 100 : 0;
    const abandonRate = 100 - successRate;

    const leadClicks = clicks.filter(c => 
      c.click_data && 
      c.click_data.target_text && 
      c.click_data.target_text.toLowerCase().includes('recibir llamada')
    );
    const uniqueLeads = new Set(leadClicks.map(e => e.visitor_id).filter(Boolean));
    const ctrPct = totalVisitors > 0 ? (uniqueLeads.size / totalVisitors) * 100 : 0;

    // 2. Funnel bottleneck step drop-off calculations (Cumulative funnel approach)
    const visitorStages = {};
    events.forEach(e => {
      const visitorId = e.visitor_id;
      if (!visitorId) return;

      if (!visitorStages[visitorId]) {
        visitorStages[visitorId] = new Set();
      }

      const normalized = normalizeStepNameForFunnel(e.step_name, e);
      visitorStages[visitorId].add(normalized);
    });

    const stageCounts = {};
    CHRONOLOGICAL_STEPS.forEach(stage => {
      stageCounts[stage] = 0;
    });

    const visitors = Object.keys(visitorStages);
    visitors.forEach(vId => {
      const visitedSet = visitorStages[vId];
      let maxStageIndex = -1;
      CHRONOLOGICAL_STEPS.forEach((stage, idx) => {
        if (visitedSet.has(stage)) {
          if (idx > maxStageIndex) maxStageIndex = idx;
        }
      });

      for (let i = 0; i <= maxStageIndex; i++) {
        stageCounts[CHRONOLOGICAL_STEPS[i]]++;
      }
    });

    const stepCounts = CHRONOLOGICAL_STEPS.map(step => ({
      step,
      count: stageCounts[step]
    }));

    let bottleneckStep = 'Ninguno';
    let bottleneckDropCount = 0;
    let bottleneckDropPct = 0;
    for (let i = 0; i < stepCounts.length - 1; i++) {
      const currentCount = stepCounts[i].count;
      const nextCount = stepCounts[i+1].count;
      if (currentCount > 0) {
        const drop = currentCount - nextCount;
        const pct = (drop / currentCount) * 100;
        if (pct > bottleneckDropPct && drop > 0) {
          bottleneckDropPct = pct;
          bottleneckDropCount = drop;
          bottleneckStep = stepCounts[i].step;
        }
      }
    }

    // 3. User Friction analysis
    const rageClicks = events.filter(e => e.event_type === 'ux_rage_click').length;
    const backtracks = events.filter(e => e.event_type === 'ux_backtrack').length;
    const deadClicksCount = clicks.filter(c => c.click_data && c.click_data.is_ctr_element === false).length;
    const deadClickPct = totalClicks > 0 ? (deadClicksCount / totalClicks) * 100 : 0;

    const hesitationEvents = events.filter(e => e.event_type === 'ux_hesitation' && e.hesitation_seconds > 0);
    const stepHesitations = {};
    hesitationEvents.forEach(e => {
      const step = normalizeStepNameForFunnel(e.step_name, e);
      if (!stepHesitations[step]) {
        stepHesitations[step] = { sum: 0, count: 0 };
      }
      stepHesitations[step].sum += e.hesitation_seconds;
      stepHesitations[step].count++;
    });
    let worstHesitationStep = 'Ninguno';
    let worstHesitationAvg = 0;
    Object.keys(stepHesitations).forEach(step => {
      const avg = stepHesitations[step].sum / stepHesitations[step].count;
      if (avg > worstHesitationAvg) {
        worstHesitationAvg = avg;
        worstHesitationStep = step;
      }
    });

    // 4. Survey feedback calculations
    const surveys = events.filter(e => e.event_type === 'ux_survey_response');
    const totalSurveys = surveys.length;
    const noticedDiscount = surveys.filter(s => s.q1_evident_discount === 'Sí').length;
    const discountPct = totalSurveys > 0 ? (noticedDiscount / totalSurveys) * 100 : 0;

    function parseLikert(str) {
      if (!str) return null;
      const m = str.match(/^(\d)/);
      return m ? parseInt(m[1], 10) : null;
    }
    let understandSum = 0, understandCount = 0;
    let trustSum = 0, trustCount = 0;
    surveys.forEach(s => {
      const uVal = parseLikert(s.q2_understand_costs);
      if (uVal !== null) {
        understandSum += uVal;
        understandCount++;
      }
      const tVal = parseLikert(s.q3_trust_advisor);
      if (tVal !== null) {
        trustSum += tVal;
        trustCount++;
      }
    });
    const avgUnderstand = understandCount > 0 ? (understandSum / understandCount).toFixed(1) : 'N/A';
    const avgTrust = trustCount > 0 ? (trustSum / trustCount).toFixed(1) : 'N/A';

    const magicWandList = surveys
      .map(s => s.q4_magic_wand)
      .filter(Boolean)
      .map(f => f.trim())
      .filter(f => f !== '-' && f.toLowerCase() !== 'ninguno' && f.toLowerCase() !== 'nada' && f.length > 2);

    // 5. Build dynamically triggered recommendations
    const recommendations = [];
    
    if (totalSurveys > 0 && discountPct < 70) {
      recommendations.push(`**Optimizar visibilidad del descuento:** Solo el ${discountPct.toFixed(1)}% de los encuestados notó la promoción del 15%. Se recomienda rediseñar el banner del Paso 0 y añadir un recordatorio visual flotante o microcopys más llamativos durante la selección de beneficiarios en el Paso 6.`);
    } else if (totalSurveys === 0) {
      recommendations.push(`**Promoción del 15%:** Asegurar que la promoción del 15% para pólizas familiares sea explícita en los pasos iniciales para motivar la adición de beneficiarios.`);
    }
    
    if (bottleneckStep !== 'Ninguno') {
      if (bottleneckStep.includes('Beneficiarios') || bottleneckStep.includes('Modal Beneficiario')) {
        recommendations.push(`**Rediseñar flujo de beneficiarios (${bottleneckStep}):** Este paso representa la mayor pérdida de usuarios (${bottleneckDropPct.toFixed(1)}% de caída). El modal de agregar beneficiario o el listado familiar puede ser confuso. Se sugiere simplificar el formulario de adición quitando campos redundantes o agregando guías explicativas.`);
      } else if (bottleneckStep.includes('Datos Contacto') || bottleneckStep.includes('7.')) {
        recommendations.push(`**Reducir fricción en formulario de contacto (Paso 7):** Se detecta un cuello de botella crítico al solicitar datos de contacto (${bottleneckDropPct.toFixed(1)}% de caída). Dado que el teléfono es obligatorio pero el correo es opcional, se debe aclarar explícitamente la opcionalidad del correo e incorporar autocompletado en navegadores.`);
      } else if (bottleneckStep.includes('Edad') || bottleneckStep.includes('2.')) {
        recommendations.push(`**Simplificar campo de Edad (Paso 2):** Se observa abandono en el paso de edad. Considerar validar mejor el teclado numérico en móvil o usar un selector de rango dinámico simplificado.`);
      } else if (bottleneckStep.includes('Género') || bottleneckStep.includes('3.')) {
        recommendations.push(`**Optimizar selección de Género (Paso 3):** Los usuarios abandonan en la selección de género. Asegurar que las opciones sean claras y no se perciba como una barrera de privacidad.`);
      } else {
        recommendations.push(`**Revisar caída en ${bottleneckStep}:** Se registra una tasa de abandono de ${bottleneckDropPct.toFixed(1)}% en este paso. Se recomienda auditar la usabilidad y los mensajes de error en esta pantalla.`);
      }
    }
    
    if (deadClickPct > 20) {
      recommendations.push(`**Corregir elementos engañosos (Clics Fallidos del ${deadClickPct.toFixed(1)}%):** Un alto porcentaje de clics se realiza en áreas no interactivas. Auditar el diseño visual de las tarjetas informativas, iconos y textos estáticos para evitar que parezcan botones clickeables.`);
    }
    
    if (rageClicks > 0) {
      recommendations.push(`**Investigar clics de rabia:** Se registraron ${rageClicks} eventos de clics de rabia (clics rápidos y repetidos sobre un mismo elemento). Esto indica que el sistema se congela o que el usuario espera una acción inmediata que no ocurre (por ejemplo, retrasos en botones de continuar).`);
    }
    
    if (worstHesitationStep !== 'Ninguno' && worstHesitationAvg > 5) {
      recommendations.push(`**Disminuir vacilación en ${worstHesitationStep}:** Los usuarios tardan en promedio ${worstHesitationAvg.toFixed(1)}s en realizar su primer clic en esta pantalla. Esto denota sobrecarga cognitiva o instrucciones confusas. Reducir la cantidad de texto o simplificar la pregunta.`);
    }
    
    if (avgUnderstand !== 'N/A' && parseFloat(avgUnderstand) < 4.0) {
      recommendations.push(`**Mejorar claridad de coberturas (Puntaje Likert de Comprensión: ${avgUnderstand}/5.0):** La puntuación es baja. El desglose de costos o los conceptos técnicos del seguro médico no quedan claros. Se recomienda agregar popovers informativos o tooltips explicando qué significa cada beneficio.`);
    }
    
    if (avgTrust !== 'N/A' && parseFloat(avgTrust) < 4.0) {
      recommendations.push(`**Incrementar elementos de confianza (Puntaje Likert de Confianza: ${avgTrust}/5.0):** Se sugiere agregar sellos de seguridad de Oncosalud, logos de aseguradoras respaldadas o testimonios reales de clientes cerca del llamado a la acción final para disipar dudas.`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push(`**Mantener monitoreo constante:** El flujo actual muestra un rendimiento óptimo. Se recomienda seguir acumulando datos para detectar patrones de comportamiento estacionales.`);
    }

    // 6. Build text/markdown version of the report
    const segmentText = currentFilter === 'global' ? 'Global (Todos los usuarios)' : `Visitante Individual (${currentFilter})`;
    const currentDate = new Date().toLocaleString('es-MX', { timeZoneName: 'short' });

    let md = `# INFORME DE COMPORTAMIENTO DE USUARIO (ONCOMEX IA)\n\n`;
    md += `* **Segmento Analizado:** ${segmentText}\n`;
    md += `* **Fecha de Generación:** ${currentDate}\n`;
    md += `* **Total de Visitantes en Muestra:** ${totalVisitors}\n\n`;
    
    md += `## 1. DESEMPEÑO CLAVE (KPIs)\n\n`;
    md += `* **Tasa de Éxito (Completado):** ${successRate.toFixed(1)}%\n`;
    md += `* **Tasa de Abandono:** ${abandonRate.toFixed(1)}%\n`;
    md += `* **Conversión a Lead (CTR):** ${ctrPct.toFixed(1)}%\n`;
    md += `* **Total de Clics Capturados:** ${totalClicks}\n\n`;
    
    md += `## 2. ANÁLISIS DE EMBUDO Y PUNTOS DE FRACTURA\n\n`;
    if (bottleneckStep !== 'Ninguno') {
      md += `* **Cuello de Botella Identificado:** \`${bottleneckStep}\`\n`;
      md += `* **Tasa de Caída en el Punto de Fractura:** ${bottleneckDropPct.toFixed(1)}% (${bottleneckDropCount} usuarios abandonaron aquí)\n`;
    } else {
      md += `* **Punto de Fractura:** No se detectó un cuello de botella significativo con los datos actuales.\n`;
    }
    
    md += `\n### Retención de Usuarios por Pantalla:\n`;
    stepCounts.forEach(sc => {
      const stepPct = totalVisitors > 0 ? ((sc.count / totalVisitors) * 100).toFixed(1) : '0.0';
      md += `- **${sc.step}:** ${sc.count} usuarios (${stepPct}%)\n`;
    });
    md += `\n`;
    
    md += `## 3. MÉTRICAS DE FRICCIÓN Y FRUSTRACIÓN (UX)\n\n`;
    md += `* **Clics de Rabia (Rage Clicks):** ${rageClicks} (usuarios golpeando la interfaz)\n`;
    md += `* **Retrocesos (Backtracks):** ${backtracks} (usuarios regresando a pantallas previas)\n`;
    md += `* **Clics Fallidos:** ${deadClickPct.toFixed(1)}% de todos los clics (interacciones fallidas)\n`;
    if (worstHesitationStep !== 'Ninguno') {
      md += `* **Mayor Tiempo de Vacilación:** \`${worstHesitationStep}\` (Promedio de ${worstHesitationAvg.toFixed(1)}s antes de actuar)\n`;
    } else {
      md += `* **Mayor Tiempo de Vacilación:** N/A\n`;
    }
    md += `\n`;
    
    md += `## 4. ANÁLISIS CUALITATIVO (ENCUESTA DE SATISFACCIÓN)\n\n`;
    md += `* **Total Encuestas Completadas:** ${totalSurveys}\n`;
    md += `* **Reconocimiento de Promoción 15%:** ${discountPct.toFixed(1)}% de los usuarios la notaron\n`;
    md += `* **Promedio Entendimiento de Costos (Likert 1-5):** ${avgUnderstand} / 5.0\n`;
    md += `* **Promedio Confianza en Asesor (Likert 1-5):** ${avgTrust} / 5.0\n`;
    
    if (magicWandList.length > 0) {
      md += `\n### Sugerencias Clave ("Varita Mágica"):\n`;
      magicWandList.slice(0, 5).forEach(feedback => {
        md += `- *"${feedback}"*\n`;
      });
    } else {
      md += `\n### Sugerencias Clave ("Varita Mágica"):\n- No se registran sugerencias detalladas en este segmento.\n`;
    }
    md += `\n`;
    
    md += `## 5. RECOMENDACIONES DE NEGOCIO Y UX SUGERIDAS POR IA\n\n`;
    recommendations.forEach((rec, idx) => {
      md += `${idx + 1}. ${rec}\n`;
    });
    
    currentReportMarkdown = md;

    // 7. Inject HTML version into the modal card
    let html = `
      <div style="margin-bottom: 20px; border-bottom: 1px solid var(--color-border-light); padding-bottom: 12px;">
        <p style="font-size: 0.8rem; color: var(--color-text-light); margin: 0;">ONCOMEX ANALYTICS REPORT</p>
        <h4 style="margin: 4px 0; color: var(--color-text-darkest); font-size: 1.3rem;">Informe Ejecutivo de Comportamiento</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 0.78rem; color: var(--color-text-medium);">
          <span><strong>Segmento:</strong> ${segmentText}</span>
          <span>•</span>
          <span><strong>Fecha:</strong> ${currentDate}</span>
        </div>
      </div>
      
      <!-- KPI Grid -->
      <div class="report-kpi-grid">
        <div class="report-kpi-card">
          <div class="report-kpi-value">${successRate.toFixed(1)}%</div>
          <div class="report-kpi-label">Tasa de Éxito</div>
        </div>
        <div class="report-kpi-card">
          <div class="report-kpi-value">${ctrPct.toFixed(1)}%</div>
          <div class="report-kpi-label">CTR a Lead</div>
        </div>
        <div class="report-kpi-card" style="border-left: 2px solid ${rageClicks > 0 ? '#EF4444' : 'var(--color-border-light)'};">
          <div class="report-kpi-value" style="color: ${rageClicks > 0 ? '#EF4444' : 'var(--color-brand-blue)'};">${rageClicks}</div>
          <div class="report-kpi-label">Clics de Rabia</div>
        </div>
        <div class="report-kpi-card">
          <div class="report-kpi-value">${deadClickPct.toFixed(1)}%</div>
          <div class="report-kpi-label">Clics Fallidos</div>
        </div>
      </div>
      
      <!-- Section 1: Funnel -->
      <div class="report-section">
        <h4>1. Análisis del Embudo de Conversión</h4>
        <p>
          El embudo de conversión registra un total de <strong>${totalVisitors}</strong> usuarios únicos analizados. 
          La tasa de finalización exitosa es de <strong>${successRate.toFixed(1)}%</strong>, mientras que la tasa de abandono se sitúa en <strong>${abandonRate.toFixed(1)}%</strong>.
        </p>
        ${bottleneckStep !== 'Ninguno' ? `
          <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 0.85rem; color: #991B1B; font-weight: 600;">⚠️ Cuello de Botella Detectado: "${bottleneckStep}"</p>
            <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #7F1D1D;">
              Este paso registra la mayor tasa de caída con un <strong>${bottleneckDropPct.toFixed(1)}%</strong> de pérdida de usuarios (${bottleneckDropCount} usuarios abandonaron la experiencia en este punto).
            </p>
          </div>
        ` : ''}
        
        <p style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px;">Retención paso a paso:</p>
        <div style="background-color: var(--color-bg-light); border: 1px solid var(--color-border-light); border-radius: 8px; padding: 12px; max-height: 180px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--color-border-light); text-align: left; color: var(--color-text-light);">
                <th style="padding: 6px 0;">Paso / Pantalla</th>
                <th style="padding: 6px 0; text-align: right;">Usuarios Activos</th>
                <th style="padding: 6px 0; text-align: right;">% Retención</th>
              </tr>
            </thead>
            <tbody>
              ${stepCounts.map(sc => {
                const stepPct = totalVisitors > 0 ? ((sc.count / totalVisitors) * 100).toFixed(1) : '0.0';
                return `
                  <tr style="border-bottom: 1px solid rgba(226, 232, 240, 0.5);">
                    <td style="padding: 6px 0; font-weight: 500;">${sc.step}</td>
                    <td style="padding: 6px 0; text-align: right; font-family: monospace;">${sc.count}</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600; color: var(--color-brand-blue);">${stepPct}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Section 2: Friction -->
      <div class="report-section">
        <h4>2. Fricción y Puntos de Dolor Detectados</h4>
        <p>
          Se capturaron <strong>${totalClicks}</strong> coordenadas de clics en el segmento seleccionado. El análisis de micro-interacciones arroja los siguientes datos:
        </p>
        <ul class="report-bullets">
          <li><strong>Clics de Rabia (Rage Clicks):</strong> Se detectaron <strong>${rageClicks}</strong> eventos en los que los usuarios hicieron clic repetidamente en frustración.</li>
          <li><strong>Retrocesos (Backtracks):</strong> Los usuarios regresaron a pantallas anteriores en <strong>${backtracks}</strong> ocasiones, lo que sugiere dudas sobre respuestas ingresadas.</li>
          <li><strong>Clics Fallidos:</strong> El <strong>${deadClickPct.toFixed(1)}%</strong> de los clics fueron inefectivos, presionando zonas que no ofrecen navegación.</li>
          ${worstHesitationStep !== 'Ninguno' ? `
            <li><strong>Mayor punto de vacilación:</strong> La pantalla <strong>"${worstHesitationStep}"</strong> generó la mayor indecisión, con un promedio de <strong>${worstHesitationAvg.toFixed(1)}s</strong> de inactividad antes de interactuar.</li>
          ` : ''}
        </ul>
      </div>
      
      <!-- Section 3: Surveys -->
      <div class="report-section">
        <h4>3. Experiencia y Opinión Cualitativa</h4>
        <p>
          Basado en <strong>${totalSurveys}</strong> encuestas de satisfacción completadas por los usuarios:
        </p>
        <ul class="report-bullets">
          <li><strong>Visibilidad de Descuento (15%):</strong> Un <strong>${discountPct.toFixed(1)}%</strong> de los encuestados reportó que la oferta de descuento por agregar familiares le resultó evidente.</li>
          <li><strong>Comprensión del Cotizador (Escala Likert):</strong> Puntuación promedio de <strong>${avgUnderstand}</strong> sobre 5.0 en claridad de costos y beneficios.</li>
          <li><strong>Confianza de Contacto (Escala Likert):</strong> Puntuación promedio de <strong>${avgTrust}</strong> sobre 5.0 en su disposición para recibir la llamada del asesor.</li>
        </ul>
        
        ${magicWandList.length > 0 ? `
          <p style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px;">Comentarios destacados ("Varita Mágica"):</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${magicWandList.slice(0, 3).map(feedback => `
              <div style="background-color: #F8FAFC; border: 1px solid var(--color-border-light); border-radius: 8px; padding: 10px; font-style: italic; font-size: 0.8rem; color: var(--color-text-dark);">
                "${feedback}"
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      
      <!-- Section 4: Recommendations -->
      <div class="report-section" style="margin-bottom: 0;">
        <h4>4. Plan de Acción y Recomendaciones (IA)</h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${recommendations.map((rec, idx) => {
            const titleParts = rec.split(':');
            if (titleParts.length > 1) {
              return `
                <div style="display: flex; gap: 8px; font-size: 0.85rem; line-height: 1.5; color: var(--color-text-dark);">
                  <span style="font-weight: bold; color: var(--color-brand-teal);">${idx + 1}.</span>
                  <span><strong>${titleParts[0]}:</strong>${titleParts.slice(1).join(':')}</span>
                </div>
              `;
            }
            return `
              <div style="display: flex; gap: 8px; font-size: 0.85rem; line-height: 1.5; color: var(--color-text-dark);">
                <span style="font-weight: bold; color: var(--color-brand-teal);">${idx + 1}.</span>
                <span>${rec}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    reportContentContainer.innerHTML = html;
  }

})();
