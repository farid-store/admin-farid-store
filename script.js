// ===============================================
// 🏢 KONFIGURASI MULTI-RESELLER (LOKAL)
// ===============================================
const resellers = [
    { id: "all", name: "🌎 GLOBAL (Semua Cabang)", binId: null, apiKey: null },
    { id: "RSL-PST", name: "Cabang Pusat (Pekanbaru)", binId: "BIN_ID_PUSAT_ANDA", apiKey: "API_KEY_PUSAT_ANDA" },
    { id: "RSL-CB1", name: "Cabang Dumai", binId: "BIN_ID_DUMAI_ANDA", apiKey: "API_KEY_DUMAI_ANDA" }
    // Tambahkan cabang lain di sini
];

// STATE VARIABLES
let currentResellerId = "RSL-PST"; // Default buka cabang pusat
let isGlobalView = false;
let items = [];
let extraProfits = [];
let targetGoal = 25000000;
let targetName = "Target Omset";
let globalStartBalance = 0;

let currentFilter = 'stok';
let currentSort = 'date_desc';
let currentUserMode = 'client_view'; 
let isBlurMode = false;
let currentEditId = null;

// ===============================================
// 🔐 INIT & AUTH LOGIC
// ===============================================
window.onload = () => {
    // Populate Dropdown Cabang
    const select = document.getElementById('branchSelect');
    resellers.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id; opt.textContent = r.name;
        select.appendChild(opt);
    });
    select.value = currentResellerId;
    
    document.getElementById('currentMonth').innerText = new Date().toLocaleDateString('id-ID', {month:'long', year:'numeric'});
};

function checkAutoPin(el) { if (el.value.length === 6) checkPin(); }
function checkPin() {
    if (document.getElementById('pinInput').value === '011204') {
        currentUserMode = 'owner';
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('btnAccessIndicator').innerText = "OWNER MODE";
        document.getElementById('btnAccessIndicator').className = "w-full py-2 rounded-lg text-[10px] font-black bg-indigo-600 text-white";
        updateUIForMode();
        switchBranch(currentResellerId); // Load data
    } else {
        alert("PIN Salah!"); document.getElementById('pinInput').value = '';
    }
}

function enterClientMode() {
    currentUserMode = 'client_view';
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('btnAccessIndicator').innerText = "GUEST MODE";
    updateUIForMode();
    switchBranch(currentResellerId);
}

function enableSandboxMode() {
    currentUserMode = 'client_demo';
    document.getElementById('clientBanner').classList.add('hidden');
    document.getElementById('sandboxBanner').classList.remove('hidden');
    updateUIForMode();
}

function updateUIForMode() {
    const adminContent = document.querySelectorAll('.admin-only-view');
    const clientBanner = document.getElementById('clientBanner');
    if (currentUserMode === 'client_view') {
        adminContent.forEach(el => el.classList.add('hidden'));
        clientBanner.classList.remove('hidden');
    } else {
        adminContent.forEach(el => el.classList.remove('hidden'));
        clientBanner.classList.add('hidden');
    }
    renderRows(); 
}

// ===============================================
// ☁️ MULTI-TENANT FETCH ENGINE (INTI LOGIKA)
// ===============================================
async function switchBranch(id) {
    currentResellerId = id;
    isGlobalView = (id === 'all');
    
    // Mengatur Visibilitas Tombol Input (Dimatikan jika Global View)
    document.getElementById('actionPanelsWrapper').style.display = isGlobalView ? 'none' : 'block';
    document.getElementById('readOnlyBanner').style.display = isGlobalView ? 'block' : 'none';

    document.getElementById('loadingCloud').style.display = 'flex';
    document.getElementById('loadingText').innerText = "Menarik data dari database...";

    try {
        if (isGlobalView) {
            // Tarik data SEMUA cabang secara paralel
            const targets = resellers.filter(r => r.id !== 'all');
            const promises = targets.map(r => fetchJSONBin(r));
            const results = await Promise.all(promises);
            
            // Menggabungkan (Merge) semua data
            items = []; extraProfits = []; globalStartBalance = 0;
            results.forEach(res => {
                if(res.data) {
                    // Tambahkan label lokasi untuk identifikasi
                    const branchItems = (res.data.items || []).map(i => ({...i, branch: res.reseller.name}));
                    items = items.concat(branchItems);
                    globalStartBalance += (Number(res.data.startBalance) || 0);
                }
            });
            document.getElementById('startBalance').value = globalStartBalance;
        } else {
            // Tarik data 1 cabang saja
            const target = resellers.find(r => r.id === id);
            const res = await fetchJSONBin(target);
            if(res.data) {
                items = res.data.items || [];
                extraProfits = res.data.extraProfits || [];
                document.getElementById('startBalance').value = res.data.startBalance || 0;
            } else {
                items = []; extraProfits = []; document.getElementById('startBalance').value = 0;
            }
        }
        calculateAll(false);
    } catch(e) {
        console.error(e); alert("Gagal mengambil data jaringan.");
    } finally {
        document.getElementById('loadingCloud').style.display = 'none';
    }
}

