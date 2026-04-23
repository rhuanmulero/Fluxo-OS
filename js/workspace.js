// Navegação do Slider (Push/Pop iOS Style)
function goToView(viewId) {
    const slider = document.getElementById('viewSlider');
    
    // Calcula qual posição do slider deve ser mostrada
    if (viewId === 'view-home') {
        slider.style.transform = 'translateX(0%)';
    } else if (viewId === 'view-code') {
        slider.style.transform = 'translateX(-33.333%)';
    } else if (viewId === 'view-create') {
        slider.style.transform = 'translateX(-66.666%)';
    }
}

// Lógica de Aceitar/Recusar Convite
function handleInvite(inviteId, isAccepted) {
    const inviteElement = document.getElementById(inviteId);
    const parentSection = inviteElement.closest('.section');
    
    // Efeito de "Scale down and fade out"
    inviteElement.style.transition = "all 0.3s ease";
    inviteElement.style.transform = "scale(0.95)";
    inviteElement.style.opacity = "0";

    setTimeout(() => {
        // Remove do DOM
        inviteElement.remove();
        
        // Verifica se ainda existem convites. Se não, esconde a seção de convites
        const remainingInvites = parentSection.querySelectorAll('.list-item');
        if (remainingInvites.length === 0) {
            parentSection.style.display = 'none';
        }

        // Mensagem de feedback
        if (isAccepted) {
            alert("Bem-vindo ao Workspace!");
        }
    }, 300);
}

// Formatar input de Código para uppercase automático
document.querySelectorAll('.code-input').forEach(input => {
    input.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });
});