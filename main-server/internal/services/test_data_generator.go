package services

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
)

// townsList is a slice of Kenyan town names for location field
var townsList = strings.Split("CBD,Kisumu Town,Mombasa Central,Nakuru Town,Eldoret CBD,Thika Town,Kericho Town,Malindi Town", ",")

// Constants for test data generation
const (
	firstNames = "Samuel,Faith,John,Mary,James,Esther,David,Lydia,Charles,Mercy,Michael,Elizabeth,Daniel,Sarah,Peter,Rose,Joseph,Margaret,William,Helen"
	lastNames  = "Ochieng,Were,Otieno,Njuguna,Kamau,Kariuki,Mwangi,Mutua,Kiplagat,Kipchoge,Koech,Korir,Chebet,Wangui,Karanja"
	counties   = "Nairobi,Kisumu,Mombasa,Nakuru,Eldoret,Thika,Kericho,Malindi,Kitale,Garissa"
	towns      = "CBD,Kisumu Town,Mombasa Central,Nakuru Town,Eldoret CBD,Thika Town,Kericho Town,Malindi Town"
)

// TestDataGenerator generates random test data for development/testing
type TestDataGenerator struct {
	db       *sql.DB
	running  bool
	interval time.Duration
	stopChan chan bool
	lastRun  time.Time
	stats    map[string]int
	mu       chan struct{} // simple lock using channel
}

// NewTestDataGenerator creates a new test data generator
func NewTestDataGenerator(db *sql.DB) *TestDataGenerator {
	return &TestDataGenerator{
		db:       db,
		running:  false,
		interval: 5 * time.Minute,
		stopChan: make(chan bool),
		stats:    make(map[string]int),
		mu:       make(chan struct{}, 1),
	}
}

// Start begins the periodic data generation
func (g *TestDataGenerator) Start(interval time.Duration) {
	if g.running {
		return // already running
	}
	g.interval = interval
	g.running = true

	log.Printf("Test data generator started (interval: %v)", interval)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Test data generator panic recovered: %v", r)
			}
		}()

		// Run immediately on start
		g.GenerateBatch(5)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				g.GenerateBatch(5)
			case <-g.stopChan:
				log.Println("Test data generator stopped")
				return
			}
		}
	}()
}

// Stop halts the generator
func (g *TestDataGenerator) Stop() {
	g.running = false
	g.stopChan <- true
}

// IsRunning returns whether generator is active
func (g *TestDataGenerator) IsRunning() bool {
	return g.running
}

// GenerateBatch creates a batch of random test data
func (g *TestDataGenerator) GenerateBatch(batchSize int) map[string]int {
	g.mu <- struct{}{}
	defer func() { <-g.mu }()

	stats := make(map[string]int)

	rand.Seed(time.Now().UnixNano())

	// Fetch existing user and chama IDs
	users := g.getRandomUserIDs(20)
	if len(users) == 0 {
		log.Println("No users found in database - skipping data generation")
		return stats
	}
	chamas := g.getRandomChamaIDs(10)
	if len(chamas) == 0 {
		log.Println("No chamas found in database - skipping data generation")
		return stats
	}

	// Generate various data types
	for i := 0; i < batchSize; i++ {
		// 1. Transactions (30%)
		if rand.Intn(100) < 30 {
			g.createRandomTransaction(users, chamas)
			stats["transactions"]++
		}

		// 2. Meetings (10%)
		if rand.Intn(100) < 10 {
			g.createRandomMeeting(chamas, users)
			stats["meetings"]++
		}

		// 3. Loans (15%)
		if rand.Intn(100) < 15 {
			g.createRandomLoan(chamas, users)
			stats["loans"]++
		}

		// 4. Welfare Requests (10%)
		if rand.Intn(100) < 10 {
			g.createRandomWelfareRequest(chamas, users)
			stats["welfare_requests"]++
		}

		// 5. Chat Messages (20%)
		if rand.Intn(100) < 20 {
			g.createRandomChatMessage(chamas, users)
			stats["chat_messages"]++
		}

		// 6. Polls (10%)
		if rand.Intn(100) < 10 {
			g.createRandomPoll(chamas, users)
			stats["polls"]++
		}

		// 7. Contributions to welfare funds (5%)
		if rand.Intn(100) < 5 {
			g.createRandomWelfareContribution(chamas, users)
			stats["welfare_contributions"]++
		}
	}

	// Update global stats
	for k, v := range stats {
		g.stats[k] += v
	}
	g.lastRun = time.Now()

	log.Printf("Test data batch generated: %+v", stats)
	return stats
}

