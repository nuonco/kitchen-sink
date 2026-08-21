package delivery

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"net/url"
	"os"
	"time"

	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

//go:embed schema.sql
var schemaSQL string

// migrationLockKey serializes migrations across the api and worker pods, both
// of which run them at start (pg_advisory_lock is per-database).
const migrationLockKey = 874_211_042

// Config is the delivery store's connection config, read from the env the
// chart sets (DB_PASSWORD arrives via a secretKeyRef to the Nuon-synced
// db-password Secret).
type Config struct {
	Host     string
	Port     string
	Name     string
	User     string
	Password string
}

func ConfigFromEnv() Config {
	get := func(key, fallback string) string {
		if v := os.Getenv(key); v != "" {
			return v
		}
		return fallback
	}
	return Config{
		Host:     get("DB_HOST", "relay-db"),
		Port:     get("DB_PORT", "5432"),
		Name:     get("DB_NAME", "relay"),
		User:     get("DB_USER", "relay"),
		Password: os.Getenv("DB_PASSWORD"),
	}
}

func (c Config) dsn() string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.User, c.Password),
		Host:     c.Host + ":" + c.Port,
		Path:     "/" + c.Name,
		RawQuery: "sslmode=disable&connect_timeout=5",
	}
	return u.String()
}

// Store wraps the Postgres connection.
type Store struct {
	db *sql.DB
	l  *zap.Logger
}

// Open connects, retrying until the deadline — the database pod can come up
// after the api/worker pods do. It then applies the embedded idempotent
// migrations and seed under an advisory lock.
func Open(ctx context.Context, cfg Config, l *zap.Logger) (*Store, error) {
	db, err := sql.Open("postgres", cfg.dsn())
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(4)

	for {
		err = db.PingContext(ctx)
		if err == nil {
			break
		}
		l.Info("delivery store not reachable yet, retrying",
			zap.String("host", cfg.Host), zap.Error(err))
		select {
		case <-ctx.Done():
			db.Close()
			return nil, fmt.Errorf("waiting for postgres: %w", ctx.Err())
		case <-time.After(2 * time.Second):
		}
	}

	s := &Store{db: db, l: l}
	if err := s.migrateAndSeed(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// migrateAndSeed applies the schema and seed data. Everything in it is
// idempotent (CREATE ... IF NOT EXISTS, INSERT ... ON CONFLICT DO NOTHING),
// which is what makes the demo's emptyDir Postgres acceptable: a database
// pod restart loses the rows, and the next api/worker start rebuilds a
// working, populated store.
func (s *Store) migrateAndSeed(ctx context.Context) error {
	conn, err := s.db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration conn: %w", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", migrationLockKey); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		_, _ = conn.ExecContext(ctx, "SELECT pg_advisory_unlock($1)", migrationLockKey)
	}()

	if _, err := conn.ExecContext(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	if err := seed(ctx, conn, s.l); err != nil {
		return fmt.Errorf("apply seed: %w", err)
	}
	s.l.Info("delivery store ready (schema + seed applied)")
	return nil
}

func (s *Store) Close() error { return s.db.Close() }
