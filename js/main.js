// ---- Bloque principal 1 ----
        // PrintStudio Pro 2.1 · Corrección de ajuste de imágenes al exportar PDF.
        (function() {
            const PAPERS = {
                carta: { w: 21.59, h: 27.94, cssW: '21.59cm', cssH: '27.94cm' },
                oficio: { w: 21.59, h: 35.56, cssW: '21.59cm', cssH: '35.56cm' },
                doble: { w: 27.94, h: 43.18, cssW: '27.94cm', cssH: '43.18cm' },
                a4: { w: 21.0, h: 29.7, cssW: '21cm', cssH: '29.7cm' }
            };
            const MIME_MAP = {
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                png: 'image/png',
                webp: 'image/webp',
                gif: 'image/gif',
                ico: 'image/x-icon',
                bmp: 'image/bmp',
                svg: 'image/svg+xml',
                avif: 'image/avif'
            };

            let images = [];
            let orientation = 'portrait';
            let busy = false;
            let currentPreset = null;
            let credDisposition = 'h-side';
            let credScale = 1;
            let dragSrcIndex = -1;
            let lbImageObj = null;
            let lbRotation = 0;
            let lbFlipH = false;
            let lbFlipV = false;
            let cropMode = false;
            let cropPointer = null;
            let cropAction = null;
            let cropHandle = null;
            let cropAspect = null;
            let cropRect = { x: 0, y: 0, w: 0, h: 0 };
            let layoutMode = 'cell';

            const getGapCM = () => {
                const raw = parseFloat(document.getElementById('gapMM').value);
                const mm = Number.isFinite(raw) ? raw : 2;
                return Math.max(0, mm) / 10;
            };

            function loadAllConfig() {
                try {
                    const cfg = JSON.parse(localStorage.getItem('printstudio_config'));
                    if (cfg) {
                        if (cfg.paperSize) document.getElementById('paperSize').value = cfg.paperSize;
                        if (cfg.orientation) setOrientation(cfg.orientation, false);
                        if (cfg.imgWidth) document.getElementById('imgWidth').value = cfg.imgWidth;
                        if (cfg.imgHeight) document.getElementById('imgHeight').value = cfg.imgHeight;
                        if (cfg.marginMM !== undefined) document.getElementById('marginMM').value = cfg.marginMM;
                        if (cfg.gapMM !== undefined) document.getElementById('gapMM').value = cfg.gapMM;
                        if (cfg.guideColor) document.getElementById('guideColor').value = cfg.guideColor;
                        if (cfg.copyCount) document.getElementById('copyCount').value = cfg.copyCount;
                        if (cfg.layoutMode) layoutMode = cfg.layoutMode;
                        if (cfg.mosaicRows) document.getElementById('mosaicRows').value = cfg.mosaicRows;
                        if (cfg.mosaicCols) document.getElementById('mosaicCols').value = cfg.mosaicCols;
                        if (cfg.fitMode) {
                            const fitRadio = document.querySelector(`input[name="fitMode"][value="${cfg.fitMode}"]`);
                            if (fitRadio) fitRadio.checked = true;
                        }
                        if (cfg.chkAutoRotate !== undefined) document.getElementById('chkAutoRotate').checked = cfg.chkAutoRotate;
                        if (cfg.chkCellBorder !== undefined) document.getElementById('chkCellBorder').checked = cfg.chkCellBorder;
                        if (cfg.chkFilename !== undefined) document.getElementById('chkFilename').checked = cfg.chkFilename;
                        if (cfg.chkUseMargins !== undefined) document.getElementById('chkUseMargins').checked = cfg.chkUseMargins;
                        if (cfg.exportDPI) document.getElementById('exportDPI').value = cfg.exportDPI;
                        if (cfg.filenamePt) document.getElementById('filenamePt').value = cfg.filenamePt;
                        if (cfg.chkNumbering !== undefined) document.getElementById('chkNumbering').checked = cfg
                            .chkNumbering;
                        if (cfg.zoom) {
                            document.getElementById('zoomSlider').value = cfg.zoom;
                            updateZoomFromSlider();
                        }
                        if (cfg.credDisposition) credDisposition = cfg.credDisposition;
                        if (cfg.credScale) credScale = cfg.credScale;
                    }
                    updateCredDispUI();
                    updateCredScaleUI();
                    updateLayoutModeUI();
                    updateAdvancedUI();
                    updateMosaicCellSize();
                    updateTotalPrints();
                } catch (e) { console.warn('No se pudo cargar la configuración:', e); }
            }

            function saveAllConfig() {
                try {
                    const cfg = {
                        paperSize: document.getElementById('paperSize').value,
                        orientation: orientation,
                        imgWidth: document.getElementById('imgWidth').value,
                        imgHeight: document.getElementById('imgHeight').value,
                        marginMM: document.getElementById('marginMM').value,
                        gapMM: document.getElementById('gapMM').value,
                        guideColor: document.getElementById('guideColor').value,
                        copyCount: document.getElementById('copyCount').value,
                        layoutMode: layoutMode,
                        mosaicRows: document.getElementById('mosaicRows').value,
                        mosaicCols: document.getElementById('mosaicCols').value,
                        fitMode: getFitMode(),
                        chkAutoRotate: document.getElementById('chkAutoRotate').checked,
                        chkCellBorder: document.getElementById('chkCellBorder').checked,
                        chkFilename: document.getElementById('chkFilename').checked,
                        chkUseMargins: document.getElementById('chkUseMargins').checked,
                        exportDPI: document.getElementById('exportDPI').value,
                        filenamePt: document.getElementById('filenamePt').value,
                        chkNumbering: document.getElementById('chkNumbering').checked,
                        zoom: document.getElementById('zoomSlider').value,
                        credDisposition: credDisposition,
                        credScale: credScale
                    };
                    localStorage.setItem('printstudio_config', JSON.stringify(cfg));
                } catch (e) {}
            }

            const dropzone = document.getElementById('dropzone');
            const fileInput = document.getElementById('fileInput');
            const btnGenerate = document.getElementById('btnGenerate');
            const btnPrint = document.getElementById('btnPrint');
            const btnExportPDF = document.getElementById('btnExportPDF');
            const btnClear = document.getElementById('btnClear');
            const btnPortrait = document.getElementById('btnPortrait');
            const btnLandscape = document.getElementById('btnLandscape');
            const previewInner = document.getElementById('previewInner');
            const emptyState = document.getElementById('emptyState');
            const printWatermark = document.getElementById('printWatermark');
            const thumbsSection = document.getElementById('thumbsSection');
            const thumbsStrip = document.getElementById('thumbsStrip');
            const imgBadge = document.getElementById('imgBadge');
            const viabilityEl = document.getElementById('viability');
            const statsSection = document.getElementById('statsSection');
            const loader = document.getElementById('loader');
            const loaderMsg = document.getElementById('loaderMsg');
            const zoomBar = document.getElementById('zoomBar');
            const zoomSlider = document.getElementById('zoomSlider');
            const zoomVal = document.getElementById('zoomVal');
            const rootStyle = document.documentElement.style;
            const themeToggle = document.getElementById('themeToggle');
            const lightbox = document.getElementById('lightbox');
            const lbCanvas = document.getElementById('lightboxCanvas');
            const cropRectEl = document.getElementById('cropRect');
            const cropToolbar = document.getElementById('cropToolbar');
            const cropRatioSelect = document.getElementById('cropRatio');
            const lbTitle = document.getElementById('lbTitle');
            const lbRotateCW = document.getElementById('lbRotateCW');
            const lbFlipHBtn = document.getElementById('lbFlipH');
            const lbFlipVBtn = document.getElementById('lbFlipV');
            const lbCropMode = document.getElementById('lbCropMode');
            const lbApplyCrop = document.getElementById('lbApplyCrop');
            const lbDelete = document.getElementById('lbDelete');
            const lbCancel = document.getElementById('lbCancel');
            const totalPrintsEl = document.getElementById('totalPrints');

            themeToggle.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                const next = current === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', next);
                try { localStorage.setItem('printstudio_theme', next); } catch (e) {}
            });

            function updateZoomFromSlider() {
                const v = parseInt(zoomSlider.value);
                zoomVal.textContent = v + '%';
                rootStyle.setProperty('--preview-zoom', v / 100);
            }
            zoomSlider.addEventListener('input', updateZoomFromSlider);
            document.getElementById('zoomOut').addEventListener('click', () => {
                zoomSlider.value = Math.max(30, parseInt(zoomSlider.value) - 10);
                updateZoomFromSlider();
            });
            document.getElementById('zoomIn').addEventListener('click', () => {
                zoomSlider.value = Math.min(220, parseInt(zoomSlider.value) + 10);
                updateZoomFromSlider();
            });
            document.getElementById('zoomReset').addEventListener('click', () => {
                zoomSlider.value = 78;
                updateZoomFromSlider();
            });

            dropzone.addEventListener('click', () => fileInput.click());
            ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault();
                    dropzone.classList.add('dragover'); }));
            ['dragleave', 'dragend'].forEach(ev => dropzone.addEventListener(ev, () => dropzone.classList.remove(
                'dragover')));
            dropzone.addEventListener('drop', e => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                processFiles(e.dataTransfer.files);
            });
            fileInput.addEventListener('change', e => {
                processFiles(e.target.files);
                fileInput.value = '';
            });

            // Pegar imágenes copiadas desde Google, otras páginas o el portapapeles.
            document.addEventListener('paste', async e => {
                const handled = await handleClipboardData(e.clipboardData);
                if (handled) e.preventDefault();
            });

            document.getElementById('btnPasteImage').addEventListener('click', async () => {
                try {
                    if (!navigator.clipboard?.read) throw new Error('clipboard-read-no-disponible');
                    const clipboardItems = await navigator.clipboard.read();
                    for (const item of clipboardItems) {
                        const imageType = item.types.find(type => type.startsWith('image/'));
                        if (imageType) {
                            const blob = await item.getType(imageType);
                            const file = new File([blob], `imagen_pegada_${Date.now()}.${mimeExtension(imageType)}`, { type: imageType });
                            await processFiles([file]);
                            return;
                        }
                    }
                    const txt = await navigator.clipboard.readText();
                    if (isImageLikeURL(txt)) {
                        await importImageFromURL(txt.trim());
                        return;
                    }
                    toast('error', 'El portapapeles no contiene una imagen ni un enlace válido.');
                } catch (err) {
                    toast('info', 'Presiona Ctrl + V sobre la página. También puedes usar “Desde URL”.');
                }
            });

            document.getElementById('btnImageURL').addEventListener('click', async () => {
                const url = prompt('Pega el enlace directo de la imagen:');
                if (url) await importImageFromURL(url.trim());
            });

            async function handleClipboardData(clipboardData) {
                if (!clipboardData) return false;
                const files = [];
                for (const item of Array.from(clipboardData.items || [])) {
                    if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) files.push(file);
                    }
                }
                if (files.length) {
                    await processFiles(files);
                    return true;
                }

                const html = clipboardData.getData('text/html');
                if (html) {
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const src = doc.querySelector('img')?.src;
                    if (src && isImageLikeURL(src)) {
                        await importImageFromURL(src);
                        return true;
                    }
                }

                const plain = clipboardData.getData('text/plain')?.trim();
                if (plain && isImageLikeURL(plain)) {
                    await importImageFromURL(plain);
                    return true;
                }
                return false;
            }

            function mimeExtension(mime) {
                return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp' })[mime] || 'png';
            }

            function isImageLikeURL(value) {
                if (!value) return false;
                return /^(data:image\/|blob:|https?:\/\/)/i.test(value.trim());
            }

            async function importImageFromURL(url) {
                if (!isImageLikeURL(url)) {
                    toast('error', 'El enlace no es válido.');
                    return;
                }
                showLoader('Importando imagen desde el enlace…');
                try {
                    if (url.startsWith('data:image/')) {
                        const record = await makeImageRecord(url, `imagen_pegada_${Date.now()}.png`);
                        images.push(record);
                    } else {
                        try {
                            const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
                            if (!response.ok) throw new Error(`HTTP ${response.status}`);
                            const blob = await response.blob();
                            if (!blob.type.startsWith('image/')) throw new Error('El enlace no devolvió una imagen');
                            const dataUrl = await readDataURL(blob);
                            images.push(await makeImageRecord(dataUrl, fileNameFromURL(url, blob.type)));
                        } catch (corsError) {
                            // Algunas páginas bloquean CORS. Se permite mostrar la URL remota, pero se avisa sobre PDF.
                            images.push(await makeImageRecord(url, fileNameFromURL(url, 'image/jpeg'), true));
                            toast('info', 'Imagen añadida como enlace remoto. Si el PDF no la incluye, descárgala y arrástrala al panel.');
                        }
                    }
                    refreshThumbs();
                    updateBadge();
                    updateViability();
                    updateTotalPrints();
                    generateLayout();
                    toast('success', '✓ Imagen pegada en el panel.');
                } catch (err) {
                    console.error('Error importando URL:', err);
                    toast('error', 'No se pudo importar esa imagen. Prueba copiar la imagen, no solo el enlace.');
                } finally {
                    hideLoader();
                }
            }

            function fileNameFromURL(url, mime = '') {
                try {
                    const raw = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'imagen');
                    if (/\.[a-z0-9]{2,5}$/i.test(raw)) return raw;
                    return `${raw || 'imagen'}.${mimeExtension(mime)}`;
                } catch {
                    return `imagen_${Date.now()}.${mimeExtension(mime)}`;
                }
            }

            btnPortrait.addEventListener('click', () => setOrientation('portrait', true));
            btnLandscape.addEventListener('click', () => setOrientation('landscape', true));

            function setOrientation(o, save = true) {
                orientation = o;
                btnPortrait.classList.toggle('active', o === 'portrait');
                btnLandscape.classList.toggle('active', o === 'landscape');
                updateViability();
                if (save) saveAllConfig();
            }

            function getMarginCM() {
                if (!document.getElementById('chkUseMargins').checked) return 0;
                const raw = parseFloat(document.getElementById('marginMM').value);
                const mm = Number.isFinite(raw) ? raw : 8;
                return Math.max(0, mm) / 10;
            }

            function getPaper() {
                const key = document.getElementById('paperSize').value;
                const p = PAPERS[key];
                return orientation === 'landscape' ? { w: p.h, h: p.w, cssW: p.cssH, cssH: p.cssW } : { w: p.w, h: p.h,
                    cssW: p.cssW, cssH: p.cssH };
            }

            function calcFit(paper, imgW, imgH) {
                const margin = getMarginCM();
                const gap = getGapCM();
                const uw = paper.w - margin * 2;
                const uh = paper.h - margin * 2;
                if (uw <= 0 || uh <= 0 || imgW <= 0 || imgH <= 0) return { cols: 0, rows: 0, perPage: 0, uw, uh };
                const cols = Math.floor((uw + gap) / (imgW + gap));
                const rows = Math.floor((uh + gap) / (imgH + gap));
                return { cols, rows, perPage: cols * rows, uw, uh };
            }

            function getFitMode() {
                return document.querySelector('input[name="fitMode"]:checked')?.value || 'contain';
            }

            function getMosaicMetrics() {
                const paper = getPaper();
                const margin = getMarginCM();
                const gap = getGapCM();
                const rows = Math.max(1, Math.min(20, parseInt(document.getElementById('mosaicRows').value) || 2));
                const cols = Math.max(1, Math.min(20, parseInt(document.getElementById('mosaicCols').value) || 2));
                const usableW = paper.w - margin * 2;
                const usableH = paper.h - margin * 2;
                const cellW = (usableW - gap * (cols - 1)) / cols;
                const cellH = (usableH - gap * (rows - 1)) / rows;
                return { rows, cols, cellW, cellH, perPage: rows * cols, usableW, usableH };
            }

            function updateMosaicCellSize() {
                const el = document.getElementById('mosaicCellSize');
                if (!el) return;
                const { cellW, cellH } = getMosaicMetrics();
                el.textContent = cellW > 0 && cellH > 0
                    ? `${(cellW * 10).toFixed(1)} × ${(cellH * 10).toFixed(1)} mm`
                    : 'No hay espacio útil';
            }

            function updateLayoutModeUI() {
                document.querySelectorAll('.layout-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.layoutMode === layoutMode));
                document.getElementById('mosaicPanel').style.display = layoutMode === 'mosaic' ? 'flex' : 'none';
                document.getElementById('onePanel').style.display = layoutMode === 'one' ? 'block' : 'none';
            }

            function updateAdvancedUI() {
                document.getElementById('filenamePt').disabled = !document.getElementById('chkFilename').checked;
                document.getElementById('marginMM').disabled = !document.getElementById('chkUseMargins').checked;
            }

            function updateViability() {
                const paper = getPaper();
                const totalCopies = parseInt(document.getElementById('copyCount').value) || 1;
                const totalImgs = images.length * totalCopies;

                if (layoutMode === 'mosaic') {
                    const { rows, cols, cellW, cellH, perPage } = getMosaicMetrics();
                    updateMosaicCellSize();
                    if (cellW <= 0 || cellH <= 0) {
                        setChip('bad', '✕ Filas, columnas, márgenes o espacio no dejan área útil.');
                        return;
                    }
                    const sheets = totalImgs > 0 ? ` · ${Math.ceil(totalImgs / perPage)} hoja(s)` : '';
                    setChip('ok', `✓ ${cols} × ${rows} = ${perPage} por hoja · celda ${cellW.toFixed(1)} × ${cellH.toFixed(1)} cm${sheets}`);
                    return;
                }

                if (layoutMode === 'one') {
                    const margin = getMarginCM();
                    const w = paper.w - margin * 2;
                    const h = paper.h - margin * 2;
                    const sheets = totalImgs > 0 ? ` · ${totalImgs} hoja(s)` : '';
                    setChip(w > 0 && h > 0 ? 'ok' : 'bad', w > 0 && h > 0
                        ? `✓ 1 imagen por hoja · área ${w.toFixed(1)} × ${h.toFixed(1)} cm${sheets}`
                        : '✕ Los márgenes ocupan toda la hoja.');
                    return;
                }

                const w = parseFloat(document.getElementById('imgWidth').value);
                const h = parseFloat(document.getElementById('imgHeight').value);
                if (!w || !h || w <= 0 || h <= 0) { setChip('idle', '📐 Ingresa medidas para calcular'); return; }
                const { cols, rows, perPage, uw, uh } = calcFit(paper, w, h);
                if (perPage === 0) {
                    setChip('bad', `✕ No cabe — máx. utilizable: ${uw.toFixed(1)} × ${uh.toFixed(1)} cm`);
                } else {
                    const sheets = totalImgs > 0 ? ` · ${Math.ceil(totalImgs / perPage)} hoja(s)` : '';
                    setChip('ok', `✓ ${cols} × ${rows} = ${perPage} por hoja${sheets}`);
                }
            }

            function setChip(type, text) { viabilityEl.className = `viability ${type}`;
                viabilityEl.textContent = text; }

            function updateTotalPrints() {
                const totalCopies = parseInt(document.getElementById('copyCount').value) || 1;
                const total = images.length * totalCopies;
                totalPrintsEl.textContent = `Total: ${total} impresiones`;
            }

            ['paperSize', 'imgWidth', 'imgHeight', 'marginMM', 'gapMM', 'copyCount'].forEach(id => {
                const el = document.getElementById(id);
                el.addEventListener('input', () => { updateViability();
                    saveAllConfig();
                    updateTotalPrints(); });
                el.addEventListener('change', () => { updateViability();
                    saveAllConfig();
                    updateTotalPrints(); });
            });

            document.getElementById('layoutTabs').addEventListener('click', e => {
                const tab = e.target.closest('.layout-tab');
                if (!tab) return;
                layoutMode = tab.dataset.layoutMode;
                updateLayoutModeUI();
                updateViability();
                saveAllConfig();
                if (images.length) generateLayout();
            });

            ['mosaicRows', 'mosaicCols'].forEach(id => {
                document.getElementById(id).addEventListener('input', () => {
                    updateMosaicCellSize();
                    updateViability();
                    saveAllConfig();
                    if (images.length && layoutMode === 'mosaic') generateLayout();
                });
            });

            document.querySelectorAll('input[name="fitMode"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    saveAllConfig();
                    if (images.length) generateLayout();
                });
            });

            ['chkAutoRotate', 'chkCellBorder', 'chkFilename', 'chkUseMargins', 'exportDPI', 'filenamePt'].forEach(id => {
                const el = document.getElementById(id);
                const handler = () => {
                    updateAdvancedUI();
                    updateMosaicCellSize();
                    updateViability();
                    saveAllConfig();
                    if (images.length && id !== 'exportDPI') generateLayout();
                };
                el.addEventListener('change', handler);
                if (id === 'filenamePt') el.addEventListener('input', handler);
            });
            document.getElementById('guideColor').addEventListener('input', () => {
                rootStyle.setProperty('--guide-color', hexToRgba(document.getElementById('guideColor').value, 0.45));
                saveAllConfig();
            });
            document.getElementById('chkNumbering').addEventListener('change', () => {
                saveAllConfig();
                if (images.length > 0 && previewInner.querySelector('.page')) generateLayout();
            });

            function hexToRgba(hex, alpha) {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r},${g},${b},${alpha})`;
            }

            document.getElementById('presetRow').addEventListener('click', e => {
                const chip = e.target.closest('.preset-chip');
                if (!chip) return;
                const preset = chip.dataset.preset;
                const w = parseFloat(chip.dataset.w);
                const h = parseFloat(chip.dataset.h);
                document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active-preset'));
                chip.classList.add('active-preset');
                currentPreset = preset;
                layoutMode = 'cell';
                updateLayoutModeUI();
                document.getElementById('imgWidth').value = w;
                document.getElementById('imgHeight').value = h;
                document.getElementById('credencialOpts').style.display = preset === 'credencial' ? 'flex' : 'none';
                document.getElementById('infantilOpts').style.display = preset === 'infantil' ? 'flex' : 'none';
                updateViability();
                saveAllConfig();
                if (images.length > 0) generateLayout();
            });

            document.querySelectorAll('.cred-disp').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.cred-disp').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    credDisposition = btn.dataset.disp;
                    saveAllConfig();
                    if (currentPreset === 'credencial' && images.length > 0) generateLayout();
                });
            });
            document.querySelectorAll('.cred-scale').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.cred-scale').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    credScale = parseFloat(btn.dataset.scale);
                    saveAllConfig();
                    if (currentPreset === 'credencial' && images.length > 0) generateLayout();
                });
            });

            function updateCredDispUI() {
                document.querySelectorAll('.cred-disp').forEach(b => b.classList.toggle('active', b.dataset.disp ===
                    credDisposition));
            }

            function updateCredScaleUI() {
                document.querySelectorAll('.cred-scale').forEach(b => b.classList.toggle('active', parseFloat(b.dataset
                    .scale) === credScale));
            }
            document.getElementById('infantilCount').addEventListener('input', () => {
                if (currentPreset === 'infantil' && images.length > 0) generateLayout();
            });

            document.getElementById('btnAutoFill').addEventListener('click', () => {
                if (images.length === 0) { toast('error', '⚠️ Carga imágenes primero.'); return; }
                layoutMode = 'cell';
                currentPreset = null;
                document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active-preset'));
                document.getElementById('credencialOpts').style.display = 'none';
                document.getElementById('infantilOpts').style.display = 'none';
                updateLayoutModeUI();
                const paper = getPaper();
                const margin = getMarginCM();
                const gap = getGapCM();
                const uw = paper.w - margin * 2;
                const uh = paper.h - margin * 2;
                const totalCopies = parseInt(document.getElementById('copyCount').value) || 1;
                const totalImgs = images.length * totalCopies;
                let best = { w: 1, h: 1, perPage: 0, sheets: Infinity, cols: 0, rows: 0 };
                for (let cols = 1; cols <= 20; cols++) {
                    const imgW = (uw - (cols - 1) * gap) / cols;
                    if (imgW <= 0) continue;
                    for (let rows = 1; rows <= 20; rows++) {
                        const imgH = (uh - (rows - 1) * gap) / rows;
                        if (imgH <= 0) continue;
                        const perPage = cols * rows;
                        const sheets = Math.ceil(totalImgs / perPage);
                        const area = imgW * imgH;
                        if (sheets < best.sheets || (sheets === best.sheets && area > best.w * best.h)) {
                            best = { w: imgW, h: imgH, perPage, sheets, cols, rows };
                        }
                    }
                }
                if (best.sheets === Infinity) { toast('error', 'No se pudo calcular un ajuste automático.'); return; }
                document.getElementById('imgWidth').value = best.w.toFixed(1);
                document.getElementById('imgHeight').value = best.h.toFixed(1);
                updateViability();
                saveAllConfig();
                generateLayout();
                toast('success',
                    `✓ ${best.cols}×${best.rows} = ${best.perPage}/hoja · ${best.w.toFixed(1)}×${best.h.toFixed(1)} cm · ${best.sheets} hoja(s)`
                    );
            });

            async function processFiles(fileList) {
                if (busy) return;
                const arr = Array.from(fileList);
                const imgArr = arr.filter(f => f.type.startsWith('image/'));
                const zipArr = arr.filter(f => f.name.toLowerCase().endsWith('.zip') || f.type.includes('zip'));
                if (imgArr.length === 0 && zipArr.length === 0) { toast('error',
                        '⚠️ Solo se aceptan imágenes o archivos ZIP.'); return; }
                busy = true;
                showLoader('Procesando archivos…');
                try {
                    const batch = [];
                    for (const f of imgArr) {
                        const dataUrl = await readDataURL(f);
                        batch.push(await makeImageRecord(dataUrl, f.name));
                    }
                    for (const zf of zipArr) {
                        setLoaderMsg(`Descomprimiendo ${zf.name}…`);
                        try {
                            const zip = await JSZip.loadAsync(zf);
                            const entries = [];
                            zip.forEach((path, entry) => {
                                if (!entry.dir && /\.(jpe?g|png|webp|gif|ico|bmp|svg|avif)$/i.test(entry.name))
                                    entries.push({ path, entry });
                            });
                            entries.sort((a, b) => a.path.localeCompare(b.path));
                            for (const { path, entry } of entries) {
                                const ext = path.split('.').pop().toLowerCase();
                                const mime = MIME_MAP[ext] ?? `image/${ext}`;
                                const b64 = await entry.async('base64');
                                batch.push(await makeImageRecord(`data:${mime};base64,${b64}`, path.split('/').pop()));
                            }
                        } catch (err) { console.error('Error ZIP:', err);
                            toast('error', `Error al leer ${zf.name}`); }
                    }
                    images.push(...batch);
                    refreshThumbs();
                    updateBadge();
                    updateViability();
                    updateTotalPrints();
                    const n = batch.length;
                    toast('success', `✓ ${n} imagen${n!==1?'es':''} cargada${n!==1?'s':''} · total: ${images.length}`);
                    const w = parseFloat(document.getElementById('imgWidth').value);
                    const h = parseFloat(document.getElementById('imgHeight').value);
                    if (w > 0 && h > 0) generateLayout();
                } finally { hideLoader();
                    busy = false; }
            }

            function readDataURL(file) {
                return new Promise((res, rej) => { const r = new FileReader();
                    r.onload = e => res(e.target.result);
                    r.onerror = rej;
                    r.readAsDataURL(file); });
            }

            function makeImageRecord(dataUrl, name, remote = false) {
                return new Promise(resolve => {
                    const probe = new Image();
                    if (remote) probe.crossOrigin = 'anonymous';
                    const done = () => resolve({
                        dataUrl,
                        name: name || `imagen_${Date.now()}.png`,
                        rotation: 0,
                        flipH: false,
                        flipV: false,
                        copies: 1,
                        naturalWidth: probe.naturalWidth || 0,
                        naturalHeight: probe.naturalHeight || 0,
                        remote
                    });
                    probe.onload = done;
                    probe.onerror = done;
                    probe.src = dataUrl;
                });
            }

            function refreshThumbs() {
                thumbsStrip.innerHTML = '';
                images.forEach((img, i) => {
                    const wrap = document.createElement('div');
                    wrap.className = 'thumb-wrap';
                    wrap.draggable = true;
                    wrap.dataset.index = i;
                    wrap.title = `${img.name} · arrastra para reordenar`;
                    wrap.addEventListener('dragstart', handleDragStart);
                    wrap.addEventListener('dragover', handleDragOver);
                    wrap.addEventListener('dragleave', handleDragLeave);
                    wrap.addEventListener('drop', handleDrop);
                    wrap.addEventListener('dragend', handleDragEnd);

                    const inner = document.createElement('div');
                    inner.className = 'thumb-inner';
                    inner.title = 'Clic para editar';
                    inner.addEventListener('click', () => openLightbox(img, i));

                    const el = document.createElement('img');
                    el.src = img.dataUrl;
                    el.alt = img.name;
                    el.loading = 'lazy';
                    el.style.transform = buildTransform(img);
                    el.style.transformOrigin = 'center center';

                    const copyBadge = document.createElement('div');
                    copyBadge.className = 'thumb-copy-badge';
                    if (img.copies > 1) {
                        copyBadge.textContent = '×' + img.copies;
                        copyBadge.style.display = 'block';
                    }

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'thumb-delete-btn';
                    deleteBtn.type = 'button';
                    deleteBtn.textContent = '🗑';
                    deleteBtn.title = `Eliminar ${img.name}`;
                    deleteBtn.setAttribute('aria-label', `Eliminar ${img.name}`);
                    deleteBtn.addEventListener('click', ev => {
                        ev.stopPropagation();
                        removeImage(i, true);
                    });

                    const editBtn = document.createElement('button');
                    editBtn.className = 'thumb-edit-btn';
                    editBtn.type = 'button';
                    editBtn.textContent = '✎';
                    editBtn.title = 'Abrir editor';
                    editBtn.setAttribute('aria-label', `Editar ${img.name}`);
                    editBtn.addEventListener('click', ev => {
                        ev.stopPropagation();
                        openLightbox(img, i);
                    });

                    const actions = document.createElement('div');
                    actions.className = 'thumb-actions';
                    const btnRotCW = document.createElement('button');
                    btnRotCW.className = 'thumb-act';
                    btnRotCW.textContent = '↻';
                    btnRotCW.title = 'Rotar 90°';
                    btnRotCW.addEventListener('click', ev => { ev.stopPropagation(); rotateImage(i, 90); });
                    const btnFlipH = document.createElement('button');
                    btnFlipH.className = 'thumb-act';
                    btnFlipH.textContent = '↔';
                    btnFlipH.title = 'Voltear horizontal';
                    btnFlipH.addEventListener('click', ev => { ev.stopPropagation(); flipImage(i, 'H'); });
                    const btnFlipV = document.createElement('button');
                    btnFlipV.className = 'thumb-act';
                    btnFlipV.textContent = '↕';
                    btnFlipV.title = 'Voltear vertical';
                    btnFlipV.addEventListener('click', ev => { ev.stopPropagation(); flipImage(i, 'V'); });
                    actions.append(btnRotCW, btnFlipH, btnFlipV);

                    inner.append(el, copyBadge, deleteBtn, editBtn);
                    wrap.append(inner, actions);
                    thumbsStrip.appendChild(wrap);
                });
                thumbsSection.classList.toggle('on', images.length > 0);
            }

            function buildTransform(img, rotationOverride = null, includeTranslate = false) {
                let t = includeTranslate ? 'translate(-50%, -50%) ' : '';
                const rotation = rotationOverride === null ? (img.rotation || 0) : rotationOverride;
                if (rotation) t += `rotate(${rotation}deg) `;
                if (img.flipH) t += 'scaleX(-1) ';
                if (img.flipV) t += 'scaleY(-1) ';
                return t.trim() || 'none';
            }

            function rotateImage(i, deg) {
                images[i].rotation = ((images[i].rotation || 0) + deg) % 360;
                if (images[i].rotation < 0) images[i].rotation += 360;
                refreshThumbs();
                if (previewInner.querySelector('.page')) generateLayout();
            }

            function flipImage(i, axis) {
                if (axis === 'H') images[i].flipH = !images[i].flipH;
                if (axis === 'V') images[i].flipV = !images[i].flipV;
                refreshThumbs();
                if (previewInner.querySelector('.page')) generateLayout();
            }

            function handleDragStart(e) { dragSrcIndex = parseInt(this.dataset.index);
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragSrcIndex); }

            function handleDragOver(e) { e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('drag-over'); }

            function handleDragLeave(e) { this.classList.remove('drag-over'); }

            function handleDrop(e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                const targetIndex = parseInt(this.dataset.index);
                if (dragSrcIndex >= 0 && dragSrcIndex !== targetIndex) {
                    const [moved] = images.splice(dragSrcIndex, 1);
                    images.splice(targetIndex, 0, moved);
                    refreshThumbs();
                    if (previewInner.querySelector('.page')) generateLayout();
                    toast('info', 'Orden actualizado ✓');
                }
                dragSrcIndex = -1;
            }

            function handleDragEnd(e) { this.classList.remove('dragging');
                document.querySelectorAll('.thumb-wrap').forEach(w => w.classList.remove('drag-over'));
                dragSrcIndex = -1; }

            function removeImage(i, askConfirmation = false) {
                if (i < 0 || i >= images.length) return false;
                if (askConfirmation && !confirm(`¿Eliminar “${images[i].name}”?`)) return false;
                images.splice(i, 1);
                refreshThumbs();
                updateBadge();
                updateViability();
                updateTotalPrints();
                if (images.length === 0) { resetPreview();
                    statsSection.style.display = 'none';
                    btnPrint.disabled = true;
                    btnExportPDF.disabled = true; } else generateLayout();
                return true;
            }

            function updateBadge() { const n = images.length;
                imgBadge.textContent = n;
                imgBadge.style.display = n > 0 ? 'block' : 'none';
                dropzone.classList.toggle('loaded', n > 0); }

            btnClear.addEventListener('click', () => {
                if (images.length === 0) return;
                if (!confirm(`¿Eliminar las ${images.length} imágenes cargadas?`)) return;
                images = [];
                refreshThumbs();
                updateBadge();
                updateViability();
                updateTotalPrints();
                resetPreview();
                statsSection.style.display = 'none';
                btnPrint.disabled = true;
                btnExportPDF.disabled = true;
                toast('info', 'Panel limpiado.');
            });

            const btnResetPrintPanel = document.getElementById('btnResetPrintPanel');
            if (btnResetPrintPanel) {
                btnResetPrintPanel.addEventListener('click', () => {
                    if (!confirm('¿Restablecer el panel de impresión a sus valores predeterminados?\n\nSe eliminarán las imágenes cargadas y se descartarán los ajustes personalizados.')) return;
                    localStorage.removeItem('printstudio_config');
                    location.reload();
                });
            }

            function resetPreview() { previewInner.innerHTML = '';
                previewInner.appendChild(emptyState);
                if (printWatermark) printWatermark.classList.remove('hidden'); }

            const modalDupl = document.getElementById('modalDupl');
            document.getElementById('btnDuplSelected').addEventListener('click', () => {
                if (images.length === 0) { toast('error', '⚠️ Carga imágenes primero.'); return; }
                document.getElementById('duplIndex').max = images.length;
                document.getElementById('duplIndex').value = 1;
                document.getElementById('duplCount').value = 5;
                updateDuplPreview();
                modalDupl.classList.add('on');
            });
            document.getElementById('duplIndex').addEventListener('input', updateDuplPreview);
            document.getElementById('btnDuplCancel').addEventListener('click', () => modalDupl.classList.remove('on'));
            document.getElementById('btnDuplConfirm').addEventListener('click', () => {
                const idx = parseInt(document.getElementById('duplIndex').value) - 1;
                const count = parseInt(document.getElementById('duplCount').value);
                if (idx < 0 || idx >= images.length || count < 1) { toast('error', 'Índice o cantidad inválida.'); return; }
                const src = images[idx];
                const newImgs = [];
                for (let c = 0; c < count; c++) newImgs.push({ ...src, name: src.name.replace(/\.(\w+)$/,
                        '_copia$&') });
                images.splice(idx + 1, 0, ...newImgs);
                refreshThumbs();
                updateBadge();
                updateViability();
                updateTotalPrints();
                if (previewInner.querySelector('.page')) generateLayout();
                modalDupl.classList.remove('on');
                toast('success', `✓ ${count} copia(s) creada(s) de "${src.name}"`);
            });
            modalDupl.addEventListener('click', e => { if (e.target === modalDupl) modalDupl.classList.remove('on'); });

            function updateDuplPreview() {
                const idx = parseInt(document.getElementById('duplIndex').value) - 1;
                const previewImg = document.getElementById('duplPreview');
                if (idx >= 0 && idx < images.length) {
                    previewImg.src = images[idx].dataUrl;
                    previewImg.style.display = 'block';
                } else {
                    previewImg.style.display = 'none';
                }
            }

            document.getElementById('btnRotAllCW').addEventListener('click', () => {
                if (images.length === 0) return;
                images.forEach(img => { img.rotation = ((img.rotation || 0) + 90) % 360; });
                refreshThumbs();
                if (previewInner.querySelector('.page')) generateLayout();
                toast('info', 'Todas las imágenes rotadas 90° ↻');
            });

            btnGenerate.addEventListener('click', generateLayout);
            btnPrint.addEventListener('click', () => {
                toast('info', 'En la ventana de impresión selecciona Tamaño real o escala 100%; no uses Ajustar.');
                setTimeout(() => window.print(), 250);
            });

            function getEffectiveImages() {
                const totalCopies = parseInt(document.getElementById('copyCount').value) || 1;
                const result = [];
                images.forEach(img => { for (let c = 0; c < totalCopies; c++) result.push(img); });
                return result;
            }

            function generateLayout() {
                const effectiveImages = getEffectiveImages();
                if (effectiveImages.length === 0) { toast('error', '⚠️ Carga imágenes primero.'); return; }
                const baseW = parseFloat(document.getElementById('imgWidth').value);
                const baseH = parseFloat(document.getElementById('imgHeight').value);
                const paper = getPaper();
                const margin = getMarginCM();
                const gap = getGapCM();

                if (layoutMode === 'mosaic') {
                    generateMosaicLayout(effectiveImages, paper, margin, gap);
                    return;
                }
                if (layoutMode === 'one') {
                    generateOnePerPageLayout(effectiveImages, paper, margin, gap);
                    return;
                }
                if (!baseW || !baseH || baseW <= 0 || baseH <= 0) {
                    toast('error', '⚠️ Ingresa medidas válidas en cm.');
                    return;
                }

                let imgW = baseW;
                let imgH = baseH;
                if (currentPreset === 'credencial') { imgW = baseW * credScale;
                    imgH = baseH * credScale; }
                const { cols, rows, perPage } = calcFit(paper, imgW, imgH);
                if (perPage === 0 && currentPreset !== 'credencial') {
                    toast('error', '✕ Las medidas no caben.');
                    statsSection.style.display = 'none';
                    btnPrint.disabled = true;
                    btnExportPDF.disabled = true;
                    return;
                }
                if (currentPreset === 'credencial') generateCredencialLayout(effectiveImages, paper, margin, baseW,
                    baseH);
                else if (currentPreset === 'infantil') generateInfantilLayout(effectiveImages, paper, margin, baseW,
                    baseH);
                else generateStandardLayout(effectiveImages, paper, margin, imgW, imgH, cols, rows, perPage, gap);
            }

            function generateMosaicLayout(effectiveImages, paper, margin, gap) {
                const { rows, cols, cellW, cellH, perPage } = getMosaicMetrics();
                if (cellW <= 0 || cellH <= 0) {
                    toast('error', '✕ La cuadrícula no deja espacio útil.');
                    return;
                }
                generateStandardLayout(effectiveImages, paper, margin, cellW, cellH, cols, rows, perPage, gap);
            }

            function generateOnePerPageLayout(effectiveImages, paper, margin, gap) {
                const cellW = paper.w - margin * 2;
                const cellH = paper.h - margin * 2;
                if (cellW <= 0 || cellH <= 0) {
                    toast('error', '✕ Los márgenes no dejan espacio útil.');
                    return;
                }
                generateStandardLayout(effectiveImages, paper, margin, cellW, cellH, 1, 1, 1, gap);
            }

            function generateStandardLayout(effectiveImages, paper, margin, imgW, imgH, cols, rows, perPage, gap) {
                const totalSheets = Math.ceil(effectiveImages.length / perPage);
                rootStyle.setProperty('--page-width', paper.cssW);
                rootStyle.setProperty('--page-height', paper.cssH);
                rootStyle.setProperty('--page-margin', `${margin}cm`);
                rootStyle.setProperty('--page-gap', `${gap}cm`);
                rootStyle.setProperty('--guide-color', hexToRgba(document.getElementById('guideColor').value, 0.45));
                injectPageRule(paper.cssW, paper.cssH);
                const showNumbers = document.getElementById('chkNumbering').checked;
                previewInner.innerHTML = '';
                if (printWatermark) printWatermark.classList.add('hidden');
                let idx = 0;
                for (let p = 0; p < totalSheets; p++) {
                    const wrap = createPageWrap(p, totalSheets);
                    const page = document.createElement('div');
                    page.className = 'page';
                    for (let i = 0; i < perPage && idx < effectiveImages.length; i++, idx++) {
                        const col = i % cols;
                        const row = Math.floor(i / cols);
                        const xCm = margin + col * (imgW + gap);
                        const yCm = margin + row * (imgH + gap);
                        const container = makeImgContainer(
                            effectiveImages[idx], imgW, imgH, idx, showNumbers, xCm, yCm
                        );
                        page.appendChild(container);
                    }
                    wrap.appendChild(page);
                    previewInner.appendChild(wrap);
                }
                finishLayout(effectiveImages, perPage, totalSheets);
            }

            function generateCredencialLayout(effectiveImages, paper, margin, baseW, baseH) {
                const scaledW = baseW * credScale;
                const scaledH = baseH * credScale;
                const gap = Math.max(getGapCM(), 0.5);
                const usableW = paper.w - margin * 2;
                const usableH = paper.h - margin * 2;
                const fitsSide = scaledW * 2 + gap <= usableW && scaledH <= usableH;
                const fitsStack = scaledH * 2 + gap <= usableH && scaledW <= usableW;
                // Si la disposición elegida no deja dos credenciales por hoja pero la otra sí
                // (p. ej. 150% / 200% en carta), se usa la que las acomoda juntas en la misma hoja.
                let disp = credDisposition;
                if (disp === 'h-side' && !fitsSide && fitsStack) disp = 'v-stack';
                else if (disp === 'v-stack' && !fitsStack && fitsSide) disp = 'h-side';
                const perPage = (fitsSide || fitsStack) ? 2 : 1;
                const totalSheets = Math.ceil(effectiveImages.length / perPage);

                if (scaledW > usableW || scaledH > usableH) {
                    toast('error', `✕ La credencial ampliada (${scaledW.toFixed(1)} × ${scaledH.toFixed(1)} cm) no cabe en el área útil.`);
                    return;
                }

                rootStyle.setProperty('--page-width', paper.cssW);
                rootStyle.setProperty('--page-height', paper.cssH);
                rootStyle.setProperty('--page-margin', `${margin}cm`);
                rootStyle.setProperty('--page-gap', `${gap}cm`);
                rootStyle.setProperty('--guide-color', hexToRgba(document.getElementById('guideColor').value, 0.45));
                injectPageRule(paper.cssW, paper.cssH);
                const showNumbers = document.getElementById('chkNumbering').checked;
                previewInner.innerHTML = '';
                if (printWatermark) printWatermark.classList.add('hidden');
                let idx = 0;

                for (let p = 0; p < totalSheets; p++) {
                    const wrap = createPageWrap(p, totalSheets);
                    const page = document.createElement('div');
                    page.className = 'page credencial-mode';
                    page.style.position = 'relative';

                    const pageItemCount = Math.min(perPage, effectiveImages.length - idx);
                    // El grupo se calcula con las tarjetas que caben por hoja (perPage),
                    // así una tarjeta sola en la última hoja queda en el mismo lugar.
                    const groupW = disp === 'h-side'
                        ? perPage * scaledW + (perPage - 1) * gap
                        : scaledW;
                    const groupH = disp === 'v-stack'
                        ? perPage * scaledH + (perPage - 1) * gap
                        : scaledH;
                    // Siempre centradas horizontalmente.
                    // Lado a lado al 100%: parte superior de la hoja (respeta el margen).
                    // Arriba/Abajo y ampliaciones de 150% / 200%: centradas también en vertical.
                    const startX = (paper.w - groupW) / 2;
                    const startY = (disp === 'h-side' && credScale <= 1 && perPage === 2)
                        ? margin
                        : (paper.h - groupH) / 2;

                    for (let j = 0; j < pageItemCount && idx < effectiveImages.length; j++, idx++) {
                        const xCm = disp === 'h-side' ? startX + j * (scaledW + gap) : startX;
                        const yCm = disp === 'v-stack' ? startY + j * (scaledH + gap) : startY;
                        const cell = makeImgContainer(
                            effectiveImages[idx], scaledW, scaledH, idx, showNumbers, xCm, yCm
                        );
                        // Posición absoluta exacta: vista previa, impresión y PDF coinciden.
                        cell.style.position = 'absolute';
                        cell.style.left = `${xCm}cm`;
                        cell.style.top = `${yCm}cm`;
                        page.appendChild(cell);
                    }
                    wrap.appendChild(page);
                    previewInner.appendChild(wrap);
                }
                finishLayout(effectiveImages, perPage, totalSheets);
            }

            function generateInfantilLayout(effectiveImages, paper, margin, baseW, baseH) {
                const desired = parseInt(document.getElementById('infantilCount').value) || effectiveImages.length;
                const imgW = baseW;
                const imgH = baseH;
                const gap = getGapCM();
                const uw = paper.w - margin * 2;
                const uh = paper.h - margin * 2;
                const cols = Math.floor((uw + gap) / (imgW + gap));
                const rows = Math.floor((uh + gap) / (imgH + gap));
                const perPage = cols * rows;
                if (perPage === 0) { toast('error', '✕ Las fotos infantiles no caben.'); return; }
                const finalImages = [];
                for (let i = 0; i < desired; i++) finalImages.push(effectiveImages[i % effectiveImages.length]);
                generateStandardLayout(finalImages, paper, margin, imgW, imgH, cols, rows, perPage, gap);
            }

            function getEffectiveRotation(imgData, cellW, cellH) {
                let rotation = ((imgData.rotation || 0) % 360 + 360) % 360;
                if (!document.getElementById('chkAutoRotate').checked) return rotation;
                const naturalW = imgData.naturalWidth || 0;
                const naturalH = imgData.naturalHeight || 0;
                if (!naturalW || !naturalH || Math.abs(cellW - cellH) < 0.01) return rotation;
                const rotated = rotation % 180 !== 0;
                const imageLandscape = rotated ? naturalH >= naturalW : naturalW >= naturalH;
                const cellLandscape = cellW >= cellH;
                if (imageLandscape !== cellLandscape) rotation = (rotation + 90) % 360;
                return rotation;
            }

            function makeImgContainer(imgData, w, h, globalIdx, showNumbers, xCm = null, yCm = null) {
                const container = document.createElement('div');
                container.className = 'image-cell';
                container.style.width = `${w}cm`;
                container.style.height = `${h}cm`;

                // La guía se dibuja dentro de la celda sin consumir ancho o alto.
                // Así una foto de 2.5 × 3 cm conserva exactamente esas medidas.
                container.style.border = 'none';
                container.style.boxShadow = document.getElementById('chkCellBorder').checked
                    ? 'inset 0 0 0 1px var(--guide-color)'
                    : 'none';

                // Medidas y posición físicas usadas por el exportador PDF directo.
                container.dataset.widthCm = String(w);
                container.dataset.heightCm = String(h);
                container.dataset.globalIndex = String(globalIdx);
                if (Number.isFinite(xCm)) container.dataset.xCm = String(xCm);
                if (Number.isFinite(yCm)) container.dataset.yCm = String(yCm);

                const imgEl = document.createElement('img');
                const effectiveRotation = getEffectiveRotation(imgData, w, h);
                const rotated = effectiveRotation % 180 !== 0;
                imgEl.src = imgData.dataUrl;
                imgEl.className = 'print-image';
                imgEl.style.width = `${rotated ? h : w}cm`;
                imgEl.style.height = `${rotated ? w : h}cm`;
                const fitMode = getFitMode();
                imgEl.style.objectFit = fitMode;
                imgEl.style.transform = buildTransform(imgData, effectiveRotation, true);
                imgEl.loading = 'lazy';
                imgEl.alt = imgData.name;
                imgEl.dataset.imageIndex = images.indexOf(imgData);
                // Guardamos los datos exactos de composición para que el exportador PDF
                // no dependa de cómo html2canvas interprete object-fit o transform.
                imgEl.dataset.effectiveRotation = String(effectiveRotation);
                imgEl.dataset.fitMode = fitMode;
                imgEl.addEventListener('click', () => openLightbox(imgData, images.indexOf(imgData)));
                container.appendChild(imgEl);

                if (document.getElementById('chkFilename').checked) {
                    const filename = document.createElement('span');
                    filename.className = 'img-filename';
                    filename.textContent = imgData.name;
                    filename.title = imgData.name;
                    filename.style.fontSize = `${parseInt(document.getElementById('filenamePt').value) || 8}pt`;
                    container.appendChild(filename);
                }

                if (showNumbers) {
                    const num = document.createElement('span');
                    num.className = 'img-number';
                    num.textContent = globalIdx + 1;
                    num.style.bottom = document.getElementById('chkFilename').checked ? '18px' : '2px';
                    num.style.right = '3px';
                    container.appendChild(num);
                }
                return container;
            }

            function createPageWrap(p, totalSheets) {
                const wrap = document.createElement('div');
                wrap.className = 'page-wrap';
                if (p === totalSheets - 1) wrap.classList.add('last-page');
                const label = document.createElement('div');
                label.className = 'page-label';
                label.textContent = `Hoja ${p + 1} de ${totalSheets}`;
                wrap.appendChild(label);
                return wrap;
            }

            function finishLayout(effectiveImages, perPage, totalSheets) {
                document.getElementById('statTotal').textContent = effectiveImages.length;
                document.getElementById('statPer').textContent = perPage;
                document.getElementById('statSheets').textContent = totalSheets;
                statsSection.style.display = 'block';
                btnPrint.disabled = false;
                btnExportPDF.disabled = false;
            }

            function injectPageRule(w, h) {
                const old = document.getElementById('_pstyle');
                if (old) old.remove();
                const s = document.createElement('style');
                s.id = '_pstyle';
                s.textContent = `@page { size: ${w} ${h}; margin: 0; }`;
                document.head.appendChild(s);
            }

            // ── EDITOR DE IMAGEN / LIGHTBOX ──
            function openLightbox(imgObj, globalIdx) {
                if (!imgObj) return;
                lbImageObj = imgObj;
                lbRotation = imgObj.rotation || 0;
                lbFlipH = imgObj.flipH || false;
                lbFlipV = imgObj.flipV || false;
                cropMode = false;
                cropPointer = null;
                cropAction = null;
                cropRect = { x: 0, y: 0, w: 0, h: 0 };
                cropRectEl.style.display = 'none';
                cropToolbar.classList.remove('on');
                lbApplyCrop.style.display = 'none';
                lbCropMode.textContent = '✂ Recortar';
                lbTitle.textContent = imgObj.name || 'Editor de imagen';
                lightbox.classList.add('on');
                drawLightboxCanvas();
            }

            function saveLightboxChanges() {
                if (!lbImageObj) return;
                const changed = lbRotation !== (lbImageObj.rotation || 0) ||
                    lbFlipH !== (lbImageObj.flipH || false) ||
                    lbFlipV !== (lbImageObj.flipV || false);
                if (!changed) return;
                lbImageObj.rotation = lbRotation;
                lbImageObj.flipH = lbFlipH;
                lbImageObj.flipV = lbFlipV;
                refreshThumbs();
                if (previewInner.querySelector('.page')) generateLayout();
            }

            function closeLightbox(save = true) {
                if (save) saveLightboxChanges();
                lightbox.classList.remove('on');
                lbImageObj = null;
                cropMode = false;
                cropRectEl.style.display = 'none';
                cropToolbar.classList.remove('on');
            }

            function loadImageElement(src, remote = false) {
                return new Promise((resolve, reject) => {
                    const load = useCORS => {
                        const img = new Image();
                        if (useCORS) img.crossOrigin = 'anonymous';
                        img.onload = () => resolve(img);
                        img.onerror = () => {
                            if (useCORS) load(false);
                            else reject(new Error('No se pudo cargar la imagen'));
                        };
                        img.src = src;
                    };
                    load(remote);
                });
            }

            function transformedDimensions(img) {
                return lbRotation % 180 !== 0
                    ? { w: img.naturalHeight, h: img.naturalWidth }
                    : { w: img.naturalWidth, h: img.naturalHeight };
            }

            function drawTransformedToCanvas(img, canvas, maxW = Infinity, maxH = Infinity) {
                const dims = transformedDimensions(img);
                const scale = Math.min(maxW / dims.w, maxH / dims.h, 1);
                canvas.width = Math.max(1, Math.round(dims.w * scale));
                canvas.height = Math.max(1, Math.round(dims.h * scale));
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                if (lbRotation) ctx.rotate(lbRotation * Math.PI / 180);
                if (lbFlipH) ctx.scale(-1, 1);
                if (lbFlipV) ctx.scale(1, -1);
                ctx.drawImage(img, -img.naturalWidth * scale / 2, -img.naturalHeight * scale / 2,
                    img.naturalWidth * scale, img.naturalHeight * scale);
                ctx.restore();
                return scale;
            }

            async function drawLightboxCanvas() {
                if (!lbImageObj) return;
                try {
                    const img = await loadImageElement(lbImageObj.dataUrl, lbImageObj.remote);
                    const maxW = Math.min(window.innerWidth * 0.86, 1400);
                    const maxH = Math.min(window.innerHeight * 0.62, 850);
                    drawTransformedToCanvas(img, lbCanvas, maxW, maxH);
                    if (cropMode) {
                        if (cropRect.w < 10 || cropRect.h < 10) resetCropSelection();
                        updateCropElement();
                    } else {
                        cropRectEl.style.display = 'none';
                    }
                } catch (err) {
                    console.error('No se pudo abrir la imagen en el editor:', err);
                    toast('error', 'No se pudo abrir esta imagen en el editor.');
                }
            }

            function lightboxNavigate(delta) {
                if (!lbImageObj || images.length === 0) return;
                saveLightboxChanges();
                const idx = images.indexOf(lbImageObj);
                if (idx === -1) return;
                const newIdx = (idx + delta + images.length) % images.length;
                openLightbox(images[newIdx], newIdx);
            }

            function deleteCurrentLightboxImage() {
                if (!lbImageObj) return;
                const idx = images.indexOf(lbImageObj);
                if (idx === -1) return;
                const name = lbImageObj.name;
                if (!confirm(`¿Eliminar “${name}”?`)) return;
                const removed = removeImage(idx, false);
                if (!removed) return;
                if (images.length === 0) {
                    closeLightbox(false);
                } else {
                    const newIdx = Math.min(idx, images.length - 1);
                    openLightbox(images[newIdx], newIdx);
                }
                toast('info', `Imagen eliminada: ${name}`);
            }

            lbRotateCW.addEventListener('click', () => {
                if (!lbImageObj) return;
                lbRotation = (lbRotation + 90) % 360;
                cropRect = { x: 0, y: 0, w: 0, h: 0 };
                drawLightboxCanvas();
            });
            lbFlipHBtn.addEventListener('click', () => { if (lbImageObj) { lbFlipH = !lbFlipH; drawLightboxCanvas(); } });
            lbFlipVBtn.addEventListener('click', () => { if (lbImageObj) { lbFlipV = !lbFlipV; drawLightboxCanvas(); } });
            document.getElementById('lbPrev').addEventListener('click', () => lightboxNavigate(-1));
            document.getElementById('lbNext').addEventListener('click', () => lightboxNavigate(1));
            lbDelete.addEventListener('click', deleteCurrentLightboxImage);

            function selectedCropAspect() {
                const value = cropRatioSelect.value;
                if (value === 'free') return null;
                if (value === 'original') return lbCanvas.width / lbCanvas.height;
                const parsed = parseFloat(value);
                return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
            }

            function resetCropSelection() {
                cropAspect = selectedCropAspect();
                const inset = 0.08;
                let w = lbCanvas.width * (1 - inset * 2);
                let h = lbCanvas.height * (1 - inset * 2);
                if (cropAspect) {
                    if (w / h > cropAspect) w = h * cropAspect;
                    else h = w / cropAspect;
                }
                cropRect = {
                    x: (lbCanvas.width - w) / 2,
                    y: (lbCanvas.height - h) / 2,
                    w,
                    h
                };
                updateCropElement();
            }

            function updateCropElement() {
                if (!cropMode) {
                    cropRectEl.style.display = 'none';
                    return;
                }
                const minSize = 20;
                cropRect.w = Math.max(minSize, Math.min(cropRect.w, lbCanvas.width));
                cropRect.h = Math.max(minSize, Math.min(cropRect.h, lbCanvas.height));
                cropRect.x = Math.max(0, Math.min(cropRect.x, lbCanvas.width - cropRect.w));
                cropRect.y = Math.max(0, Math.min(cropRect.y, lbCanvas.height - cropRect.h));
                cropRectEl.style.display = 'block';
                cropRectEl.style.left = `${cropRect.x}px`;
                cropRectEl.style.top = `${cropRect.y}px`;
                cropRectEl.style.width = `${cropRect.w}px`;
                cropRectEl.style.height = `${cropRect.h}px`;
            }

            lbCropMode.addEventListener('click', () => {
                cropMode = !cropMode;
                if (cropMode) {
                    lbCropMode.textContent = '✂ Cancelar recorte';
                    lbApplyCrop.style.display = 'inline-flex';
                    cropToolbar.classList.add('on');
                    resetCropSelection();
                } else {
                    lbCropMode.textContent = '✂ Recortar';
                    lbApplyCrop.style.display = 'none';
                    cropToolbar.classList.remove('on');
                    cropRectEl.style.display = 'none';
                    cropRect = { x: 0, y: 0, w: 0, h: 0 };
                }
            });

            cropRatioSelect.addEventListener('change', resetCropSelection);
            document.getElementById('lbResetCrop').addEventListener('click', resetCropSelection);

            lbApplyCrop.addEventListener('click', async () => {
                if (!cropMode || cropRect.w < 10 || cropRect.h < 10 || !lbImageObj) {
                    toast('error', 'Selecciona un área de recorte primero.');
                    return;
                }
                try {
                    const img = await loadImageElement(lbImageObj.dataUrl, lbImageObj.remote);
                    const fullCanvas = document.createElement('canvas');
                    drawTransformedToCanvas(img, fullCanvas);
                    const scaleX = fullCanvas.width / lbCanvas.width;
                    const scaleY = fullCanvas.height / lbCanvas.height;
                    const sx = Math.max(0, Math.round(cropRect.x * scaleX));
                    const sy = Math.max(0, Math.round(cropRect.y * scaleY));
                    const sw = Math.min(fullCanvas.width - sx, Math.max(1, Math.round(cropRect.w * scaleX)));
                    const sh = Math.min(fullCanvas.height - sy, Math.max(1, Math.round(cropRect.h * scaleY)));
                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = sw;
                    cropCanvas.height = sh;
                    cropCanvas.getContext('2d').drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
                    const newDataUrl = cropCanvas.toDataURL('image/png');

                    lbImageObj.dataUrl = newDataUrl;
                    lbImageObj.rotation = 0;
                    lbImageObj.flipH = false;
                    lbImageObj.flipV = false;
                    lbImageObj.naturalWidth = sw;
                    lbImageObj.naturalHeight = sh;
                    lbImageObj.remote = false;
                    lbRotation = 0;
                    lbFlipH = false;
                    lbFlipV = false;
                    cropMode = false;
                    cropRect = { x: 0, y: 0, w: 0, h: 0 };
                    cropRectEl.style.display = 'none';
                    cropToolbar.classList.remove('on');
                    lbApplyCrop.style.display = 'none';
                    lbCropMode.textContent = '✂ Recortar';
                    refreshThumbs();
                    if (previewInner.querySelector('.page')) generateLayout();
                    await drawLightboxCanvas();
                    toast('success', `✓ Recorte aplicado en ${sw} × ${sh} px.`);
                } catch (err) {
                    console.error('Error al recortar:', err);
                    toast('error', 'No fue posible recortar esta imagen. Una imagen remota puede estar bloqueada por CORS.');
                }
            });

            function canvasPoint(event) {
                const rect = lbCanvas.getBoundingClientRect();
                return {
                    x: Math.max(0, Math.min(lbCanvas.width, event.clientX - rect.left)),
                    y: Math.max(0, Math.min(lbCanvas.height, event.clientY - rect.top))
                };
            }

            lbCanvas.addEventListener('pointerdown', e => {
                if (!cropMode) return;
                e.preventDefault();
                lbCanvas.setPointerCapture(e.pointerId);
                const p = canvasPoint(e);
                cropPointer = { start: p, original: { ...cropRect } };
                cropAction = 'new';
                cropRect = { x: p.x, y: p.y, w: 1, h: 1 };
                updateCropElement();
            });

            cropRectEl.addEventListener('pointerdown', e => {
                if (!cropMode) return;
                e.preventDefault();
                e.stopPropagation();
                const p = canvasPoint(e);
                cropPointer = { start: p, original: { ...cropRect } };
                cropHandle = e.target.dataset.handle || null;
                cropAction = cropHandle ? 'resize' : 'move';
                cropRectEl.setPointerCapture(e.pointerId);
            });

            function applyAspectToRect(rect, aspect, handle = 'se') {
                if (!aspect) return rect;
                if (rect.w / rect.h > aspect) rect.w = rect.h * aspect;
                else rect.h = rect.w / aspect;
                if (handle.includes('n')) rect.y = cropPointer.original.y + cropPointer.original.h - rect.h;
                if (handle.includes('w')) rect.x = cropPointer.original.x + cropPointer.original.w - rect.w;
                return rect;
            }

            function handleCropPointerMove(e) {
                if (!cropMode || !cropPointer || !cropAction) return;
                const p = canvasPoint(e);
                const dx = p.x - cropPointer.start.x;
                const dy = p.y - cropPointer.start.y;
                const o = cropPointer.original;
                cropAspect = selectedCropAspect();

                if (cropAction === 'move') {
                    cropRect = { ...o, x: o.x + dx, y: o.y + dy };
                } else if (cropAction === 'new') {
                    let w = Math.abs(dx);
                    let h = Math.abs(dy);
                    if (cropAspect && w > 0 && h > 0) {
                        if (w / h > cropAspect) h = w / cropAspect;
                        else w = h * cropAspect;
                    }
                    cropRect = {
                        x: dx < 0 ? cropPointer.start.x - w : cropPointer.start.x,
                        y: dy < 0 ? cropPointer.start.y - h : cropPointer.start.y,
                        w,
                        h
                    };
                } else if (cropAction === 'resize') {
                    let x1 = o.x;
                    let y1 = o.y;
                    let x2 = o.x + o.w;
                    let y2 = o.y + o.h;
                    if (cropHandle.includes('w')) x1 = p.x;
                    if (cropHandle.includes('e')) x2 = p.x;
                    if (cropHandle.includes('n')) y1 = p.y;
                    if (cropHandle.includes('s')) y2 = p.y;
                    let rect = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
                    if (cropAspect && rect.w > 0 && rect.h > 0) rect = applyAspectToRect(rect, cropAspect, cropHandle);
                    cropRect = rect;
                }
                updateCropElement();
            }

            window.addEventListener('pointermove', handleCropPointerMove);
            window.addEventListener('pointerup', () => {
                cropPointer = null;
                cropAction = null;
                cropHandle = null;
            });

            lbCancel.addEventListener('click', () => closeLightbox(true));
            lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(true); });

            // Atajos de teclado globales
            document.addEventListener('keydown', e => {
                if (lightbox.classList.contains('on')) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        closeLightbox(true);
                    } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        lightboxNavigate(-1);
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        lightboxNavigate(1);
                    } else if (e.key === 'Delete') {
                        e.preventDefault();
                        deleteCurrentLightboxImage();
                    }
                }
            });

            // ── EXPORTACIÓN PDF CON MEDIDAS FÍSICAS EXACTAS ──
            // En lugar de rasterizar la hoja HTML completa, cada celda se coloca en jsPDF
            // directamente en milímetros. Esto elimina la reducción proporcional causada por
            // redondeos CSS/html2canvas y conserva Encajar, Rellenar, Estirar, giros y volteos.
            function hexToRgb(hex) {
                const clean = String(hex || '#000000').replace('#', '');
                const value = clean.length === 3
                    ? clean.split('').map(ch => ch + ch).join('')
                    : clean.padEnd(6, '0').slice(0, 6);
                return [
                    parseInt(value.slice(0, 2), 16) || 0,
                    parseInt(value.slice(2, 4), 16) || 0,
                    parseInt(value.slice(4, 6), 16) || 0
                ];
            }

            function blendWithWhite(rgb, alpha = 0.45) {
                return rgb.map(channel => Math.round(255 + (channel - 255) * alpha));
            }

            function truncatePDFText(pdf, text, maxWidthMM) {
                const original = String(text || '');
                if (!original || pdf.getTextWidth(original) <= maxWidthMM) return original;
                const suffix = '…';
                let low = 0;
                let high = original.length;
                while (low < high) {
                    const mid = Math.ceil((low + high) / 2);
                    const candidate = original.slice(0, mid) + suffix;
                    if (pdf.getTextWidth(candidate) <= maxWidthMM) low = mid;
                    else high = mid - 1;
                }
                return original.slice(0, low) + suffix;
            }

            async function createExactPDFImageData(imgData, widthMM, heightMM, dpi, effectiveRotation, fitMode) {
                const source = await loadImageElement(imgData.dataUrl, imgData.remote);
                const canvas = document.createElement('canvas');
                const targetW = Math.max(1, Math.round(widthMM / 25.4 * dpi));
                const targetH = Math.max(1, Math.round(heightMM / 25.4 * dpi));
                canvas.width = targetW;
                canvas.height = targetH;

                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                const rotation = ((Number(effectiveRotation) || 0) % 360 + 360) % 360;
                const rotated = rotation % 180 !== 0;
                const naturalW = Math.max(1, source.naturalWidth || source.width || 1);
                const naturalH = Math.max(1, source.naturalHeight || source.height || 1);
                const orientedW = rotated ? naturalH : naturalW;
                const orientedH = rotated ? naturalW : naturalH;

                let drawW = targetW;
                let drawH = targetH;
                if (fitMode !== 'fill') {
                    const ratio = fitMode === 'cover'
                        ? Math.max(targetW / orientedW, targetH / orientedH)
                        : Math.min(targetW / orientedW, targetH / orientedH);
                    drawW = orientedW * ratio;
                    drawH = orientedH * ratio;
                }

                const scaleX = rotated ? drawH / naturalW : drawW / naturalW;
                const scaleY = rotated ? drawW / naturalH : drawH / naturalH;

                ctx.save();
                ctx.translate(targetW / 2, targetH / 2);
                if (rotation) ctx.rotate(rotation * Math.PI / 180);
                if (imgData.flipH) ctx.scale(-1, 1);
                if (imgData.flipV) ctx.scale(1, -1);
                ctx.drawImage(
                    source,
                    -naturalW * scaleX / 2,
                    -naturalH * scaleY / 2,
                    naturalW * scaleX,
                    naturalH * scaleY
                );
                ctx.restore();

                return canvas.toDataURL('image/jpeg', 0.97);
            }

            function getExactCellPlacementMM(page, cell, paper) {
                const widthMM = Math.max(0.01, (parseFloat(cell.dataset.widthCm) || 0) * 10);
                const heightMM = Math.max(0.01, (parseFloat(cell.dataset.heightCm) || 0) * 10);
                let xMM = (parseFloat(cell.dataset.xCm) || 0) * 10;
                let yMM = (parseFloat(cell.dataset.yCm) || 0) * 10;

                // Compatibilidad con composiciones antiguas ya dibujadas antes de esta corrección.
                if (!cell.dataset.xCm || !cell.dataset.yCm) {
                    const pageRect = page.getBoundingClientRect();
                    const cellRect = cell.getBoundingClientRect();
                    if (pageRect.width > 0 && pageRect.height > 0) {
                        xMM = (cellRect.left - pageRect.left) / pageRect.width * paper.w * 10;
                        yMM = (cellRect.top - pageRect.top) / pageRect.height * paper.h * 10;
                    }
                }

                return { xMM, yMM, widthMM, heightMM };
            }

            function drawPDFCellDecorations(pdf, cell, placement, globalIndex) {
                const { xMM, yMM, widthMM, heightMM } = placement;
                const filenameEnabled = document.getElementById('chkFilename').checked;
                const numberingEnabled = document.getElementById('chkNumbering').checked;
                let filenameBandMM = 0;

                if (filenameEnabled) {
                    const filename = cell.querySelector('.img-filename')?.textContent || '';
                    const fontPt = Math.max(5, parseInt(document.getElementById('filenamePt').value) || 8);
                    const fontMM = fontPt * 25.4 / 72;
                    filenameBandMM = Math.min(heightMM, fontMM * 1.25 + 0.9);
                    pdf.setFillColor(255, 255, 255);
                    pdf.rect(
                        xMM + 0.5,
                        yMM + heightMM - filenameBandMM - 0.3,
                        Math.max(0.1, widthMM - 1),
                        filenameBandMM,
                        'F'
                    );
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(fontPt);
                    pdf.setTextColor(17, 17, 17);
                    const safeText = truncatePDFText(pdf, filename, Math.max(0.1, widthMM - 2));
                    pdf.text(safeText, xMM + widthMM / 2, yMM + heightMM - 0.9, { align: 'center' });
                }

                if (numberingEnabled) {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(6);
                    pdf.setTextColor(80, 80, 80);
                    const numberY = filenameEnabled
                        ? yMM + heightMM - filenameBandMM - 0.8
                        : yMM + heightMM - 0.8;
                    pdf.text(String(globalIndex + 1), xMM + widthMM - 0.8, numberY, { align: 'right' });
                }

                if (document.getElementById('chkCellBorder').checked) {
                    const guideRGB = blendWithWhite(hexToRgb(document.getElementById('guideColor').value), 0.55);
                    const lineWidthMM = 0.10;
                    pdf.setDrawColor(...guideRGB);
                    pdf.setLineWidth(lineWidthMM);
                    // La línea queda dentro de la medida indicada; no agranda ni reduce la celda.
                    pdf.rect(
                        xMM + lineWidthMM / 2,
                        yMM + lineWidthMM / 2,
                        Math.max(0.01, widthMM - lineWidthMM),
                        Math.max(0.01, heightMM - lineWidthMM),
                        'S'
                    );
                }
            }

            btnExportPDF.addEventListener('click', async () => {
                const pages = Array.from(previewInner.querySelectorAll('.page'));
                if (pages.length === 0) { toast('error', 'Genera la vista previa primero.'); return; }
                btnExportPDF.disabled = true;
                btnExportPDF.textContent = '⏳ Generando PDF…';
                showLoader('Preparando PDF con medidas exactas…');

                try {
                    const { jsPDF } = window.jspdf;
                    const paper = getPaper();
                    const paperWMM = paper.w * 10;
                    const paperHMM = paper.h * 10;
                    const pageOrientation = paperWMM > paperHMM ? 'landscape' : 'portrait';
                    const dpi = parseInt(document.getElementById('exportDPI').value) || 300;
                    const pdf = new jsPDF({
                        orientation: pageOrientation,
                        unit: 'mm',
                        format: [paperWMM, paperHMM],
                        compress: true,
                        precision: 12
                    });

                    // Indica a Acrobat y lectores compatibles que la impresión predeterminada
                    // debe ser a tamaño real, sin reducción automática.
                    if (typeof pdf.viewerPreferences === 'function') {
                        try {
                            pdf.viewerPreferences({ PrintScaling: 'None' });
                        } catch (viewerPrefError) {
                            console.warn('El lector PDF no aceptó PrintScaling=None:', viewerPrefError);
                        }
                    }
                    pdf.setProperties({
                        title: 'PrintStudio Pro - medidas exactas',
                        subject: 'Diseño de impresión a escala física 100%',
                        creator: 'PrintStudio Pro'
                    });

                    const imageCache = new Map();
                    const totalCells = pages.reduce((sum, page) => sum + page.querySelectorAll('.image-cell').length, 0);
                    let completedCells = 0;

                    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
                        if (pageIndex > 0) pdf.addPage([paperWMM, paperHMM], pageOrientation);
                        pdf.setFillColor(255, 255, 255);
                        pdf.rect(0, 0, paperWMM, paperHMM, 'F');

                        const page = pages[pageIndex];
                        const cells = Array.from(page.querySelectorAll('.image-cell'));
                        for (const cell of cells) {
                            completedCells++;
                            setLoaderMsg(`Página ${pageIndex + 1} de ${pages.length} · imagen ${completedCells} de ${totalCells}…`);

                            const imgEl = cell.querySelector('.print-image');
                            if (!imgEl) continue;
                            const imageIndex = parseInt(imgEl.dataset.imageIndex, 10);
                            const imgData = images[imageIndex];
                            if (!imgData) continue;

                            const placement = getExactCellPlacementMM(page, cell, paper);
                            const effectiveRotation = parseInt(imgEl.dataset.effectiveRotation, 10) || 0;
                            const fitMode = imgEl.dataset.fitMode || getFitMode();
                            const cacheKey = [
                                imageIndex,
                                placement.widthMM.toFixed(4),
                                placement.heightMM.toFixed(4),
                                dpi,
                                effectiveRotation,
                                fitMode,
                                imgData.flipH ? 1 : 0,
                                imgData.flipV ? 1 : 0,
                                imgData.dataUrl.length
                            ].join('|');

                            let imageData = imageCache.get(cacheKey);
                            if (!imageData) {
                                imageData = await createExactPDFImageData(
                                    imgData,
                                    placement.widthMM,
                                    placement.heightMM,
                                    dpi,
                                    effectiveRotation,
                                    fitMode
                                );
                                imageCache.set(cacheKey, imageData);
                            }

                            pdf.addImage(
                                imageData,
                                'JPEG',
                                placement.xMM,
                                placement.yMM,
                                placement.widthMM,
                                placement.heightMM,
                                `ps_${cacheKey}`,
                                'FAST'
                            );
                            drawPDFCellDecorations(
                                pdf,
                                cell,
                                placement,
                                parseInt(cell.dataset.globalIndex, 10) || 0
                            );
                        }
                    }

                    pdf.save('PDF_PrinterPro.pdf');
                    toast('success', `✓ PDF exacto exportado · ${pages.length} página(s). Imprime en Tamaño real / 100%.`);
                } catch (err) {
                    console.error('Error PDF:', err);
                    toast('error', 'Error al generar el PDF exacto. Revisa que todas las imágenes hayan cargado correctamente.');
                } finally {
                    hideLoader();
                    btnExportPDF.disabled = false;
                    btnExportPDF.textContent = '📄 Exportar PDF real';
                }
            });

            function showLoader(msg) { loaderMsg.textContent = msg || '';
                loader.classList.add('on'); }

            function setLoaderMsg(msg) { loaderMsg.textContent = msg; }

            function hideLoader() { loader.classList.remove('on'); }

            function toast(type, msg) {
                const el = document.createElement('div');
                el.className = `toast ${type}`;
                el.textContent = msg;
                document.getElementById('toasts').appendChild(el);
                setTimeout(() => { el.style.transition = 'opacity .3s';
                    el.style.opacity = '0';
                    setTimeout(() => el.remove(), 300); }, 3600);
            }

            function init() {
                // Cada vez que se abre el HTML se descarta cualquier configuración guardada,
                // así la app siempre inicia con los valores predeterminados de fábrica.
                localStorage.removeItem('printstudio_config');
                loadAllConfig();
                rootStyle.setProperty('--guide-color', hexToRgba(document.getElementById('guideColor').value, 0.45));
                rootStyle.setProperty('--preview-zoom', (parseInt(zoomSlider.value) || 78) / 100);
                zoomVal.textContent = (parseInt(zoomSlider.value) || 78) + '%';
                updateViability();
                updateTotalPrints();
                updateCredDispUI();
                updateCredScaleUI();
                updateLayoutModeUI();
                updateAdvancedUI();
                updateMosaicCellSize();
                if (currentPreset === 'credencial') document.getElementById('credencialOpts').style.display = 'flex';
                if (currentPreset === 'infantil') document.getElementById('infantilOpts').style.display = 'flex';
            }
            init();
        })();

// ---- Bloque principal 2 ----
    (function () {
        'use strict';

        /* ============================================================
           UTILIDADES COMPARTIDAS (independientes del IIFE principal)
           ============================================================ */
        function toast(type, msg) {
            const holder = document.getElementById('toasts');
            if (!holder) return;
            const el = document.createElement('div');
            el.className = `toast ${type}`;
            el.textContent = msg;
            holder.appendChild(el);
            setTimeout(() => {
                el.style.transition = 'opacity .3s';
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 300);
            }, 3600);
        }
        function showLoader(msg) {
            const loader = document.getElementById('loader');
            const loaderMsg = document.getElementById('loaderMsg');
            if (loaderMsg) loaderMsg.textContent = msg || '';
            if (loader) loader.classList.add('on');
        }
        function setLoaderMsg(msg) {
            const loaderMsg = document.getElementById('loaderMsg');
            if (loaderMsg) loaderMsg.textContent = msg;
        }
        function hideLoader() {
            const loader = document.getElementById('loader');
            if (loader) loader.classList.remove('on');
        }
        function fmtBytes(bytes) {
            if (!bytes && bytes !== 0) return '—';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }
        function downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
        }
        function loadImageFromFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const img = new Image();
                    img.onload = () => resolve({ img, dataUrl: reader.result });
                    img.onerror = () => reject(new Error('No se pudo abrir el archivo como imagen.'));
                    img.src = reader.result;
                };
                reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
                reader.readAsDataURL(file);
            });
        }
        function setupDropzone(zone, input, onFiles) {
            zone.addEventListener('click', () => input.click());
            input.addEventListener('change', () => { if (input.files.length) onFiles(input.files); input.value = ''; });
            ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
                e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover');
            }));
            ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
                e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover');
            }));
            zone.addEventListener('drop', e => {
                if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
            });
        }

        /* ============================================================
           RAIL DE HERRAMIENTAS — CAMBIO DE WORKSPACE
           ============================================================ */
        const workspaces = {
            print: document.getElementById('wsPrint'),
            convert: document.getElementById('wsConvert'),
            curp: document.getElementById('wsCurp'),
            poster: document.getElementById('wsPoster'),
            compress: document.getElementById('wsCompress'),
            img2pdf: document.getElementById('wsImg2Pdf'),
            pdftools: document.getElementById('wsPdfTools'),
            qr: document.getElementById('wsQr')
        };
        document.querySelectorAll('.rail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b === btn));
                Object.entries(workspaces).forEach(([key, el]) => {
                    if (!el) return;
                    el.classList.toggle('hidden', key !== tool);
                });
            });
        });


        /* ============================================================
           CODIFICADORES EXTRA DE IMAGEN (ICO · GIF · TIFF · RAW)
           El canvas del navegador solo sabe exportar PNG/JPG/WebP,
           así que estos formatos se construyen byte a byte aquí.
           ============================================================ */
        const ImageEncoders = (function () {

            /* ---------- ICO (PNG incrustado, compatible Vista+) ---------- */
            async function toIco(canvas) {
                // El formato ICO admite como máximo 256 px por lado.
                const size = Math.min(256, Math.max(canvas.width, canvas.height));
                const side = Math.min(256, size);
                const c = document.createElement('canvas');
                c.width = side; c.height = side;
                const ctx = c.getContext('2d');
                // Se encaja la imagen centrada y proporcionada dentro del cuadrado.
                const r = Math.min(side / canvas.width, side / canvas.height);
                const w = Math.round(canvas.width * r), h = Math.round(canvas.height * r);
                ctx.drawImage(canvas, Math.floor((side - w) / 2), Math.floor((side - h) / 2), w, h);

                const pngBlob = await new Promise(res => c.toBlob(res, 'image/png'));
                const png = new Uint8Array(await pngBlob.arrayBuffer());

                const header = new Uint8Array(22);
                const dv = new DataView(header.buffer);
                dv.setUint16(0, 0, true);            // reservado
                dv.setUint16(2, 1, true);            // tipo 1 = icono
                dv.setUint16(4, 1, true);            // 1 imagen
                header[6] = side >= 256 ? 0 : side;  // ancho (0 = 256)
                header[7] = side >= 256 ? 0 : side;  // alto
                header[8] = 0;                       // colores de paleta
                header[9] = 0;                       // reservado
                dv.setUint16(10, 1, true);           // planos
                dv.setUint16(12, 32, true);          // bits por píxel
                dv.setUint32(14, png.length, true);  // tamaño de los datos
                dv.setUint32(18, 22, true);          // offset de los datos
                return new Blob([header, png], { type: 'image/x-icon' });
            }

            /* ---------- TIFF (baseline, RGB sin comprimir) ---------- */
            function toTiff(canvas) {
                const w = canvas.width, h = canvas.height;
                const rgba = canvas.getContext('2d').getImageData(0, 0, w, h).data;

                // Los píxeles se guardan como RGB de 8 bits; el fondo
                // transparente se compone sobre blanco (TIFF baseline no
                // lleva canal alfa).
                const pixels = new Uint8Array(w * h * 3);
                for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
                    const a = rgba[i + 3] / 255;
                    pixels[j] = Math.round(rgba[i] * a + 255 * (1 - a));
                    pixels[j + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
                    pixels[j + 2] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
                }

                const entries = 12;                       // número de etiquetas IFD
                const ifdSize = 2 + entries * 12 + 4;
                const extra = 6 + 6;                      // BitsPerSample (3×2) + Resolution (2×4)
                const headerSize = 8;
                const pixelOffset = headerSize + ifdSize + extra;
                const total = pixelOffset + pixels.length;

                const buf = new ArrayBuffer(total);
                const dv = new DataView(buf);
                const u8 = new Uint8Array(buf);

                // Cabecera: little-endian, versión 42, offset al primer IFD
                dv.setUint16(0, 0x4949, true);
                dv.setUint16(2, 42, true);
                dv.setUint32(4, headerSize, true);

                const bitsOffset = headerSize + ifdSize;
                const resOffset = bitsOffset + 6;

                let p = headerSize;
                dv.setUint16(p, entries, true); p += 2;
                function tag(id, type, count, value) {
                    dv.setUint16(p, id, true);
                    dv.setUint16(p + 2, type, true);
                    dv.setUint32(p + 4, count, true);
                    // Los valores cortos van alineados al inicio del campo.
                    if (type === 3 && count === 1) dv.setUint16(p + 8, value, true);
                    else dv.setUint32(p + 8, value, true);
                    p += 12;
                }
                tag(256, 3, 1, w);                       // ImageWidth
                tag(257, 3, 1, h);                       // ImageLength
                tag(258, 3, 3, bitsOffset);              // BitsPerSample = 8,8,8
                tag(259, 3, 1, 1);                       // Compression = ninguna
                tag(262, 3, 1, 2);                       // PhotometricInterpretation = RGB
                tag(273, 4, 1, pixelOffset);             // StripOffsets
                tag(277, 3, 1, 3);                       // SamplesPerPixel
                tag(278, 4, 1, h);                       // RowsPerStrip
                tag(279, 4, 1, pixels.length);           // StripByteCounts
                tag(282, 5, 1, resOffset);               // XResolution
                tag(283, 5, 1, resOffset);               // YResolution
                tag(296, 3, 1, 2);                       // ResolutionUnit = pulgadas
                dv.setUint32(p, 0, true);                // no hay más IFDs

                dv.setUint16(bitsOffset, 8, true);
                dv.setUint16(bitsOffset + 2, 8, true);
                dv.setUint16(bitsOffset + 4, 8, true);
                dv.setUint32(resOffset, 72, true);       // 72/1 ppp
                dv.setUint32(resOffset + 4, 1, true);

                u8.set(pixels, pixelOffset);
                return new Blob([buf], { type: 'image/tiff' });
            }

            /* ---------- GIF89a (paleta de 256 por corte mediano + LZW) ---------- */
            function quantize(rgba, maxColors) {
                // Corte mediano: se parte repetidamente la caja de color
                // por su eje más ancho hasta llegar a maxColors cajas.
                const pixels = [];
                for (let i = 0; i < rgba.length; i += 4) {
                    const a = rgba[i + 3] / 255;
                    pixels.push([
                        Math.round(rgba[i] * a + 255 * (1 - a)),
                        Math.round(rgba[i + 1] * a + 255 * (1 - a)),
                        Math.round(rgba[i + 2] * a + 255 * (1 - a))
                    ]);
                }
                let boxes = [pixels];
                while (boxes.length < maxColors) {
                    let target = -1, best = -1;
                    for (let i = 0; i < boxes.length; i++) {
                        if (boxes[i].length < 2) continue;
                        let mn = [255, 255, 255], mx = [0, 0, 0];
                        for (const px of boxes[i]) {
                            for (let c = 0; c < 3; c++) {
                                if (px[c] < mn[c]) mn[c] = px[c];
                                if (px[c] > mx[c]) mx[c] = px[c];
                            }
                        }
                        const range = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
                        if (range > best) { best = range; target = i; }
                    }
                    if (target < 0 || best <= 0) break;
                    const box = boxes[target];
                    let mn = [255, 255, 255], mx = [0, 0, 0];
                    for (const px of box) {
                        for (let c = 0; c < 3; c++) {
                            if (px[c] < mn[c]) mn[c] = px[c];
                            if (px[c] > mx[c]) mx[c] = px[c];
                        }
                    }
                    let axis = 0, span = mx[0] - mn[0];
                    if (mx[1] - mn[1] > span) { axis = 1; span = mx[1] - mn[1]; }
                    if (mx[2] - mn[2] > span) { axis = 2; }
                    box.sort((a, b) => a[axis] - b[axis]);
                    const mid = box.length >> 1;
                    boxes.splice(target, 1, box.slice(0, mid), box.slice(mid));
                }
                const palette = boxes.filter(b => b.length).map(box => {
                    let r = 0, g = 0, bl = 0;
                    for (const px of box) { r += px[0]; g += px[1]; bl += px[2]; }
                    return [Math.round(r / box.length), Math.round(g / box.length), Math.round(bl / box.length)];
                });
                while (palette.length < 2) palette.push([0, 0, 0]);
                return palette;
            }

            function nearestIndex(palette, r, g, b, cache) {
                const key = (r >> 2 << 12) | (g >> 2 << 6) | (b >> 2);
                const hit = cache[key];
                if (hit !== undefined) return hit;
                let best = 0, bestD = Infinity;
                for (let i = 0; i < palette.length; i++) {
                    const dr = palette[i][0] - r, dg = palette[i][1] - g, db = palette[i][2] - b;
                    const d = dr * dr + dg * dg + db * db;
                    if (d < bestD) { bestD = d; best = i; }
                }
                cache[key] = best;
                return best;
            }

            function lzwEncode(indices, minCodeSize) {
                // Compresión LZW tal como la define la especificación GIF.
                const out = [];
                let cur = 0, curBits = 0;
                const clearCode = 1 << minCodeSize;
                const eoiCode = clearCode + 1;
                let codeSize = minCodeSize + 1;
                let next = eoiCode + 1;
                let dict = new Map();

                function emit(code) {
                    cur |= code << curBits;
                    curBits += codeSize;
                    while (curBits >= 8) {
                        out.push(cur & 0xff);
                        cur >>= 8;
                        curBits -= 8;
                    }
                }
                function resetDict() {
                    dict = new Map();
                    codeSize = minCodeSize + 1;
                    next = eoiCode + 1;
                }

                emit(clearCode);
                resetDict();
                let prefix = indices[0];
                for (let i = 1; i < indices.length; i++) {
                    const k = indices[i];
                    const key = prefix * 4096 + k;
                    if (dict.has(key)) {
                        prefix = dict.get(key);
                    } else {
                        emit(prefix);
                        if (next < 4096) {
                            dict.set(key, next++);
                            if (next - 1 === (1 << codeSize) && codeSize < 12) codeSize++;
                        } else {
                            emit(clearCode);
                            resetDict();
                        }
                        prefix = k;
                    }
                }
                emit(prefix);
                emit(eoiCode);
                if (curBits > 0) out.push(cur & 0xff);
                return out;
            }

            function toGif(canvas) {
                const w = canvas.width, h = canvas.height;
                const rgba = canvas.getContext('2d').getImageData(0, 0, w, h).data;
                const palette = quantize(rgba, 256);

                const cache = {};
                const indices = new Uint8Array(w * h);
                for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
                    const a = rgba[i + 3] / 255;
                    const r = Math.round(rgba[i] * a + 255 * (1 - a));
                    const g = Math.round(rgba[i + 1] * a + 255 * (1 - a));
                    const b = Math.round(rgba[i + 2] * a + 255 * (1 - a));
                    indices[j] = nearestIndex(palette, r, g, b, cache);
                }

                // La tabla global de color debe ser potencia de 2.
                let bits = 1;
                while ((1 << bits) < palette.length) bits++;
                const tableSize = 1 << bits;

                const bytes = [];
                const pushStr = s => { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); };
                const push16 = v => { bytes.push(v & 0xff, (v >> 8) & 0xff); };

                pushStr('GIF89a');
                push16(w); push16(h);
                bytes.push(0x80 | ((bits - 1) & 0x07));   // tabla global presente
                bytes.push(0);                            // índice de fondo
                bytes.push(0);                            // relación de aspecto
                for (let i = 0; i < tableSize; i++) {
                    const c = palette[i] || [0, 0, 0];
                    bytes.push(c[0], c[1], c[2]);
                }
                bytes.push(0x2c);                         // descriptor de imagen
                push16(0); push16(0); push16(w); push16(h);
                bytes.push(0);                            // sin tabla local, sin entrelazado

                const minCodeSize = Math.max(2, bits);
                bytes.push(minCodeSize);
                const data = lzwEncode(indices, minCodeSize);
                for (let i = 0; i < data.length; i += 255) {
                    const chunk = data.slice(i, i + 255);
                    bytes.push(chunk.length);
                    for (const b of chunk) bytes.push(b);
                }
                bytes.push(0);                            // fin de los bloques
                bytes.push(0x3b);                         // fin del archivo

                return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
            }

            /* ---------- RAW (volcado de píxeles RGBA de 8 bits) ---------- */
            function toRaw(canvas) {
                // No existe un "RAW" universal: los .CR2/.NEF/.ARW son
                // datos del sensor de cada cámara y no se pueden generar
                // desde una imagen ya revelada. Aquí se entrega el volcado
                // de píxeles sin comprimir (RGBA, 8 bits por canal), que es
                // lo que aceptan editores y herramientas de procesamiento.
                const w = canvas.width, h = canvas.height;
                const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
                return {
                    blob: new Blob([new Uint8Array(data.buffer.slice(0))], { type: 'application/octet-stream' }),
                    width: w,
                    height: h
                };
            }

            return { toIco, toTiff, toGif, toRaw };
        })();

        /* ============================================================
           HERRAMIENTA 1 · CONVERTIDOR DE IMÁGENES (individual o masivo)
           ============================================================ */
        (function convertidorTool() {
            const dz = document.getElementById('cvDropzone');
            const input = document.getElementById('cvFileInput');
            const previewInner = document.getElementById('cvPreviewInner');
            const emptyState = document.getElementById('cvEmptyState');
            const originalInfo = document.getElementById('cvOriginalInfo');
            const outputInfo = document.getElementById('cvOutputInfo');
            const widthInput = document.getElementById('cvWidth');
            const heightInput = document.getElementById('cvHeight');
            const widthLabel = document.getElementById('cvWidthLabel');
            const heightField = document.getElementById('cvHeightField');
            const sizeTip = document.getElementById('cvSizeTip');
            const lockBtn = document.getElementById('cvLockAspect');
            const btnOriginalSize = document.getElementById('cvBtnOriginalSize');
            const btnConvert = document.getElementById('btnCvConvert');
            const qualitySection = document.getElementById('cvQualitySection');
            const qualitySlider = document.getElementById('cvQuality');
            const qualityVal = document.getElementById('cvQualityVal');
            const formatTip = document.getElementById('cvFormatTip');
            const MAX_FILES = 100;
            const MAX_FILE_MB = 30;

            let cvImages = [];   // [{file, img, naturalW, naturalH, name, inputFormat}]
            let batchMode = false;
            // Compatibilidad con el flujo de una sola imagen:
            let cvImg = null, cvFile = null, naturalW = 0, naturalH = 0, lockAspect = true;

            const formatTips = {
                png: 'Sin pérdida, admite transparencia.',
                jpeg: 'Ligero, ideal para fotos. Las zonas transparentes se rellenan de blanco.',
                webp: 'Formato moderno, muy ligero y con buena calidad.',
                svg: 'Incrusta la imagen dentro de un archivo SVG válido (no es un vector trazado).',
                ico: 'Icono para Windows y favicon. Se recorta a un cuadrado de máximo 256 px.',
                gif: 'Paleta de 256 colores. Ideal para gráficos planos; en fotos puede verse con bandas.',
                tiff: 'Sin comprimir y sin pérdida. Archivo pesado, usado en imprenta y archivo.',
                raw: 'Volcado de píxeles RGBA sin comprimir (.raw). No genera archivos de cámara (CR2/NEF/ARW).'
            };
            const INPUT_FORMAT_MAP = {
                'image/jpeg': 'JPG', 'image/jpg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP',
                'image/gif': 'GIF', 'image/bmp': 'BMP', 'image/svg+xml': 'SVG', 'image/avif': 'AVIF',
                'image/tiff': 'TIFF', 'image/x-icon': 'ICO'
            };

            function detectInputFormat(file) {
                if (file.type && INPUT_FORMAT_MAP[file.type]) return INPUT_FORMAT_MAP[file.type];
                const ext = (file.name.split('.').pop() || '').toUpperCase();
                return ext || '—';
            }

            function currentFormat() {
                return document.querySelector('input[name="cvFormat"]:checked').value;
            }

            // Envuelve los codificadores propios (ICO/GIF/TIFF/RAW) y
            // devuelve el blob junto con su extensión y una nota opcional.
            async function encodeSpecial(canvas, fmt) {
                if (fmt === 'ico') return { blob: await ImageEncoders.toIco(canvas), ext: 'ico' };
                if (fmt === 'tiff') return { blob: ImageEncoders.toTiff(canvas), ext: 'tif' };
                if (fmt === 'gif') return { blob: ImageEncoders.toGif(canvas), ext: 'gif' };
                const raw = ImageEncoders.toRaw(canvas);
                return {
                    blob: raw.blob,
                    ext: 'raw',
                    note: `Datos RGBA de 8 bits, ${raw.width} × ${raw.height}. Ábrelo indicando ese tamaño y orden de canales.`
                };
            }
            function updateFormatUI() {
                const fmt = currentFormat();
                formatTip.textContent = formatTips[fmt];
                qualitySection.style.display = (fmt === 'jpeg' || fmt === 'webp') ? 'block' : 'none';
            }
            document.querySelectorAll('input[name="cvFormat"]').forEach(r => r.addEventListener('change', updateFormatUI));
            qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });
            updateFormatUI();

            lockBtn.addEventListener('click', () => {
                lockAspect = !lockAspect;
                lockBtn.classList.toggle('on', lockAspect);
                lockBtn.textContent = lockAspect ? '🔒' : '🔓';
            });
            widthInput.addEventListener('input', () => {
                if (!batchMode && lockAspect && naturalW && naturalH) {
                    const w = parseInt(widthInput.value) || 0;
                    heightInput.value = Math.round(w * (naturalH / naturalW));
                }
            });
            heightInput.addEventListener('input', () => {
                if (!batchMode && lockAspect && naturalW && naturalH) {
                    const h = parseInt(heightInput.value) || 0;
                    widthInput.value = Math.round(h * (naturalW / naturalH));
                }
            });
            btnOriginalSize.addEventListener('click', () => {
                if (batchMode || !naturalW) return;
                widthInput.value = naturalW;
                heightInput.value = naturalH;
            });

            // --- Cambia la UI de "Tamaño" entre modo individual y modo masivo ---
            function updateModeUI() {
                if (batchMode) {
                    widthLabel.textContent = 'Ancho máximo (opcional)';
                    heightField.style.display = 'none';
                    lockBtn.style.display = 'none';
                    btnOriginalSize.style.display = 'none';
                    widthInput.placeholder = 'Sin límite';
                    sizeTip.textContent = 'Se aplica solo si una imagen supera este ancho; cada una conserva su propia proporción. Déjalo vacío para mantener el tamaño original de cada imagen.';
                    btnConvert.textContent = `⬇️ Convertir ${cvImages.length} imágenes y descargar .zip`;
                } else {
                    widthLabel.textContent = 'Ancho';
                    heightField.style.display = '';
                    lockBtn.style.display = '';
                    btnOriginalSize.style.display = '';
                    widthInput.placeholder = 'Ancho';
                    sizeTip.textContent = 'Máximo 8000 px por lado. Con el candado activado, al cambiar un lado se ajusta el otro.';
                    btnConvert.textContent = '⬇️ Convertir y descargar';
                }
            }

            function updateOriginalInfo() {
                if (!cvImages.length) { originalInfo.style.display = 'none'; return; }
                originalInfo.style.display = 'block';
                if (!batchMode) {
                    const it = cvImages[0];
                    originalInfo.innerHTML = `<b>${it.name}</b><br>Formato de entrada: <b>${it.inputFormat}</b> · ${it.naturalW} × ${it.naturalH} px · ${fmtBytes(it.file.size)}`;
                } else {
                    const counts = {};
                    let totalBytes = 0;
                    cvImages.forEach(it => { counts[it.inputFormat] = (counts[it.inputFormat] || 0) + 1; totalBytes += it.file.size; });
                    const fmtList = Object.entries(counts).map(([f, c]) => `${f} (${c})`).join(' · ');
                    originalInfo.innerHTML = `<b>${cvImages.length} imágenes cargadas</b><br>Formato de entrada: ${fmtList}<br>Total: ${fmtBytes(totalBytes)}`;
                }
            }

            function renderSinglePreview() {
                previewInner.innerHTML = '';
                const wrap = document.createElement('div');
                wrap.className = 'curp-canvas-wrap';
                wrap.style.maxWidth = '80vw';
                wrap.style.maxHeight = '80vh';
                const canvas = document.createElement('canvas');
                const maxDim = 640;
                let sw = naturalW, sh = naturalH;
                if (sw > maxDim || sh > maxDim) {
                    const ratio = Math.min(maxDim / sw, maxDim / sh);
                    sw = Math.round(sw * ratio);
                    sh = Math.round(sh * ratio);
                }
                canvas.width = sw; canvas.height = sh;
                canvas.getContext('2d').drawImage(cvImg, 0, 0, sw, sh);
                wrap.appendChild(canvas);
                previewInner.appendChild(wrap);
            }

            function renderBatchGrid() {
                previewInner.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'cv-batch-grid';
                cvImages.forEach((item, idx) => {
                    const cell = document.createElement('div');
                    cell.className = 'cv-batch-item';

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'cv-batch-remove';
                    removeBtn.title = 'Quitar de la lista';
                    removeBtn.textContent = '✕';
                    removeBtn.addEventListener('click', () => removeBatchImage(idx));
                    cell.appendChild(removeBtn);

                    const thumb = document.createElement('div');
                    thumb.className = 'cv-batch-thumb';
                    const imgEl = document.createElement('img');
                    imgEl.src = item.img.src;
                    imgEl.alt = item.name;
                    thumb.appendChild(imgEl);
                    cell.appendChild(thumb);

                    const fmt = document.createElement('span');
                    fmt.className = 'cv-batch-format';
                    fmt.textContent = item.inputFormat;
                    cell.appendChild(fmt);

                    const name = document.createElement('div');
                    name.className = 'cv-batch-name';
                    name.textContent = item.name;
                    cell.appendChild(name);

                    const meta = document.createElement('div');
                    meta.className = 'cv-batch-meta';
                    meta.textContent = `${item.naturalW} × ${item.naturalH} px · ${fmtBytes(item.file.size)}`;
                    cell.appendChild(meta);

                    grid.appendChild(cell);
                });
                previewInner.appendChild(grid);
            }

            function syncSingleFromFirst() {
                cvImg = cvImages[0].img;
                cvFile = cvImages[0].file;
                naturalW = cvImages[0].naturalW;
                naturalH = cvImages[0].naturalH;
                widthInput.value = naturalW;
                heightInput.value = naturalH;
            }

            function removeBatchImage(idx) {
                cvImages.splice(idx, 1);
                if (!cvImages.length) { resetConverterPanel(); return; }
                batchMode = cvImages.length > 1;
                updateModeUI();
                updateOriginalInfo();
                if (batchMode) {
                    renderBatchGrid();
                } else {
                    syncSingleFromFirst();
                    renderSinglePreview();
                }
                toast('info', 'Imagen quitada de la lista.');
            }

            async function handleFiles(fileList) {
                const files = Array.from(fileList);
                if (!files.length) return;
                if (files.length > MAX_FILES) {
                    toast('error', `Máximo ${MAX_FILES} imágenes por conversión. Seleccionaste ${files.length}.`);
                    return;
                }
                showLoader(`Leyendo 1 de ${files.length} imagen(es)…`);
                const loaded = [];
                const rejected = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    setLoaderMsg(`Leyendo ${i + 1} de ${files.length}: ${file.name}`);
                    if (file.size > MAX_FILE_MB * 1024 * 1024) {
                        rejected.push(`${file.name} (supera ${MAX_FILE_MB} MB)`);
                        continue;
                    }
                    try {
                        const { img } = await loadImageFromFile(file);
                        loaded.push({
                            file, img,
                            naturalW: img.naturalWidth,
                            naturalH: img.naturalHeight,
                            name: file.name,
                            inputFormat: detectInputFormat(file)
                        });
                    } catch (err) {
                        rejected.push(file.name);
                    }
                }
                hideLoader();
                if (!loaded.length) {
                    toast('error', 'No se pudo abrir ninguna de las imágenes seleccionadas.');
                    return;
                }
                cvImages = loaded;
                batchMode = cvImages.length > 1;
                dz.classList.add('loaded');
                emptyState.style.display = 'none';
                outputInfo.style.display = 'none';
                btnConvert.disabled = false;
                updateModeUI();
                updateOriginalInfo();
                if (batchMode) {
                    renderBatchGrid();
                } else {
                    syncSingleFromFirst();
                    renderSinglePreview();
                }
                if (rejected.length) {
                    toast('info', `${rejected.length} archivo(s) no se cargaron: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`);
                }
                toast('success', batchMode ? `${cvImages.length} imágenes cargadas.` : 'Imagen cargada. Ajusta el formato y tamaño.');
            }
            setupDropzone(dz, input, handleFiles);

            function resetConverterPanel() {
                cvImg = null; cvFile = null; naturalW = 0; naturalH = 0;
                cvImages = []; batchMode = false;
                lockAspect = true; lockBtn.classList.add('on'); lockBtn.textContent = '🔒';
                dz.classList.remove('loaded');
                previewInner.innerHTML = '';
                emptyState.style.display = '';
                previewInner.appendChild(emptyState);
                originalInfo.style.display = 'none'; originalInfo.innerHTML = '';
                outputInfo.style.display = 'none'; outputInfo.innerHTML = '';
                widthInput.value = ''; heightInput.value = '';
                document.getElementById('cvFmtPng').checked = true;
                updateFormatUI();
                qualitySlider.value = 90; qualityVal.textContent = '90%';
                btnConvert.disabled = true;
                updateModeUI();
            }
            const btnResetConvertPanel = document.getElementById('btnResetConvertPanel');
            if (btnResetConvertPanel) {
                btnResetConvertPanel.addEventListener('click', () => {
                    if (!cvImages.length) { toast('info', 'El panel ya está en sus valores predeterminados.'); return; }
                    if (!confirm('¿Limpiar el panel del convertidor y volver a los valores predeterminados?')) return;
                    resetConverterPanel();
                    toast('info', 'Panel limpiado.');
                });
            }

            function uniqueName(usedSet, base) {
                let name = base, n = 1;
                while (usedSet.has(name)) { name = `${base}-${n++}`; }
                usedSet.add(name);
                return name;
            }

            async function convertSingle() {
                const fmt = currentFormat();
                let w = parseInt(widthInput.value) || naturalW;
                let h = parseInt(heightInput.value) || naturalH;
                w = Math.max(1, Math.min(8000, w));
                h = Math.max(1, Math.min(8000, h));
                btnConvert.disabled = true;
                showLoader('Convirtiendo imagen…');
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
                    ctx.drawImage(cvImg, 0, 0, w, h);

                    const baseName = (cvFile.name || 'imagen').replace(/\.[^.]+$/, '');
                    const quality = (parseInt(qualitySlider.value) || 90) / 100;

                    if (fmt === 'svg') {
                        const pngUrl = canvas.toDataURL('image/png');
                        const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" href="${pngUrl}"/></svg>`;
                        const blob = new Blob([svg], { type: 'image/svg+xml' });
                        downloadBlob(blob, baseName + '.svg');
                        outputInfo.style.display = 'block';
                        outputInfo.innerHTML = `<b>Salida:</b> SVG (imagen incrustada) · ${w} × ${h} px · ${fmtBytes(blob.size)}`;
                        toast('success', '✓ SVG descargado.');
                    } else if (fmt === 'ico' || fmt === 'gif' || fmt === 'tiff' || fmt === 'raw') {
                        const { blob, ext, note } = await encodeSpecial(canvas, fmt);
                        downloadBlob(blob, baseName + '.' + ext);
                        outputInfo.style.display = 'block';
                        outputInfo.innerHTML = `<b>Salida:</b> ${fmt.toUpperCase()} · ${w} × ${h} px · ${fmtBytes(blob.size)}` + (note ? `<br><span style="opacity:.75">${note}</span>` : '');
                        toast('success', '✓ Imagen convertida y descargada.');
                    } else {
                        const mime = fmt === 'jpeg' ? 'image/jpeg' : (fmt === 'webp' ? 'image/webp' : 'image/png');
                        canvas.toBlob(blob => {
                            if (!blob) { toast('error', 'Tu navegador no pudo generar ese formato. Prueba con PNG o JPG.'); return; }
                            const ext = fmt === 'jpeg' ? 'jpg' : fmt;
                            downloadBlob(blob, baseName + '.' + ext);
                            outputInfo.style.display = 'block';
                            outputInfo.innerHTML = `<b>Salida:</b> ${fmt.toUpperCase()} · ${w} × ${h} px · ${fmtBytes(blob.size)}`;
                            toast('success', '✓ Imagen convertida y descargada.');
                        }, mime, (fmt === 'jpeg' || fmt === 'webp') ? quality : undefined);
                    }
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo convertir la imagen. Intenta con otro formato.');
                } finally {
                    hideLoader();
                    btnConvert.disabled = false;
                }
            }

            async function convertBatch() {
                if (!window['JSZip']) { toast('error', 'No cargó la librería de compresión .zip.'); return; }
                const fmt = currentFormat();
                const maxW = parseInt(widthInput.value) || 0; // 0 = sin límite
                const quality = (parseInt(qualitySlider.value) || 90) / 100;
                const total = cvImages.length;
                btnConvert.disabled = true;
                const zip = new JSZip();
                const usedNames = new Set();
                let ok = 0, failed = 0;
                try {
                    for (let i = 0; i < total; i++) {
                        const item = cvImages[i];
                        showLoader(`Convirtiendo ${i + 1} de ${total}: ${item.name}`);
                        try {
                            let w = item.naturalW, h = item.naturalH;
                            if (maxW > 0 && w > maxW) {
                                const ratio = maxW / w;
                                w = maxW;
                                h = Math.round(h * ratio);
                            }
                            w = Math.max(1, Math.min(8000, w));
                            h = Math.max(1, Math.min(8000, h));
                            const canvas = document.createElement('canvas');
                            canvas.width = w; canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
                            ctx.drawImage(item.img, 0, 0, w, h);

                            const baseName = uniqueName(usedNames, (item.name || 'imagen').replace(/\.[^.]+$/, ''));
                            if (fmt === 'svg') {
                                const pngUrl = canvas.toDataURL('image/png');
                                const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" href="${pngUrl}"/></svg>`;
                                zip.file(baseName + '.svg', svg);
                            } else if (fmt === 'ico' || fmt === 'gif' || fmt === 'tiff' || fmt === 'raw') {
                                const special = await encodeSpecial(canvas, fmt);
                                zip.file(baseName + '.' + special.ext, special.blob);
                            } else {
                                const mime = fmt === 'jpeg' ? 'image/jpeg' : (fmt === 'webp' ? 'image/webp' : 'image/png');
                                const blob = await new Promise(res => canvas.toBlob(res, mime, (fmt === 'jpeg' || fmt === 'webp') ? quality : undefined));
                                if (!blob) throw new Error('formato no soportado por el navegador');
                                const ext = fmt === 'jpeg' ? 'jpg' : fmt;
                                zip.file(baseName + '.' + ext, blob);
                            }
                            ok++;
                        } catch (err) {
                            console.error(err);
                            failed++;
                        }
                    }
                    if (!ok) { toast('error', 'No se pudo convertir ninguna imagen.'); return; }
                    setLoaderMsg('Generando archivo .zip…');
                    const content = await zip.generateAsync({ type: 'blob' });
                    const stamp = new Date().toISOString().slice(0, 10);
                    downloadBlob(content, `imagenes-convertidas-${fmt}-${stamp}.zip`);
                    outputInfo.style.display = 'block';
                    outputInfo.innerHTML = `<b>Salida:</b> ${ok} imágenes ${fmt.toUpperCase()} en .zip (${fmtBytes(content.size)})` + (failed ? ` · ${failed} no se pudieron convertir` : '');
                    toast('success', `✓ ${ok} imágenes convertidas. ZIP descargado.`);
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo generar el .zip.');
                } finally {
                    hideLoader();
                    btnConvert.disabled = false;
                }
            }

            btnConvert.addEventListener('click', async () => {
                if (!cvImages.length) return;
                if (batchMode) await convertBatch();
                else await convertSingle();
            });

            updateModeUI();
        })();

        /* ============================================================
           HERRAMIENTA 2 · CURP AL 200% (tamaño real)
           ============================================================ */
        (function curpTool() {
            const dz = document.getElementById('curpDropzone');
            const input = document.getElementById('curpFileInput');
            const statusBox = document.getElementById('curpStatus');
            const curpStatusBox = document.getElementById('curpCurpStatus');
            const previewInner = document.getElementById('curpPreviewInner');
            const emptyState = document.getElementById('curpEmptyState');
            const btnAutoDetect = document.getElementById('btnCurpAutoDetect');
            const btnPDF = document.getElementById('btnCurpPDF');
            const btnPNG = document.getElementById('btnCurpPNG');
            const paperSelect = document.getElementById('curpPaper');
            const ocrCheck = document.getElementById('curpOcrCheck');
            const dpiField = document.getElementById('curpDpiField');
            const dpiInput = document.getElementById('curpImgDpi');
            const realSizeInfo = document.getElementById('curpRealSizeInfo');

            const PAPERS = { carta: { w: 27.9, h: 21.6 }, oficio: { w: 35.6, h: 21.6 }, a4: { w: 29.7, h: 21.0 } };
            const PDF_RENDER_SCALE = 2.5; // igual al usado en loadFromPDF: 1 unidad PDF (1/72") * este factor

            // Estructura oficial de la CURP (18 posiciones), usada para validar el OCR del recuadro:
            // 1: 1a letra 1er apellido | 2: 1a vocal interna 1er apellido | 3: 1a letra 2o apellido | 4: 1a letra nombre
            // 5-10: AAMMDD nacimiento | 11: sexo H/M | 12-13: entidad (o NE) | 14-16: 1a consonante interna de apellido/apellido/nombre
            // 17: diferenciador de homonimia (0-9 hasta 1999, A-Z desde 2000) | 18: dígito verificador
            const CURP_REGEX = /[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QO|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d/;

            let sourceCanvas = null;   // canvas con la constancia completa
            let displayCanvas = null;  // canvas visible (escalado para pantalla)
            let displayScale = 1;
            let box = null;            // {x,y,w,h} en coordenadas del sourceCanvas
            let dragState = null;
            let sourceIsPdf = false;
            let ocrRunId = 0;          // evita que una validación OCR vieja pise a una nueva

            if (window['pdfjsLib']) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }

            function currentScale() { return parseFloat(document.querySelector('input[name="curpScale"]:checked').value); }

            // --- Calibración real: píxeles del sourceCanvas por centímetro físico ---
            function getPxPerCm() {
                if (sourceIsPdf) {
                    // 1 unidad PDF = 1/72 pulgada (estándar del formato), sin importar el tamaño de la hoja.
                    return (PDF_RENDER_SCALE * 72) / 2.54;
                }
                let dpi = parseFloat(dpiInput.value);
                if (!dpi || dpi < 30) dpi = 300;
                return dpi / 2.54;
            }

            function updateRealSizeInfo() {
                if (!sourceCanvas || !box) {
                    realSizeInfo.textContent = 'Sube un archivo para calcular el tamaño real del recuadro.';
                    return;
                }
                const pxPerCm = getPxPerCm();
                const wCm = box.w / pxPerCm;
                const hCm = box.h / pxPerCm;
                const scale = currentScale();
                const note = sourceIsPdf
                    ? 'calculado exacto desde el PDF oficial'
                    : 'estimado según el DPI indicado abajo';
                realSizeInfo.innerHTML = `Recuadro real: <b>${wCm.toFixed(1)} × ${hCm.toFixed(1)} cm</b> (${note}).<br>Al ${Math.round(scale * 100)}% se imprimirá a <b>${(wCm * scale).toFixed(1)} × ${(hCm * scale).toFixed(1)} cm</b>.`;
            }
            document.querySelectorAll('input[name="curpScale"]').forEach(r => r.addEventListener('change', updateRealSizeInfo));
            dpiInput.addEventListener('input', updateRealSizeInfo);

            async function handleFiles(files) {
                const file = files[0];
                if (!file) return;
                if (file.size > 15 * 1024 * 1024) { toast('error', 'Archivo demasiado grande (máx. 15 MB).'); return; }
                showLoader('Leyendo en tu navegador…');
                try {
                    sourceIsPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
                    if (sourceIsPdf) {
                        await loadFromPDF(file);
                    } else {
                        await loadFromImage(file);
                    }
                    dpiField.style.display = sourceIsPdf ? 'none' : '';
                    dz.classList.add('loaded');
                    emptyState.style.display = 'none';
                    const detection = detectGreenBox();
                    renderCanvas();
                    updateRealSizeInfo();
                    btnAutoDetect.disabled = false;
                    btnPDF.disabled = false;
                    btnPNG.disabled = false;
                    if (detection.valid) {
                        statusBox.textContent = 'Recuadro verde detectado. Verifica el marco amarillo y descarga.';
                        toast('success', 'Constancia cargada. Recuadro verde detectado.');
                    } else {
                        statusBox.textContent = 'No encontré un recuadro con borde verde institucional. Ajusta el marco amarillo a mano.';
                        toast('info', 'Constancia cargada. Ajusta el recuadro a mano.');
                    }
                    runCurpOcrValidation();
                } catch (err) {
                    console.error(err);
                    toast('error', err.message || 'No pude abrir ese archivo. Prueba exportarlo a PNG.');
                    statusBox.textContent = 'No pude abrir ese archivo. Prueba exportarlo a PNG.';
                } finally {
                    hideLoader();
                }
            }
            setupDropzone(dz, input, handleFiles);

            function resetCurpPanel() {
                sourceCanvas = null; displayCanvas = null; displayScale = 1; box = null; dragState = null;
                sourceIsPdf = false; ocrRunId++;
                dz.classList.remove('loaded');
                previewInner.innerHTML = '';
                emptyState.style.display = '';
                previewInner.appendChild(emptyState);
                statusBox.textContent = 'Esperando archivo. Nada se envía al servidor: todo se procesa en tu navegador.';
                curpStatusBox.style.display = 'none';
                curpStatusBox.textContent = '';
                btnAutoDetect.disabled = true;
                btnPDF.disabled = true;
                btnPNG.disabled = true;
                document.getElementById('curpS100').checked = true;
                document.getElementById('curpExpand').checked = false;
                paperSelect.value = 'carta';
                dpiInput.value = 300;
                dpiField.style.display = 'none';
                updateRealSizeInfo();
            }
            const btnResetCurpPanel = document.getElementById('btnResetCurpPanel');
            if (btnResetCurpPanel) {
                btnResetCurpPanel.addEventListener('click', () => {
                    if (!sourceCanvas) { toast('info', 'El panel ya está en sus valores predeterminados.'); return; }
                    if (!confirm('¿Limpiar el panel de CURP y volver a los valores predeterminados?')) return;
                    resetCurpPanel();
                    toast('info', 'Panel limpiado.');
                });
            }

            async function loadFromImage(file) {
                const { img } = await loadImageFromFile(file);
                sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = img.naturalWidth;
                sourceCanvas.height = img.naturalHeight;
                sourceCanvas.getContext('2d').drawImage(img, 0, 0);
            }

            async function loadFromPDF(file) {
                if (!window['pdfjsLib']) throw new Error('No cargó PDF.js.');
                const buf = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
                sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = viewport.width;
                sourceCanvas.height = viewport.height;
                await page.render({ canvasContext: sourceCanvas.getContext('2d'), viewport }).promise;
            }

            // --- Detección de recuadro VERDE (borde, no relleno) ---
            function isGreenPixel(r, g, b) {
                return g > 90 && g - r > 30 && g - b > 20;
            }

            function detectGreenBox() {
                const w = sourceCanvas.width, h = sourceCanvas.height;
                const ctx = sourceCanvas.getContext('2d');
                const data = ctx.getImageData(0, 0, w, h).data;
                let minX = w, minY = h, maxX = 0, maxY = 0, hits = 0;
                const step = 2; // muestreo para rendimiento
                for (let y = 0; y < h; y += step) {
                    for (let x = 0; x < w; x += step) {
                        const i = (y * w + x) * 4;
                        if (isGreenPixel(data[i], data[i + 1], data[i + 2])) {
                            hits++;
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
                const minHits = (w * h) / (step * step) * 0.002;
                const fallback = () => {
                    box = { x: w * 0.15, y: h * 0.08, w: w * 0.7, h: h * 0.35 };
                    return { valid: false };
                };
                if (hits < minHits || maxX <= minX || maxY <= minY) return fallback();

                const tight = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
                if (tight.w < 20 || tight.h < 20) return fallback();

                // 1) El borde debe trazar un rectángulo verde (no un blob relleno ni ruido disperso)
                const band = Math.max(2, Math.round(Math.min(tight.w, tight.h) * 0.03));
                const perimeterRatio = greenRatioAlongPerimeter(data, w, h, tight, band, step);
                // 2) El interior (bien adentro del borde) debe ser mayormente blanco/claro, no verde relleno
                const interiorRatio = greenRatioInterior(data, w, h, tight, band, step);
                // 3) Proporción tipo credencial (ancho/alto), como el recuadro oficial de CURP
                const aspect = tight.w / tight.h;

                const valid = perimeterRatio > 0.22 && interiorRatio < 0.15 && aspect > 1.2 && aspect < 2.6;
                if (!valid) return fallback();

                const pad = Math.round(band * 1.5);
                box = {
                    x: Math.max(0, tight.x - pad),
                    y: Math.max(0, tight.y - pad),
                    w: Math.min(w - Math.max(0, tight.x - pad), tight.w + pad * 2),
                    h: Math.min(h - Math.max(0, tight.y - pad), tight.h + pad * 2)
                };
                return { valid: true };
            }

            function greenRatioAlongPerimeter(data, w, h, r, band, step) {
                let total = 0, green = 0;
                const checkPixel = (x, y) => {
                    if (x < 0 || y < 0 || x >= w || y >= h) return;
                    const i = (Math.round(y) * w + Math.round(x)) * 4;
                    total++;
                    if (isGreenPixel(data[i], data[i + 1], data[i + 2])) green++;
                };
                for (let x = r.x; x <= r.x + r.w; x += step) {
                    for (let b = 0; b < band; b++) { checkPixel(x, r.y + b); checkPixel(x, r.y + r.h - b); }
                }
                for (let y = r.y; y <= r.y + r.h; y += step) {
                    for (let b = 0; b < band; b++) { checkPixel(r.x + b, y); checkPixel(r.x + r.w - b, y); }
                }
                return total ? green / total : 0;
            }

            function greenRatioInterior(data, w, h, r, band, step) {
                const inset = band * 3;
                const ix = r.x + inset, iy = r.y + inset;
                const iw = r.w - inset * 2, ih = r.h - inset * 2;
                if (iw <= 0 || ih <= 0) return 0;
                let total = 0, green = 0;
                for (let y = iy; y < iy + ih; y += step * 2) {
                    for (let x = ix; x < ix + iw; x += step * 2) {
                        const i = (Math.round(y) * w + Math.round(x)) * 4;
                        total++;
                        if (isGreenPixel(data[i], data[i + 1], data[i + 2])) green++;
                    }
                }
                return total ? green / total : 0;
            }

            btnAutoDetect.addEventListener('click', () => {
                const detection = detectGreenBox();
                renderCanvas();
                updateRealSizeInfo();
                if (detection.valid) {
                    statusBox.textContent = 'Recuadro verde detectado. Verifica el marco amarillo y descarga.';
                } else {
                    statusBox.textContent = 'No encontré un recuadro con borde verde institucional. Ajusta el marco amarillo a mano.';
                }
                runCurpOcrValidation();
            });

            // --- Validación de estructura de CURP mediante OCR (opcional, con internet) ---
            async function runCurpOcrValidation() {
                curpStatusBox.style.display = 'none';
                curpStatusBox.textContent = '';
                if (!ocrCheck.checked || !sourceCanvas || !box) return;
                const myRun = ++ocrRunId;
                curpStatusBox.style.display = '';
                curpStatusBox.textContent = 'Verificando estructura del CURP (OCR)…';
                try {
                    if (!window.Tesseract) throw new Error('No cargó el motor de OCR.');
                    const crop = cropOnlyCanvas();
                    const dataUrl = crop.toDataURL('image/png');
                    const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng', { logger: () => {} });
                    if (myRun !== ocrRunId) return; // el usuario ya cambió el recorte, descarta este resultado
                    const clean = (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    const match = clean.match(CURP_REGEX);
                    if (match) {
                        curpStatusBox.textContent = `✅ Estructura de CURP confirmada por OCR: ${match[0]}`;
                        curpStatusBox.classList.add('accent');
                    } else {
                        curpStatusBox.textContent = '⚠️ El recorte no coincide con la estructura oficial de 18 posiciones de la CURP. Ajusta el marco amarillo para que cubra solo la clave.';
                        curpStatusBox.classList.remove('accent');
                    }
                } catch (err) {
                    if (myRun !== ocrRunId) return;
                    console.error(err);
                    curpStatusBox.textContent = 'No se pudo verificar la estructura por OCR (revisa tu conexión a internet). El recuadro verde sigue disponible para ajustar a mano.';
                    curpStatusBox.classList.remove('accent');
                }
            }
            ocrCheck.addEventListener('change', () => { if (ocrCheck.checked) runCurpOcrValidation(); else { curpStatusBox.style.display = 'none'; } });

            function renderCanvas() {
                previewInner.innerHTML = '';
                const wrap = document.createElement('div');
                wrap.className = 'curp-canvas-wrap';
                wrap.style.maxWidth = '80vw';
                wrap.style.maxHeight = '78vh';

                displayCanvas = document.createElement('canvas');
                const maxDim = 760;
                displayScale = Math.min(1, maxDim / Math.max(sourceCanvas.width, sourceCanvas.height));
                displayCanvas.width = Math.round(sourceCanvas.width * displayScale);
                displayCanvas.height = Math.round(sourceCanvas.height * displayScale);
                displayCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
                wrap.appendChild(displayCanvas);

                const boxEl = document.createElement('div');
                boxEl.className = 'crop-box';
                boxEl.id = 'curpCropBox';
                ['nw', 'ne', 'sw', 'se'].forEach(h => {
                    const handle = document.createElement('span');
                    handle.className = 'crop-handle';
                    handle.dataset.h = h;
                    boxEl.appendChild(handle);
                });
                wrap.appendChild(boxEl);
                previewInner.appendChild(wrap);
                positionBoxEl();
                attachBoxDrag(boxEl, wrap);
            }

            function positionBoxEl() {
                const boxEl = document.getElementById('curpCropBox');
                if (!boxEl) return;
                boxEl.style.left = (box.x * displayScale) + 'px';
                boxEl.style.top = (box.y * displayScale) + 'px';
                boxEl.style.width = (box.w * displayScale) + 'px';
                boxEl.style.height = (box.h * displayScale) + 'px';
                updateRealSizeInfo();
            }

            function attachBoxDrag(boxEl, wrap) {
                boxEl.addEventListener('pointerdown', e => {
                    const handle = e.target.dataset && e.target.dataset.h;
                    dragState = {
                        mode: handle || 'move',
                        startX: e.clientX, startY: e.clientY,
                        orig: { ...box }
                    };
                    boxEl.setPointerCapture(e.pointerId);
                    e.stopPropagation();
                });
                boxEl.addEventListener('pointermove', e => {
                    if (!dragState) return;
                    const dx = (e.clientX - dragState.startX) / displayScale;
                    const dy = (e.clientY - dragState.startY) / displayScale;
                    const o = dragState.orig;
                    const w = sourceCanvas.width, h = sourceCanvas.height;
                    if (dragState.mode === 'move') {
                        box.x = Math.max(0, Math.min(w - o.w, o.x + dx));
                        box.y = Math.max(0, Math.min(h - o.h, o.y + dy));
                    } else {
                        let { x, y, w: bw, h: bh } = o;
                        if (dragState.mode.includes('n')) { y = o.y + dy; bh = o.h - dy; }
                        if (dragState.mode.includes('s')) { bh = o.h + dy; }
                        if (dragState.mode.includes('w')) { x = o.x + dx; bw = o.w - dx; }
                        if (dragState.mode.includes('e')) { bw = o.w + dx; }
                        if (bw > 20 && bh > 20) { box = { x: Math.max(0, x), y: Math.max(0, y), w: bw, h: bh }; }
                    }
                    positionBoxEl();
                });
                boxEl.addEventListener('pointerup', () => { dragState = null; runCurpOcrValidation(); });
                boxEl.addEventListener('pointercancel', () => { dragState = null; });
            }

            function buildOutputCanvas() {
                const paper = PAPERS[paperSelect.value];
                const scale = currentScale();
                const expand = document.getElementById('curpExpand').checked;
                const dpi = 220;
                const pageWpx = Math.round(paper.w / 2.54 * dpi);
                const pageHpx = Math.round(paper.h / 2.54 * dpi);
                const out = document.createElement('canvas');
                out.width = pageWpx; out.height = pageHpx;
                const ctx = out.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pageWpx, pageHpx);

                const marginPx = Math.round(0.4 / 2.54 * dpi);
                const cropAspect = box.w / box.h;
                let drawW, drawH;
                if (expand) {
                    drawW = pageWpx - marginPx * 2;
                    drawH = pageHpx - marginPx * 2;
                } else {
                    // Tamaño REAL del recuadro (calibrado desde el PDF o el DPI indicado), multiplicado por el % elegido.
                    const pxPerCm = getPxPerCm();
                    const boxRealWCm = box.w / pxPerCm;
                    const baseWpx = (boxRealWCm / 2.54) * dpi * scale;
                    drawW = Math.min(baseWpx, pageWpx - marginPx * 2);
                    drawH = drawW / cropAspect;
                    if (drawH > pageHpx - marginPx * 2) {
                        drawH = pageHpx - marginPx * 2;
                        drawW = drawH * cropAspect;
                    }
                }
                const dx = (pageWpx - drawW) / 2;
                const dy = (pageHpx - drawH) / 2;
                ctx.drawImage(sourceCanvas, box.x, box.y, box.w, box.h, dx, dy, drawW, drawH);
                return { out, paper, cropCanvasOnly: cropOnlyCanvas() };
            }

            function cropOnlyCanvas() {
                const c = document.createElement('canvas');
                c.width = Math.round(box.w); c.height = Math.round(box.h);
                c.getContext('2d').drawImage(sourceCanvas, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);
                return c;
            }

            btnPDF.addEventListener('click', async () => {
                if (!sourceCanvas || !box) return;
                btnPDF.disabled = true;
                showLoader('Generando PDF del CURP…');
                try {
                    const { out, paper } = buildOutputCanvas();
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF({ orientation: 'landscape', unit: 'cm', format: [paper.w, paper.h], compress: true });
                    const imgData = out.toDataURL('image/jpeg', 0.95);
                    pdf.addImage(imgData, 'JPEG', 0, 0, paper.w, paper.h, undefined, 'FAST');
                    pdf.save('CURP-recuadro.pdf');
                    toast('success', 'PDF listo: CURP-recuadro.pdf');
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo generar el PDF.');
                } finally {
                    hideLoader();
                    btnPDF.disabled = false;
                }
            });

            btnPNG.addEventListener('click', () => {
                if (!sourceCanvas || !box) return;
                const crop = cropOnlyCanvas();
                crop.toBlob(blob => {
                    downloadBlob(blob, 'CURP-recuadro.png');
                    toast('success', 'PNG listo: CURP-recuadro.png');
                }, 'image/png');
            });
        })();

        /* ============================================================
           HERRAMIENTA 3 · POSTER GIGANTE DIVIDIDO EN HOJAS CARTA
           ============================================================ */
        (function posterTool() {
            const dz = document.getElementById('posterDropzone');
            const input = document.getElementById('posterFileInput');
            const previewInner = document.getElementById('posterPreviewInner');
            const emptyState = document.getElementById('posterEmptyState');
            const wInput = document.getElementById('posterW');
            const hInput = document.getElementById('posterH');
            const lockBtn = document.getElementById('posterLockAspect');
            const orientV = document.getElementById('posterOrientV');
            const orientH = document.getElementById('posterOrientH');
            const overlapInput = document.getElementById('posterOverlap');
            const marginInput = document.getElementById('posterMargin');
            const infoBox = document.getElementById('posterInfo');
            const btnPreview = document.getElementById('btnPosterPreview');
            const btnPDF = document.getElementById('btnPosterPDF');
            const btnPrint = document.getElementById('btnPosterPrint');

            const LETTER = { w: 21.6, h: 27.9 };
            let posterImg = null, naturalW = 0, naturalH = 0, lockAspect = true, orientation = 'v';
            let grid = null; // {cols, rows, tileUsableW, tileUsableH, pageW, pageH, margin, overlap}

            lockBtn.addEventListener('click', () => {
                lockAspect = !lockAspect;
                lockBtn.classList.toggle('on', lockAspect);
                lockBtn.textContent = lockAspect ? '🔒' : '🔓';
            });
            wInput.addEventListener('input', () => {
                if (lockAspect && naturalW && naturalH) {
                    const w = parseFloat(wInput.value) || 0;
                    hInput.value = (w * (naturalH / naturalW)).toFixed(1);
                }
                updateInfo();
            });
            hInput.addEventListener('input', () => {
                if (lockAspect && naturalW && naturalH) {
                    const h = parseFloat(hInput.value) || 0;
                    wInput.value = (h * (naturalW / naturalH)).toFixed(1);
                }
                updateInfo();
            });
            [overlapInput, marginInput].forEach(el => el.addEventListener('input', updateInfo));
            orientV.addEventListener('click', () => { orientation = 'v'; orientV.classList.add('active'); orientH.classList.remove('active'); updateInfo(); });
            orientH.addEventListener('click', () => { orientation = 'h'; orientH.classList.add('active'); orientV.classList.remove('active'); updateInfo(); });

            function pageDims() {
                return orientation === 'v' ? { w: LETTER.w, h: LETTER.h } : { w: LETTER.h, h: LETTER.w };
            }

            function computeGrid() {
                const posterW = parseFloat(wInput.value) || 0;
                const posterH = parseFloat(hInput.value) || 0;
                const overlap = parseFloat(overlapInput.value) || 0;
                const margin = parseFloat(marginInput.value) || 0;
                const page = pageDims();
                const tileUsableW = page.w - margin * 2;
                const tileUsableH = page.h - margin * 2;
                if (posterW <= 0 || posterH <= 0 || tileUsableW <= overlap || tileUsableH <= overlap) return null;
                const stepW = tileUsableW - overlap;
                const stepH = tileUsableH - overlap;
                const cols = Math.max(1, Math.ceil((posterW - overlap) / stepW));
                const rows = Math.max(1, Math.ceil((posterH - overlap) / stepH));
                return { cols, rows, tileUsableW, tileUsableH, page, margin, overlap, posterW, posterH, stepW, stepH };
            }

            function updateInfo() {
                grid = computeGrid();
                if (!naturalW) {
                    infoBox.textContent = 'Sube una imagen para calcular las hojas necesarias.';
                    return;
                }
                if (!grid) {
                    infoBox.textContent = 'Revisa las medidas: el traslape no puede ser mayor que el área útil de la hoja.';
                    return;
                }
                infoBox.innerHTML = `<b>${grid.cols} × ${grid.rows}</b> = <b>${grid.cols * grid.rows} hoja(s)</b> tamaño carta (${grid.page.w.toFixed(1)} × ${grid.page.h.toFixed(1)} cm) para un póster final de ${grid.posterW.toFixed(1)} × ${grid.posterH.toFixed(1)} cm.`;
                btnPreview.disabled = false;
            }

            async function handleFiles(files) {
                const file = files[0];
                if (!file) return;
                try {
                    const { img } = await loadImageFromFile(file);
                    posterImg = img;
                    naturalW = img.naturalWidth; naturalH = img.naturalHeight;
                    if (!wInput.value) wInput.value = 60;
                    hInput.value = (parseFloat(wInput.value) * (naturalH / naturalW)).toFixed(1);
                    dz.classList.add('loaded');
                    emptyState.style.display = 'none';
                    showSourcePreview();
                    updateInfo();
                    toast('success', 'Imagen cargada. Define las medidas y genera la vista previa.');
                } catch (err) {
                    toast('error', err.message || 'No se pudo abrir la imagen.');
                }
            }
            setupDropzone(dz, input, handleFiles);

            // Muestra la imagen cargada, ajustada en proporción al panel, antes de definir medidas.
            function showSourcePreview() {
                previewInner.innerHTML = '';
                if (!posterImg) return;
                const wrap = document.createElement('div');
                wrap.className = 'poster-canvas-wrap poster-source-wrap';
                const imgEl = document.createElement('img');
                imgEl.className = 'poster-source-img';
                imgEl.src = posterImg.src;
                imgEl.alt = 'Imagen del póster';
                imgEl.draggable = false;
                wrap.appendChild(imgEl);
                previewInner.appendChild(wrap);

                const caption = document.createElement('div');
                caption.className = 'tip';
                caption.style.marginTop = '8px';
                caption.textContent = `Imagen cargada (${naturalW} × ${naturalH} px). Define las medidas finales y pulsa «Generar vista previa» para ver la división en hojas.`;
                previewInner.appendChild(caption);
            }

            function resetPosterPanel() {
                posterImg = null; naturalW = 0; naturalH = 0; grid = null;
                lockAspect = true; lockBtn.classList.add('on'); lockBtn.textContent = '🔒';
                orientation = 'v'; orientV.classList.add('active'); orientH.classList.remove('active');
                dz.classList.remove('loaded');
                previewInner.innerHTML = '';
                emptyState.style.display = '';
                previewInner.appendChild(emptyState);
                wInput.value = 60; hInput.value = 90;
                overlapInput.value = 0; marginInput.value = 0.4;
                infoBox.textContent = 'Sube una imagen para calcular las hojas necesarias.';
                btnPreview.disabled = true; btnPDF.disabled = true; btnPrint.disabled = true;
            }
            const btnResetPosterPanel = document.getElementById('btnResetPosterPanel');
            if (btnResetPosterPanel) {
                btnResetPosterPanel.addEventListener('click', () => {
                    if (!posterImg) { toast('info', 'El panel ya está en sus valores predeterminados.'); return; }
                    if (!confirm('¿Limpiar el panel del póster y volver a los valores predeterminados?')) return;
                    resetPosterPanel();
                    toast('info', 'Panel limpiado.');
                });
            }

            function tileSourceRect(r, c) {
                // Devuelve el recorte (en px de la imagen original) que corresponde a la hoja (r,c)
                const xCm = c * grid.stepW;
                const yCm = r * grid.stepH;
                const wCm = Math.min(grid.tileUsableW, grid.posterW - xCm);
                const hCm = Math.min(grid.tileUsableH, grid.posterH - yCm);
                const pxPerCmX = naturalW / grid.posterW;
                const pxPerCmY = naturalH / grid.posterH;
                return {
                    sx: xCm * pxPerCmX, sy: yCm * pxPerCmY,
                    sw: wCm * pxPerCmX, sh: hCm * pxPerCmY,
                    wCm, hCm
                };
            }

            function renderPreview() {
                previewInner.innerHTML = '';
                if (!grid || !posterImg) return;

                // Miniatura completa con cuadrícula
                const maxDim = 460;
                const ratio = Math.min(maxDim / naturalW, maxDim / naturalH, 1);
                const mini = document.createElement('canvas');
                mini.width = Math.round(naturalW * ratio);
                mini.height = Math.round(naturalH * ratio);
                const ctx = mini.getContext('2d');
                ctx.drawImage(posterImg, 0, 0, mini.width, mini.height);
                ctx.strokeStyle = 'rgba(91,110,245,.9)';
                ctx.lineWidth = 2;
                ctx.font = 'bold 11px Sora, sans-serif';
                ctx.fillStyle = 'rgba(91,110,245,.95)';
                for (let r = 0; r < grid.rows; r++) {
                    for (let c = 0; c < grid.cols; c++) {
                        const t = tileSourceRect(r, c);
                        const x = t.sx * ratio, y = t.sy * ratio, w = t.sw * ratio, h = t.sh * ratio;
                        ctx.strokeRect(x, y, w, h);
                        ctx.fillText(`${r + 1}-${c + 1}`, x + 4, y + 13);
                    }
                }
                const wrap = document.createElement('div');
                wrap.className = 'poster-canvas-wrap';
                wrap.appendChild(mini);
                previewInner.appendChild(wrap);

                const caption = document.createElement('div');
                caption.className = 'tip';
                caption.style.marginTop = '8px';
                caption.textContent = `Vista previa: ${grid.cols} × ${grid.rows} hoja(s). Cada recuadro es una hoja carta; los números indican fila-columna.`;
                previewInner.appendChild(caption);

                // Tiras de miniaturas por hoja
                const strip = document.createElement('div');
                strip.className = 'poster-thumbs-strip';
                for (let r = 0; r < grid.rows; r++) {
                    for (let c = 0; c < grid.cols; c++) {
                        const t = tileSourceRect(r, c);
                        const tc = document.createElement('canvas');
                        const tRatio = Math.min(1, 90 / t.sw);
                        tc.width = Math.max(1, Math.round(t.sw * tRatio));
                        tc.height = Math.max(1, Math.round(t.sh * tRatio));
                        tc.getContext('2d').drawImage(posterImg, t.sx, t.sy, t.sw, t.sh, 0, 0, tc.width, tc.height);
                        const box = document.createElement('div');
                        box.className = 'poster-tile-thumb';
                        const label = document.createElement('span');
                        label.textContent = `${r + 1}-${c + 1}`;
                        box.appendChild(tc);
                        box.appendChild(label);
                        strip.appendChild(box);
                    }
                }
                previewInner.appendChild(strip);

                btnPDF.disabled = false;
                btnPrint.disabled = false;
            }
            btnPreview.addEventListener('click', renderPreview);

            btnPDF.addEventListener('click', async () => {
                if (!grid || !posterImg) return;
                btnPDF.disabled = true;
                showLoader('Generando PDF del póster…');
                try {
                    const { jsPDF } = window.jspdf;
                    const page = grid.page;
                    const pdf = new jsPDF({ orientation: orientation === 'v' ? 'portrait' : 'landscape', unit: 'cm', format: [page.w, page.h], compress: true });
                    let n = 0;
                    const total = grid.rows * grid.cols;
                    for (let r = 0; r < grid.rows; r++) {
                        for (let c = 0; c < grid.cols; c++) {
                            n++;
                            setLoaderMsg(`Hoja ${n} de ${total}…`);
                            if (n > 1) pdf.addPage([page.w, page.h], orientation === 'v' ? 'portrait' : 'landscape');
                            const t = tileSourceRect(r, c);
                            const tc = document.createElement('canvas');
                            const dpi = 200;
                            tc.width = Math.round(t.wCm / 2.54 * dpi);
                            tc.height = Math.round(t.hCm / 2.54 * dpi);
                            tc.getContext('2d').drawImage(posterImg, t.sx, t.sy, t.sw, t.sh, 0, 0, tc.width, tc.height);
                            const imgData = tc.toDataURL('image/jpeg', 0.92);
                            pdf.addImage(imgData, 'JPEG', grid.margin, grid.margin, t.wCm, t.hCm, undefined, 'FAST');
                            pdf.setFontSize(7);
                            pdf.setTextColor(160);
                            pdf.text(`Hoja ${n}/${total} · fila ${r + 1}, col ${c + 1}`, grid.margin, page.h - 0.15);
                        }
                    }
                    pdf.save('Poster_PrinterPro.pdf');
                    toast('success', `✓ PDF exportado · ${total} hoja(s).`);
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo generar el PDF del póster.');
                } finally {
                    hideLoader();
                    btnPDF.disabled = false;
                }
            });

            btnPrint.addEventListener('click', async () => {
                if (!grid || !posterImg) return;
                showLoader('Preparando páginas de impresión…');
                try {
                    const container = document.getElementById('posterPrintPages');
                    container.innerHTML = '';
                    const page = grid.page;
                    let styleTag = document.getElementById('posterPageStyle');
                    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'posterPageStyle'; document.head.appendChild(styleTag); }
                    styleTag.textContent = `@page { size: ${page.w}cm ${page.h}cm; margin: 0; } #posterPrintPages .poster-page { width:${page.w}cm; height:${page.h}cm; }`;

                    for (let r = 0; r < grid.rows; r++) {
                        for (let c = 0; c < grid.cols; c++) {
                            const t = tileSourceRect(r, c);
                            const dpi = 200;
                            const tc = document.createElement('canvas');
                            tc.width = Math.round(t.wCm / 2.54 * dpi);
                            tc.height = Math.round(t.hCm / 2.54 * dpi);
                            tc.getContext('2d').drawImage(posterImg, t.sx, t.sy, t.sw, t.sh, 0, 0, tc.width, tc.height);

                            const pageDiv = document.createElement('div');
                            pageDiv.className = 'poster-page';
                            const img = document.createElement('img');
                            img.src = tc.toDataURL('image/jpeg', 0.92);
                            img.style.left = grid.margin + 'cm';
                            img.style.top = grid.margin + 'cm';
                            img.style.width = t.wCm + 'cm';
                            img.style.height = t.hCm + 'cm';
                            pageDiv.appendChild(img);
                            container.appendChild(pageDiv);
                        }
                    }
                    document.body.classList.add('printing-poster');
                    setTimeout(() => {
                        hideLoader();
                        window.print();
                        setTimeout(() => document.body.classList.remove('printing-poster'), 500);
                    }, 200);
                } catch (err) {
                    console.error(err);
                    hideLoader();
                    toast('error', 'No se pudieron preparar las páginas de impresión.');
                }
            });
        })();

        /* ============================================================
           HERRAMIENTA · COMPRESOR DE IMÁGENES
           ============================================================ */
        (function compresorTool() {
            const dz = document.getElementById('cpDropzone');
            const input = document.getElementById('cpFileInput');
            const previewInner = document.getElementById('cpPreviewInner');
            const emptyState = document.getElementById('cpEmptyState');
            const originalInfo = document.getElementById('cpOriginalInfo');
            const outputInfo = document.getElementById('cpOutputInfo');
            const btnCompress = document.getElementById('btnCpCompress');
            const manualSection = document.getElementById('cpManualSection');
            const manualDivider = document.getElementById('cpManualDivider');
            const presetTip = document.getElementById('cpPresetTip');
            const qualitySlider = document.getElementById('cpQuality');
            const qualityVal = document.getElementById('cpQualityVal');
            const maxDimInput = document.getElementById('cpMaxDim');
            const MAX_FILES = 100;
            const MAX_FILE_MB = 30;

            const PRESETS = {
                wa: { quality: 60, maxDim: 1280, tip: 'Calidad media y hasta 1280 px de lado largo: ligero para enviar por WhatsApp.' },
                mail: { quality: 75, maxDim: 1920, tip: 'Buen equilibrio entre peso y nitidez, hasta 1920 px de lado largo: ideal para correo.' },
                usb: { quality: 90, maxDim: 0, tip: 'Calidad alta, sin reducir dimensiones: para USB o llevar a imprimir.' },
                custom: { tip: 'Ajusta la calidad y el tamaño máximo a tu gusto.' }
            };

            let cpImages = [];
            let batchMode = false;

            function currentPreset() { return document.querySelector('input[name="cpPreset"]:checked').value; }
            function updatePresetUI() {
                const p = currentPreset();
                presetTip.textContent = PRESETS[p].tip;
                const isCustom = p === 'custom';
                manualSection.style.display = isCustom ? '' : 'none';
                manualDivider.style.display = isCustom ? '' : 'none';
            }
            document.querySelectorAll('input[name="cpPreset"]').forEach(r => r.addEventListener('change', updatePresetUI));
            qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });
            updatePresetUI();

            function getSettings() {
                const p = currentPreset();
                if (p === 'custom') {
                    return {
                        quality: (parseInt(qualitySlider.value) || 70) / 100,
                        maxDim: parseInt(maxDimInput.value) || 0
                    };
                }
                return { quality: PRESETS[p].quality / 100, maxDim: PRESETS[p].maxDim };
            }

            function updateOriginalInfo() {
                if (!cpImages.length) { originalInfo.style.display = 'none'; return; }
                originalInfo.style.display = 'block';
                let totalBytes = 0;
                cpImages.forEach(it => totalBytes += it.file.size);
                if (cpImages.length === 1) {
                    const it = cpImages[0];
                    originalInfo.innerHTML = `<b>${it.name}</b><br>${it.naturalW} × ${it.naturalH} px · ${fmtBytes(it.file.size)}`;
                } else {
                    originalInfo.innerHTML = `<b>${cpImages.length} imágenes cargadas</b><br>Peso total original: ${fmtBytes(totalBytes)}`;
                }
            }

            function renderGrid() {
                previewInner.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'cv-batch-grid';
                cpImages.forEach((item, idx) => {
                    const cell = document.createElement('div');
                    cell.className = 'cv-batch-item';
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'cv-batch-remove';
                    removeBtn.title = 'Quitar de la lista';
                    removeBtn.textContent = '✕';
                    removeBtn.addEventListener('click', () => removeImage(idx));
                    cell.appendChild(removeBtn);
                    const thumb = document.createElement('div');
                    thumb.className = 'cv-batch-thumb';
                    const imgEl = document.createElement('img');
                    imgEl.src = item.img.src;
                    thumb.appendChild(imgEl);
                    cell.appendChild(thumb);
                    const name = document.createElement('div');
                    name.className = 'cv-batch-name';
                    name.textContent = item.name;
                    cell.appendChild(name);
                    const meta = document.createElement('div');
                    meta.className = 'cv-batch-meta';
                    meta.textContent = `${item.naturalW} × ${item.naturalH} px · ${fmtBytes(item.file.size)}`;
                    cell.appendChild(meta);
                    grid.appendChild(cell);
                });
                previewInner.appendChild(grid);
            }

            function renderSingle() {
                previewInner.innerHTML = '';
                const wrap = document.createElement('div');
                wrap.className = 'curp-canvas-wrap';
                wrap.style.maxWidth = '80vw';
                wrap.style.maxHeight = '80vh';
                const canvas = document.createElement('canvas');
                const maxDim = 640;
                const it = cpImages[0];
                let sw = it.naturalW, sh = it.naturalH;
                if (sw > maxDim || sh > maxDim) {
                    const ratio = Math.min(maxDim / sw, maxDim / sh);
                    sw = Math.round(sw * ratio); sh = Math.round(sh * ratio);
                }
                canvas.width = sw; canvas.height = sh;
                canvas.getContext('2d').drawImage(it.img, 0, 0, sw, sh);
                wrap.appendChild(canvas);
                previewInner.appendChild(wrap);
            }

            function removeImage(idx) {
                cpImages.splice(idx, 1);
                if (!cpImages.length) { resetPanel(); return; }
                batchMode = cpImages.length > 1;
                updateOriginalInfo();
                if (batchMode) renderGrid(); else renderSingle();
            }

            async function handleFiles(fileList) {
                const files = Array.from(fileList);
                if (!files.length) return;
                if (files.length > MAX_FILES) {
                    toast('error', `Máximo ${MAX_FILES} imágenes por compresión. Seleccionaste ${files.length}.`);
                    return;
                }
                showLoader(`Leyendo 1 de ${files.length} imagen(es)…`);
                const loaded = [];
                const rejected = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    setLoaderMsg(`Leyendo ${i + 1} de ${files.length}: ${file.name}`);
                    if (file.size > MAX_FILE_MB * 1024 * 1024) { rejected.push(`${file.name} (supera ${MAX_FILE_MB} MB)`); continue; }
                    try {
                        const { img } = await loadImageFromFile(file);
                        loaded.push({ file, img, naturalW: img.naturalWidth, naturalH: img.naturalHeight, name: file.name });
                    } catch (err) { rejected.push(file.name); }
                }
                hideLoader();
                if (!loaded.length) { toast('error', 'No se pudo abrir ninguna de las imágenes seleccionadas.'); return; }
                cpImages = loaded;
                batchMode = cpImages.length > 1;
                dz.classList.add('loaded');
                emptyState.style.display = 'none';
                outputInfo.style.display = 'none';
                btnCompress.disabled = false;
                btnCompress.textContent = batchMode ? `Comprimir ${cpImages.length} imágenes y descargar .zip` : 'Comprimir y descargar';
                updateOriginalInfo();
                if (batchMode) renderGrid(); else renderSingle();
                if (rejected.length) toast('info', `${rejected.length} archivo(s) no se cargaron: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`);
                toast('success', batchMode ? `${cpImages.length} imágenes cargadas.` : 'Imagen cargada.');
            }
            setupDropzone(dz, input, handleFiles);

            function resetPanel() {
                cpImages = []; batchMode = false;
                dz.classList.remove('loaded');
                previewInner.innerHTML = '';
                emptyState.style.display = '';
                previewInner.appendChild(emptyState);
                originalInfo.style.display = 'none'; originalInfo.innerHTML = '';
                outputInfo.style.display = 'none'; outputInfo.innerHTML = '';
                document.getElementById('cpPresWA').checked = true;
                updatePresetUI();
                qualitySlider.value = 70; qualityVal.textContent = '70%';
                maxDimInput.value = '';
                btnCompress.disabled = true;
                btnCompress.textContent = 'Comprimir y descargar';
            }
            const btnResetCompressPanel = document.getElementById('btnResetCompressPanel');
            if (btnResetCompressPanel) {
                btnResetCompressPanel.addEventListener('click', () => {
                    if (!cpImages.length) { toast('info', 'El panel ya está en sus valores predeterminados.'); return; }
                    if (!confirm('¿Limpiar el panel del compresor?')) return;
                    resetPanel();
                    toast('info', 'Panel limpiado.');
                });
            }

            function compressOne(item, settings) {
                return new Promise((resolve) => {
                    let w = item.naturalW, h = item.naturalH;
                    if (settings.maxDim > 0 && Math.max(w, h) > settings.maxDim) {
                        const ratio = settings.maxDim / Math.max(w, h);
                        w = Math.round(w * ratio); h = Math.round(h * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(item.img, 0, 0, w, h);
                    canvas.toBlob(blob => resolve(blob), 'image/jpeg', settings.quality);
                });
            }

            function uniqueName(usedSet, base) {
                let name = base, n = 1;
                while (usedSet.has(name)) { name = `${base}-${n++}`; }
                usedSet.add(name);
                return name;
            }

            btnCompress.addEventListener('click', async () => {
                if (!cpImages.length) return;
                const settings = getSettings();
                btnCompress.disabled = true;
                try {
                    if (!batchMode) {
                        showLoader('Comprimiendo imagen…');
                        const item = cpImages[0];
                        const blob = await compressOne(item, settings);
                        const originalSize = item.file.size;
                        const pct = originalSize ? Math.round((1 - blob.size / originalSize) * 100) : 0;
                        const baseName = (item.name || 'imagen').replace(/\.[^.]+$/, '');
                        downloadBlob(blob, baseName + '-comprimida.jpg');
                        outputInfo.style.display = 'block';
                        outputInfo.innerHTML = `<b>Salida:</b> ${fmtBytes(blob.size)} (antes ${fmtBytes(originalSize)})` + (pct > 0 ? ` · ${pct}% más ligera` : '');
                        toast('success', '✓ Imagen comprimida y descargada.');
                    } else {
                        if (!window['JSZip']) { toast('error', 'No cargó la librería de compresión .zip.'); return; }
                        const zip = new JSZip();
                        const usedNames = new Set();
                        let ok = 0, originalTotal = 0, resultTotal = 0;
                        for (let i = 0; i < cpImages.length; i++) {
                            const item = cpImages[i];
                            showLoader(`Comprimiendo ${i + 1} de ${cpImages.length}: ${item.name}`);
                            try {
                                const blob = await compressOne(item, settings);
                                const baseName = uniqueName(usedNames, (item.name || 'imagen').replace(/\.[^.]+$/, ''));
                                zip.file(baseName + '.jpg', blob);
                                ok++; originalTotal += item.file.size; resultTotal += blob.size;
                            } catch (err) { console.error(err); }
                        }
                        if (!ok) { toast('error', 'No se pudo comprimir ninguna imagen.'); return; }
                        setLoaderMsg('Generando archivo .zip…');
                        const content = await zip.generateAsync({ type: 'blob' });
                        const stamp = new Date().toISOString().slice(0, 10);
                        downloadBlob(content, `imagenes-comprimidas-${stamp}.zip`);
                        const pct = originalTotal ? Math.round((1 - resultTotal / originalTotal) * 100) : 0;
                        outputInfo.style.display = 'block';
                        outputInfo.innerHTML = `<b>Salida:</b> ${ok} imágenes en .zip (${fmtBytes(content.size)}, antes ${fmtBytes(originalTotal)})` + (pct > 0 ? ` · ${pct}% más ligero` : '');
                        toast('success', `✓ ${ok} imágenes comprimidas. ZIP descargado.`);
                    }
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo comprimir. Intenta con otra imagen.');
                } finally {
                    hideLoader();
                    btnCompress.disabled = false;
                }
            });
        })();

        /* ============================================================
           HERRAMIENTA · IMÁGENES A PDF
           ============================================================ */
        (function img2pdfTool() {
            const dz = document.getElementById('i2pDropzone');
            const input = document.getElementById('i2pFileInput');
            const previewInner = document.getElementById('i2pPreviewInner');
            const emptyState = document.getElementById('i2pEmptyState');
            const originalInfo = document.getElementById('i2pOriginalInfo');
            const outputInfo = document.getElementById('i2pOutputInfo');
            const btnBuild = document.getElementById('btnI2pBuild');
            const paperSelect = document.getElementById('i2pPaper');
            const fitTip = document.getElementById('i2pFitTip');
            const MAX_FILES = 100;
            const MAX_FILE_MB = 30;
            const PAPERS = {
                carta: { w: 21.6, h: 27.9 }, oficio: { w: 21.6, h: 35.6 },
                a4: { w: 21.0, h: 29.7 }, doble: { w: 27.9, h: 43.2 }
            };
            const FIT_TIPS = {
                contain: 'La imagen se ve completa, con un margen blanco alrededor si su proporción no coincide con la hoja.',
                cover: 'La imagen llena toda la hoja; si su proporción no coincide, se recortan los bordes que sobran.'
            };

            let images = [];

            document.querySelectorAll('input[name="i2pFit"]').forEach(r => r.addEventListener('change', () => {
                fitTip.textContent = FIT_TIPS[document.querySelector('input[name="i2pFit"]:checked').value];
                if (images.length) renderGrid();
            }));
            // Al cambiar el tamaño de hoja, las tarjetas deben reflejar la nueva proporción.
            paperSelect.addEventListener('change', () => { if (images.length) renderGrid(); });

            function updateOriginalInfo() {
                if (!images.length) { originalInfo.style.display = 'none'; return; }
                originalInfo.style.display = 'block';
                let totalBytes = 0;
                images.forEach(it => totalBytes += it.file.size);
                originalInfo.innerHTML = `<b>${images.length} imagen(es)</b> · una página por imagen · ${fmtBytes(totalBytes)} en total`;
            }

            // Cada imagen se muestra tal como quedará en el PDF: una hoja
            // con la proporción real del papel elegido y la imagen encajada
            // según el modo (página completa o llenar la hoja).
            function renderGrid() {
                previewInner.innerHTML = '';
                const paper = PAPERS[paperSelect.value] || PAPERS.carta;
                const fitMode = (document.querySelector('input[name="i2pFit"]:checked') || {}).value || 'contain';

                const grid = document.createElement('div');
                grid.className = 'pdf-page-grid';

                images.forEach((item, idx) => {
                    const card = document.createElement('div');
                    card.className = 'pdf-page-card';

                    const badge = document.createElement('div');
                    badge.className = 'pdf-page-badge';
                    badge.textContent = 'Pág. ' + (idx + 1);
                    card.appendChild(badge);

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'pdf-page-remove';
                    removeBtn.title = 'Quitar de la lista';
                    removeBtn.textContent = '✕';
                    removeBtn.addEventListener('click', () => removeImage(idx));
                    card.appendChild(removeBtn);

                    const sheet = document.createElement('div');
                    sheet.className = 'pdf-page-sheet' + (fitMode === 'cover' ? ' fill' : '');
                    // La proporción de la hoja se pasa a CSS como alto/ancho.
                    sheet.style.setProperty('--sheet-ratio', `${paper.w} / ${paper.h}`);
                    const imgEl = document.createElement('img');
                    imgEl.src = item.img.src;
                    imgEl.alt = item.name;
                    sheet.appendChild(imgEl);
                    card.appendChild(sheet);

                    const name = document.createElement('div');
                    name.className = 'pdf-page-name';
                    name.textContent = item.name;
                    name.title = item.name;
                    card.appendChild(name);

                    const meta = document.createElement('div');
                    meta.className = 'pdf-page-meta';
                    meta.textContent = `${item.naturalW} × ${item.naturalH} px · ${fmtBytes(item.file.size)}`;
                    card.appendChild(meta);

                    const actions = document.createElement('div');
                    actions.className = 'pdf-page-actions';
                    const upBtn = document.createElement('button');
                    upBtn.textContent = '↑'; upBtn.title = 'Mover antes';
                    upBtn.disabled = idx === 0;
                    upBtn.addEventListener('click', () => moveImage(idx, -1));
                    const downBtn = document.createElement('button');
                    downBtn.textContent = '↓'; downBtn.title = 'Mover después';
                    downBtn.disabled = idx === images.length - 1;
                    downBtn.addEventListener('click', () => moveImage(idx, 1));
                    actions.appendChild(upBtn); actions.appendChild(downBtn);
                    card.appendChild(actions);

                    grid.appendChild(card);
                });
                previewInner.appendChild(grid);
            }

            function moveImage(idx, dir) {
                const j = idx + dir;
                if (j < 0 || j >= images.length) return;
                [images[idx], images[j]] = [images[j], images[idx]];
                renderGrid();
            }

            function removeImage(idx) {
                images.splice(idx, 1);
                if (!images.length) { resetPanel(); return; }
                updateOriginalInfo();
                renderGrid();
            }

            async function handleFiles(fileList) {
                const files = Array.from(fileList);
                if (!files.length) return;
                if (images.length + files.length > MAX_FILES) {
                    toast('error', `Máximo ${MAX_FILES} imágenes en total.`);
                    return;
                }
                showLoader(`Leyendo 1 de ${files.length} imagen(es)…`);
                const rejected = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    setLoaderMsg(`Leyendo ${i + 1} de ${files.length}: ${file.name}`);
                    if (file.size > MAX_FILE_MB * 1024 * 1024) { rejected.push(`${file.name} (supera ${MAX_FILE_MB} MB)`); continue; }
                    try {
                        const { img } = await loadImageFromFile(file);
                        images.push({ file, img, naturalW: img.naturalWidth, naturalH: img.naturalHeight, name: file.name });
                    } catch (err) { rejected.push(file.name); }
                }
                hideLoader();
                if (!images.length) { toast('error', 'No se pudo abrir ninguna de las imágenes seleccionadas.'); return; }
                dz.classList.add('loaded');
                emptyState.style.display = 'none';
                outputInfo.style.display = 'none';
                btnBuild.disabled = false;
                updateOriginalInfo();
                renderGrid();
                if (rejected.length) toast('info', `${rejected.length} archivo(s) no se cargaron: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`);
                toast('success', `${images.length} imagen(es) en la lista.`);
            }
            setupDropzone(dz, input, handleFiles);

            function resetPanel() {
                images = [];
                dz.classList.remove('loaded');
                previewInner.innerHTML = '';
                emptyState.style.display = '';
                previewInner.appendChild(emptyState);
                originalInfo.style.display = 'none'; originalInfo.innerHTML = '';
                outputInfo.style.display = 'none'; outputInfo.innerHTML = '';
                btnBuild.disabled = true;
                paperSelect.value = 'carta';
                document.getElementById('i2pFitContain').checked = true;
                fitTip.textContent = FIT_TIPS.contain;
            }
            const btnResetImg2PdfPanel = document.getElementById('btnResetImg2PdfPanel');
            if (btnResetImg2PdfPanel) {
                btnResetImg2PdfPanel.addEventListener('click', () => {
                    if (!images.length) { toast('info', 'El panel ya está en sus valores predeterminados.'); return; }
                    if (!confirm('¿Limpiar la lista de imágenes?')) return;
                    resetPanel();
                    toast('info', 'Panel limpiado.');
                });
            }

            btnBuild.addEventListener('click', async () => {
                if (!images.length) return;
                btnBuild.disabled = true;
                showLoader('Creando PDF…');
                try {
                    const paper = PAPERS[paperSelect.value];
                    const fitMode = document.querySelector('input[name="i2pFit"]:checked').value;
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF({ orientation: paper.w > paper.h ? 'landscape' : 'portrait', unit: 'cm', format: [paper.w, paper.h], compress: true });
                    for (let i = 0; i < images.length; i++) {
                        setLoaderMsg(`Agregando página ${i + 1} de ${images.length}…`);
                        const item = images[i];
                        if (i > 0) pdf.addPage([paper.w, paper.h], paper.w > paper.h ? 'landscape' : 'portrait');
                        const canvas = document.createElement('canvas');
                        canvas.width = item.naturalW; canvas.height = item.naturalH;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(item.img, 0, 0);
                        const imgData = canvas.toDataURL('image/jpeg', 0.92);
                        const imgRatio = item.naturalW / item.naturalH;
                        const pageRatio = paper.w / paper.h;
                        let dw, dh;
                        if (fitMode === 'contain') {
                            if (imgRatio > pageRatio) { dw = paper.w; dh = dw / imgRatio; }
                            else { dh = paper.h; dw = dh * imgRatio; }
                        } else {
                            if (imgRatio > pageRatio) { dh = paper.h; dw = dh * imgRatio; }
                            else { dw = paper.w; dh = dw / imgRatio; }
                        }
                        const dx = (paper.w - dw) / 2, dy = (paper.h - dh) / 2;
                        if (fitMode === 'cover') {
                            // Recorta lo que sobresalga de la hoja usando un canvas intermedio del tamaño exacto de la página
                            pdf.addImage(imgData, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
                        } else {
                            pdf.addImage(imgData, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
                        }
                    }
                    const stamp = new Date().toISOString().slice(0, 10);
                    pdf.save(`imagenes-a-pdf-${stamp}.pdf`);
                    outputInfo.style.display = 'block';
                    outputInfo.innerHTML = `<b>Salida:</b> PDF de ${images.length} página(s), tamaño ${paperSelect.options[paperSelect.selectedIndex].text}`;
                    toast('success', '✓ PDF creado y descargado.');
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo crear el PDF.');
                } finally {
                    hideLoader();
                    btnBuild.disabled = false;
                }
            });
        })();

        /* ============================================================
           HERRAMIENTA · PDF: COMPRIMIR / UNIR / DIVIDIR
           ============================================================ */
        (function pdfToolsTool() {
            const dz = document.getElementById('pdfDropzone');
            const input = document.getElementById('pdfFileInput');
            const previewInner = document.getElementById('pdfPreviewInner');
            const emptyState = document.getElementById('pdfEmptyState');
            const originalInfo = document.getElementById('pdfOriginalInfo');
            const outputInfo = document.getElementById('pdfOutputInfo');
            const dzTitle = document.getElementById('pdfDzTitle');
            const dzSub = document.getElementById('pdfDzSub');
            const compressOpts = document.getElementById('pdfCompressOpts');
            const mergeOpts = document.getElementById('pdfMergeOpts');
            const splitOpts = document.getElementById('pdfSplitOpts');
            const btnCompress = document.getElementById('btnPdfCompress');
            const btnMerge = document.getElementById('btnPdfMerge');
            const btnSplit = document.getElementById('btnPdfSplit');
            const rangeField = document.getElementById('pdfRangeField');
            const rangeInput = document.getElementById('pdfRangeInput');
            const MAX_FILE_MB = 60;
            const MAX_FILES = 60;

            const COMPRESS_LEVELS = {
                low: { scale: 1.0, quality: 0.55 },
                med: { scale: 1.5, quality: 0.72 },
                high: { scale: 2.2, quality: 0.88 }
            };

            let mode = 'compress';
            let pdfDocs = []; // para comprimir/dividir: 1 elemento {file, bytes}; para unir: varios

            if (window['pdfjsLib']) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }

            function updateModeUI() {
                mode = document.querySelector('input[name="pdfMode"]:checked').value;
                input.multiple = mode === 'merge';
                dzTitle.textContent = mode === 'merge' ? 'Haz clic o arrastra 2 a 60 PDF' : 'Haz clic o arrastra un PDF';
                dzSub.textContent = mode === 'merge' ? 'Se unen en el orden en que aparezcan' : `Máx. ${MAX_FILE_MB} MB`;
                compressOpts.style.display = mode === 'compress' ? '' : 'none';
                mergeOpts.style.display = mode === 'merge' ? '' : 'none';
                splitOpts.style.display = mode === 'split' ? '' : 'none';
                resetPanel();
            }
            document.querySelectorAll('input[name="pdfMode"]').forEach(r => r.addEventListener('change', updateModeUI));

            document.querySelectorAll('input[name="pdfSplitMode"]').forEach(r => r.addEventListener('change', () => {
                rangeField.style.display = document.querySelector('input[name="pdfSplitMode"]:checked').value === 'range' ? '' : 'none';
            }));

            function fmtInfoSingle() {
                const d = pdfDocs[0];
                originalInfo.style.display = 'block';
                originalInfo.innerHTML = `<b>${d.file.name}</b><br>${d.pageCount} página(s) · ${fmtBytes(d.file.size)}`;
            }

            // Dibuja la primera página del PDF en un canvas, conservando su
            // proporción real. El resultado se cachea en el propio doc para
            // no volver a renderizar en cada reordenamiento de la lista.
            async function renderThumb(doc, targetWidth) {
                if (doc.thumb) return doc.thumb;
                if (!window['pdfjsLib']) return null;
                const task = pdfjsLib.getDocument({ data: doc.bytes.slice(0) });
                const pdf = await task.promise;
                const page = await pdf.getPage(1);
                const base = page.getViewport({ scale: 1 });
                const scale = targetWidth / base.width;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(viewport.width);
                canvas.height = Math.round(viewport.height);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                doc.thumb = canvas;
                doc.ratio = base.width / base.height;
                return canvas;
            }

            function attachThumb(container, doc, targetWidth) {
                const loading = document.createElement('div');
                loading.className = 'sheet-loading';
                loading.textContent = 'Cargando…';
                container.appendChild(loading);
                renderThumb(doc, targetWidth).then(canvas => {
                    loading.remove();
                    if (!canvas) { container.textContent = '📄'; return; }
                    container.style.setProperty('--sheet-ratio', `${canvas.width} / ${canvas.height}`);
                    // Se clona para poder mostrar la misma miniatura en varios sitios.
                    const copy = document.createElement('canvas');
                    copy.width = canvas.width; copy.height = canvas.height;
                    copy.getContext('2d').drawImage(canvas, 0, 0);
                    container.appendChild(copy);
                }).catch(() => {
                    loading.remove();
                    container.textContent = '📄';
                });
            }

            // Vista en tarjetas grandes: cada PDF se ve como una hoja con su
            // proporción real, no como un icono pequeño en una lista.
            function renderPdfList() {
                previewInner.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'pdf-page-grid';
                pdfDocs.forEach((d, idx) => {
                    const card = document.createElement('div');
                    card.className = 'pdf-page-card';

                    const badge = document.createElement('div');
                    badge.className = 'pdf-page-badge';
                    badge.textContent = (idx + 1) + ' de ' + pdfDocs.length;
                    card.appendChild(badge);

                    const remove = document.createElement('button');
                    remove.className = 'pdf-page-remove';
                    remove.textContent = '✕'; remove.title = 'Quitar';
                    remove.addEventListener('click', () => {
                        pdfDocs.splice(idx, 1);
                        if (!pdfDocs.length) { resetPanel(); return; }
                        renderPdfList();
                        btnMerge.disabled = pdfDocs.length < 2;
                    });
                    card.appendChild(remove);

                    const sheet = document.createElement('div');
                    sheet.className = 'pdf-page-sheet';
                    attachThumb(sheet, d, 420);
                    card.appendChild(sheet);

                    const name = document.createElement('div');
                    name.className = 'pdf-page-name';
                    name.textContent = d.file.name;
                    name.title = d.file.name;
                    card.appendChild(name);

                    const meta = document.createElement('div');
                    meta.className = 'pdf-page-meta';
                    meta.textContent = `${d.pageCount} página(s) · ${fmtBytes(d.file.size)}`;
                    card.appendChild(meta);

                    const actions = document.createElement('div');
                    actions.className = 'pdf-page-actions';
                    const up = document.createElement('button');
                    up.textContent = '↑'; up.title = 'Mover antes'; up.disabled = idx === 0;
                    up.addEventListener('click', () => { [pdfDocs[idx], pdfDocs[idx - 1]] = [pdfDocs[idx - 1], pdfDocs[idx]]; renderPdfList(); });
                    const down = document.createElement('button');
                    down.textContent = '↓'; down.title = 'Mover después'; down.disabled = idx === pdfDocs.length - 1;
                    down.addEventListener('click', () => { [pdfDocs[idx], pdfDocs[idx + 1]] = [pdfDocs[idx + 1], pdfDocs[idx]]; renderPdfList(); });
                    actions.appendChild(up); actions.appendChild(down);
                    card.appendChild(actions);

                    grid.appendChild(card);
                });
                previewInner.appendChild(grid);
            }

            // Vista para un solo PDF (comprimir / dividir): hoja grande y centrada.
            function renderSinglePdfCard() {
                const d = pdfDocs[0];
                previewInner.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'pdf-page-grid';
                grid.style.maxWidth = '340px';
                const card = document.createElement('div');
                card.className = 'pdf-page-card';

                const sheet = document.createElement('div');
                sheet.className = 'pdf-page-sheet';
                attachThumb(sheet, d, 560);
                card.appendChild(sheet);

                const name = document.createElement('div');
                name.className = 'pdf-page-name';
                name.textContent = d.file.name;
                name.title = d.file.name;
                card.appendChild(name);

                const meta = document.createElement('div');
                meta.className = 'pdf-page-meta';
                meta.textContent = `${d.pageCount} página(s) · ${fmtBytes(d.file.size)}`;
                card.appendChild(meta);

                grid.appendChild(card);
                previewInner.appendChild(grid);
            }

            async function readPdfMeta(file) {
                const buf = await file.arrayBuffer();
                let pageCount = '?';
                try {
                    if (window['PDFLib']) {
                        const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
                        pageCount = doc.getPageCount();
                    }
                } catch (e) { /* seguimos aunque no se pueda leer el conteo */ }
                return { file, bytes: buf, pageCount };
            }

            async function handleFiles(fileList) {
                const files = Array.from(fileList);
                if (!files.length) return;
                if (mode !== 'merge' && files.length > 1) { toast('info', 'Solo se usará el primer PDF.'); }
                const toLoad = mode === 'merge' ? files.slice(0, MAX_FILES - pdfDocs.length) : [files[0]];
                showLoader('Leyendo PDF…');
                const rejected = [];
                for (let i = 0; i < toLoad.length; i++) {
                    const file = toLoad[i];
                    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { rejected.push(file.name); continue; }
                    if (file.size > MAX_FILE_MB * 1024 * 1024) { rejected.push(`${file.name} (supera ${MAX_FILE_MB} MB)`); continue; }
                    setLoaderMsg(`Leyendo ${i + 1} de ${toLoad.length}: ${file.name}`);
                    try {
                        const doc = await readPdfMeta(file);
                        if (mode === 'merge') pdfDocs.push(doc); else pdfDocs = [doc];
                    } catch (err) { rejected.push(file.name); }
                }
                hideLoader();
                if (!pdfDocs.length) { toast('error', 'No se pudo abrir el PDF.'); return; }
                dz.classList.add('loaded');
                emptyState.style.display = 'none';
                outputInfo.style.display = 'none';
                if (mode === 'merge') {
                    renderPdfList();
                    btnMerge.disabled = pdfDocs.length < 2;
                } else {
                    fmtInfoSingle();
                    renderSinglePdfCard();
                    if (mode === 'compress') btnCompress.disabled = false;
                    if (mode === 'split') btnSplit.disabled = false;
                }
                if (rejected.length) toast('info', `No se pudo usar: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`);
                toast('success', mode === 'merge' ? `${pdfDocs.length} PDF en la lista.` : 'PDF cargado.');
            }
            setupDropzone(dz, input, handleFiles);

            function resetPanel() {
                pdfDocs = [];
                dz.classList.remove('loaded');
                previewInner.innerHTML = '';
                emptyState.style.display = '';
                previewInner.appendChild(emptyState);
                originalInfo.style.display = 'none'; originalInfo.innerHTML = '';
                outputInfo.style.display = 'none'; outputInfo.innerHTML = '';
                btnCompress.disabled = true; btnMerge.disabled = true; btnSplit.disabled = true;
                rangeInput.value = '';
            }
            const btnResetPdfToolsPanel = document.getElementById('btnResetPdfToolsPanel');
            if (btnResetPdfToolsPanel) {
                btnResetPdfToolsPanel.addEventListener('click', () => {
                    if (!pdfDocs.length) { toast('info', 'El panel ya está en sus valores predeterminados.'); return; }
                    if (!confirm('¿Limpiar el panel de PDF?')) return;
                    resetPanel();
                    toast('info', 'Panel limpiado.');
                });
            }

            // ---- COMPRIMIR (rasteriza cada página con pdf.js y reconstruye con jsPDF) ----
            btnCompress.addEventListener('click', async () => {
                if (!pdfDocs.length || !window['pdfjsLib']) return;
                const level = document.querySelector('input[name="pdfCompressLevel"]:checked').value;
                const cfg = COMPRESS_LEVELS[level];
                btnCompress.disabled = true;
                showLoader('Abriendo PDF…');
                try {
                    const originalFile = pdfDocs[0].file;
                    const originalSize = originalFile.size;
                    const srcDoc = await pdfjsLib.getDocument({ data: pdfDocs[0].bytes.slice(0) }).promise;
                    const numPages = srcDoc.numPages;
                    let outPdf = null;
                    const { jsPDF } = window.jspdf;
                    for (let p = 1; p <= numPages; p++) {
                        setLoaderMsg(`Comprimiendo página ${p} de ${numPages}…`);
                        const page = await srcDoc.getPage(p);
                        const viewport = page.getViewport({ scale: cfg.scale });
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width; canvas.height = viewport.height;
                        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                        const imgData = canvas.toDataURL('image/jpeg', cfg.quality);
                        const wCm = (viewport.width / (cfg.scale * 72)) * 2.54;
                        const hCm = (viewport.height / (cfg.scale * 72)) * 2.54;
                        const orientation = wCm > hCm ? 'landscape' : 'portrait';
                        if (!outPdf) {
                            outPdf = new jsPDF({ orientation, unit: 'cm', format: [wCm, hCm], compress: true });
                        } else {
                            outPdf.addPage([wCm, hCm], orientation);
                        }
                        outPdf.addImage(imgData, 'JPEG', 0, 0, wCm, hCm, undefined, 'FAST');
                    }
                    const blob = outPdf.output('blob');
                    const stamp = new Date().toISOString().slice(0, 10);
                    downloadBlob(blob, `comprimido-${stamp}.pdf`);
                    const pct = originalSize ? Math.round((1 - blob.size / originalSize) * 100) : 0;
                    outputInfo.style.display = 'block';
                    outputInfo.innerHTML = `<b>Salida:</b> ${fmtBytes(blob.size)} (antes ${fmtBytes(originalSize)})` + (pct > 0 ? ` · ${pct}% más ligero` : ' · el PDF ya estaba bastante optimizado');
                    toast('success', '✓ PDF comprimido y descargado.');
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo comprimir el PDF.');
                } finally {
                    hideLoader();
                    btnCompress.disabled = false;
                }
            });

            // ---- UNIR (copia páginas reales con pdf-lib, sin perder calidad) ----
            btnMerge.addEventListener('click', async () => {
                if (pdfDocs.length < 2 || !window['PDFLib']) { toast('error', 'No cargó la librería de PDF.'); return; }
                btnMerge.disabled = true;
                showLoader('Uniendo PDF…');
                try {
                    const { PDFDocument } = PDFLib;
                    const merged = await PDFDocument.create();
                    for (let i = 0; i < pdfDocs.length; i++) {
                        setLoaderMsg(`Uniendo ${i + 1} de ${pdfDocs.length}: ${pdfDocs[i].file.name}`);
                        const src = await PDFDocument.load(pdfDocs[i].bytes.slice(0), { ignoreEncryption: true });
                        const pages = await merged.copyPages(src, src.getPageIndices());
                        pages.forEach(pg => merged.addPage(pg));
                    }
                    const bytes = await merged.save();
                    const blob = new Blob([bytes], { type: 'application/pdf' });
                    const stamp = new Date().toISOString().slice(0, 10);
                    downloadBlob(blob, `unido-${stamp}.pdf`);
                    outputInfo.style.display = 'block';
                    outputInfo.innerHTML = `<b>Salida:</b> PDF de ${merged.getPageCount()} página(s) · ${fmtBytes(blob.size)}`;
                    toast('success', '✓ PDF unido y descargado.');
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo unir. Revisa que los archivos sean PDF válidos.');
                } finally {
                    hideLoader();
                    btnMerge.disabled = false;
                }
            });

            // ---- DIVIDIR (copia páginas reales con pdf-lib, sin perder calidad) ----
            function parseRanges(str, maxPage) {
                const pages = new Set();
                str.split(',').forEach(part => {
                    part = part.trim();
                    if (!part) return;
                    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
                    if (m) {
                        let a = parseInt(m[1]), b = parseInt(m[2]);
                        if (a > b) [a, b] = [b, a];
                        for (let n = a; n <= b; n++) if (n >= 1 && n <= maxPage) pages.add(n);
                    } else if (/^\d+$/.test(part)) {
                        const n = parseInt(part);
                        if (n >= 1 && n <= maxPage) pages.add(n);
                    }
                });
                return Array.from(pages).sort((a, b) => a - b);
            }

            btnSplit.addEventListener('click', async () => {
                if (!pdfDocs.length || !window['PDFLib'] || !window['JSZip']) { toast('error', 'Falta cargar alguna librería necesaria.'); return; }
                const splitMode = document.querySelector('input[name="pdfSplitMode"]:checked').value;
                btnSplit.disabled = true;
                showLoader('Dividiendo PDF…');
                try {
                    const { PDFDocument } = PDFLib;
                    const src = await PDFDocument.load(pdfDocs[0].bytes.slice(0), { ignoreEncryption: true });
                    const totalPages = src.getPageCount();
                    const baseName = (pdfDocs[0].file.name || 'documento').replace(/\.pdf$/i, '');
                    const stamp = new Date().toISOString().slice(0, 10);

                    if (splitMode === 'range') {
                        const pages = parseRanges(rangeInput.value, totalPages);
                        if (!pages.length) { toast('error', 'Escribe un rango de páginas válido, por ejemplo 1-3.'); return; }
                        const out = await PDFDocument.create();
                        const copied = await out.copyPages(src, pages.map(n => n - 1));
                        copied.forEach(pg => out.addPage(pg));
                        const bytes = await out.save();
                        const blob = new Blob([bytes], { type: 'application/pdf' });
                        downloadBlob(blob, `${baseName}-paginas-${pages[0]}-${pages[pages.length - 1]}.pdf`);
                        outputInfo.style.display = 'block';
                        outputInfo.innerHTML = `<b>Salida:</b> PDF con ${pages.length} página(s) · ${fmtBytes(blob.size)}`;
                        toast('success', '✓ PDF dividido y descargado.');
                    } else {
                        const zip = new JSZip();
                        for (let i = 0; i < totalPages; i++) {
                            setLoaderMsg(`Separando página ${i + 1} de ${totalPages}…`);
                            const out = await PDFDocument.create();
                            const [pg] = await out.copyPages(src, [i]);
                            out.addPage(pg);
                            const bytes = await out.save();
                            zip.file(`${baseName}-pagina-${String(i + 1).padStart(2, '0')}.pdf`, bytes);
                        }
                        setLoaderMsg('Generando archivo .zip…');
                        const content = await zip.generateAsync({ type: 'blob' });
                        downloadBlob(content, `${baseName}-paginas-${stamp}.zip`);
                        outputInfo.style.display = 'block';
                        outputInfo.innerHTML = `<b>Salida:</b> ${totalPages} PDF (uno por página) en .zip · ${fmtBytes(content.size)}`;
                        toast('success', '✓ PDF dividido y descargado.');
                    }
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo dividir el PDF.');
                } finally {
                    hideLoader();
                    btnSplit.disabled = false;
                }
            });

            updateModeUI();
        })();

        /* ============================================================
           HERRAMIENTA · GENERADOR DE CÓDIGO QR
           ============================================================ */
        (function qrTool() {
            const previewInner = document.getElementById('qrPreviewInner');
            const emptyState = document.getElementById('qrEmptyState');
            const outputInfo = document.getElementById('qrOutputInfo');
            const btnGenerate = document.getElementById('btnQrGenerate');
            const btnDownload = document.getElementById('btnQrDownload');
            const sizeSlider = document.getElementById('qrSize');
            const sizeVal = document.getElementById('qrSizeVal');
            const textSection = document.getElementById('qrTextSection');
            const waSection = document.getElementById('qrWaSection');
            const textInput = document.getElementById('qrTextInput');
            const waNumber = document.getElementById('qrWaNumber');
            const waMsg = document.getElementById('qrWaMsg');

            let lastCanvas = null;

            // Asegura que los acentos y la ñ se codifiquen correctamente.
            if (window['qrcode'] && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
                qrcode.stringToBytesFuncs.default = qrcode.stringToBytesFuncs['UTF-8'];
            }

            function currentMode() { return document.querySelector('input[name="qrMode"]:checked').value; }
            function updateModeUI() {
                const m = currentMode();
                textSection.style.display = m === 'text' ? '' : 'none';
                waSection.style.display = m === 'whatsapp' ? '' : 'none';
            }
            document.querySelectorAll('input[name="qrMode"]').forEach(r => r.addEventListener('change', updateModeUI));
            updateModeUI();

            sizeSlider.addEventListener('input', () => { sizeVal.textContent = sizeSlider.value + ' px'; });

            function buildContent() {
                const m = currentMode();
                if (m === 'whatsapp') {
                    const num = waNumber.value.replace(/[^0-9]/g, '');
                    if (!num) return null;
                    const msg = waMsg.value.trim();
                    return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : '');
                }
                const text = textInput.value.trim();
                return text || null;
            }

            btnGenerate.addEventListener('click', () => {
                if (!window['qrcode']) { toast('error', 'No cargó el motor de código QR.'); return; }
                const content = buildContent();
                if (!content) {
                    toast('error', currentMode() === 'whatsapp' ? 'Escribe un número de WhatsApp.' : 'Escribe un texto o enlace.');
                    return;
                }
                try {
                    const qr = qrcode(0, 'M');
                    qr.addData(content, 'Byte');
                    qr.make();
                    const moduleCount = qr.getModuleCount();
                    const size = parseInt(sizeSlider.value) || 640;
                    const margin = Math.round(size * 0.06);
                    const cell = (size - margin * 2) / moduleCount;
                    const canvas = document.createElement('canvas');
                    canvas.width = size; canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, size, size);
                    ctx.fillStyle = '#000000';
                    for (let r = 0; r < moduleCount; r++) {
                        for (let c = 0; c < moduleCount; c++) {
                            if (qr.isDark(r, c)) {
                                ctx.fillRect(margin + c * cell, margin + r * cell, Math.ceil(cell), Math.ceil(cell));
                            }
                        }
                    }
                    lastCanvas = canvas;
                    previewInner.innerHTML = '';
                    const wrap = document.createElement('div');
                    wrap.className = 'curp-canvas-wrap';
                    wrap.style.background = '#fff';
                    wrap.style.padding = '10px';
                    wrap.style.borderRadius = '10px';
                    const displayCanvas = document.createElement('canvas');
                    const dispSize = Math.min(size, 420);
                    displayCanvas.width = dispSize; displayCanvas.height = dispSize;
                    displayCanvas.getContext('2d').drawImage(canvas, 0, 0, dispSize, dispSize);
                    wrap.appendChild(displayCanvas);
                    previewInner.appendChild(wrap);
                    btnDownload.disabled = false;
                    outputInfo.style.display = 'block';
                    outputInfo.innerHTML = `<b>Contenido:</b> ${content.length > 60 ? content.slice(0, 60) + '…' : content}`;
                    toast('success', '✓ Código QR generado.');
                } catch (err) {
                    console.error(err);
                    toast('error', 'No se pudo generar el código QR. Prueba con un texto más corto.');
                }
            });

            btnDownload.addEventListener('click', () => {
                if (!lastCanvas) return;
                lastCanvas.toBlob(blob => {
                    downloadBlob(blob, 'codigo-qr.png');
                    toast('success', 'PNG descargado.');
                }, 'image/png');
            });
        })();

    })();


        /* ============================================================
           AVISO DE PRIVACIDAD
           Se abre desde la píldora "Desarrollado por" del pie de página.
           ============================================================ */
        (function privacyNotice() {
            const modal = document.getElementById('modalPrivacy');
            const openBtn = document.getElementById('btnPrivacyOpen');
            if (!modal || !openBtn) return;

            const body = modal.querySelector('.privacy-body');

            function open() {
                modal.classList.add('on');
                if (body) body.scrollTop = 0;   // siempre se abre desde el inicio
            }
            function close() {
                modal.classList.remove('on');
            }

            openBtn.addEventListener('click', open);
            const closeBtn = document.getElementById('btnPrivacyClose');
            const okBtn = document.getElementById('btnPrivacyOk');
            if (closeBtn) closeBtn.addEventListener('click', close);
            if (okBtn) okBtn.addEventListener('click', close);

            // Clic fuera de la ventana o tecla Escape para cerrar.
            modal.addEventListener('click', e => { if (e.target === modal) close(); });
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && modal.classList.contains('on')) close();
            });
        })();