// GetStats returns generation statistics
func (g *TestDataGenerator) GetStats() map[string]interface{} {
	g.mu <- struct{}{}
	defer func() { <-g.mu }()

	return map[string]interface{}{
		"running":  g.running,
		"interval": g.interval.String(),
		"last_run": g.lastRun,
		"total":    g.stats,
	}
}

// ==================== HELPER METHODS ====================

func (g *TestDataGenerator) getRandomUserIDs(count int) []string {
	query := "SELECT id FROM users ORDER BY RANDOM() LIMIT $1"
	rows, err := g.db.Query(query, count*2) // fetch extra to pick randomly
	if err != nil {
		return nil
	}
	defer rows.Close()

	ids := make([]string, 0)
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}

	// Shuffle and pick
	rand.Shuffle(len(ids), func(i, j int) {
		ids[i], ids[j] = ids[j], ids[i]
	})

	if len(ids) > count {
		return ids[:count]
	}
	return ids
}

func (g *TestDataGenerator) getRandomChamaIDs(count int) []string {
	query := "SELECT id FROM chamas ORDER BY RANDOM() LIMIT $1"
	rows, err := g.db.Query(query, count*2)
	if err != nil {
		return nil
	}
	defer rows.Close()

	ids := make([]string, 0)
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}

	rand.Shuffle(len(ids), func(i, j int) {
		ids[i], ids[j] = ids[j], ids[i]
	})

	if len(ids) > count {
		return ids[:count]
	}
	return ids
}

func (g *TestDataGenerator) pickRandom(arr []string) string {
	if len(arr) == 0 {
		return ""
	}
	return arr[rand.Intn(len(arr))]
}

func (g *TestDataGenerator) createRandomTransaction(users, chamas []string) {
	userID := g.pickRandom(users)
	chamaID := g.pickRandom(chamas)

	// Get user wallet
	var personalWallet string
	err := g.db.QueryRow("SELECT id FROM wallets WHERE owner_id = $1 AND type = 'personal'", userID).Scan(&personalWallet)
	if err != nil {
		return
	}

	// Determine transaction type
	txTypes := []string{"deposit", "withdrawal", "contribution", "transfer"}
	txType := txTypes[rand.Intn(len(txTypes))]

	amount := 1000.0 + rand.Float64()*10000
	paymentMethod := []string{"mpesa", "wallet_transfer", "cash"}[rand.Intn(3)]

	var fromWallet, toWallet, recipientID *string

	switch txType {
	case "deposit":
		// Deposit into user wallet (external source)
		toWallet = &personalWallet
	case "withdrawal":
		// Withdraw from user wallet to external
		fromWallet = &personalWallet
	case "contribution":
		// Contribution to a chama
		var chamaWallet string
		if err := g.db.QueryRow("SELECT id FROM wallets WHERE owner_id = $1 AND type = 'chama'", chamaID).Scan(&chamaWallet); err == nil {
			fromWallet = &personalWallet
			toWallet = &chamaWallet
			recipientID = &chamaID
		}
	case "transfer":
		// Transfer to another user
		otherUser := g.pickRandom(users)
		if otherUser == userID {
			return
		}
		var otherWallet string
		if err := g.db.QueryRow("SELECT id FROM wallets WHERE owner_id = $1 AND type = 'personal'", otherUser).Scan(&otherWallet); err == nil {
			fromWallet = &personalWallet
			toWallet = &otherWallet
		}
	}

	txID := uuid.New().String()
	query := `
		INSERT INTO transactions (
			id, from_wallet_id, to_wallet_id, type, status, amount, currency,
			description, payment_method, initiated_by, chama_id, recipient_id, created_at
		) VALUES ($1, $2, $3, $4, 'completed', $5, 'KES', $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (id) DO NOTHING
	`
	desc := fmt.Sprintf("Auto-generated %s", txType)
	_, _ = g.db.Exec(query,
		txID, fromWallet, toWallet, txType, amount, desc, paymentMethod, userID, &chamaID, recipientID,
	)
}

