/* ==========================================================================
   MOCK DATABASE & STATIC DATA
   ========================================================================== */
const PO_DATABASE = {
  "PO-2026060401": {
    poNo: "PO-2026060401",
    supplier: "大地小農鮮果合作社",
    date: "2026-06-04",
    tempClass: "冷藏 (0℃ ~ 7℃)",
    items: [
      { id: "ITEM-MILK-01", name: "鮮鮮牧場低脂鮮乳 (1L)", sku: "4710122040501", expectedQty: 120, unit: "瓶" },
      { id: "ITEM-APPLE-02", name: "有機富士蘋果 (10入裝)", sku: "4710122040502", expectedQty: 60, unit: "箱" },
      { id: "ITEM-CORN-03", name: "黃金超甜玉米 (5支裝)", sku: "4710122040503", expectedQty: 40, unit: "箱" },
      { id: "ITEM-EGGS-04", name: "優質新鮮紅殼土雞蛋 (30粒)", sku: "4710122040504", expectedQty: 50, unit: "盤" }
    ]
  },
  "PO-2026060402": {
    poNo: "PO-2026060402",
    supplier: "極速電子科技股份有限公司",
    date: "2026-06-05",
    tempClass: "常溫 (15℃ ~ 25℃)",
    items: [
      { id: "ITEM-ESP-01", name: "ESP32-WROOM-32D 開發板", sku: "8801234567010", expectedQty: 500, unit: "個" },
      { id: "ITEM-TEMP-02", name: "高精度溫濕度感測器 (SHT31-D)", sku: "8801234567027", expectedQty: 250, unit: "個" },
      { id: "ITEM-OLED-03", name: "0.96 吋 I2C OLED 顯示模組", sku: "8801234567034", expectedQty: 300, unit: "個" }
    ]
  },
  "PO-2026060403": {
    poNo: "PO-2026060403",
    supplier: "海味水產冷鏈物流",
    date: "2026-06-04",
    tempClass: "冷凍 (-18℃以下)",
    items: [
      { id: "ITEM-STEAK-01", name: "安格斯頂級沙朗牛排 (300g)", sku: "9310122340605", expectedQty: 100, unit: "包" },
      { id: "ITEM-SALMON-02", name: "挪威低溫冷凍鮭魚排 (250g)", sku: "9310122340612", expectedQty: 80, unit: "包" }
    ]
  }
};

// Initial History (cleared mock data, only using CSV data)
const INITIAL_HISTORY = [];

/* ==========================================================================
   APP STATE MANAGER
   ========================================================================== */
class InspectionApp {
  constructor() {
    this.currentPOId = "PO-2026060401";
    this.historyLogs = [];
    this.inspectionState = {}; // Cached states for current active sessions

    this.init();
  }

  init() {
    // Load from LocalStorage or initialize defaults
    this.loadHistory();
    this.loadActiveSessions();

    // Bind event listeners
    this.bindEvents();

    // Initial render
    this.switchTab("active-inspection");
    this.loadPO(this.currentPOId);
    this.renderHistory();
    this.renderAnalytics();
  }

  loadHistory() {
    let saved = localStorage.getItem("receipt_inspection_history");
    if (saved) {
      try {
        this.historyLogs = JSON.parse(saved);
        // Clear if contains old mock data
        if (this.historyLogs.some(h => h.poNo === "PO-2026052001" || h.poNo === "PO-2026052501")) {
          localStorage.removeItem("receipt_inspection_history");
          saved = null;
        }
      } catch (e) {
        saved = null;
      }
    }
    
    if (!saved) {
      this.historyLogs = typeof IMPORTED_HISTORY !== 'undefined' ? [...IMPORTED_HISTORY] : [];
      this.saveHistory();
    }
  }

  saveHistory() {
    localStorage.setItem("receipt_inspection_history", JSON.stringify(this.historyLogs));
  }

  loadActiveSessions() {
    const saved = localStorage.getItem("receipt_active_sessions");
    if (saved) {
      try {
        this.inspectionState = JSON.parse(saved);
      } catch (e) {
        this.inspectionState = {};
      }
    }
  }

  saveActiveSession() {
    localStorage.setItem("receipt_active_sessions", JSON.stringify(this.inspectionState));
  }

