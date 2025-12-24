import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, update, set, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- KONFIGURASI ---
const PASSWORD_RESET = "123456"; 
const MAPPING_GURU = {
    "pjok1@sekolah.com": ["1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D", "2E"],
    "pjok2@sekolah.com": ["3A", "3B", "3C", "3D", "3E", "4A", "4B", "4C", "4D", "4E", "4F"],
    "pjok3@sekolah.com": ["5A", "5B", "5C", "5D", "5E", "6A", "6B", "6C", "6D", "6E"]
};

const firebaseConfig = {
    apiKey: "AIzaSyCBag0TddnPkC8pVDxAFDWAvFpmQRED3XU",
    authDomain: "pembelajaran-digital-rendi.firebaseapp.com",
    databaseURL: "https://pembelajaran-digital-rendi-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pembelajaran-digital-rendi",
    storageBucket: "pembelajaran-digital-rendi.firebasestorage.app",
    messagingSenderId: "1075680489582",
    appId: "1:1075680489582:web:f69af224ebe08748b4b67f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let dataGlobal = {};
let kelasAktif = "";
let absenTemp = {}; 
let html5QrcodeScanner = null;

// --- CEK LOGIN ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        const userEmail = user.email.toLowerCase();
        document.getElementById('labelUser').innerText = userEmail;
        loadDataDB().then(() => cekHakAkses(userEmail));
    }
});

// --- LOGIKA HAK AKSES ---
function cekHakAkses(email) {
    const wadah = document.getElementById('wadahKelas');
    wadah.innerHTML = "";
    let hakAkses = null;

    if (MAPPING_GURU[email]) {
        hakAkses = MAPPING_GURU[email];
    } else if (email.startsWith("gurukelas")) {
        try {
            const bagianDepan = email.split('@')[0];
            const kelasTerdeteksi = bagianDepan.replace("gurukelas", "").toUpperCase();
            if (kelasTerdeteksi.length > 0) {
                hakAkses = kelasTerdeteksi;
            }
        } catch (e) { console.log("Gagal deteksi kelas otomatis"); }
    }

    if (hakAkses) {
        document.getElementById('notifAkses').style.display = 'none';
        if (Array.isArray(hakAkses)) {
            hakAkses.forEach(namaKls => buatTombolKelas(namaKls, wadah));
        } else {
            buatTombolKelas(hakAkses, wadah);
            setTimeout(() => { if(wadah.firstChild) wadah.firstChild.click(); }, 500);
        }
    } else {
        document.getElementById('notifAkses').style.display = 'block';
        document.getElementById('emailTerbaca').innerText = email;
    }
}

function buatTombolKelas(namaKls, wadah) {
    const btn = document.createElement('div');
    btn.className = 'btn-kelas';
    btn.innerText = namaKls;
    btn.onclick = () => pilihKelas("kelas_" + namaKls.toLowerCase(), namaKls, btn);
    wadah.appendChild(btn);
}

async function loadDataDB() {
    try {
        const snap = await get(ref(db, 'data_sekolah'));
        if (snap.exists()) dataGlobal = snap.val();
        else dataGlobal = {};
    } catch (e) { console.error(e); }
}

function pilihKelas(idKelas, namaTampil, el) {
    kelasAktif = idKelas;
    document.getElementById('mainContent').style.display = 'block';
    document.querySelectorAll('.btn-kelas').forEach(b => b.classList.remove('active'));
    if(el) el.classList.add('active');

    document.getElementById('judulAbsen').innerText = "Absensi " + namaTampil;
    document.getElementById('judulNilai').innerText = "Nilai " + namaTampil;
    
    if (!dataGlobal[kelasAktif]) {
        buatDataDummy(kelasAktif);
    } else {
        renderAbsensi();
        refreshTabelNilai();
    }
    if(html5QrcodeScanner) { html5QrcodeScanner.clear(); document.getElementById('qr-reader').style.display = 'none'; }
}

function buatDataDummy(idKls) {
    const dataBaru = {
        "siswa_1": { "nama": "Ahmad (Contoh)", "smt1": {}, "smt2": {} },
        "siswa_2": { "nama": "Budi (Contoh)", "smt1": {}, "smt2": {} }
    };
    set(ref(db, `data_sekolah/${idKls}`), dataBaru).then(() => {
        dataGlobal[idKls] = dataBaru;
        renderAbsensi();
        refreshTabelNilai();
    });
}

// --- FUNGSI GLOBAL (WINDOW) ---
// Kita pasang ke 'window' agar bisa dipanggil dari HTML (onclick)

window.bukaKamera = function() {
    const readerDiv = document.getElementById('qr-reader');
    if (readerDiv.style.display === 'block') {
        if(html5QrcodeScanner) html5QrcodeScanner.clear();
        readerDiv.style.display = 'none';
    } else {
        readerDiv.style.display = 'block';
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
        html5QrcodeScanner.render(onScanSuccess);
    }
}

