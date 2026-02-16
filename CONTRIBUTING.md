# Contributing to Terminal App Template

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

1. **Fork the Repository**
   ```bash
   # Fork via GitHub UI, then clone your fork
   git clone https://github.com/YOUR_USERNAME/terminal_example.git
   cd terminal_example
   ```

2. **Set Up Development Environment**
   ```bash
   # For each demo app you want to work on:
   cd demo-shop  # or admin-dashboard, adventure-game, animation-demo
   npm install
   npm run generate-keys
   ```

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

## Development Workflow

### Running Demo Apps

```bash
cd demo-shop  # or any demo app
npm start     # Start the SSH server
# In another terminal:
ssh localhost -p 2222
```

### Development Mode with Auto-Reload

```bash
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only E2E tests
npm run test:e2e

# Watch mode for development
npm run test:watch
```

## Coding Standards

### JavaScript/Node.js

- Use **ES Modules** (import/export syntax)
- Use **modern JavaScript** (ES2020+)
- Follow **consistent indentation** (2 spaces)
- Use **meaningful variable names**
- Add **JSDoc comments** for complex functions
- Keep functions **small and focused**

### File Organization

```
src/
├── server/        # Server-side logic
│   ├── index.js   # Main entry point
│   ├── router.js  # Screen routing
│   └── session.js # Session management
├── ui/            # User interface screens
│   ├── components.js  # Reusable UI components
│   └── *.js       # Individual screens
└── models/        # Data models and business logic
```

### Naming Conventions

- **Files**: lowercase with hyphens (`my-screen.js`)
- **Classes**: PascalCase (`MyScreen`)
- **Functions**: camelCase (`myFunction`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_CONNECTIONS`)

## Testing Guidelines

### Writing Tests

1. **Unit Tests** (`test/unit/`)
   - Test individual functions and classes
   - Mock external dependencies
   - Focus on business logic

2. **E2E Tests** (`test/e2e/`)
   - Test complete user workflows
   - Use actual SSH connections
   - Verify screen transitions

### Test Structure

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Feature Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    assert.strictEqual(result, 'expected');
  });
});
```

### Test Coverage

- Aim for **80%+ code coverage** for new features
- All bug fixes should include a **regression test**
- Critical paths should have **E2E test coverage**

## Security Guidelines

### Before Submitting Code

1. **Never Commit Secrets**
   - No API keys, passwords, or tokens
   - Use environment variables
   - Check `.gitignore` coverage

2. **Input Validation**
   - Validate all user inputs
   - Sanitize data before use
   - Prevent injection attacks

3. **Dependency Security**
   ```bash
   npm audit
   npm audit fix  # If safe
   ```

4. **Review Security Policy**
   - Read [SECURITY.md](./SECURITY.md)
   - Follow security best practices
   - Report vulnerabilities responsibly

### Security Scanning

All pull requests automatically run:
- CodeQL security analysis
- NPM audit for dependency vulnerabilities
- Automated tests

## Pull Request Process

### 1. Before Creating a PR

- [ ] Run all tests locally: `npm test`
- [ ] Check for linting errors
- [ ] Run security audit: `npm audit`
- [ ] Update documentation if needed
- [ ] Ensure no secrets are committed
- [ ] Self-review your code

### 2. Creating the PR

- Use the pull request template
- Provide clear description of changes
- Link related issues
- Add screenshots for UI changes
- Mark as draft if work in progress

### 3. PR Review Process

- Automated checks must pass:
  - ✅ All tests pass
  - ✅ CodeQL security scan passes
  - ✅ No critical vulnerabilities
- At least one maintainer approval required
- Address review feedback promptly
- Keep PR scope focused and small

### 4. After Merge

- Delete your feature branch
- Update your local repository
- Close related issues if applicable

## Documentation

### Update Documentation When

- Adding new features
- Changing APIs or interfaces
- Modifying configuration options
- Adding new dependencies
- Changing deployment procedures

### Documentation Files

- **README.md**: Project overview and quick start
- **USAGE_GUIDE.md**: Detailed usage instructions
- **QUICK_REFERENCE.md**: Quick reference guide
- **DESIGN_PRINCIPLES.md**: Design decisions and patterns
- **SECURITY.md**: Security policies and guidelines

### Code Documentation

```javascript
/**
 * Brief description of what the function does
 * 
 * @param {string} param1 - Description of param1
 * @param {Object} options - Configuration options
 * @param {boolean} options.verbose - Enable verbose output
 * @returns {Promise<Object>} Description of return value
 * @throws {Error} When something goes wrong
 */
export async function myFunction(param1, options = {}) {
  // Implementation
}
```

## Types of Contributions

### Bug Fixes

1. Create an issue describing the bug
2. Reference the issue in your PR
3. Include a test that reproduces the bug
4. Verify the fix resolves the issue

### New Features

1. Discuss the feature in an issue first
2. Ensure it aligns with project goals
3. Include comprehensive tests
4. Update documentation
5. Add usage examples

### Documentation

- Fix typos and grammar
- Improve clarity and examples
- Add missing documentation
- Update outdated information

### Examples and Demos

- Create new demo applications
- Improve existing demos
- Add usage examples
- Create tutorials

## Questions?

- Open an issue for discussion
- Check existing issues and PRs
- Read the documentation thoroughly

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project acknowledgments

Thank you for contributing! 🎉
