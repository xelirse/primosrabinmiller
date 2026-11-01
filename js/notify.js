// ============================================================
// NOTIFICACIONES Y CONFIRMACIÓN (sin alert/confirm nativos)
// ============================================================
function notificar(mensaje, tipo = 'info', duracion = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    const cerrar = () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 250);
    };
    toast.addEventListener('click', cerrar);
    setTimeout(cerrar, duracion);
}

function confirmar(mensaje, opciones = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const box = document.createElement('div');
        box.className = 'modal-box';

        const msg = document.createElement('div');
        msg.className = 'modal-message';
        msg.textContent = mensaje;

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = opciones.cancelText || 'Cancelar';

        const okBtn = document.createElement('button');
        okBtn.className = 'btn btn-primary';
        okBtn.textContent = opciones.okText || 'Aceptar';

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        box.appendChild(msg);
        box.appendChild(actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add('visible'));

        const close = (val) => {
            overlay.classList.remove('visible');
            document.removeEventListener('keydown', escHandler);
            setTimeout(() => overlay.remove(), 200);
            resolve(val);
        };
        const escHandler = (e) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter')  close(true);
        };
        okBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        document.addEventListener('keydown', escHandler);
        setTimeout(() => okBtn.focus(), 40);
    });
}