  /* ==========================================================================
     EVENT BINDING & ROUTING
     ========================================================================== */
  bindEvents() {
    // Sidebar Tabs
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tabName = btn.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // PO Selector
    document.getElementById("po-select").addEventListener("change", (e) => {
      this.currentPOId = e.target.value;
      this.loadPO(this.currentPOId);
    });

    // Barcode Search
    document.getElementById("barcode-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleBarcodeSearch(e.target.value.trim());
      }
    });

    // Camera Scan simulation
    document.getElementById("camera-scan-btn").addEventListener("click", () => {
      this.openScannerModal();
    });

    document.getElementById("close-scanner-btn").addEventListener("click", () => {
      this.closeScannerModal();
    });

    // API Configurations
    document.getElementById("api-config-btn").addEventListener("click", () => {
      this.openApiModal();
    });

    document.getElementById("close-modal-btn").addEventListener("click", () => {
      this.closeApiModal();
    });

    document.getElementById("save-api-btn").addEventListener("click", () => {
      this.saveApiConfig();
    });

    // Global Action Buttons
    document.getElementById("reset-inspection-btn").addEventListener("click", () => {
      if (confirm("您確定要重置目前驗收單的所有輸入嗎？此操作無法還原。")) {
        this.resetActiveInspection();
      }
    });

    document.getElementById("submit-inspection-btn").addEventListener("click", () => {
      this.submitInspection();
    });

    document.getElementById("generate-ai-report-btn").addEventListener("click", () => {
      this.generateGlobalAIReport();
    });

    // Tone Select changes
    document.getElementById("ai-tone").addEventListener("change", () => {
      if (!document.getElementById("ai-result-state").classList.contains("hidden")) {
        this.generateGlobalAIReport();
      }
    });

    // Copy to clipboard
    document.getElementById("copy-ai-btn").addEventListener("click", () => {
      const textarea = document.getElementById("ai-text-output");
      textarea.select();
      document.execCommand("copy");
      
      const copyBtn = document.getElementById("copy-ai-btn");
      const origText = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mini-icon">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>已複製!</span>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = origText;
      }, 2000);
    });

    // CSV Import Action Button triggering file picker
    const csvImportBtn = document.getElementById("csv-import-btn");
    const csvImportFile = document.getElementById("csv-import-file");
    if (csvImportBtn && csvImportFile) {
      csvImportBtn.addEventListener("click", () => {
        csvImportFile.click();
      });

      csvImportFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.handleCsvImport(event.target.result);
          };
          reader.readAsText(file, "UTF-8");
        }
      });
    }
  }

  switchTab(tabName) {
    // Navigation highlights
    document.querySelectorAll(".nav-btn").forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Panel showing
    document.querySelectorAll(".tab-panel").forEach(panel => {
      if (panel.id === tabName) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });

    if (tabName === "vendor-analytics") {
      this.renderAnalytics();
    } else if (tabName === "history-logs") {
      this.renderHistory();
    }
  }

  /* ==========================================================================
     ACTIVE INSPECTION CORE LOGIC
     ========================================================================== */
  loadPO(poId) {
    const po = PO_DATABASE[poId];
    if (!po) return;

    // Set UI metadata
    document.getElementById("meta-po-no").textContent = po.poNo;
    document.getElementById("meta-supplier").textContent = po.supplier;
    document.getElementById("meta-date").textContent = po.date;
    document.getElementById("meta-temp").textContent = po.tempClass;
    document.getElementById("po-select").value = poId;

    // Load state cache
    if (!this.inspectionState[poId]) {
      this.inspectionState[poId] = po.items.map((item, idx) => ({
        itemIndex: idx,
        id: item.id,
        name: item.name,
        sku: item.sku,
        expectedQty: item.expectedQty,
        actualQty: item.expectedQty, // default matches expected
        status: "pending", // pass, fail, pending
        defectType: "none",
        responsibility: "none",
        photo: null,
        aiExplanation: ""
      }));
    }

    this.renderChecklist(this.inspectionState[poId]);
    this.updateSummary();
  }

  renderChecklist(states) {
    const container = document.getElementById("checklist-container");
    container.innerHTML = "";

    states.forEach((state, idx) => {
      const dbItem = PO_DATABASE[this.currentPOId].items[idx];

      const itemCard = document.createElement("div");
      itemCard.className = `checklist-item ${state.status === 'fail' ? 'failed' : ''}`;
      itemCard.id = `chk-item-${state.id}`;

      // Status button highlights
      const isPass = state.status === "pass";
      const isFail = state.status === "fail";

      itemCard.innerHTML = `
        <div class="checklist-item-main">
          <div class="item-info">
            <span class="item-title">${state.name}</span>
            <span class="item-sku">SKU: ${state.sku} | 單位: ${dbItem.unit}</span>
          </div>
          <div>
            <span class="item-qty-lbl">預計收貨:</span>
            <span class="item-qty-val">${state.expectedQty}</span>
          </div>
          <div class="qty-input-wrapper">
            <span class="item-qty-lbl">實收數量:</span>
            <input type="number" class="qty-input" value="${state.actualQty}" min="0" data-idx="${idx}" />
          </div>
          <div class="status-btn-group">
            <button class="status-btn pass ${isPass ? 'active-pass' : ''}" data-idx="${idx}" data-status="pass">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="mini-icon">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>合格</span>
            </button>
            <button class="status-btn fail ${isFail ? 'active-fail' : ''}" data-idx="${idx}" data-status="fail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="mini-icon">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              <span>不合格</span>
            </button>
          </div>
        </div>

        <!-- Defect Drawer (Hidden unless failed) -->
        <div class="defect-detail-drawer ${isFail ? '' : 'hidden'}" id="drawer-${idx}">
          <div class="defect-input-group">
            <label>異常類別 (Defect Category)：</label>
            <select class="select-input select-defect-type" data-idx="${idx}">
              <option value="包裝受損" ${state.defectType === '包裝受損' ? 'selected' : ''}>📦 包裝外部毀損/破裂</option>
              <option value="數量短缺" ${state.defectType === '數量短缺' ? 'selected' : ''}>🔢 實收數量不符 (短缺)</option>
              <option value="效期低於允收期" ${state.defectType === '效期低於允收期' ? 'selected' : ''}>📅 效期不符 (過期/即期)</option>
              <option value="溫度異常" ${state.defectType === '溫度異常' ? 'selected' : ''}>🌡️ 配送溫度不符規範</option>
              <option value="品質異常" ${state.defectType === '品質異常' ? 'selected' : ''}>⚠️ 商品發霉/生鏽/斑駁</option>
            </select>
          </div>
          <div class="defect-input-group">
            <label>責任歸屬 (Responsibility)：</label>
            <select class="select-input select-responsibility" data-idx="${idx}">
              <option value="供應商" ${state.responsibility === '供應商' ? 'selected' : ''}>🏷️ 供應商出貨瑕疵</option>
              <option value="物流商" ${state.responsibility === '物流商' ? 'selected' : ''}>🚚 物流商運輸損壞</option>
              <option value="庫內" ${state.responsibility === '庫內' ? 'selected' : ''}>🏢 庫內操作不當</option>
            </select>
          </div>
          <div class="defect-input-group">
            <label>異常證物拍照 (Photo Evidence)：</label>
            <div class="photo-uploader" data-idx="${idx}">
              <input type="file" accept="image/*" class="file-hidden-input hidden" id="file-${idx}" />
              ${state.photo ? 
                `<img src="${state.photo}" class="uploaded-preview-img" />
                 <button class="photo-remove-btn" data-idx="${idx}">&times;</button>` :
                `<div class="photo-uploader-content">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>開啟相機 / 上傳相片</span>
                 </div>`
              }
            </div>
          </div>

          <!-- Single Item AI generation box -->
          <div class="item-ai-comment-box">
            <div class="item-ai-header">
              <span>AI 自動產不合格說明</span>
              <button class="icon-btn-text btn-item-ai-gen" data-idx="${idx}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mini-icon text-warning">
                  <path d="m12 3-1.912 5.886L4.202 9l5.886 1.912L12 16.798l1.912-5.886L19.798 9l-5.886-1.912z"/>
                </svg>
                <span>重新生成</span>
              </button>
            </div>
            <textarea class="item-ai-text" id="ai-text-${idx}" placeholder="點擊上方按鈕，自動分析生產生鮮退貨成因與處理建議。">${state.aiExplanation || '尚未生成異常說明。'}</textarea>
          </div>
        </div>
      `;

      container.appendChild(itemCard);
      this.bindItemEvents(itemCard, idx);
    });
  }

  bindItemEvents(itemCard, idx) {
    // Quantity changed
    itemCard.querySelector(".qty-input").addEventListener("change", (e) => {
      const val = parseInt(e.target.value) || 0;
      this.inspectionState[this.currentPOId][idx].actualQty = val;
      
      // Auto tag '數量短缺' if actual < expected
      const state = this.inspectionState[this.currentPOId][idx];
      if (val < state.expectedQty && state.status === "fail" && state.defectType === "none") {
        state.defectType = "數量短缺";
        itemCard.querySelector(".select-defect-type").value = "數量短缺";
      }

      this.saveActiveSession();
      this.updateSummary();
      this.updateSingleItemAI(idx);
    });

    // Pass / Fail clicks
    itemCard.querySelectorAll(".status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const status = btn.dataset.status;
        const current = this.inspectionState[this.currentPOId][idx];
        
        if (current.status === status) {
          current.status = "pending"; // toggle off
        } else {
          current.status = status;
        }

        // Initialize defect options on fail
        if (current.status === "fail") {
          if (current.defectType === "none") current.defectType = "包裝受損";
          if (current.responsibility === "none") current.responsibility = "供應商";
          
          // Auto fill AI description if empty
          this.updateSingleItemAI(idx);
        }

        this.saveActiveSession();
        this.renderChecklist(this.inspectionState[this.currentPOId]);
        this.updateSummary();
      });
    });

    // Check if failed drawer elements are present, then bind them
    const drawer = itemCard.querySelector(`#drawer-${idx}`);
    if (drawer && !drawer.classList.contains("hidden")) {
      // Defect type change
      drawer.querySelector(".select-defect-type").addEventListener("change", (e) => {
        this.inspectionState[this.currentPOId][idx].defectType = e.target.value;
        this.saveActiveSession();
        this.updateSingleItemAI(idx);
      });

      // Responsibility change
      drawer.querySelector(".select-responsibility").addEventListener("change", (e) => {
        this.inspectionState[this.currentPOId][idx].responsibility = e.target.value;
        this.saveActiveSession();
        this.updateSingleItemAI(idx);
      });

      // AI Text Area edits
      drawer.querySelector(".item-ai-text").addEventListener("input", (e) => {
        this.inspectionState[this.currentPOId][idx].aiExplanation = e.target.value;
        this.saveActiveSession();
      });

      // Photo upload click triggering input file
      const uploader = drawer.querySelector(".photo-uploader");
      const fileInput = drawer.querySelector(`#file-${idx}`);
      
      uploader.addEventListener("click", (e) => {
        // Prevent click bubbling from remove button
        if (e.target.classList.contains("photo-remove-btn")) return;
        fileInput.click();
      });

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.inspectionState[this.currentPOId][idx].photo = event.target.result;
            this.saveActiveSession();
            this.renderChecklist(this.inspectionState[this.currentPOId]);
          };
          reader.readAsDataURL(file);
        }
      });

      // Remove photo
      const removeBtn = drawer.querySelector(".photo-remove-btn");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          this.inspectionState[this.currentPOId][idx].photo = null;
          this.saveActiveSession();
          this.renderChecklist(this.inspectionState[this.currentPOId]);
        });
      }

      // Single item AI Regenerate
      drawer.querySelector(".btn-item-ai-gen").addEventListener("click", () => {
        this.updateSingleItemAI(idx, true);
      });
    }
  }

  /* ==========================================================================
     BARCODE SEARCH & SCANNING
     ========================================================================== */
  handleBarcodeSearch(query) {
    if (!query) return;
    const items = this.inspectionState[this.currentPOId];
    
    // Exact or partial match on SKU/barcode or Name
    const foundIdx = items.findIndex(item => 
      item.sku === query || 
      item.name.toLowerCase().includes(query.toLowerCase())
    );

    if (foundIdx !== -1) {
      const itemId = items[foundIdx].id;
      const element = document.getElementById(`chk-item-${itemId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("search-highlight");
        
        // Remove highlight after animation
        setTimeout(() => {
          element.classList.remove("search-highlight");
        }, 3000);

        // Flash target visually and clear search box
        document.getElementById("barcode-input").value = "";
      }
    } else {
      alert(`找不到與「${query}」相符的驗收品項，請重新確認！`);
    }
  }

  openScannerModal() {
    const modal = document.getElementById("scanner-modal");
    modal.classList.remove("hidden");
    
    // Inject presets for current PO
    const list = document.getElementById("barcode-presets-list");
    list.innerHTML = "";
    
    const items = PO_DATABASE[this.currentPOId].items;
    items.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "scan-preset-btn";
      btn.innerHTML = `
        <span>${item.name}</span>
        <span class="scan-preset-code">${item.sku}</span>
      `;
      btn.addEventListener("click", () => {
        this.handleBarcodeSearch(item.sku);
        this.closeScannerModal();
      });
      list.appendChild(btn);
    });
  }

  closeScannerModal() {
    document.getElementById("scanner-modal").classList.add("hidden");
  }

  /* ==========================================================================
     MOCK & GEMINI API AI ENGINES
     ========================================================================== */
  // Generates single-item defect explanations
  updateSingleItemAI(idx, forceRegen = false) {
    const state = this.inspectionState[this.currentPOId][idx];
    if (state.status !== "fail") return;

    if (state.aiExplanation && !forceRegen) {
      return; // already has explanation and not forcing
    }

    const diff = state.expectedQty - state.actualQty;
    const desc = this.generateLocalAIExplanationText(
      state.name, 
      state.defectType, 
      state.responsibility, 
      diff > 0 ? diff : 1,
      "business"
    );

    state.aiExplanation = desc;
    this.saveActiveSession();
    
    const txtArea = document.getElementById(`ai-text-${idx}`);
    if (txtArea) {
      txtArea.value = desc;
    }
  }

  generateLocalAIExplanationText(itemName, defectType, responsibility, count, tone) {
    // Basic templates
    const intros = {
      business: `本廠進行貨物收貨驗收時，發現由「${responsibility}」端所導致之貨品異常。`,
      strict: `嚴重異常警示：本廠於驗收流程中查獲不合格品項。經查該缺失屬「${responsibility}」重大疏失。`,
      friendly: `您好，關於本次收貨驗收，部分貨品可能在配送或包裝上有些微狀況需請您協助追蹤。`
    };

    const details = {
      "包裝受損": {
        business: `品項【${itemName}】有包裝外部毀損、破裂現象，涉及數量約 ${count} 單位。這可能導致內容物暴露並造成交叉污染或損壞，因此拒絕允收。`,
        strict: `品項【${itemName}】嚴重包裝破裂（共 ${count} 單位），內部產品已直接暴露，完全不符合本廠衛生/工程允收標準，已全數扣除。`,
        friendly: `品項【${itemName}】大約有 ${count} 單位的外包裝在運送時有擠壓受損，為了安全起見這部分我們必須先退回。`
      },
      "數量短缺": {
        business: `品項【${itemName}】經實地清點，應收 ${count + 10}，實收僅 ${count}，短缺 ${count} 單位。此數量落差不符出貨單載明數。`,
        strict: `品項【${itemName}】數量重大短缺！實到數落後應到數達 ${count} 單位，懷疑漏裝貨或中途失竊，請立即補足否則進行扣款處置。`,
        friendly: `品項【${itemName}】實收清點時發現少了 ${count} 單位，可能是出貨時漏數了，再麻煩您幫我們確認一下。`
      },
      "效期低於允收期": {
        business: `品項【${itemName}】（${count} 單位）之保存期限已低於本廠規定的安全允收天數，為確保產品架上壽命，拒絕入庫。`,
        strict: `品項【${itemName}】（${count} 單位）效期嚴重過期或極度接近效期截止日！本廠嚴禁進口即期品，此行為已違反合約品質條款。`,
        friendly: `品項【${itemName}】（${count} 單位）的保存期限比我們合約約定的時間稍短了一些，考量到後續消化時間，這批需退回換貨。`
      },
      "溫度異常": {
        business: `品項【${itemName}】（共 ${count} 單位）於收貨時進行測溫，發現溫度已高於規範範圍。此溫控鏈中斷可能導致食品或敏感電子件質變。`,
        strict: `品項【${itemName}】冷凍/冷藏鏈完全失效！實測溫度超標嚴重（共 ${count} 單位），有極高質變風險，將予以銷毀並保留索賠權。`,
        friendly: `品項【${itemName}】（共 ${count} 單位）到貨時溫度偏高，可能冷藏車在路途中有失溫狀況，為維護品質我們無法收下。`
      },
      "品質異常": {
        business: `品項【${itemName}】抽樣發現有外觀發霉、氧化斑駁或金屬生鏽等結構性品質瑕疵，涉及 ${count} 單位。`,
        strict: `品項【${itemName}】嚴重品質異常！部分貨品呈現發霉或受潮變質（約 ${count} 單位），此批次原廠品管明顯存在系統性漏洞！`,
        friendly: `品項【${itemName}】抽驗時發現 ${count} 單位有表面瑕疵/發霉狀況，再請與品管部門同步確認出貨狀況。`
      }
    };

    const outRo = {
      "供應商": "後續將逕行連絡原廠供應商進行換貨或折讓處理。",
      "物流商": "已向貨運司機現場立據簽認，將轉由物流承保險進行索賠程序。",
      "庫內": "已轉送倉庫督導人進行庫內作業流程覆核與責任懲處。"
    };

    const outro = outRo[responsibility] || "後續將依採購契約條款辦理。";

    const intro = intros[tone] || intros.business;
    const body = details[defectType]?.[tone] || `${itemName} 有瑕疵，涉及數為 ${count}，無法允收。`;

    return `${intro}\n${body}\n【責任歸屬】：${responsibility}端負責。 ${outro}`;
  }

  // Generates PO Global Non-Conformance Report (NCR)
  async generateGlobalAIReport() {
    const states = this.inspectionState[this.currentPOId];
    const failedItems = states.filter(s => s.status === "fail");

    if (failedItems.length === 0) {
      alert("目前沒有任何不合格項目，無須生成不合格報告。");
      return;
    }

    const empty = document.getElementById("ai-empty-state");
    const loader = document.getElementById("ai-loading-state");
    const result = document.getElementById("ai-result-state");
    const outputText = document.getElementById("ai-text-output");

    empty.classList.add("hidden");
    loader.classList.remove("hidden");
    result.classList.add("hidden");

    const tone = document.getElementById("ai-tone").value;
    const po = PO_DATABASE[this.currentPOId];

    // Read API configuration
    const apiKey = localStorage.getItem("gemini_api_key");
    const model = localStorage.getItem("gemini_model") || "gemini-1.5-flash";

    let reportText = "";

    if (apiKey) {
      // Perform REAL Gemini API Call!
      try {
        const failedSummaryStr = failedItems.map(item => 
          `- 品項: ${item.name}, 預計數: ${item.expectedQty}, 實收數: ${item.actualQty}, 異常類別: ${item.defectType}, 責任方: ${item.responsibility}, AI備註: ${item.aiExplanation}`
        ).join("\n");

        const prompt = `你是一個專業的倉庫與採購品質督導經理。請為以下收貨驗收異常品項，撰寫一份正式的不合格報告 (Non-Conformance Report, NCR)。
        
採購單號：${po.poNo}
供應商：${po.supplier}
溫控類別：${po.tempClass}
異常品項清單：
${failedSummaryStr}

要求：
1. 報告語氣：請使用「${tone === 'strict' ? '嚴厲警告與限期改善' : tone === 'friendly' ? '溫和友好、期望攜手改善' : '客觀商務、公事公辦'}」的語意風格。
2. 內容結構：包含【異常摘要與背景說明】、【不合格項目列表與責任分析】、【後續財務折讓/換貨處置建議】。
3. 輸出語言：請使用繁體中文。`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!response.ok) {
          throw new Error(`API 返回錯誤碼: ${response.status}`);
        }

        const data = await response.json();
        reportText = data.candidates[0].content.parts[0].text;
      } catch (err) {
        console.error("Gemini API 請求失敗，改為本地模板生成...", err);
        // Fallback to local generator but append warning
        reportText = `【警告：Gemini API 呼叫失敗，改由本地模板生成】\n\n` + this.generateLocalGlobalReport(po, failedItems, tone);
      }
    } else {
      // Simulate network latency for mock AI to feel realistic and premium
      await new Promise(resolve => setTimeout(resolve, 800));
      reportText = this.generateLocalGlobalReport(po, failedItems, tone);
    }

    // Display result
    loader.classList.add("hidden");
    result.classList.remove("hidden");
    outputText.value = reportText;
  }

  generateLocalGlobalReport(po, failedItems, tone) {
    const titles = {
      business: `【驗收不合格聯單 / NCR 說明書】\n採購單號：${po.poNo}\n供應商：${po.supplier}\n驗收日期：2026-06-04\n==========================================\n\n本次進貨驗收，經現場品管人員清點核對，發現下列項目異常，不予允收入庫：\n\n`,
      strict: `【警告：驗收異常改善限期通知書】\n發文字號：QC-${po.poNo}\n受文者：${po.supplier}\n==========================================\n\n主旨：針對本次採購之物資，現場查核有重大製程/包裝或冷鏈運送品質瑕疵，通知限期提出改善報告 (8D Report)。\n\n`,
      friendly: `【進貨異常溫馨提示信】\n合作夥伴：${po.supplier} 您好：\n感謝您本次的配送。今天我們在進行進貨點交時，有發現部分小瑕疵，需要與您說明並討論後續的處理方式：\n\n`
    };

    let body = titles[tone] || titles.business;

    failedItems.forEach((item, idx) => {
      body += `${idx + 1}. 品項：${item.name}\n`;
      body += `   - 條碼/SKU：${item.sku}\n`;
      body += `   - 預收數量：${item.expectedQty} | 實收數量：${item.actualQty} (短缺量：${item.expectedQty - item.actualQty})\n`;
      body += `   - 異常類型：${item.defectType} | 責任方：${item.responsibility}\n`;
      body += `   - 詳細說明：${item.aiExplanation}\n\n`;
    });

    const endings = {
      business: `處置建議：\n1. 請供應商於 3 個工作天內確認短缺數量，並於下一批次出貨時折抵金額或安排補貨。\n2. 由物流商引起之包裝破損，本廠將直接扣除該筆運費並進行索賠。\n3. 所有不合格品今日已全數退回或隔離存放。`,
      strict: `懲處與後續處理：\n1. 凡屬供應商責任者，本廠將依合約「品質瑕疵懲罰性條款」扣除該項貨款 20% 作為罰金。\n2. 請於收到本通知 48 小時內，指派品管主管與我司對接說明，並提交品保改善對策。\n3. 本廠保留合約終止與商業追訴權。`,
      friendly: `後續配合事宜：\n1. 我們會先依實收數量進行入庫，差額部分請幫我們安排在下期帳單折折讓，或在下次配送時補寄給我們。\n2. 運送途中的小碰撞，後續我們也會和貨運司機溝通加強防護措施，謝謝您的體諒與配合！`
    };

    body += `==========================================\n${endings[tone] || endings.business}`;
    return body;
  }

  /* ==========================================================================
     SUMMARY & LOGISTICS LOCK UPDATES
     ========================================================================== */
  updateSummary() {
    const states = this.inspectionState[this.currentPOId];
    if (!states) return;

    const total = states.length;
    const passed = states.filter(s => s.status === "pass").length;
    const failed = states.filter(s => s.status === "fail").length;
    const pending = states.filter(s => s.status === "pending").length;

    // Calculate percentage
    const completedCount = total - pending;
    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    // Update progress bar
    const bar = document.getElementById("progress-bar");
    const pctText = document.getElementById("progress-percentage");
    const statusText = document.getElementById("progress-status-text");

    bar.style.width = `${pct}%`;
    pctText.textContent = `${pct}%`;

    // Anti-omission locks
    const submitBtn = document.getElementById("submit-inspection-btn");
    const aiGenBtn = document.getElementById("generate-ai-report-btn");

    if (pct < 100) {
      submitBtn.disabled = true;
      statusText.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mini-icon text-warning">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>還有 ${pending} 項產品尚未進行檢驗。請全部勾選後以送出驗收單。</span>
      `;
      submitBtn.title = "請勾選所有項目狀態才可送出";
    } else {
      submitBtn.disabled = false;
      statusText.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mini-icon text-success">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>所有項目已驗收完畢，驗收單已解鎖，可以提交。</span>
      `;
      submitBtn.removeAttribute("title");
    }

    // AI Generate button active if there are failures
    aiGenBtn.disabled = failed === 0;

    // Update bottom stats cards
    document.getElementById("summary-total-items").textContent = total;
    document.getElementById("summary-passed-items").textContent = passed;
    document.getElementById("summary-failed-items").textContent = failed;

    const passRateVal = passed + failed > 0 ? Math.round((passed / (passed + failed)) * 100) : 0;
    const rateEl = document.getElementById("summary-pass-rate");
    rateEl.textContent = `${passRateVal}%`;
    if (passRateVal === 100) {
      rateEl.className = "stat-val text-success";
    } else if (passRateVal < 80) {
      rateEl.className = "stat-val text-danger";
    } else {
      rateEl.className = "stat-val text-warning";
    }
  }

  resetActiveInspection() {
    const poId = this.currentPOId;
    delete this.inspectionState[poId];
    this.saveActiveSession();
    this.loadPO(poId);
    
    // Clear AI outputs
    document.getElementById("ai-empty-state").classList.remove("hidden");
    document.getElementById("ai-loading-state").classList.add("hidden");
    document.getElementById("ai-result-state").classList.add("hidden");
  }

  submitInspection() {
    const states = this.inspectionState[this.currentPOId];
    const po = PO_DATABASE[this.currentPOId];
    
    const passed = states.filter(s => s.status === "pass").length;
    const failed = states.filter(s => s.status === "fail").length;
    const defects = states.filter(s => s.status === "fail").map(s => ({
      itemName: s.name,
      defectType: s.defectType,
      responsibility: s.responsibility,
      qtyDiff: s.expectedQty - s.actualQty || 1
    }));

    const passRate = Math.round((passed / states.length) * 100);

    const newLog = {
      receiptNo: `REC-${Date.now().toString().slice(-6)}`,
      poNo: po.poNo,
      supplier: po.supplier,
      date: new Date().toISOString().split('T')[0],
      totalItems: states.length,
      passedItems: passed,
      failedItems: failed,
      passRate: passRate,
      status: "已完成",
      defects: defects
    };

    // Add to history
    this.historyLogs.unshift(newLog);
    this.saveHistory();

    // Clear session storage cache for this PO
    delete this.inspectionState[this.currentPOId];
    this.saveActiveSession();

    alert(`驗收單「${newLog.receiptNo}」已成功提交！資料已同步寫入歷史資料庫與供應商 KPI 數據庫。`);

    // Jump to History tab and re-render
    this.switchTab("history-logs");
    this.renderHistory();
    this.renderAnalytics();
  }

  /* ==========================================================================
     HISTORY VIEWER
     ========================================================================== */
  renderHistory() {
    const tbody = document.getElementById("history-table-body");
    tbody.innerHTML = "";

    if (this.historyLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">無歷史驗收紀錄</td></tr>`;
      return;
    }

    this.historyLogs.forEach(log => {
      const tr = document.createElement("tr");
      
      const rateClass = log.passRate === 100 ? "text-success" : log.passRate < 80 ? "text-danger" : "text-warning";

      tr.innerHTML = `
        <td><b>${log.receiptNo}</b></td>
        <td>${log.poNo}</td>
        <td>${log.supplier}</td>
        <td><span class="font-bold ${rateClass}">${log.passRate}%</span></td>
        <td>${log.failedItems} 項</td>
        <td>${log.date}</td>
        <td><span class="table-badge completed">${log.status}</span></td>
        <td>
          <button class="icon-btn-text text-success btn-export-pdf" data-no="${log.receiptNo}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mini-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>下載報告</span>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind export events
    tbody.querySelectorAll(".btn-export-pdf").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const no = btn.dataset.no;
        this.exportPDFReport(no);
      });
    });
  }

  exportPDFReport(receiptNo) {
    const log = this.historyLogs.find(h => h.receiptNo === receiptNo);
    if (!log) return;

    // Simulate exporting PDF by generating a beautiful text layout to download as a text file representation or print it
    const title = `==================================================\n`;
    const header = `【RECEIPT IQ】數位驗收電子報表 - ${log.receiptNo}\n`;
    const meta = `驗收日期: ${log.date}\n採購單號: ${log.poNo}\n供應商: ${log.supplier}\n合格率: ${log.passRate}%\n合格品項數: ${log.passedItems} / ${log.totalItems}\n==================================================\n\n`;
    
    let defectsStr = `不合格異常細項:\n`;
    if (log.defects.length === 0) {
      defectsStr += `無任何異常項目，全數合格允收入庫。\n`;
    } else {
      log.defects.forEach((d, i) => {
        defectsStr += `[異常 ${i+1}] 品項: ${d.itemName}\n`;
        defectsStr += `    - 異常種類: ${d.defectType}\n`;
        defectsStr += `    - 責任方歸屬: ${d.responsibility}端\n`;
        defectsStr += `    - 數量差額: ${d.qtyDiff}\n\n`;
      });
    }

    const footer = `\n==================================================\n驗收人員簽核: Tseyu  |  倉儲主管核示: ________________`;

    const fullTxt = title + header + title + meta + defectsStr + footer;
    
    // Download logic
    const blob = new Blob([fullTxt], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `驗收單_${log.receiptNo}_報告.txt`;
    link.click();
  }

  /* ==========================================================================
     SUPPLIER PERFORMANCE & CHART ENGINE
     ========================================================================== */
  renderAnalytics() {
    const logs = this.historyLogs;
    if (logs.length === 0) return;

    // 1. Compute high-level KPIs
    const totalReceipts = logs.length;
    let sumRates = 0;
    const defectCounts = {};
    const supplierStats = {};

    logs.forEach(log => {
      sumRates += log.passRate;
      
      // Defect categories
      log.defects.forEach(d => {
        defectCounts[d.defectType] = (defectCounts[d.defectType] || 0) + 1;
      });

      // Supplier performance aggregated
      if (!supplierStats[log.supplier]) {
        supplierStats[log.supplier] = { total: 0, passed: 0 };
      }
      supplierStats[log.supplier].total += log.totalItems;
      supplierStats[log.supplier].passed += log.passedItems;
    });

    const avgPassRate = Math.round(sumRates / totalReceipts);

    // Most common defect
    let commonDefect = "無異常紀錄";
    let maxDefCount = 0;
    for (const type in defectCounts) {
      if (defectCounts[type] > maxDefCount) {
        maxDefCount = defectCounts[type];
        commonDefect = `${type} (${maxDefCount}次)`;
      }
    }

    // Worst performing vendor
    let worstVendor = "全數良好";
    let lowestRate = 100;
    for (const vendor in supplierStats) {
      const rate = Math.round((supplierStats[vendor].passed / supplierStats[vendor].total) * 100);
      if (rate < lowestRate) {
        lowestRate = rate;
        worstVendor = `${vendor} (${rate}%)`;
      }
    }

    // Update DOM
    document.getElementById("kpi-total-receipts").textContent = totalReceipts;
    document.getElementById("kpi-avg-pass-rate").textContent = `${avgPassRate}%`;
    document.getElementById("kpi-common-defect").textContent = commonDefect;
    document.getElementById("kpi-worst-vendor").textContent = worstVendor;

    // 2. Render Supplier Bar Chart (Horizontal HTML bars)
    const barChartContainer = document.getElementById("vendor-bar-chart");
    barChartContainer.innerHTML = "";

    const vendorsArray = Object.keys(supplierStats).map(vendor => {
      const rate = Math.round((supplierStats[vendor].passed / supplierStats[vendor].total) * 100);
      return { name: vendor, rate: rate };
    }).sort((a, b) => b.rate - a.rate); // sort descending

    vendorsArray.forEach(v => {
      const row = document.createElement("div");
      row.className = "chart-bar-row";
      
      let barColor = "var(--success-color)";
      if (v.rate < 75) barColor = "var(--danger-color)";
      else if (v.rate < 95) barColor = "var(--warning-color)";

      row.innerHTML = `
        <div class="chart-bar-info">
          <span class="chart-label-name">${v.name}</span>
          <span class="chart-label-value">${v.rate}%</span>
        </div>
        <div class="chart-bar-outer">
          <div class="chart-bar-inner" style="width: ${v.rate}%; background: ${barColor};"></div>
        </div>
      `;
      barChartContainer.appendChild(row);
    });

    // 3. Render Defect Pie/Donut Chart (Custom SVG dynamically drawn)
    const pieChartContainer = document.getElementById("defect-pie-chart");
    pieChartContainer.innerHTML = "";

    const totalDefects = Object.values(defectCounts).reduce((a, b) => a + b, 0);

    if (totalDefects === 0) {
      pieChartContainer.innerHTML = `<p class="text-center text-muted" style="margin-top: 5rem;">無瑕疵異常統計</p>`;
      return;
    }

    const defectColors = {
      "包裝受損": "#ef4444", // red
      "數量短缺": "#f59e0b", // yellow/amber
      "效期低於允收期": "#00bcd4", // cyan
      "溫度異常": "#3f51b5", // indigo
      "品質異常": "#9c27b0"  // purple
    };

    // Draw donut
    let svgContent = `<svg class="donut-svg" viewBox="0 0 36 36" style="width:100%; height:100%;">
      <circle class="donut-ring" cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="3"></circle>`;
    
    let currentPercent = 0;
    const legendItems = [];

    for (const type in defectCounts) {
      const count = defectCounts[type];
      const pct = Math.round((count / totalDefects) * 100);
      const color = defectColors[type] || "#94a3b8";

      // Draw stroke dashes: stroke-dasharray="percent remaining" stroke-dashoffset="currentPercent"
      const dashArray = `${pct} ${100 - pct}`;
      const dashOffset = 100 - currentPercent + 25; // +25 to start at 12 o'clock

      svgContent += `
        <circle class="donut-segment" cx="18" cy="18" r="15.915" fill="none" 
                stroke="${color}" stroke-width="3" 
                stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}"></circle>
      `;

      currentPercent += pct;

      legendItems.push(`
        <div class="legend-item">
          <div class="legend-color-box" style="background-color: ${color}"></div>
          <span>${type} - <b>${pct}%</b> (${count}次)</span>
        </div>
      `);
    }

    svgContent += `
      <g class="donut-text">
        <text x="50%" y="49%" text-anchor="middle" dy=".3em" fill="var(--text-main)" font-size="5" font-weight="800">${totalDefects}</text>
        <text x="50%" y="65%" text-anchor="middle" fill="var(--text-muted)" font-size="2">異常次數</text>
      </g>
    </svg>`;

    const donutWrapper = document.createElement("div");
    donutWrapper.className = "donut-chart-wrapper";
    
    const svgContainer = document.createElement("div");
    svgContainer.className = "donut-svg-container";
    svgContainer.innerHTML = svgContent;

    const legendContainer = document.createElement("div");
    legendContainer.className = "donut-legend";
    legendContainer.innerHTML = legendItems.join("");

    donutWrapper.appendChild(svgContainer);
    donutWrapper.appendChild(legendContainer);
    pieChartContainer.appendChild(donutWrapper);
  }

  /* ==========================================================================
     API KEY CONFIG MODAL CONTROLS
     ========================================================================== */
  openApiModal() {
    const modal = document.getElementById("api-modal");
    modal.classList.remove("hidden");
    
    // Load config values
    const key = localStorage.getItem("gemini_api_key") || "";
    const model = localStorage.getItem("gemini_model") || "gemini-1.5-flash";

    document.getElementById("api-key-input").value = key;
    document.getElementById("api-model-select").value = model;
  }

  closeApiModal() {
    document.getElementById("api-modal").classList.add("hidden");
  }

  saveApiConfig() {
    const key = document.getElementById("api-key-input").value.trim();
    const model = document.getElementById("api-model-select").value;

    if (key) {
      localStorage.setItem("gemini_api_key", key);
      document.getElementById("connection-status").textContent = "Gemini AI 協同模式";
      document.getElementById("connection-status").className = "badge text-success";
      document.getElementById("connection-status").style.backgroundColor = "rgba(16, 185, 129, 0.15)";
      document.getElementById("connection-status").style.borderColor = "var(--success-border)";
    } else {
      localStorage.removeItem("gemini_api_key");
      document.getElementById("connection-status").textContent = "離線暫存模式";
      document.getElementById("connection-status").className = "badge offline";
      document.getElementById("connection-status").style.background = "";
      document.getElementById("connection-status").style.borderColor = "";
    }

    localStorage.setItem("gemini_model", model);
    this.closeApiModal();
    alert("Gemini AI API 設定已成功儲存！");
  }

  handleCsvImport(csvContent) {
    try {
      const lines = csvContent.split(/\r?\n/);
      if (lines.length < 2) {
        alert("CSV 檔案內容不足或空白！");
        return;
      }
      
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 5) continue;
        records.push({
          date: cols[0] ? cols[0].trim() : '',
          supplier: cols[1] ? cols[1].trim() : '',
          item: cols[2] ? cols[2].trim() : '',
          checkItem: cols[3] ? cols[3].trim() : '',
          result: cols[4] ? cols[4].trim() : ''
        });
      }

      if (records.length === 0) {
        alert("未偵測到任何符合格式的驗收紀錄！");
        return;
      }

      // Helper to normalize dates
      const normalizeDate = (dateStr) => {
        if (!dateStr) return '2026-06-04';
        if (/^\d{8}$/.test(dateStr)) {
          return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
        }
        if (dateStr.includes('/') || dateStr.includes('-')) {
          const sep = dateStr.includes('/') ? '/' : '-';
          const parts = dateStr.split(sep);
          if (parts.length === 3) {
            const y = parts[0].padStart(4, '0');
            const m = parts[1].padStart(2, '0');
            const d = parts[2].padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
        }
        const engMatch = dateStr.match(/^(\d+)\s+([a-zA-Z]+)\s+(\d{4})$/);
        if (engMatch) {
          const day = engMatch[1].padStart(2, '0');
          const monthName = engMatch[2].toLowerCase().substring(0, 3);
          const year = engMatch[3];
          const months = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
          };
          const mon = months[monthName] || '06';
          return `${year}-${mon}-${day}`;
        }
        return '2026-06-04';
      };

      const groups = {};
      records.forEach(r => {
        const normDate = normalizeDate(r.date);
        const supplier = r.supplier || '未知供應商';
        const key = `${normDate}||${supplier}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      const parsedLogs = [];
      for (const key in groups) {
        const [date, supplier] = key.split('||');
        const items = groups[key];
        const defects = [];
        let passedCount = 0;
        let failedCount = 0;

        items.forEach(item => {
          const res = item.result;
          const isPass = (res === '項目1' || res === 'A');
          const itemName = item.item || '未命名食材';
          if (isPass) {
            passedCount++;
          } else {
            failedCount++;
            let defectType = '數量短缺';
            let responsibility = '供應商';
            
            if (res === '項目2' || res === 'B') {
              defectType = '包裝受損';
              responsibility = '物流商';
            } else if (res === '項目3' || res === 'C') {
              defectType = '品質異常';
              responsibility = '供應商';
            } else if (!res) {
              defectType = '溫度異常';
              responsibility = '物流商';
            }
            
            defects.push({
              itemName: itemName,
              defectType: defectType,
              responsibility: responsibility,
              qtyDiff: 1
            });
          }
        });

        const totalItems = items.length;
        const passRate = totalItems > 0 ? Math.round((passedCount / totalItems) * 100) : 100;
        const cleanDate = date.replace(/-/g, '');
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

        parsedLogs.push({
          receiptNo: `REC-${cleanDate}-${rand}`,
          poNo: `PO-${cleanDate}`,
          supplier: supplier,
          date: date,
          totalItems: totalItems,
          passedItems: passedCount,
          failedItems: failedCount,
          passRate: passRate,
          status: "已完成",
          defects: defects
        });
      }

      parsedLogs.sort((a, b) => b.date.localeCompare(a.date));

      // Merge and deduplicate by date + supplier
      this.historyLogs = [...parsedLogs, ...this.historyLogs];
      
      const seen = new Set();
      this.historyLogs = this.historyLogs.filter(item => {
        const k = `${item.date}||${item.supplier}`;
        const duplicate = seen.has(k);
        seen.add(k);
        return !duplicate;
      });

      this.historyLogs.sort((a, b) => b.date.localeCompare(a.date));
      this.saveHistory();
      
      this.renderHistory();
      this.renderAnalytics();
      alert(`成功匯入 CSV 檔案！已新增/更新 ${parsedLogs.length} 筆歷史驗收單數據。`);
    } catch (err) {
      console.error(err);
      alert("匯入 CSV 失敗，請確認檔案格式是否正確。");
    }
  }
}

// Instantiate application on window load
window.addEventListener("DOMContentLoaded", () => {
  window.app = new InspectionApp();
});
