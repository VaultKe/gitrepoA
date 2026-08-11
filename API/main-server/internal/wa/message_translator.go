package wa

import (
	"database/sql"
)

// MessageTranslator converts between VaultKe chat formats and OpenWA formats.
type MessageTranslator struct {
	userMapper *UserMapper
	roomMapper *RoomMapper
}

// NewMessageTranslator creates a new translator.
func NewMessageTranslator(db *sql.DB) *MessageTranslator {
	return &MessageTranslator{
		userMapper: NewUserMapper(db),
		roomMapper: NewRoomMapper(db),
	}
}

// ToVaultKeMessage converts an OpenWA message to the shape the UI expects.
func (t *MessageTranslator) ToVaultKeMessage(msg OpenWAMessage) map[string]interface{} {
	senderID := ""
	if msg.Author != "" {
		// Group message: author is the participant JID
		uid, err := t.userMapper.ResolveJIDToUserID(msg.Author)
		if err == nil {
			senderID = uid
		} else {
			senderID = msg.Author
		}
	} else if msg.From != "" {
		uid, err := t.userMapper.ResolveJIDToUserID(msg.From)
		if err == nil {
			senderID = uid
		} else {
			senderID = msg.From
		}
	}

	roomID := msg.ChatID
	if mapped, ok := t.roomMapper.ReverseLookup(msg.ChatID); ok {
		roomID = mapped
	}

	status := msg.Status
	if status == "" {
		status = "pending"
	}

	// OpenWA timestamp is seconds; UI expects milliseconds.
	createdAt := msg.Timestamp * 1000
	if createdAt == 0 && !msg.CreatedAt.IsZero() {
		createdAt = msg.CreatedAt.UnixMilli()
	}

	imageUrl := ""
	if msg.Metadata != nil {
		if m, ok := msg.Metadata["media"].(string); ok && m != "" {
			imageUrl = m
		} else if m, ok := msg.Metadata["mediaUrl"].(string); ok && m != "" {
			imageUrl = m
		}
	}
	if imageUrl == "" && msg.MediaPath != "" {
		imageUrl = msg.MediaPath
	}

	return map[string]interface{}{
		"id":        msg.ID,
		"roomId":    roomID,
		"senderId":  senderID,
		"content":   msg.Body,
		"type":      t.translateType(msg.Type),
		"status":    status,
		"createdAt": createdAt,
		"imageUrl":  imageUrl,
		"metadata":  msg.Metadata,
		"isOwn":     msg.Direction == "outgoing",
	}
}

// FromVaultKeSend converts a VaultKe send request into an OpenWA-compatible payload.
func (t *MessageTranslator) FromVaultKeSend(roomID, content, msgType string, metadata map[string]interface{}) (string, map[string]interface{}, error) {
	chatID, ok := t.roomMapper.Lookup(roomID)
	if !ok {
		return "", nil, sql.ErrNoRows
	}

	payload := map[string]interface{}{
		"chatId": chatID,
	}

	switch msgType {
	case "image":
		if metadata != nil {
			if uri, ok := metadata["imageUri"].(string); ok && uri != "" {
				payload["base64"] = uri
				payload["mimetype"] = "image/jpeg"
				payload["caption"] = content
			} else if url, ok := metadata["imageUrl"].(string); ok && url != "" {
				payload["url"] = url
				payload["mimetype"] = "image/jpeg"
				payload["caption"] = content
			}
		}
		return "/sessions/{sessionId}/messages/send-image", payload, nil
	case "file", "document":
		if metadata != nil {
			if uri, ok := metadata["fileUri"].(string); ok && uri != "" {
				payload["base64"] = uri
				payload["filename"] = metadata["fileName"]
				payload["mimetype"] = metadata["mimeType"]
				payload["caption"] = content
			}
		}
		return "/sessions/{sessionId}/messages/send-document", payload, nil
	case "audio":
		if metadata != nil {
			if uri, ok := metadata["audioUri"].(string); ok && uri != "" {
				payload["base64"] = uri
				payload["mimetype"] = metadata["mimeType"]
				payload["ptt"] = true
			}
		}
		return "/sessions/{sessionId}/messages/send-audio", payload, nil
	default:
		payload["text"] = content
		return "/sessions/{sessionId}/messages/send-text", payload, nil
	}
}

// translateType maps OpenWA message types to VaultKe types.
func (t *MessageTranslator) translateType(waType string) string {
	switch waType {
	case "image":
		return "image"
	case "video":
		return "video"
	case "audio", "ptt":
		return "audio"
	case "document", "sticker":
		return "file"
	case "location":
		return "location"
	case "contact":
		return "contact"
	case "poll":
		return "poll"
	default:
		return "text"
	}
}

// AckToStatus maps OpenWA ack levels to VaultKe message statuses.
func AckToStatus(ack int) string {
	switch ack {
	case 0:
		return "pending"
	case 1:
		return "sent"
	case 2:
		return "delivered"
	case 3, 4:
		return "read"
	default:
		return "pending"
	}
}

// DeliveryStatusToStatus maps OpenWA DeliveryStatus enum to VaultKe status.
func DeliveryStatusToStatus(status string) string {
	switch status {
	case "sent":
		return "sent"
	case "delivered":
		return "delivered"
	case "read":
		return "read"
	case "failed":
		return "failed"
	case "pending":
		return "pending"
	default:
		return "pending"
	}
}
