package database

import (
	"job-executor/internal/models"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Initialize(databaseURL string) (*gorm.DB, error) {
	var db *gorm.DB
	var err error
	
	// Determine database type based on URL
	if strings.HasPrefix(databaseURL, "postgres://") || strings.HasPrefix(databaseURL, "postgresql://") {
		// PostgreSQL connection
		db, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	} else {
		// SQLite connection (default)
		db, err = gorm.Open(sqlite.Open(databaseURL), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	}
	
	if err != nil {
		return nil, err
	}

	// Auto-migrate the schema in correct order (referenced tables first)
	if err := db.AutoMigrate(&models.Server{}); err != nil {
		return nil, err
	}
	
	if err := db.AutoMigrate(&models.Job{}); err != nil {
		return nil, err
	}

	return db, nil
}
