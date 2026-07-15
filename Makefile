.PHONY: help build up down complete logs info

# Default target
.DEFAULT_GOAL := help

# Colors for terminal output
COLOR_RESET   = \033[0m
COLOR_INFO    = \033[32m
COLOR_WARNING = \033[33m

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build the Docker image
	@echo "$(COLOR_INFO)Building Docker image...$(COLOR_RESET)"
	docker compose build

up: ## Start the application in detached mode
	@echo "$(COLOR_INFO)Starting the application...$(COLOR_RESET)"
	docker compose up -d
	@$(MAKE) info

down: ## Stop and remove the containers
	@echo "$(COLOR_INFO)Stopping the application...$(COLOR_RESET)"
	docker compose down

logs: ## Follow the logs of the application
	docker compose logs -f

info: ## Show connection information
	@echo ""
	@echo "$(COLOR_INFO)====================================================$(COLOR_RESET)"
	@echo "$(COLOR_INFO)  STL-Editor Pro is running (Zeroconf)!             $(COLOR_RESET)"
	@echo "$(COLOR_INFO)====================================================$(COLOR_RESET)"
	@echo "The application is ready and available at:"
	@echo "  =>  http://localhost:3333"
	@echo "  =>  http://127.0.0.1:3333"
	@echo ""
	@echo "To view logs, run: $(COLOR_WARNING)make logs$(COLOR_RESET)"
	@echo "To stop, run:      $(COLOR_WARNING)make down$(COLOR_RESET)"
	@echo "$(COLOR_INFO)====================================================$(COLOR_RESET)"
	@echo ""

complete: ## Build and start the application from scratch (Zeroconf)
	@echo "$(COLOR_INFO)Executing complete setup...$(COLOR_RESET)"
	docker compose down || true
	docker compose up --build -d
	@$(MAKE) info
