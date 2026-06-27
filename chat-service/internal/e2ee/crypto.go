package e2ee

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"

	"golang.org/x/crypto/hkdf"
)

type KeyExchange struct {
	PublicKey  []byte
	PrivateKey []byte
}

func GenerateKeyPair() (*KeyExchange, error) {
	curve := ecdh.P256()
	priv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	return &KeyExchange{
		PublicKey:  priv.PublicKey().Bytes(),
		PrivateKey: priv.Bytes(),
	}, nil
}

func privateKeyFromBytes(b []byte) (*ecdh.PrivateKey, error) {
	return ecdh.P256().NewPrivateKey(b)
}

func publicKeyFromBytes(b []byte) (*ecdh.PublicKey, error) {
	return ecdh.P256().NewPublicKey(b)
}

func DeriveSharedKey(privateKeyBytes, peerPublicKeyBytes []byte) ([]byte, error) {
	priv, err := privateKeyFromBytes(privateKeyBytes)
	if err != nil {
		return nil, err
	}
	peerPub, err := publicKeyFromBytes(peerPublicKeyBytes)
	if err != nil {
		return nil, err
	}

	sharedSecret, err := priv.ECDH(peerPub)
	if err != nil {
		return nil, err
	}

	derivedKey, err := deriveKeyHKDF(sharedSecret)
	if err != nil {
		return nil, err
	}
	return derivedKey, nil
}

func EncryptMessage(plaintext string, peerPublicKeyBytes []byte) (ciphertext []byte, err error) {
	ke, err := GenerateKeyPair()
	if err != nil {
		return nil, err
	}

	key, err := DeriveSharedKey(ke.PrivateKey, peerPublicKeyBytes)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	encrypted := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)

	result := make([]byte, 0)
	result = append(result, ke.PublicKey...)
	result = append(result, encrypted...)
	return result, nil
}

func DecryptMessage(ciphertext []byte, peerPublicKeyBytes, privateKeyBytes []byte) (plaintext string, err error) {
	key, err := DeriveSharedKey(privateKeyBytes, peerPublicKeyBytes)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := aesGCM.NonceSize()
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	plaintextBytes, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintextBytes), nil
}

func DecryptWithPublicKeyBytes(ciphertext []byte, privateKeyBytes []byte) (plaintext string, err error) {
	pubKeySize := 65
	publicKeyBytes := ciphertext[:pubKeySize]

	return DecryptMessage(ciphertext, publicKeyBytes, privateKeyBytes)
}

func deriveKeyHKDF(secret []byte) ([]byte, error) {
	hrng := hkdf.New(sha256.New, secret, nil, []byte("chat-service-e2ee"))
	key := make([]byte, 32)
	if _, err := hrng.Read(key); err != nil {
		return nil, err
	}
	return key, nil
}

func PublicKeyToBase64(pub []byte) string {
	return base64.StdEncoding.EncodeToString(pub)
}

func Base64ToPublicKey(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}