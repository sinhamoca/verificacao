// services/PaymentService.js
const axios = require('axios');

class PaymentService {
    constructor(accessToken) {
        this.accessToken = accessToken;
    }

    async createPixPayment(amount, description, resellerId) {
        if (!this.accessToken) {
            throw new Error('Access Token do Mercado Pago não configurado');
        }

        try {
            const response = await axios.post(
                'https://api.mercadopago.com/v1/payments',
                {
                    transaction_amount: amount,
                    description: description,
                    payment_method_id: 'pix',
                    payer: {
                        email: 'cliente@example.com'
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 201 || response.status === 200) {
                const mpPayment = response.data;
                const qrCodeData = mpPayment.point_of_interaction.transaction_data;

                return {
                    paymentId: String(mpPayment.id),
                    qrCode: qrCodeData.qr_code,
                    qrCodeBase64: qrCodeData.qr_code_base64,
                    amount: mpPayment.transaction_amount,
                    status: mpPayment.status
                };
            } else {
                throw new Error(`Mercado Pago retornou status ${response.status}`);
            }

        } catch (error) {
            console.error('[PaymentService] Erro ao criar pagamento:', error.message);
            
            if (error.response && error.response.data) {
                console.error('[PaymentService] Resposta MP:', JSON.stringify(error.response.data, null, 2));
                
                let errorMessage = 'Erro ao criar pagamento';
                if (error.response.data.message) {
                    errorMessage = error.response.data.message;
                } else if (error.response.data.cause) {
                    errorMessage = error.response.data.cause[0]?.description || errorMessage;
                }
                throw new Error(errorMessage);
            }
            
            throw error;
        }
    }

    async getPaymentStatus(paymentId) {
        if (!this.accessToken) {
            throw new Error('Access Token do Mercado Pago não configurado');
        }

        try {
            // Limpar .0 se houver
            const cleanPaymentId = String(paymentId).replace('.0', '');

            const response = await axios.get(
                `https://api.mercadopago.com/v1/payments/${cleanPaymentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    validateStatus: () => true
                }
            );

            if (response.status === 200) {
                return {
                    status: response.data.status,
                    statusDetail: response.data.status_detail,
                    dateApproved: response.data.date_approved
                };
            } else {
                throw new Error(`Erro ao buscar pagamento: Status ${response.status}`);
            }

        } catch (error) {
            console.error('[PaymentService] Erro ao verificar status:', error.message);
            throw error;
        }
    }
}

module.exports = PaymentService;
