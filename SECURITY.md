# Security Policy

## Supported Versions

We take security seriously. The following versions are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Security Notice

**Important**: All demo applications in this repository are configured to accept **anonymous SSH connections** and are intended for **local development and demonstration purposes only**. 

These applications are **NOT hardened for production or public-facing deployment**.

### Known Security Considerations

1. **Anonymous SSH Access**: Demo apps allow connections without authentication
2. **No Rate Limiting**: No built-in protection against abuse or DoS attacks
3. **Session Management**: Sessions stored in memory or local filesystem
4. **No Input Sanitization**: Limited validation on user inputs
5. **Development Mode**: Applications run with development configurations

### Security Recommendations for Production Use

If you plan to deploy any application based on this template to a production or internet-facing environment, you **MUST** implement:

1. **Authentication**
   - Implement SSH public key authentication
   - Remove anonymous access
   - Add user management and authorization

2. **Rate Limiting**
   - Implement connection rate limiting
   - Add request throttling
   - Monitor for suspicious activity

3. **Input Validation**
   - Sanitize all user inputs
   - Implement proper validation for forms and commands
   - Prevent command injection and other attacks

4. **Secure Configuration**
   - Use environment variables for sensitive data
   - Never commit credentials or keys to version control
   - Use secure session storage (e.g., Redis with authentication)

5. **Network Security**
   - Use firewall rules to restrict access
   - Consider VPN or bastion host access
   - Implement TLS/SSL where applicable

6. **Monitoring and Logging**
   - Implement comprehensive logging
   - Set up security monitoring and alerts
   - Regular security audits

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT** open a public issue
2. **For critical vulnerabilities**: Use [GitHub Security Advisories](https://github.com/markomanninen/terminal_example/security/advisories/new) to report privately
3. **For non-critical issues**: Email the maintainer at the email address found in the git repository or open a private security advisory
4. Provide detailed information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Varies based on severity (critical issues prioritized)

We will acknowledge your contribution in the security advisory (unless you prefer to remain anonymous).

## Security Best Practices for Contributors

When contributing to this project:

1. Never commit sensitive data (keys, passwords, tokens)
2. Review code for common vulnerabilities (injection, XSS, etc.)
3. Follow secure coding practices
4. Run security scans before submitting PRs
5. Keep dependencies up to date

## Automated Security Scanning

This repository uses:

- **CodeQL**: Automated code security scanning
- **Dependabot**: Dependency vulnerability alerts
- **NPM Audit**: Regular dependency security checks

All pull requests are automatically scanned for security issues.

## Security Updates

Security updates will be:
- Released promptly for critical vulnerabilities
- Documented in release notes
- Announced through GitHub security advisories

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [SSH Security Best Practices](https://www.ssh.com/academy/ssh/security)

## Acknowledgments

We appreciate the security community's efforts in responsible disclosure and collaborative security improvement.
