<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Page Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h4 class="fw-bold mb-1">
                            <i class="fas fa-arrow-right text-primary me-2"></i>B2C Disbursements
                        </h4>
                        <p class="text-muted mb-0">Business to Customer money transfers</p>
                    </div>
                    <b-button variant="primary" size="lg">
                        <i class="fas fa-plus-circle me-2"></i>New Disbursement
                    </b-button>
                </div>

                <!-- Filters -->
                <b-card class="border-0 shadow-sm mb-4">
                    <b-card-body>
                        <b-row class="g-3">
                            <b-col md="3">
                                <label class="form-label">Status</label>
                                <b-form-select>
                                    <option value="">All Status</option>
                                    <option value="completed">Completed</option>
                                    <option value="processing">Processing</option>
                                    <option value="failed">Failed</option>
                                </b-form-select>
                            </b-col>

                            <b-col md="3">
                                <label class="form-label">Command ID</label>
                                <b-form-select>
                                    <option value="">All Types</option>
                                    <option value="BusinessPayment">Business Payment</option>
                                    <option value="SalaryPayment">Salary Payment</option>
                                    <option value="PromotionPayment">Promotion Payment</option>
                                </b-form-select>
                            </b-col>

                            <b-col md="3">
                                <label class="form-label">Date Range</label>
                                <b-form-input type="date" />
                            </b-col>

                            <b-col md="3">
                                <label class="form-label">Search</label>
                                <b-form-input placeholder="Transaction ID or Phone" />
                            </b-col>
                        </b-row>
                    </b-card-body>
                </b-card>

                <!-- B2C Transactions Table -->
                <b-card class="border-0 shadow-sm">
                    <b-card-body class="p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th class="border-0 px-4">Transaction ID</th>
                                        <th class="border-0">Amount</th>
                                        <th class="border-0">Phone Number</th>
                                        <th class="border-0">Command ID</th>
                                        <th class="border-0">M-Pesa Receipt</th>
                                        <th class="border-0">Status</th>
                                        <th class="border-0">Date & Time</th>
                                        <th class="border-0 text-end px-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Transaction 1 -->
                                    <tr>
                                        <td class="px-4">
                                            <small class="font-monospace text-muted">7a3b2c1d...</small>
                                        </td>
                                        <td class="fw-bold">KES 3,000</td>
                                        <td>254712345678</td>
                                        <td>
                                            <span class="badge bg-info-subtle text-info">Business Payment</span>
                                        </td>
                                        <td>
                                            <span class="badge bg-light text-dark">QGH7XYZ123</span>
                                        </td>
                                        <td>
                                            <span class="badge bg-success">
                                                <i class="fas fa-check-circle me-1"></i>Completed
                                            </span>
                                        </td>
                                        <td>
                                            <div>May 24, 2026</div>
                                            <small class="text-muted">14:30:45</small>
                                        </td>
                                        <td class="text-end px-4">
                                            <b-button size="sm" variant="outline-primary"
                                                @click="viewTransaction('7a3b2c1d')">
                                                <i class="fas fa-eye"></i>
                                            </b-button>
                                        </td>
                                    </tr>

                                    <!-- Transaction 2 -->
                                    <tr>
                                        <td class="px-4">
                                            <small class="font-monospace text-muted">1f0e9d8c...</small>
                                        </td>
                                        <td class="fw-bold">KES 2,100</td>
                                        <td>254722334455</td>
                                        <td>
                                            <span class="badge bg-warning-subtle text-warning">Salary Payment</span>
                                        </td>
                                        <td>
                                            <span class="badge bg-light text-dark">XYZ789PQR1</span>
                                        </td>
                                        <td>
                                            <span class="badge bg-success">
                                                <i class="fas fa-check-circle me-1"></i>Completed
                                            </span>
                                        </td>
                                        <td>
                                            <div>May 24, 2026</div>
                                            <small class="text-muted">12:20:15</small>
                                        </td>
                                        <td class="text-end px-4">
                                            <b-button size="sm" variant="outline-primary"
                                                @click="viewTransaction('1f0e9d8c')">
                                                <i class="fas fa-eye"></i>
                                            </b-button>
                                        </td>
                                    </tr>

                                    <!-- Transaction 3 - Processing -->
                                    <tr>
                                        <td class="px-4">
                                            <small class="font-monospace text-muted">8g4h5i6j...</small>
                                        </td>
                                        <td class="fw-bold">KES 5,500</td>
                                        <td>254700987654</td>
                                        <td>
                                            <span class="badge bg-success-subtle text-success">Promotion Payment</span>
                                        </td>
                                        <td>
                                            <span class="text-muted">—</span>
                                        </td>
                                        <td>
                                            <span class="badge bg-warning">
                                                <i class="fas fa-clock me-1"></i>Processing
                                            </span>
                                        </td>
                                        <td>
                                            <div>May 24, 2026</div>
                                            <small class="text-muted">14:35:22</small>
                                        </td>
                                        <td class="text-end px-4">
                                            <b-button size="sm" variant="outline-primary"
                                                @click="viewTransaction('8g4h5i6j')">
                                                <i class="fas fa-eye"></i>
                                            </b-button>
                                        </td>
                                    </tr>

                                    <!-- Transaction 4 - Failed -->
                                    <tr>
                                        <td class="px-4">
                                            <small class="font-monospace text-muted">2k3l4m5n...</small>
                                        </td>
                                        <td class="fw-bold">KES 1,200</td>
                                        <td>254733221100</td>
                                        <td>
                                            <span class="badge bg-info-subtle text-info">Business Payment</span>
                                        </td>
                                        <td>
                                            <span class="text-muted">—</span>
                                        </td>
                                        <td>
                                            <span class="badge bg-danger">
                                                <i class="fas fa-times-circle me-1"></i>Failed
                                            </span>
                                        </td>
                                        <td>
                                            <div>May 24, 2026</div>
                                            <small class="text-muted">11:45:10</small>
                                        </td>
                                        <td class="text-end px-4">
                                            <b-button size="sm" variant="outline-primary"
                                                @click="viewTransaction('2k3l4m5n')">
                                                <i class="fas fa-eye"></i>
                                            </b-button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Pagination -->
                        <div class="d-flex justify-content-between align-items-center p-4 border-top">
                            <div class="text-muted">
                                Showing <strong>1-4</strong> of <strong>4,234</strong> transactions
                            </div>
                            <b-pagination v-model="currentPage" :total-rows="4234" :per-page="4"
                                size="sm"></b-pagination>
                        </div>
                    </b-card-body>
                </b-card>
            </b-col>
        </b-row>

        <!-- B2C Transaction Details Modal -->
        <b-modal v-model="showModal" title="B2C Transaction Details" size="xl" hide-footer scrollable>
            <div v-if="selectedTransaction">
                <!-- Transaction Header -->
                <div class="row g-4 mb-4">
                    <div class="col-md-8">
                        <h5 class="fw-bold mb-3">Transaction Information</h5>
                        <div class="bg-light p-3 rounded">
                            <div class="row g-3">
                                <div class="col-6">
                                    <small class="text-muted d-block">Transaction ID</small>
                                    <code class="text-dark">{{ selectedTransaction.id }}</code>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted d-block">M-Pesa Receipt</small>
                                    <strong>{{ selectedTransaction.receipt }}</strong>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted d-block">Conversation ID</small>
                                    <code class="text-dark">{{ selectedTransaction.conversation_id }}</code>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted d-block">Originator Conversation ID</small>
                                    <code class="text-dark">{{ selectedTransaction.originator_id }}</code>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <h6 class="fw-bold mb-3">Status</h6>
                        <div class="text-center p-4 bg-success bg-opacity-10 rounded">
                            <i class="fas fa-check-circle text-success fs-1 mb-2"></i>
                            <h5 class="fw-bold text-success mb-0">Completed</h5>
                        </div>
                    </div>
                </div>

                <!-- Transaction Details -->
                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <h6 class="fw-bold mb-3">Payment Details</h6>
                        <table class="table table-sm table-borderless">
                            <tbody>
                                <tr>
                                    <td class="text-muted" width="50%">Amount</td>
                                    <td class="fw-bold">KES {{ selectedTransaction.amount.toLocaleString() }}</td>
                                </tr>
                                <tr>
                                    <td class="text-muted">Phone Number</td>
                                    <td>{{ selectedTransaction.phone }}</td>
                                </tr>
                                <tr>
                                    <td class="text-muted">Command ID</td>
                                    <td>
                                        <span class="badge bg-info-subtle text-info">{{ selectedTransaction.command_id
                                            }}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="text-muted">Remarks</td>
                                    <td>{{ selectedTransaction.remarks }}</td>
                                </tr>
                                <tr>
                                    <td class="text-muted">Occasion</td>
                                    <td>{{ selectedTransaction.occasion }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="col-md-6">
                        <h6 class="fw-bold mb-3">Transaction Timeline</h6>
                        <table class="table table-sm table-borderless">
                            <tbody>
                                <tr>
                                    <td class="text-muted" width="50%">Initiated</td>
                                    <td>{{ selectedTransaction.initiated_at }}</td>
                                </tr>
                                <tr>
                                    <td class="text-muted">Completed</td>
                                    <td>{{ selectedTransaction.completed_at }}</td>
                                </tr>
                                <tr>
                                    <td class="text-muted">Duration</td>
                                    <td><span class="badge bg-info">45 seconds</span></td>
                                </tr>
                                <tr>
                                    <td class="text-muted">Application</td>
                                    <td>{{ selectedTransaction.app }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- M-Pesa Raw Response -->
                <div class="mb-4">
                    <h6 class="fw-bold mb-3">M-Pesa Raw Response</h6>
                    <div class="bg-dark text-white p-3 rounded">
                        <pre class="mb-0" style="font-size: 12px;"><code>{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request is processed successfully.",
    "OriginatorConversationID": "{{ selectedTransaction.originator_id }}",
    "ConversationID": "{{ selectedTransaction.conversation_id }}",
    "TransactionID": "{{ selectedTransaction.receipt }}",
    "ResultParameters": {
      "ResultParameter": [
        {
          "Key": "TransactionReceipt",
          "Value": "{{ selectedTransaction.receipt }}"
        },
        {
          "Key": "TransactionAmount",
          "Value": {{ selectedTransaction.amount }}
        },
        {
          "Key": "B2CWorkingAccountAvailableFunds",
          "Value": 150000.00
        },
        {
          "Key": "B2CUtilityAccountAvailableFunds",
          "Value": 50000.00
        },
        {
          "Key": "TransactionCompletedDateTime",
          "Value": "{{ selectedTransaction.completed_at }}"
        },
        {
          "Key": "ReceiverPartyPublicName",
          "Value": "{{ selectedTransaction.phone }} - John Doe"
        },
        {
          "Key": "B2CChargesPaidAccountAvailableFunds",
          "Value": 0.00
        }
      ]
    }
  }
}</code></pre>
                    </div>
                </div>

                <!-- Transformed Callback -->
                <div class="mb-4">
                    <h6 class="fw-bold mb-3">Transformed Callback (Sent to Client)</h6>
                    <div class="bg-dark text-white p-3 rounded">
                        <pre class="mb-0" style="font-size: 12px;"><code>{
  "transaction_id": "{{ selectedTransaction.id }}",
  "status": "completed",
  "mpesa_receipt": "{{ selectedTransaction.receipt }}",
  "amount": {{ selectedTransaction.amount }},
  "phone_number": "{{ selectedTransaction.phone }}",
  "command_id": "{{ selectedTransaction.command_id }}",
  "transaction_date": "{{ selectedTransaction.completed_at }}",
  "working_account_balance": 150000.00,
  "utility_account_balance": 50000.00
}</code></pre>
                    </div>
                </div>

                <!-- Callback Status -->
                <div class="mb-4">
                    <h6 class="fw-bold mb-3">Callback Delivery Status</h6>
                    <div class="border rounded p-3">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <small class="text-muted d-block mb-1">Callback URL</small>
                                <small class="font-monospace">{{ selectedTransaction.callback_url }}</small>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted d-block mb-1">Response Status</small>
                                <span class="badge bg-success">200 OK</span>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted d-block mb-1">Attempts</small>
                                <span class="badge bg-info">1/3</span>
                            </div>
                            <div class="col-md-6">
                                <small class="text-muted d-block mb-1">Forwarded At</small>
                                <small>{{ selectedTransaction.callback_forwarded_at }}</small>
                            </div>
                            <div class="col-md-6">
                                <small class="text-muted d-block mb-1">Acknowledged At</small>
                                <small>{{ selectedTransaction.callback_acknowledged_at }}</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Client Response -->
                <div class="mb-4">
                    <h6 class="fw-bold mb-3">Client Response</h6>
                    <div class="bg-dark text-white p-3 rounded">
                        <pre class="mb-0"
                            style="font-size: 12px;"><code>{{ selectedTransaction.client_response }}</code></pre>
                    </div>
                </div>

                <!-- Actions -->
                <div class="d-flex gap-2">
                    <b-button variant="primary" size="sm">
                        <i class="fas fa-download me-2"></i>Download Receipt
                    </b-button>
                    <b-button variant="outline-secondary" size="sm">
                        <i class="fas fa-redo me-2"></i>Retry Callback
                    </b-button>
                    <b-button variant="outline-info" size="sm">
                        <i class="fas fa-search me-2"></i>Query Status
                    </b-button>
                </div>
            </div>
        </b-modal>
    </DefaultLayout>
</template>

<script setup>
import { ref, onMounted } from "vue";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

const currentPage = ref(1);
const showModal = ref(false);
const selectedTransaction = ref(null);

const viewTransaction = (id) => {
    selectedTransaction.value = {
        id: "7a3b2c1d-4e5f-6g7h-8i9j-0k1l2m3n4o5p",
        receipt: "QGH7XYZ123",
        conversation_id: "AG_20260524_20001234567890",
        originator_id: "ws_CO_24052026143045678",
        amount: 3000,
        phone: "254712345678",
        command_id: "BusinessPayment",
        remarks: "Payment for services rendered",
        occasion: "Monthly Payment",
        initiated_at: "May 24, 2026 14:30:00",
        completed_at: "May 24, 2026 14:30:45",
        app: "E-commerce App",
        callback_url: "https://myapp.com/webhooks/mpesa/b2c",
        callback_forwarded_at: "May 24, 2026 14:30:46",
        callback_acknowledged_at: "May 24, 2026 14:30:47",
        client_response: '{\n  "success": true,\n  "message": "Payment processed successfully"\n}',
    };
    showModal.value = true;
};

onMounted(() => {
    // Future: Load B2C transactions from API
});
</script>

<style scoped>
.font-monospace {
    font-family: "Courier New", monospace;
}

pre {
    white-space: pre-wrap;
    word-wrap: break-word;
}
</style>