async function fetchJSONBin(reseller) {
    if(reseller.binId.includes("BIN_ID")) return {reseller, data: getMockData(reseller.id)}; // Fallback lokal untuk testing
    const req = await fetch(`https://api.jsonbin.io/v3/b/${reseller.binId}/latest`, { headers: { 'X-Master-Key': reseller.apiKey }});
    const json = await req.json();
    return {reseller, data: json.record};
}

async function forceSync() {
    if (isGlobalView) return alert("Tidak bisa sinkronisasi di Mode Global. Pilih cabang spesifik.");
    if (currentUserMode !== 'owner') return alert("Akses Ditolak.");
    
    const target = resellers.find(r => r.id === currentResellerId);
    document.getElementById('loadingCloud').style.display = 'flex';
    
    try {
        const payload = { startBalance: document.getElementById('startBalance').value, items, extraProfits, targetGoal, targetName };
        await fetch(`https://api.jsonbin.io/v3/b/${target.binId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': target.apiKey },
            body: JSON.stringify(payload)
        });
        alert(`Data ${target.name} berhasil disimpan ke Cloud!`);
    } catch(e) { alert("Error: " + e.message); }
    finally { document.getElementById('loadingCloud').style.display = 'none'; }
}

// Data Dummy untuk tes lokal
function getMockData(id) {
    if(id === "RSL-PST") return { startBalance: 10000000, items: [{id:1, name:"iPhone 11", price: 5000000, modal: 4500000, status:"stok", entryDate:"01/03/2026", type:"new"}]};
    return { startBalance: 5000000, items: [{id:2, name:"Poco X6", price: 4000000, modal: 3500000, status:"sold", soldAt:"02/03/2026", type:"old"}]};
}

// ===============================================
// 💰 LOGIKA BISNIS & RENDER DOM
// ===============================================
function calculateAll(shouldSave = true) {
    const start = Number(document.getElementById('startBalance').value) || 0;
    let belanja = 0, uangMasuk = 0, profit = 0, floatPrice = 0, floatModal = 0;
    
    items.forEach(i => {
        if (i.status === 'sold') {
            if (i.type === 'new') belanja += i.modal; 
            uangMasuk += i.price; profit += (i.price - i.modal);
        } else {
            if (i.type === 'new') belanja += i.modal; 
            floatPrice += i.price; floatModal += i.modal;
        }
    });
    
    const totalProfitReal = profit + extraProfits.reduce((s, p) => s + p.profit, 0);
    const cash = start - belanja + uangMasuk;
    
    document.getElementById('summaryCash').innerText = "Rp " + cash.toLocaleString();
    document.getElementById('summaryFloating').innerText = "Rp " + floatPrice.toLocaleString();
    document.getElementById('summaryTotal').innerText = "Rp " + (cash + floatPrice).toLocaleString();
    document.getElementById('summaryProfit').innerText = "Rp " + totalProfitReal.toLocaleString();
    
    renderRows();
}

function parseText(type) {
    if (isGlobalView) return alert("Pindah ke cabang spesifik untuk menambah data.");
    const raw = document.getElementById('bulkInput').value;
    raw.split('\n').forEach(l => {
        if(l.includes('>')) {
            const p = l.split(/[:>]/);
            items.unshift({ id: Date.now()+Math.random(), name: p[0].trim(), modal: Number(p[1].replace(/\D/g,'')), price: Number(p[2].replace(/\D/g,'')), status: 'stok', type, entryDate: new Date().toLocaleDateString('id-ID') });
        }
    });
    document.getElementById('bulkInput').value = ''; calculateAll();
}

function setFilter(f) { currentFilter = f; renderRows(); }
function setSort(s) { currentSort = s; renderRows(); }

function renderRows() {
    const container = document.getElementById('itemRows');
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    let display = items.filter(i => i.status === currentFilter && i.name.toLowerCase().includes(search));
    
    container.innerHTML = '';
    display.forEach(item => {
        const div = document.createElement('div');
        div.className = `p-4 rounded-xl shadow-sm border bg-white mb-3 flex justify-between relative`;
        
        // Tampilkan label lokasi jika di Global View
        const branchBadge = isGlobalView ? `<span class="absolute -top-2 left-2 bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded shadow-sm font-bold border border-blue-200">📍 ${item.branch || 'Pusat'}</span>` : '';
        
        // Tombol aksi disembunyikan jika Global View
        const actionBtns = (isGlobalView || currentUserMode === 'client_view') ? '' : `
            <div class="flex flex-col gap-1 border-l pl-2">
                <button onclick="openEditModal(${item.id})" class="text-xs text-yellow-500">✏️</button>
                ${item.status === 'stok' ? `<button onclick="toggleSold(${item.id})" class="text-xs text-green-500">💰</button>` : ''}
            </div>
        `;

        div.innerHTML = `
            ${branchBadge}
            <div class="mt-1">
                <h4 class="font-bold text-sm text-slate-800">${item.name}</h4>
                <div class="text-[11px] text-slate-500 mt-1">
                    Modal: ${item.modal.toLocaleString()} | Jual: <b class="text-indigo-600">${item.price.toLocaleString()}</b>
                </div>
            </div>
            ${actionBtns}
        `;
        container.appendChild(div);
    });
}

// ACTION MODALS
function openEditModal(id) {
    if(isGlobalView) return;
    const i = items.find(x => x.id === id); if(!i) return;
    currentEditId = id;
    document.getElementById('editItemName').value = i.name;
    document.getElementById('editItemModal').value = i.modal;
    document.getElementById('editItemPrice').value = i.price;
    document.getElementById('editModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
function saveEditItem() {
    const i = items.find(x => x.id === currentEditId);
    i.name = document.getElementById('editItemName').value;
    i.modal = Number(document.getElementById('editItemModal').value);
    i.price = Number(document.getElementById('editItemPrice').value);
    closeEditModal(); calculateAll();
}
function toggleSold(id) { const i = items.find(x => x.id === id); if(i) { i.status='sold'; calculateAll(); } }

// UTILITIES
function switchPage(page) {
    ['page-main', 'page-analytics', 'page-hp', 'page-laptop', 'page-dial', 'page-repair'].forEach(p => {
        const el = document.getElementById(p); if(el) el.classList.add('hidden');
    });
    document.getElementById('page-' + page).classList.remove('hidden');
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); document.getElementById('overlay').classList.toggle('hidden'); }
function toggleBlur() { isBlurMode = !isBlurMode; document.querySelectorAll('.sensitive-data').forEach(el => isBlurMode ? el.classList.add('blur-sensitive') : el.classList.remove('blur-sensitive')); }

// KALKULATOR SIMPLE
let cInp='0', cPrv='', cOp=null;
function calcNum(n){ cInp = cInp==='0'?n:cInp+n; docUpd(); }
function calcOp(o){ cOp=o; cPrv=cInp; cInp=''; docUpd(); }
function calcDel(){ cInp=cInp.slice(0,-1)||'0'; docUpd(); }
function calcClear(){ cInp='0'; cPrv=''; cOp=null; docUpd(); }
function calcResult(){ cInp = eval(cPrv+cOp+cInp).toString(); cOp=null; cPrv=''; docUpd(); }
function docUpd(){ document.getElementById('calc-curr').innerText=cInp; document.getElementById('calc-prev').innerText=cPrv+ (cOp||''); }
