// services/BrowserQueueService.js
// Sistema de Fila para Puppeteer - Apenas 1 navegador por vez

class BrowserQueueService {
    constructor() {
        this.queue = [];              // Fila de tarefas aguardando processamento
        this.processing = false;      // Lock: true = processando, false = livre
        this.currentTask = null;      // Tarefa atual em execução
        this.stats = {
            totalProcessed: 0,
            totalFailed: 0,
            averageTime: 0
        };
    }

    /**
     * Adicionar tarefa à fila
     * @param {Function} task - Função assíncrona que será executada
     * @param {Object} metadata - Informações sobre a tarefa (para logs)
     * @returns {Promise} - Resolve quando a tarefa for processada
     */
    async addToQueue(task, metadata = {}) {
        return new Promise((resolve, reject) => {
            const queueItem = {
                id: Date.now() + Math.random(), // ID único
                task: task,
                metadata: metadata,
                resolve: resolve,
                reject: reject,
                addedAt: new Date(),
                startedAt: null,
                finishedAt: null
            };

            this.queue.push(queueItem);
            
            const position = this.queue.length;
            const user = metadata.username || 'unknown';
            const credits = metadata.credits || '?';
            
            console.log(`[Queue] ➕ Tarefa adicionada: ${user} (${credits} créditos) - Posição: ${position}`);

            // Se não está processando, iniciar imediatamente
            if (!this.processing) {
                this.processQueue();
            } else {
                console.log(`[Queue] ⏳ Aguardando... ${this.queue.length} tarefa(s) na fila`);
            }
        });
    }

    /**
     * Processar fila sequencialmente (1 por vez)
     */
    async processQueue() {
        // Verificar se já está processando
        if (this.processing) {
            console.log('[Queue] ⚠️  Já existe um processo em execução');
            return;
        }

        // Verificar se tem itens na fila
        if (this.queue.length === 0) {
            console.log('[Queue] ✅ Fila vazia');
            return;
        }

        this.processing = true;
        console.log(`[Queue] 🚀 Iniciando processamento - ${this.queue.length} item(ns) na fila`);

        while (this.queue.length > 0) {
            // Pegar primeiro item da fila (FIFO)
            const item = this.queue.shift();
            this.currentTask = item;
            
            const user = item.metadata.username || 'unknown';
            const credits = item.metadata.credits || '?';
            const remaining = this.queue.length;

            console.log(`\n${'='.repeat(60)}`);
            console.log(`[Queue] 🔄 Processando: ${user} (${credits} créditos)`);
            console.log(`[Queue] 📊 Restantes na fila: ${remaining}`);
            console.log(`${'='.repeat(60)}\n`);

            item.startedAt = new Date();

            try {
                // Executar a tarefa
                const result = await item.task();
                
                item.finishedAt = new Date();
                const duration = (item.finishedAt - item.startedAt) / 1000;
                
                // Resolver a Promise
                item.resolve(result);
                
                this.stats.totalProcessed++;
                this.updateAverageTime(duration);
                
                console.log(`\n[Queue] ✅ Tarefa concluída: ${user}`);
                console.log(`[Queue] ⏱️  Tempo: ${duration.toFixed(2)}s`);
                console.log(`[Queue] 📈 Total processado: ${this.stats.totalProcessed}`);
                
            } catch (error) {
                item.finishedAt = new Date();
                const duration = (item.finishedAt - item.startedAt) / 1000;
                
                // Rejeitar a Promise
                item.reject(error);
                
                this.stats.totalFailed++;
                
                console.error(`\n[Queue] ❌ Tarefa falhou: ${user}`);
                console.error(`[Queue] ⏱️  Tempo até falha: ${duration.toFixed(2)}s`);
                console.error(`[Queue] ⚠️  Erro: ${error.message}`);
                console.error(`[Queue] 📉 Total falhas: ${this.stats.totalFailed}`);
                
            } finally {
                this.currentTask = null;
                
                // Aguardar 2 segundos entre tarefas (evitar sobrecarga)
                if (this.queue.length > 0) {
                    console.log(`\n[Queue] ⏸️  Aguardando 2s antes da próxima tarefa...\n`);
                    await this.delay(2000);
                }
            }
        }

        this.processing = false;
        console.log(`\n${'='.repeat(60)}`);
        console.log('[Queue] 🎉 Fila processada completamente!');
        console.log(`[Queue] 📊 Estatísticas:`);
        console.log(`  - Total processado: ${this.stats.totalProcessed}`);
        console.log(`  - Total falhas: ${this.stats.totalFailed}`);
        console.log(`  - Tempo médio: ${this.stats.averageTime.toFixed(2)}s`);
        console.log(`${'='.repeat(60)}\n`);
    }

    /**
     * Atualizar tempo médio de processamento
     */
    updateAverageTime(newTime) {
        const total = this.stats.totalProcessed + this.stats.totalFailed;
        const currentTotal = this.stats.averageTime * (total - 1);
        this.stats.averageTime = (currentTotal + newTime) / total;
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Status da fila (para monitoramento)
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            currentTask: this.currentTask ? {
                id: this.currentTask.id,
                username: this.currentTask.metadata.username,
                credits: this.currentTask.metadata.credits,
                startedAt: this.currentTask.startedAt
            } : null,
            stats: this.stats
        };
    }

    /**
     * Limpar fila (emergência)
     */
    clearQueue() {
        const cleared = this.queue.length;
        this.queue.forEach(item => {
            item.reject(new Error('Fila foi limpa pelo administrador'));
        });
        this.queue = [];
        console.log(`[Queue] 🗑️  Fila limpa: ${cleared} tarefa(s) removidas`);
        return cleared;
    }
}

// Singleton global - apenas UMA instância para todo o sistema
const browserQueue = new BrowserQueueService();

// Exportar o singleton
module.exports = browserQueue;