function onScanSuccess(decodedText) {
    const idSiswa = decodedText.trim();
    const barisSiswa = document.getElementById(`row_${idSiswa}`);
    if (barisSiswa) {
        const tombolHadir = barisSiswa.querySelector('.circle-btn.h');
        if (tombolHadir) {
            tombolHadir.click();
            document.getElementById('hasilScan').innerText = `✅ Terbaca! Siswa Hadir.`;
            const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
            audio.play();
            html5QrcodeScanner.pause(true);
            setTimeout(() => { 
                html5QrcodeScanner.resume(); 
                document.getElementById('hasilScan').innerText = ""; 
            }, 2000);
        }
    } else {
        alert("QR Code tidak dikenali!");
    }
}

function renderAbsensi() {
    const list = document.getElementById('listSiswaAbsen');
    list.innerHTML = "";
    absenTemp = {};
    const dataKelas = dataGlobal[kelasAktif];
    if (!dataKelas) return;

    Object.keys(dataKelas).forEach(idSiswa => {
        const siswa = dataKelas[idSiswa];
        absenTemp[idSiswa] = 'h'; 
        const div = document.createElement('div');
        div.className = 'siswa-row';
        div.id = `row_${idSiswa}`; 
        div.innerHTML = `
            <span class="siswa-nama">${siswa.nama}</span>
            <div class="absen-group">
                <div class="circle-btn h active" onclick="klikBulat('${idSiswa}', 'h', this)">H</div>
                <div class="circle-btn s" onclick="klikBulat('${idSiswa}', 's', this)">S</div>
                <div class="circle-btn i" onclick="klikBulat('${idSiswa}', 'i', this)">I</div>
                <div class="circle-btn a" onclick="klikBulat('${idSiswa}', 'a', this)">A</div>
            </div>
        `;
        list.appendChild(div);
    });
}

