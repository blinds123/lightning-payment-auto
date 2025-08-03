// API base URL - update this for production
const API_BASE_URL = window.location.origin;

// Current invoice data
let currentInvoice = null;
let paymentCheckInterval = null;
let countdownInterval = null;

// DOM elements
const paymentForm = document.getElementById('payment-form');
const paymentDisplay = document.getElementById('payment-display');
const paymentSuccess = document.getElementById('payment-success');
const paymentError = document.getElementById('payment-error');
const checkoutForm = document.getElementById('checkout-form');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkoutForm.addEventListener('submit', handleFormSubmit);
    
    // Check if returning from BTCPay
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    if (orderId) {
        checkOrderStatus(orderId);
    }
});

// Form submission handler
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(checkoutForm);
    const data = {
        amount: parseFloat(formData.get('amount')),
        description: formData.get('description') || '',
        customer_email: formData.get('email') || ''
    };
    
    // Validate amount
    if (data.amount < 20 || data.amount > 100) {
        showError('Amount must be between $20 and $100');
        return;
    }
    
    try {
        showLoading();
        
        // Create invoice
        const response = await fetch(`${API_BASE_URL}/api/lightning/invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create invoice');
        }
        
        const invoice = await response.json();
        currentInvoice = invoice;
        
        // Display payment screen
        displayPayment(invoice);
        
    } catch (error) {
        console.error('Error creating invoice:', error);
        showError(error.message || 'Failed to create payment. Please try again.');
    }
}

// Display payment screen
function displayPayment(invoice) {
    // Hide form, show payment display
    paymentForm.style.display = 'none';
    paymentDisplay.style.display = 'block';
    paymentSuccess.style.display = 'none';
    paymentError.style.display = 'none';
    
    // Update display
    document.getElementById('display-amount').textContent = invoice.amount.toFixed(2);
    document.getElementById('display-description').textContent = 
        invoice.description || `Payment for order ${invoice.orderId}`;
    
    // Show payment request or checkout URL
    if (invoice.paymentRequest) {
        document.getElementById('payment-request').value = invoice.paymentRequest;
        generateQRCode(invoice.paymentRequest);
    } else if (invoice.checkoutUrl) {
        // Redirect to BTCPay checkout
        window.location.href = invoice.checkoutUrl;
        return;
    }
    
    // Start payment status checking
    startPaymentStatusCheck(invoice.invoiceId);
    
    // Start countdown timer
    if (invoice.expiresAt) {
        startCountdownTimer(new Date(invoice.expiresAt));
    }
}

// Generate QR code
function generateQRCode(paymentRequest) {
    const qrContainer = document.getElementById('qr-code');
    const qrLoading = document.querySelector('.qr-loading');
    
    // Clear previous QR code
    qrContainer.innerHTML = '';
    
    // Hide loading, show QR
    qrLoading.style.display = 'none';
    
    // Generate QR code
    new QRCode(qrContainer, {
        text: paymentRequest,
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
    });
}

// Copy to clipboard
function copyToClipboard() {
    const paymentRequest = document.getElementById('payment-request');
    paymentRequest.select();
    paymentRequest.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        
        // Show feedback
        const copyBtn = document.querySelector('.btn-copy');
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

// Start checking payment status
function startPaymentStatusCheck(invoiceId) {
    // Check immediately
    checkPaymentStatus(invoiceId);
    
    // Then check every 3 seconds
    paymentCheckInterval = setInterval(() => {
        checkPaymentStatus(invoiceId);
    }, 3000);
}

// Check payment status
async function checkPaymentStatus(invoiceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/lightning/invoice/${invoiceId}`);
        
        if (!response.ok) {
            throw new Error('Failed to check payment status');
        }
        
        const invoice = await response.json();
        
        if (invoice.status === 'paid') {
            // Payment successful!
            handlePaymentSuccess(invoice);
        } else if (invoice.status === 'expired') {
            // Payment expired
            showError('Payment expired. Please create a new payment.');
        }
        
    } catch (error) {
        console.error('Error checking payment status:', error);
    }
}

// Check order status (for BTCPay redirect)
async function checkOrderStatus(orderId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);
        
        if (!response.ok) {
            throw new Error('Order not found');
        }
        
        const order = await response.json();
        
        if (order.status === 'paid' || order.paymentStatus === 'paid') {
            handlePaymentSuccess({
                id: order.invoiceId,
                amount: order.amount,
                paidAt: order.paidAt || new Date().toISOString()
            });
        } else {
            showError('Payment was not completed. Please try again.');
        }
        
    } catch (error) {
        console.error('Error checking order status:', error);
        showError('Could not verify payment status. Please check your order.');
    }
}

// Handle successful payment
function handlePaymentSuccess(invoice) {
    // Stop checking for payment
    if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
    }
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Update payment status display
    const statusElement = document.getElementById('payment-status');
    statusElement.innerHTML = '<i class="fas fa-check-circle"></i> <span>Payment confirmed!</span>';
    statusElement.classList.add('success');
    
    // Show success screen after 1 second
    setTimeout(() => {
        paymentDisplay.style.display = 'none';
        paymentSuccess.style.display = 'block';
        
        // Update success details
        document.getElementById('success-order-id').textContent = currentInvoice?.orderId || invoice.id;
        document.getElementById('success-amount').textContent = (invoice.amount || currentInvoice?.amount || 0).toFixed(2);
        document.getElementById('success-time').textContent = new Date(invoice.paidAt).toLocaleString();
    }, 1000);
}

// Start countdown timer
function startCountdownTimer(expiresAt) {
    const countdownElement = document.getElementById('countdown');
    
    countdownInterval = setInterval(() => {
        const now = new Date();
        const timeLeft = expiresAt - now;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            countdownElement.textContent = '00:00';
            showError('Payment expired. Please create a new payment.');
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Create new payment
function createNewPayment() {
    // Reset state
    currentInvoice = null;
    
    if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
    }
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Show form again
    paymentForm.style.display = 'block';
    paymentDisplay.style.display = 'none';
    paymentSuccess.style.display = 'none';
    paymentError.style.display = 'none';
    
    // Reset form
    checkoutForm.reset();
    document.getElementById('amount').value = '25.00';
}

// Show loading state
function showLoading() {
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating invoice...';
}

// Show error
function showError(message) {
    paymentForm.style.display = 'none';
    paymentDisplay.style.display = 'none';
    paymentSuccess.style.display = 'none';
    paymentError.style.display = 'block';
    
    document.getElementById('error-message').textContent = message;
    
    // Re-enable form
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-bolt"></i> Generate Lightning Invoice';
}