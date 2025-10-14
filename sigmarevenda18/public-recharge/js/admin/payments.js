// public-recharge/js/admin/payments.js
// Correção para exibir TODOS os tipos de painel corretamente

const AdminPayments = {
    async loadPayments() {
        try {
            const payments = await API.admin.getPayments();
            this.renderPayments(payments);
        } catch (error) {
            console.error('Erro ao carregar pagamentos:', error);
        }
    },

    // ⭐ FUNÇÃO AUXILIAR: Obter informações do tipo de painel
    getPanelTypeInfo(type) {
        const types = {
            'sigma': { emoji: '🟢', name: 'Sigma', color: '#4caf50' },
            'koffice': { emoji: '🟣', name: 'Koffice', color: '#9c27b0' },
            'gesoffice': { emoji: '🔵', name: 'UNIPLAY', color: '#2196f3' },
            'p2bras': { emoji: '🟠', name: 'P2BRAS', color: '#ff9800' },
            'rushplay': { emoji: '🔴', name: 'RushPlay', color: '#f44336' },
            'painelfoda': { emoji: '⚫', name: 'PainelFoda', color: '#607d8b' },
            'dashboardbz': { emoji: '🟡', name: 'DashboardBz', color: '#ffc107' }
        };
        return types[type] || { emoji: '⚪', name: type, color: '#888' };
    },

    renderPayments(payments) {
        const tbody = document.getElementById('paymentsTableBody');
        tbody.innerHTML = '';

        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #888;">Nenhum pagamento registrado</td></tr>';
            return;
        }

        const errorCount = payments.filter(p => p.status === 'error').length;
        
        if (errorCount > 0) {
            const headerRow = tbody.parentElement.parentElement.querySelector('h2');
            if (headerRow && !document.getElementById('retryAllAdminBtn')) {
                const retryAllBtn = document.createElement('button');
                retryAllBtn.id = 'retryAllAdminBtn';
                retryAllBtn.className = 'btn-success';
                retryAllBtn.textContent = `🔄 Reprocessar Todos (${errorCount})`;
                retryAllBtn.onclick = () => this.retryAllErrors();
                retryAllBtn.style.marginLeft = '10px';
                headerRow.appendChild(retryAllBtn);
            }
        } else {
            const existingBtn = document.getElementById('retryAllAdminBtn');
            if (existingBtn) existingBtn.remove();
        }

        payments.forEach(payment => {
            const date = Utils.formatDate(payment.created_at);
            
            const statusColors = {
                'paid': '#4caf50',
                'pending': '#ff9800',
                'expired': '#f44336',
                'error': '#ff5722'
            };
            
            const statusTexts = {
                'paid': 'Pago',
                'pending': 'Pendente',
                'expired': 'Expirado',
                'error': 'Erro na Recarga'
            };

            const statusColor = statusColors[payment.status] || '#888';
            const statusText = statusTexts[payment.status] || payment.status;
            const statusBadge = `<span class="badge" style="background: ${statusColor}20; color: ${statusColor};">${statusText}</span>`;

            // ⭐ BADGE DO TIPO - AGORA COM TODOS OS TIPOS
            const typeInfo = this.getPanelTypeInfo(payment.reseller_type);
            const typeBadge = `<span class="badge" style="background: ${typeInfo.color}20; color: ${typeInfo.color};">${typeInfo.emoji} ${typeInfo.name}</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${payment.id}</td>
                <td>${payment.reseller_username || 'N/A'}</td>
                <td>${typeBadge}</td>
                <td>${payment.credits}</td>
                <td>R$ ${payment.amount.toFixed(2)}</td>
                <td>${statusBadge}</td>
                <td>${date}</td>
                <td class="actions">
                    ${payment.status === 'pending' ? 
                        `<button class="btn-danger" onclick="AdminPayments.deletePayment(${payment.id})">Excluir</button>` : 
                        payment.status === 'error' ?
                        `<button class="btn-success" onclick="AdminPayments.retryRecharge(${payment.id})" id="adminRetryBtn${payment.id}">Reprocessar</button>` :
                        '<span style="color: #888;">-</span>'
                    }
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    async deletePayment(id) {
        if (!confirm('Tem certeza que deseja excluir este pagamento?')) return;

        try {
            await API.admin.deletePayment(id);
            this.loadPayments();
            alert('Pagamento excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir pagamento');
        }
    },

    async deleteAllPending() {
        if (!confirm('Tem certeza que deseja excluir TODOS os pagamentos pendentes? Esta ação não pode ser desfeita!')) return;

        try {
            await API.admin.deleteAllPending();
            this.loadPayments();
            alert('Todos os pagamentos pendentes foram excluídos!');
        } catch (error) {
            alert('Erro ao excluir pagamentos pendentes');
        }
    },

    async retryRecharge(paymentId) {
        const btn = document.getElementById(`adminRetryBtn${paymentId}`);
        if (!btn) return;

        if (!confirm('Deseja reprocessar esta recarga? Isso tentará adicionar os créditos novamente.')) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Processando...';

        try {
            const result = await API.admin.retryRecharge(paymentId);

            if (result.success) {
                alert('✅ ' + result.message);
                this.loadPayments();
            } else {
                alert('❌ ' + result.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            alert('❌ Erro: ' + error.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    },

    async retryAllErrors() {
        const btn = document.getElementById('retryAllAdminBtn');
        if (!btn) return;

        if (!confirm('Deseja reprocessar TODAS as recargas com erro?\n\nIsso pode levar alguns minutos.\n\nO sistema processará cada pagamento com um intervalo de 1 segundo entre eles.')) {
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Processando...';

        try {
            const result = await API.admin.retryAllErrors();

            if (result.success) {
                const message = `✅ ${result.message}\n\n` +
                               `Total processado: ${result.total}\n` +
                               `Sucesso: ${result.succeeded}\n` +
                               `Falha: ${result.failed}`;
                
                alert(message);
                this.loadPayments();
            } else {
                alert('❌ ' + result.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            alert('❌ Erro ao reprocessar: ' + error.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    },

    async loadTransactions() {
        try {
            const transactions = await API.admin.getTransactions();
            this.renderTransactions(transactions);
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
        }
    },

    renderTransactions(transactions) {
        const tbody = document.getElementById('transactionsTableBody');
        tbody.innerHTML = '';

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">Nenhuma transação registrada</td></tr>';
            return;
        }

        transactions.forEach(tx => {
            const date = Utils.formatDate(tx.created_at);
            const statusBadge = tx.success ? 
                '<span class="badge badge-success">Sucesso</span>' : 
                '<span class="badge badge-danger">Erro</span>';

            // ⭐ BADGE DO TIPO - AGORA COM TODOS OS TIPOS
            const typeInfo = this.getPanelTypeInfo(tx.reseller_type);
            const typeBadge = `<span class="badge" style="background: ${typeInfo.color}20; color: ${typeInfo.color};">${typeInfo.emoji} ${typeInfo.name}</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${tx.username}</td>
                <td>${typeBadge}</td>
                <td>${tx.credits}</td>
                <td>R$ ${tx.amount.toFixed(2)}</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(row);
        });
    }
};

window.AdminPayments = AdminPayments;