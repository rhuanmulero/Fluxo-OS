function toggleCard() {
    const card = document.getElementById('authCard');
    const body = document.body;

    // Flip do cartão com animação suave
    card.classList.toggle('is-flipped');
    
    // Altera a paleta de cores global do CSS
    body.classList.toggle('light-mode');
}

// Emulação de clique e submit sem recarregar a tela
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const btn = form.querySelector('.btn-primary');
        const originalText = btn.innerText;
        
        // Estilo de "Loading" minimalista
        btn.innerHTML = '<span style="opacity: 0.6;">Aguarde...</span>';
        btn.style.pointerEvents = 'none';
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.pointerEvents = 'auto';
        }, 1500);
    });
});