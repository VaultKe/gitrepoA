<template>
    <DefaultLayout>
        <b-row class="justify-content-center">
            <b-col cols="12">
                <!-- Page Header -->
                <div class="mb-4">
                    <h4 class="fw-bold mb-1">API Documentation</h4>
                    <p class="text-muted mb-0">Complete guide to integrating Demulla Gateway API</p>
                </div>

                <b-row class="g-4">
                    <!-- Sidebar Navigation -->
                    <b-col lg="3">
                        <b-card class="border-0 shadow-sm sticky-top" style="top: 20px;">
                            <b-card-body>
                                <h6 class="fw-bold mb-3">Quick Links</h6>
                                <ul class="list-unstyled">
                                    <li class="mb-2">
                                        <a href="#getting-started" class="text-decoration-none">Getting Started</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#authentication" class="text-decoration-none">Authentication</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#2fa-verification" class="text-decoration-none">2FA Verification</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#applications" class="text-decoration-none">Applications</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#credentials" class="text-decoration-none">Credentials</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#b2c" class="text-decoration-none">B2C Transactions</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#stk" class="text-decoration-none">STK Push</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#paybill" class="text-decoration-none">Paybill Payments</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#query-status" class="text-decoration-none">Query Transaction</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#get-transactions" class="text-decoration-none">Get Transactions</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#webhooks" class="text-decoration-none">Webhooks</a>
                                    </li>
                                    <li class="mb-2">
                                        <a href="#errors" class="text-decoration-none">Error Codes</a>
                                    </li>
                                </ul>

                                <hr>

                                <h6 class="fw-bold mb-3">Resources</h6>
                                <div class="d-grid gap-2">
                                    <b-button variant="outline-primary" size="sm">
                                        <i class="fas fa-download me-2"></i>Download PDF
                                    </b-button>
                                    <b-button variant="outline-secondary" size="sm">
                                        <i class="fas fa-code me-2"></i>Code Examples
                                    </b-button>
                                </div>
                            </b-card-body>
                        </b-card>
                    </b-col>

                    <!-- Documentation Content -->
                    <b-col lg="9">
                        <!-- Getting Started -->
                        <b-card id="getting-started" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">Getting Started</h4>
                                <p class="text-muted">
                                    Welcome to the Demulla Gateway API documentation. This guide will help you integrate
                                    M-Pesa payments into your application quickly and securely.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Base URL</h6>
                                <div class="bg-dark text-white p-3 rounded mb-3">
                                    <code>https://gateway.demulla.com/api/v1</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Key Features</h6>
                                <ul class="text-muted">
                                    <li>Secure Vault Credential Management with HashiCorp Vault</li>
                                    <li>Simplified API responses (no nested arrays)</li>
                                    <li>Complete transaction logging and audit trails</li>
                                    <li>Automatic callback retries with exponential backoff</li>
                                    <li>Support for B2C, C2B STK Push, and Paybill payments</li>
                                </ul>

                                <h6 class="fw-bold mt-4 mb-3">Quick Example</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="cURL" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>curl -X POST https://gateway.demulla.com/api/v1/apps/{app_id}/stk-push \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "phone_number": "254708374149",
    "account_reference": "ORDER12345",
    "transaction_desc": "Payment for Order #12345"
  }'</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>
                            </b-card-body>
                        </b-card>

                        <!-- Authentication -->
                        <b-card id="authentication" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-lock text-primary me-2"></i>Authentication
                                </h4>
                                <p class="text-muted">
                                    All API requests require authentication using a Bearer token. The authentication
                                    process involves logging in with your email and password.
                                </p>

                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    <strong>Note:</strong> After initial login, you'll need to complete 2FA verification
                                    to receive your access token.
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Endpoint</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">POST /api/v1/auth/login</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Request Body</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>email</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Your registered email address</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>password</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Your account password</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$url = "https://gateway.demulla.com/api/v1/auth/login";

