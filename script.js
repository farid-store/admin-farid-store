// Konfigurasi Database Reseller
const resellers = [
    { id: "all", name: "Semua Reseller / Global (Gabungan)" },
    { id: "RSL-001", name: "Cabang Pekanbaru", binId: "GANTI_DENGAN_BIN_ID_1", apiKey: "GANTI_DENGAN_API_KEY_1" },
    { id: "RSL-002", name: "Cabang Dumai", binId: "GANTI_DENGAN_BIN_ID_2", apiKey: "GANTI_DENGAN_API_KEY_2" }
    // Tambahkan reseller lain di sini...
];

// SETTING PENTING: Ubah ke false jika ingin menggunakan data asli dari JSONBin
const USE_MOCK_DATA = true; 

// Format Rupiah
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

// Inisialisasi Dropdown
const selectEl = document.getElementById('resellerSelect');
resellers.forEach(r => {
    const option = document.createElement('option');
    option.value = r.id;
    option.textContent = r.name;
    selectEl.appendChild(option);
});

// Fungsi untuk mengambil data 1 cabang dari JSONBin
async function fetchSingleReseller(reseller) {
    if (USE_MOCK_DATA) {
        // Simulasi loading dan data dummy
        await new Promise(r => setTimeout(r, 500)); 
        return {
            resellerName: reseller.name,
            kas: 15000000,
            stok: [
                { nama: "Poco X6 Pro", status: "Tersedia", modal: 4500000, estimasi: 5200000 },
                { nama: "iPhone 11", status: "Terjual", modal: 6000000, estimasi: 6800000 }
            ]
        };
    }

    // --- LOGIKA ASLI JSONBIN ---
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${reseller.binId}/latest`, {
            headers: { 'X-Master-Key': reseller.apiKey }
        });
        const data = await response.json();
        // Asumsi struktur JSONBin Anda: {"record": {"kas": 1000, "stok": [...]}}
        return {
            resellerName: reseller.name,
            kas: data.record.kas || 0,
            stok: data.record.stok || []
        };
    } catch (error) {
        console.error(`Gagal mengambil data ${reseller.name}:`, error);
        return { resellerName: reseller.name, kas: 0, stok: [] }; // Kembalikan kosong jika gagal
    }
}

// Fungsi Utama: Mengambil & Memproses Data
async function loadDashboard() {
    const selectedId = selectEl.value;
    const statusEl = document.getElementById('loadingStatus');
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menarik data dari server...';
    
    let combinedData = { totalKas: 0, totalAset: 0, allStok: [] };
    let targetResellers = [];

    if (selectedId === "all") {
        // Ambil semua reseller kecuali index 0 ("all")
        targetResellers = resellers.slice(1); 
    } else {
        targetResellers = [resellers.find(r => r.id === selectedId)];
    }

    // Menarik data paralel menggunakan Promise.all (Lebih Cepat!)
    const results = await Promise.all(targetResellers.map(r => fetchSingleReseller(r)));

    // Menggabungkan hasil
    results.forEach(res => {
        combinedData.totalKas += res.kas;
        
        res.stok.forEach(item => {
            // Tambahkan nama reseller ke setiap item stok untuk tabel
            item.lokasi = res.resellerName; 
            combinedData.allStok.push(item);
            
            // Hitung Aset hanya untuk barang yang belum terjual
            if (item.status.toLowerCase() === 'tersedia') {
                combinedData.totalAset += item.modal;
            }
        });
    });

    // Kalkulasi Grand Total Aset (Uang Kas + Modal Barang Tersedia)
    combinedData.totalAset += combinedData.totalKas;

    renderDashboard(combinedData);
    statusEl.innerHTML = '<i class="fas fa-check-circle" style="color: green;"></i> Data tersinkronisasi';
}

// Fungsi untuk merender ke HTML
function renderDashboard(data) {
    document.getElementById('totalCash').textContent = formatRupiah(data.totalKas);
    document.getElementById('totalAsset').textContent = formatRupiah(data.totalAset);
    
    // Filter stok yang tersedia untuk dihitung jumlah unitnya
    const stokTersedia = data.allStok.filter(i => i.status.toLowerCase() === 'tersedia');
    document.getElementById('totalStock').textContent = `${stokTersedia.length} Unit Tersedia`;

    // Render Tabel
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (data.allStok.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada data stok.</td></tr>';
        return;
    }

    data.allStok.forEach(item => {
        const badgeClass = item.status.toLowerCase() === 'tersedia' ? 'badge tersedia' : 'badge terjual';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.lokasi}</strong></td>
            <td>${item.nama}</td>
            <td><span class="${badgeClass}">${item.status}</span></td>
            <td>${formatRupiah(item.modal)}</td>
            <td>${formatRupiah(item.estimasi)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Event Listeners
selectEl.addEventListener('change', loadDashboard);
document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

// Load data pertama kali saat halaman dibuka
loadDashboard();
