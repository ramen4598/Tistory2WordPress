# Quickstart Guide: Tistory to WordPress Migration

**Branch**: `002-tistory-wordpress-migration` | **Date**: 2025-12-28
**Purpose**: Developer onboarding and setup instructions

## Prerequisites

- Python 3.11 or higher
- pip (Python package manager)
- Git
- Virtual environment (recommended)

## Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd Tistory2Wordpress
```

### 2. Create Virtual Environment

```bash
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Tistory blog URL (required)
TISTORY_URL=https://yourblog.tistory.com

# Optional: Number of worker threads (default: 5)
WORKERS=5

# Optional: Rate limit in requests per second (default: 1)
RATE_LIMIT=1

# Optional: Output WXR filename (default: .output.xml)
OUTPUT_FILE=.output.xml
```

### 5. Verify Installation

```bash
python -m pytest tests/ -v
```

## Development Workflow

### Project Structure

```
src/
├── models/          # Pydantic data models
├── services/        # Business logic services
├── cli/            # Click CLI interface
├── lib/            # Configuration and utilities
└── utils/          # Helper functions

tests/
├── contract/       # Contract tests
├── integration/    # Integration tests
└── unit/           # Unit tests
```

### Running Tests

Run all tests:
```bash
pytest
```

Run specific test file:
```bash
pytest tests/unit/test_crawler.py
```

Run with coverage:
```bash
pytest --cov=src --cov-report=html
```

### Code Style

Install linting tools:
```bash
pip install black flake8 mypy
```

Run linters:
```bash
black src/ tests/
flake8 src/ tests/
mypy src/
```

## Using the Tool

### Basic Migration

```bash
python -m src.cli.main migrate
```

### Resume from Interruption

```bash
python -m src.cli.main migrate --resume
```

### Specify Output File

```bash
python -m src.cli.main migrate --output my-blog.xml
```

### Specify Worker Count

```bash
python -m src.cli.main migrate --workers 10
```

### Specify Rate Limit

```bash
python -m src.cli.main migrate --rate-limit 2
```

## Development Guidelines

### Adding New Services

1. Create service in `src/services/`
2. Add unit tests in `tests/unit/`
3. Add integration tests if needed
4. Update documentation

### Data Models

- Use Pydantic for all data models
- Define models in `src/models/`
- Include type hints
- Add validation logic where needed

### Error Handling

- Use specific exception types
- Log errors with context
- Implement retry logic for transient errors
- Never crash on individual post failures

### Parallel Processing

- Use Python `threading` module
- Ensure thread-safe operations
- Use rate limiter for HTTP requests
- Track progress across workers

## Testing Strategy

### Unit Tests

Test individual services in isolation:
```bash
pytest tests/unit/
```

Mock external dependencies (HTTP requests, file system)

### Contract Tests

Verify WXR format compliance:
```bash
pytest tests/contract/test_wxr_generator.py
```

Validate XML structure against WordPress Importer requirements

### Integration Tests

Test full migration flow:
```bash
pytest tests/integration/test_full_migration.py
```

Use sample Tistory blog (public, accessible)

## Debugging

### Enable Debug Logging

```bash
export LOG_LEVEL=DEBUG
python -m src.cli.main migrate
```

### Inspect Intermediate Data

- Check `link_mapping.json` for internal links
- Check `state.json` for resume state
- Check `downloads/` for downloaded attachments

### Common Issues

**Rate limiting errors**:
- Reduce rate limit: `--rate-limit 0.5`
- Increase delay between retries

**Memory issues with large blogs**:
- Reduce worker count: `--workers 2`
- Process in smaller batches

**Parsing errors**:
- Check Tistory blog HTML structure
- Verify parser selectors
- Review error logs

## Contributing

1. Create feature branch from `002-tistory-wordpress-migration`
2. Implement changes with tests
3. Run full test suite
4. Update documentation
5. Submit pull request

## Further Reading

- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Data Models](./data-model.md)
- [WXR Format Contract](./contracts/wxr-format.md)
- [Sequence Diagram](./sequence-diagram.md)