$data = [
    'email' => 'user@example.com',
    'password' => 'your_password'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function login() {
  try {
    const response = await axios.post(
      'https://gateway.demulla.com/api/v1/auth/login',
      {
        email: 'user@example.com',
        password: 'your_password'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(response.data);
  } catch (error) {
    console.error('Login failed:', error.response.data);
  }
}

login();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

url = "https://gateway.demulla.com/api/v1/auth/login"

payload = {
    "email": "user@example.com",
    "password": "your_password"
}

headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
result = response.json()
print(json.dumps(result, indent=2))</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Response (First Time Login - 2FA Setup Required)</h6>
                                <div class="bg-dark text-white p-3 rounded mb-3">
                                    <pre class="mb-0"><code>{
  "success": true,
  "data": {
    "requires_2fa_setup": true,
    "qr_code_url": "otpauth://totp/DemullaGateway:user@example.com?secret=BASE32SECRET&issuer=DemullaGateway",
    "secret": "BASE32SECRET",
    "message": "First time login. Please setup Google Authenticator."
  }
}</code></pre>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Response (Subsequent Login - 2FA Code Required)</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "success": true,
  "data": {
    "requires_2fa_code": true,
    "message": "Please enter your 2FA code."
  }
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- 2FA Verification -->
                        <b-card id="2fa-verification" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-shield-alt text-success me-2"></i>2FA Verification
                                </h4>
                                <p class="text-muted">
                                    After login, verify your identity using the 6-digit code from Google Authenticator
                                    to receive your access token.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Endpoint</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">POST /api/v1/auth/2fa/verify</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Request Headers</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Header</b-th>
                                            <b-th>Value</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>X-Device-Info</code></b-td>
                                            <b-td>JSON string</b-td>
                                            <b-td>Device information for session management</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Request Body</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>email</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Your registered email address</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>password</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Your account password</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>code</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>6-digit code from Google Authenticator</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$url = "https://gateway.demulla.com/api/v1/auth/2fa/verify";

$data = [
    'email' => 'user@example.com',
    'password' => 'your_password',
    'code' => '123456'
];

$deviceInfo = json_encode([
    'browser' => 'Chrome',
    'os' => 'Windows',
    'device' => 'Desktop'
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-Device-Info: ' . $deviceInfo
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
$token = $result['data']['token'];
echo "Access Token: " . $token;
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function verify2FA() {
  try {
    const response = await axios.post(
      'https://gateway.demulla.com/api/v1/auth/2fa/verify',
      {
        email: 'user@example.com',
        password: 'your_password',
        code: '123456'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Info': JSON.stringify({
            browser: 'Chrome',
            os: 'macOS',
            device: 'Desktop'
          })
        }
      }
    );
    
    const token = response.data.data.token;
    console.log('Access Token:', token);
  } catch (error) {
    console.error('2FA verification failed:', error.response.data);
  }
}

verify2FA();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

url = "https://gateway.demulla.com/api/v1/auth/2fa/verify"

payload = {
    "email": "user@example.com",
    "password": "your_password",
    "code": "123456"
}

headers = {
    "Content-Type": "application/json",
    "X-Device-Info": json.dumps({
        "browser": "Chrome",
        "os": "Linux",
        "device": "Desktop"
    })
}

response = requests.post(url, json=payload, headers=headers)
result = response.json()
token = result['data']['token']
print(f"Access Token: {token}")</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Success Response</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
      "email": "user@example.com",
      "username": "johndoe",
      "first_name": "John",
      "last_name": "Doe"
    }
  }
}</code></pre>
                                </div>

                                <div class="alert alert-warning mt-3">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Important:</strong> Store the access token securely. Include it in the
                                    Authorization header for all subsequent API requests.
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Applications -->
                        <b-card id="applications" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-th-large text-info me-2"></i>Application Management
                                </h4>
                                <p class="text-muted">
                                    Applications are containers for your M-Pesa credentials. Each application represents
                                    a different integration or environment (sandbox vs production).
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Create Application</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">POST /api/v1/apps</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Request Body</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>name</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Application name</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>description</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Application description</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$url = "https://gateway.demulla.com/api/v1/apps";
$token = "YOUR_ACCESS_TOKEN";

