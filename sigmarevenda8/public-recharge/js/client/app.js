// js/client/app.js - Inicialização do app cliente
document.addEventListener('DOMContentLoaded', async () => {
    // ✅ NOVO: Verificar sessão ao carregar
    ClientAuth.checkSession();

    // Carregar pergunta de acesso
    try {
        const data = await API.public.getAccessQuestion();
        document.getElementById('accessQuestion').textContent = data.question;
    } catch (error) {
        Utils.showError('Erro ao carregar configurações');
    }

    // Event Listeners
    document.getElementById('verifyAccessBtn')?.addEventListener('click', () => ClientAuth.verifyAccess());
    document.getElementById('resellerLoginBtn')?.addEventListener('click', () => ClientAuth.login());
    document.getElementById('backToStep1Btn')?.addEventListener('click', () => Utils.goToStep(1));
    document.getElementById('selectPackageBtn')?.addEventListener('click', () => ClientPackages.proceedToPayment());
    document.getElementById('goToDashboardBtn')?.addEventListener('click', () => ClientDashboard.load());
    document.getElementById('logoutBtn')?.addEventListener('click', () => ClientAuth.logout());
    document.getElementById('copyPixBtn')?.addEventListener('click', () => ClientPayment.copyPixCode());
    document.getElementById('cancelPaymentBtn')?.addEventListener('click', () => ClientPayment.cancelPayment());
    document.getElementById('viewDashboardBtn')?.addEventListener('click', () => ClientDashboard.load());
    document.getElementById('newPurchaseBtn')?.addEventListener('click', () => {
        ClientPackages.selectedPackage = null;
        Utils.goToStep(3);
    });
    document.getElementById('newPurchaseFromDashboardBtn')?.addEventListener('click', () => Utils.goToStep(3));
    document.getElementById('logoutFromDashboardBtn')?.addEventListener('click', () => ClientAuth.logout());
});