func (g *TestDataGenerator) createRandomMeeting(chamas, users []string) {
	chamaID := g.pickRandom(chamas)
	creator := g.pickRandom(users)

	meetingID := uuid.New().String()
	title := fmt.Sprintf("Scheduled Meeting %s", time.Now().AddDate(0, 0, 7+rand.Intn(30)).Format("Jan 02"))
	desc := "Recurring monthly meeting"
	sched := time.Now().AddDate(0, 0, 7+rand.Intn(30))
	duration := 60 + rand.Intn(60)
	loc := townsList[rand.Intn(len(townsList))]

	query := `
		INSERT INTO meetings (
			id, chama_id, title, description, scheduled_at, duration,
			location, meeting_type, status, created_by, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 'physical', 'scheduled', $8, NOW())
		ON CONFLICT (id) DO NOTHING
	`
	_, _ = g.db.Exec(query,
		meetingID, chamaID, title, desc, sched, duration, loc, creator,
	)
}

func (g *TestDataGenerator) createRandomLoan(chamas, users []string) {
	chamaID := g.pickRandom(chamas)
	borrower := g.pickRandom(users)
	loanID := uuid.New().String()
	loanType := []string{"personal", "business", "emergency", "education"}[rand.Intn(4)]
	amount := 5000.0 + rand.Float64()*30000
	interest := 5.0 + rand.Float64()*10.0
	duration := 3 + rand.Intn(12)
	purpose := fmt.Sprintf(" funding for %s", loanType)

	status := "pending"
	var approvedBy *string
	var approvedAt, disbursedAt time.Time

	if rand.Intn(100) < 50 { // 50% approved
		status = "active"
		approver := g.pickRandom(users)
		approvedBy = &approver
		approvedAt = time.Now().Add(-time.Duration(rand.Intn(30)) * 24 * time.Hour)
		disbursedAt = approvedAt.Add(24 * time.Hour)
	}

	total := amount * (1 + interest/100*float64(duration)/12)
	paid := 0.0
	if status == "active" {
		paid = total * (float64(rand.Intn(30)) / 100.0)
	}

	query := `
		INSERT INTO loans (
			id, borrower_id, chama_id, type, amount, interest_rate, duration,
			purpose, status, approved_by, approved_at, disbursed_at,
			total_amount, paid_amount, remaining_amount, required_guarantors,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`
	_, _ = g.db.Exec(query,
		loanID, borrower, chamaID, loanType, amount, interest, duration,
		purpose, status, approvedBy, approvedAt, disbursedAt,
		total, paid, total-paid, 2,
	)
}

func (g *TestDataGenerator) createRandomWelfareRequest(chamas, users []string) {
	chamaID := g.pickRandom(chamas)
	requester := g.pickRandom(users)
	requestID := uuid.New().String()
	title := fmt.Sprintf("Assistance Needed #%d", rand.Intn(1000))
	desc := "Request for financial support due to emergency"
	amount := 1000.0 + rand.Float64()*5000
	cat := "welfare"
	urgency := []string{"low", "medium", "high"}[rand.Intn(3)]

	query := `
		INSERT INTO welfare_requests (id, chama_id, requester_id, title, description, amount, category, urgency, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
		ON CONFLICT (id) DO NOTHING
	`
	_, _ = g.db.Exec(query, requestID, chamaID, requester, title, desc, amount, cat, urgency)
}