$data = [
    'name' => 'My Business App',
    'description' => 'Production M-Pesa integration'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function createApp() {
  const token = 'YOUR_ACCESS_TOKEN';
  
  try {
    const response = await axios.post(
      'https://gateway.demulla.com/api/v1/apps',
      {
        name: 'My Business App',
        description: 'Production M-Pesa integration'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(response.data);
  } catch (error) {
    console.error('Failed to create app:', error.response.data);
  }
}

createApp();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

url = "https://gateway.demulla.com/api/v1/apps"
token = "YOUR_ACCESS_TOKEN"

payload = {
    "name": "My Business App",
    "description": "Production M-Pesa integration"
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

response = requests.post(url, json=payload, headers=headers)
result = response.json()
print(json.dumps(result, indent=2))</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Success Response</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "success": true,
  "message": "Application created successfully",
  "data": {
    "id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
    "name": "My Business App",
    "description": "Production M-Pesa integration",
    "slug": "my-business-app",
    "created_at": "2026-05-24T12:00:00Z"
  }
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Credentials Configuration -->
                        <b-card id="credentials" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-key text-warning me-2"></i>M-Pesa Credentials Configuration
                                </h4>
                                <p class="text-muted">
                                    Configure your M-Pesa API credentials for an application. All credentials are
                                    encrypted and stored securely in HashiCorp Vault.
                                </p>

                                <div class="alert alert-success">
                                    <i class="fas fa-shield-alt me-2"></i>
                                    <strong>Security:</strong> Your credentials are never stored in plain text. They are
                                    immediately encrypted and stored in HashiCorp Vault.
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Endpoint</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">POST /api/v1/apps/{app_id}/credentials</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Request Body</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>environment</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>sandbox or production</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>consumer_key</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>M-Pesa API consumer key</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>consumer_secret</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>M-Pesa API consumer secret</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>passkey</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>STK Push passkey</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>shortcode</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Your business shortcode</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>initiator_name</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>API initiator name</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>security_credential</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Encrypted initiator password</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>b2c_shortcode</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>B2C shortcode (if different)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>callback_url</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Your webhook URL</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$appId = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f";
$url = "https://gateway.demulla.com/api/v1/apps/{$appId}/credentials";
$token = "YOUR_ACCESS_TOKEN";

$data = [
    'environment' => 'sandbox',
    'consumer_key' => 'your_consumer_key',
    'consumer_secret' => 'your_consumer_secret',
    'passkey' => 'your_stk_push_passkey',
    'shortcode' => '174379',
    'initiator_name' => 'testapi',
    'security_credential' => 'encrypted_password',
    'b2c_shortcode' => '600000',
    'callback_url' => 'https://yourapp.com/webhook'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function configureCredentials() {
  const appId = '9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f';
  const token = 'YOUR_ACCESS_TOKEN';
  
  try {
    const response = await axios.post(
      `https://gateway.demulla.com/api/v1/apps/${appId}/credentials`,
      {
        environment: 'sandbox',
        consumer_key: 'your_consumer_key',
        consumer_secret: 'your_consumer_secret',
        passkey: 'your_stk_push_passkey',
        shortcode: '174379',
        initiator_name: 'testapi',
        security_credential: 'encrypted_password',
        b2c_shortcode: '600000',
        callback_url: 'https://yourapp.com/webhook'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(response.data);
  } catch (error) {
    console.error('Failed to configure credentials:', error.response.data);
  }
}

configureCredentials();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

app_id = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f"
url = f"https://gateway.demulla.com/api/v1/apps/{app_id}/credentials"
token = "YOUR_ACCESS_TOKEN"

payload = {
    "environment": "sandbox",
    "consumer_key": "your_consumer_key",
    "consumer_secret": "your_consumer_secret",
    "passkey": "your_stk_push_passkey",
    "shortcode": "174379",
    "initiator_name": "testapi",
    "security_credential": "encrypted_password",
    "b2c_shortcode": "600000",
    "callback_url": "https://yourapp.com/webhook"
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

response = requests.post(url, json=payload, headers=headers)
result = response.json()
print(json.dumps(result, indent=2))</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Success Response</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "success": true,
  "message": "Credentials stored successfully in Vault",
  "data": {
    "vault_path": "demulla/gateway/apps/9c8f7e6d.../credentials",
    "environment": "sandbox",
    "configured_at": "2026-05-24T12:00:00Z"
  }
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- B2C Transaction -->
                        <b-card id="b2c" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-arrow-right text-success me-2"></i>B2C Transactions
                                </h4>
                                <p class="text-muted">
                                    Send money from your business to customer mobile wallets. Use cases include salary
                                    payments, refunds, cashback rewards, and disbursements.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Endpoint</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">POST /api/v1/apps/{app_id}/b2c</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Request Body</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>amount</code></b-td>
                                            <b-td>number</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Amount to send (minimum 10 KES)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>phone_number</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Recipient phone (format: 254XXXXXXXXX)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>command_id</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>BusinessPayment, SalaryPayment, or PromotionPayment</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>remarks</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Transaction remarks</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>occasion</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Occasion for the payment</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$appId = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f";
$url = "https://gateway.demulla.com/api/v1/apps/{$appId}/b2c";
$token = "YOUR_ACCESS_TOKEN";

$data = [
    'amount' => 1000,
    'phone_number' => '254708374149',
    'command_id' => 'BusinessPayment',
    'remarks' => 'Refund for order #12345',
    'occasion' => 'Customer Refund'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function initiateB2C() {
  const appId = '9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f';
  const token = 'YOUR_ACCESS_TOKEN';
  
  try {
    const response = await axios.post(
      `https://gateway.demulla.com/api/v1/apps/${appId}/b2c`,
      {
        amount: 1000,
        phone_number: '254708374149',
        command_id: 'BusinessPayment',
        remarks: 'Refund for order #12345',
        occasion: 'Customer Refund'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(response.data);
  } catch (error) {
    console.error('B2C transaction failed:', error.response.data);
  }
}

initiateB2C();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

app_id = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f"
url = f"https://gateway.demulla.com/api/v1/apps/{app_id}/b2c"
token = "YOUR_ACCESS_TOKEN"

payload = {
    "amount": 1000,
    "phone_number": "254708374149",
    "command_id": "BusinessPayment",
    "remarks": "Refund for order #12345",
    "occasion": "Customer Refund"
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

response = requests.post(url, json=payload, headers=headers)
result = response.json()
print(json.dumps(result, indent=2))</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Success Response</h6>
                                <div class="bg-dark text-white p-3 rounded mb-3">
                                    <pre class="mb-0"><code>{
  "success": true,
  "message": "B2C transaction initiated successfully",
  "data": {
    "transaction": {
      "id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
      "amount": 1000,
      "phone_number": "254708374149",
      "status": "processing",
      "mpesa_request_id": "ws_CO_240520261200000001",
      "created_at": "2026-05-24T12:00:00Z"
    }
  }
}</code></pre>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Webhook Callback (Success)</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "transaction_id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
  "status": "completed",
  "mpesa_receipt": "QGH7XYZ123",
  "amount": 1000,
  "phone_number": "254708374149",
  "transaction_date": "20260524120000",
  "completed_at": "2026-05-24T12:00:45Z"
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- STK Push -->
                        <b-card id="stk" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-mobile-alt text-primary me-2"></i>STK Push (C2B)
                                </h4>
                                <p class="text-muted">
                                    Send a payment prompt directly to the customer's phone. This is the recommended
                                    method for collecting payments as it provides the best user experience.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Endpoint</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">POST /api/v1/apps/{app_id}/stk-push</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Request Body</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>amount</code></b-td>
                                            <b-td>number</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Amount to collect (minimum 1 KES)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>phone_number</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Customer phone (format: 254XXXXXXXXX)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>account_reference</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Your reference (e.g., order number)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>transaction_desc</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Description shown to customer</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$appId = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f";
$url = "https://gateway.demulla.com/api/v1/apps/{$appId}/stk-push";
$token = "YOUR_ACCESS_TOKEN";

$data = [
    'amount' => 1000,
    'phone_number' => '254708374149',
    'account_reference' => 'ORDER12345',
    'transaction_desc' => 'Payment for Order #12345'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function initiateSTKPush() {
  const appId = '9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f';
  const token = 'YOUR_ACCESS_TOKEN';
  
  try {
    const response = await axios.post(
      `https://gateway.demulla.com/api/v1/apps/${appId}/stk-push`,
      {
        amount: 1000,
        phone_number: '254708374149',
        account_reference: 'ORDER12345',
        transaction_desc: 'Payment for Order #12345'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(response.data);
  } catch (error) {
    console.error('STK Push failed:', error.response.data);
  }
}

initiateSTKPush();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

app_id = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f"
url = f"https://gateway.demulla.com/api/v1/apps/{app_id}/stk-push"
token = "YOUR_ACCESS_TOKEN"

payload = {
    "amount": 1000,
    "phone_number": "254708374149",
    "account_reference": "ORDER12345",
    "transaction_desc": "Payment for Order #12345"
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

response = requests.post(url, json=payload, headers=headers)
result = response.json()
print(json.dumps(result, indent=2))</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Success Response</h6>
                                <div class="bg-dark text-white p-3 rounded mb-3">
                                    <pre class="mb-0"><code>{
  "success": true,
  "message": "STK push sent successfully",
  "data": {
    "transaction": {
      "id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
      "amount": 1000,
      "phone_number": "254708374149",
      "account_reference": "ORDER12345",
      "status": "pending",
      "checkout_request_id": "ws_CO_240520261200000001",
      "created_at": "2026-05-24T12:00:00Z"
    }
  }
}</code></pre>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Webhook Callback</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>// Success
{
  "transaction_id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
  "status": "completed",
  "mpesa_receipt": "QGH7XYZ123",
  "amount": 1000,
  "phone_number": "254708374149",
  "transaction_date": "20260524120000",
  "completed_at": "2026-05-24T12:00:45Z"
}

// Failed or Cancelled
{
  "transaction_id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
  "status": "failed", // or "cancelled"
  "reason": "Customer cancelled the request"
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Paybill -->
                        <b-card id="paybill" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-receipt text-info me-2"></i>Paybill Payments (C2B)
                                </h4>
                                <p class="text-muted">
                                    Configure your paybill to receive payments. Customers can pay through M-Pesa menu by
                                    entering your paybill number and account reference.
                                </p>

                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    <strong>Note:</strong> Paybill integration requires callback URL configuration in
                                    your M-Pesa portal. The gateway provides validation and confirmation URLs.
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Callback URLs</h6>
                                <div class="bg-dark text-white p-3 rounded mb-3">
                                    <pre class="mb-0"><code>Validation URL:
https://gateway.demulla.com/api/v1/callbacks/mpesa/paybill/validate/{username}/{app_slug}

Confirmation URL:
https://gateway.demulla.com/api/v1/callbacks/mpesa/paybill/confirm/{username}/{app_slug}</code></pre>
                                </div>

                                <p class="text-muted">
                                    Replace <code>{'{username}'}</code> with your Demulla username and
                                    <code>{'{app_slug}'}</code> with your application slug.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Webhook Callback Structure</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "transaction_id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
  "transaction_type": "paybill",
  "amount": 1000,
  "phone_number": "254708374149",
  "account_reference": "ACCOUNT123",
  "mpesa_receipt": "QGH7XYZ123",
  "transaction_date": "20260524120000",
  "first_name": "John",
  "middle_name": "",
  "last_name": "Doe",
  "status": "completed"
}</code></pre>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Handling Paybill Callbacks</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
// webhook.php
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Verify the callback
if (!isset($data['transaction_id'])) {
    http_response_code(400);
    exit('Invalid callback');
}

// Process the payment
$transactionId = $data['transaction_id'];
$amount = $data['amount'];
$phoneNumber = $data['phone_number'];
$accountRef = $data['account_reference'];
$mpesaReceipt = $data['mpesa_receipt'];

// Update your database
// ...

// Return success response
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Payment processed successfully'
]);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const data = req.body;
  
  // Verify the callback
  if (!data.transaction_id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid callback'
    });
  }
  
  // Process the payment
  const {
    transaction_id,
    amount,
    phone_number,
    account_reference,
    mpesa_receipt
  } = data;
  
  // Update your database
  // ...
  
  // Return success response
  res.status(200).json({
    success: true,
    message: 'Payment processed successfully'
  });
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    data = request.get_json()
    
    # Verify the callback
    if 'transaction_id' not in data:
        return jsonify({
            'success': False,
            'message': 'Invalid callback'
        }), 400
    
    # Process the payment
    transaction_id = data['transaction_id']
    amount = data['amount']
    phone_number = data['phone_number']
    account_reference = data['account_reference']
    mpesa_receipt = data['mpesa_receipt']
    
    # Update your database
    # ...
    
    # Return success response
    return jsonify({
        'success': True,
        'message': 'Payment processed successfully'
    }), 200

if __name__ == '__main__':
    app.run(port=5000)</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>
                            </b-card-body>
                        </b-card>

                        <!-- Query Transaction Status -->
                        <b-card id="query-status" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-search text-warning me-2"></i>Query Transaction Status
                                </h4>
                                <p class="text-muted">
                                    Query the status of any transaction using its transaction ID. Useful for verifying
                                    payment status or recovering from missed webhooks.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Endpoint</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">POST /api/v1/apps/{app_id}/query-transaction</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Request Body</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>transaction_id</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-danger">Yes</span></b-td>
                                            <b-td>Transaction ID to query</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$appId = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f";
$url = "https://gateway.demulla.com/api/v1/apps/{$appId}/query-transaction";
$token = "YOUR_ACCESS_TOKEN";

$data = [
    'transaction_id' => '9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f'
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function queryTransaction() {
  const appId = '9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f';
  const token = 'YOUR_ACCESS_TOKEN';
  
  try {
    const response = await axios.post(
      `https://gateway.demulla.com/api/v1/apps/${appId}/query-transaction`,
      {
        transaction_id: '9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(response.data);
  } catch (error) {
    console.error('Query failed:', error.response.data);
  }
}

queryTransaction();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

app_id = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f"
url = f"https://gateway.demulla.com/api/v1/apps/{app_id}/query-transaction"
token = "YOUR_ACCESS_TOKEN"

payload = {
    "transaction_id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f"
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

response = requests.post(url, json=payload, headers=headers)
result = response.json()
print(json.dumps(result, indent=2))</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Success Response</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "success": true,
  "data": {
    "transaction": {
      "id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
      "type": "stk_push",
      "amount": 1000,
      "phone_number": "254708374149",
      "account_reference": "ORDER12345",
      "status": "completed",
      "mpesa_receipt": "QGH7XYZ123",
      "transaction_date": "20260524120000",
      "created_at": "2026-05-24T12:00:00Z",
      "completed_at": "2026-05-24T12:00:45Z"
    }
  }
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Get Transactions -->
                        <b-card id="get-transactions" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-list text-secondary me-2"></i>Get Transactions
                                </h4>
                                <p class="text-muted">
                                    Retrieve a list of all transactions for your application with filtering and
                                    pagination support.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Endpoint</h6>
                                <div class="bg-light p-3 rounded mb-3">
                                    <code class="text-dark">GET /api/v1/apps/{app_id}/transactions</code>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Query Parameters</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Parameter</b-th>
                                            <b-th>Type</b-th>
                                            <b-th>Required</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>page</code></b-td>
                                            <b-td>number</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Page number (default: 1)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>per_page</code></b-td>
                                            <b-td>number</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Items per page (default: 20, max: 100)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>status</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Filter by status (pending, completed, failed)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>type</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Filter by type (b2c, stk_push, paybill)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>start_date</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>Start date (YYYY-MM-DD)</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>end_date</code></b-td>
                                            <b-td>string</b-td>
                                            <b-td><span class="badge bg-secondary">No</span></b-td>
                                            <b-td>End date (YYYY-MM-DD)</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Code Examples</h6>
                                <b-tabs content-class="mt-3" class="code-tabs">
                                    <b-tab title="PHP" active>
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>&lt;?php
$appId = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f";
$token = "YOUR_ACCESS_TOKEN";

$params = [
    'page' => 1,
    'per_page' => 20,
    'status' => 'completed',
    'type' => 'stk_push',
    'start_date' => '2026-05-01',
    'end_date' => '2026-05-24'
];

$url = "https://gateway.demulla.com/api/v1/apps/{$appId}/transactions?" . http_build_query($params);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?&gt;</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Node.js">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>const axios = require('axios');

async function getTransactions() {
  const appId = '9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f';
  const token = 'YOUR_ACCESS_TOKEN';
  
  try {
    const response = await axios.get(
      `https://gateway.demulla.com/api/v1/apps/${appId}/transactions`,
      {
        params: {
          page: 1,
          per_page: 20,
          status: 'completed',
          type: 'stk_push',
          start_date: '2026-05-01',
          end_date: '2026-05-24'
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(response.data);
  } catch (error) {
    console.error('Failed to fetch transactions:', error.response.data);
  }
}

getTransactions();</code></pre>
                                        </div>
                                    </b-tab>
                                    <b-tab title="Python">
                                        <div class="bg-dark text-white p-3 rounded">
                                            <pre class="mb-0"><code>import requests
import json

app_id = "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f"
url = f"https://gateway.demulla.com/api/v1/apps/{app_id}/transactions"
token = "YOUR_ACCESS_TOKEN"

params = {
    "page": 1,
    "per_page": 20,
    "status": "completed",
    "type": "stk_push",
    "start_date": "2026-05-01",
    "end_date": "2026-05-24"
}

headers = {
    "Authorization": f"Bearer {token}"
}

response = requests.get(url, params=params, headers=headers)
result = response.json()
print(json.dumps(result, indent=2))</code></pre>
                                        </div>
                                    </b-tab>
                                </b-tabs>

                                <h6 class="fw-bold mt-4 mb-3">Success Response</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "9c8f7e6d-5b4a-3c2d-1e0f-9a8b7c6d5e4f",
        "type": "stk_push",
        "amount": 1000,
        "phone_number": "254708374149",
        "account_reference": "ORDER12345",
        "status": "completed",
        "mpesa_receipt": "QGH7XYZ123",
        "created_at": "2026-05-24T12:00:00Z",
        "completed_at": "2026-05-24T12:00:45Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Webhooks -->
                        <b-card id="webhooks" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-exchange-alt text-danger me-2"></i>Webhook System
                                </h4>
                                <p class="text-muted">
                                    Demulla Gateway uses webhooks to notify your application about transaction status
                                    changes in real-time.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Callback Architecture</h6>
                                <ul class="text-muted">
                                    <li>Automatic retry with exponential backoff (3 attempts)</li>
                                    <li>Complete audit trail stored for every transaction</li>
                                    <li>No separate callback logs table - all data embedded in transactions</li>
                                    <li>75% database reduction compared to traditional implementations</li>
                                </ul>

                                <h6 class="fw-bold mt-4 mb-3">Retry Schedule</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Attempt</b-th>
                                            <b-th>Delay</b-th>
                                            <b-th>Max Time</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td>1</b-td>
                                            <b-td>Immediate</b-td>
                                            <b-td>30 seconds</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td>2</b-td>
                                            <b-td>60 seconds</b-td>
                                            <b-td>2 minutes</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td>3</b-td>
                                            <b-td>5 minutes</b-td>
                                            <b-td>10 minutes</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    <strong>Note:</strong> Even if all retries fail, transaction data is preserved. You
                                    can retrieve it later using the Query Transaction endpoint.
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Webhook Security Best Practices</h6>
                                <ul class="text-muted">
                                    <li>Always verify the transaction_id exists in your system</li>
                                    <li>Check the status field before processing</li>
                                    <li>Use HTTPS for your webhook URLs</li>
                                    <li>Implement idempotency to handle duplicate callbacks</li>
                                    <li>Return HTTP 200 quickly - process asynchronously if needed</li>
                                    <li>Log all incoming webhooks for debugging</li>
                                </ul>

                                <h6 class="fw-bold mt-4 mb-3">Expected Response</h6>
                                <div class="bg-dark text-white p-3 rounded">
                                    <pre class="mb-0"><code>HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Callback received successfully"
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Error Codes -->
                        <b-card id="errors" class="border-0 shadow-sm mb-4">
                            <b-card-body>
                                <h4 class="fw-bold mb-3">
                                    <i class="fas fa-exclamation-triangle text-danger me-2"></i>Error Codes
                                </h4>
                                <p class="text-muted">
                                    All API errors follow a consistent format with HTTP status codes and descriptive
                                    messages.
                                </p>

                                <h6 class="fw-bold mt-4 mb-3">Error Response Format</h6>
                                <div class="bg-dark text-white p-3 rounded mb-3">
                                    <pre class="mb-0"><code>{
  "success": false,
  "message": "Descriptive error message",
  "errors": {
    "field_name": ["Error details"]
  }
}</code></pre>
                                </div>

                                <h6 class="fw-bold mt-4 mb-3">Common HTTP Status Codes</h6>
                                <b-table-simple bordered responsive class="mb-3">
                                    <b-thead>
                                        <b-tr>
                                            <b-th>Code</b-th>
                                            <b-th>Status</b-th>
                                            <b-th>Description</b-th>
                                        </b-tr>
                                    </b-thead>
                                    <b-tbody>
                                        <b-tr>
                                            <b-td><code>200</code></b-td>
                                            <b-td>OK</b-td>
                                            <b-td>Request successful</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>201</code></b-td>
                                            <b-td>Created</b-td>
                                            <b-td>Resource created successfully</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>400</code></b-td>
                                            <b-td>Bad Request</b-td>
                                            <b-td>Invalid request parameters</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>401</code></b-td>
                                            <b-td>Unauthorized</b-td>
                                            <b-td>Invalid or missing authentication token</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>403</code></b-td>
                                            <b-td>Forbidden</b-td>
                                            <b-td>Insufficient permissions</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>404</code></b-td>
                                            <b-td>Not Found</b-td>
                                            <b-td>Resource not found</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>422</code></b-td>
                                            <b-td>Unprocessable Entity</b-td>
                                            <b-td>Validation errors</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>429</code></b-td>
                                            <b-td>Too Many Requests</b-td>
                                            <b-td>Rate limit exceeded</b-td>
                                        </b-tr>
                                        <b-tr>
                                            <b-td><code>500</code></b-td>
                                            <b-td>Internal Server Error</b-td>
                                            <b-td>Server error - contact support</b-td>
                                        </b-tr>
                                    </b-tbody>
                                </b-table-simple>

                                <h6 class="fw-bold mt-4 mb-3">Common Error Examples</h6>
                                <div class="bg-dark text-white p-3 rounded mb-3">
                                    <pre class="mb-0"><code>// Validation Error (422)
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "phone_number": ["Invalid phone number format. Use 254XXXXXXXXX"],
    "amount": ["Amount must be at least 1 KES"]
  }
}

// Unauthorized (401)
{
  "success": false,
  "message": "Unauthorized. Please login to continue."
}

// Not Found (404)
{
  "success": false,
  "message": "Transaction not found"
}

// Rate Limit (429)
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "retry_after": 60
}</code></pre>
                                </div>
                            </b-card-body>
                        </b-card>

                        <!-- Download Full Documentation -->
                        <b-card class="border-0 shadow-sm bg-success text-white">
                            <b-card-body class="text-center py-5">
                                <i class="fas fa-book fs-1 mb-3"></i>
                                <h4 class="fw-bold mb-3">Complete Documentation</h4>
                                <p class="mb-4">Download the full API documentation PDF with all endpoints, examples,
                                    and best practices.</p>
                                <b-button variant="light" size="lg" href="/api/v1/docs/download">
                                    <i class="fas fa-download me-2"></i>Download Full Documentation (PDF)
                                </b-button>
                            </b-card-body>
                        </b-card>
                    </b-col>
                </b-row>
            </b-col>
        </b-row>
    </DefaultLayout>
</template>

<script setup>
import { onMounted } from "vue";
import DefaultLayout from "@/layouts/DefaultLayout.vue";

onMounted(() => {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
</script>

<style scoped>
pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    margin: 0;
}

code {
    font-family: 'Courier New', monospace;
    font-size: 13px;
}

.code-tabs :deep(.nav-link) {
    color: #6c757d;
    font-size: 14px;
    padding: 8px 16px;
}

.code-tabs :deep(.nav-link.active) {
    color: #0d6efd;
    font-weight: 600;
}

.sticky-top {
    position: sticky;
    top: 20px;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
}

.list-unstyled a {
    color: #6c757d;
    transition: color 0.2s;
}

.list-unstyled a:hover {
    color: #0d6efd;
}

/* Smooth scrolling */
html {
    scroll-behavior: smooth;
}

/* Code block styling */
.bg-dark code {
    color: #00ff00;
}

/* Table styling */
.table-simple {
    font-size: 14px;
}

.table-simple code {
    background-color: #f8f9fa;
    padding: 2px 6px;
    border-radius: 3px;
    color: #d63384;
}
</style>