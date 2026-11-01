// ============================================================
// PROGRAMA PRINCIPAL (punto de entrada)
// ============================================================
async function programa() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', programa);
        return;
    }

    // --- Ciclo de vida de la página ---
    window.addEventListener('beforeunload', persistOnHide);
    window.addEventListener('pagehide', persistOnHide);
    document.addEventListener('visibilitychange', () => {
        const st = estado();
        if (document.hidden && st.isRunning && st.currentSession) {
            st.currentSession.updatedAt = Date.now();
            upsertSession({ ...st.currentSession });
        }
    });

    // --- UI inicial ---
    refreshSegmentLabels();
    setButtonsEnabled(true, false);
    updateStatus('idle', '● En espera');
    updateProgress(0, 'Seleccione el modo e ingrese el valor correspondiente.');
    renderSessions();
    updateAutosaveInfo();

    // --- Enter para lanzar búsqueda ---
    const input = document.getElementById('inputValue');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !estado().isRunning) startSearch();
        });
    }

    // --- Importación de archivo JSON ---
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) await handleImportFile(file);
            fileInput.value = '';
        });
    }

    // --- Arrastrar y soltar JSON sobre la sección de sesiones ---
    const section = document.querySelector('.sessions-section');
    if (section) {
        section.addEventListener('dragover', (e) => {
            e.preventDefault();
            section.style.borderColor = 'var(--accent)';
        });
        section.addEventListener('dragleave', () => {
            section.style.borderColor = 'var(--border)';
        });
        section.addEventListener('drop', async (e) => {
            e.preventDefault();
            section.style.borderColor = 'var(--border)';
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) await handleImportFile(file);
        });
    }

    // --- Recuperación de sesión interrumpida (puede mostrar modal) ---
    await offerInterruptedResume();
}

programa();