window.klikBulat = function(id, st, el) {
    absenTemp[id] = st;
    el.parentElement.querySelectorAll('.circle-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

window.simpanAbsenHarian = async function() {
    if (!kelasAktif) return;
    const smt = document.getElementById('pilihSemesterAbsen').value;
    if(!confirm("Simpan Data ke Database?")) return;

    const snapshot = await get(ref(db, `data_sekolah/${kelasAktif}`));
    let dataDB = snapshot.exists() ? snapshot.val() : {};
    const updates = {};
    let adaUpdate = false;

    Object.keys(absenTemp).forEach(id => {
        const status = absenTemp[id];
        if (status !== 'h') {
            adaUpdate = true;
            const oldVal = (dataDB[id] && dataDB[id][smt] && dataDB[id][smt][status]) || 0;
            updates[`data_sekolah/${kelasAktif}/${id}/${smt}/${status}`] = oldVal + 1;
        }
    });

    if (adaUpdate) await update(ref(db), updates);
    alert("✅ Absensi Tersimpan!");
    loadDataDB().then(() => { refreshTabelNilai(); });
}

function hitungSkorAbsen(s, i, a) {
    const penaltiAlpha = a * 2; 
    const totalSI = s + i;
    let penaltiSI = 0;
    if (totalSI > 7) {
        penaltiSI = (totalSI - 7) * 2; 
    }
    let skor = 100 - penaltiAlpha - penaltiSI;
    return Math.max(0, skor); 
}

window.refreshTabelNilai = function() {
    if (!kelasAktif) return;
    const smt = document.getElementById('pilihSemesterNilai').value;
    const tbody = document.getElementById('tbodyNilai');
    tbody.innerHTML = "";
    const dataKelas = dataGlobal[kelasAktif] || {}; 

    Object.keys(dataKelas).forEach(id => {
        const d = (dataKelas[id][smt]) || {}; 
        let uh1 = d.uh1 || 0; let uh2 = d.uh2 || 0; let uh3 = d.uh3 || 0; let uh4 = d.uh4 || 0;
        let ujian = d.ujian || 0;
        let s = d.s || 0; let i = d.i || 0; let a = d.a || 0;
        
        let rataUH = (uh1 + uh2 + uh3 + uh4) / 4;
        let skorAbsen = hitungSkorAbsen(s, i, a);
        let nilaiAkhir = (rataUH * 0.65) + (ujian * 0.30) + (skorAbsen * 0.05);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:left; font-weight:500;">${dataKelas[id].nama}</td>
            <td><input type="number" class="nilai-input" id="uh1_${id}" value="${uh1}"></td>
            <td><input type="number" class="nilai-input" id="uh2_${id}" value="${uh2}"></td>
            <td><input type="number" class="nilai-input" id="uh3_${id}" value="${uh3}"></td>
            <td><input type="number" class="nilai-input" id="uh4_${id}" value="${uh4}"></td>
            <td style="background:#fffbe6"><input type="number" class="nilai-input" id="ujian_${id}" value="${ujian}"></td>
            <td style="background:#f0fff4;">${s}</td><td style="background:#f0fff4;">${i}</td><td style="background:#f0fff4;">${a}</td>
            <td style="font-weight:bold; color:#007bff; background:#e9ecef;">${nilaiAkhir.toFixed(1)}</td>
            <td><button onclick="simpanNilaiManual('${id}')" style="background:#007bff; color:white; border:none; padding:5px; border-radius:4px;"><i class="fas fa-save"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.simpanNilaiManual = function(id) {
    const smt = document.getElementById('pilihSemesterNilai').value;
    const dataUpdate = {
        uh1: parseInt(document.getElementById(`uh1_${id}`).value) || 0,
        uh2: parseInt(document.getElementById(`uh2_${id}`).value) || 0,
        uh3: parseInt(document.getElementById(`uh3_${id}`).value) || 0,
        uh4: parseInt(document.getElementById(`uh4_${id}`).value) || 0,
        ujian: parseInt(document.getElementById(`ujian_${id}`).value) || 0
    };
    update(ref(db, `data_sekolah/${kelasAktif}/${id}/${smt}`), dataUpdate)
        .then(() => { alert("Tersimpan!"); loadDataDB().then(refreshTabelNilai); });
}

window.unduhLaporan = function(tipe) {
    if (!kelasAktif || !dataGlobal[kelasAktif]) {
        alert("Tidak ada data untuk diunduh!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    const dataKelas = dataGlobal[kelasAktif];
    const smt = (tipe === 'absen') ? document.getElementById('pilihSemesterAbsen').value : document.getElementById('pilihSemesterNilai').value;
    const namaSmt = (smt === 'smt1') ? "Semester 1" : "Semester 2";

    if (tipe === 'absen') {
        csvContent += `REKAP ABSENSI KELAS ${kelasAktif.replace('kelas_','').toUpperCase()} - ${namaSmt}\n`;
        csvContent += "NAMA SISWA,SAKIT,IZIN,ALPHA,POIN ABSEN (100-Penalti)\n";
        Object.keys(dataKelas).forEach(id => {
            const d = (dataKelas[id][smt]) || {};
            let s = d.s || 0; let i = d.i || 0; let a = d.a || 0;
            let poin = hitungSkorAbsen(s, i, a);
            csvContent += `${dataKelas[id].nama},${s},${i},${a},${poin}\n`;
        });
    } else if (tipe === 'nilai') {
        csvContent += `REKAP NILAI KELAS ${kelasAktif.replace('kelas_','').toUpperCase()} - ${namaSmt}\n`;
        csvContent += "NAMA SISWA,UH1,UH2,UH3,UH4,RATA UH,UJIAN(STS/SAS),NILAI AKHIR\n";
        Object.keys(dataKelas).forEach(id => {
            const d = (dataKelas[id][smt]) || {};
            let uh1 = d.uh1 || 0; let uh2 = d.uh2 || 0; let uh3 = d.uh3 || 0; let uh4 = d.uh4 || 0;
            let ujian = d.ujian || 0;
            let s = d.s || 0; let i = d.i || 0; let a = d.a || 0;
            let rataUH = (uh1 + uh2 + uh3 + uh4) / 4;
            let skorAbsen = hitungSkorAbsen(s, i, a);
            let nilaiAkhir = (rataUH * 0.65) + (ujian * 0.30) + (skorAbsen * 0.05);
            csvContent += `${dataKelas[id].nama},${uh1},${uh2},${uh3},${uh4},${rataUH.toFixed(1)},${ujian},${nilaiAkhir.toFixed(1)}\n`;
        });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_${tipe}_${kelasAktif}_${smt}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.resetDataSemester = async function() {
    if (!kelasAktif || !dataGlobal[kelasAktif]) return;
    const smt = document.getElementById('pilihSemesterNilai').value;
    const namaSmt = (smt === 'smt1') ? "Semester 1" : "Semester 2";

    if (!confirm(`PERINGATAN BAHAYA!\n\nAnda akan MENGHAPUS SEMUA NILAI & ABSENSI pada ${namaSmt} di kelas ini.\nNama siswa TIDAK akan terhapus.\n\nLanjutkan?`)) return;

    const passwordInput = prompt("Masukkan KATA SANDI untuk konfirmasi penghapusan:");
    if (passwordInput !== PASSWORD_RESET) {
        alert("Kata Sandi SALAH! Penghapusan dibatalkan.");
        return;
    }

    const updates = {};
    const dataKelas = dataGlobal[kelasAktif];
    
    Object.keys(dataKelas).forEach(idSiswa => {
        updates[`data_sekolah/${kelasAktif}/${idSiswa}/${smt}`] = null;
        if (dataGlobal[kelasAktif][idSiswa][smt]) {
            dataGlobal[kelasAktif][idSiswa][smt] = {}; 
        }
    });

    await update(ref(db), updates);
    alert(`Berhasil! Data ${namaSmt} telah dikosongkan.`);
    
    refreshTabelNilai();
    renderAbsensi(); 
    loadDataDB();
}

window.gantiTab = function(tab, el) {
    document.getElementById('view-absen').style.display = (tab === 'absen') ? 'block' : 'none';
    document.getElementById('view-nilai').style.display = (tab === 'nilai') ? 'block' : 'none';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    if(tab === 'nilai') loadDataDB().then(refreshTabelNilai);
}

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");


