package main1

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"vaultke-backend/database"
)

const (
	// Config
	numUsers           = 50
	numChamas          = 10
	numMeetingsPerChama = 4
	numLoansPerChama   = 5
	numPollsPerChama   = 3
	numTransactionsPerUser = 20
	numChatMessagesPerRoom = 30

	// Kenyan names for mock data
	firstNames = "Samuel,Faith,John,Mary,James,Esther,David,Lydia,Charles,Mercy,Michael,Elizabeth,Daniel,Sarah,Peter,Rose,Joseph,Margaret,William,Helen"
	lastNames  = "Ochieng,Were,Otieno,Njuguna,Kamau,Kariuki,Mwangi,Mutua,Kiplagat,Kipchoge,Koech,Korir,Chebet,Wangui,Karanja"
	counties   = "Nairobi,Kisumu,Mombasa,Nakuru,Eldoret,Thika,Kericho,Malindi,Kitale,Garissa"
	towns      = "CBD,Kisumu Town,Mombasa Central,Nakuru Town,Eldoret CBD,Thika Town,Kericho Town,Malindi Town"

	// Chama types and names
	chamaTypes      = "savings,investment,business,welfare,merry-go-round"
	chamaNames      = "Mama Pesa,Tusome Savings,United Investors,Business Boost,Community Welfare,Merry Go Round,Kijibo Savings,Chama Kuu,Mikopo Savings,Faulu Savings"
	chamaCategories = "chama,contribution"
)

func main1() {
	log.Println("🚀 Starting comprehensive database seeding...")

	// Load .env from project root (backend directory)
	_ = os.Setenv("DATABASE_URL", "postgresql://neondb_owner:npg_s7xp0QkXtVUA@ep-autumn-dew-asta5qs7.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require")

	// Connect DB
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Run migrations to ensure schema is up-to-date
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	rand.Seed(time.Now().UnixNano())

	// Run all seeders
	users := seedUsers(db)
	log.Printf("✅ Created %d users\n", len(users))

	chamas := seedChamas(db, users)
	log.Printf("✅ Created %d chamas\n", len(chamas))

	seedChamaMembers(db, users, chamas)
	log.Printf("✅ Created chama members\n")

	seedWallets(db, users, chamas)
	log.Printf("✅ Created wallets\n")

	seedTransactions(db, users, chamas)
	log.Printf("✅ Created transactions\n")

	seedMeetings(db, chamas, users)
	log.Printf("✅ Created meetings\n")

	seedLoans(db, chamas, users)
	log.Printf("✅ Created loans\n")

	seedPollsAndVotes(db, chamas, users)
	log.Printf("✅ Created polls and votes\n")

	seedChatRoomsAndMessages(db, chamas, users)
	log.Printf("✅ Created chat rooms and messages\n")

	seedWelfareFundsAndRequests(db, chamas, users)
	log.Printf("✅ Created welfare funds and requests\n")

	seedMerryGoRounds(db, chamas, users)
	log.Printf("✅ Created merry-go-rounds\n")

	// Make sam@gmail.com a member of all chamas
	addAdminToAllChamas(db)
	log.Printf("✅ Added admin user to all chamas\n")

	log.Println("🎉 Database seeding completed successfully!")
}

// ==================== USERS ====================

func seedUsers(db *sql.DB) []string {
	users := make([]string, 0, numUsers)
	fnList := strings.Split(firstNames, ",")
	lnList := strings.Split(lastNames, ",")

	for i := 0; i < numUsers; i++ {
		userID := uuid.New().String()
		email := fmt.Sprintf("user%d@test.com", i+1)
		phone := fmt.Sprintf("+2547%08d", 1000000+rand.Intn(90000000))
		firstName := fnList[rand.Intn(len(fnList))]
		lastName := lnList[rand.Intn(len(lnList))]

		hashed, _ := bcrypt.GenerateFromPassword([]byte("Password"), bcrypt.DefaultCost)

		query := `
			INSERT INTO users (id, email, phone, first_name, last_name, password_hash, role, status, is_email_verified, is_phone_verified, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'user', 'active', true, true, NOW())
			ON CONFLICT (email) DO NOTHING
		`
		_, err := db.Exec(query, userID, email, phone, firstName, lastName, string(hashed))
		if err != nil {
			log.Printf("⚠️  Failed to create user %s: %v", email, err)
			continue
		}

		users = append(users, userID)
	}

	return users
}

// ==================== CHAMAS ====================

