
// --- LOGIKA UNTUK PERPINDAHAN TAMPILAN ---
const landingPage = document.getElementById('landing-page');
const appWizard = document.getElementById('app-wizard');
const ctaButtons = [document.getElementById('cta-hero'), document.getElementById('cta-final')];
const backButton = document.getElementById('back-to-landing');

function showWizard() {
    landingPage.classList.add('hidden');
    appWizard.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function showLandingPage() {
    appWizard.classList.add('hidden');
    landingPage.classList.remove('hidden');
}

ctaButtons.forEach(button => button.addEventListener('click', showWizard));
backButton.addEventListener('click', showLandingPage);

// --- LOGIKA APLIKASI INTI & INTEGRASI GEMINI API ---

// Variabel untuk menyimpan state aplikasi
const appState = {
    selectedTitle: null,
    generatedRumusan: null,
    isGenerating: false,
};

// Kunci API (dibiarkan kosong, akan diisi oleh environment)
const apiKey = ""; 

// Elemen DOM untuk Wizard
const jurusanInput = document.getElementById('jurusan-input');
const minatInput = document.getElementById('minat-input');
const generateJudulBtn = document.getElementById('generate-judul-btn');
const judulOutputContainer = document.getElementById('judul-output-container');

const step2Section = document.getElementById('step-2');
const step2Indicator = document.getElementById('step-2-indicator');
const judulPilihanDisplay = document.getElementById('judul-pilihan-display');
const generateRumusanBtn = document.getElementById('generate-rumusan-btn');
const rumusanOutputContainer = document.getElementById('rumusan-output-container');

const step3Section = document.getElementById('step-3');
const step3Indicator = document.getElementById('step-3-indicator');
const generateKerangkaBtn = document.getElementById('generate-kerangka-btn');
const kerangkaOutputContainer = document.getElementById('kerangka-output-container');

// --- Fungsi Helper ---

// Menampilkan indikator loading
function showLoading(container, message) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
            <div class="spinner"></div>
            <p class="mt-4 text-gray-600 animate-pulse">${message}</p>
        </div>`;
}

// Menampilkan pesan error
function renderError(container, message) {
    container.innerHTML = `
        <div class="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
            <h3 class="font-bold">Oops! Terjadi Kesalahan</h3>
            <p>${message}</p>
        </div>`;
}

// Mengaktifkan langkah wizard berikutnya
function activateStep(stepElement, indicatorElement) {
        stepElement.classList.remove('step-disabled');
        indicatorElement.classList.remove('bg-gray-400');
        indicatorElement.classList.add('bg-[#673AB7]');
}

// Menangani status tombol saat proses generating
function setGenerating(status) {
    appState.isGenerating = status;
    generateJudulBtn.disabled = status;
    generateRumusanBtn.disabled = status || !appState.selectedTitle;
    generateKerangkaBtn.disabled = status || !appState.generatedRumusan;
}

// Membentuk fallback ordered list jika AI tidak mengembalikan Markdown bernomor
function renderRumusanAsOrderedList(raw) {
    // Jika sudah berupa daftar bernomor Markdown atau HTML <ol>, gunakan apa adanya,
    // tetapi tambahkan spacing antar item untuk keterbacaan.
    if (/^\s*\d+[.)]\s/m.test(raw) || /<ol[\s>]/i.test(raw)) {
        const html = marked.parse(raw);
        return html.replace(
            /<ol(.*?)>/i,
            '<ol$1 class="list-decimal pl-6" style="list-style: decimal; padding-left: 1.5rem; display:flex; flex-direction:column; gap:0.75rem;">'
        );
    }

    // Fallback: pecah berdasarkan tanda tanya untuk mengidentifikasi pertanyaan utama
    const lines = raw.split(/\r?\n/);
    const items = [];
    const introParas = [];
    let buffer = '';

    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;

        // Tangkap kalimat pengantar di awal (tanpa tanda tanya di akhir)
        if (!items.length && !buffer && /^(Berdasarkan|Berikut)/i.test(t) && !/\?\s*$/.test(t)) {
            introParas.push(t);
            continue;
        }

        buffer += (buffer ? ' ' : '') + t;
        if (/\?\s*$/.test(t)) {
            items.push(buffer);
            buffer = '';
        }
    }

    // Bangun HTML ordered list dengan spacing rapi
    let html = '';
    if (introParas.length) {
        introParas.forEach(p => { html += marked.parse(p); });
    }

    if (items.length) {
        html += '<ol class="list-decimal pl-6" style="list-style: decimal; padding-left: 1.5rem; display:flex; flex-direction:column; gap:0.75rem;">';
        items.forEach(it => { html += `<li>${marked.parse(it)}</li>`; });
        html += '</ol>';
        return html;
    }

    // Jika tidak bisa diproses, render biasa.
    return marked.parse(raw);
}

// --- Fungsi Inti Pemanggilan Gemini API (via server proxy) ---
async function panggilGemini(promptText, maxRetries = 3) {
    setGenerating(true);
    const apiUrl = '/api/generate';
    const payload = { prompt: promptText };

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            const text = result.text;
            if (!text) {
                throw new Error("Respons dari AI tidak valid atau kosong.");
            }

            setGenerating(false);
            return text;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) {
                setGenerating(false);
                throw error; // Lempar error setelah percobaan terakhir
            }
            // Implementasi exponential backoff
            await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
        }
    }
}


// --- Logika untuk Langkah 1: Generate Judul ---
generateJudulBtn.addEventListener('click', async () => {
    const jurusan = jurusanInput.value.trim();
    const minat = minatInput.value.trim();

    if (!jurusan || !minat) {
        renderError(judulOutputContainer, "Harap isi Program Studi dan Topik Minat terlebih dahulu.");
        return;
    }
    
    showLoading(judulOutputContainer, "AI sedang meracik ide judul untuk Anda...");

        const prompt = `Sebagai seorang ahli akademis dan prompt engineer, rancang 5-7 ide judul skripsi yang inovatif dan berbobot untuk mahasiswa dari program studi **${jurusan}** yang memiliki minat pada topik **${minat}**. Pastikan setiap judul memenuhi kriteria berikut:

            1.  **Spesifik dan Terukur:** Judul harus jelas dalam lingkup dan metodologinya.
            2.  **Relevansi Akademik:** Judul harus menunjukkan kontribusi pada bidang ilmunya.
            3.  **Potensi Riset:** Judul harus menyiratkan adanya masalah yang dapat diteliti dan dianalisis secara mendalam.
            4.  **Kejelasan:** Hindari jargon yang tidak perlu dan sampaikan ide utama dengan lugas.

        Sajikan hasilnya dalam format daftar bernomor. Gunakan format Markdown untuk penekanan pada kata kunci penting (contoh: *Transfer Learning* atau **Analisis Sentimen**). Judul maksimal hanya 12 Kata saja. Tidak usah tampilkan berapa kata judulnya.`;

    try {
        const hasil = await panggilGemini(prompt);
        const judulArray = hasil.split('\n').filter(line => line.match(/^\d+\.\s/)).map(line => line.replace(/^\d+\.\s/, '').trim());

        if (judulArray.length === 0) {
                renderError(judulOutputContainer, "AI tidak dapat menghasilkan judul dari input yang diberikan. Coba gunakan topik yang lebih spesifik.");
                return;
        }

        judulOutputContainer.innerHTML = `
            <h3 class="font-bold text-gray-800 mb-2">Pilih Salah Satu Ide Judul:</h3>
            <div class="space-y-2" id="title-options">
                ${judulArray.map((judul, index) => `
                    <label for="judul-${index}" class="block p-4 border rounded-lg hover:bg-purple-50 cursor-pointer transition-colors has-[:checked]:bg-purple-100 has-[:checked]:border-purple-400">
                        <input type="radio" name="selected-title" id="judul-${index}" value="${judul}" class="hidden">
                        <span class="text-gray-700">${marked.parse(judul)}</span>
                    </label>
                `).join('')}
            </div>`;

        // Tambahkan event listener untuk pilihan judul
        document.getElementById('title-options').addEventListener('change', (e) => {
            if (e.target.name === 'selected-title') {
                appState.selectedTitle = e.target.value;
                judulPilihanDisplay.innerHTML = marked.parse(appState.selectedTitle);
                judulPilihanDisplay.classList.remove('text-gray-500');
                activateStep(step2Section, step2Indicator);
                generateRumusanBtn.disabled = appState.isGenerating;
            }
        });

    } catch (error) {
        renderError(judulOutputContainer, `Gagal menghubungi AI: ${error.message}. Silakan coba lagi nanti.`);
    }
});

// --- Logika untuk Langkah 2: Generate Rumusan Masalah ---
generateRumusanBtn.addEventListener('click', async () => {
    if (!appState.selectedTitle) return;

    showLoading(rumusanOutputContainer, "AI sedang merumuskan masalah dari judul pilihan Anda...");

    const prompt = `Anda adalah seorang metodolog penelitian yang ahli. Berdasarkan judul skripsi berikut:
        **"${appState.selectedTitle}"**

        Buatkan 3-5 poin rumusan masalah yang memenuhi kriteria SMART (Specific, Measurable, Achievable, Relevant, Time-bound) dalam konteks penelitian.

        Setiap rumusan masalah harus:
        - Berbentuk pertanyaan yang jelas.
        - Fokus pada variabel atau konsep kunci dalam judul.
        - Membuka ruang untuk analisis dan bukan sekadar jawaban "ya/tidak".

        **PENTING:** Sajikan hasilnya dalam format daftar bernomor (numbered list). **Jangan gunakan simbol atau format LaTeX** (misalnya, hindari "$\gamma$"). Tuliskan semua simbol secara eksplisit (contoh: "gamma", "alpha"). Gunakan Markdown untuk penekanan jika perlu. pastikan dalam tiap item ada spacing.`;


    try {
        const hasil = await panggilGemini(prompt);
        appState.generatedRumusan = hasil;
        rumusanOutputContainer.innerHTML = `
            <div class="p-4 bg-gray-50 rounded-lg border">
                <h4 class="font-bold mb-2">Hasil Rumusan Masalah:</h4>
                <div class="prose prose-sm max-w-none text-gray-800">${renderRumusanAsOrderedList(hasil)}</div>
            </div>`;
        
        activateStep(step3Section, step3Indicator);
        generateKerangkaBtn.disabled = appState.isGenerating;

    } catch(error) {
        renderError(rumusanOutputContainer, `Gagal menghubungi AI: ${error.message}.`);
    }
});

// --- Logika untuk Langkah 3: Generate Kerangka Bab 1 ---
generateKerangkaBtn.addEventListener('click', async () => {
        if (!appState.selectedTitle || !appState.generatedRumusan) return;

        showLoading(kerangkaOutputContainer, "Finalisasi! AI sedang menyusun draf kerangka Bab 1...");
        
        const prompt = `Sebagai seorang konsultan skripsi ahli, buatkan draf kerangka Bab 1 yang sistematis dan mendalam berdasarkan informasi berikut:

        **Judul Skripsi:**
        *"${appState.selectedTitle}"*

        **Rumusan Masalah Utama:**
        ${appState.generatedRumusan}

        ---

        **Instruksi Output:**
        Jangan pernah konfirmasi apapun seperti misalnya "Tentu, sebagai konsultan skripsi ahli, saya akan menyusun draf kerangka Bab 1 yang sistematis, mendalam, dan relevan dengan topik penelitian Anda.".
        Anda harus menghasilkan kerangka yang terstruktur dengan format Markdown. Ikuti struktur berikut dengan saksama, berikan penjelasan yang kaya dan relevan di setiap sub-bagian:

        ### **BAB 1: PENDAHULUAN**

        **1.1. Latar Belakang Masalah**
        *   **Konteks Umum:** Mulai dengan pengenalan luas tentang domain penelitian (misalnya, pentingnya e-commerce, peran sentimen analisis, dll.).
        *   **Konteks Spesifik:** Kerucutkan ke masalah spesifik yang diangkat dalam judul. Jelaskan mengapa masalah ini penting untuk dipecahkan.
        *   **Fenomena/Gap Penelitian:** Tunjukkan adanya kesenjangan (gap) dalam penelitian sebelumnya atau adanya fenomena baru yang menarik untuk diteliti. Jika memungkinkan, sebutkan contoh data atau statistik awal yang relevan.
        *   **Urgensi Penelitian:** Simpulkan dengan argumen kuat mengapa penelitian ini mendesak dan perlu dilakukan sekarang.

        **1.2. Rumusan Masalah**
        *   Sajikan kembali **secara verbatim** poin-poin rumusan masalah yang telah diberikan di atas dalam format daftar bernomor.

        **1.3. Tujuan Penelitian**
        *   Berdasarkan setiap poin rumusan masalah, jabarkan tujuan penelitian yang spesifik. (Contoh: "1. Untuk menganalisis kinerja...", "2. Untuk mengukur efektivitas...").

        **1.4. Manfaat Penelitian**
        *   **Manfaat Teoritis:** Jelaskan bagaimana penelitian ini dapat memberikan kontribusi pada pengembangan ilmu pengetahuan atau teori yang ada di bidang terkait.
        *   **Manfaat Praktis:** Jelaskan bagaimana hasil penelitian ini dapat memberikan dampak nyata atau solusi bagi praktisi, industri, atau masyarakat.

        **1.5. Batasan Masalah**
        *   Tentukan batasan atau ruang lingkup penelitian secara jelas (misalnya, dataset yang digunakan, platform e-commerce yang dianalisis, algoritma yang dibandingkan) untuk menjaga agar penelitian tetap fokus.`;

    try {
        const hasil = await panggilGemini(prompt);
        kerangkaOutputContainer.innerHTML = `
            <div class="relative">
                    <h4 class="font-bold mb-2">Draf Kerangka Proposal (Bab 1):</h4>
                    <button id="copy-btn" class="absolute top-0 right-0 bg-gray-200 text-gray-700 text-xs font-bold py-1 px-2 rounded hover:bg-gray-300">Salin Teks</button>
                    <div id="kerangka-content" class="w-full h-96 p-4 bg-gray-50 border rounded-lg mt-2 overflow-auto prose prose-sm max-w-none">${marked.parse(hasil)}</div>
            </div>`;

        // Tambahkan event listener untuk tombol salin
        document.getElementById('copy-btn').addEventListener('click', () => {
            const textArea = document.getElementById('kerangka-content');
            // Untuk menyalin teks dari div, kita perlu membuat textarea sementara
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = hasil; // Salin teks asli, bukan HTML yang di-render
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            document.execCommand('copy');
            document.body.removeChild(tempTextArea);

            const copyBtn = document.getElementById('copy-btn');
            copyBtn.textContent = 'Tersalin!';
            setTimeout(() => { copyBtn.textContent = 'Salin Teks'; }, 2000);
        });

    } catch(error) {
            renderError(kerangkaOutputContainer, `Gagal menghubungi AI: ${error.message}.`);
    }
});
