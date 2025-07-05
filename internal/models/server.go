package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Server struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null;unique"`
	Hostname  string    `json:"hostname" gorm:"not null"`
	Port      int       `json:"port" gorm:"default:22"`
	User      string    `json:"user" gorm:"not null"`
	AuthType  string    `json:"auth_type" gorm:"not null"` // "password" or "key"
	Password  string    `json:"password,omitempty"`
	PrivateKey string   `json:"private_key,omitempty"`
	PemFile   string    `json:"pem_file,omitempty"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *Server) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

type ServerRequest struct {
	Name       string `json:"name" binding:"required"`
	Hostname   string `json:"hostname" binding:"required"`
	Port       int    `json:"port"`
	User       string `json:"user" binding:"required"`
	AuthType   string `json:"auth_type" binding:"required,oneof=password key"`
	Password   string `json:"password,omitempty"`
	PrivateKey string `json:"private_key,omitempty"`
	PemFile    string `json:"pem_file,omitempty"`
	IsActive   *bool  `json:"is_active,omitempty"`
}

type ServerUpdateRequest struct {
	Name       string `json:"name,omitempty"`
	Hostname   string `json:"hostname,omitempty"`
	Port       *int   `json:"port,omitempty"`
	User       string `json:"user,omitempty"`
	AuthType   string `json:"auth_type,omitempty"`
	Password   string `json:"password,omitempty"`
	PrivateKey string `json:"private_key,omitempty"`
	PemFile    string `json:"pem_file,omitempty"`
	IsActive   *bool  `json:"is_active,omitempty"`
}

type ServerResponse struct {
	Server
	// Don't expose sensitive fields in response
	Password   string `json:"-"`
	PrivateKey string `json:"-"`
}