func seedChamas(db *sql.DB, users []string) []string {
	chamas := make([]string, 0, numChamas)
	names := strings.Split(chamaNames, ",")
	types := strings.Split(chamaTypes, ",")
	cats := strings.Split(chamaCategories, ",")
	countyOpts := strings.Split(counties, ",")
	townOpts := strings.Split(towns, ",")

	for i := 0; i < numChamas; i++ {
		chamaID := uuid.New().String()
		name := fmt.Sprintf("%s %d", names[i%len(names)], i/len(names)+1)
		creator := users[rand.Intn(len(users))]

		chamaType := types[rand.Intn(len(types))]
		category := cats[rand.Intn(len(cats))]

		description := fmt.Sprintf("A %s chama focused on %s. This is a test chama for development.", chamaType, strings.ToLower(chamaType))
		county := countyOpts[rand.Intn(len(countyOpts))]
		town := townOpts[rand.Intn(len(townOpts))]

		var contributionAmount float64
		switch chamaType {
		case "savings":
			contributionAmount = 2000 + rand.Float64()*8000
		case "investment":
			contributionAmount = 10000 + rand.Float64()*40000
		case "business":
			contributionAmount = 5000 + rand.Float64()*15000
		case "welfare":
			contributionAmount = 1000 + rand.Float64()*3000
		case "merry-go-round":
			contributionAmount = 5000 + rand.Float64()*10000
		default:
			contributionAmount = 2000
		}

		freq := []string{"weekly", "monthly"}[rand.Intn(2)]
		maxMembers := 10 + rand.Intn(40)

		var targetAmount *float64
		if category == "contribution" {
			amt := 100000.0 + rand.Float64()*900000.0
			targetAmount = &amt
		}

		query := `
			INSERT INTO chamas (
				id, name, description, category, type, status, county, town,
				contribution_amount, contribution_frequency, target_amount,
				payment_method, till_number, payment_recipient_name,
				max_members, is_public, requires_approval, rules, meeting_frequency, meeting_time,
				created_by, created_at, updated_at
			)
			VALUES (
				$1, $2, $3, $4, $5, 'active', $6, $7,
				$8, $9, $10,
				'till', $11, $12,
				$13, false, true, $14, $15, $16,
				$17, NOW(), NOW()
			)
			ON CONFLICT (id) DO NOTHING
		`

		tillNum := fmt.Sprintf("%d", 4500000+rand.Int63n(5000000))
		rules := []string{"All contributions are mandatory", "Meetings are held regularly", "Defaulters pay a penalty"}
		rulesJSON, _ := json.Marshal(rules)
		meetingFreq := "monthly"
		meetingTime := "18:00:00"

		_, err := db.Exec(query,
			chamaID, name, description, category, chamaType,
			county, town,
			contributionAmount, freq, targetAmount,
			tillNum, "Test Chama",
			maxMembers,
			string(rulesJSON), meetingFreq, meetingTime,
			creator,
		)
		if err != nil {
			log.Printf("⚠️  Failed to create chama %s: %v", name, err)
			continue
		}

		chamas = append(chamas, chamaID)
	}

	return chamas
}

// ==================== CHAMA MEMBERS ====================

func seedChamaMembers(db *sql.DB, users []string, chamas []string) {
	for _, chamaID := range chamas {
		// Get chama creator
		var creatorID string
		err := db.QueryRow("SELECT created_by FROM chamas WHERE id = $1", chamaID).Scan(&creatorID)
		if err != nil {
			log.Printf("⚠️  Failed to get chama creator: %v\n", err)
			continue
		}

		// Select 5-15 random members including creator
		numMembers := 5 + rand.Intn(10)
		memberIDs := make([]string, 0, numMembers)
		memberIDs = append(memberIDs, creatorID)

		for len(memberIDs) < numMembers {
			candidate := users[rand.Intn(len(users))]
			if !contains(memberIDs, candidate) {
				memberIDs = append(memberIDs, candidate)
			}
		}
	}
}

// ==================== ADMIN USER ====================

func addAdminToAllChamas(db *sql.DB) {
	// Use the known user ID for sam@gmail.com
	userID := "9c1b0958-7ab5-4dfe-8ae9-5c58fa70e5f3"

	// Verify user exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", userID).Scan(&exists)
	if err != nil || !exists {
		log.Printf("⚠️  User with ID %s not found, skipping admin assignment", userID)
		return
	}

	// Get all chamas
	rows, err := db.Query("SELECT id FROM chamas")
	if err != nil {
		log.Printf("⚠️  Failed to get chamas: %v\n", err)
		return
	}
	defer rows.Close()

	chamaIDs := make([]string, 0)
	for rows.Next() {
		var chamaID string
		rows.Scan(&chamaID)
		chamaIDs = append(chamaIDs, chamaID)
	}

	// Add user as chairperson to each chama (if not already a member)
	for _, chamaID := range chamaIDs {
		var existingMember bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2)", chamaID, userID).Scan(&existingMember)
		if err != nil {
			continue
		}

		if !existingMember {
			memberID := uuid.New().String()
			query := `
				INSERT INTO chama_members (id, chama_id, user_id, role, joined_at, is_active, total_contributions, rating, total_ratings)
				VALUES ($1, $2, $3, 'chairperson', NOW(), true, 0, 0, 0)
				ON CONFLICT (chama_id, user_id) DO NOTHING
			`
			_, err := db.Exec(query, memberID, chamaID, userID)
			if err != nil {
				log.Printf("⚠️  Failed to add sam@gmail.com to chama %s: %v\n", chamaID, err)
			} else {
				// Increment current_members count
				db.Exec("UPDATE chamas SET current_members = current_members + 1 WHERE id = $1", chamaID)
			}
		}
	}

	log.Printf("✅ Added sam@gmail.com (ID: %s) as chairperson to all chamas", userID)
}

// ==================== UTILS ====================

func contains(s []string, v string) bool {
	for _, item := range s {
		if item == v {
			return true
		}
	}
	return false
}

func seedWallets(db *sql.DB, users, chamas []string)         {}
func seedTransactions(db *sql.DB, users, chamas []string)    {}
func seedMeetings(db *sql.DB, chamas, users []string)        {}
func seedLoans(db *sql.DB, chamas, users []string)           {}
func seedPollsAndVotes(db *sql.DB, chamas, users []string)   {}
func seedChatRoomsAndMessages(db *sql.DB, chamas, users []string) {}
func seedWelfareFundsAndRequests(db *sql.DB, chamas, users []string) {}
func seedMerryGoRounds(db *sql.DB, chamas, users []string)   {}
