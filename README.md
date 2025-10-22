# Meno API

RESTful API built with Express, MongoDB, and clean architecture principles.

## 🏗️ Architecture

This project follows **Clean Architecture** (Hexagonal/Onion Architecture) with clear separation of concerns:

```
src/
├── core/           # Business logic layer
├── components/     # Infrastructure layer (database, storage, logging)
├── api/            # HTTP interface layer
├── models/         # Data models
└── utils/          # Utilities
```

### Dependency Flow

```
Controllers → Core Services → Components
```

- **Controllers** handle HTTP concerns only
- **Core Services** contain business logic
- **Components** handle infrastructure (database, storage, logging)

## 🚀 Features

- ✅ **Clean Architecture** - Separation of concerns, testable, maintainable
- ✅ **Pluggable Storage** - Interface-based storage (local filesystem, GCS, S3)
- ✅ **MongoDB Database** - Mongoose ODM with schema validation
- ✅ **Winston Logging** - Structured logging with file rotation
- ✅ **Swagger Documentation** - Auto-generated API docs from code
- ✅ **Error Handling** - Global error handler with custom error classes
- ✅ **Request Validation** - Joi schema validation
- ✅ **Health Checks** - Readiness and liveness endpoints

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your configuration
```

## 🔧 Configuration

Edit `.env` file:

```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/meno-api
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./storage
LOG_LEVEL=info
```

## 🏃 Running the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:3000`

## 📚 API Documentation

### Interactive Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:6001/api-docs
- **Health Check**: http://localhost:6001/api/health

### OpenAPI Specification

For frontend development or code generation:

- **OpenAPI YAML**: `docs/openapi.yaml` (1600+ lines, 23 endpoints)
- **Documentation Guide**: See `docs/README.md` for usage instructions

To regenerate the OpenAPI spec after making changes:

```bash
npm run generate:openapi
```

## 🛣️ API Endpoints

### Health
- `GET /api/health` - Health check
- `GET /api/health/ready` - Readiness check

### Users
- `GET /api/users` - Get all users (paginated)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/avatar` - Upload user avatar

### Files
- `POST /api/files` - Upload file
- `GET /api/files` - Get all files (paginated)
- `GET /api/files/:id` - Get file by ID
- `GET /api/files/:id/download` - Download file
- `GET /api/files/:id/url` - Get file URL
- `DELETE /api/files/:id` - Delete file

## 🔌 Storage Providers

### Local Filesystem (Default)

```bash
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./storage
```

### Google Cloud Storage

```bash
STORAGE_PROVIDER=gcs
GCS_BUCKET_NAME=your-bucket-name
GCS_KEY_FILE=./path/to/service-account-key.json
```

**Note**: GCS provider requires implementation. See `src/components/storage/providers/gcs.provider.js`

### Adding New Storage Providers

1. Create new provider class implementing `IStorageProvider` interface
2. Add to `StorageFactory` in `src/components/storage/storage.factory.js`
3. Update environment configuration

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## 📝 Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🗂️ Project Structure

```
meno-api/
├── src/
│   ├── api/                    # HTTP layer
│   │   ├── controllers/        # Request handlers
│   │   ├── middleware/         # Express middleware
│   │   ├── routes/             # Route definitions
│   │   └── validators/         # Request validation
│   ├── components/             # Infrastructure
│   │   ├── config/             # Configuration
│   │   ├── database/           # MongoDB connection
│   │   ├── logging/            # Winston logger
│   │   └── storage/            # Storage abstraction
│   ├── core/                   # Business logic
│   │   ├── interfaces/         # Contracts
│   │   └── services/           # Domain services
│   ├── models/                 # MongoDB schemas
│   ├── utils/                  # Utilities
│   ├── app.js                  # Express app setup
│   └── server.js               # Entry point
├── storage/                    # Local file storage
├── logs/                       # Log files
├── tests/                      # Test files
├── .env.example                # Environment template
├── .gitignore
├── package.json
└── README.md
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/meno-api` |
| `STORAGE_PROVIDER` | Storage provider (local, gcs, s3) | `local` |
| `LOCAL_STORAGE_PATH` | Local storage path | `./storage` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_DIR` | Log directory | `./logs` |

## 🤝 Contributing

1. Follow clean architecture principles
2. Controllers only call core services
3. Core services call components via interfaces
4. Add tests for new features
5. Update Swagger documentation

## 📄 License

ISC
