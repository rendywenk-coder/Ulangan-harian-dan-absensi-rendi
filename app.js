import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./config/firebase.js";

// Import Modul
import { setupLoginListener } from "./auth/login.js";
import { getSiswaByKelas, cariUserGuru } from "./services/siswa-service.js";
import { getNilaiByKelas, simpanNilaiSiswa, resetDataKelasTotal } from "./services/nilai-service.js";
import { simpanAbsensiBatch } from "./services/absensi-service.js";
import { renderAbsensi, renderTabelNilai } from "./ui/render-table.js";
import { renderKelasDropdown } from "./ui/render-form.js";
import { showSuccess, showError, askConfirm } from "./ui/notifications.js";

// --- VARIABEL ---
let currentDataSiswa = {};
let currentKelas = "";
let currentSemester = "smt1";

// --- DETEKSI POSISI HALAMAN ---
const isHalamanLogin = document.getElementById('loginForm');
const isHalamanDashboard = document.getElementById('kelasSelect');

// --- PENGENDALI UTAMA (AUTH STATE) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // === POSISI: SUDAH LOGIN ===
        if (isHalamanLogin) {
            // Jika masih di halaman Login, LEMPAR ke Dashboard
            window.location.replace("dashboard.html");
        } 
        else if (isHalamanDashboard) {
            // Jika sudah di Dashboard, Muat Data
            let savedData = localStorage.getItem('user_details');
            if (!savedData) {
                const data = await cariUserGuru(user.email);
                if(data) {
                    localStorage.setItem('user_details', JSON.stringify(data));
                    setupDashboard(data);
                }
            } else {
                setupDashboard(JSON.parse(savedData));
            }
        }
    } else {
        // === POSISI: BELUM LOGIN ===
        if (isHalamanDashboard) {
            // Jika maksa masuk Dashboard tanpa login, LEMPAR ke Login
            window.location.replace("index.html");
        }
    }
});

// --- INISIALISASI HALAMAN LOGIN ---
if (isHalamanLogin) {
    setupLoginListener('btnLogin', 'email', 'password', 'errorMsg');
}

// --- INISIALISASI HALAMAN DASHBOARD ---
function setupDashboard(user) {
    const welcome = document.getElementById('welcomeMsg');
    if(welcome) welcome.innerText = `Halo, ${user.nama || 'Guru'}`;

    renderKelasDropdown('kelasSelect', user, async (e) => {
        currentKelas = e.target.value;
        if (currentKelas) {
            document.getElementById('mainContent').style.display = 'block';
            await loadDataKelas(currentKelas);
        } else {
            document.getElementById('mainContent').style.display = 'none';
        }
    });

    const btnOut = document.getElementById('btnLogout');
    if(btnOut) {
        btnOut.addEventListener('click', async () => {
            if(askConfirm("Keluar aplikasi?")) { 
                await signOut(auth); 
                localStorage.clear(); 
                window.location.replace("index.html"); 
            }
        });
    }

    if(document.getElementById('btnResetData')) document.getElementById('btnResetData').addEventListener('click', hapusDataKelas);
    if(document.getElementById('btnSimpanAbsen')) document.getElementById('btnSimpanAbsen').addEventListener('click', aksiSimpanAbsen);
}

// --- FUNGSI LOAD DATA (PONDASI) ---
async function loadDataKelas(kelasId) {
    try {
        const rawSiswa = await getSiswaByKelas(kelasId);
        const rawNilai = await getNilaiByKelas(kelasId);
        
        if (rawSiswa) {
            currentDataSiswa = rawSiswa;
            Object.keys(currentDataSiswa).forEach(id => {
                currentDataSiswa[id].nilai = rawNilai[id] || {};
                currentDataSiswa[id].statusAbsen = 'H';
            });
            refreshTampilan();
        }
    } catch(e) { showError("Error load: " + e.message); }
}

function refreshTampilan() {
    const containerAbsen = document.getElementById('listAbsensiContainer');
    if(containerAbsen) {
        renderAbsensi(containerAbsen, currentDataSiswa, (el, id, stat) => {
            el.parentNode.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active-h','active-s','active-i','active-a'));
            el.classList.add(stat === 'H' ? 'active-h' : (stat === 'S' ? 'active-s' : (stat === 'I' ? 'active-i' : 'active-a')));
            currentDataSiswa[id].statusAbsen = stat;
            updateRekapBox();
        });
    }

    const tbody = document.getElementById('tbodyNilai');
    if(tbody) renderTabelNilai(tbody, currentDataSiswa, currentSemester, hitungRumus, aksiSimpanNilai);
    
    updateRekapBox();
}

function updateRekapBox() {
    let h=0, s=0, i=0, a=0;
    Object.values(currentDataSiswa).forEach(v => {
        const stat = v.statusAbsen || 'H';
        if(stat==='H') h++; else if(stat==='S') s++; else if(stat==='I') i++; else if(stat==='A') a++;
    });
    if(document.getElementById('countH')) document.getElementById('countH').innerText = h;
    if(document.getElementById('countS')) document.getElementById('countS').innerText = s;
    if(document.getElementById('countI')) document.getElementById('countI').innerText = i;
    if(document.getElementById('countA')) document.getElementById('countA').innerText = a;
}

// --- RUMUS PONDASI ---
function hitungRumus(nilaiObj, s, i, a) {
    const u1 = parseFloat(nilaiObj.uh1)||0, u2 = parseFloat(nilaiObj.uh2)||0;
    const u3 = parseFloat(nilaiObj.uh3)||0, u4 = parseFloat(nilaiObj.uh4)||0;
    const uj = parseFloat(nilaiObj.ujian)||0;
    const arr = [u1,u2,u3,u4].filter(n => n>0);
    const rataUH = arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
    let skorAbsen = 100 - (a*5) - (i*2) - (s*1);
    if(skorAbsen<0) skorAbsen=0;
    const final = (rataUH*0.65) + (uj*0.30) + (skorAbsen*0.05);
    return final > 0 ? final.toFixed(1) : "-";
}

// --- AKSI ---
async function aksiSimpanAbsen() {
    if(!askConfirm("Simpan Absensi?")) return;
    try {
        await simpanAbsensiBatch(currentKelas, currentDataSiswa);
        showSuccess("Tersimpan!");
        refreshTampilan();
    } catch(e) { showError(e.message); }
}

async function aksiSimpanNilai(id) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    const inputs = tr.querySelectorAll('input');
    const data = {};
    inputs.forEach(i => data[i.dataset.field] = i.value);
    try { await simpanNilaiSiswa(currentKelas, id, currentSemester, data); showSuccess("Nilai disimpan."); } 
    catch(e) { showError(e.message); }
}

async function hapusDataKelas() {
    if(!askConfirm(`⚠️ Yakin hapus TOTAL data kelas ${currentKelas}?`)) return;
    const pass = prompt("Password: 123456");
    if(pass !== "123456") return showError("Password Salah");

    Object.keys(currentDataSiswa).forEach(id => {
        currentDataSiswa[id].total_sakit = 0;
        currentDataSiswa[id].total_izin = 0;
        currentDataSiswa[id].total_alpha = 0;
        currentDataSiswa[id].statusAbsen = 'H';
        currentDataSiswa[id].nilai = {};
    });
    refreshTampilan();

    try { await resetDataKelasTotal(currentKelas, Object.keys(currentDataSiswa)); showSuccess("Reset Berhasil!"); }
    catch(e) { showError(e.message); }
}