func (g *TestDataGenerator) createRandomChatMessage(chamas, users []string) {
	chamaID := g.pickRandom(chamas)

	// Get or create chat room
	var roomID string
	err := g.db.QueryRow("SELECT id FROM chat_rooms WHERE chama_id = $1 LIMIT 1", chamaID).Scan(&roomID)
	if err != nil {
		// Create room
		roomID = uuid.New().String()
		creator := g.pickRandom(users)
		_, _ = g.db.Exec(
			`INSERT INTO chat_rooms (id, name, type, chama_id, created_by, is_active, created_at)
			 VALUES ($1, $2, 'chama', $3, $4, true, NOW()) ON CONFLICT DO NOTHING`,
			roomID, "Group Chat", chamaID, creator,
		)
	}

	// Get room members
	rows, _ := g.db.Query("SELECT user_id FROM chama_members WHERE chama_id = $1 AND is_active = true", chamaID)
	var members []string
	for rows.Next() {
		var uid string
		rows.Scan(&uid)
		members = append(members, uid)
	}
	rows.Close()

	if len(members) == 0 {
		return
	}

	sender := g.pickRandom(members)
	msgID := uuid.New().String()
	content := fmt.Sprintf("Test auto-message at %s", time.Now().Format("15:04:05"))

	_, _ = g.db.Exec(
		`INSERT INTO chat_messages (id, room_id, sender_id, content, type, created_at)
		 VALUES ($1, $2, $3, $4, 'text', NOW()) ON CONFLICT DO NOTHING`,
		msgID, roomID, sender, content,
	)
}

func (g *TestDataGenerator) createRandomPoll(chamas, users []string) {
	chamaID := g.pickRandom(chamas)
	creator := g.pickRandom(users)
	pollID := uuid.New().String()
	title := fmt.Sprintf("Community Poll #%d", rand.Intn(1000))
	desc := "Automated generated poll"
	start := time.Now()
	end := time.Now().AddDate(0, 0, 7)

	query := `
		INSERT INTO polls (
			id, chama_id, title, description, poll_type, created_by,
			start_date, end_date, status, is_anonymous, requires_majority,
			majority_percentage, total_eligible_voters, total_votes_cast, created_at
		) VALUES ($1, $2, $3, $4, 'general', $5, $6, $7, 'active', false, false, 50.0, $8, 0, NOW())
		ON CONFLICT DO NOTHING
	`
	eligible := 5 + rand.Intn(15)
	_, _ = g.db.Exec(query, pollID, chamaID, title, desc, creator, start, end, eligible)

	// Create options
	optionTexts := []string{"Yes", "No", "Maybe"}
	for idx, opt := range optionTexts {
		optID := uuid.New().String()
		_, _ = g.db.Exec(
			"INSERT INTO poll_options (id, poll_id, option_text, option_order, vote_count) VALUES ($1, $2, $3, $4, 0) ON CONFLICT DO NOTHING",
			optID, pollID, opt, idx,
		)
	}
}

func (g *TestDataGenerator) createRandomWelfareContribution(chamas, users []string) {
	chamaID := g.pickRandom(chamas)
	contributor := g.pickRandom(users)

	var welfareID string
	err := g.db.QueryRow("SELECT id FROM welfare_funds WHERE chama_id = $1 LIMIT 1", chamaID).Scan(&welfareID)
	if err != nil {
		// Create a welfare fund if none exists
		welfareID = uuid.New().String()
		_, _ = g.db.Exec(`
			INSERT INTO welfare_funds (id, chama_id, name, description, purpose, contribution_per_member, created_by, status, created_at)
			VALUES ($1, $2, $3, $4, 'welfare', 1000, $5, 'active', NOW())
			ON CONFLICT DO NOTHING
		`, welfareID, chamaID, "Auto Welfare", "Auto-generated welfare fund", contributor)
	}

	contribID := uuid.New().String()
	amount := 500.0 + rand.Float64()*2000
	paymentMethod := "mpesa"

	query := `
		INSERT INTO welfare_contributions (
			id, welfare_fund_id, user_id, amount, payment_method, contributed_at
		) VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT DO NOTHING
	`
	_, _ = g.db.Exec(query, contribID, welfareID, contributor, amount, paymentMethod)
}

// SetInterval changes the generation interval
func (g *TestDataGenerator) SetInterval(d time.Duration) {
	g.interval = d
}

// ResetStats clears statistics
func (g *TestDataGenerator) ResetStats() {
	g.mu <- struct{}{}
	defer func() { <-g.mu }()
	g.stats = make(map[string]int)
}
